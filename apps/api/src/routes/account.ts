import { Router } from 'express';
import { accountLookupSchema } from '@sahi/shared';
import { prisma } from '@sahi/db';

export const accountRouter: Router = Router();

// Does a contact already have an account? Used by the sign-in screen to avoid
// silently signing up an unknown contact (phone `verify` auto-creates users).
// Returns only a boolean — no user data. (Enumeration is acceptable here; the
// security pass, ticket 28, can add rate-limiting if needed.)
accountRouter.post('/account/exists', async (req, res, next) => {
  try {
    const parsed = accountLookupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { method, contact } = parsed.data;
    const where = method === 'phone' ? { phoneNumber: contact } : { email: contact };
    const user = await prisma.user.findFirst({ where, select: { id: true } });
    res.json({ exists: user !== null });
  } catch (err) {
    next(err);
  }
});
