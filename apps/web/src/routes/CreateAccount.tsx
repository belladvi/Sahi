import { useState } from 'react';
import { useNavigate } from 'react-router';
import { AppShell } from '../components/AppShell';
import { AppHeader } from '../components/AppHeader';
import { PrimaryAction } from '../components/ui/PrimaryAction';
import CreateAccountStep from '../features/auth/CreateAccountStep';
import { authClient } from '../lib/auth-client';
import { claimDraft } from '../lib/draft';
import { normalizePhone } from '../lib/phone';
import { fetchDemoOtp } from '../lib/demo-otp';

type Method = 'phone' | 'email';
type Phase = 'contact' | 'code';

export function CreateAccount() {
  const navigate = useNavigate();
  const [method, setMethod] = useState<Method>('phone');
  const [phase, setPhase] = useState<Phase>('contact');
  const [contact, setContact] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoNote, setDemoNote] = useState<string | null>(null);

  // Contact entry lives in the premium <CreateAccountStep/>, which hands us the
  // chosen method + value via onSendCode (value is "+91XXXXXXXXXX" or an email).
  // The OTP send, demo auto-fill, verify and draft-claim below are unchanged;
  // `sendOtpFor` is also what the code phase's Resend calls. The `busy` guard
  // drops repeat taps while a send is in flight (the step only fires onSendCode).
  async function sendOtpFor(m: Method, rawContact: string) {
    if (busy) return;
    setMethod(m);
    setContact(rawContact);
    setBusy(true);
    setError(null);
    try {
      const res =
        m === 'phone'
          ? await authClient.phoneNumber.sendOtp({ phoneNumber: normalizePhone(rawContact) })
          : await authClient.emailOtp.sendVerificationOtp({ email: rawContact.trim(), type: 'sign-in' });
      if (res.error) {
        setError(res.error.message ?? 'Could not send the code. Please try again.');
        return;
      }
      setCode('');
      setPhase('code');
      // Demo mode: the case-study demo contacts have no real SMS/email delivery,
      // so the allowlisted code is auto-filled here. Nothing is actually sent.
      const demo = await fetchDemoOtp(m === 'phone' ? normalizePhone(rawContact) : rawContact.trim());
      if (demo) {
        setCode(demo);
        setDemoNote('Demo code filled in — no SMS or email was sent.');
      }
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
          ? await authClient.phoneNumber.verify({ phoneNumber: normalizePhone(contact), code })
          : await authClient.signIn.emailOtp({ email: contact.trim(), otp: code });
      if (res.error) {
        setError(res.error.message ?? 'That code was wrong or expired. Send a new one.');
        return;
      }
      // Session established — carry the anonymous draft over and route by its
      // ACTUAL state. Never open Payment blindly: a fresh draft goes to /pay, a
      // paid/later application resumes at its own route, a conflict stays put.
      const claim = await claimDraft();
      if (claim.ok) {
        navigate(claim.nextRoute);
        return;
      }
      if (claim.reason === 'conflict') {
        setError(
          'This registration couldn’t be continued — it may already be paid or in progress. Sign in to see its status.',
        );
        return;
      }
      if (claim.reason === 'no-token') {
        navigate('/pay');
        return;
      }
      setError('Network error. Please try again.');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (phase === 'contact') {
    return (
      <AppShell>
        <CreateAccountStep
          initialMethod={method === 'phone' ? 'mobile' : 'email'}
          pending={busy}
          error={error}
          onBack={() => navigate(-1)}
          onSendCode={({ method: m, value }) => sendOtpFor(m === 'mobile' ? 'phone' : 'email', value)}
          onSignIn={() => navigate('/sign-in')}
          // No /terms or /privacy routes exist yet (spec: don't touch the router);
          // no-op until real pages are built, rather than dead-ending on the 404.
          onTerms={() => {}}
          onPrivacy={() => {}}
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <AppHeader title="Create your account" onBack={() => setPhase('contact')} />
      <div className="flex flex-1 flex-col gap-5 p-6">
        {demoNote ? (
          <p className="text-sm text-copy-muted">Enter the 6-digit code below.</p>
        ) : (
          <p className="text-sm text-copy-muted">
            We sent a 6-digit code to{' '}
            <span className="text-copy">
              {method === 'phone' ? normalizePhone(contact) : contact.trim()}
            </span>
            . Enter it below.
          </p>
        )}

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

        {demoNote && (
          <p className="rounded-lg bg-app-raised px-3 py-2 text-xs text-copy-muted ring-1 ring-line">
            {demoNote}
          </p>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="button"
          disabled={busy}
          onClick={() => sendOtpFor(method, contact)}
          className="text-left text-sm text-copy-muted hover:text-copy disabled:opacity-50"
        >
          Didn’t get it? <span className="text-action">Resend code</span>
        </button>

        <div className="mt-auto">
          <PrimaryAction type="button" disabled={busy || code.length !== 6} onClick={verify}>
            {busy ? 'Verifying…' : 'Verify & continue to payment'}
          </PrimaryAction>
        </div>
      </div>
    </AppShell>
  );
}
