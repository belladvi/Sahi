import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';

const navigate = vi.fn();
vi.mock('react-router', () => ({ useNavigate: () => navigate }));

const getDraft = vi.fn();
vi.mock('../lib/draft', () => ({ getDraft: () => getDraft() }));

const { Upload } = await import('./Upload');

describe('Upload', () => {
  beforeEach(() => {
    navigate.mockReset();
    getDraft.mockReset();
  });
  afterEach(() => cleanup());

  it('owner: shows photo + Aadhaar tiles (no address proof) and 0/2 progress', async () => {
    getDraft.mockResolvedValue({ id: 'a', status: 'draft', products: [], premises: 'own', turnoverBand: 'basic', businessName: null, description: null });
    render(<Upload />);
    await waitFor(() => expect(screen.getByText('Your photo')).toBeInTheDocument());
    expect(screen.getByText('Aadhaar')).toBeInTheDocument();
    expect(screen.getByText(/the image never leaves your phone/i)).toBeInTheDocument();
    expect(screen.queryByText('Address proof')).not.toBeInTheDocument();
    expect(screen.getByText('0/2 ready')).toBeInTheDocument();
  });

  it('renter: also shows the address-proof tile and 0/3 progress', async () => {
    getDraft.mockResolvedValue({ id: 'a', status: 'draft', products: [], premises: 'rent', turnoverBand: 'basic', businessName: null, description: null });
    render(<Upload />);
    await waitFor(() => expect(screen.getByText('Address proof')).toBeInTheDocument());
    expect(screen.getByText('0/3 ready')).toBeInTheDocument();
  });
});
