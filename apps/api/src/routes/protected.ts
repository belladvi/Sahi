import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const protectedRouter: Router = Router();

/** Any signed-in user. */
protectedRouter.get('/me', requireAuth(), (req, res) => {
  res.json({ user: req.user });
});

/** Ops/admin only — proves RBAC. A baker gets 403 here. */
protectedRouter.get('/ops/summary', requireRole('ops', 'admin'), (_req, res) => {
  res.json({ ok: true, area: 'ops', note: 'ops-only resource' });
});
