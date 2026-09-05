import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { NotificationView } from '@sahi/shared';
import { AppShell } from '../components/AppShell';
import { AppHeader } from '../components/AppHeader';
import { Surface } from '../components/ui/Surface';
import { PrimaryAction } from '../components/ui/PrimaryAction';
import { getMyNotification, getOpsNotification, retryOpsNotification } from '../lib/notifications';

type Screen = 'loading' | 'error' | 'missing' | 'ready';

const STATUS_LABEL: Record<NotificationView['status'], string> = {
  queued: 'Queued',
  processing: 'Sending…',
  sent: 'Sent',
  failed: 'Failed',
};
const STATUS_CLASS: Record<NotificationView['status'], string> = {
  queued: 'bg-app text-copy-muted ring-1 ring-line',
  processing: 'bg-action/15 text-action',
  sent: 'bg-verified/15 text-verified',
  failed: 'bg-danger/15 text-danger',
};

/**
 * Screen 19 — licence-ready notification preview (ticket 26A, DEMO). Protected
 * WhatsApp-style preview. Baker route (/notification) shows their own via
 * /current; Ops route (/ops/:id/notification) shows a specific application and
 * exposes retry. No real WhatsApp message is ever sent. Resilient to fetch and
 * retry errors — never leaves the page loading or the button stuck.
 */
export function Notification() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isOps = !!id;
  const [screen, setScreen] = useState<Screen>('loading');
  const [view, setView] = useState<NotificationView | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState(false);

  const load = useCallback(async () => {
    setScreen('loading');
    setRetryError(false);
    const r = id ? await getOpsNotification(id) : await getMyNotification();
    if (r.kind === 'ok') {
      setView(r.view);
      setScreen('ready');
    } else {
      setScreen(r.kind === 'missing' ? 'missing' : 'error');
    }
  }, [id]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const r = id ? await getOpsNotification(id) : await getMyNotification();
      if (!alive) return;
      if (r.kind === 'ok') {
        setView(r.view);
        setScreen('ready');
      } else {
        setScreen(r.kind === 'missing' ? 'missing' : 'error');
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  async function retry(force: boolean) {
    if (!id) return;
    setRetrying(true);
    setRetryError(false);
    try {
      const r = await retryOpsNotification(id, force);
      if (r.kind === 'ok') setView(r.view);
      else setRetryError(true);
    } finally {
      setRetrying(false); // never leaves the button stuck in "Retrying"
    }
  }

  return (
    <AppShell>
      <AppHeader title="Licence-ready message" onBack={() => navigate(isOps ? `/ops/${id}` : '/dashboard')} />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <p className="rounded-xl bg-action/10 px-3 py-2 text-center text-xs font-semibold text-action ring-1 ring-action/30">
          Demo preview — no WhatsApp message was sent.
        </p>

        {screen === 'loading' && <p className="text-sm text-copy-muted">Loading…</p>}

        {screen === 'error' && (
          <Surface>
            <p className="text-sm text-copy">Couldn’t load this notification.</p>
            <p className="mt-1 text-sm text-copy-muted">It’s a temporary problem — please try again.</p>
            <div className="mt-3">
              <PrimaryAction type="button" variant="ghost" onClick={load}>
                Try again
              </PrimaryAction>
            </div>
          </Surface>
        )}

        {screen === 'missing' && (
          <Surface>
            <p className="text-sm text-copy-muted">
              No licence-ready notification yet. It’s created once the application is approved and the
              notification feature is enabled.
            </p>
          </Surface>
        )}

        {screen === 'ready' && view && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm text-copy-muted">Status</span>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_CLASS[view.status]}`}>
                {STATUS_LABEL[view.status]}
              </span>
            </div>

            <div className="rounded-2xl bg-app-raised p-3 ring-1 ring-line">
              <p className="mb-2 text-center text-[11px] uppercase tracking-wide text-copy-muted">Preview · WhatsApp</p>
              <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-verified/10 p-3 text-sm leading-relaxed text-copy ring-1 ring-verified/20">
                <p className="font-semibold">Your FSSAI registration is approved ✅</p>
                {view.businessName && <p className="mt-1">Business: {view.businessName}</p>}
                {view.fssaiNumber && (
                  <p className="mt-1">
                    FSSAI number: <span className="font-mono font-semibold">{view.fssaiNumber}</span>
                  </p>
                )}
                {view.certificateUrl ? (
                  <a
                    href={view.certificateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 flex items-center gap-2 rounded-lg bg-app px-3 py-2 text-xs font-semibold text-copy ring-1 ring-line hover:bg-app/70"
                  >
                    📄 Your certificate (secure link)
                  </a>
                ) : (
                  <p className="mt-3 text-xs text-copy-muted">Certificate attachment unavailable.</p>
                )}
              </div>
              {view.phoneMasked && <p className="mt-2 text-right text-[11px] text-copy-muted">to {view.phoneMasked}</p>}
            </div>

            {view.status === 'queued' && <p className="text-sm text-copy-muted">Queued for delivery.</p>}
            {view.status === 'processing' && <p className="text-sm text-copy-muted">Sending…</p>}
            {view.status === 'failed' && (
              <p className="text-sm text-danger">
                Delivery failed{view.failureReason ? ` (${view.failureReason})` : ''} after {view.attempts} attempt
                {view.attempts === 1 ? '' : 's'}
                {view.exhausted ? ' — automatic limit reached.' : '.'}
              </p>
            )}

            {retryError && <p className="text-sm text-danger">Retry didn’t go through — please try again.</p>}

            {/* Ops-only. Normal retry within the limit; explicit force past it. */}
            {isOps && view.canRetry && (
              <PrimaryAction type="button" disabled={retrying} onClick={() => retry(false)}>
                {retrying ? 'Retrying…' : 'Retry delivery'}
              </PrimaryAction>
            )}
            {isOps && view.canForceRetry && (
              <PrimaryAction type="button" variant="ghost" disabled={retrying} onClick={() => retry(true)}>
                {retrying ? 'Retrying…' : 'Retry anyway (limit reached)'}
              </PrimaryAction>
            )}

            <p className="mt-auto text-center text-[11px] text-copy-muted">
              Demo notification. Real WhatsApp delivery is a later step (production provider).
            </p>
          </>
        )}
      </div>
    </AppShell>
  );
}
