/**
 * ZIP QR — Wi-Fi QR Decoder — Self-Contained Offline-Ready Production Distribution Builder
 *
 * Implements:
 * 1. 100% Local Self-Contained Bundles (Zero External CDN Dependencies):
 *    - Generates `/assets/index.<cssHash>.css` and `/assets/index.<jsHash>.js` derived from SHA-256 content hashes.
 *    - Keeps `/assets/index.css` and `/assets/index.js` aliases for backward compatibility.
 *    - Emits zero external script or stylesheet tags so the PWA works 100% offline after initial caching.
 * 2. Automatic Service Worker Cache Versioning (`dist/sw.js`):
 *    - Injects a unique deterministic `BUILD_VERSION` (`v2.5.0-<contentHash>`) and the exact
 *      hashed asset paths into `dist/sw.js` on every build so every deployment produces a
 *      byte-different `sw.js` and rotates the cache (`zip-qr-cache-v2.5.0-<hash>`).
 * 3. Update-Aware & Offline-Verified Service Worker Registration (`updateViaCache: 'none'`).
 * 4. Generates `dist/version.json` with build metadata.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const assetsDir = path.join(distDir, 'assets');
const publicDir = path.join(projectRoot, 'public');
const templatesDir = path.join(projectRoot, 'src', 'templates');

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function shortHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 8);
}

// 1. Clean and create dist/ and dist/assets/
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(assetsDir, { recursive: true });

// 2. Copy all static files from public/ to dist/
copyDirRecursive(publicDir, distDir);

// 3. Read self-contained application CSS, HTML body, and JS runtime from src/templates/
const cssContent = fs.readFileSync(path.join(templatesDir, 'app.css'), 'utf8');
const bodyHtml = fs.readFileSync(path.join(templatesDir, 'body.html'), 'utf8');
let jsContent = fs.readFileSync(path.join(templatesDir, 'runtime.js'), 'utf8');

// Append update-aware Service Worker registration (`updateViaCache: 'none'`, `SKIP_WAITING`, single-reload guard)
const swRegistrationSnippet = `
// =========================================================================
// PWA SERVICE WORKER REGISTRATION, OFFLINE READINESS & UPDATE LIFECYCLE
// =========================================================================
(function initZipQrServiceWorker() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  var isSupportedProtocol =
    window.location.protocol === 'https:' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';
  if (!isSupportedProtocol) return;

  var RELOAD_GUARD_KEY = 'zip_qr_sw_reload_guard_v1';
  var isRefreshing = false;

  navigator.serviceWorker.addEventListener('message', function (event) {
    if (event.data && event.data.type === 'OFFLINE_READY_STATUS') {
      if (typeof window.__zipRefreshOfflineStatus === 'function') {
        window.__zipRefreshOfflineStatus();
      }
    }
  });

  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (typeof window.__zipRefreshOfflineStatus === 'function') {
      window.__zipRefreshOfflineStatus();
    }
    if (isRefreshing) return;
    isRefreshing = true;
    try {
      var lastReload = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || '0');
      var now = Date.now();
      if (now - lastReload < 10000) return;
      sessionStorage.setItem(RELOAD_GUARD_KEY, String(now));
    } catch (e) {}

    if (typeof showToast === 'function') {
      var lang = document.documentElement.getAttribute('lang') || 'ckb';
      showToast(
        lang === 'en'
          ? 'New application version activated. Updating view...'
          : 'وەشانی نوێی بەرنامەکە چالاک کرا. نوێکردنەوەی پەڕە...'
      );
    }
    window.location.reload();
  });

  function registerAndMonitor() {
    var hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then(function (registration) {
        if (typeof window.__zipRefreshOfflineStatus === 'function') {
          window.__zipRefreshOfflineStatus();
        }
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        registration.addEventListener('updatefound', function () {
          var newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', function () {
            if (typeof window.__zipRefreshOfflineStatus === 'function') {
              window.__zipRefreshOfflineStatus();
            }
            if (newWorker.state === 'installed' && hadController && navigator.serviceWorker.controller) {
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
        registration.update().catch(function () {});
        document.addEventListener('visibilitychange', function () {
          if (document.visibilityState === 'visible') {
            registration.update().catch(function () {});
            if (typeof window.__zipRefreshOfflineStatus === 'function') {
              window.__zipRefreshOfflineStatus();
            }
          }
        });
        window.addEventListener('online', function () {
          registration.update().catch(function () {});
        });
      })
      .catch(function () {});
  }

  if (document.readyState === 'complete') {
    registerAndMonitor();
  } else {
    window.addEventListener('load', registerAndMonitor);
  }
})();
`;

jsContent += '\n' + swRegistrationSnippet;

// Compute deterministic content hashes for fingerprinted assets and overall build version
const cssHash = shortHash(cssContent);
const jsHash = shortHash(jsContent);
const htmlHash = shortHash(bodyHtml);
const manifestHash = shortHash(fs.readFileSync(path.join(publicDir, 'manifest.json'), 'utf8'));
const combinedHash = shortHash(`${cssHash}:${jsHash}:${htmlHash}:${manifestHash}`);
const buildVersion = `v2.5.0-${combinedHash}`;

const hashedCssFilename = `index.${cssHash}.css`;
const hashedJsFilename = `index.${jsHash}.js`;

// Write fingerprinted immutable assets + unhashed fallback aliases
fs.writeFileSync(path.join(assetsDir, hashedCssFilename), cssContent, 'utf8');
fs.writeFileSync(path.join(assetsDir, hashedJsFilename), jsContent, 'utf8');
fs.writeFileSync(path.join(assetsDir, 'index.css'), cssContent, 'utf8');
fs.writeFileSync(path.join(assetsDir, 'index.js'), jsContent, 'utf8');

// 4. Inject buildVersion and fingerprinted asset paths into dist/sw.js
const swTemplate = fs.readFileSync(path.join(publicDir, 'sw.js'), 'utf8');
const populatedSw = swTemplate
  .replace(/__BUILD_VERSION__/g, buildVersion)
  .replace(
    '// __HASHED_ASSETS__',
    `'/assets/${hashedCssFilename}',\n  '/assets/${hashedJsFilename}',`
  );
fs.writeFileSync(path.join(distDir, 'sw.js'), populatedSw, 'utf8');

// 5. Write dist/version.json for version inspection and diagnostics
const versionMeta = {
  app: 'ZIP QR',
  version: buildVersion,
  cacheName: `zip-qr-cache-${buildVersion}`,
  assets: {
    css: `/assets/${hashedCssFilename}`,
    js: `/assets/${hashedJsFilename}`,
  },
};
fs.writeFileSync(path.join(distDir, 'version.json'), JSON.stringify(versionMeta, null, 2) + '\n', 'utf8');

// 6. Write root-relative dist/index.html referencing ONLY local fingerprinted assets (zero external CDNs)
const prodIndexHtml = `<!DOCTYPE html>
<html lang="ckb" dir="rtl" data-build-version="${buildVersion}" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0" />
  <meta name="theme-color" content="#050811" />
  <meta name="application-name" content="ZIP QR" />
  <meta name="apple-mobile-web-app-title" content="ZIP QR" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="msapplication-tooltip" content="ZIP QR" />
  <meta name="msapplication-TileColor" content="#000000" />
  <meta name="msapplication-TileImage" content="/icons/mstile-150x150.png" />
  <meta name="msapplication-config" content="/browserconfig.xml" />
  <meta name="description" content="ZIP QR — Wi-Fi QR Decoder (SCAN. REVEAL. CONNECT.) Created and developed by Zardasht Muhammad." />
  <link rel="manifest" href="/manifest.json" />
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
  <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png" />
  <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192x192.png" />
  <link rel="icon" type="image/png" sizes="512x512" href="/icons/icon-512x512.png" />
  <link rel="shortcut icon" href="/favicon.ico" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon-180x180.png" />
  <link rel="apple-touch-icon" sizes="167x167" href="/icons/apple-touch-icon-167x167.png" />
  <link rel="apple-touch-icon" sizes="152x152" href="/icons/apple-touch-icon-152x152.png" />
  <link rel="apple-touch-icon" sizes="120x120" href="/icons/apple-touch-icon-120x120.png" />
  <title>ZIP QR</title>
  <link rel="stylesheet" href="/assets/${hashedCssFilename}" />
</head>
<body data-theme="electric-blue" dir="rtl" class="min-h-screen flex flex-col selection:bg-sky-500 selection:text-white">
${bodyHtml.trim()}
  <script src="/assets/${hashedJsFilename}"></script>
</body>
</html>
`;

fs.writeFileSync(path.join(distDir, 'index.html'), prodIndexHtml, 'utf8');
console.log(`✅ Built production bundle [${buildVersion}] into:`, distDir);
for (const f of fs.readdirSync(distDir)) {
  console.log('   -', f);
}
