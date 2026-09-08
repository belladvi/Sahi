import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const navigate = vi.fn();
vi.mock('react-router', () => ({ useNavigate: () => navigate }));

const getDraft = vi.fn();
vi.mock('../lib/draft', () => ({ getDraft: (...a: unknown[]) => getDraft(...a) }));

const { Checklist } = await import('./Checklist');

const draft = (premises: 'own' | 'rent') => ({
  id: 'app_1',
  status: 'draft',
  products: ['Cakes'],
  premises,
  turnoverBand: 'under12',
  businessName: 'Rani Bakes',
  description: null,
});

describe('Checklist ("What you’ll need")', () => {
  beforeEach(() => {
    getDraft.mockReset();
    navigate.mockReset();
  });
  afterEach(() => cleanup());

  it('own kitchen → 3 documents (photo, Aadhaar, PAN), no address proof', async () => {
    getDraft.mockResolvedValue(draft('own'));
    render(<Checklist />);
    expect(await screen.findByText(/own your kitchen/i)).toBeInTheDocument();
    expect(screen.getByText('3 documents')).toBeInTheDocument();
    const labels = screen.getAllByText(/^(Passport-size photo|Aadhaar|PAN|Address proof)$/).map((el) => el.textContent);
    expect(labels).toEqual(['Passport-size photo', 'Aadhaar', 'PAN']);
    expect(screen.getByText(/PAN counts as your business identity/i)).toBeInTheDocument();
  });

  it('rented kitchen → 4 documents, address proof last', async () => {
    getDraft.mockResolvedValue(draft('rent'));
    render(<Checklist />);
    expect(await screen.findByText(/rent your kitchen/i)).toBeInTheDocument();
    expect(screen.getByText('4 documents')).toBeInTheDocument();
    const labels = screen.getAllByText(/^(Passport-size photo|Aadhaar|PAN|Address proof)$/).map((el) => el.textContent);
    expect(labels).toEqual(['Passport-size photo', 'Aadhaar', 'PAN', 'Address proof']);
    expect(screen.getByText(/Bill or rent agreement/i)).toBeInTheDocument();
  });

  it('Create an account → /create-account; Back → /describe', async () => {
    getDraft.mockResolvedValue(draft('own'));
    render(<Checklist />);
    fireEvent.click(await screen.findByRole('button', { name: /create an account/i }));
    expect(navigate).toHaveBeenCalledWith('/create-account');
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(navigate).toHaveBeenCalledWith('/describe');
  });

  it('no draft → bounces to /eligibility', async () => {
    getDraft.mockResolvedValue(null);
    render(<Checklist />);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/eligibility'));
  });
});
