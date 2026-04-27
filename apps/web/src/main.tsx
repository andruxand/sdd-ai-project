/**
 * apps/web/src/main.tsx
 *
 * Vite entry point. Mounts the React app into the DOM.
 * Keep this file thin — delegate everything to App (src/app/index.tsx).
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// TODO: import your App component here
// import App from './app/index';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('#root element not found in index.html');

createRoot(rootElement).render(
  <StrictMode>
    {/* <App /> */}
    <div>Replace with your App component.</div>
  </StrictMode>,
);
