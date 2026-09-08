import type { DraftApplication, DraftUpdate } from '@sahi/shared';
import { nextRouteForStatus } from '@sahi/shared';
import { apiGet } from './http';

const KEY = 'sahi_draft_token';
const API = import.meta.env.VITE_API_BASE_URL ?? '';

export function getDraftToken(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function setDraftToken(token: string) {
  try {
    localStorage.setItem(KEY, token);
  } catch {
    /* private mode — draft won't persist across reloads, that's ok */
  }
}

/** Ensure a server-side DRAFT exists; returns its token. If the stored token
 * points at a paid/later application, that record is left untouched and a fresh
 * anonymous draft is minted — a deliberate new eligibility journey never
 * overwrites or resets prior applications. */
export async function ensureDraft(): Promise<string> {
  const existing = getDraftToken();
  if (existing) {
    const res = await fetch(`${API}/api/applications/current`, {
      headers: { 'x-draft-token': existing },
    });
    if (res.ok) {
      const app = (await res.json()) as { status?: string };
      if (app.status === 'draft') return existing;
      // else: stale non-draft token — fall through and start a fresh draft.
    }
  }
  const res = await fetch(`${API}/api/applications`, { method: 'POST' });
  const data = (await res.json()) as { draftToken: string };
  setDraftToken(data.draftToken);
  return data.draftToken;
}

export function getDraft(signal?: AbortSignal): Promise<DraftApplication | null> {
  const token = getDraftToken();
  if (!token) return Promise.resolve(null);
  return apiGet<DraftApplication>('/api/applications/current', {
    headers: { 'x-draft-token': token },
    signal,
  });
}

export async function updateDraft(update: DraftUpdate): Promise<DraftApplication> {
  const token = await ensureDraft();
  return patchDraft(token, update);
}

/** PATCH the draft behind a token the caller has ALREADY validated (e.g. a
 * screen that loaded the draft on mount). Skips `ensureDraft`'s extra GET —
 * on prod that round-trip alone is ~1.5s, so screens that just read the draft
 * should save through this instead of `updateDraft`. Throws on a non-2xx. */
export async function patchDraft(token: string, update: DraftUpdate): Promise<DraftApplication> {
  const res = await fetch(`${API}/api/applications/current`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-draft-token': token },
    body: JSON.stringify(update),
  });
  if (!res.ok) throw new Error(`draft save failed (${res.status})`);
  return (await res.json()) as DraftApplication;
}

/** The result of claiming the anonymous draft after OTP. `nextRoute` is the
 * server-derived route for the application's ACTUAL state, so the caller never
 * routes blindly to Payment. A conflict means the token points at a paid/later
 * record that isn't a fresh claim — the caller must not open Payment. */
export type ClaimResult =
  | { ok: true; status: string; nextRoute: string }
  | { ok: false; reason: 'no-token' | 'conflict' | 'error' };

/**
 * Attach the anonymous draft to the just-created baker account (server sets
 * `bakerId` from the session) and report where the journey resumes. Requires an
 * authenticated session cookie.
 */
export async function claimDraft(): Promise<ClaimResult> {
  const token = getDraftToken();
  if (!token) return { ok: false, reason: 'no-token' };
  try {
    const res = await fetch(`${API}/api/applications/current/claim`, {
      method: 'POST',
      headers: { 'x-draft-token': token },
      credentials: 'include',
    });
    if (res.ok) {
      const data = (await res.json()) as { status: string; nextRoute?: string };
      return { ok: true, status: data.status, nextRoute: data.nextRoute ?? nextRouteForStatus(data.status) };
    }
    if (res.status === 409) return { ok: false, reason: 'conflict' };
    return { ok: false, reason: 'error' };
  } catch {
    return { ok: false, reason: 'error' };
  }
}
