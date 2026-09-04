import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { AppShell } from '../components/AppShell';
import { AppHeader } from '../components/AppHeader';
import { PrimaryAction } from '../components/ui/PrimaryAction';
import { Surface } from '../components/ui/Surface';
import { getDraft } from '../lib/draft';
import { preflightImage } from '../lib/preflight';
import { readAadhaar } from '../lib/aadhaar-ocr';
import { uploadDoc, saveDocuments, type DocType } from '../lib/upload-doc';

type Status = 'idle' | 'processing' | 'ready' | 'error';
interface TileState {
  status: Status;
  label: string;
  key?: string;
  masked?: string | null;
  name?: string | null;
}

const initial: TileState = { status: 'idle', label: '' };

export function Upload() {
  const navigate = useNavigate();
  const [renting, setRenting] = useState(false);
  const [photo, setPhoto] = useState<TileState>(initial);
  const [aadhaar, setAadhaar] = useState<TileState>(initial);
  const [address, setAddress] = useState<TileState>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getDraft().then((d) => {
      if (!d) {
        navigate('/eligibility');
        return;
      }
      setRenting(d.premises === 'rent');
    });
  }, [navigate]);

  const required = 2 + (renting ? 1 : 0);
  const ready = [photo, aadhaar, renting ? address : null].filter((t) => t?.status === 'ready').length;
  const allReady = photo.status === 'ready' && aadhaar.status === 'ready' && (!renting || address.status === 'ready');

  async function handlePhotoOrAddress(docType: Exclude<DocType, 'aadhaar'>, file: File, set: (s: TileState) => void) {
    set({ status: 'processing', label: 'Checking…' });
    try {
      const pre = await preflightImage(file);
      const key = await uploadDoc(docType, pre.blob, pre.contentType, pre.ext);
      set({ status: 'ready', label: pre.label, key });
    } catch (err) {
      if (err instanceof Error && err.message === 'unauthenticated') {
        navigate('/create-account');
        return;
      }
      set({ status: 'error', label: 'Something went wrong — try again.' });
    }
  }

  async function handleAadhaar(file: File) {
    // Aadhaar is processed ON THE DEVICE — the raw image is never uploaded.
    setAadhaar({ status: 'processing', label: 'Reading on your phone…' });
    try {
      const pre = await preflightImage(file);
      const read = await readAadhaar(pre.blob);
      setAadhaar({
        status: 'ready',
        label: read.maskedNumber
          ? `Read on your device · ${read.maskedNumber}`
          : 'Saved — we couldn’t read the number, add it next',
        masked: read.maskedNumber,
        name: read.name,
      });
    } catch {
      setAadhaar({ status: 'error', label: 'Couldn’t read that — try a clearer photo.' });
    }
  }

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const ok = await saveDocuments({
        photoKey: photo.key,
        addressProofKey: renting ? address.key : undefined,
        aadhaarMasked: aadhaar.masked ?? undefined,
        applicantName: aadhaar.name ?? undefined,
      });
      if (!ok) throw new Error('save failed');
      navigate('/confirm');
    } catch {
      setError('Couldn’t save — your uploads are safe, please try again.');
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <AppHeader title="Add your documents" onBack={() => navigate('/pay')} />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="flex items-center justify-between text-sm text-copy-muted">
          <span>Snap a photo of each — that’s it.</span>
          <span className="text-copy">
            {ready}/{required} ready
          </span>
        </div>

        <DocTile
          title="Your photo"
          hint="A clear selfie or a passport-size photo."
          accept="image/*"
          tile={photo}
          onFile={(f) => void handlePhotoOrAddress('photo', f, setPhoto)}
        />
        <DocTile
          title="Aadhaar"
          hint="Read on your device — the image never leaves your phone."
          accept="image/*"
          tile={aadhaar}
          onFile={(f) => void handleAadhaar(f)}
        />
        {renting && (
          <DocTile
            title="Address proof"
            hint="Rent agreement or a utility bill (you’re renting)."
            accept="image/*,application/pdf"
            tile={address}
            onFile={(f) => void handlePhotoOrAddress('address', f, setAddress)}
          />
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="mt-auto">
          <PrimaryAction type="button" disabled={!allReady || saving} onClick={submit}>
            {saving ? 'Saving…' : 'Continue'}
          </PrimaryAction>
        </div>
      </div>
    </AppShell>
  );
}

function DocTile({
  title,
  hint,
  accept,
  tile,
  onFile,
}: {
  title: string;
  hint: string;
  accept: string;
  tile: TileState;
  onFile: (f: File) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const done = tile.status === 'ready';
  return (
    <Surface className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-copy-muted">{hint}</p>
        </div>
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={tile.status === 'processing'}
          className="rounded-lg bg-app-raised px-3 py-1.5 text-sm text-copy ring-1 ring-line hover:bg-app disabled:opacity-50"
        >
          {done ? 'Retake' : tile.status === 'processing' ? '…' : 'Add'}
        </button>
      </div>
      {tile.label && (
        <p className={`text-xs ${tile.status === 'error' ? 'text-red-400' : done ? 'text-verified' : 'text-copy-muted'}`}>
          {done ? '✓ ' : ''}
          {tile.label}
        </p>
      )}
      <input
        ref={ref}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />
    </Surface>
  );
}
