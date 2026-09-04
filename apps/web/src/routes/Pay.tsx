import { useState } from 'react';
import { useNavigate } from 'react-router';
import { GOV_FEE_RUPEES, SERVICE_FEE_RUPEES, TOTAL_FEE_RUPEES } from '@sahi/shared';
import { AppShell } from '../components/AppShell';
import { AppHeader } from '../components/AppHeader';
import { PrimaryAction } from '../components/ui/PrimaryAction';
import { Surface } from '../components/ui/Surface';
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

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const order = await createOrder();
      if (order.mock) {
        const ok = await mockPay(order.orderId);
        if (!ok) throw new Error('mock pay failed');
        navigate('/upload');
        return;
      }
      await openRealCheckout(order);
    } catch (err) {
      if (err instanceof Error && err.message === 'unauthenticated') {
        navigate('/create-account');
        return;
      }
      setError('Payment couldn’t start. Your details are saved — please try again.');
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <AppHeader title="One payment, all-in" onBack={() => navigate('/checklist')} />
      <div className="flex flex-1 flex-col gap-5 p-6">
        <div>
          <p className="text-sm text-copy-muted">Everything included</p>
          <p className="text-4xl font-bold">
            ₹{TOTAL_FEE_RUPEES} <span className="text-lg font-medium text-copy-muted">all-in</span>
          </p>
        </div>

        <Surface>
          <div className="space-y-2 text-sm text-copy-muted">
            <div className="flex justify-between">
              <span>Government fee</span>
              <span className="text-copy">₹{GOV_FEE_RUPEES}</span>
            </div>
            <div className="flex justify-between">
              <span>Our service (done-for-you)</span>
              <span className="text-copy">₹{SERVICE_FEE_RUPEES}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-line pt-2 text-base font-semibold text-copy">
              <span>You pay</span>
              <span className="text-action">₹{TOTAL_FEE_RUPEES}</span>
            </div>
          </div>
        </Surface>

        <div className="rounded-xl bg-app-raised px-3 py-2 text-xs text-copy-muted ring-1 ring-line">
          An agent charges ₹2,500–5,000 — and hides the government’s ₹100 fee. We don’t.
        </div>

        <div className="space-y-2 text-sm text-copy-muted">
          <p className="font-semibold text-copy">What’s included</p>
          <p>
            We fill your form, decide your government category, file it — and if the government raises
            a query, we fix it free.
          </p>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="mt-auto space-y-2">
          <PrimaryAction type="button" disabled={busy} onClick={pay}>
            {busy ? 'Starting…' : `Pay ₹${TOTAL_FEE_RUPEES}`}
          </PrimaryAction>
          <p className="text-center text-xs text-copy-muted">One payment. No surprises.</p>
        </div>
      </div>
    </AppShell>
  );
}
