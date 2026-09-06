import { useNavigate } from 'react-router';
import { AppShell } from './AppShell';
import { AppHeader } from './AppHeader';
import { PrimaryAction } from './ui/PrimaryAction';

/**
 * Branded catch-all for unknown client routes (R1) — replaces React Router's raw
 * developer 404. Express-owned surfaces (/verify/*, /api/*) are served by the
 * server and never reach the SPA router, so they are unaffected.
 */
export function NotFound() {
  const navigate = useNavigate();
  return (
    <AppShell>
      <AppHeader title="Page not found" />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="grid size-14 place-items-center rounded-full bg-app-raised text-2xl ring-1 ring-line" aria-hidden="true">
          🔍
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold text-copy">This page doesn’t exist</h1>
          <p className="mx-auto max-w-[34ch] text-sm leading-relaxed text-copy-muted">
            The link may be broken or the page may have moved.
          </p>
        </div>
        <div className="mt-2 w-full max-w-xs">
          <PrimaryAction type="button" onClick={() => navigate('/')}>
            Go home
          </PrimaryAction>
        </div>
      </div>
    </AppShell>
  );
}
