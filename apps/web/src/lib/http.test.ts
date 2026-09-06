import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiGet, HttpError } from './http';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function stubFetch(impl: (url: string, init: RequestInit) => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(impl));
}

describe('apiGet', () => {
  it('returns parsed JSON on 200', async () => {
    stubFetch(async () => new Response(JSON.stringify({ a: 1 }), { status: 200 }));
    expect(await apiGet('/x')).toEqual({ a: 1 });
  });

  it('returns null on 4xx (401 / 403 / 404 — auth / empty, caller decides)', async () => {
    for (const status of [401, 403, 404]) {
      stubFetch(async () => new Response('', { status }));
      expect(await apiGet('/x')).toBeNull();
    }
  });

  it('throws HttpError on a 5xx server error', async () => {
    stubFetch(async () => new Response('', { status: 500 }));
    await expect(apiGet('/x')).rejects.toBeInstanceOf(HttpError);
  });

  it('throws on a network rejection', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(apiGet('/x')).rejects.toBeTruthy();
  });

  it('aborts and rejects a hung request after the timeout (no permanent wait)', async () => {
    vi.useFakeTimers();
    stubFetch(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    );
    const promise = apiGet('/x', { timeoutMs: 100 });
    const assertion = expect(promise).rejects.toBeTruthy();
    await vi.advanceTimersByTimeAsync(150);
    await assertion;
  });
});
