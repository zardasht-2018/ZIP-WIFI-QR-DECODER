"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.RELOAD_GUARD_KEY = void 0;
exports.registerServiceWorkerWithUpdates = registerServiceWorkerWithUpdates;
exports.shouldAllowControllerReload = shouldAllowControllerReload;
/**
 * ZIP QR — Wi-Fi QR Decoder — Service Worker Registration & Update Lifecycle Manager
 *
 * Ensures:
 * 1. Registers `/sw.js` with `{ updateViaCache: 'none' }` so the browser always revalidates `/sw.js`.
 * 2. Proactively checks `registration.update()` on page load, tab visibility focus, and online restore.
 * 3. Detects waiting/installing Service Workers, signals `SKIP_WAITING`, and performs a single
 *    controlled reload (`controllerchange`) guarded against reload loops.
 * 4. Preserves all IndexedDB (`zip_qr_local_db`) scan history, saved Wi-Fi passwords, and user settings across updates.
 */

const RELOAD_GUARD_KEY = 'zip_qr_sw_reload_guard_v1';

/**
 * Checks whether a `controllerchange` page reload should be permitted (10-second loop guard)
 */
exports.RELOAD_GUARD_KEY = RELOAD_GUARD_KEY;
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
function registerServiceWorkerWithUpdates(onUpdateNotification) {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  const isSupportedProtocol = window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (!isSupportedProtocol) return;
  let isRefreshing = false;

  // Listen for the new Service Worker taking control of the page
  navigator.serviceWorker.addEventListener('controllerchange', () => {
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

      // If a waiting worker already exists, activate it immediately
      if (registration.waiting) {
        registration.waiting.postMessage({
          type: 'SKIP_WAITING'
        });
      }

      // Detect newly installing workers
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && hadController && navigator.serviceWorker.controller) {
            newWorker.postMessage({
              type: 'SKIP_WAITING'
            });
          }
        });
      });

      // Proactively check for SW updates on registration
      registration.update().catch(() => {});

      // Check for SW updates whenever the user returns to the tab or regains internet connectivity
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          registration.update().catch(() => {});
        }
      });
      window.addEventListener('online', () => {
        registration.update().catch(() => {});
      });
    } catch {
      // SW registration optional in restricted contexts
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