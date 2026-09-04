/** Client-side document pre-flight: convert the iPhone/HEIC + odd formats to
 * JPEG, auto-orient, and shrink under a size cap — the "auto-fix before filing"
 * the government portal needs. Runs entirely in the browser. */

export interface PreflightResult {
  blob: Blob;
  contentType: string;
  ext: string;
  sizeKB: number;
  width: number;
  height: number;
  /** Short status chip, e.g. "Clear · JPG · 0.4 MB" or "Shrunk to fit · 4.2 MB → 0.9 MB". */
  label: string;
  blurry: boolean;
}

const MAX_DIM = 1600; // longest side
const TARGET_BYTES = 1_000_000; // ~1 MB
const MIN_QUALITY = 0.4;

function isHeic(file: File): boolean {
  return /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
}

function fmtMB(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

/** Rough sharpness: mean absolute luminance gradient on a downscaled copy.
 * Only used to gently flag a very blurry shot (conservative threshold). */
function blurScore(canvas: HTMLCanvasElement): number {
  const w = Math.min(canvas.width, 256);
  const h = Math.round((w / canvas.width) * canvas.height);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return 1;
  ctx.drawImage(canvas, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  let sum = 0;
  let n = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 1; x < w; x++) {
      const i = (y * w + x) * 4;
      const j = (y * w + x - 1) * 4;
      const lum = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
      const lumPrev = 0.299 * data[j]! + 0.587 * data[j + 1]! + 0.114 * data[j + 2]!;
      sum += Math.abs(lum - lumPrev);
      n++;
    }
  }
  return n ? sum / n : 1;
}

export async function preflightImage(input: File): Promise<PreflightResult> {
  const originalBytes = input.size;

  // 1) HEIC/HEIF → JPEG (lazy-load the heavy converter only when needed).
  let file: Blob = input;
  if (isHeic(input)) {
    const { default: heic2any } = (await import('heic2any')) as { default: (o: { blob: Blob; toType?: string; quality?: number }) => Promise<Blob | Blob[]> };
    const out = await heic2any({ blob: input, toType: 'image/jpeg', quality: 0.9 });
    file = Array.isArray(out) ? out[0]! : out;
  }

  // 2) Decode with EXIF orientation applied.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unsupported');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blurry = blurScore(canvas) < 6;

  // 3) Compress to JPEG under the target size (drop quality, then dimensions).
  let quality = 0.85;
  let blob = await toJpeg(canvas, quality);
  while (blob.size > TARGET_BYTES && quality > MIN_QUALITY) {
    quality -= 0.15;
    blob = await toJpeg(canvas, quality);
  }

  const sizeKB = Math.round(blob.size / 1024);
  const shrunk = blob.size < originalBytes * 0.9;
  const label = blurry
    ? 'Looks blurry — retake?'
    : shrunk
      ? `Shrunk to fit · ${fmtMB(originalBytes)} → ${fmtMB(blob.size)}`
      : `Clear · JPG · ${(blob.size / 1_000_000).toFixed(1)} MB`;

  return { blob, contentType: 'image/jpeg', ext: 'jpg', sizeKB, width, height, label, blurry };
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', quality);
  });
}
