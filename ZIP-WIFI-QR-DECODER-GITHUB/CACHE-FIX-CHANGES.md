# Permanent PWA, Service Worker & Cache Update Fix — `ZIP QR` (`ZIP-WIFI-QR-DECODER`)

- **Live Website**: [https://zip-wifi-qr-decoder.pages.dev/](https://zip-wifi-qr-decoder.pages.dev/)
- **GitHub Repository**: [https://github.com/zardasht-2018/ZIP-WIFI-QR-DECODER](https://github.com/zardasht-2018/ZIP-WIFI-QR-DECODER)

## 1. Root Cause Audit of the Stale Deployment Issue

Why visitors saw the old application version on normal visits (and even after reopening the browser) unless they pressed `Ctrl + Shift + R`:

1. **Cache-First on `/` and `/index.html` in `public/sw.js`**:
   - Previously, `public/sw.js` intercepted every `GET` request—including navigation requests to `/` and `/index.html`—using `caches.match(event.request).then(cachedResponse => cachedResponse || fetch(event.request))`.
   - Once a visitor opened the site once, `/index.html` was stored in Cache Storage. On every subsequent ordinary visit or normal refresh (`F5`), the active Service Worker immediately returned the cached `/index.html` without ever checking the network.
   - Pressing `Ctrl + Shift + R` bypasses the Service Worker (`navigator.serviceWorker.controller` is null on a hard reload), which is why `Ctrl + Shift + R` showed the new deployment while reopening the tab normally reverted to the stale Service Worker cache.
2. **Static Hardcoded `CACHE_NAME` (`zip-wifi-qr-decoder-v2.4.0`)**:
   - Because `CACHE_NAME` inside `public/sw.js` was a fixed string, deploying updated HTML/JS/CSS did not alter `dist/sw.js` byte-for-byte. As a result, browsers did not trigger a Service Worker `install`/`activate` cycle to evict the old cache.
3. **Unhashed Asset Filenames (`/assets/index.js` & `/assets/index.css`) with `max-age=31536000, immutable`**:
   - `public/_headers` applied `Cache-Control: public, max-age=31536000, immutable` to `/assets/*`, while the build emitted unhashed `/assets/index.js` and `/assets/index.css`. Even when new HTML was fetched, the browser HTTP disk cache could serve stale unhashed `/assets/index.js` for up to 1 year.
4. **Missing `Cache-Control` Revalidation Headers on `/` and `/index.html`**:
   - `public/_headers` did not explicitly set `Cache-Control: no-cache, no-store, must-revalidate` on `/` and `/index.html`.
5. **Basic Service Worker Registration Without `updateViaCache: 'none'` or `controllerchange` Handshake**:
   - `navigator.serviceWorker.register('/sw.js')` did not pass `{ updateViaCache: 'none' }`, did not listen for `updatefound` / `waiting` workers, and did not refresh the active view when a new Service Worker took control.

## 2. Permanent Architectural Fixes Implemented

### A. Network-First Navigation & App Shell Strategy (`public/sw.js`)
- **Navigation Requests (`/`, `/index.html`, `request.mode === 'navigate'`, `Accept: text/html`)**:
  - Now use a strict **Network-First** strategy (`fetch(new Request(request.url, { cache: 'no-store' }))`).
  - Whenever the user is online, the Service Worker fetches the latest `/index.html` directly from Cloudflare Pages, updates the cache with the fresh copy, and serves it immediately.
  - The cached `/index.html` is used **only as an offline fallback** when the network is unreachable.
- **Never Intercept `/sw.js`**:
  - Requests for `/sw.js` return immediately without calling `event.respondWith()`, ensuring the Service Worker never caches or serves itself.
- **Network-First for `/manifest.json` and `/version.json`**:
  - Ensures PWA metadata and build version checks are always fresh while online and available offline.
- **Cache-First for Content-Fingerprinted Immutable Bundles (`/assets/index.<hash>.js`, `/assets/index.<hash>.css`)**:
  - Fingerprinted assets whose filenames contain their SHA-256 content hash use fast Cache-First lookup.
- **Scoped Obsolete Cache Cleanup (`activate` event)**:
  - During `activate`, the Service Worker deletes all older `zip-qr-cache-*` and legacy `zip-wifi-qr-decoder-*` caches while preserving any unrelated Cache Storage entries and never touching `localStorage` scan history or user settings.

### B. Automatic Build Versioning & Content-Fingerprinted Assets (`scripts/buildDist.cjs`)
- Every execution of `npm run build` (`node scripts/buildDist.cjs`) computes SHA-256 content hashes of the CSS, JS, and HTML templates:
  - Emits content-fingerprinted bundles: `/assets/index.<cssHash>.css` and `/assets/index.<jsHash>.js`.
  - Updates `dist/index.html` to reference the exact fingerprinted filenames (`/assets/index.<hash>.css` and `/assets/index.<hash>.js`).
  - Injects the unique `BUILD_VERSION` (`v2.5.0-<combinedHash>`) and the hashed asset URLs directly into `dist/sw.js`, guaranteeing that every code or UI change produces a byte-different `dist/sw.js` and a fresh versioned cache name (`zip-qr-cache-v2.5.0-<hash>`).
  - Emits `dist/version.json` with the active build version, cache name, and asset hashes.

### C. Update-Aware Service Worker Registration & Single-Reload Guard (`src/services/swUpdateService.ts` & `scripts/buildDist.cjs`)
- Registers `/sw.js` with `{ scope: '/', updateViaCache: 'none' }` so browsers never use stale HTTP cache when checking `/sw.js`.
- Proactively calls `registration.update()` on page load, when the browser tab becomes visible (`visibilitychange`), and when internet connectivity is restored (`online`).
- Automatically signals `postMessage({ type: 'SKIP_WAITING' })` to waiting/installed Service Workers.
- Listens for `navigator.serviceWorker` `controllerchange` and performs a single controlled reload guarded by a `sessionStorage` timestamp lock (`zip_qr_sw_reload_guard_v1`) so the page never enters a reload loop.

### D. Cloudflare Pages Response Headers (`public/_headers`)
- `/` and `/index.html`: `Cache-Control: no-cache, no-store, must-revalidate` (`Pragma: no-cache`, `Expires: 0`)
- `/sw.js` and `/version.json`: `Cache-Control: no-cache, no-store, must-revalidate`
- `/manifest.json`: `Cache-Control: public, max-age=0, must-revalidate`
- `/icons/*` and `/logo/*`: `Cache-Control: public, max-age=86400, stale-while-revalidate=604800`
- `/assets/*`: `Cache-Control: public, max-age=31536000, immutable` (safe because `/assets/index.<hash>.js` and `/assets/index.<hash>.css` are content-fingerprinted on every build)

## 3. Complete List of Modified & Newly Created Files

| Status | File Path in Repository (`ZIP-WIFI-QR-DECODER-GITHUB/`) | Purpose |
| :--- | :--- | :--- |
| **New** | `src/services/swUpdateService.ts` | Service Worker registration (`updateViaCache: 'none'`), update detection, `SKIP_WAITING` messaging, and single-reload loop guard |
| **New** | `src/compiled/swUpdateService.cjs` | Pre-compiled CommonJS module of `swUpdateService.ts` |
| **New** | `CACHE-FIX-CHANGES.md` | Detailed technical audit, architecture documentation, and GitHub upload guide |
| **Modified** | `public/sw.js` | Network-first navigation caching, `/sw.js` bypass, fingerprinted asset caching, `SKIP_WAITING` listener, and scoped obsolete cache cleanup |
| **Modified** | `public/_headers` | Added strict revalidation headers for `/`, `/index.html`, `/sw.js`, `/version.json`, and `/manifest.json`, while keeping `immutable` caching for fingerprinted `/assets/*` |
| **Modified** | `scripts/buildDist.cjs` | Generates SHA-256 content-fingerprinted `/assets/index.<hash>.js` and `.css`, injects `BUILD_VERSION` into `dist/sw.js`, and writes `dist/version.json` |
| **Modified** | `src/main.tsx` | Replaced basic `serviceWorker.register('/sw.js')` with `registerServiceWorkerWithUpdates()` |
| **Modified** | `tests/runTests.cjs` | Expanded to **24 automated test suites** verifying Service Worker install, obsolete cache deletion, network-first HTML updates, offline fallback, `/sw.js` bypass, and reload loop protection |

## 4. GitHub Upload Guide (Updating Your Existing Repository)

Your Cloudflare Pages project is already connected to `https://github.com/zardasht-2018/ZIP-WIFI-QR-DECODER` with:
- **Root directory**: `ZIP-WIFI-QR-DECODER-GITHUB`
- **Build command**: `npm run build`
- **Build output directory**: `dist`

To publish this fix:
1. Extract **`ZIP-WIFI-QR-DECODER-CACHE-FIX.zip`** on your computer. Inside, you will see the **`ZIP-WIFI-QR-DECODER-GITHUB/`** folder containing the complete, synchronized project.
2. Open your GitHub repository in your browser: `https://github.com/zardasht-2018/ZIP-WIFI-QR-DECODER`.
3. Navigate into the **`ZIP-WIFI-QR-DECODER-GITHUB`** folder on GitHub, click **Add file → Upload files**, and drag the contents of your local `ZIP-WIFI-QR-DECODER-GITHUB/` folder (or upload the 8 modified/new files listed in Section 3 above to their matching folders).
4. Commit directly to the **`main`** branch.
5. Cloudflare Pages will automatically run `npm ci` and `npm run build`, generating the fingerprinted assets (`/assets/index.<hash>.css`, `/assets/index.<hash>.js`), `dist/sw.js` (`v2.5.0-<hash>`), `dist/version.json`, and `dist/_headers`.
