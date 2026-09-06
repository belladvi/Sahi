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

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Root element #root not found');
}

createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
