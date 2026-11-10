"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.StorageService = exports.IDB_SCHEMA_VERSION = exports.IDB_HISTORY_STORE = exports.IDB_DATABASE_NAME = void 0;
exports.normalizeHistoryEntry = normalizeHistoryEntry;
exports.storageService = void 0;
var _translations = require("./translations.cjs");
/**
 * ZIP QR — Wi-Fi QR Decoder — Persistent Local IndexedDB History & Preferences Service
 *
 * Architecture & Privacy Guarantees:
 * 1. Primary Persistent Storage via IndexedDB (`zip_qr_local_db`, Schema v2, Store `scan_history`):
 *    - Stores complete Wi-Fi scan records including the ACTUAL Wi-Fi password (`password`)
 *      so users retain their scanned networks and passwords across browser restarts, device
 *      reboots, tab refreshes, and PWA updates.
 *    - Requests durable storage via `navigator.storage.persist()` where supported.
 * 2. Safe Schema Versioning & Automatic Migration:
 *    - Upgrades cleanly from Schema v1 to v2 without destructive resets, backfilling normalized
 *      `password`, `hasPassword`, `securityType`, `hiddenNetwork`, and `formatLabel` fields on
 *      any existing records.
 *    - Automatically migrates any legacy `localStorage` history entries (`zip_wifi_qr_history_v1`)
 *      into IndexedDB on startup so existing users never lose historical scans.
 * 3. Strict Local-Only Privacy:
 *    - Never transmits Wi-Fi passwords, SSIDs, or scan history to any server.
 *    - Never logs credentials to `console`.
 *    - Provides no cloud sync, no account system, and no history import/export/backup files.
 */

const IDB_DATABASE_NAME = 'zip_qr_local_db';
exports.IDB_DATABASE_NAME = IDB_DATABASE_NAME;
const IDB_SCHEMA_VERSION = 2;
exports.IDB_SCHEMA_VERSION = IDB_SCHEMA_VERSION;
const IDB_HISTORY_STORE = 'scan_history';
exports.IDB_HISTORY_STORE = IDB_HISTORY_STORE;
const LEGACY_HISTORY_STORAGE_KEY = 'zip_wifi_qr_history_v1';
const SETTINGS_STORAGE_KEY = 'zip_wifi_qr_settings_v1';
const MAX_HISTORY_RECORDS = 200;
const DEFAULT_SETTINGS = {
  language: _translations.DEFAULT_LANGUAGE,
  historyEnabled: true,
  autoMaskPassword: false,
  accentTheme: 'electric-blue',
  soundEffects: true,
  preferredCameraId: ''
};

/**
 * Normalizes any ParsedQRResult or legacy history entry into a complete v2 ScanHistoryEntry
 * ensuring the actual Wi-Fi password is preserved in both top-level `entry.password` and `entry.result.password`.
 */
function normalizeHistoryEntry(input) {
  const isEntry = 'result' in input && input.result && typeof input.result === 'object';
  const res = isEntry ? input.result : input;
  const explicitPassword = isEntry && input.password !== undefined ? input.password : res.password ?? null;
  const hasPassword = Boolean(res.hasPasswordField && explicitPassword !== null && explicitPassword.length > 0);
  const normalizedResult = {
    ...res,
    password: explicitPassword,
    hasPasswordField: res.hasPasswordField ?? explicitPassword !== null
  };
  return {
    id: (isEntry ? input.id : res.id) || `scan_${Date.now()}`,
    timestamp: (isEntry ? input.timestamp : res.timestamp) || new Date().toISOString(),
    ssid: (isEntry ? input.ssid : res.ssid) || '(Unnamed Network)',
    password: explicitPassword,
    hasPassword,
    securityType: res.securityType || 'Unknown',
    securityDisplay: (isEntry ? input.securityDisplay : res.securityDisplay) || 'Unknown',
    hiddenNetwork: Boolean(res.hiddenNetwork),
    category: (isEntry ? input.category : res.category) || 'WIFI',
    formatLabel: res.formatLabel || 'Wi-Fi Network Configuration (WIFI:)',
    result: normalizedResult
  };
}
let memorySettingsFallback = {
  ...DEFAULT_SETTINGS
};
class StorageService {
  historyCache = [];
  idbDatabase = null;
  initPromise = null;
  simulatedIdbStore = new Map();
  simulatedSchemaVersion = IDB_SCHEMA_VERSION;
  persistenceGranted = false;
  listeners = new Set();
  constructor() {
    this.loadLegacyOrInitialSyncFallback();
    void this.initHistoryDatabase();
  }

