import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const findUnique = vi.fn();
vi.mock('@sahi/db', () => ({ prisma: { application: { findUnique } } }));

const { verifyRouter } = await import('./verify.js');

function makeApp() {
  const app = express();
  app.use(verifyRouter);
  return app;
}

const approvedApp = {
  id: 'app1',
  status: 'approved',
  businessName: 'Riya’s Kitchen',
  fssaiNumber: '12345678901234',
  products: ['Cakes', 'Brownies'],
  approvedAt: new Date('2026-09-09T00:00:00.000Z'),
  formA: { phone: '+919876543210' },
};

describe('Buyer-verify (public)', () => {
  beforeEach(() => findUnique.mockReset());

  it('JSON: unknown token → 404 { found:false }', async () => {
    findUnique.mockResolvedValue(null);
    const res = await request(makeApp()).get('/api/verify/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ found: false });
  });

  it('JSON: not-approved token → 404', async () => {
    findUnique.mockResolvedValue({ ...approvedApp, status: 'filed', fssaiNumber: null });
    const res = await request(makeApp()).get('/api/verify/tok');
    expect(res.status).toBe(404);
  });

  it('JSON: approved → 200 with business + number + Active', async () => {
    findUnique.mockResolvedValue(approvedApp);
    const res = await request(makeApp()).get('/api/verify/tok');
    expect(res.status).toBe(200);
    expect(res.body.found).toBe(true);
    expect(res.body.businessName).toBe('Riya’s Kitchen');
    expect(res.body.fssaiNumber).toBe('12345678901234');
    expect(res.body.status).toBe('Active');
    expect(res.body.waLink).toContain('wa.me/919876543210');
    // Order intent references the verified page (ticket 23).
    expect(decodeURIComponent(res.body.waLink)).toContain('/verify/tok');
  });

  it('HTML: approved → server-rendered page with OG meta + details', async () => {
    findUnique.mockResolvedValue(approvedApp);
    const res = await request(makeApp()).get('/verify/tok');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('og:title');
    expect(res.text).toContain('Riya’s Kitchen');
    expect(res.text).toContain('12345678901234');
    expect(res.text).toContain('Government-registered');
    expect(res.text).toContain('Order on WhatsApp');
  });

  it('HTML: unknown token → 404 not-found page', async () => {
    findUnique.mockResolvedValue(null);
    const res = await request(makeApp()).get('/verify/nope');
    expect(res.status).toBe(404);
    expect(res.text).toContain('couldn’t verify');
  });
});
