import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router';
import { AppShell } from './AppShell';
import { AppHeader } from './AppHeader';
import { PrimaryAction } from './ui/PrimaryAction';

/**
 * Branded route-level error boundary (R1) — the `errorElement` for the whole
 * client tree. Catches a thrown render/loader error (and a no-match 404 that
 * reaches the root) and offers Home + Retry instead of React Router's raw
 * developer screen. A 404 is delegated to the catch-all NotFound copy.
 */
export function RouteError() {
  const error = useRouteError();
  const navigate = useNavigate();
  const notFound = isRouteErrorResponse(error) && error.status === 404;

  return (
    <AppShell>
      <AppHeader title={notFound ? 'Page not found' : 'Something went wrong'} />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="grid size-14 place-items-center rounded-full bg-app-raised text-2xl ring-1 ring-line" aria-hidden="true">
          {notFound ? '🔍' : '⚠️'}
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold text-copy">
            {notFound ? 'This page doesn’t exist' : 'This page hit a snag'}
          </h1>
          <p className="mx-auto max-w-[34ch] text-sm leading-relaxed text-copy-muted">
            {notFound
              ? 'The link may be broken or the page may have moved.'
              : 'An unexpected error stopped this page from loading. You can retry or head home.'}
          </p>
        </div>
        <div className="mt-2 w-full max-w-xs space-y-3">
          {!notFound && (
            <PrimaryAction type="button" onClick={() => window.location.reload()}>
              Try again
            </PrimaryAction>
          )}
          <PrimaryAction type="button" variant={notFound ? 'primary' : 'ghost'} onClick={() => navigate('/')}>
            Go home
          </PrimaryAction>
        </div>
      </div>
    </AppShell>
  );
}
