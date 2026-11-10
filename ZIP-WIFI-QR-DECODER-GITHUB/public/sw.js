/**
 * ZIP QR — Wi-Fi QR Decoder — Production PWA Service Worker
 *
 * Caching & Lifecycle Strategy:
 * 1. Versioned Cache Prefix (`zip-qr-cache-`): Every production build injects a unique
 *    content-derived hash (`__BUILD_VERSION__`), ensuring every deployment triggers a
 *    byte-different `sw.js` update and clean cache rotation.
 * 2. Network-First for Navigation & App Shell (`/`, `/index.html`, `mode === 'navigate'`):
 *    Always fetches fresh HTML from the network (`cache: 'no-store'`), updates the cache
 *    with the fresh response, and falls back to cached `/index.html` ONLY when offline.
 * 3. Bypass `/sw.js`: Never intercepts or caches the Service Worker script itself.
 * 4. Network-First for `/manifest.json` & `/version.json`: Revalidates metadata while
 *    keeping an offline copy.
 * 5. Cache-First for Content-Fingerprinted Immutable Assets (`/assets/index.<hash>.js`,
 *    `/assets/index.<hash>.css`): Fast instant loading for fingerprinted bundles.
 * 6. Stale-While-Revalidate for Icons & Logos (`/icons/*`, `/logo/*`).
 * 7. Scoped Obsolete Cache Cleanup on `activate`: Deletes only old `zip-qr-cache-*` and
 *    legacy `zip-wifi-qr-decoder-*` caches without touching unrelated Cache Storage or
 *    `localStorage` scan history/preferences.
 */

const CACHE_PREFIX = 'zip-qr-cache-';
const LEGACY_PREFIX = 'zip-wifi-qr-decoder-';
const BUILD_VERSION = '__BUILD_VERSION__';
const CACHE_NAME = `${CACHE_PREFIX}${BUILD_VERSION}`;

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
      .then((cache) => {
        // Fetch fresh copies bypassing HTTP browser cache during SW install
        return Promise.all(
          APP_SHELL_ASSETS.map((url) =>
            fetch(new Request(url, { cache: 'reload' }))
              .then((res) => {
                if (res && res.ok) {
                  return cache.put(url, res);
                }
                return Promise.resolve();
              })
              .catch(() => Promise.resolve())
          )
        );
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
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Only handle same-origin requests in our app shell / static asset cache
  if (url.origin !== self.location.origin) return;

  // 1. NEVER cache or intercept the Service Worker script itself
  if (url.pathname === '/sw.js' || url.pathname.endsWith('/sw.js')) {
    return;
  }

  // 2. NETWORK-FIRST for HTML Navigation Requests (`/`, `/index.html`, SPA routes)
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

  // 3. NETWORK-FIRST for `/manifest.json` and `/version.json`
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

  // 4. CACHE-FIRST for Content-Fingerprinted Immutable Bundles (`/assets/*`)
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

  // 5. STALE-WHILE-REVALIDATE for Icons, Logos, and Other Static Assets
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
