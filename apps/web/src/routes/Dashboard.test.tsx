import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';

const navigate = vi.fn();
vi.mock('react-router', () => ({ useNavigate: () => navigate }));

const getFilingStatus = vi.fn();
vi.mock('../lib/filing', () => ({ getFilingStatus: () => getFilingStatus() }));

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
});
