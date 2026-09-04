import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const findFirst = vi.fn();
vi.mock('@sahi/db', () => ({ prisma: { user: { findFirst } } }));

const { accountRouter } = await import('./account.js');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', accountRouter);
  return app;
}

describe('POST /api/account/exists', () => {
  beforeEach(() => findFirst.mockReset());

  it('400 on a malformed body', async () => {
    const res = await request(makeApp()).post('/api/account/exists').send({ method: 'fax', contact: 'x' });
    expect(res.status).toBe(400);
  });

  it('returns exists:true for a known phone', async () => {
    findFirst.mockResolvedValue({ id: 'u1' });
    const res = await request(makeApp())
      .post('/api/account/exists')
      .send({ method: 'phone', contact: '+919812345678' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ exists: true });
    expect(findFirst).toHaveBeenCalledWith({ where: { phoneNumber: '+919812345678' }, select: { id: true } });
  });

  it('returns exists:false for an unknown email', async () => {
    findFirst.mockResolvedValue(null);
    const res = await request(makeApp())
      .post('/api/account/exists')
      .send({ method: 'email', contact: 'nobody@example.com' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ exists: false });
    expect(findFirst).toHaveBeenCalledWith({ where: { email: 'nobody@example.com' }, select: { id: true } });
  });
});
