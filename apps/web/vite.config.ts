import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Sahi — FSSAI for home bakers',
        short_name: 'Sahi',
        description: 'Get your FSSAI registration done, the easy way.',
        theme_color: '#07171f',
        background_color: '#07171f',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        // The SPA fallback must NOT swallow server-owned routes. /verify/:token is
        // a public, no-login, Express-rendered trust page; without this denylist a
        // service-worker-controlled browser (installed PWA, or any repeat visit)
        // serves index.html for it and the buyer sees the React app's generic
        // 404 instead of the real verify page. /api/* is server-owned too.
        navigateFallbackDenylist: [/^\/verify\//, /^\/api\//],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Exclude the heavy on-demand chunk (heic2any ~1.3MB) from the precache —
        // it's lazy-loaded only when a baker actually converts a HEIC file.
        // (Must be globIgnores, not maximumFileSizeToCacheInBytes: the plugin
        // FAILS THE BUILD on any asset over that limit rather than skipping it.)
        globIgnores: ['**/heic2any-*.js'],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  build: {
    outDir: 'dist',
  },
});
