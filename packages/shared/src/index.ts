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

// --- Pricing (the honest split) ---
export const GOV_FEE_RUPEES = 100;
export const SERVICE_FEE_RUPEES = 499;
export const TOTAL_FEE_RUPEES = GOV_FEE_RUPEES + SERVICE_FEE_RUPEES; // 599

// --- Eligibility (screen 2) ---
/** basic = turnover within the FSSAI Basic ceiling; above = needs State/Central. */
export const turnoverBandSchema = z.enum(['basic', 'above']);
export type TurnoverBand = z.infer<typeof turnoverBandSchema>;

export const premisesSchema = z.enum(['own', 'rent']);
export type Premises = z.infer<typeof premisesSchema>;

export interface EligibilityResult {
  licence: 'basic' | 'state-or-central';
  eligible: boolean;
  govFee: number;
  serviceFee: number;
  total: number;
  message: string;
}

export function evaluateEligibility(band: TurnoverBand): EligibilityResult {
  if (band === 'above') {
    return {
      licence: 'state-or-central',
      eligible: false,
      govFee: 0,
      serviceFee: 0,
      total: 0,
      message:
        'Your turnover suggests a State or Central licence, not Basic. We can point you the right way.',
    };
  }
  return {
    licence: 'basic',
    eligible: true,
    govFee: GOV_FEE_RUPEES,
    serviceFee: SERVICE_FEE_RUPEES,
    total: TOTAL_FEE_RUPEES,
    message: 'You qualify for FSSAI Basic Registration.',
  };
}

// --- Document checklist (screen 4) ---
export interface DocItem {
  key: string;
  label: string;
}
export function documentChecklist(premises: Premises): DocItem[] {
  const items: DocItem[] = [
    { key: 'photo', label: 'Passport-size photo' },
    { key: 'aadhaar', label: 'Aadhaar (identity proof)' },
  ];
  if (premises === 'rent') {
    items.push({ key: 'address_proof', label: 'Address proof (rent agreement or utility bill)' });
  }
  return items;
}

// --- Draft application (shared web <-> api) ---
export const draftUpdateSchema = z.object({
  products: z.array(z.string().min(1)).max(20).optional(),
  premises: premisesSchema.optional(),
  turnoverBand: turnoverBandSchema.optional(),
  businessName: z.string().trim().max(120).optional(),
  description: z.string().trim().max(1000).optional(),
});
export type DraftUpdate = z.infer<typeof draftUpdateSchema>;

/** What the baker is allowed to see (category mapping is intentionally excluded). */
export interface DraftApplication {
  id: string;
  status: string;
  products: string[];
  premises: Premises | null;
  turnoverBand: TurnoverBand | null;
  businessName: string | null;
  description: string | null;
}

export const APP_NAME = 'Sahi';
