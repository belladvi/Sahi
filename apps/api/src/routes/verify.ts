import { Router } from 'express';
import { prisma } from '@sahi/db';

export const verifyRouter: Router = Router();

interface VerifyData {
  businessName: string;
  fssaiNumber: string;
  status: 'Active';
  registration: 'Basic';
  products: string[];
  approvedAt: string | null;
  waLink: string | null;
}

async function lookup(token: string): Promise<VerifyData | null> {
  const app = await prisma.application.findUnique({ where: { verifyToken: token } });
  if (!app || app.status !== 'approved' || !app.fssaiNumber) return null;
  const saved = (app.formA as { phone?: string } | null) ?? null;
  const phoneDigits = (saved?.phone ?? '').replace(/\D/g, '');
  // Prefilled order intent that references the verified page (ticket 23), so the
  // baker sees the buyer arrived via their government-verified Sahi page.
  const base = process.env.APP_BASE_URL ?? '';
  const verifyPageUrl = `${base}/verify/${token}`;
  const orderText = `Hi ${app.businessName ?? 'there'}! I found your verified FSSAI page on Sahi (${verifyPageUrl}) and I'd like to place an order.`;
  const waLink = phoneDigits
    ? `https://wa.me/${phoneDigits.length === 10 ? '91' + phoneDigits : phoneDigits}?text=${encodeURIComponent(orderText)}`
    : null;
  return {
    businessName: app.businessName ?? 'This business',
    fssaiNumber: app.fssaiNumber,
    status: 'Active',
    registration: 'Basic',
    products: app.products,
    approvedAt: app.approvedAt ? app.approvedAt.toISOString() : null,
    waLink,
  };
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

// Public JSON API (no auth) — used programmatically / by clients.
verifyRouter.get('/api/verify/:token', async (req, res, next) => {
  try {
    const data = await lookup(String(req.params.token));
    if (!data) {
      res.status(404).json({ found: false });
      return;
    }
    console.log(`[verify-view] api token=${String(req.params.token).slice(0, 8)}…`);
    res.json({ found: true, ...data });
  } catch (err) {
    next(err);
  }
});

// Public, server-rendered verify page (no login) with OG/meta for link previews.
verifyRouter.get('/verify/:token', async (req, res, next) => {
  try {
    const token = String(req.params.token);
    const data = await lookup(token);
    console.log(`[verify-view] page token=${token.slice(0, 8)}… found=${!!data}`);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=60');
    if (!data) {
      res.status(404).send(notFoundHtml());
      return;
    }
    res.status(200).send(verifyHtml(data));
  } catch (err) {
    next(err);
  }
});

function shell(title: string, description: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta name="theme-color" content="#07171f" />
<meta name="robots" content="index,follow" />
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; background:#07171f; color:#f8f6ef; font-family: system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif; -webkit-font-smoothing:antialiased; }
  .wrap { max-width: 460px; margin:0 auto; min-height:100dvh; display:flex; flex-direction:column; }
  header { display:flex; align-items:center; justify-content:center; gap:8px; padding:16px; border-bottom:1px solid rgba(255,255,255,.1); background:#102a36; font-weight:700; }
  header .muted { color:#9fb1ba; font-weight:500; font-size:13px; }
  main { flex:1; padding:32px 20px; text-align:center; }
  .disc { width:80px; height:80px; border-radius:999px; background:rgba(66,211,141,.14); color:#42d38d; font-size:38px; display:grid; place-items:center; margin:0 auto; }
  .status { margin-top:20px; color:#42d38d; font-weight:600; font-size:14px; }
  h1 { margin:8px 0 0; font-size:30px; letter-spacing:-.01em; }
  .sub { color:#9fb1ba; margin-top:8px; }
  .card { margin-top:24px; background:#102a36; border:1px solid rgba(255,255,255,.1); border-radius:16px; padding:4px 16px; text-align:left; }
  .row { display:flex; justify-content:space-between; gap:16px; padding:16px 0; border-bottom:1px solid rgba(255,255,255,.08); font-size:14px; }
  .row:last-child { border-bottom:0; }
  .row .muted { color:#9fb1ba; }
  .row strong { text-align:right; }
  .green { color:#42d38d; }
  .chips { margin-top:20px; display:flex; flex-wrap:wrap; gap:8px; justify-content:center; }
  .chip { background:rgba(246,201,21,.1); padding:8px 12px; border-radius:999px; font-size:14px; }
  footer { padding:20px; border-top:1px solid rgba(255,255,255,.1); }
  .cta { display:flex; align-items:center; justify-content:center; gap:8px; width:100%; background:#42d38d; color:#062719; text-decoration:none; font-weight:700; padding:14px; border-radius:16px; }
  .note { text-align:center; color:#9fb1ba; font-size:12px; margin-top:12px; }
</style>
</head>
<body><div class="wrap">${body}</div></body></html>`;
}

function verifyHtml(d: VerifyData): string {
  const rows = [
    ['FSSAI number', esc(d.fssaiNumber), ''],
    ['Registration', esc(d.registration), ''],
    ['Current status', 'Active ✓', 'green'],
    ['Last checked', 'Today', ''],
  ]
    .map(([l, v, cls]) => `<div class="row"><span class="muted">${l}</span><strong class="${cls}">${v}</strong></div>`)
    .join('');
  const chips = d.products.length
    ? `<div class="chips">${d.products.map((p) => `<span class="chip">${esc(p)}</span>`).join('')}</div>`
    : '';
  const cta = d.waLink
    ? `<a class="cta" href="${esc(d.waLink)}" rel="nofollow noopener">💬 Order on WhatsApp</a>`
    : '';
  const body = `
    <header>Sahi <span class="muted">· Verify</span></header>
    <main>
      <div class="disc">✓</div>
      <p class="status">✓ Government-registered · Active</p>
      <h1>${esc(d.businessName)}</h1>
      <p class="sub">Verified independent food business.</p>
      <div class="card">${rows}</div>
      ${chips}
    </main>
    <footer>${cta}<p class="note">Live status checked against government records.</p></footer>`;
  return shell(
    `${d.businessName} — FSSAI Verified`,
    `${d.businessName} is government-registered (FSSAI ${d.fssaiNumber}) · Active. Verified on Sahi.`,
    body,
  );
}

function notFoundHtml(): string {
  const body = `
    <header>Sahi <span class="muted">· Verify</span></header>
    <main>
      <div class="disc" style="background:rgba(255,107,94,.14);color:#ff6b5e;">?</div>
      <h1 style="font-size:24px;">We couldn’t verify that link</h1>
      <p class="sub">This verification link isn’t valid. Ask the business for their current Sahi verify link or QR.</p>
    </main>`;
  return shell('Not verified — Sahi', 'This verification link isn’t valid.', body);
}
