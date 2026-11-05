import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from './App';
import { ThemeProvider } from './lib/useTheme';
import { SharedSetupProvider } from './lib/sharedSetup';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root missing from index.html');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ThemeProvider>
      <SharedSetupProvider>
        <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ErrorBoundary label="The application">
            <App />
          </ErrorBoundary>
        </HashRouter>
      </SharedSetupProvider>
    </ThemeProvider>
  </React.StrictMode>,
);

/*
 * The service worker, for offline use.
 *
 * It is registered only in a production build: in development the module graph
 * is served live, and a cache-first worker would hand the developer the
 * modules from the last build instead of the ones on disk. Offline support is
 * a bonus; the site works perfectly well without it.
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* offline support is a bonus, not a requirement */
    });
  });
}
