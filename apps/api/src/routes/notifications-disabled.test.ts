// Ticket 26A — DISABLED-config tests. Explicitly force the flag OFF (default) so
// this file is order-independent, and prove the feature adds NO behaviour: the
// approval flow is unchanged and Screen 19 endpoints 404.
process.env.WHATSAPP_NOTIFICATIONS_ENABLED = 'false';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const getSession = vi.fn();
vi.mock('../auth.js', () => ({ auth: { api: { getSession } } }));

const appFindUnique = vi.fn();
const appFindFirst = vi.fn();
const appUpdate = vi.fn(async () => ({ status: 'approved' }));
const eventCreate = vi.fn();
const notifUpsert = vi.fn();
const deleteMany = vi.fn(async () => ({ count: 0 }));
const certificateBytes = Buffer.from('%PDF-1.7 synthetic');
const storedObjectFindUnique = vi.fn(async () => ({
  contentType: 'application/pdf',
  data: certificateBytes,
  size: certificateBytes.length,
}));
vi.mock('@sahi/db', () => ({
  prisma: {
    application: { findUnique: appFindUnique, findFirst: appFindFirst, update: appUpdate },
    notification: { upsert: notifUpsert, findUnique: vi.fn(async () => null) },
    filingEvent: { create: eventCreate },
    storedObject: { deleteMany, findUnique: storedObjectFindUnique },
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) =>
      cb({ application: { update: appUpdate }, filingEvent: { create: eventCreate } }),
    ),
  },
}));

const { notificationsRouter } = await import('./notifications.js');
const { opsRouter } = await import('./ops.js');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', notificationsRouter);
  app.use('/api', opsRouter);
  return app;
}

beforeEach(() => {
  getSession.mockReset();
  appFindUnique.mockReset();
  appFindFirst.mockReset();
  notifUpsert.mockReset();
});

describe('26A disabled config preserves current behaviour', () => {
  it('publish still approves and creates NO notification row', async () => {
    getSession.mockResolvedValue({ user: { id: 'ops1', role: 'ops' } });
    appFindUnique.mockResolvedValue({ id: 'app1', status: 'filed', verifyToken: null });
    const res = await request(makeApp())
      .post('/api/ops/applications/app1/publish')
      .send({ fssaiNumber: '12345678901234', certificateKey: 'applications/app1/certificate/c.pdf' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');
    expect(notifUpsert).not.toHaveBeenCalled(); // feature is inert
  });

  it('the baker Screen 19 endpoint 404s when disabled', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1', role: 'baker' } });
    const res = await request(makeApp()).get('/api/applications/current/notification');
    expect(res.status).toBe(404);
  });

  it('the Ops Screen 19 endpoints 404 when disabled', async () => {
    getSession.mockResolvedValue({ user: { id: 'ops1', role: 'ops' } });
    expect((await request(makeApp()).get('/api/ops/applications/app1/notification')).status).toBe(404);
    expect((await request(makeApp()).post('/api/ops/applications/app1/notification/retry')).status).toBe(404);
  });
});