  /**
   * Subscribes to history changes (such as async IndexedDB hydration on startup)
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  notifyListeners() {
    const snapshot = this.getHistory();
    for (const fn of this.listeners) {
      try {
        fn(snapshot);
      } catch {
        // Ignore listener error
      }
    }
  }

  /**
   * Requests persistent browser storage via `navigator.storage.persist()` where supported.
   * Note: Browser storage policies remain controlled by the user's browser and OS.
   */
  async requestPersistentStorage() {
    try {
      if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.persist === 'function') {
        const alreadyPersisted = typeof navigator.storage.persisted === 'function' ? await navigator.storage.persisted() : false;
        if (alreadyPersisted) {
          this.persistenceGranted = true;
          return {
            supported: true,
            persisted: true
          };
        }
        const granted = await navigator.storage.persist();
        this.persistenceGranted = Boolean(granted);
        return {
          supported: true,
          persisted: this.persistenceGranted
        };
      }
    } catch {
      // Ignore storage manager permission errors
    }
    return {
      supported: false,
      persisted: false
    };
  }
  isNativeIndexedDBAvailable() {
    try {
      return typeof indexedDB !== 'undefined' && indexedDB !== null && typeof indexedDB.open === 'function';
    } catch {
      return false;
    }
  }

  /**
   * Opens and initializes the IndexedDB database (`zip_qr_local_db`, v2), executing
   * non-destructive schema migrations from v1 -> v2 and migrating any legacy localStorage records.
   */
  async initHistoryDatabase() {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      await this.requestPersistentStorage();
      if (!this.isNativeIndexedDBAvailable()) {
        // Use in-process transactional store when running in Node.js test runner or restricted sandbox
        return this.getHistory();
      }
      try {
        const db = await new Promise((resolve, reject) => {
          const req = indexedDB.open(IDB_DATABASE_NAME, IDB_SCHEMA_VERSION);
          req.onupgradeneeded = event => {
            const database = req.result;
            const tx = req.transaction;
            let store;
            if (!database.objectStoreNames.contains(IDB_HISTORY_STORE)) {
              store = database.createObjectStore(IDB_HISTORY_STORE, {
                keyPath: 'id'
              });
            } else if (tx) {
              store = tx.objectStore(IDB_HISTORY_STORE);
            } else {
              return;
            }
            if (!store.indexNames.contains('by_timestamp')) {
              store.createIndex('by_timestamp', 'timestamp', {
                unique: false
              });
            }
            if (!store.indexNames.contains('by_ssid')) {
              store.createIndex('by_ssid', 'ssid', {
                unique: false
              });
            }

            // Safe v1 -> v2 record normalization without deleting existing records or passwords
            const oldVersion = event.oldVersion || 0;
            if (oldVersion > 0 && oldVersion < 2) {
              const cursorReq = store.openCursor();
              cursorReq.onsuccess = () => {
                const cursor = cursorReq.result;
                if (cursor) {
                  const upgraded = normalizeHistoryEntry(cursor.value);
                  cursor.update(upgraded);
                  cursor.continue();
                }
              };
            }
          };
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
        });
        this.idbDatabase = db;

        // Read all existing records from IndexedDB
        const idbRecords = await this.readAllFromNativeIdb(db);

        // Merge any legacy localStorage records or pre-hydration records into IndexedDB
        const mergedMap = new Map();
        for (const item of [...this.historyCache, ...idbRecords]) {
          const norm = normalizeHistoryEntry(item);
          if (!mergedMap.has(norm.id)) {
            mergedMap.set(norm.id, norm);
          }
        }
        const mergedList = Array.from(mergedMap.values()).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, MAX_HISTORY_RECORDS);
        this.historyCache = mergedList;

        // Persist any migrated records into IndexedDB and remove legacy localStorage key
        for (const entry of mergedList) {
          await this.putToNativeIdb(db, entry);
        }
        try {
          if (typeof localStorage !== 'undefined' && localStorage.getItem(LEGACY_HISTORY_STORAGE_KEY)) {
            localStorage.removeItem(LEGACY_HISTORY_STORAGE_KEY);
          }
        } catch {
          // ignore
        }
        this.notifyListeners();
        return this.getHistory();
      } catch {
        return this.getHistory();
      }
    })();
    return this.initPromise;
  }
  readAllFromNativeIdb(db) {
    return new Promise(resolve => {
      try {
        const tx = db.transaction(IDB_HISTORY_STORE, 'readonly');
        const store = tx.objectStore(IDB_HISTORY_STORE);
        const req = store.getAll();
        req.onsuccess = () => {
          const rows = Array.isArray(req.result) ? req.result.map(normalizeHistoryEntry) : [];
          rows.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          resolve(rows);
        };
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  }
  putToNativeIdb(db, entry) {
    return new Promise(resolve => {
      try {
        const tx = db.transaction(IDB_HISTORY_STORE, 'readwrite');
        const store = tx.objectStore(IDB_HISTORY_STORE);
        store.put(entry);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }
  deleteFromNativeIdb(db, id) {
    return new Promise(resolve => {
      try {
        const tx = db.transaction(IDB_HISTORY_STORE, 'readwrite');
        const store = tx.objectStore(IDB_HISTORY_STORE);
        store.delete(id);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }
  clearNativeIdb(db) {
    return new Promise(resolve => {
      try {
        const tx = db.transaction(IDB_HISTORY_STORE, 'readwrite');
        const store = tx.objectStore(IDB_HISTORY_STORE);
        store.clear();
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }
  loadLegacyOrInitialSyncFallback() {
    try {
      if (typeof localStorage === 'undefined') return;
      const raw = localStorage.getItem(LEGACY_HISTORY_STORAGE_KEY);
      if (!raw) return;
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        this.historyCache = list.map(normalizeHistoryEntry);
        for (const item of this.historyCache) {
          this.simulatedIdbStore.set(item.id, item);
        }
      }
    } catch {
      // Ignore storage access errors
    }
  }

  /**
   * Simulates a safe schema upgrade (v1 -> v2) on existing records and verifies zero data or password loss
   */
  migrateRecordsToLatestSchema(rawRecords) {
    this.simulatedSchemaVersion = IDB_SCHEMA_VERSION;
    const migrated = rawRecords.map(rec => normalizeHistoryEntry(rec));
    this.simulatedIdbStore.clear();
    for (const entry of migrated) {
      this.simulatedIdbStore.set(entry.id, entry);
    }
    this.historyCache = migrated.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return this.getHistory();
  }
  getSchemaVersion() {
    return this.simulatedSchemaVersion;
  }

  /**
   * Loads user preferences from localStorage with safe fallback.
   * Defaults `language` to Kurdish Sorani (`ckb`) for first-time visitors.
   */
  getSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      const savedLang = localStorage.getItem(_translations.LANGUAGE_STORAGE_KEY);
      if (!raw) {
        return {
          ...memorySettingsFallback,
          language: savedLang === 'en' || savedLang === 'ckb' ? savedLang : memorySettingsFallback.language
        };
      }
      const parsed = JSON.parse(raw);
      const resolvedLang = parsed.language === 'en' || parsed.language === 'ckb' ? parsed.language : savedLang === 'en' || savedLang === 'ckb' ? savedLang : _translations.DEFAULT_LANGUAGE;
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        language: resolvedLang
      };
    } catch {
      return {
        ...memorySettingsFallback
      };
    }
  }

  /**
   * Saves updated user preferences and persists language selection
   */
  saveSettings(next) {
    const current = this.getSettings();
    const updated = {
      ...current,
      ...next
    };
    memorySettingsFallback = updated;
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
      if (updated.language) {
        localStorage.setItem(_translations.LANGUAGE_STORAGE_KEY, updated.language);
      }
    } catch {
      // Sandboxed iframe fallback
    }
    return updated;
  }

  /**
   * Retrieves stored scan history entries sorted newest-first, including actual saved Wi-Fi passwords.
   */
  getHistory() {
    return this.historyCache.map(entry => ({
      ...entry,
      result: {
        ...entry.result
      }
    }));
  }

  /**
   * Asynchronous IndexedDB history read ensuring database initialization has completed
   */
  async getHistoryAsync() {
    await this.initHistoryDatabase();
    if (this.idbDatabase) {
      const rows = await this.readAllFromNativeIdb(this.idbDatabase);
      this.historyCache = rows;
    }
    return this.getHistory();
  }

  /**
   * Searches local History by SSID, security type, or format category
   */
  searchHistory(query) {
    const all = this.getHistory();
    const q = (query || '').trim().toLowerCase();
    if (!q) return all;
    return all.filter(item => item.ssid.toLowerCase().includes(q) || item.securityDisplay.toLowerCase().includes(q) || item.securityType.toLowerCase().includes(q) || item.category.toLowerCase().includes(q) || item.formatLabel.toLowerCase().includes(q));
  }

  /**
   * Adds a scan result (including its actual Wi-Fi password) to persistent IndexedDB history
   * ONLY if `historyEnabled` is true.
   */
  addHistoryEntry(result) {
    const settings = this.getSettings();
    if (!settings.historyEnabled) {
      return this.getHistory();
    }
    const entry = normalizeHistoryEntry(result);

    // Remove any duplicate of the exact same rawPayload or ID so re-scanning updates timestamp at top
    const existing = this.historyCache.filter(item => {
      if (item.id === entry.id) return false;
      if (item.result.rawPayload && entry.result.rawPayload && item.result.rawPayload === entry.result.rawPayload) {
        if (this.idbDatabase) {
          void this.deleteFromNativeIdb(this.idbDatabase, item.id);
        }
        this.simulatedIdbStore.delete(item.id);
        return false;
      }
      return true;
    });
    const updated = [entry, ...existing].slice(0, MAX_HISTORY_RECORDS);
    this.historyCache = updated;
    this.simulatedIdbStore.set(entry.id, entry);
    if (this.idbDatabase) {
      void this.putToNativeIdb(this.idbDatabase, entry);
    }
    this.notifyListeners();
    return this.getHistory();
  }

  /**
   * Deletes a single history entry by ID from both memory cache and IndexedDB without affecting other records
   */
  deleteHistoryEntry(id) {
    this.historyCache = this.historyCache.filter(item => item.id !== id);
    this.simulatedIdbStore.delete(id);
    if (this.idbDatabase) {
      void this.deleteFromNativeIdb(this.idbDatabase, id);
    }
    this.notifyListeners();
    return this.getHistory();
  }

  /**
   * Clears all scan history entries from IndexedDB and memory cache
   */
  clearHistory() {
    this.historyCache = [];
    this.simulatedIdbStore.clear();
    if (this.idbDatabase) {
      void this.clearNativeIdb(this.idbDatabase);
    }
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(LEGACY_HISTORY_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
    this.notifyListeners();
  }

  /**
   * Wipes all stored data (both IndexedDB history and settings) and resets to defaults
   */
  clearAllStoredData() {
    const currentLang = this.getSettings().language;
    this.clearHistory();
    memorySettingsFallback = {
      ...DEFAULT_SETTINGS,
      language: currentLang
    };
    try {
      localStorage.removeItem(SETTINGS_STORAGE_KEY);
    } catch {
      // Sandboxed iframe fallback
    }
    return {
      ...memorySettingsFallback
    };
  }
}
exports.StorageService = StorageService;
const storageService = new StorageService();
exports.storageService = storageService;