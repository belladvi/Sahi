/**
 * Shared HTTP helper for screen data loads (R1 reliability).
 *
 * `apiGet` gives every initial data read the same bounded, recoverable behaviour:
 *  - a request that hangs is aborted after `TIMEOUT_MS` and rejects (no permanent spinner);
 *  - a network failure or a 5xx rejects, so the screen can show an error + Retry;
 *  - a 4xx resolves to `null`, so the caller decides auth vs empty (unchanged semantics);
 *  - a 2xx returns parsed JSON.
 * The caller's AbortSignal (e.g. from unmount) is honoured and distinct from the
 * internal timeout, so an unmount cancels quietly while a timeout surfaces an error.
 */
const API = import.meta.env.VITE_API_BASE_URL ?? '';

export const TIMEOUT_MS = 12_000;

export class HttpError extends Error {
  constructor(public status: number) {
    super(`HTTP ${status}`);
    this.name = 'HttpError';
  }
}

export interface ApiGetOptions {
  signal?: AbortSignal;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export async function apiGet<T>(path: string, opts: ApiGetOptions = {}): Promise<T | null> {
  const { signal, headers, timeoutMs = TIMEOUT_MS } = opts;
  const timer = new AbortController();
  const timeout = setTimeout(() => timer.abort(new DOMException('Request timed out', 'TimeoutError')), timeoutMs);
  const onCallerAbort = () => timer.abort();
  if (signal) {
    if (signal.aborted) timer.abort();
    else signal.addEventListener('abort', onCallerAbort);
  }
  try {
    const res = await fetch(`${API}${path}`, { credentials: 'include', headers, signal: timer.signal });
    if (res.status >= 500) throw new HttpError(res.status);
    if (!res.ok) return null; // 4xx — caller decides (auth / empty)
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
    if (signal) signal.removeEventListener('abort', onCallerAbort);
  }
}
