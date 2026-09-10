import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const navigate = vi.fn();
vi.mock('react-router', () => ({ useNavigate: () => navigate }));

const createOrder = vi.fn();
const mockPay = vi.fn();
vi.mock('../lib/payments', () => ({
  createOrder: (...a: unknown[]) => createOrder(...a),
  mockPay: (...a: unknown[]) => mockPay(...a),
}));

// PaymentStep uses motion; render reduced-motion so the count-up, assemble and
// checklist draw-in are static and deterministic under jsdom.
vi.mock('motion/react', async (importOriginal) => {
  const mod = await importOriginal<typeof import('motion/react')>();
  return { ...mod, useReducedMotion: () => true };
});

const { Pay } = await import('./Pay');

describe('Pay', () => {
  beforeEach(() => {
    createOrder.mockReset();
    mockPay.mockReset();
    navigate.mockReset();
  });
  afterEach(() => cleanup());

  it('shows the ₹599 split and pay button, and no longer shows the agent comparison', () => {
    render(<Pay />);
    expect(screen.getByText('₹499')).toBeInTheDocument();
    expect(screen.queryByText(/an agent charges/i)).not.toBeInTheDocument();
    expect(screen.getByText(/no surprises/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pay ₹599/i })).toBeInTheDocument();
  });

  it('mock order → completes and navigates to /upload', async () => {
    createOrder.mockResolvedValue({ orderId: 'order_mock_1', amount: 59900, currency: 'INR', keyId: 'rzp_test_mock', mock: true });
    mockPay.mockResolvedValue(true);
    render(<Pay />);
    fireEvent.click(screen.getByRole('button', { name: /pay ₹599/i }));
    await waitFor(() => expect(mockPay).toHaveBeenCalledWith('order_mock_1'));
    expect(navigate).toHaveBeenCalledWith('/upload');
  });

  it('unauthenticated order → routes to create-account', async () => {
    createOrder.mockRejectedValue(new Error('unauthenticated'));
    render(<Pay />);
    fireEvent.click(screen.getByRole('button', { name: /pay ₹599/i }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/create-account'));
    expect(mockPay).not.toHaveBeenCalled();
  });

  it('offers accessible UPI and Card demo choices with the no-charge label', () => {
    render(<Pay />);
    expect(screen.getByRole('tab', { name: /upi/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /card/i })).toBeInTheDocument();
    expect(screen.getByText(/demo payment — no money will be charged/i)).toBeInTheDocument();
  });

  it('paying by Card still drives the deterministic mock gateway to /upload', async () => {
    createOrder.mockResolvedValue({ orderId: 'order_mock_2', amount: 59900, currency: 'INR', keyId: 'rzp_test_mock', mock: true });
    mockPay.mockResolvedValue(true);
    render(<Pay />);
    fireEvent.click(screen.getByRole('tab', { name: /card/i }));
    fireEvent.click(screen.getByRole('button', { name: /pay ₹599/i }));
    await waitFor(() => expect(mockPay).toHaveBeenCalledWith('order_mock_2'));
    expect(navigate).toHaveBeenCalledWith('/upload');
  });

  it('an already-paid application resumes at its route without charging again', async () => {
    createOrder.mockResolvedValue({ kind: 'resume', nextRoute: '/upload' });
    render(<Pay />);
    fireEvent.click(screen.getByRole('button', { name: /pay ₹599/i }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/upload'));
    expect(mockPay).not.toHaveBeenCalled();
  });

  it('a missing/stale application shows recoverable copy, not the generic error', async () => {
    createOrder.mockRejectedValue(new Error('no-application'));
    render(<Pay />);
    fireEvent.click(screen.getByRole('button', { name: /pay ₹599/i }));
    await waitFor(() => expect(screen.getByText(/start a new registration|couldn’t find/i)).toBeInTheDocument());
    expect(mockPay).not.toHaveBeenCalled();
  });
});
