import type { ConfirmView, FormAInput } from '@sahi/shared';

const API = import.meta.env.VITE_API_BASE_URL ?? '';

/** Pre-filled confirm view for the signed-in baker (screen 8). */
export async function getConfirmView(): Promise<ConfirmView | null> {
  const res = await fetch(`${API}/api/applications/current/confirm`, {
    credentials: 'include',
  });
  return res.ok ? ((await res.json()) as ConfirmView) : null;
}

export interface FormAResult {
  ok: boolean;
  status?: string;
  error?: string;
}

/** File Form-A with the confirmed details + hygiene declaration. */
export async function fileFormA(input: FormAInput): Promise<FormAResult> {
  const res = await fetch(`${API}/api/applications/current/form-a`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    return { ok: false, error: res.status === 401 ? 'Please sign in again.' : 'Could not file. Please check your details.' };
  }
  return (await res.json()) as FormAResult;
}
