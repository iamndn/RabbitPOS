'use client';

import { useEffect } from 'react';

/**
 * PWARegister
 * Lightweight client component that registers the Service Worker after the page mounts.
 * Must be a 'use client' component since it uses browser APIs (navigator.serviceWorker).
 * Placed inside RootLayout so it runs on every page without blocking rendering.
 */
export default function PWARegister() {
  useEffect(() => {
    // Only register in production and if the browser supports service workers
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          // Use 'all' so the SW can intercept all requests including navigation
          updateViaCache: 'none',
        });

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New SW installed, app will use updated cache on next load
              console.log('[PWA] New service worker installed. Refresh for updates.');
            }
          });
        });

        console.log('[PWA] Service Worker registered, scope:', registration.scope);
      } catch (error) {
        console.warn('[PWA] Service Worker registration failed:', error);
      }
    };

    // Defer registration until after page load for performance
    if (document.readyState === 'complete') {
      registerSW();
    } else {
      window.addEventListener('load', registerSW, { once: true });
    }
  }, []);

  // Renders nothing — pure side-effect component
  return null;
}
