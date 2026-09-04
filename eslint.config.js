// Flat ESLint config for the whole monorepo.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/build/**', '**/node_modules/**', '**/coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Node code (API + package + config files)
    files: ['apps/api/**/*.ts', 'packages/**/*.ts', '*.{js,ts}'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    // Browser code (web app)
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    // Test files can use vitest globals.
    files: ['**/*.{test,spec}.{ts,tsx}', '**/setupTests.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
);
