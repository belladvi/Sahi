import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { AppShell } from '../components/AppShell';
import { AppHeader } from '../components/AppHeader';
import { Surface } from '../components/ui/Surface';
import { PrimaryAction } from '../components/ui/PrimaryAction';
import { getRenewal, renew, type RenewalView } from '../lib/renewal';

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso.slice(0, 10);
  }
}

export function Renewal() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<RenewalView | null>(null);
  const [busy, setBusy] = useState(false);
  const [justRenewed, setJustRenewed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const v = await getRenewal();
      if (!alive) return;
      if (!v) return navigate('/status');
      setView(v);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [navigate]);

  async function pay() {
    setBusy(true);
    setError(null);
    const res = await renew();
    setBusy(false);
    if (!res.ok || !res.view) {
      setError(res.error ?? 'Could not renew.');
      return;
    }
    setView(res.view);
    setJustRenewed(!!res.renewed);
  }

  if (loading || !view) {
    return (
      <AppShell>
        <AppHeader title="Stay active" onBack={() => navigate('/dashboard')} />
        <div className="flex flex-1 items-center justify-center p-6">
          <p className="text-sm text-copy-muted">Loading…</p>
        </div>
      </AppShell>
    );
  }

  const chip =
    view.state === 'overdue'
      ? { text: 'Overdue', cls: 'bg-danger/15 text-danger' }
      : view.state === 'due-soon'
        ? { text: `Due in ${view.daysUntilDue} days`, cls: 'bg-action/15 text-action' }
        : { text: `Active to ${formatDate(view.dueDate)}`, cls: 'bg-verified/15 text-verified' };

  return (
    <AppShell>
      <AppHeader title="Stay active" onBack={() => navigate('/dashboard')} />
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div>
          <h1 className="text-2xl font-bold leading-tight">Never lose your active status</h1>
          <p className="mt-2 text-sm leading-relaxed text-copy-muted">
            We keep the annual government fee paid so you’re never suspended or dropped from delivery
            apps.
          </p>
        </div>

        <Surface className="ring-verified/30">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-copy-muted">Current licence</p>
              <p className="mt-1 text-2xl font-semibold text-verified">Active ✓</p>
            </div>
            <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${chip.cls}`}>{chip.text}</span>
          </div>
          <div className="mt-4 flex justify-between border-t border-line pt-3 text-sm">
            <span className="text-copy-muted">Next action</span>
            <strong className="text-copy">{formatDate(view.dueDate)}</strong>
          </div>
        </Surface>

        <div className="rounded-2xl bg-verified/10 p-4">
          {view.cohort === 'perpetual' ? (
            <>
              <p className="text-sm font-semibold text-copy">Your licence is perpetual</p>
              <p className="mt-2 text-sm leading-relaxed text-copy-muted">
                Because you registered after 1 Apr 2026, it never expires. The government charges ₹100
                each year to keep it active.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-copy">Your licence renews at expiry</p>
              <p className="mt-2 text-sm leading-relaxed text-copy-muted">
                Your registration needs a renewal filing before it expires — we handle it so there’s no
                gap in your active status.
              </p>
            </>
          )}
        </div>

        <Surface>
          <div className="flex items-end justify-between">
            <p className="text-base font-semibold text-copy">Sahi Stay Active</p>
            <p className="text-2xl font-bold text-action">
              ₹{view.total}
              <span className="text-xs font-medium text-copy-muted">/yr</span>
            </p>
          </div>
          <div className="mt-4 divide-y divide-line text-sm">
            <div className="flex justify-between pb-3 text-copy-muted">
              <span>Government annual fee</span>
              <strong className="text-copy">₹{view.govFee}</strong>
            </div>
            <div className="flex justify-between py-3 text-copy-muted">
              <span>Our service</span>
              <strong className="text-copy">₹{view.serviceFee}</strong>
            </div>
          </div>
        </Surface>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="mt-auto">
          <p className="mb-2 text-center text-xs text-copy-muted">
            Missing the annual fee can suspend your licence.
          </p>
          <PrimaryAction type="button" disabled={busy || justRenewed} onClick={pay}>
            {justRenewed ? 'You’re all set ✓' : busy ? 'Processing…' : `Pay ₹${view.total} & stay active`}
          </PrimaryAction>
        </div>
      </div>
    </AppShell>
  );
}
