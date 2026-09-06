import { createHmac } from 'node:crypto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

process.env.STORAGE_SECRET = 'sahi-test-storage-secret-at-least-32-bytes';

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

const { verifySignedUrl, getStorage, purgeRawIdDocs } = await import('../lib/storage.js');
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

  it('rejects a correctly signed URL whose expiry exceeds the five-minute lifetime', () => {
    const key = 'applications/a1/photo/x.jpg';
    const exp = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
    const sig = createHmac('sha256', process.env.STORAGE_SECRET!)
      .update(`GET\n${key}\n${exp}\n\n`)
      .digest('hex');

    expect(verifySignedUrl('GET', key, exp, sig)).toBe(false);
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
    appFindFirst.mockResolvedValue({ id: 'app1', status: 'paid' });
    const app = createApp();

    const issued = await request(app)
      .post('/api/storage/uploads')
      .set('x-draft-token', 't1')
      .send({ docType: 'photo', contentType: 'image/jpeg', ext: 'jpg' });
    expect(issued.status).toBe(201);
    expect(issued.body.key).toMatch(/^applications\/app1\/photo\//);

    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const put = await request(app).put(issued.body.upload.url).set('Content-Type', 'image/jpeg').send(bytes);
    expect(put.status).toBe(200);
    appFindFirst.mockResolvedValue({ id: 'app1', photoKey: issued.body.key, addressProofKey: null, certificateKey: null });

    // Direct GET without a signature is refused (bucket is private).
    const bare = await request(app).get(`/api/storage/object?key=${encodeURIComponent(issued.body.key)}`);
    expect(bare.status).toBe(403);

    // A signed download URL returns the exact bytes.
    const dl = await request(app).post('/api/storage/downloads').send({ key: issued.body.key });
    expect(dl.status).toBe(200);
    const got = await request(app).get(dl.body.url);
    expect(got.status).toBe(200);
    expect(got.headers['content-type']).toContain('image/jpeg');
    expect(Buffer.from(got.body)).toEqual(bytes);
    expect(got.headers['x-content-type-options']).toBe('nosniff');
    expect(got.headers['content-disposition']).toMatch(/^attachment;/);
  });

  it('rejects disallowed MIME types before issuing an upload URL', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1', role: 'baker' } });
    appFindFirst.mockResolvedValue({ id: 'app1', status: 'paid' });

    const res = await request(createApp())
      .post('/api/storage/uploads')
      .set('x-draft-token', 't1')
      .send({ docType: 'photo', contentType: 'image/svg+xml', ext: 'svg' });

    expect(res.status).toBe(400);
  });

  it('rejects a spoofed upload Content-Type and bytes without the signed magic type', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1', role: 'baker' } });
    appFindFirst.mockResolvedValue({ id: 'app1', status: 'paid' });
    const issued = await request(createApp())
      .post('/api/storage/uploads')
      .set('x-draft-token', 't1')
      .send({ docType: 'photo', contentType: 'image/jpeg', ext: 'jpg' });

    const spoofed = await request(createApp())
      .put(issued.body.upload.url)
      .set('Content-Type', 'application/pdf')
      .send(Buffer.from('%PDF-1.7 fake'));
    expect(spoofed.status).toBe(400);

    const badMagic = await request(createApp())
      .put(issued.body.upload.url)
      .set('Content-Type', 'image/jpeg')
      .send(Buffer.from('<script>alert(1)</script>'));
    expect(badMagic.status).toBe(400);
  });

  it('rejects an upload larger than the signed one-megabyte limit', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1', role: 'baker' } });
    appFindFirst.mockResolvedValue({ id: 'app1', status: 'paid' });
    const issued = await request(createApp())
      .post('/api/storage/uploads')
      .set('x-draft-token', 't1')
      .send({ docType: 'photo', contentType: 'image/jpeg', ext: 'jpg' });
    const bytes = Buffer.alloc(1_000_001, 0);
    bytes.set([0xff, 0xd8, 0xff], 0);

    const res = await request(createApp())
      .put(issued.body.upload.url)
      .set('Content-Type', 'image/jpeg')
      .send(bytes);
    expect(res.status).toBe(413);
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

  it('rejects any request to upload a raw Aadhaar image', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1', role: 'baker' } });
    appFindFirst.mockResolvedValue({ id: 'app1', status: 'paid' });

    const res = await request(createApp())
      .post('/api/storage/uploads')
      .set('x-draft-token', 't1')
      .send({ docType: 'aadhaar', contentType: 'image/jpeg', ext: 'jpg' });

    expect(res.status).toBe(400);
  });

  it('requires the browser draft token and scopes upload signing to that owned paid application', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1', role: 'baker' } });
    appFindFirst.mockResolvedValue({ id: 'app1', status: 'paid' });
    const app = createApp();

    expect((await request(app).post('/api/storage/uploads').send({ docType: 'photo', contentType: 'image/jpeg', ext: 'jpg' })).status).toBe(400);

    const issued = await request(app)
      .post('/api/storage/uploads')
      .set('x-draft-token', 'chosen-token')
      .send({ docType: 'photo', contentType: 'image/jpeg', ext: 'jpg' });
    expect(issued.status).toBe(201);
    expect(appFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { draftToken: 'chosen-token', bakerId: 'u1' },
    }));
  });

  it('does not issue an upload for a later-state application', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1', role: 'baker' } });
    appFindFirst.mockResolvedValue({ id: 'app1', status: 'preparing' });

    const res = await request(createApp())
      .post('/api/storage/uploads')
      .set('x-draft-token', 't1')
      .send({ docType: 'photo', contentType: 'image/jpeg', ext: 'jpg' });

    expect(res.status).toBe(409);
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
