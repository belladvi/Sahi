import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';

const navigate = vi.fn();
vi.mock('react-router', () => ({ useNavigate: () => navigate }));

const getConfirmView = vi.fn();
const fileFormA = vi.fn();
vi.mock('../lib/confirm', () => ({
  getConfirmView: () => getConfirmView(),
  fileFormA: (input: unknown) => fileFormA(input),
}));

const { Confirm } = await import('./Confirm');

const view = {
  applicantName: 'Riya',
  businessName: 'Riya’s Kitchen',
  products: ['Cakes'],
  residentialAddress: 'Bengaluru 560001',
  phone: '9876543210',
  email: '',
  hygieneAccepted: false,
  status: 'paid',
};

describe('Confirm — hygiene declaration', () => {
  beforeEach(() => {
    navigate.mockReset();
    getConfirmView.mockReset();
    fileFormA.mockReset();
  });
  afterEach(() => cleanup());

  it('defaults the declaration UNCHECKED and blocks filing until it is ticked', async () => {
    getConfirmView.mockResolvedValue(view);
    render(<Confirm />);
    await waitFor(() => expect(screen.getByText(/Check what we’ll file/i)).toBeInTheDocument());

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();

    const fileBtn = screen.getByRole('button', { name: /file it/i });
    expect(fileBtn).toBeDisabled();
  });

  it('the declaration text is inside a semantic label bound to the checkbox', async () => {
    getConfirmView.mockResolvedValue(view);
    render(<Confirm />);
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeInTheDocument());

    const label = screen.getByText(/basic food hygiene/i).closest('label');
    expect(label).not.toBeNull();
    // Full clickable label: the checkbox lives inside the same <label>.
    expect(label!.querySelector('input[type="checkbox"]')).not.toBeNull();
  });

  it('files with hygieneAccepted:true only after a fresh explicit tick', async () => {
    getConfirmView.mockResolvedValue(view);
    fileFormA.mockResolvedValue({ ok: true });
    render(<Confirm />);
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('checkbox')).toBeChecked();

    const fileBtn = screen.getByRole('button', { name: /file it/i });
    expect(fileBtn).toBeEnabled();
    fireEvent.click(fileBtn);

    await waitFor(() => expect(fileFormA).toHaveBeenCalledTimes(1));
    expect(fileFormA).toHaveBeenCalledWith(expect.objectContaining({ hygieneAccepted: true }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/status'));
  });
});
