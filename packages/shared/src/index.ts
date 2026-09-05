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

// --- account lookup (sign-in) ---------------------------------------------
/** Used by sign-in to check whether a contact already has an account before
 * sending an OTP (an unknown contact is nudged to the funnel instead of being
 * silently signed up). `contact` is the already-normalised phone (+91…) or a
 * trimmed email — exactly the value the OTP will be sent to. */
export const accountLookupSchema = z.object({
  method: z.enum(['phone', 'email']),
  contact: z.string().trim().min(1).max(254),
});
export type AccountLookup = z.infer<typeof accountLookupSchema>;

// --- documents (screen 7 / ticket 14) -------------------------------------
/** Masked Aadhaar: first 8 digits hidden, only the last 4 shown. This is the
 * ONLY form allowed to leave the device / be stored — a full 12-digit number
 * is rejected server-side (Aadhaar-minimize). */
export function maskAadhaar(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 4) return '';
  return `XXXX XXXX ${digits.slice(-4)}`;
}
/** Accepts exactly the masked shape "XXXX XXXX 1234" (space optional). */
export const MASKED_AADHAAR_RE = /^X{4}\s?X{4}\s?\d{4}$/;
export function isMaskedAadhaar(s: string): boolean {
  return MASKED_AADHAAR_RE.test(s.trim());
}

/** Save-documents payload. `aadhaarMasked` must be masked — the server rejects
 * anything else so a raw Aadhaar number can never be persisted. */
export const documentsSchema = z.object({
  photoKey: z.string().trim().min(1).max(300).optional(),
  addressProofKey: z.string().trim().min(1).max(300).optional(),
  aadhaarMasked: z
    .string()
    .trim()
    .refine(isMaskedAadhaar, 'Aadhaar must be masked (only the last 4 digits)')
    .optional(),
  applicantName: z.string().trim().max(120).optional(),
  residentialAddress: z.string().trim().max(300).optional(),
});
export type DocumentsInput = z.infer<typeof documentsSchema>;

// --- Confirm details / Form-A (screen 8 / ticket 15) ----------------------
/** The pre-filled confirm view: read from documents + account, the baker edits
 * the manual fields and affirms the hygiene declaration before we file. */
export interface ConfirmView {
  applicantName: string | null;
  businessName: string | null;
  products: string[];
  residentialAddress: string | null;
  phone: string | null;
  email: string | null;
  hygieneAccepted: boolean;
  status: string;
}

/** What the baker submits from the confirm screen. Hygiene MUST be ticked
 * (it's her legal self-declaration) or we won't file. Email is optional —
 * phone-signup accounts may not have a real one yet. */
export const formASchema = z.object({
  applicantName: z.string().trim().min(1, 'Add your name').max(120),
  businessName: z.string().trim().min(1, 'Add your business name').max(120),
  residentialAddress: z.string().trim().min(1, 'Add your address').max(300),
  phone: z.string().trim().min(8, 'Add your phone number').max(20),
  email: z.union([z.string().trim().email().max(254), z.literal('')]).optional(),
  hygieneAccepted: z.literal(true, {
    errorMap: () => ({ message: 'Please confirm the hygiene declaration' }),
  }),
});
export type FormAInput = z.infer<typeof formASchema>;

// --- Filing status / state machine (screen 9 / ticket 16) -----------------
/** Baker-facing application status. Government queries are NOT surfaced to her
 * (we fix them for free) — `gov_query` reads as "under review". */
export type FilingStatus = 'draft' | 'paid' | 'preparing' | 'filed' | 'gov_query' | 'approved';

export interface FilingStatusView {
  status: FilingStatus;
  businessName: string | null;
  filedAt: string | null;
  approvedAt: string | null;
  fssaiNumber: string | null;
  certificateUrl: string | null; // short-lived signed URL, only once approved
}

/** The baker has submitted her packet — from her side it's "we're handling it".
 * Covers preparing (with ops) through approved. */
export function hasFiled(status: FilingStatus): boolean {
  return (
    status === 'preparing' || status === 'filed' || status === 'gov_query' || status === 'approved'
  );
}

/** Ops has actually sent it to the government portal (drives the "Sent to FoSCoS"
 * milestone). `gov_query` counts — it's been filed, the query is hidden from her. */
export function sentToGovernment(status: FilingStatus): boolean {
  return status === 'filed' || status === 'gov_query' || status === 'approved';
}

// --- Ops console (screen 17/18 / ticket 17) --------------------------------
/** A row in the ops filing queue (staff-only). */
export interface OpsQueueItem {
  id: string;
  status: FilingStatus;
  businessName: string | null;
  applicantName: string | null;
  products: string[];
  premises: Premises | null;
  filedAt: string | null;
  createdAt: string;
}

/** A document link in the ops packet (short-lived signed URL). */
export interface OpsDocLink {
  label: string;
  url: string | null;
  note?: string;
}

/** The full assembled packet Ops files with the government. */
export interface OpsApplicationDetail extends OpsQueueItem {
  category: string | null; // ops (unlike the baker) DOES see the mapped category
  subCategory: string | null;
  kindOfBusiness: string | null;
  description: string | null;
  residentialAddress: string | null;
  aadhaarMasked: string | null;
  phone: string | null;
  email: string | null;
  fssaiNumber: string | null; // set once published (ticket 18)
  documents: OpsDocLink[];
  events: OpsFilingEvent[];
}

export interface OpsFilingEvent {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  createdAt: string;
}

/** Ops status transitions (the rejection-recovery loop). Approval (→approved)
 * is a separate, richer action (ticket 18), not part of this set. */
export const opsTransitionSchema = z.object({
  toStatus: z.enum(['filed', 'gov_query']),
  note: z.string().trim().max(1000).optional(),
});
export type OpsTransition = z.infer<typeof opsTransitionSchema>;

// --- Ops approval + publish (screen 18 / ticket 18) -----------------------
/** FSSAI registration numbers are 14 digits. */
export const FSSAI_NUMBER_RE = /^\d{14}$/;
export function isValidFssaiNumber(s: string): boolean {
  return FSSAI_NUMBER_RE.test(s.replace(/\s/g, ''));
}

/** Ops publish payload: the approved number + the stored certificate key.
 * Publish is blocked (server + client) until both are present and valid. */
export const publishSchema = z.object({
  fssaiNumber: z.string().trim().transform((s) => s.replace(/\s/g, '')).refine(isValidFssaiNumber, 'FSSAI number must be 14 digits'),
  certificateKey: z.string().trim().min(1, 'Attach the certificate PDF').max(300),
});
export type PublishInput = z.infer<typeof publishSchema>;

/** Allowed ops transitions from a given status (approval handled separately). */
export function allowedOpsTransitions(from: FilingStatus): FilingStatus[] {
  switch (from) {
    case 'preparing':
      return ['filed'];
    case 'filed':
      return ['gov_query']; // + approved via the approval action (ticket 18)
    case 'gov_query':
      return ['filed']; // resubmitted after fixing the query
    default:
      return [];
  }
}

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
