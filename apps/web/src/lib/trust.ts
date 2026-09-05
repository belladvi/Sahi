import type { TrustScore } from '@sahi/shared';

const API = import.meta.env.VITE_API_BASE_URL ?? '';

export async function getTrustScore(): Promise<TrustScore | null> {
  const res = await fetch(`${API}/api/applications/current/trust-score`, { credentials: 'include' });
  return res.ok ? ((await res.json()) as TrustScore) : null;
}
