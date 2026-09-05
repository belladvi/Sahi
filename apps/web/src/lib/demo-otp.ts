/**
 * Demo helper: while no real SMS/email provider is wired, the API remembers the
 * last mock OTP so we can auto-fill it here (see apps/api/src/routes/demo.ts).
 * Returns null when demo reveal is off (real senders live) or nothing is stored.
 */
export async function fetchDemoOtp(contact: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/demo/otp?contact=${encodeURIComponent(contact)}`);
    if (!res.ok) return null;
    const body = (await res.json()) as { code: string | null };
    return body.code ?? null;
  } catch {
    return null;
  }
}
