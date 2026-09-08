import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // The PWA plugin (which provides this virtual module) isn't loaded in tests.
      'virtual:pwa-register': fileURLToPath(new URL('./src/test/pwa-register.stub.ts', import.meta.url)),
    },
  },
  test: {
    name: 'web',
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
