/** Generate a real, scannable QR PNG data URL for a URL. Lazy-imports `qrcode`
 * so it stays out of the main bundle (like the OCR/HEIC helpers). */
export async function renderQrDataUrl(url: string, size = 1024): Promise<string> {
  const QRCode = (await import('qrcode')).default;
  return QRCode.toDataURL(url, {
    width: size,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#07171f', light: '#ffffff' },
  });
}

/** The public verify URL a QR should encode. */
export function verifyUrl(token: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/verify/${token}`;
}
