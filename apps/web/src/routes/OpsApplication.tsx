import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { allowedOpsTransitions, type FilingStatus, type OpsApplicationDetail } from '@sahi/shared';
import { AppShell } from '../components/AppShell';
import { AppHeader } from '../components/AppHeader';
import { Surface } from '../components/ui/Surface';
import { PrimaryAction } from '../components/ui/PrimaryAction';
import { getOpsApplication, transitionApplication } from '../lib/ops';

const ACTION_LABEL: Record<string, string> = {
  filed: 'Mark filed to FoSCoS',
  gov_query: 'Log a government query',
};

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2 py-2">
      <span className="text-xs text-copy-muted">{label}</span>
      <span className="text-sm text-copy">{value}</span>
    </div>
  );
}

export function OpsApplication() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState<OpsApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const a = await getOpsApplication(id);
    setApp(a);
    setLoading(false);
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function move(to: FilingStatus) {
    setBusy(true);
    setError(null);
    const res = await transitionApplication(id, { toStatus: to as 'filed' | 'gov_query', note: note.trim() || undefined });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not update.');
      return;
    }
    setNote('');
    await load();
  }

  if (loading) {
    return (
      <AppShell>
        <AppHeader title="Application" onBack={() => navigate('/ops')} />
        <div className="flex flex-1 items-center justify-center p-6">
          <p className="text-sm text-copy-muted">Loading…</p>
        </div>
      </AppShell>
    );
  }
  if (!app) {
    return (
      <AppShell>
        <AppHeader title="Application" onBack={() => navigate('/ops')} />
        <div className="p-6">
          <p className="text-sm text-copy-muted">Application not found.</p>
        </div>
      </AppShell>
    );
  }

  const transitions = allowedOpsTransitions(app.status);
  const needsNote = transitions.includes('gov_query');

  return (
    <AppShell>
      <AppHeader title={app.businessName ?? 'Application'} onBack={() => navigate('/ops')} />
      <div className="flex flex-1 flex-col gap-4 p-5">
        <Surface className="divide-y divide-line">
          <Row label="Applicant" value={app.applicantName} />
          <Row label="Business" value={app.businessName} />
          <Row label="Category" value={app.category} />
          <Row label="Sub-category" value={app.subCategory} />
          <Row label="Products" value={app.products.join(', ') || null} />
          <Row label="Description" value={app.description} />
          <Row label="Premises" value={app.premises} />
          <Row label="Address" value={app.residentialAddress} />
          <Row label="Phone" value={app.phone} />
          <Row label="Email" value={app.email} />
        </Surface>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-copy-muted">Documents</p>
          <div className="space-y-2">
            {app.documents.map((d) => (
              <div key={d.label} className="flex items-center justify-between rounded-xl bg-app-raised px-3 py-2.5 ring-1 ring-line">
                <div className="min-w-0">
                  <p className="text-sm text-copy">{d.label}</p>
                  {d.note && <p className="text-xs text-copy-muted">{d.note}</p>}
                </div>
                {d.url ? (
                  <a href={d.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-sm font-semibold text-action">
                    View
                  </a>
                ) : (
                  <span className="shrink-0 text-xs text-copy-muted">—</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {app.events.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-copy-muted">History</p>
            <div className="space-y-1.5">
              {app.events.map((e) => (
                <div key={e.id} className="rounded-lg bg-app-raised px-3 py-2 text-xs text-copy-muted ring-1 ring-line">
                  {e.fromStatus ? `${e.fromStatus} → ` : ''}
                  <span className="text-copy">{e.toStatus}</span>
                  {e.note ? ` · ${e.note}` : ''}
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        {transitions.length > 0 ? (
          <div className="mt-auto space-y-3 pt-2">
            {needsNote && (
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Query detail (internal — the baker never sees this)"
                className="w-full resize-none rounded-xl bg-app-raised px-3 py-2.5 text-sm text-copy ring-1 ring-line outline-none placeholder:text-copy-muted focus:ring-action"
              />
            )}
            {transitions.map((t) => (
              <PrimaryAction
                key={t}
                type="button"
                variant={t === 'gov_query' ? 'ghost' : 'primary'}
                disabled={busy}
                onClick={() => move(t)}
              >
                {busy ? 'Working…' : (ACTION_LABEL[t] ?? `Move to ${t}`)}
              </PrimaryAction>
            ))}
          </div>
        ) : (
          <p className="mt-auto pt-2 text-center text-xs text-copy-muted">
            No further ops actions for this status.
          </p>
        )}
      </div>
    </AppShell>
  );
}
