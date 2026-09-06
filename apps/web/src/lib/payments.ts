import { getDraftToken } from './draft';

const API = import.meta.env.VITE_API_BASE_URL ?? '';

export interface OrderInfo {
  orderId: string;
  amount: number; // paise
  currency: string;
  keyId: string;
  mock: boolean;
}

/** Either a payable order, or a "resume" signal when the baker's application is
 * already paid/later (so Payment never charges again — it just navigates on). */
export type OrderResult = OrderInfo | { kind: 'resume'; nextRoute: string };

/** Create a Razorpay order for the signed-in baker's draft.
 * Sends the browser's current draft token so the server pays exactly THAT
 * application (never the newest owned draft) — a repeat/Back journey can't open
 * an order for a different owned draft.
 * 401 → 'unauthenticated'; 404 → 'no-application' (recoverable copy on screen). */
export async function createOrder(): Promise<OrderResult> {
  const token = getDraftToken();
  const headers: Record<string, string> = token ? { 'x-draft-token': token } : {};
  const res = await fetch(`${API}/api/payments/order`, { method: 'POST', credentials: 'include', headers });
  if (res.status === 401) throw new Error('unauthenticated');
  if (res.status === 404) throw new Error('no-application');
  if (!res.ok) throw new Error('order failed');
  const data = (await res.json()) as (OrderInfo & { alreadyPaid?: boolean; nextRoute?: string });
  if (data.alreadyPaid) return { kind: 'resume', nextRoute: data.nextRoute ?? '/upload' };
  return data;
}

/** Mock-mode only: simulate a successful capture (drives the real webhook). */
export async function mockPay(orderId: string): Promise<boolean> {
  const res = await fetch(`${API}/api/payments/mock/pay`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId }),
  });
  return res.ok;
}
