import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';

const navigate = vi.fn();
vi.mock('react-router', () => ({ useNavigate: () => navigate }));

const getFilingStatus = vi.fn();
vi.mock('../lib/filing', () => ({ getFilingStatus: () => getFilingStatus() }));

const getMyNotification = vi.fn();
vi.mock('../lib/notifications', () => ({ getMyNotification: () => getMyNotification() }));

const { Dashboard } = await import('./Dashboard');

const approved = {
  status: 'approved' as const,
  businessName: 'Riya’s Kitchen',
  filedAt: '2026-09-02T10:00:00.000Z',
  approvedAt: '2026-09-09T10:00:00.000Z',
  fssaiNumber: '12345678901234',
  certificateUrl: '/api/storage/object?key=cert&exp=1&sig=abc',
  verifyToken: 'tok123',
};

describe('Dashboard', () => {
  beforeEach(() => {
    navigate.mockReset();
    getFilingStatus.mockReset();
    getMyNotification.mockReset();
    // Default: no notification (feature off or none yet) → link hidden.
    getMyNotification.mockResolvedValue({ kind: 'missing' });
  });
  afterEach(() => cleanup());

  it('shows the live credential + action tiles for a licensed baker', async () => {
    getFilingStatus.mockResolvedValue(approved);
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByText(/You’re verified/i)).toBeInTheDocument());
    expect(screen.getByText('12345678901234')).toBeInTheDocument();
    expect(screen.getByText('Verified badge')).toBeInTheDocument();
    expect(screen.getByText('QR code')).toBeInTheDocument();
  });

  it('redirects a not-yet-approved baker to /status', async () => {
    getFilingStatus.mockResolvedValue({ ...approved, status: 'preparing', fssaiNumber: null, verifyToken: null, certificateUrl: null });
    render(<Dashboard />);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/status'));
  });

  it('shows "View message preview" only when a demo notification exists', async () => {
    getFilingStatus.mockResolvedValue(approved);
    getMyNotification.mockResolvedValue({ kind: 'ok', view: { status: 'sent' } });
    render(<Dashboard />);
    const link = await screen.findByText('View message preview');
    expect(link).toBeInTheDocument();
    link.closest('button')!.click();
    expect(navigate).toHaveBeenCalledWith('/notification');
  });

  it('hides "View message preview" when no notification exists (off / pre-approval)', async () => {
    getFilingStatus.mockResolvedValue(approved);
    getMyNotification.mockResolvedValue({ kind: 'missing' });
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByText(/You’re verified/i)).toBeInTheDocument());
    expect(screen.queryByText('View message preview')).not.toBeInTheDocument();
  });
});
