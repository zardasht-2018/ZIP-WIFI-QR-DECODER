"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.storageService = exports.StorageService = void 0;
var _translations = require("./translations.cjs");
/**
 * ZIP QR — Wi-Fi QR Decoder — Privacy-First Local Storage Service
 *
 * Manages optional local scan history, language preference (defaulting to 'ckb' Kurdish Sorani),
 * and application preferences.
 */

const HISTORY_STORAGE_KEY = 'zip_wifi_qr_history_v1';
const SETTINGS_STORAGE_KEY = 'zip_wifi_qr_settings_v1';
const DEFAULT_SETTINGS = {
  language: _translations.DEFAULT_LANGUAGE,
  historyEnabled: true,
  autoMaskPassword: false,
  accentTheme: 'electric-blue',
  soundEffects: true,
  preferredCameraId: ''
};
let memoryHistoryFallback = [];
let memorySettingsFallback = {
  ...DEFAULT_SETTINGS
};
class StorageService {
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
   * Retrieves stored scan history entries sorted newest-first
   */
  getHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (!raw) return [...memoryHistoryFallback];
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) return [];
      return list;
    } catch {
      return [...memoryHistoryFallback];
    }
  }

  /**
   * Adds a scan result to local history ONLY if `historyEnabled` is true
   */
  addHistoryEntry(result) {
    const settings = this.getSettings();
    if (!settings.historyEnabled) {
      return this.getHistory();
    }
    const existing = this.getHistory();
    const entry = {
      id: result.id,
      timestamp: result.timestamp,
      ssid: result.ssid,
      category: result.category,
      securityDisplay: result.securityDisplay,
      result
    };
    const filtered = existing.filter(item => item.id !== entry.id && item.result.rawPayload !== result.rawPayload);
    const updated = [entry, ...filtered].slice(0, 50);
    memoryHistoryFallback = updated;
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Sandboxed iframe fallback
    }
    return updated;
  }

  /**
   * Deletes a single history entry by ID
   */
  deleteHistoryEntry(id) {
    const existing = this.getHistory();
    const updated = existing.filter(item => item.id !== id);
    memoryHistoryFallback = updated;
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Sandboxed iframe fallback
    }
    return updated;
  }

  /**
   * Clears all scan history entries
   */
  clearHistory() {
    memoryHistoryFallback = [];
    try {
      localStorage.removeItem(HISTORY_STORAGE_KEY);
    } catch {
      // Sandboxed iframe fallback
    }
  }

  /**
   * Wipes all stored data (both history and settings) and resets to defaults
   */
  clearAllStoredData() {
    const currentLang = this.getSettings().language;
    memoryHistoryFallback = [];
    memorySettingsFallback = {
      ...DEFAULT_SETTINGS,
      language: currentLang
    };
    try {
      localStorage.removeItem(HISTORY_STORAGE_KEY);
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