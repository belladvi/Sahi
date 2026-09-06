import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { TOTAL_FEE_RUPEES } from '@sahi/shared';

/** ₹599 in paise — the amount charged. */
export const AMOUNT_PAISE = TOTAL_FEE_RUPEES * 100; // 59900
export const CURRENCY = 'INR';

/** Razorpay signs webhook bodies as hex HMAC-SHA256(rawBody, secret). The mock
 * gateway uses the *same* scheme, so this verification code is production-real
 * — flipping to live Razorpay is keys + order creation, nothing here changes. */
export function hmacSha256Hex(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = hmacSha256Hex(payload, secret);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature ?? '', 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export interface CreatedOrder {
  orderId: string;
}

export interface PaymentGateway {
  readonly mock: boolean;
  readonly keyId: string;
  readonly webhookSecret: string;
  createOrder(input: { amount: number; currency: string; receipt: string }): Promise<CreatedOrder>;
}

/** No external calls; mints a fake order id. Signs webhooks with a shared secret
 * so the mock checkout can drive the real webhook path end to end. */
class MockGateway implements PaymentGateway {
  readonly mock = true;
  readonly keyId = process.env.RAZORPAY_KEY_ID ?? 'rzp_test_mock';
  readonly webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET ?? 'mock_webhook_secret';
  createOrder(): Promise<CreatedOrder> {
    return Promise.resolve({ orderId: `order_mock_${randomUUID().replace(/-/g, '').slice(0, 14)}` });
  }
}

/** Real Razorpay via REST (no SDK dependency). Only used when keys are set. */
class RazorpayGateway implements PaymentGateway {
  readonly mock = false;
  constructor(
    readonly keyId: string,
    private readonly keySecret: string,
    readonly webhookSecret: string,
  ) {}
  async createOrder(input: { amount: number; currency: string; receipt: string }): Promise<CreatedOrder> {
    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`Razorpay order failed: ${res.status}`);
    const data = (await res.json()) as { id: string };
    return { orderId: data.id };
  }
}

let cached: PaymentGateway | null = null;

/** Payment mode is explicit and fail-closed (mirrors R0's AUTH_DELIVERY_MODE):
 *  - `demo`     → the deterministic mock gateway (the case-study environment).
 *  - `provider` → real Razorpay; requires COMPLETE config or it throws. It
 *                 NEVER silently falls back to demo.
 *  - unset/invalid → throw, so an ambiguous environment never processes money. */
export function getGateway(): PaymentGateway {
  if (cached) return cached;
  const mode = process.env.PAYMENT_MODE;
  if (mode === 'demo') {
    cached = new MockGateway();
    return cached;
  }
  if (mode === 'provider') {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!keyId || !keySecret || !webhookSecret) {
      throw new Error(
        'PAYMENT_MODE=provider requires RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET',
      );
    }
    cached = new RazorpayGateway(keyId, keySecret, webhookSecret);
    return cached;
  }
  throw new Error('PAYMENT_MODE must be set to "demo" or "provider"');
}

/** For tests: drop the memoised gateway so env changes take effect. */
export function resetGateway(): void {
  cached = null;
}
