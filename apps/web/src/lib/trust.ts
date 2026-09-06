import type { TrustScore } from '@sahi/shared';
import { apiGet } from './http';

export function getTrustScore(signal?: AbortSignal): Promise<TrustScore | null> {
  return apiGet<TrustScore>('/api/applications/current/trust-score', { signal });
}
