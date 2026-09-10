import { useState } from 'react';
import { useNavigate } from 'react-router';
import { AppShell } from '../components/AppShell';
import CreateAccountStep from '../features/auth/CreateAccountStep';
import VerifyCodeStep from '../features/auth/VerifyCodeStep';
import { authClient } from '../lib/auth-client';
import { claimDraft } from '../lib/draft';
import { normalizePhone } from '../lib/phone';
import { fetchDemoOtp } from '../lib/demo-otp';

type Method = 'phone' | 'email';
type Phase = 'contact' | 'code';

/** Human-readable destination for the verify screen — e.g. "+91 98765 43210". */
function formatDestination(method: Method, contact: string): string {
  if (method !== 'phone') return contact.trim();
  const digits = contact.replace(/\D/g, '');
  const local = digits.startsWith('91') ? digits.slice(2) : digits;
  const grouped = local.length === 10 ? `${local.slice(0, 5)} ${local.slice(5)}` : local;
  return `+91 ${grouped}`.trim();
}

export function CreateAccount() {
  const navigate = useNavigate();
  const [method, setMethod] = useState<Method>('phone');
  const [phase, setPhase] = useState<Phase>('contact');
  const [contact, setContact] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpFailed, setOtpFailed] = useState(false);

  // Contact entry lives in the premium <CreateAccountStep/>, which hands us the
  // chosen method + value via onSendCode (value is "+91XXXXXXXXXX" or an email).
  // `sendOtpFor` is also what the verify screen's Resend calls. The `busy` guard
  // drops repeat taps while a send is in flight (the step only fires onSendCode).
  async function sendOtpFor(m: Method, rawContact: string) {
    if (busy) return;
    setMethod(m);
    setContact(rawContact);
    setBusy(true);
    setError(null);
    setOtpFailed(false);
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
      // so the allowlisted code is fetched here and pre-filled on the verify
      // screen (VerifyCodeStep shows a "code pre-filled, nothing sent" banner).
      const demo = await fetchDemoOtp(m === 'phone' ? normalizePhone(rawContact) : rawContact.trim());
      if (demo) setCode(demo);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  // Verify runs two required round-trips: Better Auth verify (mints the session)
  // then claimDraft (attaches the anonymous draft and returns the ACTUAL next
  // route — never open Payment blindly). VerifyCodeStep shows an instant
  // "Verifying…" state while this promise is in flight, so the tap never feels
  // dead; navigation on success unmounts this screen.
  async function verify(otp: string) {
    setError(null);
    setOtpFailed(false);
    try {
      const res =
        method === 'phone'
          ? await authClient.phoneNumber.verify({ phoneNumber: normalizePhone(contact), code: otp })
          : await authClient.signIn.emailOtp({ email: contact.trim(), otp });
      if (res.error) {
        setOtpFailed(true);
        setError(res.error.message ?? 'That code was wrong or expired. Send a new one.');
        return;
      }
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
      <VerifyCodeStep
        destination={formatDestination(method, contact)}
        error={otpFailed}
        errorMessage={error}
        // Never demo-mode in a production build; the real server demo code (when
        // present) is passed via prefillCode and still shows the banner.
        demo={import.meta.env.DEV}
        prefillCode={code}
        onChangeContact={() => setPhase('contact')}
        onResend={() => sendOtpFor(method, contact)}
        onVerify={(c) => verify(c)}
        onBack={() => setPhase('contact')}
      />
    </AppShell>
  );
}
