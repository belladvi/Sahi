import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const getSession = vi.fn();
vi.mock('../auth.js', () => ({ auth: { api: { getSession } } }));

const findMany = vi.fn();
const findUnique = vi.fn();
const update = vi.fn();
const eventCreate = vi.fn();
const $transaction = vi.fn(async (cb: (tx: unknown) => unknown) =>
  cb({ application: { update }, filingEvent: { create: eventCreate } }),
);
vi.mock('@sahi/db', () => ({
  prisma: {
    application: { findMany, findUnique },
    filingEvent: { create: eventCreate },
    $transaction,
  },
}));

const { opsRouter } = await import('./ops.js');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', opsRouter);
  return app;
}

const ops = { user: { id: 'ops1', role: 'ops' } };
const baker = { user: { id: 'u1', role: 'baker' } };

const appRow = {
  id: 'app1',
  status: 'preparing',
  businessName: 'Riya’s Kitchen',
  applicantName: 'Riya',
  products: ['cakes'],
  premises: 'own',
  filedAt: null,
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
  category: 'Bakery & Confectionery',
  subCategory: 'Bakery products',
  kindOfBusiness: 'Manufacturer',
  description: 'I bake cakes',
  residentialAddress: 'Bengaluru',
  aadhaarMasked: 'XXXX XXXX 1234',
  photoKey: 'applications/app1/photo/p',
  addressProofKey: null,
  formA: { phone: '+919876543210', email: 'riya@example.com' },
  events: [],
};

describe('Ops console', () => {
  beforeEach(() => {
    getSession.mockReset();
    findMany.mockReset();
    findUnique.mockReset();
    update.mockReset();
    eventCreate.mockReset();
    $transaction.mockClear();
  });

  it('403 for a baker (role-gated)', async () => {
    getSession.mockResolvedValue(baker);
    const res = await request(makeApp()).get('/api/ops/applications');
    expect(res.status).toBe(403);
  });

  it('401 when signed out', async () => {
    getSession.mockResolvedValue(null);
    const res = await request(makeApp()).get('/api/ops/applications');
    expect(res.status).toBe(401);
  });

  it('lists the filing pipeline for ops', async () => {
    getSession.mockResolvedValue(ops);
    findMany.mockResolvedValue([appRow]);
    const res = await request(makeApp()).get('/api/ops/applications');
    expect(res.status).toBe(200);
    expect(res.body.applications).toHaveLength(1);
    expect(res.body.applications[0].businessName).toBe('Riya’s Kitchen');
  });

  it('detail exposes the packet + masked Aadhaar, never a raw document URL for Aadhaar', async () => {
    getSession.mockResolvedValue(ops);
    findUnique.mockResolvedValue(appRow);
    const res = await request(makeApp()).get('/api/ops/applications/app1');
    expect(res.status).toBe(200);
    expect(res.body.category).toBe('Bakery & Confectionery'); // ops sees the mapped category
    expect(res.body.aadhaarMasked).toBe('XXXX XXXX 1234');
    const aadhaarDoc = res.body.documents.find((d: { label: string }) => /Aadhaar/.test(d.label));
    expect(aadhaarDoc.url).toBeNull(); // raw Aadhaar is never downloadable
    expect(res.body.phone).toBe('+919876543210');
  });

  it('transition preparing → filed sets filedAt and writes an audit event', async () => {
    getSession.mockResolvedValue(ops);
    findUnique.mockResolvedValue({ id: 'app1', status: 'preparing', filedAt: null });
    update.mockResolvedValue({ status: 'filed' });
    const res = await request(makeApp()).post('/api/ops/applications/app1/transition').send({ toStatus: 'filed' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, status: 'filed' });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'filed', filedAt: expect.any(Date) }) }),
    );
    expect(eventCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ fromStatus: 'preparing', toStatus: 'filed', actorId: 'ops1' }) }),
    );
  });

  it('rejects an illegal transition (preparing → gov_query) with 409', async () => {
    getSession.mockResolvedValue(ops);
    findUnique.mockResolvedValue({ id: 'app1', status: 'preparing', filedAt: null });
    const res = await request(makeApp()).post('/api/ops/applications/app1/transition').send({ toStatus: 'gov_query' });
    expect(res.status).toBe(409);
    expect(update).not.toHaveBeenCalled();
  });

  it('stores the query note internally on filed → gov_query', async () => {
    getSession.mockResolvedValue(ops);
    findUnique.mockResolvedValue({ id: 'app1', status: 'filed', filedAt: new Date() });
    update.mockResolvedValue({ status: 'gov_query' });
    const res = await request(makeApp())
      .post('/api/ops/applications/app1/transition')
      .send({ toStatus: 'gov_query', note: 'Address proof unclear' });
    expect(res.status).toBe(200);
    expect(eventCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ toStatus: 'gov_query', note: 'Address proof unclear' }) }),
    );
  });
});
