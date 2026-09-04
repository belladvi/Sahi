import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock the auth module so we control the resolved session (no DB, hermetic).
const getSession = vi.fn();
vi.mock('../auth.js', () => ({ auth: { api: { getSession } } }));

const { protectedRouter } = await import('./protected.js');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', protectedRouter);
  return app;
}

describe('RBAC', () => {
  beforeEach(() => getSession.mockReset());

  it('401 on a protected route when signed out', async () => {
    getSession.mockResolvedValue(null);
    const res = await request(makeApp()).get('/api/ops/summary');
    expect(res.status).toBe(401);
  });

  it('403 for a baker on an ops route', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1', role: 'baker' } });
    const res = await request(makeApp()).get('/api/ops/summary');
    expect(res.status).toBe(403);
  });

  it('200 for ops on an ops route', async () => {
    getSession.mockResolvedValue({ user: { id: 'u2', role: 'ops' } });
    const res = await request(makeApp()).get('/api/ops/summary');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ area: 'ops' });
  });

  it('/me returns the signed-in user', async () => {
    getSession.mockResolvedValue({ user: { id: 'u3', role: 'baker', email: null, phoneNumber: '+919900112233' } });
    const res = await request(makeApp()).get('/api/me');
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: 'u3', role: 'baker' });
  });
});
