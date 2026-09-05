import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import {
  draftUpdateSchema,
  documentsSchema,
  formASchema,
  type ConfirmView,
  type DraftApplication,
  type FilingStatus,
  type FilingStatusView,
  type Premises,
  type TurnoverBand,
} from '@sahi/shared';
import { prisma } from '@sahi/db';
import { mapCategory } from '../lib/category-engine.js';
import { getStorage } from '../lib/storage.js';
import { requireAuth } from '../middleware/auth.js';

export const applicationsRouter: Router = Router();

const DRAFT_HEADER = 'x-draft-token';

type ApplicationRow = {
  id: string;
  status: string;
  products: string[];
  premises: string | null;
  turnoverBand: string | null;
  businessName: string | null;
  description: string | null;
};

/** Public projection — the hidden category mapping is intentionally omitted. */
function toDraft(a: ApplicationRow): DraftApplication {
  return {
    id: a.id,
    status: a.status,
    products: a.products,
    premises: (a.premises as Premises | null) ?? null,
    turnoverBand: (a.turnoverBand as TurnoverBand | null) ?? null,
    businessName: a.businessName,
    description: a.description,
  };
}

// Create a new anonymous draft. Returns the draftToken the client stores.
applicationsRouter.post('/applications', async (_req, res, next) => {
  try {
    const draftToken = randomUUID();
    const app = await prisma.application.create({ data: { draftToken } });
    res.status(201).json({ draftToken, application: toDraft(app) });
  } catch (err) {
    next(err);
  }
});

// Read the current draft (by header token).
applicationsRouter.get('/applications/current', async (req, res, next) => {
  try {
    const token = req.header(DRAFT_HEADER);
    if (!token) {
      res.status(400).json({ error: 'Missing draft token' });
      return;
    }
    const app = await prisma.application.findUnique({ where: { draftToken: token } });
    if (!app) {
      res.status(404).json({ error: 'No draft' });
      return;
    }
    res.json(toDraft(app));
  } catch (err) {
    next(err);
  }
});

// Update the current draft; re-runs the category engine when inputs change.
applicationsRouter.patch('/applications/current', async (req, res, next) => {
  try {
    const token = req.header(DRAFT_HEADER);
    if (!token) {
      res.status(400).json({ error: 'Missing draft token' });
      return;
    }
    const parsed = draftUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const existing = await prisma.application.findUnique({ where: { draftToken: token } });
    if (!existing) {
      res.status(404).json({ error: 'No draft' });
      return;
    }

    const data = { ...parsed.data } as Record<string, unknown>;

    // Recompute the hidden category mapping from the latest words (never returned).
    const products = parsed.data.products ?? existing.products;
    const description = parsed.data.description ?? existing.description ?? undefined;
    if (parsed.data.products || parsed.data.description) {
      const mapping = mapCategory({ products, description });
      data.kindOfBusiness = mapping.kindOfBusiness;
      data.category = mapping.category;
      data.subCategory = mapping.subCategory;
    }

    const updated = await prisma.application.update({ where: { draftToken: token }, data });
    res.json(toDraft(updated));
  } catch (err) {
    next(err);
  }
});

// Attach the anonymous draft to the signed-in baker (called right after
// account creation at the pay-commit moment). Idempotent; won't steal a draft
// already linked to a different account.
applicationsRouter.post('/applications/current/claim', requireAuth(), async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const token = req.header(DRAFT_HEADER);
    if (!token) {
      res.status(400).json({ error: 'Missing draft token' });
      return;
    }
    const existing = await prisma.application.findUnique({ where: { draftToken: token } });
    if (!existing) {
      res.status(404).json({ error: 'No draft' });
      return;
    }
    if (existing.bakerId && existing.bakerId !== userId) {
      res.status(409).json({ error: 'Draft already linked to another account' });
      return;
    }
    const updated = await prisma.application.update({
      where: { draftToken: token },
      data: { bakerId: userId },
    });
    res.json(toDraft(updated));
  } catch (err) {
    next(err);
  }
});

