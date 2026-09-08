import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const navigate = vi.fn();
vi.mock('react-router', () => ({ useNavigate: () => navigate }));

const getDraft = vi.fn();
const getDraftToken = vi.fn();
const patchDraft = vi.fn();
vi.mock('../lib/draft', () => ({
  getDraft: (...a: unknown[]) => getDraft(...a),
  getDraftToken: () => getDraftToken(),
  patchDraft: (...a: unknown[]) => patchDraft(...a),
}));

const { Describe } = await import('./Describe');

const draft = {
  id: 'app_1',
  status: 'draft',
  products: ['Cakes'],
  premises: 'own',
  turnoverBand: 'basic',
  businessName: '',
  description: null,
};

async function fillAndContinue() {
  fireEvent.change(await screen.findByLabelText(/business name/i), { target: { value: 'Rani Bakes' } });
  fireEvent.click(screen.getByRole('radio', { name: 'Individual' }));
  const cta = screen.getByRole('button', { name: /continue/i });
  expect(cta).not.toBeDisabled();
  fireEvent.click(cta);
}

describe('Describe ("Tell us about your kitchen")', () => {
  beforeEach(() => {
    getDraft.mockReset().mockResolvedValue(draft);
    getDraftToken.mockReset().mockReturnValue('tok_1');
    patchDraft.mockReset();
    navigate.mockReset();
  });
  afterEach(() => cleanup());

  it('Continue shows an instant busy state, saves once via the known token, then navigates', async () => {
    let resolveSave: (v: unknown) => void = () => {};
    patchDraft.mockImplementation(() => new Promise((r) => { resolveSave = r; }));
    render(<Describe />);
    await fillAndContinue();

    // instant feedback — no dead tap while the ~3s prod round-trip runs
    const busy = screen.getByRole('button', { name: /saving/i });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute('aria-busy', 'true');
    // extra taps must not queue extra saves
    fireEvent.click(busy);
    expect(patchDraft).toHaveBeenCalledTimes(1);
    expect(patchDraft).toHaveBeenCalledWith('tok_1', { businessName: 'Rani Bakes', description: '' });
    expect(navigate).not.toHaveBeenCalled();

    resolveSave({ ...draft, businessName: 'Rani Bakes' });
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/checklist'));
  });

  it('a failed save releases the button so she can retry (no silent loss)', async () => {
    patchDraft.mockRejectedValueOnce(new Error('offline'));
    render(<Describe />);
    await fillAndContinue();
    await waitFor(() => expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled());
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByText(/couldn.t save/i)).toBeInTheDocument();
  });

  it('no draft → bounces to /eligibility', async () => {
    getDraft.mockResolvedValue(null);
    render(<Describe />);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/eligibility'));
  });
});
