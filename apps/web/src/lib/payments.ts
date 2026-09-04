const API = import.meta.env.VITE_API_BASE_URL ?? '';

export interface OrderInfo {
  orderId: string;
  amount: number; // paise
  currency: string;
  keyId: string;
  mock: boolean;
}

/** Create a Razorpay order for the signed-in baker's draft. 401 → not signed in. */
export async function createOrder(): Promise<OrderInfo> {
  const res = await fetch(`${API}/api/payments/order`, { method: 'POST', credentials: 'include' });
  if (res.status === 401) throw new Error('unauthenticated');
  if (!res.ok) throw new Error('order failed');
  return (await res.json()) as OrderInfo;
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
