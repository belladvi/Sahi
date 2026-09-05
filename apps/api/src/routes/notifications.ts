import { Router } from 'express';
import { prisma } from '@sahi/db';
import { MAX_NOTIFICATION_ATTEMPTS, type NotificationStatus, type NotificationView } from '@sahi/shared';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getStorage } from '../lib/storage.js';
import { whatsappNotificationsEnabled } from '../lib/notifications.js';
import { notificationKey, retryLicenceReady, reconcilePendingNotifications } from '../lib/notification-workflow.js';

export const notificationsRouter: Router = Router();

type NotifRow = {
  status: string;
  channel: string;
  attempts: number;
  providerRef: string | null;
  failureReason: string | null;
  fssaiNumber: string | null;
  sentAt: Date | null;
  lastAttemptAt: Date | null;
};
type AppRow = {
  fssaiNumber: string | null;
  businessName: string | null;
  certificateKey: string | null;
  formA: unknown;
};

/** Display-only phone mask — never returns the real number. */
function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 2) return '••••';
  return '•••• •••• ' + digits.slice(-2);
}

function toView(n: NotifRow, app: AppRow): NotificationView {
  const exhausted = n.status === 'failed' && n.attempts >= MAX_NOTIFICATION_ATTEMPTS;
  return {
    status: n.status as NotificationStatus,
    channel: n.channel,
    attempts: n.attempts,
    maxAttempts: MAX_NOTIFICATION_ATTEMPTS,
    providerRef: n.providerRef,
    failureReason: n.failureReason,
    fssaiNumber: n.fssaiNumber ?? app.fssaiNumber ?? null,
    businessName: app.businessName ?? null,
    phoneMasked: maskPhone((app.formA as { phone?: string } | null)?.phone ?? null),
    // Freshly minted, short-lived signed URL — never stored, never public.
    certificateUrl: app.certificateKey ? getStorage().signDownload(app.certificateKey).url : null,
    sentAt: n.sentAt ? n.sentAt.toISOString() : null,
    lastAttemptAt: n.lastAttemptAt ? n.lastAttemptAt.toISOString() : null,
    exhausted,
    // Only offer a normal retry when it can actually proceed automatically.
    canRetry: n.status === 'failed' && n.attempts < MAX_NOTIFICATION_ATTEMPTS,
    // Ops-only explicit action past the limit.
    canForceRetry: exhausted,
    demo: true,
  };
}

// Baker — Screen 19 for their OWN licence-ready notification.
notificationsRouter.get('/applications/current/notification', requireAuth(), async (req, res, next) => {
  try {
    if (!whatsappNotificationsEnabled) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const app = await prisma.application.findFirst({
      where: { bakerId: req.user!.id },
      orderBy: { updatedAt: 'desc' },
    });
    if (!app) {
      res.status(404).json({ error: 'No application' });
      return;
    }
    const n = await prisma.notification.findUnique({ where: { idempotencyKey: notificationKey(app.id) } });
    if (!n) {
      res.status(404).json({ error: 'No notification' });
      return;
    }
    res.json(toView(n, app));
  } catch (err) {
    next(err);
  }
});

// Ops — Screen 19 for a specific application (role-gated).
notificationsRouter.get('/ops/applications/:id/notification', requireRole('ops', 'admin'), async (req, res, next) => {
  try {
    if (!whatsappNotificationsEnabled) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const id = String(req.params.id);
    const app = await prisma.application.findUnique({ where: { id } });
    if (!app) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const n = await prisma.notification.findUnique({ where: { idempotencyKey: notificationKey(id) } });
    if (!n) {
      res.status(404).json({ error: 'No notification' });
      return;
    }
    res.json(toView(n, app));
  } catch (err) {
    next(err);
  }
});

// Ops — retry a notification (role-gated, idempotent, concurrency-safe claim).
// A normal retry works within the attempt limit; past the limit it requires an
// explicit ?force=true operational action (which records a new attempt).
notificationsRouter.post('/ops/applications/:id/notification/retry', requireRole('ops', 'admin'), async (req, res, next) => {
  try {
    if (!whatsappNotificationsEnabled) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const id = String(req.params.id);
    const existing = await prisma.notification.findUnique({ where: { idempotencyKey: notificationKey(id) } });
    if (!existing) {
      res.status(404).json({ error: 'No notification' });
      return;
    }
    const force = req.query.force === 'true' || (req.body && req.body.force === true);
    const exhausted = existing.status === 'failed' && existing.attempts >= MAX_NOTIFICATION_ATTEMPTS;
    if (exhausted && !force) {
      res.status(409).json({ error: 'Attempts exhausted — an explicit force retry is required', exhausted: true });
      return;
    }
    await retryLicenceReady(id, !!force);
    const app = await prisma.application.findUnique({ where: { id } });
    const updated = await prisma.notification.findUnique({ where: { idempotencyKey: notificationKey(id) } });
    if (!app || !updated) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(toView(updated, app));
  } catch (err) {
    next(err);
  }
});

// Ops — reconcile stranded notifications (queued, or crashed mid-processing).
// The operational recovery path; also safe to run on a schedule.
notificationsRouter.post('/ops/notifications/reconcile', requireRole('ops', 'admin'), async (_req, res, next) => {
  try {
    if (!whatsappNotificationsEnabled) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const reconciled = await reconcilePendingNotifications();
    res.json({ ok: true, reconciled });
  } catch (err) {
    next(err);
  }
});
