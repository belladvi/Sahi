import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PrimaryAction } from './PrimaryAction';

describe('PrimaryAction', () => {
  it('renders its label and fires onClick', async () => {
    const onClick = vi.fn();
    render(<PrimaryAction onClick={onClick}>Continue</PrimaryAction>);
    const btn = screen.getByRole('button', { name: 'Continue' });
    expect(btn).toBeInTheDocument();
    btn.click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('is disabled when disabled prop is set', () => {
    render(<PrimaryAction disabled>Nope</PrimaryAction>);
    expect(screen.getByRole('button', { name: 'Nope' })).toBeDisabled();
  });

  it('marks a busy state (aria-busy + disabled) while keeping its label readable', () => {
    render(<PrimaryAction loading>Checking status…</PrimaryAction>);
    const btn = screen.getByRole('button', { name: /Checking status/ });
    expect(btn).toHaveAttribute('aria-busy', 'true');
    // Busy blocks re-entry so a double-tap can't fire the action twice.
    expect(btn).toBeDisabled();
  });

  it('is not busy by default', () => {
    render(<PrimaryAction>Go</PrimaryAction>);
    expect(screen.getByRole('button', { name: 'Go' })).toHaveAttribute('aria-busy', 'false');
  });
});