// Save uploaded-document references + client-OCR'd fields for the baker's
// application (screen 7). The schema REJECTS a full Aadhaar number, so only a
// masked value can ever be persisted — the raw Aadhaar image is never uploaded.
applicationsRouter.post('/applications/current/documents', requireAuth(), async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const parsed = documentsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const application = await prisma.application.findFirst({
      where: { bakerId: userId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });
    if (!application) {
      res.status(404).json({ error: 'No application' });
      return;
    }
    await prisma.application.update({ where: { id: application.id }, data: parsed.data });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Phone-signup accounts get a synthetic email; don't surface it as a real one.
function realEmail(email: string | null): string | null {
  if (!email || email.endsWith('@phone.sahi.local')) return null;
  return email;
}

// Confirm view (screen 8): pre-fill Form-A from documents + eligibility + the
// signed-in account. The category mapping stays hidden.
applicationsRouter.get('/applications/current/confirm', requireAuth(), async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const app = await prisma.application.findFirst({
      where: { bakerId: userId },
      orderBy: { updatedAt: 'desc' },
    });
    if (!app) {
      res.status(404).json({ error: 'No application' });
      return;
    }
    const saved = (app.formA as { phone?: string; email?: string; hygieneAccepted?: boolean } | null) ?? null;
    const view: ConfirmView = {
      applicantName: app.applicantName,
      businessName: app.businessName,
      products: app.products,
      residentialAddress: app.residentialAddress,
      phone: saved?.phone ?? req.user?.phoneNumber ?? null,
      email: saved?.email ?? realEmail(req.user?.email ?? null),
      hygieneAccepted: saved?.hygieneAccepted ?? false,
      status: app.status,
    };
    res.json(view);
  } catch (err) {
    next(err);
  }
});

// File Form-A (screen 8 → filing): persist the confirmed details + the hygiene
// self-declaration, then flip the application to `filed`.
applicationsRouter.post('/applications/current/form-a', requireAuth(), async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const parsed = formASchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const app = await prisma.application.findFirst({
      where: { bakerId: userId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });
    if (!app) {
      res.status(404).json({ error: 'No application' });
      return;
    }
    const { applicantName, businessName, residentialAddress, phone, email, hygieneAccepted } = parsed.data;
    const updated = await prisma.application.update({
      where: { id: app.id },
      data: {
        applicantName,
        businessName,
        residentialAddress,
        // Baker-submit lands in `preparing` (in the Ops queue). Ops marks it
        // `filed` once actually sent to the government portal (ticket 17).
        status: 'preparing',
        formA: { phone, email: email ?? '', hygieneAccepted, submittedAt: new Date().toISOString() },
      },
      select: { status: true },
    });
    res.json({ ok: true, status: updated.status });
  } catch (err) {
    next(err);
  }
});

// Filing status (screen 9): the calm state machine. Government queries stay
// hidden from the baker — `gov_query` is reported to her as still under review.
applicationsRouter.get('/applications/current/filing', requireAuth(), async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const app = await prisma.application.findFirst({
      where: { bakerId: userId },
      orderBy: { updatedAt: 'desc' },
    });
    if (!app) {
      res.status(404).json({ error: 'No application' });
      return;
    }
    // A certificate download only exists once approved and a key is set (ticket 18).
    let certificateUrl: string | null = null;
    if (app.status === 'approved' && app.certificateKey) {
      certificateUrl = getStorage().signDownload(app.certificateKey).url;
    }
    const view: FilingStatusView = {
      status: app.status as FilingStatus,
      businessName: app.businessName,
      filedAt: app.filedAt ? app.filedAt.toISOString() : null,
      approvedAt: app.approvedAt ? app.approvedAt.toISOString() : null,
      fssaiNumber: app.status === 'approved' ? app.fssaiNumber : null,
      certificateUrl,
      verifyToken: app.status === 'approved' ? app.verifyToken : null,
    };
    res.json(view);
  } catch (err) {
    next(err);
  }
});
