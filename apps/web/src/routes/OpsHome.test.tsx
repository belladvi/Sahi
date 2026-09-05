import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, within } from '@testing-library/react';

const navigate = vi.fn();
vi.mock('react-router', () => ({ useNavigate: () => navigate }));

const getOpsQueue = vi.fn();
vi.mock('../lib/ops', () => ({ getOpsQueue: (s?: string) => getOpsQueue(s) }));

const { OpsHome } = await import('./OpsHome');

describe('OpsHome', () => {
  beforeEach(() => {
    navigate.mockReset();
    getOpsQueue.mockReset();
  });
  afterEach(() => cleanup());

  it('renders queued applications with their status', async () => {
    getOpsQueue.mockResolvedValue([
      { id: 'app1', status: 'preparing', businessName: 'Riya’s Kitchen', applicantName: 'Riya', products: ['cakes'], premises: 'own', filedAt: null, createdAt: '2026-09-01T00:00:00.000Z' },
    ]);
    render(<OpsHome />);
    await waitFor(() => expect(screen.getByText('Riya’s Kitchen')).toBeInTheDocument());
    // The row itself carries a "To file" status badge (also a filter chip exists).
    const row = screen.getByText('Riya’s Kitchen').closest('button') as HTMLElement;
    expect(within(row).getByText('To file')).toBeInTheDocument();
  });

  it('shows an empty state when the queue is clear', async () => {
    getOpsQueue.mockResolvedValue([]);
    render(<OpsHome />);
    await waitFor(() => expect(screen.getByText(/Nothing in this queue/i)).toBeInTheDocument());
  });
});
