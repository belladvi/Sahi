import { Router } from 'express';
import { healthResponseSchema, type HealthResponse } from '@sahi/shared';
import { prisma } from '@sahi/db';

export const healthRouter: Router = Router();

healthRouter.get('/health', async (_req, res) => {
  let db: HealthResponse['db'] = 'down';
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = 'up';
  } catch {
    db = 'down';
  }

  const body: HealthResponse = {
    status: 'ok',
    service: 'sahi-api',
    timestamp: new Date().toISOString(),
    db,
  };
  res.json(healthResponseSchema.parse(body));
});
