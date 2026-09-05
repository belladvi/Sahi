import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';

const navigate = vi.fn();
vi.mock('react-router', () => ({ useNavigate: () => navigate }));

const getRenewal = vi.fn();
const renew = vi.fn();
vi.mock('../lib/renewal', () => ({ getRenewal: () => getRenewal(), renew: () => renew() }));

const { Renewal } = await import('./Renewal');

const perpetual = {
  cohort: 'perpetual' as const,
  dueDate: '2027-09-05T00:00:00.000Z',
  daysUntilDue: 200,
  state: 'active' as const,
  govFee: 100,
  serviceFee: 299,
  total: 399,
};

describe('Renewal', () => {
  beforeEach(() => {
    navigate.mockReset();
    getRenewal.mockReset();
    renew.mockReset();
  });
  afterEach(() => cleanup());

  it('shows perpetual cohort copy + ₹399 breakdown + due date', async () => {
    getRenewal.mockResolvedValue(perpetual);
    render(<Renewal />);
    await waitFor(() => expect(screen.getByText(/Your licence is perpetual/i)).toBeInTheDocument());
    expect(screen.getByText('₹100')).toBeInTheDocument();
    expect(screen.getByText('₹299')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pay ₹399 & stay active/i })).toBeInTheDocument();
  });

  it('renewing updates the button to the all-set state', async () => {
    getRenewal.mockResolvedValue({ ...perpetual, state: 'due-soon', daysUntilDue: 12 });
    renew.mockResolvedValue({ ok: true, renewed: true, view: perpetual });
    render(<Renewal />);
    await waitFor(() => expect(screen.getByText(/Due in 12 days/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Pay ₹399/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /You’re all set/i })).toBeInTheDocument());
  });

  it('redirects to /status without an active licence', async () => {
    getRenewal.mockResolvedValue(null);
    render(<Renewal />);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/status'));
  });
});
