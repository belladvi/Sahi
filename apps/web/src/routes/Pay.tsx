import { useState } from 'react';
import { useNavigate } from 'react-router';
import { GOV_FEE_RUPEES, SERVICE_FEE_RUPEES, TOTAL_FEE_RUPEES } from '@sahi/shared';
import { AppShell } from '../components/AppShell';
import PaymentStep from '../features/payment/PaymentStep';
import { createOrder, mockPay, type OrderInfo } from '../lib/payments';

interface RazorpayOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  theme?: { color: string };
  handler: () => void;
}
interface RazorpayInstance {
  open: () => void;
}
type RazorpayCtor = new (opts: RazorpayOptions) => RazorpayInstance;
declare global {
  interface Window {
    Razorpay?: RazorpayCtor;
  }
}

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export function Pay() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openRealCheckout(order: OrderInfo) {
    const ready = await loadRazorpay();
    if (!ready || !window.Razorpay) {
      setError('Could not load the payment window. Please try again.');
      setBusy(false);
      return;
    }
    const rzp = new window.Razorpay({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: 'Sahi',
      description: 'FSSAI Basic Registration',
      theme: { color: '#f6c915' },
      handler: () => navigate('/upload'), // webhook is the source of truth server-side
    });
    rzp.open();
    setBusy(false); // checkout modal is open; let it drive from here
  }

  // The premium <PaymentStep/> CTA has no busy state, so guard against a double
  // tap while an order is already in flight (a mock pay resolves near-instantly).
  async function pay() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const order = await createOrder();
      // Already paid/later — resume the journey instead of charging again.
      if ('kind' in order) {
        navigate(order.nextRoute);
        return;
      }
      if (order.mock) {
        const ok = await mockPay(order.orderId);
        if (!ok) throw new Error('mock pay failed');
        navigate('/upload');
        return;
      }
      await openRealCheckout(order);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message === 'unauthenticated') {
        navigate('/create-account');
        return;
      }
      if (message === 'no-application') {
        setError('We couldn’t find an application to pay for. Start a new registration to continue.');
        setBusy(false);
        return;
      }
      setError('Payment couldn’t start. Your details are saved — please try again.');
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <PaymentStep
        priceAllIn={TOTAL_FEE_RUPEES}
        govtFee={GOV_FEE_RUPEES}
        helpFee={SERVICE_FEE_RUPEES}
        // Never demo-mode in a production build (spec). Payments are still mocked
        // server-side regardless of this flag.
        demo={import.meta.env.DEV}
        onBack={() => navigate(-1)}
        onPay={() => pay()}
      />
      {/* PaymentStep has no error slot; surface recoverable payment errors here. */}
      {error && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
          <p
            role="alert"
            className="pointer-events-auto max-w-sm rounded-lg bg-red-500/95 px-4 py-2.5 text-center text-sm text-white shadow-lg"
          >
            {error}
          </p>
        </div>
      )}
    </AppShell>
  );
}
