import { Router } from 'express';
import {
  allowedOpsTransitions,
  opsTransitionSchema,
  type FilingStatus,
  type OpsApplicationDetail,
  type OpsDocLink,
  type OpsQueueItem,
} from '@sahi/shared';
import { prisma } from '@sahi/db';
import { getStorage } from '../lib/storage.js';
import { requireRole } from '../middleware/auth.js';

export const opsRouter: Router = Router();

// The actionable filing pipeline (excludes draft/paid = packet not ready, and
// approved = done). Ops can also filter to a single status.
const PIPELINE: FilingStatus[] = ['preparing', 'filed', 'gov_query'];

function toQueueItem(a: {
  id: string;
  status: string;
  businessName: string | null;
  applicantName: string | null;
  products: string[];
  premises: string | null;
  filedAt: Date | null;
  createdAt: Date;
}): OpsQueueItem {
  return {
    id: a.id,
    status: a.status as FilingStatus,
    businessName: a.businessName,
    applicantName: a.applicantName,
    products: a.products,
    premises: (a.premises as OpsQueueItem['premises']) ?? null,
    filedAt: a.filedAt ? a.filedAt.toISOString() : null,
    createdAt: a.createdAt.toISOString(),
  };
}

// Filing queue — role-gated. ?status=<one> narrows it; default = whole pipeline.
opsRouter.get('/ops/applications', requireRole('ops', 'admin'), async (req, res, next) => {
  try {
    const filter = typeof req.query.status === 'string' ? (req.query.status as FilingStatus) : null;
    const statuses = filter && PIPELINE.includes(filter) ? [filter] : PIPELINE;
    const rows = await prisma.application.findMany({
      where: { status: { in: statuses } },
      orderBy: { updatedAt: 'asc' }, // oldest waiting first
    });
    res.json({ applications: rows.map(toQueueItem) });
  } catch (err) {
    next(err);
  }
});

// Full packet for one application — Ops (unlike the baker) sees the mapped
// government category and signed document links. Aadhaar is masked-only.
opsRouter.get('/ops/applications/:id', requireRole('ops', 'admin'), async (req, res, next) => {
  try {
    const app = await prisma.application.findUnique({
      where: { id: String(req.params.id) },
      include: { events: { orderBy: { createdAt: 'asc' } } },
    });
    if (!app) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const storage = getStorage();
    const documents: OpsDocLink[] = [
      { label: 'Applicant photo', url: app.photoKey ? storage.signDownload(app.photoKey).url : null },
      {
        label: 'Address proof',
        url: app.addressProofKey ? storage.signDownload(app.addressProofKey).url : null,
        note: app.premises === 'own' ? 'Not required (owns premises)' : undefined,
      },
      { label: 'Aadhaar (masked)', url: null, note: app.aadhaarMasked ?? 'Not provided' },
    ];
    const saved = (app.formA as { phone?: string; email?: string } | null) ?? null;
    const detail: OpsApplicationDetail = {
      ...toQueueItem(app),
      category: app.category,
      subCategory: app.subCategory,
      kindOfBusiness: app.kindOfBusiness,
      description: app.description,
      residentialAddress: app.residentialAddress,
      aadhaarMasked: app.aadhaarMasked,
      phone: saved?.phone ?? null,
      email: saved?.email ?? null,
      documents,
      events: app.events.map((e: (typeof app.events)[number]) => ({
        id: e.id,
        fromStatus: e.fromStatus,
        toStatus: e.toStatus,
        note: e.note,
        createdAt: e.createdAt.toISOString(),
      })),
    };
    res.json(detail);
  } catch (err) {
    next(err);
  }
});

// Advance status (the rejection-recovery loop). Validates the transition, sets
// filedAt on first file, and audit-logs a FilingEvent (with the actor).
opsRouter.post('/ops/applications/:id/transition', requireRole('ops', 'admin'), async (req, res, next) => {
  try {
    const parsed = opsTransitionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const app = await prisma.application.findUnique({ where: { id: String(req.params.id) }, select: { id: true, status: true, filedAt: true } });
    if (!app) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const from = app.status as FilingStatus;
    const { toStatus, note } = parsed.data;
    if (!allowedOpsTransitions(from).includes(toStatus)) {
      res.status(409).json({ error: `Cannot move from ${from} to ${toStatus}` });
      return;
    }
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.application.update({
        where: { id: app.id },
        data: {
          status: toStatus,
          // Stamp filedAt the first time it's actually filed.
          ...(toStatus === 'filed' && !app.filedAt ? { filedAt: new Date() } : {}),
        },
        select: { status: true },
      });
      await tx.filingEvent.create({
        data: { applicationId: app.id, fromStatus: from, toStatus, note: note ?? null, actorId: req.user?.id ?? null },
      });
      return u;
    });
    console.log(`[audit] ops ${req.user?.id} moved application ${app.id}: ${from} -> ${toStatus}`);
    res.json({ ok: true, status: updated.status });
  } catch (err) {
    next(err);
  }
});
