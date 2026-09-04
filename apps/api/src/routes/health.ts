import { Router } from 'express';
import { healthResponseSchema, type HealthResponse } from '@sahi/shared';

export const healthRouter: Router = Router();

healthRouter.get('/health', (_req, res) => {
  const body: HealthResponse = {
    status: 'ok',
    service: 'sahi-api',
    timestamp: new Date().toISOString(),
  };
  // Validate our own contract before responding (ticket 02+ extends this
  // to check DB / object storage, per build-spec §6).
  res.json(healthResponseSchema.parse(body));
});
