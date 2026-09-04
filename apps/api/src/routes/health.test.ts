import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

describe('GET /api/health', () => {
  const app = createApp();

  it('returns 200 with a valid health payload', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', service: 'sahi-api' });
    expect(typeof res.body.timestamp).toBe('string');
  });
});
