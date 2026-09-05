import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';

const navigate = vi.fn();
vi.mock('react-router', () => ({ useNavigate: () => navigate }));

const getFilingStatus = vi.fn();
vi.mock('../lib/filing', () => ({ getFilingStatus: () => getFilingStatus() }));

vi.mock('../lib/qr', () => ({
  renderQrDataUrl: vi.fn(async () => 'data:image/png;base64,AAAA'),
  verifyUrl: (t: string) => `https://sahi.example/verify/${t}`,
}));

const { Qr } = await import('./Qr');

const approved = { status: 'approved', businessName: 'Riya’s Kitchen', filedAt: null, approvedAt: null, fssaiNumber: '12345678901234', certificateUrl: null, verifyToken: 'tok123' };

describe('Qr', () => {
  beforeEach(() => {
    navigate.mockReset();
    getFilingStatus.mockReset();
  });
  afterEach(() => cleanup());

  it('renders the generated QR image for a licensed baker', async () => {
    getFilingStatus.mockResolvedValue(approved);
    render(<Qr />);
    await waitFor(() => {
      const img = screen.getByAltText(/QR code/i) as HTMLImageElement;
      expect(img.src).toContain('data:image/png');
    });
    expect(screen.getByText(/Preview what your customer sees/i)).toBeInTheDocument();
  });

  it('redirects to /status without an approved licence', async () => {
    getFilingStatus.mockResolvedValue({ ...approved, status: 'filed', verifyToken: null });
    render(<Qr />);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/status'));
  });
});
