import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import {
  allowedOpsTransitions,
  opsTransitionSchema,
  publishSchema,
  type FilingStatus,
  type OpsApplicationDetail,
  type OpsDocLink,
  type OpsQueueItem,
} from '@sahi/shared';
import { prisma } from '@sahi/db';
import { CERTIFICATE_MAX_BYTES, getStorage, isValidStoredObject, purgeRawIdDocs } from '../lib/storage.js';
import { redact } from '../lib/notifications.js';
import { enqueueLicenceReadyTx, deliverLicenceReady } from '../lib/notification-workflow.js';
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
      fssaiNumber: app.fssaiNumber,
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

// Signed upload URL for the approval certificate PDF (role-gated). Ops PUTs the
// file to /api/storage/object with this URL, then passes the key to /publish.
opsRouter.post('/ops/applications/:id/certificate-upload-url', requireRole('ops', 'admin'), (req, res) => {
  const key = `applications/${String(req.params.id)}/certificate/${randomUUID()}.pdf`;
  const storage = getStorage();
  res.status(201).json({ key, upload: storage.signUpload(key, 'application/pdf', CERTIFICATE_MAX_BYTES), mock: storage.mock });
});

// Approve + publish (screen 18). Blocked until a valid 14-digit number AND a
// stored certificate are present. One transaction: flip to approved, store the
// number/certificate, mint the public verify token, and audit-log it. Then
// enqueue the baker notification and run the raw-ID retention purge (ticket 13).
opsRouter.post('/ops/applications/:id/publish', requireRole('ops', 'admin'), async (req, res, next) => {
  try {
    const parsed = publishSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const id = String(req.params.id);
    const app = await prisma.application.findUnique({ where: { id }, select: { id: true, status: true, verifyToken: true } });
    if (!app) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    // Only a filed (or queried) application can be approved.
    if (app.status !== 'filed' && app.status !== 'gov_query') {
      res.status(409).json({ error: `Cannot publish from status ${app.status}` });
      return;
    }
    const { fssaiNumber, certificateKey } = parsed.data;
    if (!(await isValidStoredObject(id, 'certificate', certificateKey))) {
      res.status(400).json({ error: 'Attach a valid certificate PDF for this application' });
      return;
    }
    const verifyToken = app.verifyToken ?? randomUUID();
    await prisma.$transaction(async (tx) => {
      await tx.application.update({
        where: { id },
        data: { status: 'approved', fssaiNumber, certificateKey, verifyToken, approvedAt: new Date() },
      });
      await tx.filingEvent.create({
        data: { applicationId: id, fromStatus: app.status, toStatus: 'approved', note: `FSSAI ${fssaiNumber}`, actorId: req.user?.id ?? null },
      });
      // Ticket 26A: write the durable `queued` notification (outbox) row in the
      // SAME transaction as approval — atomic, so there is no crash window where
      // an application is approved with no notification record. No-op if the flag
      // is off. Delivery happens later, off the request path (below).
      await enqueueLicenceReadyTx(tx, id, fssaiNumber);
    });
    // Retention: drop any raw Aadhaar objects post-approval (no-op today — we
    // never persist raw Aadhaar, but this is the wired trigger from ticket 13).
    await purgeRawIdDocs(id);
    console.log(`[audit] ops ${req.user?.id} PUBLISHED application ${id}: ${app.status} -> approved`);
    // Fire-and-forget delivery — the approval response NEVER waits for storage
    // checks or the notification provider. If the process crashes before/within
    // delivery, the durable queued row above is recovered by the reconciler.
    void deliverLicenceReady(id).catch((err) => console.error(`[notify] delivery failed (non-fatal) app=${id}: ${redact(err)}`));
    res.json({ ok: true, status: 'approved', verifyToken });
  } catch (err) {
    next(err);
  }
});
