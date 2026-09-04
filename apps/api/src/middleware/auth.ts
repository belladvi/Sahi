import type { NextFunction, Request, Response } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import type { Role } from '@sahi/shared';
import { auth } from '../auth.js';

export interface AuthedUser {
  id: string;
  role: Role;
  email: string | null;
  phoneNumber: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}

async function resolveUser(req: Request): Promise<AuthedUser | null> {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session?.user) return null;
  const u = session.user as { id: string; role?: string; email?: string | null; phoneNumber?: string | null };
  return {
    id: u.id,
    role: (u.role as Role) ?? 'baker',
    email: u.email ?? null,
    phoneNumber: u.phoneNumber ?? null,
  };
}

/** 401 if not signed in; attaches req.user otherwise. */
export function requireAuth() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await resolveUser(req);
      if (!user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }
      req.user = user;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** 401 if not signed in, 403 if the role is not allowed. */
export function requireRole(...roles: Role[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user ?? (await resolveUser(req));
      if (!user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }
      req.user = user;
      if (!roles.includes(user.role)) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
