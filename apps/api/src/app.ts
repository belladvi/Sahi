import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth.js';
import { healthRouter } from './routes/health.js';
import { notesRouter } from './routes/notes.js';
import { protectedRouter } from './routes/protected.js';
import { applicationsRouter } from './routes/applications.js';

export function createApp(): Express {
  const app = express();

  app.use(cors({ origin: process.env.CORS_ORIGIN ?? true, credentials: true }));

  // Better Auth handler must run BEFORE express.json() (it reads the raw body).
  // Path-guard middleware avoids Express 5 wildcard-route syntax pitfalls.
  const authHandler = toNodeHandler(auth);
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/auth/')) {
      void authHandler(req, res);
      return;
    }
    next();
  });

  app.use(express.json());

  app.use('/api', healthRouter);
  app.use('/api', notesRouter);
  app.use('/api', protectedRouter);
  app.use('/api', applicationsRouter);

  // In production the API serves the built SPA from the same Docker image.
  if (process.env.NODE_ENV === 'production') {
    const dirname = path.dirname(fileURLToPath(import.meta.url));
    // Runtime layout: apps/api/dist -> apps/web/dist
    const webDist = path.resolve(dirname, '../../web/dist');

    app.use(express.static(webDist));

    // SPA fallback for client-side routes (Express 5: use middleware, not '*').
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) {
        next();
        return;
      }
      res.sendFile(path.join(webDist, 'index.html'));
    });
  }

  // JSON error handler (last).
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[api] unhandled error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  });

  return app;
}
