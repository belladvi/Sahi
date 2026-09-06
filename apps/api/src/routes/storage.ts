import { randomUUID } from 'node:crypto';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { prisma } from '@sahi/db';
import { requireAuth } from '../middleware/auth.js';
import {
  DOCUMENT_MAX_BYTES,
  getStorage,
  hasExpectedMagic,
  objectPolicy,
  verifySignedUrl,
  stubGet,
  stubPut,
} from '../lib/storage.js';

export const storageRouter: Router = Router();

// Raw Aadhaar images never leave the browser; only the masked last four digits
// are accepted by the application documents endpoint.
const DOC_TYPES = ['photo', 'address'] as const;
const uploadSchema = z.object({
  docType: z.enum(DOC_TYPES),
  contentType: z.literal('image/jpeg'),
  ext: z.literal('jpg'),
});
const downloadSchema = z.object({ key: z.string().trim().min(1).max(300) });

/** Resolve only the application named by this browser and owned by this baker. */
async function selectedApplication(userId: string, draftToken: string): Promise<{ id: string; status: string } | null> {
  const app = await prisma.application.findFirst({
    where: { draftToken, bakerId: userId },
    select: { id: true, status: true },
  });
  return app ?? null;
}

// Issue a signed upload URL scoped to the baker's application.
storageRouter.post('/storage/uploads', requireAuth(), async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const draftToken = req.header('x-draft-token');
    if (!draftToken) {
      res.status(400).json({ error: 'Missing draft token' });
      return;
    }
    const parsed = uploadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const application = await selectedApplication(userId, draftToken);
    if (!application) {
      res.status(404).json({ error: 'No application' });
      return;
    }
    if (application.status !== 'paid') {
      res.status(409).json({ error: 'This application can no longer accept uploads', code: 'NOT_EDITABLE' });
      return;
    }
    const appId = application.id;
    const { docType, contentType, ext } = parsed.data;
    const key = `applications/${appId}/${docType}/${randomUUID()}${ext ? `.${ext}` : ''}`;
    const storage = getStorage();
    res.status(201).json({ key, upload: storage.signUpload(key, contentType, DOCUMENT_MAX_BYTES), mock: storage.mock });
  } catch (err) {
    next(err);
  }
});

// Issue a signed download URL — only for a key the baker owns.
storageRouter.post('/storage/downloads', requireAuth(), async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const parsed = downloadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const match = /^applications\/([^/]+)\//.exec(parsed.data.key);
    const keyAppId = match?.[1];
    if (!keyAppId) {
      res.status(400).json({ error: 'Bad key' });
      return;
    }
    const owned = await prisma.application.findFirst({
      where: { id: keyAppId, bakerId: userId },
      select: { photoKey: true, addressProofKey: true, certificateKey: true },
    });
    if (!owned || ![owned.photoKey, owned.addressProofKey, owned.certificateKey].includes(parsed.data.key)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    res.json(getStorage().signDownload(parsed.data.key));
  } catch (err) {
    next(err);
  }
});

// Signed object write (stub backend). The signature IS the access control.
storageRouter.put('/storage/object', async (req: Request, res, next) => {
  try {
    const key = String(req.query.key ?? '');
    const exp = Number(req.query.exp);
    const sig = String(req.query.sig ?? '');
    const contentType = String(req.query.ct ?? '');
    const maxBytes = Number(req.query.max);
    const policy = objectPolicy(key);
    if (
      !policy ||
      contentType !== policy.contentType ||
      maxBytes !== policy.maxBytes ||
      !verifySignedUrl('PUT', key, exp, sig, { contentType, maxBytes })
    ) {
      res.status(403).json({ error: 'Invalid or expired signature' });
      return;
    }
    const data = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);
    const requestType = (req.header('content-type') ?? '').split(';', 1)[0]?.trim().toLowerCase();
    if (requestType !== contentType) {
      res.status(400).json({ error: 'Content type does not match the signed upload' });
      return;
    }
    if (data.length > maxBytes) {
      res.status(413).json({ error: 'File is too large' });
      return;
    }
    if (!hasExpectedMagic(contentType, data)) {
      res.status(400).json({ error: 'File content does not match its type' });
      return;
    }
    await stubPut(key, contentType, data);
    res.status(200).json({ ok: true, size: data.length });
  } catch (err) {
    next(err);
  }
});

// Signed object read (stub backend).
storageRouter.get('/storage/object', async (req, res, next) => {
  try {
    const key = String(req.query.key ?? '');
    const exp = Number(req.query.exp);
    const sig = String(req.query.sig ?? '');
    if (!verifySignedUrl('GET', key, exp, sig)) {
      res.status(403).json({ error: 'Invalid or expired signature' });
      return;
    }
    const obj = await stubGet(key);
    if (!obj) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.setHeader('Content-Type', obj.contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `attachment; filename="${key.split('/').pop() ?? 'download'}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(obj.data);
  } catch (err) {
    next(err);
  }
});
