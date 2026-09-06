import type { OpsApplicationDetail, OpsQueueItem, OpsTransition } from '@sahi/shared';
import { apiGet } from './http';

const API = import.meta.env.VITE_API_BASE_URL ?? '';

export async function getOpsQueue(status?: string, signal?: AbortSignal): Promise<OpsQueueItem[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  const body = await apiGet<{ applications: OpsQueueItem[] }>(`/api/ops/applications${qs}`, { signal });
  return body?.applications ?? [];
}

export function getOpsApplication(id: string, signal?: AbortSignal): Promise<OpsApplicationDetail | null> {
  return apiGet<OpsApplicationDetail>(`/api/ops/applications/${id}`, { signal });
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

/** Upload the approval certificate PDF via a signed URL; returns its stored key. */
export async function uploadCertificate(id: string, file: File): Promise<string> {
  const signRes = await fetch(`${API}/api/ops/applications/${id}/certificate-upload-url`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!signRes.ok) throw new Error('could not get upload url');
  const { key, upload } = (await signRes.json()) as { key: string; upload: { url: string; method: string; headers: Record<string, string> } };
  const putRes = await fetch(`${API}${upload.url}`, {
    method: upload.method,
    headers: upload.headers,
    body: file,
  });
  if (!putRes.ok) throw new Error('certificate upload failed');
  return key;
}

export async function publishApplication(id: string, fssaiNumber: string, certificateKey: string): Promise<TransitionResult> {
  const res = await fetch(`${API}/api/ops/applications/${id}/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ fssaiNumber, certificateKey }),
  });
  if (!res.ok) {
    if (res.status === 400) return { ok: false, error: 'Check the number (14 digits) and certificate.' };
    if (res.status === 409) return { ok: false, error: 'This application can’t be published from its current status.' };
    return { ok: false, error: 'Could not publish.' };
  }
  return (await res.json()) as TransitionResult;
}
