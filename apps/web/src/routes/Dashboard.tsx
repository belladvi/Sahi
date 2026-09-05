import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import type { FilingStatusView } from '@sahi/shared';
import { AppShell } from '../components/AppShell';
import { AppHeader } from '../components/AppHeader';
import { getFilingStatus } from '../lib/filing';
import { getMyNotification } from '../lib/notifications';

export function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<FilingStatusView | null>(null);
  // Screen 19 entry link — shown only when a demo notification actually exists
  // (endpoint 200). It 404s both before approval and while the feature is off,
  // so this stays hidden in exactly those cases.
  const [hasNotification, setHasNotification] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const v = await getFilingStatus();
      if (!alive) return;
      if (!v) {
        navigate('/sign-in');
        return;
      }
      if (v.status !== 'approved') {
        // Only a licensed baker gets the dashboard; otherwise show status.
        navigate('/status');
        return;
      }
      setView(v);
      const notif = await getMyNotification();
      if (!alive) return;
      setHasNotification(notif.kind === 'ok');
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [navigate]);

  if (loading || !view) {
    return (
      <AppShell>
        <AppHeader title="Home" />
        <div className="flex flex-1 items-center justify-center p-6">
          <p className="text-sm text-copy-muted">Loading…</p>
        </div>
      </AppShell>
    );
  }

  // The verify page is server-rendered (public), so open it as a full navigation.
  const openVerify = () => {
    if (view.verifyToken) window.open(`/verify/${view.verifyToken}`, '_blank', 'noopener');
  };
  const tiles: { label: string; icon: string; onClick: () => void }[] = [
    { label: 'Verified badge', icon: '🛡️', onClick: () => navigate('/badge') },
    { label: 'QR code', icon: '🔳', onClick: () => navigate('/qr') },
    { label: 'Verify page', icon: '🔗', onClick: openVerify },
    { label: 'Stay active', icon: '🔄', onClick: () => navigate('/renewal') },
  ];

  return (
    <AppShell>
      <AppHeader title="Home" />
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div>
          <h1 className="text-2xl font-bold leading-tight">You’re verified 🎉</h1>
        </div>

        {/* Credential card */}
        <div className="rounded-3xl bg-verified p-5 text-verified-foreground">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[0.08em]">FSSAI Basic</span>
            <span className="rounded-full bg-app/20 px-3 py-1.5 text-xs font-semibold">✓ Active</span>
          </div>
          <p className="mt-6 text-lg font-semibold">{view.businessName ?? 'Your business'}</p>
          <p className="mt-1 text-sm tracking-[0.08em]">{view.fssaiNumber ?? '—'}</p>
        </div>

        {/* Certificate download */}
        {view.certificateUrl && (
          <a
            href={view.certificateUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-2xl bg-app-raised p-3.5 ring-1 ring-line hover:bg-app"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-verified/15 text-verified">📄</span>
            <span className="min-w-0 flex-1 text-sm font-semibold text-copy">
              FSSAI certificate <span className="font-normal text-copy-muted">· PDF</span>
            </span>
            <span className="shrink-0 text-copy-muted">↓</span>
          </a>
        )}

        {/* Screen 19 — demo notification preview (only when one exists) */}
        {hasNotification && (
          <button
            type="button"
            onClick={() => navigate('/notification')}
            className="flex items-center gap-4 rounded-2xl bg-app-raised p-4 text-left ring-1 ring-line hover:bg-app"
          >
            <span className="grid size-12 place-items-center rounded-full bg-verified/15 text-lg">💬</span>
            <span className="min-w-0 flex-1">
              <strong className="block text-base text-copy">View message preview</strong>
              <span className="mt-0.5 block text-sm text-copy-muted">Your licence-ready notification</span>
            </span>
            <span className="text-copy-muted">›</span>
          </button>
        )}

        {/* Trust Score glance (full view = ticket 24) */}
        <button
          type="button"
          onClick={() => navigate('/trust-score')}
          className="flex items-center gap-4 rounded-2xl bg-app-raised p-4 text-left ring-1 ring-line hover:bg-app"
        >
          <span className="grid size-12 place-items-center rounded-full bg-verified/15 text-lg font-semibold text-verified">★</span>
          <span className="min-w-0 flex-1">
            <strong className="block text-base text-copy">Trust Score</strong>
            <span className="mt-0.5 block text-sm text-copy-muted">See how trusted your kitchen looks</span>
          </span>
          <span className="text-copy-muted">›</span>
        </button>

        {/* Action tiles */}
        <div className="grid grid-cols-2 gap-3">
          {tiles.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={t.onClick}
              className="flex min-h-24 flex-col justify-between rounded-2xl bg-app-raised p-4 text-left ring-1 ring-line hover:bg-app"
            >
              <span className="text-2xl">{t.icon}</span>
              <span className="text-sm font-semibold text-copy">{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
