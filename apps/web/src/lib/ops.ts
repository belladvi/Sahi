import type { OpsApplicationDetail, OpsQueueItem, OpsTransition } from '@sahi/shared';

const API = import.meta.env.VITE_API_BASE_URL ?? '';

export async function getOpsQueue(status?: string): Promise<OpsQueueItem[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await fetch(`${API}/api/ops/applications${qs}`, { credentials: 'include' });
  if (!res.ok) return [];
  const body = (await res.json()) as { applications: OpsQueueItem[] };
  return body.applications;
}

export async function getOpsApplication(id: string): Promise<OpsApplicationDetail | null> {
  const res = await fetch(`${API}/api/ops/applications/${id}`, { credentials: 'include' });
  return res.ok ? ((await res.json()) as OpsApplicationDetail) : null;
}

export interface TransitionResult {
  ok: boolean;
  status?: string;
  error?: string;
}

export async function transitionApplication(id: string, input: OpsTransition): Promise<TransitionResult> {
  const res = await fetch(`${API}/api/ops/applications/${id}/transition`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });
  if (!res.ok) return { ok: false, error: res.status === 409 ? 'That transition isn’t allowed from the current status.' : 'Could not update.' };
  return (await res.json()) as TransitionResult;
}
