import { createHash } from 'node:crypto';

/**
 * Ticket 26A — provider-neutral licence-ready notification (DEMO).
 *
 * The whole feature is behind an explicit flag and is OFF by default: with it
 * off, approval behaves exactly as before and no notification rows are created.
 * The demo uses a deterministic, offline MockWhatsAppProvider — it NEVER
 * contacts WhatsApp or any network. Real BSP delivery is ticket 26B.
 */
export const whatsappNotificationsEnabled = process.env.WHATSAPP_NOTIFICATIONS_ENABLED === 'true';

export interface NotificationMessage {
  idempotencyKey: string;
  applicationId: string;
  fssaiNumber: string;
  phone: string | null;
  /** Short-lived, signed certificate download URL (never a permanent public URL). */
  certificateUrl: string;
}

export interface WhatsAppProvider {
  readonly mock: boolean;
  /** Deliver the message. Resolve with a provider reference, or throw to fail. */
  send(msg: NotificationMessage): Promise<{ providerRef: string }>;
}

/** Deterministic, offline mock. Returns a stable reference derived from the
 * idempotency key (same across retries), and never performs any I/O. */
export class MockWhatsAppProvider implements WhatsAppProvider {
  readonly mock = true;
  async send(msg: NotificationMessage): Promise<{ providerRef: string }> {
    const ref = 'mock-wa-' + createHash('sha256').update(msg.idempotencyKey).digest('hex').slice(0, 16);
    return { providerRef: ref };
  }
}

let cached: WhatsAppProvider | null = null;

/** Mock unless WHATSAPP_PROVIDER=bsp (the real BSP adapter — ticket 26B — which
 * intentionally throws until it's configured, mirroring storage/payments). */
export function getNotifier(): WhatsAppProvider {
  if (cached) return cached;
  if (process.env.WHATSAPP_PROVIDER === 'bsp') {
    throw new Error('WhatsApp BSP provider not configured — ticket 26B');
  }
  cached = new MockWhatsAppProvider();
  return cached;
}

/** Test seam: inject a double (e.g. a failing provider). */
export function setNotifierForTests(p: WhatsAppProvider): void {
  cached = p;
}
export function resetNotifier(): void {
  cached = null;
}

/**
 * Strip PII from a string bound for the logs: signed storage URLs, and any long
 * digit run (phone / 14-digit FSSAI number). Logs should never carry phone
 * numbers, certificate URLs, certificate content, or the licence number.
 */
export function redact(v: unknown): string {
  let s = typeof v === 'string' ? v : v instanceof Error ? v.message : JSON.stringify(v ?? '');
  s = s.replace(/\/api\/storage\/object\?[^\s"']*/g, '/api/storage/object?[redacted]');
  s = s.replace(/\d{6,}/g, '[redacted-digits]');
  return s;
}
