import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { hasFiled, sentToGovernment, type FilingStatusView } from '@sahi/shared';
import { AppShell } from '../components/AppShell';
import { AppHeader } from '../components/AppHeader';
import { Surface } from '../components/ui/Surface';
import { PrimaryAction } from '../components/ui/PrimaryAction';
import { getFilingStatus } from '../lib/filing';

function formatDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

interface Milestone {
  title: string;
  detail: string;
  done: boolean;
}

export function FilingStatus() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<FilingStatusView | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const v = await getFilingStatus();
      if (!alive) return;
      if (!v) {
        navigate('/sign-in');
        return;
      }
      if (!hasFiled(v.status)) {
        // Hasn't filed yet — send her back to finish confirming.
        navigate('/confirm');
        return;
      }
      setView(v);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [navigate]);

  if (loading || !view) {
    return (
      <AppShell>
        <AppHeader title="Your application" />
        <div className="flex flex-1 items-center justify-center p-6">
          <p className="text-sm text-copy-muted">Loading…</p>
        </div>
      </AppShell>
    );
  }

  const approved = view.status === 'approved';

  const sent = sentToGovernment(view.status);
  const milestones: Milestone[] = [
    { title: 'Details checked', detail: 'Everything looked good', done: true },
    {
      title: 'Sent to the government portal (FoSCoS)',
      detail: sent
        ? view.filedAt
          ? `Submitted on ${formatDate(view.filedAt)}`
          : 'Submitted'
        : 'Preparing your filing…',
      done: sent,
    },
    {
      title: 'Under government review',
      detail: sent ? 'Typically about 7 days' : 'Starts once we file',
      done: false,
    },
  ];

  return (
    <AppShell>
      <AppHeader title="Your application" />
      <div className="flex flex-1 flex-col p-6">
        {!approved ? (
          <>
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-action/15 text-2xl">
              ⏳
            </div>
            <h1 className="mt-5 text-center text-2xl font-bold leading-tight">We’re handling it</h1>
            <p className="mx-auto mt-2 max-w-[32ch] text-center text-sm leading-relaxed text-copy-muted">
              Government review usually takes about a week. You don’t need to do anything — we’ll
              message you when your number is ready.
            </p>

            <div className="mt-8 space-y-0">
              {milestones.map((m, i) => (
                <div key={m.title} className="relative flex gap-4 pb-6">
                  <span
                    className={`relative z-10 grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold ${
                      m.done
                        ? 'bg-verified text-verified-foreground'
                        : 'bg-action text-action-foreground'
                    }`}
                  >
                    {m.done ? '✓' : '•'}
                  </span>
                  {i < milestones.length - 1 && (
                    <span className="absolute left-[1.05rem] top-9 h-[calc(100%-2.25rem)] w-px bg-line" />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-copy">{m.title}</p>
                    <p className="mt-0.5 text-xs text-copy-muted">{m.detail}</p>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-2 rounded-2xl border border-dashed border-line p-3 text-center text-xs leading-relaxed text-copy-muted">
              Demo: there’s no live FoSCoS API — a teammate publishes the approved number from the Ops
              Console, which flips this screen to live.
            </p>

            <div className="mt-auto pt-6">
              <PrimaryAction type="button" disabled>
                Waiting for the government
              </PrimaryAction>
            </div>
          </>
        ) : (
          <>
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-verified/15 text-2xl">
              🎉
            </div>
            <h1 className="mt-5 text-center text-2xl font-bold leading-tight">
              Your FSSAI registration is live!
            </h1>
            <p className="mx-auto mt-2 max-w-[34ch] text-center text-sm leading-relaxed text-copy-muted">
              You’re officially registered. Show customers you’re the real deal.
            </p>

            <Surface className="mt-8 text-center">
              <p className="text-xs font-medium uppercase tracking-[0.1em] text-copy-muted">
                Your FSSAI number
              </p>
              <p className="mt-2 text-xl font-semibold tracking-[0.08em] text-copy">
                {view.fssaiNumber ?? '—'}
              </p>
            </Surface>

            {view.certificateUrl && (
              <a
                href={view.certificateUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-app-raised p-4 text-left ring-1 ring-line hover:bg-app"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-verified/15 text-verified">
                  📄
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-copy">FSSAI certificate</p>
                  <p className="text-xs text-copy-muted">Official PDF · tap to download</p>
                </div>
                <span className="shrink-0 text-copy-muted">↓</span>
              </a>
            )}

            <div className="mt-auto pt-6">
              <PrimaryAction type="button" onClick={() => navigate('/dashboard')}>
                Go to my dashboard
              </PrimaryAction>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
