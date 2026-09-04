import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Hermetic: mock the DB so the route logic + shared validation are tested
// without a live Postgres (CI has none). The real round-trip is verified
// against the deployed API.
const store: Array<{ id: string; text: string; createdAt: Date }> = [];
vi.mock('@sahi/db', () => ({
  prisma: {
    $queryRaw: vi.fn(async () => [{ ok: 1 }]),
    note: {
      create: vi.fn(async ({ data }: { data: { text: string } }) => {
        const row = { id: `id-${store.length + 1}`, text: data.text, createdAt: new Date('2026-01-01T00:00:00.000Z') };
        store.push(row);
        return row;
      }),
      findMany: vi.fn(async () => [...store].reverse()),
    },
  },
}));

const { createApp } = await import('../app.js');

describe('notes API', () => {
  const app = createApp();

  beforeEach(() => {
    store.length = 0;
  });

  it('creates a note and reads it back', async () => {
    const post = await request(app).post('/api/notes').send({ text: 'hello world' });
    expect(post.status).toBe(201);
    expect(post.body).toMatchObject({ text: 'hello world' });
    expect(typeof post.body.id).toBe('string');

    const get = await request(app).get('/api/notes');
    expect(get.status).toBe(200);
    expect(get.body).toHaveLength(1);
    expect(get.body[0].text).toBe('hello world');
  });

  it('rejects an empty note with 400 (shared schema on the server)', async () => {
    const res = await request(app).post('/api/notes').send({ text: '   ' });
    expect(res.status).toBe(400);
  });
});
