import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';

const navigate = vi.fn();
vi.mock('react-router', () => ({ useNavigate: () => navigate }));

const getFilingStatus = vi.fn();
vi.mock('../lib/filing', () => ({ getFilingStatus: () => getFilingStatus() }));

const { FilingStatus } = await import('./FilingStatus');

const base = {
  businessName: 'Riya’s Kitchen',
  filedAt: '2026-09-02T10:00:00.000Z',
  approvedAt: null as string | null,
  fssaiNumber: null as string | null,
  certificateUrl: null as string | null,
};

describe('FilingStatus', () => {
  beforeEach(() => {
    navigate.mockReset();
    getFilingStatus.mockReset();
  });
  afterEach(() => cleanup());

  it('filed: truthfully explains the demo and lets the baker check until Ops approval appears', async () => {
    getFilingStatus
      .mockResolvedValueOnce({ ...base, status: 'filed' })
      .mockResolvedValueOnce({
        ...base,
        status: 'approved',
        approvedAt: '2026-09-09T10:00:00.000Z',
        fssaiNumber: '12345678901234',
        certificateUrl: '/api/storage/object?key=cert&exp=1&sig=abc',
      });
    render(<FilingStatus />);
    await waitFor(() => expect(screen.getByText(/application is under review/i)).toBeInTheDocument());
    expect(screen.getByText(/Under government review/i)).toBeInTheDocument();
    expect(screen.getByText(/no SMS or WhatsApp message is sent/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Check status/i }));
    await waitFor(() => expect(screen.getByText(/registration is live/i)).toBeInTheDocument());
    expect(getFilingStatus).toHaveBeenCalledTimes(2);
  });

  it('approved: shows the FSSAI number and certificate download', async () => {
    getFilingStatus.mockResolvedValue({
      ...base,
      status: 'approved',
      approvedAt: '2026-09-09T10:00:00.000Z',
      fssaiNumber: '12345678901234',
      certificateUrl: '/api/storage/object?key=cert&exp=1&sig=abc',
    });
    render(<FilingStatus />);
    await waitFor(() => expect(screen.getByText(/registration is live/i)).toBeInTheDocument());
    expect(screen.getByText('12345678901234')).toBeInTheDocument();
    expect(screen.getByText(/FSSAI certificate/i)).toBeInTheDocument();
  });

  it('redirects to /confirm when nothing has been filed yet', async () => {
    getFilingStatus.mockResolvedValue({ ...base, status: 'paid', filedAt: null });
    render(<FilingStatus />);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/confirm'));
  });
});
