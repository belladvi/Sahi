import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { allowedOpsTransitions, isValidFssaiNumber, type FilingStatus, type OpsApplicationDetail } from '@sahi/shared';
import { AppShell } from '../components/AppShell';
import { AppHeader } from '../components/AppHeader';
import { Surface } from '../components/ui/Surface';
import { PrimaryAction } from '../components/ui/PrimaryAction';
import { getOpsApplication, transitionApplication, uploadCertificate, publishApplication } from '../lib/ops';
import { getOpsNotification } from '../lib/notifications';

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
  // Approval / publish state
  const [num1, setNum1] = useState('');
  const [num2, setNum2] = useState('');
  const [certKey, setCertKey] = useState<string | null>(null);
  const [certName, setCertName] = useState<string | null>(null);
  const [certBusy, setCertBusy] = useState(false);
  // Screen 19 entry link — shown only when a demo notification exists (endpoint
  // 200). It 404s before approval and while the feature is off, so this stays
  // hidden in exactly those cases. Re-probed on load so it appears after publish.
  const [hasNotification, setHasNotification] = useState(false);

  async function load() {
    const a = await getOpsApplication(id);
    setApp(a);
    const notif = await getOpsNotification(id);
    setHasNotification(notif.kind === 'ok');
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
  const canApprove = app.status === 'filed' || app.status === 'gov_query';
  const numberClean = num1.replace(/\s/g, '');
  const numbersMatch = numberClean.length > 0 && numberClean === num2.replace(/\s/g, '');
  const canPublish = isValidFssaiNumber(num1) && numbersMatch && !!certKey && !busy && !certBusy;

  async function attachCertificate(file: File) {
    setCertBusy(true);
    setError(null);
    try {
      const key = await uploadCertificate(id, file);
      setCertKey(key);
      setCertName(file.name);
    } catch {
      setError('Certificate upload failed — try again.');
    } finally {
      setCertBusy(false);
    }
  }

  async function publish() {
    if (!certKey) return;
    setBusy(true);
    setError(null);
    const res = await publishApplication(id, numberClean, certKey);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not publish.');
      return;
    }
    await load();
  }

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

        {app.status === 'approved' && (
          <Surface className="border border-verified/30 bg-verified/5">
            <p className="text-sm font-semibold text-verified">Published · live</p>
            <p className="mt-1 text-sm text-copy">FSSAI {app.fssaiNumber}</p>
          </Surface>
        )}

        {/* Screen 19 — demo notification preview (only when one exists) */}
        {hasNotification && (
          <button
            type="button"
            onClick={() => navigate(`/ops/${id}/notification`)}
            className="flex items-center justify-between rounded-xl bg-app-raised px-3 py-2.5 text-left ring-1 ring-line hover:bg-app"
          >
            <span className="text-sm font-semibold text-copy">💬 View notification</span>
            <span className="text-copy-muted">›</span>
          </button>
        )}

        {canApprove && (
          <Surface className="space-y-3">
            <p className="text-sm font-semibold text-copy">Approve &amp; publish</p>
            <p className="text-xs text-copy-muted">
              FoSCoS has no API — type the approved 14-digit number from the portal and attach the
              certificate. Publishing flips the baker’s app to live.
            </p>
            <input
              value={num1}
              onChange={(e) => setNum1(e.target.value)}
              inputMode="numeric"
              placeholder="FSSAI number (14 digits)"
              className="w-full rounded-xl bg-app px-3 py-2.5 text-sm tracking-[0.12em] text-copy ring-1 ring-line outline-none placeholder:text-copy-muted focus:ring-action"
            />
            <input
              value={num2}
              onChange={(e) => setNum2(e.target.value)}
              inputMode="numeric"
              placeholder="Re-enter to confirm"
              className="w-full rounded-xl bg-app px-3 py-2.5 text-sm tracking-[0.12em] text-copy ring-1 ring-line outline-none placeholder:text-copy-muted focus:ring-action"
            />
            {num2.length > 0 && !numbersMatch && (
              <p className="text-xs text-danger">The two numbers don’t match.</p>
            )}
            {certKey ? (
              <div className="flex items-center justify-between rounded-xl border border-verified/30 bg-verified/5 px-3 py-2.5">
                <span className="truncate text-sm text-copy">📄 {certName ?? 'certificate.pdf'} · attached ✓</span>
                <button type="button" onClick={() => { setCertKey(null); setCertName(null); }} className="shrink-0 text-xs font-semibold text-copy-muted">
                  Replace
                </button>
              </div>
            ) : (
              <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line text-sm font-medium text-copy-muted hover:text-copy">
                {certBusy ? 'Uploading…' : '＋ Attach certificate PDF'}
                <input
                  type="file"
                  accept="application/pdf"
                  hidden
                  disabled={certBusy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void attachCertificate(f);
                    e.target.value = '';
                  }}
                />
              </label>
            )}
            <PrimaryAction type="button" disabled={!canPublish} onClick={publish}>
              {busy ? 'Publishing…' : 'Publish — flip to live'}
            </PrimaryAction>
          </Surface>
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
