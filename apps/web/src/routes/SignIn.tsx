import { useState } from 'react';
import { useNavigate } from 'react-router';
import { AppShell } from '../components/AppShell';
import { AppHeader } from '../components/AppHeader';
import { PrimaryAction } from '../components/ui/PrimaryAction';
import { authClient } from '../lib/auth-client';
import { accountExists } from '../lib/account';
import { normalizePhone } from '../lib/phone';

type Method = 'phone' | 'email';
type Phase = 'contact' | 'code';

export function SignIn() {
  const navigate = useNavigate();
  const [method, setMethod] = useState<Method>('phone');
  const [phase, setPhase] = useState<Phase>('contact');
  const [contact, setContact] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const value = () => (method === 'phone' ? normalizePhone(contact) : contact.trim());
  const contactValid =
    method === 'phone'
      ? contact.replace(/\D/g, '').length >= 10
      : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.trim());

  async function sendCode() {
    setBusy(true);
    setError(null);
    setNotFound(false);
    try {
      // Gate: don't send an OTP (and silently auto-create) to an unknown contact.
      const exists = await accountExists({ method, contact: value() });
      if (!exists) {
        setNotFound(true);
        return;
      }
      const res =
        method === 'phone'
          ? await authClient.phoneNumber.sendOtp({ phoneNumber: value() })
          : await authClient.emailOtp.sendVerificationOtp({ email: value(), type: 'sign-in' });
      if (res.error) {
        setError(res.error.message ?? 'Could not send the code. Please try again.');
        return;
      }
      setCode('');
      setPhase('code');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const res =
        method === 'phone'
          ? await authClient.phoneNumber.verify({ phoneNumber: value(), code })
          : await authClient.signIn.emailOtp({ email: value(), otp: code });
      if (res.error) {
        setError(res.error.message ?? 'That code was wrong or expired. Send a new one.');
        return;
      }
      navigate('/dashboard');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <AppHeader
        title="Welcome back"
        onBack={() => (phase === 'code' ? setPhase('contact') : navigate('/'))}
      />
      <div className="flex flex-1 flex-col gap-5 p-6">
        {phase === 'contact' ? (
          <>
            <p className="text-sm text-copy-muted">
              Welcome back. Pop in your number and we’ll text you a code. No password needed — we’ll
              verify this sign-in with a one-time code.
            </p>

            <div className="flex rounded-xl bg-app-raised p-1 ring-1 ring-line">
              {(['phone', 'email'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMethod(m);
                    setError(null);
                    setNotFound(false);
                  }}
                  className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                    method === m ? 'bg-action text-action-foreground' : 'text-copy-muted'
                  }`}
                >
                  {m === 'phone' ? 'Mobile' : 'Email'}
                </button>
              ))}
            </div>

            {method === 'phone' ? (
              <label className="space-y-1.5">
                <span className="text-sm text-copy-muted">Mobile number</span>
                <div className="flex items-center gap-2 rounded-xl bg-app-raised px-3 py-2.5 ring-1 ring-line focus-within:ring-action">
                  <span className="text-copy-muted">+91</span>
                  <input
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="98765 43210"
                    className="w-full bg-transparent text-copy outline-none placeholder:text-copy-muted"
                  />
                </div>
              </label>
            ) : (
              <label className="space-y-1.5">
                <span className="text-sm text-copy-muted">Email address</span>
                <input
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="w-full rounded-xl bg-app-raised px-3 py-2.5 text-copy ring-1 ring-line outline-none placeholder:text-copy-muted focus:ring-action"
                />
              </label>
            )}

            {notFound && (
              <div className="space-y-2 rounded-xl bg-app-raised p-4 ring-1 ring-line">
                <p className="text-sm text-copy">We couldn’t find an account for that {method === 'phone' ? 'number' : 'email'}.</p>
                <PrimaryAction type="button" variant="ghost" onClick={() => navigate('/eligibility')}>
                  New here? Check eligibility
                </PrimaryAction>
              </div>
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="mt-auto space-y-3">
              <PrimaryAction type="button" disabled={busy || !contactValid} onClick={sendCode}>
                {busy ? 'Checking…' : `Send code by ${method === 'phone' ? 'SMS' : 'email'}`}
              </PrimaryAction>
              <button
                type="button"
                onClick={() => navigate('/eligibility')}
                className="w-full text-center text-sm text-copy-muted hover:text-copy"
              >
                New here? <span className="text-action">Check eligibility</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-copy-muted">
              We sent a 6-digit code to <span className="text-copy">{value()}</span>. Enter it below.
            </p>

            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="••••••"
              aria-label="6-digit code"
              className="w-full rounded-xl bg-app-raised py-4 text-center text-2xl font-semibold tracking-[0.6em] text-copy ring-1 ring-line outline-none placeholder:text-copy-muted focus:ring-action"
            />

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="button"
              disabled={busy}
              onClick={sendCode}
              className="text-left text-sm text-copy-muted hover:text-copy disabled:opacity-50"
            >
              Didn’t get it? <span className="text-action">Resend code</span>
            </button>

            <div className="mt-auto">
              <PrimaryAction type="button" disabled={busy || code.length !== 6} onClick={verify}>
                {busy ? 'Verifying…' : 'Verify & sign in'}
              </PrimaryAction>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
