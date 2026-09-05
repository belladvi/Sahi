import type { NotificationView } from '@sahi/shared';

const API = import.meta.env.VITE_API_BASE_URL ?? '';

/** Distinguishes "no notification" (404) from a temporary load error (network
 * throw / 5xx) so Screen 19 can render the right state instead of hanging. */
export type NotificationResult =
  | { kind: 'ok'; view: NotificationView }
  | { kind: 'missing' }
  | { kind: 'error' };

async function fetchView(url: string, init?: RequestInit): Promise<NotificationResult> {
  try {
    const res = await fetch(url, { credentials: 'include', ...init });
    if (res.ok) return { kind: 'ok', view: (await res.json()) as NotificationView };
    if (res.status === 404) return { kind: 'missing' };
    return { kind: 'error' };
  } catch {
    return { kind: 'error' };
  }
}

/** Screen 19 data for the signed-in baker's own licence-ready notification. */
export function getMyNotification(): Promise<NotificationResult> {
  return fetchView(`${API}/api/applications/current/notification`);
}

/** Screen 19 data for a specific application (Ops only). */
export function getOpsNotification(id: string): Promise<NotificationResult> {
  return fetchView(`${API}/api/ops/applications/${id}/notification`);
}

/** Operational retry for a notification (Ops only). `force` past the limit. */
export function retryOpsNotification(id: string, force = false): Promise<NotificationResult> {
  return fetchView(`${API}/api/ops/applications/${id}/notification/retry${force ? '?force=true' : ''}`, { method: 'POST' });
}
