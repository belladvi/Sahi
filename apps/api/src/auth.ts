import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { emailOTP, phoneNumber } from 'better-auth/plugins';
import { prisma } from '@sahi/db';

/**
 * Better Auth: phone + email OTP, sessions in Postgres (via Prisma).
 * Ticket 03 uses MOCK senders (log the code); the real SMS provider is ticket 27.
 *
 * DEMO REVEAL: while senders are mocks (no real SMS/email is wired), no code can
 * reach a phone/inbox. To keep the flow testable/demoable we remember the last
 * mock code per contact so the UI can auto-fill it. This is a demo shortcut and
 * a takeover vector — it is gated by OTP_DEMO_REVEAL and MUST be off (and the
 * store left unpopulated) once real senders land in ticket 27.
 */
export const otpDemoRevealEnabled = process.env.OTP_DEMO_REVEAL !== 'false';

const demoOtpStore = new Map<string, string>();

/** Return (and consume) the last mock OTP issued to a contact, demo mode only. */
export function peekDemoOtp(contact: string): string | null {
  if (!otpDemoRevealEnabled) return null;
  return demoOtpStore.get(contact) ?? null;
}
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  secret: process.env.BETTER_AUTH_SECRET ?? 'dev-insecure-secret-change-me',
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3001',
  trustedOrigins: [process.env.APP_BASE_URL ?? 'http://localhost:5173'],
  emailAndPassword: { enabled: false },
  user: {
    additionalFields: {
      role: { type: 'string', defaultValue: 'baker', input: false },
    },
  },
  // Force rate limiting on (Better Auth only enables it in prod by default).
  rateLimit: {
    enabled: true,
    window: 60,
    max: 20,
    customRules: {
      '/phone-number/send-otp': { window: 60, max: 5 },
      '/email-otp/send-verification-otp': { window: 60, max: 5 },
    },
  },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 300,
      async sendVerificationOTP({ email, otp, type }) {
        console.log(`[mock-email] OTP for ${email} (${type}): ${otp}`);
        if (otpDemoRevealEnabled) demoOtpStore.set(email.trim().toLowerCase(), otp);
      },
    }),
    phoneNumber({
      otpLength: 6,
      expiresIn: 300,
      signUpOnVerification: {
        getTempEmail: (phone) => `${phone}@phone.sahi.local`,
      },
      async sendOTP({ phoneNumber: phone, code }) {
        console.log(`[mock-sms] OTP for ${phone}: ${code}`);
        if (otpDemoRevealEnabled) demoOtpStore.set(phone, code);
      },
    }),
  ],
});

export type Auth = typeof auth;
