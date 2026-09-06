// Ticket 26A reliability tests. Flag ON — set BEFORE imports (read at load).
// No test contacts WhatsApp or any network: the mock provider is offline and
// failure cases use an injected double. The in-memory Prisma double implements
// updateMany as an ATOMIC conditional check-and-set so the delivery claim can be
// proven concurrency-safe deterministically.
process.env.WHATSAPP_NOTIFICATIONS_ENABLED = 'true';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const getSession = vi.fn();
vi.mock('../auth.js', () => ({ auth: { api: { getSession } } }));

// --- In-memory notification store with atomic updateMany ---
type Row = Record<string, unknown> & {
  id: string; idempotencyKey: string; status: string; attempts: number; lockedAt: Date | null;
};
const store = new Map<string, Row>();
let seq = 0;
function byKey(key: string): Row | null {
  for (const r of store.values()) if (r.idempotencyKey === key) return r;
  return null;
}
function guardOK(row: Row, where: Record<string, unknown>): boolean {
  const at = where.attempts as { lt?: number } | undefined;
  if (at?.lt !== undefined && !(row.attempts < at.lt)) return false;
  const or = where.OR as Array<Record<string, unknown>> | undefined;
  if (or) {
    const ok = or.some((c) => {
      const st = c.status as string | { in?: string[] } | undefined;
      if (st && typeof st === 'object' && st.in) return st.in.includes(row.status);
      if (st === 'processing') {
        const lk = c.lockedAt as { lt?: Date } | undefined;
        return row.status === 'processing' && !!lk?.lt && !!row.lockedAt && row.lockedAt < lk.lt;
      }
      if (typeof st === 'string') return row.status === st;
      return false;
    });
    if (!ok) return false;
  }
  return true;
}
function applyData(row: Row, data: Record<string, unknown>): void {
  const at = data.attempts as { increment?: number } | number | undefined;
  if (at && typeof at === 'object' && at.increment !== undefined) row.attempts += at.increment;
  else if (typeof at === 'number') row.attempts = at;
  for (const k of ['status', 'lockedAt', 'providerRef', 'failureReason', 'sentAt', 'lastAttemptAt'] as const) {
    if (k in data) (row as Record<string, unknown>)[k] = data[k];
  }
}
const notifUpsert = vi.fn(async ({ where, create }: { where: { idempotencyKey: string }; create: Record<string, unknown> }) => {
  const ex = byKey(where.idempotencyKey);
  if (ex) return ex;
  const row = { id: 'n' + ++seq, attempts: 0, status: 'queued', lockedAt: null, providerRef: null, failureReason: null, sentAt: null, lastAttemptAt: null, channel: 'whatsapp', ...create } as unknown as Row;
  store.set(row.id, row);
  return row;
});
const notification = {
  upsert: notifUpsert,
  findUnique: vi.fn(async ({ where }: { where: { id?: string; idempotencyKey?: string } }) =>
    where.id ? (store.get(where.id) ?? null) : byKey(where.idempotencyKey!),
  ),
  findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
    [...store.values()].filter((r) => guardOK(r, where)).map((r) => ({ id: r.id })),
  ),
  updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
    const row = store.get(where.id as string);
    if (!row || !guardOK(row, where)) return { count: 0 };
    applyData(row, data);
    return { count: 1 };
  }),
  update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
    const row = store.get(where.id)!;
    applyData(row, data);
    return row;
  }),
};

const appFindUnique = vi.fn();
const appFindFirst = vi.fn();
const appUpdate = vi.fn(async () => ({ status: 'approved' }));
const eventCreate = vi.fn();
const storedObjectFindUnique = vi.fn();
const deleteMany = vi.fn(async () => ({ count: 0 }));
vi.mock('@sahi/db', () => ({
  prisma: {
    application: { findUnique: appFindUnique, findFirst: appFindFirst, update: appUpdate },
    notification,
    filingEvent: { create: eventCreate },
    storedObject: { deleteMany, findUnique: storedObjectFindUnique },
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) =>
      cb({ application: { update: appUpdate }, filingEvent: { create: eventCreate }, notification: { upsert: notifUpsert } }),
    ),
  },
}));

