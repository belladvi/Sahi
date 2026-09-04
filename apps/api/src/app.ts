import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Express } from 'express';
import cors from 'cors';
import { healthRouter } from './routes/health.js';

export function createApp(): Express {
  const app = express();

  app.use(cors({ origin: process.env.CORS_ORIGIN ?? true, credentials: true }));
  app.use(express.json());

  app.use('/api', healthRouter);

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

  return app;
}
