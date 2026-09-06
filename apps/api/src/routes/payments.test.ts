import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// The case-study environment runs the deterministic demo gateway (fail-closed
// mode). Set it before the payments lib resolves the gateway.
process.env.PAYMENT_MODE = 'demo';

import { hmacSha256Hex, verifySignature, AMOUNT_PAISE } from '../lib/payments.js';

// Hermetic: mock the session + DB. The mock payment gateway is deterministic
// (no external calls) and uses the real HMAC scheme, so signatures are genuine.
const getSession = vi.fn();
vi.mock('../auth.js', () => ({ auth: { api: { getSession } } }));

const appFindFirst = vi.fn();
const appUpdateMany = vi.fn();
const payCreate = vi.fn();
const payFindFirst = vi.fn();
const payFindUnique = vi.fn();
const payUpdate = vi.fn();
vi.mock('@sahi/db', () => ({
  prisma: {
    application: { findFirst: (...a: unknown[]) => appFindFirst(...a), updateMany: (...a: unknown[]) => appUpdateMany(...a) },
    payment: {
      create: (...a: unknown[]) => payCreate(...a),
      findFirst: (...a: unknown[]) => payFindFirst(...a),
      findUnique: (...a: unknown[]) => payFindUnique(...a),
      update: (...a: unknown[]) => payUpdate(...a),
    },
    $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
  },
}));

const { createApp } = await import('../app.js');
const SECRET = 'mock_webhook_secret';

function signedEvent(orderId: string): { body: string; sig: string } {
  const body = JSON.stringify({
    event: 'payment.captured',
    payload: { payment: { entity: { id: 'pay_test_1', order_id: orderId, status: 'captured' } } },
  });
  return { body, sig: hmacSha256Hex(body, SECRET) };
}

describe('payment signature (lib)', () => {
  it('verifies a matching HMAC and rejects a tampered one', () => {
    const s = hmacSha256Hex('hello', SECRET);
    expect(verifySignature('hello', s, SECRET)).toBe(true);
    expect(verifySignature('hello!', s, SECRET)).toBe(false);
    expect(verifySignature('hello', 'deadbeef', SECRET)).toBe(false);
  });
});

describe('POST /api/payments/order', () => {
  beforeEach(() => {
    getSession.mockReset();
    appFindFirst.mockReset();
    payFindFirst.mockReset();
    payCreate.mockReset();
  });

  it('401 when signed out', async () => {
    getSession.mockResolvedValue(null);
    const res = await request(createApp()).post('/api/payments/order');
    expect(res.status).toBe(401);
  });

  it('404 when the baker has no application under this token', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1', role: 'baker' } });
    appFindFirst.mockResolvedValue(null);
    const res = await request(createApp()).post('/api/payments/order').set('x-draft-token', 'tok1');
    expect(res.status).toBe(404);
  });

  it('creates an order + payment row for the draft (mock gateway)', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1', role: 'baker' } });
    appFindFirst.mockResolvedValue({ id: 'app1', status: 'draft' });
    payFindFirst.mockResolvedValue(null); // no unpaid order yet
    payCreate.mockResolvedValue({});
    const res = await request(createApp()).post('/api/payments/order').set('x-draft-token', 'tok1');
    expect(res.status).toBe(201);
    expect(res.body.amount).toBe(AMOUNT_PAISE);
    expect(res.body.mock).toBe(true);
    expect(res.body.orderId).toMatch(/^order_mock_/);
    expect(payCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ applicationId: 'app1', status: 'created' }) }),
    );
  });

  it('reuses the existing unpaid order instead of creating a duplicate (double-click/refresh/Back safe)', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1', role: 'baker' } });
    appFindFirst.mockResolvedValue({ id: 'app1', status: 'draft' });
    payFindFirst.mockResolvedValue({ orderId: 'order_existing_1', status: 'created' });
    const res = await request(createApp()).post('/api/payments/order').set('x-draft-token', 'tok1');
    expect(res.status).toBe(200);
    expect(res.body.orderId).toBe('order_existing_1');
    expect(payCreate).not.toHaveBeenCalled(); // no duplicate order row
  });

  it('an already-paid application resumes at Upload instead of erroring (no duplicate paid transition)', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1', role: 'baker' } });
    // No payable draft, but the baker has a paid application.
    appFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'app1', status: 'paid' });
    const res = await request(createApp()).post('/api/payments/order').set('x-draft-token', 'tok1');
    expect(res.status).toBe(200);
    expect(res.body.alreadyPaid).toBe(true);
    expect(res.body.nextRoute).toBe('/upload');
    expect(payCreate).not.toHaveBeenCalled();
  });

  // R1.5 token-scope P0: order creation must pay the application named by the
  // browser's current draft token, never the newest owned draft. Once that token
  // app is paid, Back/retry resumes it — it must NOT fall through to a different
  // owned draft and open a second order/payment.
  it('resumes the token-selected paid app and never pays a different owned draft (token-scope P0)', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1', role: 'baker' } });
    appFindFirst.mockImplementation((args?: { where?: Record<string, unknown> }) => {
      const where = args?.where ?? {};
      if (where.draftToken === 'tok-paid') {
        // Correct, token-scoped lookups.
        if (where.status === 'draft') return Promise.resolve(null); // the token app is paid, not a draft
        return Promise.resolve({ id: 'appPaid', status: 'paid', bakerId: 'u1', draftToken: 'tok-paid' });
      }
      // Buggy, owner-only lookups would find a DIFFERENT older owned draft.
      if (where.status === 'draft') return Promise.resolve({ id: 'appOtherDraft', status: 'draft', bakerId: 'u1', draftToken: 'tok-other-draft' });
      return Promise.resolve({ id: 'appPaid', status: 'paid', bakerId: 'u1', draftToken: 'tok-paid' });
    });
    const res = await request(createApp()).post('/api/payments/order').set('x-draft-token', 'tok-paid');
    expect(res.status).toBe(200);
    expect(res.body.alreadyPaid).toBe(true);
    expect(res.body.nextRoute).toBe('/upload');
    expect(payCreate).not.toHaveBeenCalled(); // never charges the other owned draft
  });

  it('never authorizes an application the token does not own, even when the caller has another draft', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1', role: 'baker' } });
    appFindFirst.mockImplementation((args?: { where?: Record<string, unknown> }) => {
      const where = args?.where ?? {};
      // Token-scoped by {draftToken, bakerId}: the token belongs to another baker,
      // so no application the caller owns matches — nothing is payable.
      if (where.draftToken === 'tok-other-baker') return Promise.resolve(null);
      // Owner-only lookup (buggy) would find the caller's unrelated own draft.
      if (where.status === 'draft') return Promise.resolve({ id: 'appMine', status: 'draft', bakerId: 'u1', draftToken: 'tok-mine' });
      return Promise.resolve(null);
    });
    const res = await request(createApp()).post('/api/payments/order').set('x-draft-token', 'tok-other-baker');
    expect(res.status).toBe(404);
    expect(payCreate).not.toHaveBeenCalled();
  });
});

