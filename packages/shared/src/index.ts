import { z } from 'zod';

/**
 * Shared contracts used by both `apps/web` and `apps/api`.
 * One source of truth for validation on client and server.
 */

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.string(),
  timestamp: z.string(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const APP_NAME = 'Sahi';
