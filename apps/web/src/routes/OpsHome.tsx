import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { FilingStatus, OpsQueueItem } from '@sahi/shared';
import { AppShell } from '../components/AppShell';
import { AppHeader } from '../components/AppHeader';
import { Surface } from '../components/ui/Surface';
import { LoadError } from '../components/LoadError';
import { getOpsQueue } from '../lib/ops';
import { useLoader } from '../lib/useLoader';

const FILTERS: { key: FilingStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'preparing', label: 'To file' },
  { key: 'filed', label: 'Filed' },
  { key: 'gov_query', label: 'Query' },
];

const STATUS_LABEL: Record<string, string> = {
  preparing: 'To file',
  filed: 'Filed',
  gov_query: 'Query',
  approved: 'Approved',
};

export function OpsHome() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilingStatus | 'all'>('all');
  const { status, data, reload } = useLoader<OpsQueueItem[]>(
    (signal) => getOpsQueue(filter === 'all' ? undefined : filter, signal),
    [filter],
  );
  const items = data ?? [];

  return (
    <AppShell>
      <AppHeader title="Ops Console" />
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex gap-2 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                filter === f.key ? 'bg-action text-action-foreground' : 'bg-app-raised text-copy-muted ring-1 ring-line'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {status === 'error' ? (
          <LoadError onRetry={reload} onHome={() => navigate('/ops')} />
        ) : status === 'loading' ? (
          <p className="text-sm text-copy-muted">Loading queue…</p>
        ) : items.length === 0 ? (
          <Surface>
            <p className="text-sm text-copy-muted">Nothing in this queue right now.</p>
          </Surface>
        ) : (
          <div className="space-y-3">
            {items.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => navigate(`/ops/${a.id}`)}
                className="w-full rounded-2xl bg-app-raised p-4 text-left ring-1 ring-line hover:bg-app"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-semibold text-copy">
                    {a.businessName ?? a.applicantName ?? 'Unnamed application'}
                  </p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      a.status === 'gov_query'
                        ? 'bg-danger/15 text-danger'
                        : a.status === 'filed'
                          ? 'bg-verified/15 text-verified'
                          : 'bg-action/15 text-action'
                    }`}
                  >
                    {STATUS_LABEL[a.status] ?? a.status}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-copy-muted">
                  {a.applicantName ? `${a.applicantName} · ` : ''}
                  {a.products.length ? a.products.join(', ') : 'No products listed'}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
