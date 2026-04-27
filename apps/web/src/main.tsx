// Solana SDKs (and many of their transitive deps) reference `Buffer` as a
// global. Pre-split bundle had it auto-injected; once we manualChunks'd
// vendor-solana into its own file, the global wasn't there in time and
// vendor-solana crashed on load with "Cannot read properties of undefined
// (reading 'Buffer')". Import the browser polyfill before anything else.
import { Buffer } from 'buffer';
(globalThis as any).Buffer = Buffer;
(globalThis as any).global = globalThis;

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/globals.css';

// Register service worker (PWA + push). Skip in dev to avoid HMR conflicts.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
