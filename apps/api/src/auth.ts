import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { emailOTP, phoneNumber } from 'better-auth/plugins';
import { prisma } from '@sahi/db';

/**
 * Better Auth: phone + email OTP, sessions in Postgres (via Prisma).
 * Ticket 03 uses MOCK senders (log the code); the real SMS provider is ticket 27.
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
      },
    }),
  ],
});

export type Auth = typeof auth;
