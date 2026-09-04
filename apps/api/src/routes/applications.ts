import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { draftUpdateSchema, type DraftApplication, type Premises, type TurnoverBand } from '@sahi/shared';
import { prisma } from '@sahi/db';
import { mapCategory } from '../lib/category-engine.js';
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
