import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ensureDraft, claimDraft } from './draft';

// ensureDraft/claimDraft carry the anonymous draft through the front door and
// into the account. R1.5: a stale token that points at a paid/later application
// must start a FRESH draft (a deliberate new journey), never re-edit the old one.
const KEY = 'sahi_draft_token';

function mockFetchSequence(responses: Array<{ ok: boolean; status?: number; body?: unknown }>) {
  const fn = vi.fn();
  for (const r of responses) {
    fn.mockResolvedValueOnce({
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 400),
      json: async () => r.body ?? {},
    });
  }
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('ensureDraft', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('reuses a stored token that still points at an editable draft', async () => {
    localStorage.setItem(KEY, 'tok-draft');
    const fetchFn = mockFetchSequence([{ ok: true, body: { id: 'a1', status: 'draft' } }]);
    const token = await ensureDraft();
    expect(token).toBe('tok-draft');
    // Only the GET happened — no new draft was created.
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('mints a FRESH draft when the stored token points at a paid application (new journey, old record preserved)', async () => {
    localStorage.setItem(KEY, 'tok-paid');
    const fetchFn = mockFetchSequence([
      { ok: true, body: { id: 'a1', status: 'paid' } }, // GET current → not a draft
      { ok: true, status: 201, body: { draftToken: 'tok-new' } }, // POST new draft
    ]);
    const token = await ensureDraft();
    expect(token).toBe('tok-new');
    expect(localStorage.getItem(KEY)).toBe('tok-new');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});

describe('claimDraft', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('returns no-token when there is no local draft', async () => {
    mockFetchSequence([]);
    const res = await claimDraft();
    expect(res).toEqual({ ok: false, reason: 'no-token' });
  });

  it('returns the server-derived next route on success', async () => {
    localStorage.setItem(KEY, 'tok1');
    mockFetchSequence([{ ok: true, body: { id: 'a1', status: 'draft', nextRoute: '/pay' } }]);
    const res = await claimDraft();
    expect(res).toEqual({ ok: true, status: 'draft', nextRoute: '/pay' });
  });

  it('reports a conflict (not success) when the claim is rejected', async () => {
    localStorage.setItem(KEY, 'tok1');
    mockFetchSequence([{ ok: false, status: 409, body: { error: 'conflict' } }]);
    const res = await claimDraft();
    expect(res).toEqual({ ok: false, reason: 'conflict' });
  });
});
