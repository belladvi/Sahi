import { prisma } from '@sahi/db';
import { MAX_NOTIFICATION_ATTEMPTS } from '@sahi/shared';
import { getNotifier, whatsappNotificationsEnabled, redact } from './notifications.js';
import { getStorage, stubGet } from './storage.js';

/** A claimed ("processing") row older than this is considered stranded (its
 * worker crashed) and may be reclaimed. Kept short for the demo. */
export const NOTIFICATION_LEASE_MS = 30_000;

// Prisma's transaction client (subset we use) — passed in so the queued row is
// written INSIDE the approval transaction (atomic; no crash window).
type TxClient = {
  notification: {
    upsert(args: unknown): Promise<unknown>;
  };
};

/** One licence-ready notification per application — dedupes repeat events + retries. */
export function notificationKey(applicationId: string): string {
  return `licence-ready:${applicationId}`;
}

/**
 * OUTBOX WRITE — call inside the approval transaction so the approved state and
 * the durable `queued` notification row commit atomically. Never sends here.
 */
export async function enqueueLicenceReadyTx(
  tx: TxClient,
  applicationId: string,
  fssaiNumber: string,
): Promise<void> {
  if (!whatsappNotificationsEnabled) return;
  await tx.notification.upsert({
    where: { idempotencyKey: notificationKey(applicationId) },
    create: {
      applicationId,
      idempotencyKey: notificationKey(applicationId),
      kind: 'licence_ready',
      channel: 'whatsapp',
      status: 'queued',
      fssaiNumber,
    },
    update: {}, // repeat approval event → no duplicate
  });
}

interface ClaimOptions {
  /** Statuses a claim may transition FROM (besides a stale `processing` lease). */
  from: string[];
  /** Enforce the automatic attempt limit (false only for an explicit Ops force). */
  enforceLimit: boolean;
}

/**
 * Attempt one delivery. The claim is a single atomic conditional UPDATE: it
 * flips exactly one eligible row to `processing`, stamps the lease, and
 * increments attempts. Only the worker whose claim affected 1 row calls the
 * provider — so concurrent workers/retries can never double-send. A crashed
 * claimer's stale lease is reclaimable here (crash recovery).
 */
async function attemptDelivery(id: string, opts: ClaimOptions): Promise<void> {
  const now = new Date();
  const staleCutoff = new Date(now.getTime() - NOTIFICATION_LEASE_MS);
  const where: Record<string, unknown> = {
    id,
    OR: [{ status: { in: opts.from } }, { status: 'processing', lockedAt: { lt: staleCutoff } }],
  };
  if (opts.enforceLimit) where.attempts = { lt: MAX_NOTIFICATION_ATTEMPTS };

  const claim = await prisma.notification.updateMany({
    where,
    data: { status: 'processing', lockedAt: now, attempts: { increment: 1 } },
  });
  if (claim.count !== 1) return; // someone else owns it, or it's not claimable — never send

  const n = await prisma.notification.findUnique({ where: { id } });
  if (!n) return;

  const app = await prisma.application.findUnique({
    where: { id: n.applicationId },
    select: { id: true, fssaiNumber: true, certificateKey: true, formA: true },
  });
  const certAvailable = !!app?.certificateKey && !!(await stubGet(app.certificateKey));
  if (!app || !app.fssaiNumber || !certAvailable) {
    await prisma.notification.update({
      where: { id },
      data: { status: 'failed', failureReason: 'certificate_unavailable', lockedAt: null, lastAttemptAt: now },
    });
    console.error(`[notify] app=${n.applicationId} notif=${id} status=failed reason=certificate_unavailable attempt=${n.attempts}`);
    return;
  }

  try {
    const phone = (app.formA as { phone?: string } | null)?.phone ?? null;
    const certificateUrl = getStorage().signDownload(app.certificateKey!).url;
    const { providerRef } = await getNotifier().send({
      idempotencyKey: n.idempotencyKey,
      applicationId: app.id,
      fssaiNumber: app.fssaiNumber,
      phone,
      certificateUrl,
    });
    await prisma.notification.update({
      where: { id },
      data: { status: 'sent', providerRef, failureReason: null, lockedAt: null, lastAttemptAt: now, sentAt: now },
    });
    console.log(`[notify] app=${app.id} notif=${id} status=sent attempt=${n.attempts} ref=${providerRef}`);
  } catch (err) {
    // attempts was incremented at claim time; the row is exhausted at the cap.
    const exhausted = n.attempts >= MAX_NOTIFICATION_ATTEMPTS;
    await prisma.notification.update({
      where: { id },
      data: { status: exhausted ? 'failed' : 'queued', failureReason: exhausted ? 'provider_error' : null, lockedAt: null, lastAttemptAt: now },
    });
    console.error(`[notify] app=${app.id} notif=${id} status=${exhausted ? 'failed' : 'queued'} attempt=${n.attempts}: ${redact(err)}`);
  }
}

/**
 * Post-approval delivery. Call WITHOUT awaiting from the request path so the
 * approval response never waits for storage/provider work. Self-contained and
 * failure-isolated. No-op when the feature is off.
 */
export async function deliverLicenceReady(applicationId: string): Promise<void> {
  if (!whatsappNotificationsEnabled) return;
  const id = await idFor(applicationId);
  if (!id) return;
  try {
    await attemptDelivery(id, { from: ['queued'], enforceLimit: true });
  } catch (err) {
    console.error(`[notify] delivery failed (non-fatal) app=${applicationId}: ${redact(err)}`);
  }
}

/**
 * Ops retry. Normal retry re-attempts a failed/queued row within the limit;
 * `force` allows one explicit attempt past the exhausted limit and records it.
 */
export async function retryLicenceReady(applicationId: string, force = false): Promise<void> {
  if (!whatsappNotificationsEnabled) return;
  const id = await idFor(applicationId);
  if (!id) return;
  await attemptDelivery(id, { from: ['queued', 'failed'], enforceLimit: !force });
}

/**
 * Reconciler — the operational recovery path. Re-attempts every stranded row:
 * `queued` (e.g. approved but the fire-and-forget never ran) and `processing`
 * rows whose lease has expired (a crashed worker), within the attempt limit.
 * Small + production-shaped: run on a schedule or trigger from Ops. Returns the
 * number of rows it attempted.
 */
export async function reconcilePendingNotifications(): Promise<number> {
  if (!whatsappNotificationsEnabled) return 0;
  const staleCutoff = new Date(Date.now() - NOTIFICATION_LEASE_MS);
  const stranded = await prisma.notification.findMany({
    where: {
      attempts: { lt: MAX_NOTIFICATION_ATTEMPTS },
      OR: [{ status: 'queued' }, { status: 'processing', lockedAt: { lt: staleCutoff } }],
    },
    select: { id: true },
  });
  for (const row of stranded) {
    await attemptDelivery(row.id, { from: ['queued'], enforceLimit: true });
  }
  return stranded.length;
}

async function idFor(applicationId: string): Promise<string | null> {
  const n = await prisma.notification.findUnique({
    where: { idempotencyKey: notificationKey(applicationId) },
    select: { id: true },
  });
  return n?.id ?? null;
}
