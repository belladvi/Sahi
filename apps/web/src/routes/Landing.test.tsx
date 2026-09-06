import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

const navigate = vi.fn();
vi.mock('react-router', () => ({ useNavigate: () => navigate }));

const { Landing } = await import('./Landing');

describe('Landing — Sahi hero', () => {
  beforeEach(() => navigate.mockReset());
  afterEach(() => cleanup());

  it('renders the hero heading and the government-authorised eyebrow', () => {
    render(<Landing />);
    expect(screen.getByRole('heading', { name: /Your FSSAI licence/i })).toBeInTheDocument();
    expect(screen.getByText(/Government-authorised process/i)).toBeInTheDocument();
  });

  it('the primary CTA opens the eligibility flow', () => {
    render(<Landing />);
    screen.getByRole('button', { name: /Check if you qualify/i }).click();
    expect(navigate).toHaveBeenCalledWith('/eligibility');
  });

  it('Sign in routes to /sign-in (not /signin)', () => {
    render(<Landing />);
    screen.getByRole('button', { name: /^Sign in$/i }).click();
    expect(navigate).toHaveBeenCalledWith('/sign-in');
  });
});
