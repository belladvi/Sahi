import type { DraftApplication, DraftUpdate } from '@sahi/shared';

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

/** Ensure a server-side draft exists; returns its token. */
export async function ensureDraft(): Promise<string> {
  const existing = getDraftToken();
  if (existing) {
    const res = await fetch(`${API}/api/applications/current`, {
      headers: { 'x-draft-token': existing },
    });
    if (res.ok) return existing;
  }
  const res = await fetch(`${API}/api/applications`, { method: 'POST' });
  const data = (await res.json()) as { draftToken: string };
  setDraftToken(data.draftToken);
  return data.draftToken;
}

export async function getDraft(): Promise<DraftApplication | null> {
  const token = getDraftToken();
  if (!token) return null;
  const res = await fetch(`${API}/api/applications/current`, {
    headers: { 'x-draft-token': token },
  });
  return res.ok ? ((await res.json()) as DraftApplication) : null;
}

export async function updateDraft(update: DraftUpdate): Promise<DraftApplication> {
  const token = await ensureDraft();
  const res = await fetch(`${API}/api/applications/current`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-draft-token': token },
    body: JSON.stringify(update),
  });
  return (await res.json()) as DraftApplication;
}

/**
 * Attach the anonymous draft to the just-created baker account (server sets
 * `bakerId` from the session). Requires an authenticated session cookie.
 * No-ops if there's no local draft. Returns true on success/idempotent claim.
 */
export async function claimDraft(): Promise<boolean> {
  const token = getDraftToken();
  if (!token) return false;
  const res = await fetch(`${API}/api/applications/current/claim`, {
    method: 'POST',
    headers: { 'x-draft-token': token },
    credentials: 'include',
  });
  return res.ok;
}
