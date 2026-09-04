import { randomUUID } from 'node:crypto';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { prisma } from '@sahi/db';
import { requireAuth } from '../middleware/auth.js';
import { getStorage, verifySignedUrl, stubGet, stubPut } from '../lib/storage.js';

export const storageRouter: Router = Router();

const DOC_TYPES = ['photo', 'aadhaar', 'address'] as const;
const uploadSchema = z.object({
  docType: z.enum(DOC_TYPES),
  contentType: z.string().trim().min(1).max(100),
  ext: z
    .string()
    .trim()
    .regex(/^[a-z0-9]{1,5}$/i)
    .optional(),
});
const downloadSchema = z.object({ key: z.string().trim().min(1).max(300) });

/** The baker's application a document attaches to (their most recent one). */
async function currentApplicationId(userId: string): Promise<string | null> {
  const app = await prisma.application.findFirst({
    where: { bakerId: userId },
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
  });
  return app?.id ?? null;
}

// Issue a signed upload URL scoped to the baker's application.
storageRouter.post('/storage/uploads', requireAuth(), async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const parsed = uploadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const appId = await currentApplicationId(userId);
    if (!appId) {
      res.status(404).json({ error: 'No application' });
      return;
    }
    const { docType, contentType, ext } = parsed.data;
    const key = `applications/${appId}/${docType}/${randomUUID()}${ext ? `.${ext}` : ''}`;
    const storage = getStorage();
    res.status(201).json({ key, upload: storage.signUpload(key, contentType), mock: storage.mock });
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
      select: { id: true },
    });
    if (!owned) {
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
    if (!verifySignedUrl('PUT', key, exp, sig)) {
      res.status(403).json({ error: 'Invalid or expired signature' });
      return;
    }
    const data = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);
    const contentType = req.header('content-type') ?? 'application/octet-stream';
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
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(obj.data);
  } catch (err) {
    next(err);
  }
});
