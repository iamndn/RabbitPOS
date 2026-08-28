/**
 * RabbitPOS Service Worker — Offline App Shell Cache
 *
 * Strategy: Cache-First for static assets (icons, fonts, CSS, JS chunks).
 *           Network-First for API calls (/api/v1/*) — never cache API responses.
 *           Stale-While-Revalidate for the Next.js app shell (/, /pos, /dashboard, etc.)
 */

const CACHE_NAME = 'rabbitpos-shell-v2';
const STATIC_CACHE_NAME = 'rabbitpos-static-v2';

// Static assets to pre-cache on SW install (app shell)
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/apple-touch-icon.png',
  '/logo.png',
];

// ─── Install: Pre-cache app shell ───────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()) // Activate immediately without waiting
  );
});

// ─── Activate: Clean up stale caches ────────────────────────────────────────
self.addEventListener('activate', (event) => {
  const validCaches = [CACHE_NAME, STATIC_CACHE_NAME];
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !validCaches.includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim()) // Take control of all open pages
  );
});

// ─── Fetch: Routing strategy per request type ───────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Skip non-GET requests and Chrome extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') return;

  // 2. API calls → Network Only (never cache API data — fresh data is critical for POS)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request));
    return;
  }

  // 3. Next.js HMR / webpack dev server chunks → skip in dev
  if (url.pathname.startsWith('/_next/webpack-hmr')) return;

  // 4. Static assets (icons, images, _next/static chunks) → Cache First
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|ico|woff|woff2|ttf|otf|webp)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (!response || response.status !== 200) return response;
          const clone = response.clone();
          caches.open(STATIC_CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  // 5. Navigation requests (HTML pages) → Network First, fallback to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (!response || response.status !== 200) return response;
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          // Offline fallback: return cached shell or the root page
          caches.match(request).then((cached) => cached || caches.match('/'))
        )
    );
    return;
  }

  // 6. Everything else → Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      });
      return cached || fetchPromise;
    })
  );
});
