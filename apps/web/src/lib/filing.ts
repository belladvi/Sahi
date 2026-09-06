import type { FilingStatusView } from '@sahi/shared';
import { apiGet } from './http';

/** Current filing status for the signed-in baker (screen 9). */
export function getFilingStatus(signal?: AbortSignal): Promise<FilingStatusView | null> {
  return apiGet<FilingStatusView>('/api/applications/current/filing', { signal });
}
