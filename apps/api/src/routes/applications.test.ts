import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Hermetic: control the session (auth) and the DB (prisma) so the claim
// logic is tested without a live Postgres. Real round-trip verified in prod.
const getSession = vi.fn();
vi.mock('../auth.js', () => ({ auth: { api: { getSession } } }));

const findUnique = vi.fn();
const update = vi.fn();
const findFirst = vi.fn();
vi.mock('@sahi/db', () => ({ prisma: { application: { findUnique, update, findFirst } } }));

const { applicationsRouter } = await import('./applications.js');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', applicationsRouter);
  return app;
}

const row = {
  id: 'a1',
  status: 'draft',
  products: ['cakes'],
  premises: null,
  turnoverBand: null,
  businessName: null,
  description: null,
  kindOfBusiness: 'Manufacturer',
  category: 'Bakery & Confectionery',
  subCategory: 'Bakery products',
};

describe('POST /api/applications/current/claim', () => {
  beforeEach(() => {
    getSession.mockReset();
    findUnique.mockReset();
    update.mockReset();
  });

  it('401 when signed out', async () => {
    getSession.mockResolvedValue(null);
    const res = await request(makeApp())
      .post('/api/applications/current/claim')
      .set('x-draft-token', 't1');
    expect(res.status).toBe(401);
  });

  it('400 when the draft token is missing', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1', role: 'baker' } });
    const res = await request(makeApp()).post('/api/applications/current/claim');
    expect(res.status).toBe(400);
  });

  it('404 when no draft matches the token', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1', role: 'baker' } });
    findUnique.mockResolvedValue(null);
    const res = await request(makeApp())
      .post('/api/applications/current/claim')
      .set('x-draft-token', 't1');
    expect(res.status).toBe(404);
  });

  it('attaches an unclaimed draft to the signed-in baker (mapping stays hidden)', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1', role: 'baker' } });
    findUnique.mockResolvedValue({ ...row, bakerId: null });
    update.mockResolvedValue({ ...row, bakerId: 'u1' });
    const res = await request(makeApp())
      .post('/api/applications/current/claim')
      .set('x-draft-token', 't1');
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ where: { draftToken: 't1' }, data: { bakerId: 'u1' } });
    // Public projection: neither the owner id nor the hidden category leaks.
    expect(res.body).not.toHaveProperty('bakerId');
    expect(res.body).not.toHaveProperty('category');
    expect(res.body).not.toHaveProperty('kindOfBusiness');
  });

  it('is idempotent when the draft is already the user’s own', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1', role: 'baker' } });
    findUnique.mockResolvedValue({ ...row, bakerId: 'u1' });
    update.mockResolvedValue({ ...row, bakerId: 'u1' });
    const res = await request(makeApp())
      .post('/api/applications/current/claim')
      .set('x-draft-token', 't1');
    expect(res.status).toBe(200);
  });

  it('409 when the draft belongs to another account', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1', role: 'baker' } });
    findUnique.mockResolvedValue({ ...row, bakerId: 'someone-else' });
    const res = await request(makeApp())
      .post('/api/applications/current/claim')
      .set('x-draft-token', 't1');
    expect(res.status).toBe(409);
    expect(update).not.toHaveBeenCalled();
  });
});