const wf = await import('../lib/notification-workflow.js');
const { enqueueLicenceReadyTx, deliverLicenceReady, retryLicenceReady, reconcilePendingNotifications, notificationKey, NOTIFICATION_LEASE_MS } = wf;
const { setNotifierForTests, resetNotifier, MockWhatsAppProvider } = await import('../lib/notifications.js');
const { notificationsRouter } = await import('./notifications.js');
const { opsRouter } = await import('./ops.js');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', notificationsRouter);
  app.use('/api', opsRouter);
  return app;
}

const APPROVED = {
  id: 'app1', status: 'approved', fssaiNumber: '12345678901234',
  certificateKey: 'applications/app1/certificate/c.pdf', businessName: 'Riya’s Kitchen',
  bakerId: 'u1', formA: { phone: '+919876543210' },
};
const CERT_BYTES = Buffer.from('%PDF-1.7 synthetic');
const CERT = { contentType: 'application/pdf', data: CERT_BYTES, size: CERT_BYTES.length };
const ops = { user: { id: 'ops1', role: 'ops' } };

/** Directly seed a durable queued row (as the approval tx would). */
function seedQueued(over: Partial<Row> = {}): Row {
  const row = { id: 'n' + ++seq, idempotencyKey: notificationKey('app1'), applicationId: 'app1', status: 'queued', attempts: 0, lockedAt: null, providerRef: null, failureReason: null, sentAt: null, lastAttemptAt: null, channel: 'whatsapp', fssaiNumber: '12345678901234', ...over } as Row;
  store.set(row.id, row);
  return row;
}

beforeEach(() => {
  store.clear();
  seq = 0;
  resetNotifier();
  getSession.mockReset();
  appFindUnique.mockReset().mockResolvedValue(APPROVED);
  appFindFirst.mockReset().mockResolvedValue(APPROVED);
  appUpdate.mockClear();
  eventCreate.mockReset();
  storedObjectFindUnique.mockReset().mockResolvedValue(CERT);
  notifUpsert.mockClear();
});

