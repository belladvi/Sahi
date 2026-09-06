import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createOrder } from './payments';

// R1.5 token-scope P0: order creation must tell the server WHICH application to
// pay — the one named by the browser's current draft token — so a repeat/Back
// journey can't pay a different owned draft. createOrder() must send that token
// as x-draft-token.
const KEY = 'sahi_draft_token';

describe('createOrder', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('sends the current draft token as x-draft-token', async () => {
    localStorage.setItem(KEY, 'tok-current');
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ orderId: 'order_1', amount: 59900, currency: 'INR', keyId: 'k', mock: true }),
    });
    vi.stubGlobal('fetch', fetchFn);

    await createOrder();

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const init = (fetchFn.mock.calls[0]?.[1] ?? {}) as RequestInit;
    expect(init.headers).toMatchObject({ 'x-draft-token': 'tok-current' });
  });
});
