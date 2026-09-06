import type { RenewalStatus } from '@sahi/shared';
import { apiGet } from './http';

const API = import.meta.env.VITE_API_BASE_URL ?? '';

export interface RenewalView extends RenewalStatus {
  govFee: number;
  serviceFee: number;
  total: number;
}

export function getRenewal(signal?: AbortSignal): Promise<RenewalView | null> {
  return apiGet<RenewalView>('/api/applications/current/renewal', { signal });
}

export interface RenewResult {
  ok: boolean;
  renewed?: boolean;
  view?: RenewalView;
  error?: string;
}

export async function renew(): Promise<RenewResult> {
  const res = await fetch(`${API}/api/applications/current/renew`, { method: 'POST', credentials: 'include' });
  if (!res.ok) return { ok: false, error: 'Could not process the renewal.' };
  const body = (await res.json()) as RenewalView & { renewed: boolean };
  return { ok: true, renewed: body.renewed, view: body };
}
