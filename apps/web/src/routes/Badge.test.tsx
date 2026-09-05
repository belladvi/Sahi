import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';

const navigate = vi.fn();
vi.mock('react-router', () => ({ useNavigate: () => navigate }));

const getFilingStatus = vi.fn();
vi.mock('../lib/filing', () => ({ getFilingStatus: () => getFilingStatus() }));

// Canvas isn't available in jsdom — stub the renderer.
vi.mock('../lib/badge', () => ({
  BADGE_SIZES: { Post: { w: 1080, h: 1080 }, Story: { w: 1080, h: 1920 }, DP: { w: 1080, h: 1080 } },
  renderBadge: vi.fn(async () => new Blob(['x'], { type: 'image/png' })),
}));

const { Badge } = await import('./Badge');

const approved = { status: 'approved', businessName: 'Riya’s Kitchen', filedAt: null, approvedAt: null, fssaiNumber: '12345678901234', certificateUrl: null, verifyToken: 't' };

describe('Badge', () => {
  beforeEach(() => {
    navigate.mockReset();
    getFilingStatus.mockReset();
  });
  afterEach(() => cleanup());

  it('shows the badge preview + format switcher for a licensed baker', async () => {
    getFilingStatus.mockResolvedValue(approved);
    render(<Badge />);
    await waitFor(() => expect(screen.getByText(/Show customers you’re verified/i)).toBeInTheDocument());
    expect(screen.getByText('Riya’s Kitchen')).toBeInTheDocument();
    expect(screen.getByText('Post')).toBeInTheDocument();
    expect(screen.getByText('Story')).toBeInTheDocument();
    expect(screen.getByText('DP')).toBeInTheDocument();
    // switching format keeps the preview
    fireEvent.click(screen.getByText('Story'));
    expect(screen.getByText('FSSAI #12345678901234')).toBeInTheDocument();
  });

  it('redirects a not-approved baker to /status', async () => {
    getFilingStatus.mockResolvedValue({ ...approved, status: 'preparing' });
    render(<Badge />);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/status'));
  });
});
