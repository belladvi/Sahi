import { Router } from 'express';
import { getAuthDeliveryMode, peekDemoOtp } from '../lib/auth-delivery.js';

export const demoRouter: Router = Router();

// DEMO ONLY. Reveals the last demo OTP for an ALLOWLISTED, non-personal demo
// contact so the UI can auto-fill it — no real SMS/email is ever sent. It exists
// only when AUTH_DELIVERY_MODE=demo (the confirmed case-study environment), and
// returns a uniform { code: null } for any contact that is not on the allowlist,
// so an arbitrary caller can never retrieve or enumerate an OTP. See
// apps/api/src/lib/auth-delivery.ts.
demoRouter.get('/demo/otp', (req, res) => {
  if (getAuthDeliveryMode() !== 'demo') {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const contact = String(req.query.contact ?? '').trim();
  if (!contact) {
    res.status(400).json({ error: 'contact required' });
    return;
  }
  // peekDemoOtp enforces demo-mode + allowlist + expiry; non-allowlisted -> null.
  res.json({ code: peekDemoOtp(contact) ?? null });
});
