import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';

// Reduced motion: pop/wave/shake/CTA effects render static; the input logic
// (auto-advance, backspace, paste, CTA gate, onVerify payload) must still work.
vi.mock('motion/react', async (importOriginal) => {
  const mod = await importOriginal<typeof import('motion/react')>();
  return { ...mod, useReducedMotion: () => true };
});

const { default: VerifyCodeStep } = await import('./VerifyCodeStep');

const cell = (i: number) => screen.getByLabelText(`Digit ${i} of 6`) as HTMLInputElement;
const cta = () => screen.getByRole('button', { name: /verify & continue to payment/i });

describe('VerifyCodeStep (reduced motion)', () => {
  afterEach(() => cleanup());

  it('shows the destination and a disabled CTA until six digits are entered', () => {
    render(<VerifyCodeStep destination="+91 98765 43210" />);
    expect(screen.getByText('+91 98765 43210')).toBeInTheDocument();
    expect(cta()).toBeDisabled();
  });

  it('typing a digit auto-advances focus to the next cell', () => {
    render(<VerifyCodeStep destination="you@example.com" />);
    fireEvent.change(cell(1), { target: { value: '4' } });
    expect(cell(1)).toHaveValue('4');
    expect(document.activeElement).toBe(cell(2));
  });

  it('Backspace on an empty cell steps focus back', () => {
    render(<VerifyCodeStep destination="you@example.com" />);
    cell(2).focus();
    fireEvent.keyDown(cell(2), { key: 'Backspace' });
    expect(document.activeElement).toBe(cell(1));
  });

  it('paste fills all six cells and enables the CTA', () => {
    const onVerify = vi.fn();
    render(<VerifyCodeStep destination="you@example.com" onVerify={onVerify} />);
    fireEvent.paste(cell(1), { clipboardData: { getData: () => '135790' } });
    expect(cell(1)).toHaveValue('1');
    expect(cell(6)).toHaveValue('0');
    expect(cta()).toBeEnabled();
  });

  it('OS one-time-code autofill (multi-char into one cell) spreads across cells', () => {
    render(<VerifyCodeStep destination="you@example.com" />);
    fireEvent.change(cell(1), { target: { value: '246810' } });
    expect(cell(1)).toHaveValue('2');
    expect(cell(6)).toHaveValue('0');
  });

  it('a full code calls onVerify with the six-digit string', async () => {
    const onVerify = vi.fn().mockResolvedValue(undefined);
    render(<VerifyCodeStep destination="+91 98765 43210" onVerify={onVerify} />);
    fireEvent.paste(cell(1), { clipboardData: { getData: () => '135790' } });
    fireEvent.click(cta());
    await waitFor(() => expect(onVerify).toHaveBeenCalledWith('135790'));
  });

  it('prefillCode fills the cells and shows the demo-mode banner', () => {
    render(<VerifyCodeStep destination="+91 98765 43210" prefillCode="112233" />);
    expect(cell(1)).toHaveValue('1');
    expect(cell(6)).toHaveValue('3');
    expect(screen.getByText(/code pre-filled, no SMS or email sent/i)).toBeInTheDocument();
    expect(cta()).toBeEnabled();
  });

  it('shows the error message on a wrong code', () => {
    render(<VerifyCodeStep destination="+91 98765 43210" error errorMessage="That code was wrong or expired." />);
    expect(screen.getByRole('alert')).toHaveTextContent(/wrong or expired/i);
  });

  it('the resend timer counts down then enables Resend', async () => {
    vi.useFakeTimers();
    const onResend = vi.fn();
    try {
      render(<VerifyCodeStep destination="+91 98765 43210" onResend={onResend} />);
      expect(screen.getByText(/Resend code in 0:30/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Resend code$/i })).not.toBeInTheDocument();
      // Advance one second at a time so React commits each tick (the effect
      // reschedules the next timeout only after a state commit).
      for (let i = 0; i < 30; i++) {
        act(() => {
          vi.advanceTimersByTime(1000);
        });
      }
      const resend = screen.getByRole('button', { name: /^Resend code$/i });
      fireEvent.click(resend);
      expect(onResend).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