describe('POST /api/applications/current/documents', () => {
  beforeEach(() => {
    getSession.mockReset();
    findFirst.mockReset();
    update.mockReset();
  });

  it('saves masked Aadhaar + doc keys for the baker', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1', role: 'baker' } });
    findFirst.mockResolvedValue({ id: 'app1' });
    update.mockResolvedValue({});
    const res = await request(makeApp())
      .post('/api/applications/current/documents')
      .send({ photoKey: 'applications/app1/photo/p', aadhaarMasked: 'XXXX XXXX 1234', applicantName: 'Riya' });
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'app1' }, data: expect.objectContaining({ aadhaarMasked: 'XXXX XXXX 1234' }) }),
    );
  });

  it('REJECTS a full (unmasked) Aadhaar number — 400, nothing stored', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1', role: 'baker' } });
    findFirst.mockResolvedValue({ id: 'app1' });
    const res = await request(makeApp())
      .post('/api/applications/current/documents')
      .send({ aadhaarMasked: '1234 5678 9012' });
    expect(res.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it('401 when signed out', async () => {
    getSession.mockResolvedValue(null);
    const res = await request(makeApp()).post('/api/applications/current/documents').send({ applicantName: 'x' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/applications/current/confirm', () => {
  beforeEach(() => {
    getSession.mockReset();
    findFirst.mockReset();
  });

  it('401 when signed out', async () => {
    getSession.mockResolvedValue(null);
    const res = await request(makeApp()).get('/api/applications/current/confirm');
    expect(res.status).toBe(401);
  });

  it('pre-fills phone/email from the account and hides the synthetic phone email', async () => {
    getSession.mockResolvedValue({
      user: { id: 'u1', role: 'baker', phoneNumber: '+919812345678', email: '+919812345678@phone.sahi.local' },
    });
    findFirst.mockResolvedValue({
      ...row,
      applicantName: 'Riya',
      residentialAddress: null,
      photoKey: null,
      addressProofKey: null,
      aadhaarMasked: null,
      formA: null,
    });
    const res = await request(makeApp()).get('/api/applications/current/confirm');
    expect(res.status).toBe(200);
    expect(res.body.phone).toBe('+919812345678');
    expect(res.body.email).toBeNull(); // synthetic phone email is not surfaced
    expect(res.body.hygieneAccepted).toBe(false);
    // Hidden category mapping never leaks.
    expect(res.body).not.toHaveProperty('category');
  });
});

describe('POST /api/applications/current/form-a', () => {
  beforeEach(() => {
    getSession.mockReset();
    findFirst.mockReset();
    update.mockReset();
  });

  it('400 when the hygiene declaration is not accepted', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1', role: 'baker' } });
    findFirst.mockResolvedValue({ id: 'app1' });
    const res = await request(makeApp())
      .post('/api/applications/current/form-a')
      .send({ applicantName: 'Riya', businessName: 'Riya’s Kitchen', residentialAddress: 'Bengaluru', phone: '9876543210', hygieneAccepted: false });
    expect(res.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it('files Form-A and moves status to preparing (Ops files it to the government)', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1', role: 'baker' } });
    findFirst.mockResolvedValue({ id: 'app1' });
    update.mockResolvedValue({ status: 'preparing' });
    const res = await request(makeApp())
      .post('/api/applications/current/form-a')
      .send({ applicantName: 'Riya', businessName: 'Riya’s Kitchen', residentialAddress: 'Bengaluru', phone: '9876543210', hygieneAccepted: true });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, status: 'preparing' });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'app1' }, data: expect.objectContaining({ status: 'preparing' }) }),
    );
  });
});

describe('GET /api/applications/current/filing', () => {
  beforeEach(() => {
    getSession.mockReset();
    findFirst.mockReset();
  });

  const filedRow = {
    ...row,
    businessName: 'Riya’s Kitchen',
    filedAt: new Date('2026-09-02T10:00:00.000Z'),
    approvedAt: null,
    fssaiNumber: null,
    certificateKey: null,
  };

  it('401 when signed out', async () => {
    getSession.mockResolvedValue(null);
    const res = await request(makeApp()).get('/api/applications/current/filing');
    expect(res.status).toBe(401);
  });

  it('filed: reports the timeline, no number or certificate yet', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1', role: 'baker' } });
    findFirst.mockResolvedValue({ ...filedRow, status: 'filed' });
    const res = await request(makeApp()).get('/api/applications/current/filing');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('filed');
    expect(res.body.filedAt).toBe('2026-09-02T10:00:00.000Z');
    expect(res.body.fssaiNumber).toBeNull();
    expect(res.body.certificateUrl).toBeNull();
  });

  it('gov_query is passed through (UI hides it as “under review”), no number leaks', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1', role: 'baker' } });
    findFirst.mockResolvedValue({ ...filedRow, status: 'gov_query' });
    const res = await request(makeApp()).get('/api/applications/current/filing');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('gov_query');
    expect(res.body.fssaiNumber).toBeNull();
  });

  it('approved: surfaces the number and a signed certificate URL', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1', role: 'baker' } });
    findFirst.mockResolvedValue({
      ...filedRow,
      status: 'approved',
      approvedAt: new Date('2026-09-09T10:00:00.000Z'),
      fssaiNumber: '12345678901234',
      certificateKey: 'applications/app1/certificate/cert.pdf',
    });
    const res = await request(makeApp()).get('/api/applications/current/filing');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');
    expect(res.body.fssaiNumber).toBe('12345678901234');
    expect(res.body.certificateUrl).toContain('/api/storage/object');
  });
});
