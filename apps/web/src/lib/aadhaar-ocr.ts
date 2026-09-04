import { maskAadhaar } from '@sahi/shared';

/** Client-side Aadhaar OCR. Runs Tesseract IN THE BROWSER and returns only the
 * MASKED number — the raw image and full number never leave the device. Name
 * extraction is best-effort; the baker confirms/edits it on the next screen. */
export interface AadhaarReadResult {
  maskedNumber: string | null;
  name: string | null;
  raw: string;
}

const AADHAAR_RE = /\b(\d{4}\s?\d{4}\s?\d{4})\b/;

export async function readAadhaar(image: Blob): Promise<AadhaarReadResult> {
  const { default: Tesseract } = await import('tesseract.js');
  const { data } = await Tesseract.recognize(image, 'eng');
  const text = data.text ?? '';

  const m = AADHAAR_RE.exec(text.replace(/[^\d\s]/g, ' '));
  const num = m?.[1];
  const maskedNumber = num ? maskAadhaar(num) : null;

  // Best-effort name: the line above the DOB/"Year of Birth"/gender line.
  let name: string | null = null;
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const anchor = lines.findIndex((l) => /DOB|Birth|Male|Female|जन्म/i.test(l));
  const candidate = anchor > 0 ? lines[anchor - 1] : undefined;
  if (candidate && /^[A-Za-z][A-Za-z .]{2,40}$/.test(candidate)) name = candidate;

  return { maskedNumber, name, raw: text };
}
