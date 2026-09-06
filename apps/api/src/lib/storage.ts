import { createHmac, timingSafeEqual } from 'node:crypto';
import { prisma } from '@sahi/db';

const UPLOAD_TTL_SEC = 300;
const DOWNLOAD_TTL_SEC = 300;
const MIN_SECRET_LENGTH = 32;
export const DOCUMENT_MAX_BYTES = 1_000_000;
export const CERTIFICATE_MAX_BYTES = 5_000_000;

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

interface SignedClaims {
  contentType?: string;
  maxBytes?: number;
}

function payload(method: string, key: string, exp: number, claims: SignedClaims = {}): string {
  return `${method}\n${key}\n${exp}\n${claims.contentType ?? ''}\n${claims.maxBytes ?? ''}`;
}

function sign(method: string, key: string, exp: number, claims: SignedClaims = {}): string {
  return createHmac('sha256', storageSecret()).update(payload(method, key, exp, claims)).digest('hex');
}

function storageSecret(): string {
  const secret = process.env.STORAGE_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error('STORAGE_SECRET must be configured with at least 32 characters');
  }
  return secret;
}

/** Fail fast at service startup instead of discovering a missing signing key
 * on the first customer upload. Never logs or returns the secret. */
export function assertStorageConfigured(): void {
  void storageSecret();
}

/** Verify a signed storage URL (method + key + not-expired + HMAC match). */
export function verifySignedUrl(method: string, key: string, exp: number, sig: string, claims: SignedClaims = {}): boolean {
  const now = Math.floor(Date.now() / 1000);
  const maxTtl = method === 'PUT' ? UPLOAD_TTL_SEC : method === 'GET' ? DOWNLOAD_TTL_SEC : 0;
  if (!Number.isSafeInteger(exp) || exp < now || exp > now + maxTtl) return false;
  const expected = sign(method, key, exp, claims);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(sig ?? '', 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function signedUrl(method: string, key: string, ttl: number, claims: SignedClaims = {}): string {
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const sig = sign(method, key, exp, claims);
  const query = new URLSearchParams({ key, exp: String(exp), sig });
  if (claims.contentType) query.set('ct', claims.contentType);
  if (claims.maxBytes) query.set('max', String(claims.maxBytes));
  return `/api/storage/object?${query.toString()}`;
}

export interface StorageGateway {
  readonly mock: boolean;
  signUpload(key: string, contentType: string, maxBytes: number): SignedUpload;
  signDownload(key: string): SignedDownload;
  deleteByPrefix(prefix: string): Promise<number>;
}

/** DB-backed stub: signed URLs point at our own /api/storage/object endpoints
 * (same-origin, so relative). Buckets are "private" — every access needs a
 * short-lived HMAC signature. Swap for S3/R2 presigning when keys exist. */
class StubStorage implements StorageGateway {
  readonly mock = true;
  signUpload(key: string, contentType: string, maxBytes: number): SignedUpload {
    return {
      url: signedUrl('PUT', key, UPLOAD_TTL_SEC, { contentType, maxBytes }),
      method: 'PUT',
      headers: { 'content-type': contentType },
    };
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

export type StoredObjectKind = 'photo' | 'address' | 'certificate';

export function objectPolicy(key: string): { kind: StoredObjectKind; contentType: string; maxBytes: number } | null {
  const match = /^applications\/[^/]+\/(photo|address|certificate)\/([A-Za-z0-9_-]+)\.(jpg|pdf)$/.exec(key);
  if (!match) return null;
  const kind = match[1] as StoredObjectKind;
  const ext = match[3];
  if ((kind === 'photo' || kind === 'address') && ext === 'jpg') {
    return { kind, contentType: 'image/jpeg', maxBytes: DOCUMENT_MAX_BYTES };
  }
  if (kind === 'certificate' && ext === 'pdf') {
    return { kind, contentType: 'application/pdf', maxBytes: CERTIFICATE_MAX_BYTES };
  }
  return null;
}

export function hasExpectedMagic(contentType: string, data: Buffer): boolean {
  if (contentType === 'image/jpeg') return data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  if (contentType === 'application/pdf') return data.length >= 5 && data.subarray(0, 5).toString('ascii') === '%PDF-';
  return false;
}

/** A saved reference is valid only when it names an existing object of the
 * expected kind under that exact application prefix. */
export async function isValidStoredObject(applicationId: string, kind: StoredObjectKind, key: string): Promise<boolean> {
  if (!key.startsWith(`applications/${applicationId}/${kind}/`)) return false;
  const policy = objectPolicy(key);
  if (!policy || policy.kind !== kind) return false;
  const row = await prisma.storedObject.findUnique({
    where: { key },
    select: { contentType: true, size: true, data: true },
  });
  return !!row &&
    row.contentType === policy.contentType &&
    row.size > 0 &&
    row.size <= policy.maxBytes &&
    hasExpectedMagic(row.contentType, Buffer.from(row.data));
}

/** Delete raw ID docs for an application after approval (retention rule). */
export async function purgeRawIdDocs(applicationId: string): Promise<number> {
  if (RETAIN_RAW_IDS) return 0;
  return getStorage().deleteByPrefix(`applications/${applicationId}/aadhaar/`);
}
