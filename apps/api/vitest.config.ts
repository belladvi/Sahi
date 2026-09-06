import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'api',
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    env: {
      STORAGE_SECRET: 'sahi-test-storage-secret-at-least-32-bytes',
    },
  },
});
