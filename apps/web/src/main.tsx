/**
 * apps/web/src/main.tsx
 *
 * Vite entry point. Mounts the React app into the DOM.
 * Keep this file thin — delegate everything to App (src/app/index.tsx).
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './app/index.js';
import { initRum } from './shared/monitoring/rum.js';

// Initialize Datadog RUM before React renders
initRum();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('#root element not found in index.html');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
