import type { DocumentsInput } from '@sahi/shared';

const API = import.meta.env.VITE_API_BASE_URL ?? '';

export type DocType = 'photo' | 'aadhaar' | 'address';

/** Upload a (pre-flighted) blob via a short-lived signed URL. Returns the
 * storage key. NOTE: never call this for the raw Aadhaar image — that stays
 * on the device; only its masked number is saved via saveDocuments(). */
export async function uploadDoc(docType: DocType, blob: Blob, contentType: string, ext: string): Promise<string> {
  const signRes = await fetch(`${API}/api/storage/uploads`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ docType, contentType, ext }),
  });
  if (signRes.status === 401) throw new Error('unauthenticated');
  if (!signRes.ok) throw new Error('could not sign upload');
  const { key, upload } = (await signRes.json()) as {
    key: string;
    upload: { url: string; method: string; headers: Record<string, string> };
  };
  const put = await fetch(upload.url, { method: upload.method, headers: upload.headers, body: blob });
  if (!put.ok) throw new Error('upload failed');
  return key;
}

export async function saveDocuments(payload: DocumentsInput): Promise<boolean> {
  const res = await fetch(`${API}/api/applications/current/documents`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.ok;
}
