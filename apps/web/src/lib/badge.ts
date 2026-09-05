export type BadgeFormat = 'Post' | 'Story' | 'DP';

export const BADGE_SIZES: Record<BadgeFormat, { w: number; h: number }> = {
  Post: { w: 1080, h: 1080 },
  Story: { w: 1080, h: 1920 },
  DP: { w: 1080, h: 1080 },
};

// Brand tokens (mirror index.css so the asset matches the app).
const APP = '#07171f';
const CARD = '#102a36';
const COPY = '#f8f6ef';
const MUTED = '#9fb1ba';
const VERIFIED = '#42d38d';

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Render the verified badge to a PNG blob at the format's real pixel size. */
export async function renderBadge(format: BadgeFormat, businessName: string, fssaiNumber: string): Promise<Blob> {
  const { w, h } = BADGE_SIZES[format];
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');

  const cx = w / 2;
  const cy = h / 2;

  // Background
  ctx.fillStyle = APP;
  ctx.fillRect(0, 0, w, h);

  if (format === 'DP') {
    // Circular frame
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, w / 2 - 8, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = CARD;
    ctx.fillRect(0, 0, w, h);
  } else {
    // Rounded card
    const m = format === 'Story' ? 90 : 70;
    const cardY = format === 'Story' ? h / 2 - 460 : m;
    const cardH = format === 'Story' ? 920 : h - m * 2;
    ctx.fillStyle = CARD;
    roundRect(ctx, m, cardY, w - m * 2, cardH, 56);
    ctx.fill();
  }

  const contentCy = cy;

  // Verified check disc
  ctx.fillStyle = VERIFIED;
  ctx.beginPath();
  ctx.arc(cx, contentCy - 210, 90, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = APP;
  ctx.lineWidth = 22;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 42, contentCy - 210);
  ctx.lineTo(cx - 10, contentCy - 178);
  ctx.lineTo(cx + 46, contentCy - 246);
  ctx.stroke();

  ctx.textAlign = 'center';

  // Business name
  ctx.fillStyle = COPY;
  ctx.font = '700 76px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';
  ctx.fillText(truncate(ctx, businessName, w - 220), cx, contentCy - 40);

  // FSSAI number
  ctx.fillStyle = MUTED;
  ctx.font = '400 40px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';
  ctx.fillText(`FSSAI #${fssaiNumber}`, cx, contentCy + 40);

  // Verified · Active
  ctx.fillStyle = VERIFIED;
  ctx.font = '700 42px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';
  ctx.fillText('✓ VERIFIED · ACTIVE', cx, contentCy + 140);

  // Footer wordmark
  ctx.fillStyle = MUTED;
  ctx.font = '600 34px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';
  ctx.fillText('Verified on Sahi', cx, contentCy + 250);

  if (format === 'DP') ctx.restore();

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
  });
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1);
  return t + '…';
}
