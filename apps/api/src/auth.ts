import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { emailOTP, phoneNumber } from 'better-auth/plugins';
import { prisma } from '@sahi/db';
import { deliverOtp } from './lib/auth-delivery.js';
import { CANONICAL_IP_HEADER } from './lib/client-ip.js';

/**
 * Better Auth: phone + email OTP, sessions in Postgres (via Prisma).
 *
 * OTP delivery is governed by AUTH_DELIVERY_MODE (see lib/auth-delivery.ts):
 *  - `demo`     — the code is remembered for allowlisted demo contacts so the UI
 *                 can auto-fill it; NO SMS/email is sent. Verification is unchanged.
 *  - `provider` — real delivery. No vendor is wired in R0, so `deliverOtp` throws
 *                 (fail closed). Real adapters are Ticket 27B (provider-blocked).
 * Neither sender ever logs the contact or the OTP.
 */
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
  // Per-client rate limiting keys off the IP we resolve ourselves and place in a
  // canonical header (see lib/client-ip.ts + app.ts). Better Auth reads ONLY that
  // header, never a raw caller-supplied forwarding header, so spoofing can't shift
  // a bucket and two real clients never share one.
  advanced: {
    ipAddress: {
      ipAddressHeaders: [CANONICAL_IP_HEADER],
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
      async sendVerificationOTP({ email, otp }) {
        deliverOtp('email', email, otp);
      },
    }),
    phoneNumber({
      otpLength: 6,
      expiresIn: 300,
      signUpOnVerification: {
        getTempEmail: (phone) => `${phone}@phone.sahi.local`,
      },
      async sendOTP({ phoneNumber: phone, code }) {
        deliverOtp('phone', phone, code);
      },
    }),
  ],
});

export type Auth = typeof auth;
