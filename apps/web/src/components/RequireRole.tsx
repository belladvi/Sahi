import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import type { Role } from '@sahi/shared';
import { authClient } from '../lib/auth-client';

/**
 * Client route guard. Redirects to home when the viewer is signed out or
 * lacks an allowed role. The API enforces the same rule (defence in depth).
 */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { data, isPending } = authClient.useSession();

  if (isPending) {
    return <div className="flex min-h-dvh items-center justify-center bg-app text-copy-muted">Loading…</div>;
  }

  const user = data?.user as { role?: Role } | undefined;
  if (!user) return <Navigate to="/" replace />;
  if (user.role && !roles.includes(user.role)) return <Navigate to="/" replace />;

  return <>{children}</>;
}
