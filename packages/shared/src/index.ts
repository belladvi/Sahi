import { z } from 'zod';

/**
 * Shared contracts used by both `apps/web` and `apps/api`.
 * One source of truth for validation on client and server.
 */

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.string(),
  timestamp: z.string(),
  db: z.enum(['up', 'down']),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

// --- Notes (ticket 02: trivial round-trip proving DB + shared validation) ---

/** Payload the client sends and the server validates — the SAME schema. */
export const createNoteSchema = z.object({
  text: z.string().trim().min(1, 'Note cannot be empty').max(500, 'Note is too long'),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;

/** A persisted note as returned by the API. */
export const noteSchema = z.object({
  id: z.string(),
  text: z.string(),
  createdAt: z.string(),
});

export type Note = z.infer<typeof noteSchema>;

// --- Roles / RBAC (ticket 05) ---

export const roleSchema = z.enum(['baker', 'ops', 'admin']);
export type Role = z.infer<typeof roleSchema>;

/** Staff = ops or admin. */
export const STAFF_ROLES: readonly Role[] = ['ops', 'admin'];

export const APP_NAME = 'Sahi';
