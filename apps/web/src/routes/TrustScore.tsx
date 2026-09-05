import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import type { TrustScore as TrustScoreData } from '@sahi/shared';
import { AppShell } from '../components/AppShell';
import { AppHeader } from '../components/AppHeader';
import { Surface } from '../components/ui/Surface';
import { getTrustScore } from '../lib/trust';

export function TrustScore() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TrustScoreData | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const d = await getTrustScore();
      if (!alive) return;
      if (!d) return navigate('/sign-in');
      setData(d);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [navigate]);

  if (loading || !data) {
    return (
      <AppShell>
        <AppHeader title="Trust Score" onBack={() => navigate('/dashboard')} />
        <div className="flex flex-1 items-center justify-center p-6">
          <p className="text-sm text-copy-muted">Loading…</p>
        </div>
      </AppShell>
    );
  }

  const improve = data.factors.filter((f) => !f.done);

  return (
    <AppShell>
      <AppHeader title="Trust Score" onBack={() => navigate('/dashboard')} />
      <div className="flex flex-1 flex-col gap-5 p-5">
        <p className="text-sm leading-relaxed text-copy-muted">
          An honest view of what helps customers trust your business.
        </p>

        {/* Score ring */}
        <div className="grid place-items-center">
          <div
            className="grid size-40 place-items-center rounded-full"
            style={{ background: `conic-gradient(var(--color-verified) 0 ${data.score}%, var(--color-app-raised) ${data.score}% 100%)` }}
          >
            <div className="grid size-32 place-items-center rounded-full bg-app text-center">
              <div>
                <strong className="block text-4xl font-bold">{data.score}</strong>
                <span className="text-xs font-medium uppercase tracking-[0.1em] text-copy-muted">out of 100</span>
              </div>
            </div>
          </div>
        </div>

        {/* Breakdown */}
        <div className="grid gap-3">
          {data.factors.map((f) => (
            <Surface key={f.key} className={`flex items-center gap-3 ${!f.done ? 'ring-action/40' : ''}`}>
              <span
                className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold ${
                  f.done ? 'bg-verified/15 text-verified' : 'bg-action text-action-foreground'
                }`}
              >
                {f.done ? '✓' : '!'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-copy">{f.label}</p>
                <p className="mt-0.5 text-xs text-copy-muted">{f.detail}</p>
              </div>
              {!f.done && <span className="shrink-0 text-sm font-semibold text-action">+{f.points}</span>}
            </Surface>
          ))}
        </div>

        <p className="mt-auto text-center text-xs text-copy-muted">
          {improve[0]
            ? `Complete “${improve[0].label}” to reach ${data.score + improve[0].points}.`
            : 'Full score — you’re as trusted as it gets. Keep your renewal current.'}
        </p>
      </div>
    </AppShell>
  );
}
