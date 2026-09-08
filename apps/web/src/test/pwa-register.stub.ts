/** Test-only stand-in for vite-plugin-pwa's `virtual:pwa-register` (the virtual
 * module only exists when the PWA plugin runs, which it doesn't under vitest). */
export function registerSW(): (reloadPage?: boolean) => Promise<void> {
  return async () => {};
}
