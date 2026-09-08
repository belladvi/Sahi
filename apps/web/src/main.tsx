import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
// Self-hosted, offline-safe fonts (no runtime third-party fetch): Fraunces for
// display headings, Inter for hero body. Used by the Sahi landing hero.
import '@fontsource-variable/fraunces';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import { router } from './router';
import './index.css';
import { installPwaUpdates } from './lib/pwa-update';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Root element #root not found');
}

// Auto-apply new builds at the next route change: without this a returning
// visitor keeps the stale precached bundle until they refresh (see lib/pwa-update.ts).
installPwaUpdates(router);

createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
