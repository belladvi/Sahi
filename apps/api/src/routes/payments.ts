import { randomUUID } from 'node:crypto';
import { Router, type Request } from 'express';
import { prisma } from '@sahi/db';
import { nextRouteForStatus } from '@sahi/shared';
import { requireAuth } from '../middleware/auth.js';
import { AMOUNT_PAISE, CURRENCY, getGateway, hmacSha256Hex, verifySignature } from '../lib/payments.js';

export const paymentsRouter: Router = Router();

/** Paid or any later state — an application that must NOT be charged again. */
const PAID_OR_LATER = ['paid', 'preparing', 'filed', 'gov_query', 'approved'];

// Create a Razorpay order for the signed-in baker's draft application.
paymentsRouter.post('/payments/order', requireAuth(), async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const application = await prisma.application.findFirst({
      where: { bakerId: userId, status: 'draft' },
      orderBy: { updatedAt: 'desc' },
    });
    if (!application) {
      // No payable draft. If the baker already has a paid/later application,
      // resume it instead of erroring — refresh/Back/retry never dead-ends.
      const settled = await prisma.application.findFirst({
        where: { bakerId: userId, status: { in: PAID_OR_LATER } },
        orderBy: { updatedAt: 'desc' },
      });
      if (settled) {
        res.status(200).json({ alreadyPaid: true, nextRoute: nextRouteForStatus(settled.status) });
        return;
      }
      res.status(404).json({ error: 'No application to pay for' });
      return;
    }

    const gateway = getGateway();

    // Idempotent order creation: reuse an existing unpaid order for this draft
    // so double-click / refresh / Back cannot create duplicate orders.
    const existingOrder = await prisma.payment.findFirst({
      where: { applicationId: application.id, status: 'created' },
      orderBy: { createdAt: 'desc' },
    });
    if (existingOrder) {
      res.status(200).json({
        orderId: existingOrder.orderId,
        amount: AMOUNT_PAISE,
        currency: CURRENCY,
        keyId: gateway.keyId,
        mock: gateway.mock,
      });
      return;
    }

    const order = await gateway.createOrder({
      amount: AMOUNT_PAISE,
      currency: CURRENCY,
      receipt: application.id,
    });

    await prisma.payment.create({
      data: {
        applicationId: application.id,
        orderId: order.orderId,
        amount: AMOUNT_PAISE,
        currency: CURRENCY,
        status: 'created',
      },
    });

    res.status(201).json({
      orderId: order.orderId,
      amount: AMOUNT_PAISE,
      currency: CURRENCY,
      keyId: gateway.keyId,
      mock: gateway.mock,
    });
  } catch (err) {
    next(err);
  }
});

type WebhookResult = { status: number; body: Record<string, unknown> };

/** Shared processor for the real webhook and the mock-pay simulator. Verifies
 * the signature, then idempotently flips Payment→paid + Application→paid. */
async function processWebhook(rawBody: string, signature: string, eventId: string): Promise<WebhookResult> {
  const gateway = getGateway();
  if (!verifySignature(rawBody, signature, gateway.webhookSecret)) {
    return { status: 400, body: { error: 'Invalid signature' } };
  }

  let event: unknown;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { error: 'Invalid JSON' } };
  }

  const payment = (event as { payload?: { payment?: { entity?: { id?: string; order_id?: string } } } })
    ?.payload?.payment?.entity;
  const orderId = payment?.order_id;
  const paymentId = payment?.id;
  if (!orderId) {
    // Not a payment event we care about — ack so the gateway doesn't retry.
    return { status: 200, body: { processed: false } };
  }

  const row = await prisma.payment.findUnique({ where: { orderId } });
  if (!row) {
    return { status: 200, body: { processed: false } }; // unknown order — ack, no-op
  }
  if (row.status === 'paid') {
    return { status: 200, body: { processed: true, idempotent: true } }; // already done
  }

  await prisma.$transaction([
    prisma.payment.update({
      where: { orderId },
      data: { status: 'paid', paymentId: paymentId ?? null, eventId },
    }),
    prisma.application.updateMany({
      where: { id: row.applicationId, status: 'draft' },
      data: { status: 'paid' },
    }),
  ]);

  return { status: 200, body: { processed: true } };
}

// Razorpay webhook. Body is raw (see app.ts) so the HMAC matches byte-for-byte.
paymentsRouter.post('/payments/webhook', async (req: Request, res, next) => {
  try {
    const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);
    const signature = req.header('x-razorpay-signature') ?? '';
    const eventId = req.header('x-razorpay-event-id') ?? randomUUID();
    const result = await processWebhook(raw, signature, eventId);
    res.status(result.status).json(result.body);
  } catch (err) {
    next(err);
  }
});

// Mock-only: simulate a successful Razorpay capture by signing an event and
// driving it through the SAME webhook processor (real signature + idempotency).
paymentsRouter.post('/payments/mock/pay', requireAuth(), async (req, res, next) => {
  try {
    const gateway = getGateway();
    if (!gateway.mock) {
      res.status(404).json({ error: 'Not available' });
      return;
    }
    const orderId = (req.body as { orderId?: string })?.orderId;
    if (!orderId) {
      res.status(400).json({ error: 'Missing orderId' });
      return;
    }
    const eventBody = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: { entity: { id: `pay_mock_${randomUUID().replace(/-/g, '').slice(0, 14)}`, order_id: orderId, status: 'captured' } },
      },
    });
    const signature = hmacSha256Hex(eventBody, gateway.webhookSecret);
    const result = await processWebhook(eventBody, signature, `evt_mock_${randomUUID()}`);
    res.status(result.status).json(result.body);
  } catch (err) {
    next(err);
  }
});
