"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.RELOAD_GUARD_KEY = void 0;
exports.registerServiceWorkerWithUpdates = registerServiceWorkerWithUpdates;
exports.shouldAllowControllerReload = shouldAllowControllerReload;
exports.verifyOfflineCacheReadiness = verifyOfflineCacheReadiness;
/**
 * ZIP QR — Wi-Fi QR Decoder — Service Worker Registration, Offline Readiness Verification & Update Lifecycle Manager
 *
 * Ensures:
 * 1. Registers `/sw.js` with `{ updateViaCache: 'none' }` so the browser always revalidates `/sw.js`.
 * 2. Verifies actual Cache Storage readiness (`verifyOfflineCacheReadiness`) by inspecting
 *    `window.caches` for the active `zip-qr-cache-*` cache and confirming that `/index.html`,
 *    `/manifest.json`, and `/offline-ready.json` are present before reporting "Offline Ready".
 * 3. Distinguishes between `navigator.onLine` connection status and actual offline cache readiness.
 * 4. Preserves all IndexedDB (`zip_qr_local_db`) scan history and saved Wi-Fi passwords across updates.
 */

const RELOAD_GUARD_KEY = 'zip_qr_sw_reload_guard_v1';
exports.RELOAD_GUARD_KEY = RELOAD_GUARD_KEY;
/**
 * Checks whether a `controllerchange` page reload should be permitted (10-second loop guard)
 */
function shouldAllowControllerReload(nowMs = Date.now()) {
  try {
    if (typeof sessionStorage === 'undefined') return true;
    const lastReload = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || '0');
    if (nowMs - lastReload < 10000) {
      return false;
    }
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(nowMs));
    return true;
  } catch {
    return true;
  }
}

/**
 * Inspects actual browser Cache Storage (`caches`) and Service Worker support to determine
 * whether all essential application files have been cached for offline execution.
 */
async function verifyOfflineCacheReadiness() {
  const isOnline = typeof navigator !== 'undefined' && 'onLine' in navigator ? Boolean(navigator.onLine) : true;
  if (typeof window === 'undefined' || typeof navigator === 'undefined' || !('serviceWorker' in navigator) || typeof caches === 'undefined') {
    return {
      isOnline,
      cacheReady: false,
      state: 'unavailable',
      cachedCacheName: null
    };
  }
  try {
    const keys = await caches.keys();
    const zipCaches = keys.filter(k => k.startsWith('zip-qr-cache-'));
    if (zipCaches.length === 0) {
      return {
        isOnline,
        cacheReady: false,
        state: isOnline ? 'caching' : 'incomplete',
        cachedCacheName: null
      };
    }
    const activeCacheName = zipCaches[zipCaches.length - 1];
    const cache = await caches.open(activeCacheName);
    const hasIndex = Boolean(await cache.match('/index.html'));
    const hasManifest = Boolean(await cache.match('/manifest.json'));
    const hasMarker = Boolean(await cache.match('/offline-ready.json'));
    const cacheReady = hasIndex && hasManifest && hasMarker;
    if (cacheReady) {
      return {
        isOnline,
        cacheReady: true,
        state: isOnline ? 'online-ready' : 'offline-ready',
        cachedCacheName: activeCacheName
      };
    }
    return {
      isOnline,
      cacheReady: false,
      state: isOnline ? 'caching' : 'incomplete',
      cachedCacheName: activeCacheName
    };
  } catch {
    return {
      isOnline,
      cacheReady: false,
      state: 'incomplete',
      cachedCacheName: null
    };
  }
}
function registerServiceWorkerWithUpdates(onUpdateNotification, onOfflineStatusChange) {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  const isSupportedProtocol = window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (!isSupportedProtocol) return;
  let isRefreshing = false;
  const refreshStatus = () => {
    if (onOfflineStatusChange) {
      void verifyOfflineCacheReadiness().then(onOfflineStatusChange);
    }
  };
  window.addEventListener('online', refreshStatus);
  window.addEventListener('offline', refreshStatus);
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data && event.data.type === 'OFFLINE_READY_STATUS') {
      refreshStatus();
    }
  });

  // Listen for the new Service Worker taking control of the page
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    refreshStatus();
    if (isRefreshing) return;
    isRefreshing = true;
    if (!shouldAllowControllerReload(Date.now())) {
      return;
    }
    if (onUpdateNotification) {
      const lang = document.documentElement.getAttribute('lang') || 'ckb';
      onUpdateNotification(lang === 'en' ? 'New application version activated. Updating view...' : 'وەشانی نوێی بەرنامەکە چالاک کرا. نوێکردنەوەی پەڕە...');
    }
    window.location.reload();
  });
  const registerAndMonitor = async () => {
    try {
      const hadController = Boolean(navigator.serviceWorker.controller);
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none'
      });
      refreshStatus();
      if (registration.waiting) {
        registration.waiting.postMessage({
          type: 'SKIP_WAITING'
        });
      }
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          refreshStatus();
          if (newWorker.state === 'installed' && hadController && navigator.serviceWorker.controller) {
            newWorker.postMessage({
              type: 'SKIP_WAITING'
            });
          }
        });
      });
      registration.update().catch(() => {});
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          registration.update().catch(() => {});
          refreshStatus();
        }
      });
      window.addEventListener('online', () => {
        registration.update().catch(() => {});
      });
    } catch {
      refreshStatus();
    }
  };
  if (document.readyState === 'complete') {
    void registerAndMonitor();
  } else {
    window.addEventListener('load', () => {
      void registerAndMonitor();
    });
  }
}