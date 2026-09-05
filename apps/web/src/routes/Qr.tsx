import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { AppShell } from '../components/AppShell';
import { AppHeader } from '../components/AppHeader';
import { PrimaryAction } from '../components/ui/PrimaryAction';
import { getFilingStatus } from '../lib/filing';
import { renderQrDataUrl, verifyUrl } from '../lib/qr';

export function Qr() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState('');
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const v = await getFilingStatus();
      if (!alive) return;
      if (!v) return navigate('/sign-in');
      if (v.status !== 'approved' || !v.verifyToken) return navigate('/status');
      setToken(v.verifyToken);
      try {
        const url = await renderQrDataUrl(verifyUrl(v.verifyToken));
        if (alive) setDataUrl(url);
      } catch {
        if (alive) setMsg('Couldn’t generate the QR — please try again.');
      }
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [navigate]);

  function download() {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'sahi-verify-qr.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function share() {
    if (!dataUrl) return;
    setBusy(true);
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'sahi-verify-qr.png', { type: 'image/png' });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: 'Verify my FSSAI', text: 'Scan to verify my FSSAI registration' });
      } else {
        download();
        setMsg('Sharing isn’t supported here — downloaded instead.');
      }
    } catch {
      /* cancelled */
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <AppHeader title="Your QR code" onBack={() => navigate('/dashboard')} />
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div>
          <h1 className="text-2xl font-bold leading-tight">Your verify QR</h1>
          <p className="mt-2 text-sm leading-relaxed text-copy-muted">
            Print it on your box or share it — customers scan to confirm you’re government-registered.
          </p>
        </div>

        <div className="rounded-3xl bg-action/10 p-6">
          <div className="mx-auto w-56 rounded-2xl bg-white p-4">
            {loading || !dataUrl ? (
              <div className="grid aspect-square place-items-center text-sm text-copy-muted">
                {msg ?? 'Generating…'}
              </div>
            ) : (
              <img src={dataUrl} alt="QR code linking to your public verification page" className="aspect-square w-full" />
            )}
          </div>
        </div>

        {msg && !loading && <p className="text-xs text-copy-muted">{msg}</p>}

        <button
          type="button"
          onClick={() => token && window.open(`/verify/${token}`, '_blank', 'noopener')}
          disabled={!token}
          className="rounded-2xl bg-app-raised p-4 text-left text-sm ring-1 ring-line hover:bg-app disabled:opacity-50"
        >
          <span className="font-semibold text-copy">Preview what your customer sees</span>
          <span className="mt-0.5 block text-xs text-copy-muted">Opens your public verification page ›</span>
        </button>

        <div className="mt-auto grid grid-cols-2 gap-3">
          <PrimaryAction type="button" variant="ghost" disabled={!dataUrl} onClick={download}>
            Download
          </PrimaryAction>
          <PrimaryAction type="button" disabled={!dataUrl || busy} onClick={share}>
            {busy ? '…' : 'Share'}
          </PrimaryAction>
        </div>
      </div>
    </AppShell>
  );
}
