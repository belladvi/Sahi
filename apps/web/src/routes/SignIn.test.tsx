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
const accountExists = vi.fn();
vi.mock('../lib/account', () => ({ accountExists: (...args: unknown[]) => accountExists(...args) }));

const { SignIn } = await import('./SignIn');

function renderScreen() {
  const router = createMemoryRouter(
    [
      { path: '/sign-in', element: <SignIn /> },
      { path: '/dashboard', element: <div>Dashboard</div> },
      { path: '/eligibility', element: <div>Eligibility</div> },
    ],
    { initialEntries: ['/sign-in'] },
  );
  return render(<RouterProvider router={router} />);
}

describe('SignIn', () => {
  beforeEach(() => {
    sendOtp.mockReset();
    verify.mockReset();
    accountExists.mockReset();
  });
  afterEach(() => cleanup());

  it('shows the no-password copy and the "New here?" funnel link', () => {
    renderScreen();
    expect(screen.getByText(/no password needed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new here\? check eligibility/i })).toBeInTheDocument();
  });

  it('known contact → sends OTP and advances to the code step', async () => {
    accountExists.mockResolvedValue(true);
    sendOtp.mockResolvedValue({ error: null });
    renderScreen();
    fireEvent.change(screen.getByPlaceholderText('98765 43210'), { target: { value: '9812345678' } });
    fireEvent.click(screen.getByRole('button', { name: /send code by sms/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /verify & sign in/i })).toBeInTheDocument(),
    );
    expect(accountExists).toHaveBeenCalledWith({ method: 'phone', contact: '+919812345678' });
    expect(sendOtp).toHaveBeenCalledWith({ phoneNumber: '+919812345678' });
  });

  it('unknown contact → offers to create an account, sends no OTP', async () => {
    accountExists.mockResolvedValue(false);
    renderScreen();
    fireEvent.change(screen.getByPlaceholderText('98765 43210'), { target: { value: '9800000000' } });
    fireEvent.click(screen.getByRole('button', { name: /send code by sms/i }));
    await waitFor(() => expect(screen.getByText(/couldn’t find an account/i)).toBeInTheDocument());
    expect(sendOtp).not.toHaveBeenCalled();
  });
});