describe('26A separation from approval', () => {
  it('approval writes the durable queued row IN the transaction and returns without waiting for the provider', async () => {
    getSession.mockResolvedValue(ops);
    // Provider hangs forever — proves the request does not wait for delivery.
    setNotifierForTests({ mock: true, send: () => new Promise<{ providerRef: string }>(() => {}) });
    appFindUnique.mockReset()
      .mockResolvedValueOnce({ id: 'app1', status: 'filed', verifyToken: null }) // publish precheck
      .mockResolvedValue(APPROVED); // delivery packet
    const res = await request(makeApp())
      .post('/api/ops/applications/app1/publish')
      .send({ fssaiNumber: '12345678901234', certificateKey: 'applications/app1/certificate/c.pdf' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');
    expect(notifUpsert).toHaveBeenCalledTimes(1); // created atomically inside the approval tx
    const n = byKey(notificationKey('app1'))!;
    expect(n).toBeTruthy();
    expect(n.status).not.toBe('sent'); // provider never completed, yet approval returned
  });

  it('a provider failure does not affect the approved application', async () => {
    getSession.mockResolvedValue(ops);
    setNotifierForTests({ mock: true, async send() { throw new Error('provider down'); } });
    appFindUnique.mockReset()
      .mockResolvedValueOnce({ id: 'app1', status: 'filed', verifyToken: null })
      .mockResolvedValue(APPROVED);
    const res = await request(makeApp())
      .post('/api/ops/applications/app1/publish')
      .send({ fssaiNumber: '12345678901234', certificateKey: 'applications/app1/certificate/c.pdf' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');
  });
});

describe('26A delivery + idempotency', () => {
  it('delivery sends exactly one notification', async () => {
    seedQueued();
    await deliverLicenceReady('app1');
    const n = byKey(notificationKey('app1'))!;
    expect(n.status).toBe('sent');
    expect(String(n.providerRef)).toMatch(/^mock-wa-/);
    expect(n.attempts).toBe(1);
    expect(store.size).toBe(1);
  });

  it('re-enqueue of the same approval never duplicates the row', async () => {
    await enqueueLicenceReadyTx({ notification: { upsert: notifUpsert } }, 'app1', '12345678901234');
    await enqueueLicenceReadyTx({ notification: { upsert: notifUpsert } }, 'app1', '12345678901234');
    expect(store.size).toBe(1);
  });

  it('two concurrent processors invoke the provider only once', async () => {
    seedQueued();
    const spy = vi.spyOn(MockWhatsAppProvider.prototype, 'send');
    await Promise.all([deliverLicenceReady('app1'), deliverLicenceReady('app1')]);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(byKey(notificationKey('app1'))!.status).toBe('sent');
    expect(store.size).toBe(1);
    spy.mockRestore();
  });

  it('two concurrent retry requests invoke the provider only once', async () => {
    seedQueued({ status: 'failed', attempts: 1, failureReason: 'provider_error' });
    getSession.mockResolvedValue(ops);
    const spy = vi.spyOn(MockWhatsAppProvider.prototype, 'send');
    const [a, b] = await Promise.all([
      request(makeApp()).post('/api/ops/applications/app1/notification/retry'),
      request(makeApp()).post('/api/ops/applications/app1/notification/retry'),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(spy).toHaveBeenCalledTimes(1); // atomic claim — only one retry sent
    expect(byKey(notificationKey('app1'))!.status).toBe('sent');
    spy.mockRestore();
  });

  it('repeated retries after a send never re-deliver', async () => {
    seedQueued();
    await deliverLicenceReady('app1'); // sent
    const spy = vi.spyOn(MockWhatsAppProvider.prototype, 'send');
    await retryLicenceReady('app1');
    await retryLicenceReady('app1');
    expect(spy).not.toHaveBeenCalled(); // already sent → never claimed again
    spy.mockRestore();
  });
});

describe('26A crash-window recovery', () => {
  it('a stranded queued row is recovered by the reconciler', async () => {
    seedQueued(); // approved but delivery never ran
    const n = await reconcilePendingNotifications();
    expect(n).toBe(1);
    expect(byKey(notificationKey('app1'))!.status).toBe('sent');
  });

  it('a row stuck in processing past its lease is reclaimed and delivered', async () => {
    const stale = new Date(Date.now() - NOTIFICATION_LEASE_MS - 1000);
    seedQueued({ status: 'processing', attempts: 1, lockedAt: stale }); // worker crashed mid-flight
    await reconcilePendingNotifications();
    expect(byKey(notificationKey('app1'))!.status).toBe('sent');
  });

  it('a freshly-claimed (non-stale) processing row is NOT double-processed', async () => {
    seedQueued({ status: 'processing', attempts: 1, lockedAt: new Date() });
    const spy = vi.spyOn(MockWhatsAppProvider.prototype, 'send');
    const n = await reconcilePendingNotifications();
    expect(n).toBe(0);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('26A retry limit', () => {
  it('automatic attempts stop at the configured limit; Ops force records a new attempt', async () => {
    setNotifierForTests({ mock: true, async send() { throw new Error('always fails'); } });
    seedQueued();
    await deliverLicenceReady('app1'); // attempt 1 → queued
    await retryLicenceReady('app1'); // attempt 2 → queued
    await retryLicenceReady('app1'); // attempt 3 → failed (exhausted)
    let n = byKey(notificationKey('app1'))!;
    expect(n.attempts).toBe(3);
    expect(n.status).toBe('failed');
    await retryLicenceReady('app1'); // automatic — must NOT exceed the limit
    n = byKey(notificationKey('app1'))!;
    expect(n.attempts).toBe(3); // unchanged
    await retryLicenceReady('app1', true); // explicit force → records a new attempt
    n = byKey(notificationKey('app1'))!;
    expect(n.attempts).toBe(4);
  });

  it('the retry route refuses an exhausted retry without force (409) and accepts force', async () => {
    seedQueued({ status: 'failed', attempts: 3, failureReason: 'provider_error' });
    getSession.mockResolvedValue(ops);
    const refused = await request(makeApp()).post('/api/ops/applications/app1/notification/retry');
    expect(refused.status).toBe(409);
    const forced = await request(makeApp()).post('/api/ops/applications/app1/notification/retry?force=true');
    expect(forced.status).toBe(200);
    expect(forced.body.status).toBe('sent');
  });

  it('an unavailable certificate fails the notification (approval untouched)', async () => {
    storedObjectFindUnique.mockResolvedValue(null);
    seedQueued();
    await deliverLicenceReady('app1');
    const n = byKey(notificationKey('app1'))!;
    expect(n.status).toBe('failed');
    expect(n.failureReason).toBe('certificate_unavailable');
  });
});

describe('26A logging + access control', () => {
  it('redacted logs contain no phone, FSSAI number, or certificate URL', async () => {
    const logs: string[] = [];
    const l = vi.spyOn(console, 'log').mockImplementation((...a) => logs.push(a.join(' ')));
    const e = vi.spyOn(console, 'error').mockImplementation((...a) => logs.push(a.join(' ')));
    seedQueued();
    await deliverLicenceReady('app1'); // success path
    setNotifierForTests({ mock: true, async send() { throw new Error('fail +919876543210'); } });
    store.clear(); seq = 0; seedQueued();
    await deliverLicenceReady('app1'); // failure path
    const all = logs.join('\n');
    l.mockRestore(); e.mockRestore();
    expect(all).not.toContain('9876543210');
    expect(all).not.toContain('12345678901234');
    expect(all).not.toContain('sig=');
    expect(all).not.toContain('/api/storage/object?key=');
  });

  it('signed-out → 401 on the baker endpoint', async () => {
    getSession.mockResolvedValue(null);
    expect((await request(makeApp()).get('/api/applications/current/notification')).status).toBe(401);
  });

  it('a different baker cannot see another baker’s notification', async () => {
    seedQueued(); await deliverLicenceReady('app1');
    getSession.mockResolvedValue({ user: { id: 'u2', role: 'baker' } });
    appFindFirst.mockResolvedValue(null);
    expect((await request(makeApp()).get('/api/applications/current/notification')).status).toBe(404);
  });

  it('the owning baker sees their own notification (masked phone)', async () => {
    seedQueued(); await deliverLicenceReady('app1');
    getSession.mockResolvedValue({ user: { id: 'u1', role: 'baker' } });
    const res = await request(makeApp()).get('/api/applications/current/notification');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('sent');
    expect(res.body.demo).toBe(true);
    expect(res.body.phoneMasked).not.toContain('9876543210');
  });

  it('a baker cannot hit the Ops endpoints (403)', async () => {
    seedQueued();
    getSession.mockResolvedValue({ user: { id: 'u1', role: 'baker' } });
    expect((await request(makeApp()).get('/api/ops/applications/app1/notification')).status).toBe(403);
    expect((await request(makeApp()).post('/api/ops/applications/app1/notification/retry')).status).toBe(403);
    expect((await request(makeApp()).post('/api/ops/notifications/reconcile')).status).toBe(403);
  });

  it('Ops can view, retry, and reconcile', async () => {
    seedQueued({ status: 'failed', attempts: 1 });
    getSession.mockResolvedValue(ops);
    expect((await request(makeApp()).get('/api/ops/applications/app1/notification')).status).toBe(200);
    expect((await request(makeApp()).post('/api/ops/applications/app1/notification/retry')).status).toBe(200);
    expect((await request(makeApp()).post('/api/ops/notifications/reconcile')).status).toBe(200);
  });
});
