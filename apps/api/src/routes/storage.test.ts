import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { verifySignedUrl, getStorage, purgeRawIdDocs } from '../lib/storage.js';

// Hermetic: in-memory object store + mocked session.
const store = new Map<string, { contentType: string; data: Buffer; size: number }>();
const appFindFirst = vi.fn();
vi.mock('@sahi/db', () => ({
  prisma: {
    application: { findFirst: (...a: unknown[]) => appFindFirst(...a) },
    storedObject: {
      upsert: async ({ where: { key }, create }: { where: { key: string }; create: { contentType: string; data: Buffer; size: number } }) => {
        store.set(key, { contentType: create.contentType, data: create.data, size: create.size });
        return {};
      },
      findUnique: async ({ where: { key } }: { where: { key: string } }) =>
        store.has(key) ? { key, ...store.get(key) } : null,
      deleteMany: async ({ where: { key } }: { where: { key: { startsWith: string } } }) => {
        let count = 0;
        for (const k of [...store.keys()]) if (k.startsWith(key.startsWith)) { store.delete(k); count++; }
        return { count };
      },
    },
  },
}));
const getSession = vi.fn();
vi.mock('../auth.js', () => ({ auth: { api: { getSession } } }));

const { createApp } = await import('../app.js');

describe('storage signing (lib)', () => {
  it('accepts a fresh signature and rejects tampered/expired ones', () => {
    const exp = Math.floor(Date.now() / 1000) + 60;
    // A URL the gateway just signed, parsed back apart:
    const { url } = getStorage().signDownload('applications/a1/photo/x');
    const q = new URLSearchParams(url.split('?')[1]);
    expect(verifySignedUrl('GET', q.get('key')!, Number(q.get('exp')), q.get('sig')!)).toBe(true);
    expect(verifySignedUrl('PUT', q.get('key')!, Number(q.get('exp')), q.get('sig')!)).toBe(false); // wrong method
    expect(verifySignedUrl('GET', 'applications/a1/photo/x', exp, 'deadbeef')).toBe(false); // bad sig
    expect(verifySignedUrl('GET', q.get('key')!, Math.floor(Date.now() / 1000) - 1, q.get('sig')!)).toBe(false); // expired
  });
});

describe('storage round-trip (private, signed-only)', () => {
  beforeEach(() => {
    store.clear();
    getSession.mockReset();
    appFindFirst.mockReset();
  });

  it('signed upload → stored → retrievable only via signed download', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1', role: 'baker' } });
    appFindFirst.mockResolvedValue({ id: 'app1' });
    const app = createApp();

    const issued = await request(app)
      .post('/api/storage/uploads')
      .send({ docType: 'aadhaar', contentType: 'image/jpeg' });
    expect(issued.status).toBe(201);
    expect(issued.body.key).toMatch(/^applications\/app1\/aadhaar\//);

    const bytes = Buffer.from('fake-jpeg-bytes');
    const put = await request(app).put(issued.body.upload.url).set('Content-Type', 'image/jpeg').send(bytes);
    expect(put.status).toBe(200);

    // Direct GET without a signature is refused (bucket is private).
    const bare = await request(app).get(`/api/storage/object?key=${encodeURIComponent(issued.body.key)}`);
    expect(bare.status).toBe(403);

    // A signed download URL returns the exact bytes.
    const dl = await request(app).post('/api/storage/downloads').send({ key: issued.body.key });
    expect(dl.status).toBe(200);
    const got = await request(app).get(dl.body.url);
    expect(got.status).toBe(200);
    expect(got.headers['content-type']).toContain('image/jpeg');
    expect(Buffer.from(got.body).toString()).toBe('fake-jpeg-bytes');
  });

  it('401 when signed out; 403 when downloading another baker’s key', async () => {
    const app = createApp();
    getSession.mockResolvedValue(null);
    expect((await request(app).post('/api/storage/uploads').send({ docType: 'photo', contentType: 'image/png' })).status).toBe(401);

    getSession.mockResolvedValue({ user: { id: 'u1', role: 'baker' } });
    appFindFirst.mockResolvedValue(null); // u1 owns no app matching that key
    const res = await request(app).post('/api/storage/downloads').send({ key: 'applications/someone-else/aadhaar/x' });
    expect(res.status).toBe(403);
  });
});

describe('retention', () => {
  beforeEach(() => store.clear());

  it('purges raw Aadhaar docs but keeps other docs', async () => {
    store.set('applications/app1/aadhaar/a.jpg', { contentType: 'image/jpeg', data: Buffer.from('x'), size: 1 });
    store.set('applications/app1/photo/p.jpg', { contentType: 'image/jpeg', data: Buffer.from('y'), size: 1 });
    const deleted = await purgeRawIdDocs('app1');
    expect(deleted).toBe(1);
    expect(store.has('applications/app1/aadhaar/a.jpg')).toBe(false);
    expect(store.has('applications/app1/photo/p.jpg')).toBe(true);
  });
});
