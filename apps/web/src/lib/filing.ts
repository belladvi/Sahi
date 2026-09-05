import type { FilingStatusView } from '@sahi/shared';

const API = import.meta.env.VITE_API_BASE_URL ?? '';

/** Current filing status for the signed-in baker (screen 9). */
export async function getFilingStatus(): Promise<FilingStatusView | null> {
  const res = await fetch(`${API}/api/applications/current/filing`, {
    credentials: 'include',
  });
  return res.ok ? ((await res.json()) as FilingStatusView) : null;
}
