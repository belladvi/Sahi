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

const { Pay } = await import('./Pay');

describe('Pay', () => {
  beforeEach(() => {
    createOrder.mockReset();
    mockPay.mockReset();
    navigate.mockReset();
  });
  afterEach(() => cleanup());

  it('shows the ₹599 split, the agent comparison and the pay button', () => {
    render(<Pay />);
    expect(screen.getByText('₹499')).toBeInTheDocument();
    expect(screen.getByText(/an agent charges ₹2,500–5,000/i)).toBeInTheDocument();
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
});
