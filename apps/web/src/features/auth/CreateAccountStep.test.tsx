import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// Reduced motion: the toggle, cross-fades and CTA effects render static, and the
// form must still work (validity gate + onSendCode payload) with no animation.
vi.mock('motion/react', async (importOriginal) => {
  const mod = await importOriginal<typeof import('motion/react')>();
  return { ...mod, useReducedMotion: () => true };
});

const { default: CreateAccountStep } = await import('./CreateAccountStep');

describe('CreateAccountStep (reduced motion)', () => {
  afterEach(() => cleanup());

  it('defaults to Mobile: +91 prefix, disabled SMS CTA until 10 digits', () => {
    render(<CreateAccountStep />);
    expect(screen.getByRole('tab', { name: 'Mobile' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('+91')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send code by sms/i })).toBeDisabled();
  });

  it('Send code by SMS enables only at 10 digits and emits +91XXXXXXXXXX', () => {
    const onSendCode = vi.fn();
    render(<CreateAccountStep onSendCode={onSendCode} />);
    const input = screen.getByPlaceholderText('98765 43210');
    const cta = () => screen.getByRole('button', { name: /send code by sms/i });

    fireEvent.change(input, { target: { value: '987654321' } }); // 9 digits
    expect(cta()).toBeDisabled();
    fireEvent.click(cta());
    expect(onSendCode).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '9876543210' } }); // 10 digits
    expect(cta()).toBeEnabled();
    fireEvent.click(cta());
    expect(onSendCode).toHaveBeenCalledWith({ method: 'mobile', value: '+919876543210' });
  });

  it('switching to Email swaps copy/CTA and gates on a valid email', () => {
    const onSendCode = vi.fn();
    render(<CreateAccountStep onSendCode={onSendCode} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Email' }));

    const input = screen.getByPlaceholderText('you@example.com');
    const cta = () => screen.getByRole('button', { name: /send code by email/i });

    fireEvent.change(input, { target: { value: 'not-an-email' } });
    expect(cta()).toBeDisabled();

    fireEvent.change(input, { target: { value: 'baker@example.com' } });
    expect(cta()).toBeEnabled();
    fireEvent.click(cta());
    expect(onSendCode).toHaveBeenCalledWith({ method: 'email', value: 'baker@example.com' });
  });

  it('pending: CTA shows "Sending…", is disabled/aria-busy, and cannot re-fire', () => {
    const onSendCode = vi.fn();
    render(<CreateAccountStep pending onSendCode={onSendCode} />);
    const cta = screen.getByRole('button', { name: /sending…/i });
    expect(cta).toBeDisabled();
    expect(cta).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(cta);
    expect(onSendCode).not.toHaveBeenCalled();
  });

  it('surfaces a send error under the CTA', () => {
    render(<CreateAccountStep error="Could not send the code. Please try again." />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/could not send the code/i);
  });

  it('wires Back and Sign in callbacks', () => {
    const onBack = vi.fn();
    const onSignIn = vi.fn();
    render(<CreateAccountStep onBack={onBack} onSignIn={onSignIn} />);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(onBack).toHaveBeenCalledOnce();
    expect(onSignIn).toHaveBeenCalledOnce();
  });
});
