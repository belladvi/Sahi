import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const navigate = vi.fn();
vi.mock('react-router', () => ({ useNavigate: () => navigate }));

const sendOtp = vi.fn();
const verify = vi.fn();
vi.mock('../lib/auth-client', () => ({
  authClient: {
    phoneNumber: { sendOtp, verify },
    emailOtp: { sendVerificationOtp: vi.fn() },
    signIn: { emailOtp: vi.fn() },
  },
}));
const claimDraft = vi.fn();
vi.mock('../lib/draft', () => ({ claimDraft: (...a: unknown[]) => claimDraft(...a) }));
const fetchDemoOtp = vi.fn();
vi.mock('../lib/demo-otp', () => ({ fetchDemoOtp: (...args: unknown[]) => fetchDemoOtp(...args) }));

// The contact step (<CreateAccountStep/>) uses motion; render it reduced-motion
// so entrance/cross-fade animations are static and deterministic under jsdom.
vi.mock('motion/react', async (importOriginal) => {
  const mod = await importOriginal<typeof import('motion/react')>();
  return { ...mod, useReducedMotion: () => true };
});

const { CreateAccount } = await import('./CreateAccount');

function renderScreen() {
  return render(<CreateAccount />);
}

const cellValue = () =>
  Array.from({ length: 6 }, (_, i) => (screen.getByLabelText(`Digit ${i + 1} of 6`) as HTMLInputElement).value).join(
    '',
  );

// Get from the contact step to a verifiable OTP step with the code pre-filled.
async function reachVerify() {
  sendOtp.mockResolvedValue({ error: null });
  fetchDemoOtp.mockResolvedValue('135790');
  verify.mockResolvedValue({ error: null });
  fireEvent.change(screen.getByPlaceholderText('98765 43210'), { target: { value: '9876543210' } });
  fireEvent.click(screen.getByRole('button', { name: /send code by sms/i }));
  await waitFor(() => expect(cellValue()).toBe('135790'));
}

describe('CreateAccount', () => {
  beforeEach(() => {
    sendOtp.mockReset();
    verify.mockReset();
    fetchDemoOtp.mockReset();
    claimDraft.mockReset();
    navigate.mockReset();
  });
  afterEach(() => cleanup());

  it('shows Mobile/Email tabs and a disabled Send-code button, and the no-pay reassurance', () => {
    renderScreen();
    expect(screen.getByRole('tab', { name: 'Mobile' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Email' })).toBeInTheDocument();
    expect(screen.getByText(/No payment yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send code by sms/i })).toBeDisabled();
  });

  it('switching to Email shows an email field', () => {
    renderScreen();
    fireEvent.click(screen.getByRole('tab', { name: 'Email' }));
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send code by email/i })).toBeInTheDocument();
  });

  it('a failed send surfaces the error on the contact step (no silent dead-tap)', async () => {
    sendOtp.mockResolvedValue({ error: { message: 'Could not send the code. Please try again.' } });
    renderScreen();
    fireEvent.change(screen.getByPlaceholderText('98765 43210'), { target: { value: '9876543210' } });
    fireEvent.click(screen.getByRole('button', { name: /send code by sms/i }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/could not send the code/i),
    );
    // stayed on the contact step — never advanced to the OTP/verify phase
    expect(screen.queryByRole('button', { name: /verify & continue to payment/i })).not.toBeInTheDocument();
  });

  it('sending a phone code advances to the OTP step', async () => {
    sendOtp.mockResolvedValue({ error: null });
    renderScreen();
    fireEvent.change(screen.getByPlaceholderText('98765 43210'), { target: { value: '9876543210' } });
    fireEvent.click(screen.getByRole('button', { name: /send code by sms/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /verify & continue to payment/i })).toBeInTheDocument(),
    );
    expect(sendOtp).toHaveBeenCalledWith({ phoneNumber: '+919876543210' });
  });

  it('demo mode: pre-fills the code and states nothing was sent (no false delivery claim)', async () => {
    sendOtp.mockResolvedValue({ error: null });
    fetchDemoOtp.mockResolvedValue('135790');
    renderScreen();
    fireEvent.change(screen.getByPlaceholderText('98765 43210'), { target: { value: '9898989898' } });
    fireEvent.click(screen.getByRole('button', { name: /send code by sms/i }));
    await waitFor(() => expect(cellValue()).toBe('135790'));
    // The "code pre-filled, nothing sent" banner is the honesty guard against a
    // false delivery claim.
    expect(screen.getByText(/code pre-filled, no SMS or email sent/i)).toBeInTheDocument();
  });

  it('after verify, routes to the server-derived next route from the claim (a fresh draft → Payment)', async () => {
    renderScreen();
    await reachVerify();
    claimDraft.mockResolvedValue({ ok: true, status: 'draft', nextRoute: '/pay' });
    fireEvent.click(screen.getByRole('button', { name: /verify & continue to payment/i }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/pay'));
  });

  it('a returning paid account resumes at Upload, NOT Payment (claim result is honoured)', async () => {
    renderScreen();
    await reachVerify();
    claimDraft.mockResolvedValue({ ok: true, status: 'paid', nextRoute: '/upload' });
    fireEvent.click(screen.getByRole('button', { name: /verify & continue to payment/i }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/upload'));
    expect(navigate).not.toHaveBeenCalledWith('/pay');
  });

  it('a wrong code surfaces the error (shake) and never navigates', async () => {
    renderScreen();
    await reachVerify();
    verify.mockResolvedValue({ error: { message: 'Invalid OTP' } });
    fireEvent.click(screen.getByRole('button', { name: /verify & continue to payment/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/invalid otp|wrong or expired/i));
    expect(navigate).not.toHaveBeenCalled();
    expect(claimDraft).not.toHaveBeenCalled();
  });

  it('a claim conflict never opens Payment — it shows recoverable copy instead', async () => {
    renderScreen();
    await reachVerify();
    claimDraft.mockResolvedValue({ ok: false, reason: 'conflict' });
    fireEvent.click(screen.getByRole('button', { name: /verify & continue to payment/i }));
    await waitFor(() => expect(screen.getByText(/couldn’t be continued|already/i)).toBeInTheDocument());
    expect(navigate).not.toHaveBeenCalledWith('/pay');
  });
});
