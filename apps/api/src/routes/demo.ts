import { Router } from 'express';
import { otpDemoRevealEnabled, peekDemoOtp } from '../auth.js';

export const demoRouter: Router = Router();

// DEMO ONLY. Reveals the last mock OTP for a contact so the UI can auto-fill it
// while no real SMS/email provider is wired. This is a takeover vector — it 404s
// unless OTP_DEMO_REVEAL is on, and MUST stay off once real senders land
// (ticket 27). See apps/api/src/auth.ts.
demoRouter.get('/demo/otp', (req, res) => {
  if (!otpDemoRevealEnabled) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const contact = String(req.query.contact ?? '').trim();
  if (!contact) {
    res.status(400).json({ error: 'contact required' });
    return;
  }
  // Email is stored lowercased; phone is stored as-is (already E.164 from the client).
  const code = peekDemoOtp(contact) ?? peekDemoOtp(contact.toLowerCase());
  res.json({ code: code ?? null });
});
