import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { AppShell } from '../components/AppShell';
import { AppHeader } from '../components/AppHeader';
import { Surface } from '../components/ui/Surface';
import { PrimaryAction } from '../components/ui/PrimaryAction';
import { getConfirmView, fileFormA } from '../lib/confirm';

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-copy-muted">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl bg-app-raised px-3 py-2.5 text-copy ring-1 ring-line outline-none placeholder:text-copy-muted focus:ring-action"
      />
    </label>
  );
}

export function Confirm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [products, setProducts] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [business, setBusiness] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [hygiene, setHygiene] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const view = await getConfirmView();
      if (!alive) return;
      if (!view) {
        setNeedsAuth(true);
        setLoading(false);
        return;
      }
      setProducts(view.products);
      setName(view.applicantName ?? '');
      setBusiness(view.businessName ?? '');
      setAddress(view.residentialAddress ?? '');
      setPhone(view.phone ?? '');
      setEmail(view.email ?? '');
      // Hygiene declaration defaults to checked (as the mockup), but she must
      // keep it ticked to file — it's her legal self-declaration.
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const canFile =
    name.trim() && business.trim() && address.trim() && phone.trim().length >= 8 && hygiene;

  async function file() {
    setBusy(true);
    setError(null);
    try {
      const res = await fileFormA({
        applicantName: name.trim(),
        businessName: business.trim(),
        residentialAddress: address.trim(),
        phone: phone.trim(),
        email: email.trim(),
        hygieneAccepted: true,
      });
      if (!res.ok) {
        setError(res.error ?? 'Could not file. Please try again.');
        return;
      }
      navigate('/status');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <AppHeader title="Confirm details" onBack={() => navigate('/upload')} />
      <div className="flex flex-1 flex-col gap-5 p-6">
        {loading ? (
          <p className="text-sm text-copy-muted">Loading your details…</p>
        ) : needsAuth ? (
          <>
            <p className="text-sm text-copy-muted">Please sign in to confirm and file your details.</p>
            <div className="mt-auto">
              <PrimaryAction type="button" onClick={() => navigate('/sign-in')}>
                Sign in
              </PrimaryAction>
            </div>
          </>
        ) : (
          <>
            <div>
              <h1 className="text-2xl font-bold leading-tight">Check what we’ll file</h1>
              <p className="mt-2 text-sm leading-relaxed text-copy-muted">
                We read most of this from your documents. Check it’s right before we file — you
                won’t be able to change it after.
              </p>
            </div>

            {products.length > 0 && (
              <Surface>
                <p className="text-sm text-copy-muted">You make</p>
                <p className="mt-1 text-sm font-semibold text-copy">
                  {products.join(', ')}
                </p>
              </Surface>
            )}

            <Field label="Your name" value={name} onChange={setName} placeholder="Priya Rao" />
            <Field
              label="Business name"
              value={business}
              onChange={setBusiness}
              placeholder="Priya’s Kitchen"
            />
            <Field
              label="Business address"
              value={address}
              onChange={setAddress}
              placeholder="House no, street, area, city, PIN"
            />
            <Field
              label="Phone number"
              value={phone}
              onChange={setPhone}
              type="tel"
              placeholder="98765 43210"
            />
            <Field
              label="Email (optional)"
              value={email}
              onChange={setEmail}
              type="email"
              placeholder="you@example.com"
            />

            <label className="flex items-start gap-3 rounded-2xl bg-app-raised p-4 text-sm leading-relaxed text-copy ring-1 ring-line">
              <input
                type="checkbox"
                checked={hygiene}
                onChange={(e) => setHygiene(e.target.checked)}
                className="mt-0.5 size-5 shrink-0 accent-[var(--color-action)]"
              />
              <span>
                I confirm I’ll follow basic food hygiene and safety practices in my kitchen.
              </span>
            </label>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="mt-auto">
              <PrimaryAction type="button" disabled={busy || !canFile} onClick={file}>
                {busy ? 'Filing…' : 'Yes, this is right — file it'}
              </PrimaryAction>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
