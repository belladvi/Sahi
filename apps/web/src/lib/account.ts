import type { AccountLookup } from '@sahi/shared';

const API = import.meta.env.VITE_API_BASE_URL ?? '';

/** Does this contact already have an account? Used by sign-in before sending
 * an OTP, so an unknown contact is nudged to sign up rather than auto-created.
 * `contact` must be the normalised phone (+91…) or trimmed email. */
export async function accountExists(lookup: AccountLookup): Promise<boolean> {
  const res = await fetch(`${API}/api/account/exists`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lookup),
  });
  if (!res.ok) throw new Error('lookup failed');
  const data = (await res.json()) as { exists: boolean };
  return data.exists;
}
