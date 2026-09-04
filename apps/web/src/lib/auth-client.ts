import { createAuthClient } from 'better-auth/react';

/**
 * Better Auth browser client. baseURL defaults to the current origin
 * (same-origin in prod; the Vite dev server proxies /api to the API).
 * Use `authClient.useSession()` / `authClient.signOut()` directly at call
 * sites (re-exporting the hooks trips TS's portable-type inference).
 */
export const authClient = createAuthClient();
