import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';

const navigate = vi.fn();
vi.mock('react-router', () => ({ useNavigate: () => navigate }));

const getTrustScore = vi.fn();
vi.mock('../lib/trust', () => ({ getTrustScore: () => getTrustScore() }));

const { TrustScore } = await import('./TrustScore');

describe('TrustScore', () => {
  beforeEach(() => {
    navigate.mockReset();
    getTrustScore.mockReset();
  });
  afterEach(() => cleanup());

  it('renders the score and the improve step for an incomplete profile', async () => {
    getTrustScore.mockResolvedValue({
      score: 85,
      factors: [
        { key: 'licenceActive', label: 'Licence active', detail: 'live', done: true, points: 40 },
        { key: 'feeCurrent', label: 'Fee current', detail: 'ok', done: true, points: 25 },
        { key: 'documentsVerified', label: 'Documents verified', detail: 'ok', done: true, points: 20 },
        { key: 'emailOnFile', label: 'Contact email added', detail: 'Add your email', done: false, points: 15 },
      ],
    });
    render(<TrustScore />);
    await waitFor(() => expect(screen.getByText('85')).toBeInTheDocument());
    expect(screen.getByText('Contact email added')).toBeInTheDocument();
    expect(screen.getByText('+15')).toBeInTheDocument();
    expect(screen.getByText(/reach 100/i)).toBeInTheDocument();
  });

  it('redirects to sign-in when there is no data', async () => {
    getTrustScore.mockResolvedValue(null);
    render(<TrustScore />);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/sign-in'));
  });
});
