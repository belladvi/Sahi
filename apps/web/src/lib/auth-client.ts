import { createAuthClient } from 'better-auth/react';
import { phoneNumberClient, emailOTPClient } from 'better-auth/client/plugins';

/**
 * Better Auth browser client. baseURL defaults to the current origin
 * (same-origin in prod; the Vite dev server proxies /api to the API).
 *
 * The inferred client type isn't portably nameable — it references
 * better-auth's nested zod, tripping TS2742/TS7056 on `tsc --noEmit`
 * (same class of issue noted for the server's auth type). We annotate the
 * export with a minimal explicit surface (only what the app actually calls)
 * and cast; the runtime object is the full client. Plugins mirror the server
 * (apps/api/src/auth.ts): OTP-only, phone + email.
 */
type OtpResult = { error: { message?: string; code?: string; status?: number } | null };

export interface SahiAuthClient {
  useSession: () => { data: { user?: { role?: string } | null } | null; isPending: boolean };
  signOut: () => Promise<unknown>;
  phoneNumber: {
    sendOtp: (args: { phoneNumber: string }) => Promise<OtpResult>;
    verify: (args: { phoneNumber: string; code: string }) => Promise<OtpResult>;
  };
  emailOtp: {
    sendVerificationOtp: (args: { email: string; type: 'sign-in' }) => Promise<OtpResult>;
  };
  signIn: {
    emailOtp: (args: { email: string; otp: string }) => Promise<OtpResult>;
  };
}

export const authClient = createAuthClient({
  plugins: [phoneNumberClient(), emailOTPClient()],
}) as unknown as SahiAuthClient;
