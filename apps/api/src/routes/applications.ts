import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import {
  draftUpdateSchema,
  documentsSchema,
  formASchema,
  computeTrustScore,
  nextRouteForStatus,
  renewalStatus,
  RENEWAL_AMOUNT_PAISE,
  RENEWAL_GOV_FEE_RUPEES,
  RENEWAL_SERVICE_FEE_RUPEES,
  RENEWAL_TOTAL_RUPEES,
  type ConfirmView,
  type DraftApplication,
  type FilingStatus,
  type FilingStatusView,
  type Premises,
  type TrustFacts,
  type TurnoverBand,
} from '@sahi/shared';
import { prisma } from '@sahi/db';
import { mapCategory } from '../lib/category-engine.js';
import { getStorage } from '../lib/storage.js';
import { getGateway, CURRENCY } from '../lib/payments.js';
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
    // Immutable once paid or later: a stale token must never let the anonymous
    // front door overwrite a real application. Reject with a typed conflict and
    // leave the record untouched (the client starts a fresh draft instead).
    if (existing.status !== 'draft') {
      res.status(409).json({ error: 'This application can no longer be edited', code: 'NOT_DRAFT' });
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
    // Non-draft record: immutable. If it's the caller's own application, resume
    // it at its server-derived route (never mutate/reset it). If it isn't the
    // caller's, it's a conflict — never claim someone else's paid/later work.
    if (existing.status !== 'draft') {
      if (existing.bakerId && existing.bakerId === userId) {
        res.json({ ...toDraft(existing), nextRoute: nextRouteForStatus(existing.status) });
        return;
      }
      res.status(409).json({ error: 'This application can no longer be claimed', code: 'NOT_DRAFT' });
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
    res.json({ ...toDraft(updated), nextRoute: nextRouteForStatus(updated.status) });
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

// Trust Score (screen 14): computed from the baker's REAL compliance/profile
// facts — no fabricated data. Explainable breakdown returned for the UI.
applicationsRouter.get('/applications/current/trust-score', requireAuth(), async (req, res, next) => {
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
    const paid = await prisma.payment.findFirst({ where: { applicationId: app.id, status: 'paid' }, select: { id: true } });
    const saved = (app.formA as { email?: string } | null) ?? null;
    const facts: TrustFacts = {
      licenceActive: app.status === 'approved' && !!app.fssaiNumber,
      feeCurrent: !!paid,
      documentsVerified: !!app.photoKey && !!app.aadhaarMasked && (app.premises !== 'rent' || !!app.addressProofKey),
      emailOnFile: !!(saved?.email && saved.email.trim().length > 0),
    };
    res.json(computeTrustScore(facts));
  } catch (err) {
    next(err);
  }
});

async function approvedAppForUser(userId: string) {
  return prisma.application.findFirst({ where: { bakerId: userId, status: 'approved' }, orderBy: { updatedAt: 'desc' } });
}

// Renewal / stay-active status (screen 15): cohort + due-date from the issue date.
applicationsRouter.get('/applications/current/renewal', requireAuth(), async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const app = await approvedAppForUser(userId);
    if (!app || !app.approvedAt) {
      res.status(404).json({ error: 'No active licence' });
      return;
    }
    res.json({
      ...renewalStatus(app.approvedAt, app.renewedAt ?? null),
      govFee: RENEWAL_GOV_FEE_RUPEES,
      serviceFee: RENEWAL_SERVICE_FEE_RUPEES,
      total: RENEWAL_TOTAL_RUPEES,
    });
  } catch (err) {
    next(err);
  }
});

// Renew (₹399/yr) — reuses the ticket-12 payment gateway. In mock mode the
// renewal is recorded + the due date pushed out immediately; live checkout
// (real Razorpay renewal) is a follow-up.
applicationsRouter.post('/applications/current/renew', requireAuth(), async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const app = await approvedAppForUser(userId);
    if (!app || !app.approvedAt) {
      res.status(404).json({ error: 'No active licence' });
      return;
    }
    const gateway = getGateway();
    const order = await gateway.createOrder({ amount: RENEWAL_AMOUNT_PAISE, currency: CURRENCY, receipt: `renew_${app.id}` });
    await prisma.payment.create({
      data: {
        applicationId: app.id,
        orderId: order.orderId,
        amount: RENEWAL_AMOUNT_PAISE,
        currency: CURRENCY,
        status: gateway.mock ? 'paid' : 'created',
      },
    });
    if (!gateway.mock) {
      // Live: hand the order back for Razorpay checkout (webhook finalisation TBD).
      res.status(201).json({ renewed: false, orderId: order.orderId, amount: RENEWAL_AMOUNT_PAISE, keyId: gateway.keyId, mock: false });
      return;
    }
    const now = new Date();
    const updated = await prisma.application.update({ where: { id: app.id }, data: { renewedAt: now } });
    res.json({
      renewed: true,
      ...renewalStatus(updated.approvedAt as Date, updated.renewedAt ?? null, now),
      govFee: RENEWAL_GOV_FEE_RUPEES,
      serviceFee: RENEWAL_SERVICE_FEE_RUPEES,
      total: RENEWAL_TOTAL_RUPEES,
    });
  } catch (err) {
    next(err);
  }
});
