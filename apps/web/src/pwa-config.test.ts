import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

// Regression guard for the P0 verify-route defect: the service worker's SPA
// navigation fallback must NOT intercept server-owned routes. This can't be
// unit-tested at runtime (the SW is a build artifact), so we assert the source
// config that generates it. See vite.config.ts and routes/verify.ts.
function loadConfig(): string {
  // Robust to running from apps/web (workspace script) or the repo root (--root).
  const candidates = [
    path.resolve(process.cwd(), 'vite.config.ts'),
    path.resolve(process.cwd(), 'apps/web/vite.config.ts'),
  ];
  const found = candidates.find(existsSync);
  if (!found) throw new Error(`vite.config.ts not found from ${process.cwd()}`);
  return readFileSync(found, 'utf8');
}
const config = loadConfig();

describe('PWA workbox config', () => {
  it('declares a navigateFallback so the installed app works offline', () => {
    expect(config).toContain("navigateFallback: '/index.html'");
  });

  it('denies the SPA fallback for the public /verify/ trust route', () => {
    expect(config).toContain('navigateFallbackDenylist');
    expect(config).toContain('/^\\/verify\\//');
  });

  it('denies the SPA fallback for server-owned /api/ routes', () => {
    expect(config).toContain('/^\\/api\\//');
  });
});
