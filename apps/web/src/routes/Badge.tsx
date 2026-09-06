import { useState } from 'react';
import { useNavigate } from 'react-router';
import { AppShell } from '../components/AppShell';
import { AppHeader } from '../components/AppHeader';
import { PrimaryAction } from '../components/ui/PrimaryAction';
import { LoadError } from '../components/LoadError';
import { getFilingStatus } from '../lib/filing';
import { useLoader } from '../lib/useLoader';
import { renderBadge, type BadgeFormat } from '../lib/badge';

const FORMATS: BadgeFormat[] = ['Post', 'Story', 'DP'];

export function Badge() {
  const navigate = useNavigate();
  const { status, data, reload } = useLoader<{ name: string; fssai: string } | null>(async (signal) => {
    const v = await getFilingStatus(signal);
    if (signal.aborted) return null;
    if (!v) {
      navigate('/sign-in');
      return null;
    }
    if (v.status !== 'approved') {
      navigate('/status');
      return null;
    }
    return { name: v.businessName ?? 'Your business', fssai: v.fssaiNumber ?? '' };
  }, [navigate]);
  const name = data?.name ?? '';
  const fssai = data?.fssai ?? '';
  const [format, setFormat] = useState<BadgeFormat>('Post');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setMsg(null);
    try {
      const blob = await renderBadge(format, name, fssai);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sahi-verified-${format.toLowerCase()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setMsg('Couldn’t generate the image — please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    setBusy(true);
    setMsg(null);
    try {
      const blob = await renderBadge(format, name, fssai);
      const file = new File([blob], `sahi-verified-${format.toLowerCase()}.png`, { type: 'image/png' });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: 'FSSAI Verified', text: `${name} · FSSAI verified` });
      } else {
        await download();
        setMsg('Sharing isn’t supported here — downloaded instead.');
      }
    } catch {
      // user cancelled share or it failed — no-op
    } finally {
      setBusy(false);
    }
  }

  if (status === 'error') {
    return (
      <AppShell>
        <AppHeader title="Verified badge" onBack={() => navigate('/dashboard')} />
        <LoadError onRetry={reload} onHome={() => navigate('/dashboard')} />
      </AppShell>
    );
  }
  if (!data) {
    return (
      <AppShell>
        <AppHeader title="Verified badge" onBack={() => navigate('/dashboard')} />
        <div className="flex flex-1 items-center justify-center p-6">
          <p className="text-sm text-copy-muted">Loading…</p>
        </div>
      </AppShell>
    );
  }

  const previewShape =
    format === 'Story' ? 'aspect-[9/16] max-w-44' : format === 'DP' ? 'aspect-square max-w-56 rounded-full' : 'aspect-square max-w-64';

  return (
    <AppShell>
      <AppHeader title="Verified badge" onBack={() => navigate('/dashboard')} />
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div>
          <h1 className="text-2xl font-bold leading-tight">Show customers you’re verified</h1>
          <p className="mt-2 text-sm leading-relaxed text-copy-muted">
            Choose a format, then download or share it.
          </p>
        </div>

        <div className="rounded-3xl bg-action/10 p-6">
          <div
            className={`mx-auto flex flex-col items-center justify-center bg-app-raised p-6 text-center ring-1 ring-line ${previewShape} ${
              format === 'DP' ? '' : 'rounded-3xl'
            }`}
          >
            <span className="grid size-14 place-items-center rounded-full bg-verified text-2xl text-verified-foreground">✓</span>
            <strong className="mt-3 text-base text-copy">{name}</strong>
            {fssai && <span className="mt-1 text-[10px] text-copy-muted">FSSAI #{fssai}</span>}
            <span className="mt-3 text-[10px] font-bold tracking-wide text-verified">✓ VERIFIED · ACTIVE</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {FORMATS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              className={`min-h-11 rounded-xl text-sm font-semibold ring-1 transition ${
                format === f ? 'bg-action/10 text-action ring-action' : 'bg-app-raised text-copy-muted ring-line'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {msg && <p className="text-xs text-copy-muted">{msg}</p>}

        <div className="mt-auto grid grid-cols-2 gap-3">
          <PrimaryAction type="button" variant="ghost" disabled={busy} onClick={download}>
            {busy ? '…' : 'Download'}
          </PrimaryAction>
          <PrimaryAction type="button" disabled={busy} onClick={share}>
            {busy ? '…' : 'Share'}
          </PrimaryAction>
        </div>
      </div>
    </AppShell>
  );
}
