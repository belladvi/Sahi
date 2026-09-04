import { createHmac, timingSafeEqual } from 'node:crypto';
import { prisma } from '@sahi/db';

const STORAGE_SECRET = process.env.STORAGE_SECRET ?? 'mock_storage_secret';
const UPLOAD_TTL_SEC = 300;
const DOWNLOAD_TTL_SEC = 300;

/** Raw ID documents (Aadhaar) are deleted after approval unless this is set. */
export const RETAIN_RAW_IDS = process.env.RETAIN_RAW_IDS === 'true';

export interface SignedUpload {
  url: string;
  method: 'PUT';
  headers: Record<string, string>;
}
export interface SignedDownload {
  url: string;
}

function sign(method: string, key: string, exp: number): string {
  return createHmac('sha256', STORAGE_SECRET).update(`${method}\n${key}\n${exp}`).digest('hex');
}

/** Verify a signed storage URL (method + key + not-expired + HMAC match). */
export function verifySignedUrl(method: string, key: string, exp: number, sig: string): boolean {
  if (!Number.isFinite(exp) || Date.now() / 1000 > exp) return false;
  const expected = sign(method, key, exp);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(sig ?? '', 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function signedUrl(method: string, key: string, ttl: number): string {
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const sig = sign(method, key, exp);
  return `/api/storage/object?key=${encodeURIComponent(key)}&exp=${exp}&sig=${sig}`;
}

export interface StorageGateway {
  readonly mock: boolean;
  signUpload(key: string, contentType: string): SignedUpload;
  signDownload(key: string): SignedDownload;
  deleteByPrefix(prefix: string): Promise<number>;
}

/** DB-backed stub: signed URLs point at our own /api/storage/object endpoints
 * (same-origin, so relative). Buckets are "private" — every access needs a
 * short-lived HMAC signature. Swap for S3/R2 presigning when keys exist. */
class StubStorage implements StorageGateway {
  readonly mock = true;
  signUpload(key: string, contentType: string): SignedUpload {
    return { url: signedUrl('PUT', key, UPLOAD_TTL_SEC), method: 'PUT', headers: { 'content-type': contentType } };
  }
  signDownload(key: string): SignedDownload {
    return { url: signedUrl('GET', key, DOWNLOAD_TTL_SEC) };
  }
  async deleteByPrefix(prefix: string): Promise<number> {
    const { count } = await prisma.storedObject.deleteMany({ where: { key: { startsWith: prefix } } });
    return count;
  }
}

let cached: StorageGateway | null = null;

/** Stub unless STORAGE_PROVIDER=s3 (real S3/R2 adapter — add when keys exist). */
export function getStorage(): StorageGateway {
  if (cached) return cached;
  if (process.env.STORAGE_PROVIDER === 's3') {
    throw new Error('S3 storage adapter not configured — set up the S3/R2 gateway and keys');
  }
  cached = new StubStorage();
  return cached;
}

export function resetStorage(): void {
  cached = null;
}

// --- Stub object I/O (used only by the /api/storage/object endpoints) ---

export async function stubPut(key: string, contentType: string, data: Buffer): Promise<void> {
  // Prisma's Bytes field wants Uint8Array<ArrayBuffer>; copy off the Node Buffer.
  const bytes = new Uint8Array(data);
  await prisma.storedObject.upsert({
    where: { key },
    create: { key, contentType, data: bytes, size: bytes.length },
    update: { contentType, data: bytes, size: bytes.length },
  });
}

export async function stubGet(key: string): Promise<{ contentType: string; data: Buffer } | null> {
  const row = await prisma.storedObject.findUnique({ where: { key } });
  if (!row) return null;
  return { contentType: row.contentType, data: Buffer.from(row.data) };
}

/** Delete raw ID docs for an application after approval (retention rule). */
export async function purgeRawIdDocs(applicationId: string): Promise<number> {
  if (RETAIN_RAW_IDS) return 0;
  return getStorage().deleteByPrefix(`applications/${applicationId}/aadhaar/`);
}
