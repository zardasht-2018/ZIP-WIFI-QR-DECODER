/**
 * ZIP QR — Wi-Fi QR Decoder — Production Offline-First & Update-Safe PWA Service Worker
 *
 * Caching & Offline Readiness Strategy:
 * 1. Verified Precache of All Essential App Assets (`APP_SHELL_ASSETS`):
 *    - During `install`, fetches all essential application files (`/`, `/index.html`,
 *      `/manifest.json`, `/icons/icon-192.svg`, `/icons/icon-512.svg`, `/logo/zip-logo.svg`,
 *      and the content-fingerprinted `/assets/index.<hash>.css` & `/assets/index.<hash>.js`).
 *    - Verifies that EVERY essential asset returned HTTP 200 OK and was stored in `CACHE_NAME`
 *      before writing `/offline-ready.json` (`{ ready: true, version: BUILD_VERSION }`).
 *    - Never marks an incomplete cache as offline-ready.
 * 2. Network-First for Navigation (`/`, `/index.html`, `mode === 'navigate'`) with Guaranteed Offline Fallback:
 *    - When online, fetches fresh HTML (`cache: 'no-store'`) and updates the cache.
 *    - When offline, immediately serves cached `/index.html` so the PWA opens and runs without internet.
 * 3. Cache-First for Content-Fingerprinted Immutable Bundles (`/assets/*`).
 * 4. Scoped Obsolete Cache Cleanup on `activate`:
 *    - Removes outdated `zip-qr-cache-*` and `zip-wifi-qr-decoder-*` caches without touching
 *      `IndexedDB` (`zip_qr_local_db`) or saved Wi-Fi passwords.
 */

const CACHE_PREFIX = 'zip-qr-cache-';
const LEGACY_PREFIX = 'zip-wifi-qr-decoder-';
const BUILD_VERSION = '__BUILD_VERSION__';
const CACHE_NAME = `${CACHE_PREFIX}${BUILD_VERSION}`;
const OFFLINE_READY_MARKER = '/offline-ready.json';

const APP_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  '/logo/zip-logo.svg',
  // __HASHED_ASSETS__
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(async (cache) => {
        let cachedCount = 0;
        for (const url of APP_SHELL_ASSETS) {
          try {
            const res = await fetch(new Request(url, { cache: 'reload' }));
            if (res && res.ok) {
              await cache.put(url, res);
              cachedCount++;
            }
          } catch {
            // Asset fetch failed during install
          }
        }

        // Only write the verified offline-ready marker if ALL essential assets were cached
        if (cachedCount === APP_SHELL_ASSETS.length) {
          const markerBody = JSON.stringify({
            ready: true,
            version: BUILD_VERSION,
            cachedCount,
            totalRequired: APP_SHELL_ASSETS.length,
            timestamp: new Date().toISOString(),
          });
          if (typeof Response !== 'undefined') {
            await cache.put(
              OFFLINE_READY_MARKER,
              new Response(markerBody, {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              })
            );
          } else {
            await cache.put(OFFLINE_READY_MARKER, {
              ok: true,
              status: 200,
              body: markerBody,
              clone() {
                return { ...this };
              },
            });
          }
        }
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            const isOurCache = key.startsWith(CACHE_PREFIX) || key.startsWith(LEGACY_PREFIX);
            if (isOurCache && key !== CACHE_NAME) {
              return caches.delete(key);
            }
            return Promise.resolve();
          })
        )
      )
      .then(() => self.clients.claim())
      .then(async () => {
        try {
          const cache = await caches.open(CACHE_NAME);
          const marker = await cache.match(OFFLINE_READY_MARKER);
          const isReady = Boolean(marker);
          if (self.clients && typeof self.clients.matchAll === 'function') {
            const clientList = await self.clients.matchAll({ type: 'window' });
            for (const client of clientList) {
              if (typeof client.postMessage === 'function') {
                client.postMessage({
                  type: 'OFFLINE_READY_STATUS',
                  ready: isReady,
                  version: BUILD_VERSION,
                });
              }
            }
          }
        } catch {
          // ignore
        }
      })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Only handle same-origin requests in our app shell / static asset cache
  if (url.origin !== self.location.origin) return;

  // 1. NEVER cache or intercept the Service Worker script itself
  if (url.pathname === '/sw.js' || url.pathname.endsWith('/sw.js')) {
    return;
  }

  // 2. Serve the verified offline readiness marker from cache
  if (url.pathname === OFFLINE_READY_MARKER) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => cache.match(OFFLINE_READY_MARKER))
    );
    return;
  }

  // 3. NETWORK-FIRST for HTML Navigation Requests (`/`, `/index.html`, SPA routes) with Offline Fallback
  const acceptHeader = request.headers.get('accept') || '';
  const isNavigation =
    request.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname === '/index.html' ||
    acceptHeader.includes('text/html');

  if (isNavigation) {
    event.respondWith(
      fetch(new Request(request.url, { cache: 'no-store' }))
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put('/index.html', copy.clone());
              cache.put('/', copy);
            });
          }
          return networkResponse;
        })
        .catch(() =>
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.match('/index.html') || cache.match('/'))
        )
    );
    return;
  }

  // 4. NETWORK-FIRST for `/manifest.json` and `/version.json`
  if (url.pathname === '/manifest.json' || url.pathname === '/version.json') {
    event.respondWith(
      fetch(new Request(request.url, { cache: 'no-cache' }))
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 5. CACHE-FIRST for Content-Fingerprinted Immutable Bundles (`/assets/*`)
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 6. STALE-WHILE-REVALIDATE for Icons, Logos, and Other Static Assets
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
