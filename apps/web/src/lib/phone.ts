/** Normalise a raw Indian mobile input to E.164 (+91XXXXXXXXXX). Strips
 * non-digits and any leading zeros, then keeps the last 10 digits. */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').replace(/^0+/, '');
  return `+91${digits.slice(-10)}`;
}