describe('POST /api/payments/webhook', () => {
  beforeEach(() => {
    payFindUnique.mockReset();
    payUpdate.mockReset();
    appUpdateMany.mockReset();
    payUpdate.mockResolvedValue({});
    appUpdateMany.mockResolvedValue({ count: 1 });
  });

  it('400 on an invalid signature', async () => {
    const { body } = signedEvent('order_x');
    const res = await request(createApp())
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', 'not-valid')
      .send(body);
    expect(res.status).toBe(400);
    expect(payFindUnique).not.toHaveBeenCalled();
  });

  it('valid signature flips payment + application to paid', async () => {
    payFindUnique.mockResolvedValue({ orderId: 'order_1', applicationId: 'app1', status: 'created' });
    const { body, sig } = signedEvent('order_1');
    const res = await request(createApp())
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', sig)
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ processed: true });
    expect(payUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orderId: 'order_1' }, data: expect.objectContaining({ status: 'paid' }) }),
    );
    expect(appUpdateMany).toHaveBeenCalledWith({ where: { id: 'app1', status: 'draft' }, data: { status: 'paid' } });
  });

  it('is idempotent — a second delivery does not re-flip', async () => {
    payFindUnique.mockResolvedValue({ orderId: 'order_1', applicationId: 'app1', status: 'paid' });
    const { body, sig } = signedEvent('order_1');
    const res = await request(createApp())
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', sig)
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ idempotent: true });
    expect(payUpdate).not.toHaveBeenCalled();
  });
});

describe('POST /api/payments/mock/pay', () => {
  beforeEach(() => {
    getSession.mockReset();
    payFindUnique.mockReset();
    payUpdate.mockReset().mockResolvedValue({});
    appUpdateMany.mockReset().mockResolvedValue({ count: 1 });
  });

  it('drives the webhook processor to paid (real signature path)', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1', role: 'baker' } });
    payFindUnique.mockResolvedValue({ orderId: 'order_2', applicationId: 'app2', status: 'created' });
    const res = await request(createApp()).post('/api/payments/mock/pay').send({ orderId: 'order_2' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ processed: true });
    expect(appUpdateMany).toHaveBeenCalled();
  });
});
