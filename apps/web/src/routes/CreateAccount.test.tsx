import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';

const sendOtp = vi.fn();
const verify = vi.fn();
vi.mock('../lib/auth-client', () => ({
  authClient: {
    phoneNumber: { sendOtp, verify },
    emailOtp: { sendVerificationOtp: vi.fn() },
    signIn: { emailOtp: vi.fn() },
  },
}));
vi.mock('../lib/draft', () => ({ claimDraft: vi.fn().mockResolvedValue(true) }));

const { CreateAccount } = await import('./CreateAccount');

function renderScreen() {
  const router = createMemoryRouter(
    [
      { path: '/create-account', element: <CreateAccount /> },
      { path: '/pay', element: <div>Pay screen</div> },
      { path: '/sign-in', element: <div>Sign in screen</div> },
    ],
    { initialEntries: ['/create-account'] },
  );
  return render(<RouterProvider router={router} />);
}

describe('CreateAccount', () => {
  beforeEach(() => {
    sendOtp.mockReset();
    verify.mockReset();
  });
  afterEach(() => cleanup());

  it('shows Mobile/Email tabs and a disabled Send-code button, and the no-pay reassurance', () => {
    renderScreen();
    expect(screen.getByRole('button', { name: 'Mobile' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Email' })).toBeInTheDocument();
    expect(screen.getByText(/still haven’t paid anything/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send code by sms/i })).toBeDisabled();
  });

  it('switching to Email shows an email field', () => {
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'Email' }));
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send code by email/i })).toBeInTheDocument();
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
});
