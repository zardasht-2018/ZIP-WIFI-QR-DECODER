/**
 * ZIP WiFi QR Decoder — Privacy-First Local Storage Service
 *
 * Manages optional local scan history and application preferences.
 * - All operations are wrapped in `try/catch` for sandboxed iframe and private-browsing safety.
 * - Passwords and scan records never leave the user's device.
 * - When history is disabled (`historyEnabled: false`), new scans are never persisted.
 */

import { AppSettings, ParsedQRResult, ScanHistoryEntry } from '../types';

const HISTORY_STORAGE_KEY = 'zip_wifi_qr_history_v1';
const SETTINGS_STORAGE_KEY = 'zip_wifi_qr_settings_v1';

const DEFAULT_SETTINGS: AppSettings = {
  historyEnabled: true,
  autoMaskPassword: false,
  accentTheme: 'electric-blue',
  soundEffects: true,
  preferredCameraId: '',
};

let memoryHistoryFallback: ScanHistoryEntry[] = [];
let memorySettingsFallback: AppSettings = { ...DEFAULT_SETTINGS };

export class StorageService {
  /**
   * Loads user preferences from localStorage with safe fallback
   */
  public getSettings(): AppSettings {
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!raw) return { ...memorySettingsFallback };
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
      };
    } catch {
      return { ...memorySettingsFallback };
    }
  }

  /**
   * Saves updated user preferences
   */
  public saveSettings(next: Partial<AppSettings>): AppSettings {
    const current = this.getSettings();
    const updated: AppSettings = { ...current, ...next };
    memorySettingsFallback = updated;
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Sandboxed iframe fallback
    }
    return updated;
  }

  /**
   * Retrieves stored scan history entries sorted newest-first
   */
  public getHistory(): ScanHistoryEntry[] {
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
  public addHistoryEntry(result: ParsedQRResult): ScanHistoryEntry[] {
    const settings = this.getSettings();
    if (!settings.historyEnabled) {
      return this.getHistory();
    }

    const existing = this.getHistory();
    const entry: ScanHistoryEntry = {
      id: result.id,
      timestamp: result.timestamp,
      ssid: result.ssid,
      category: result.category,
      securityDisplay: result.securityDisplay,
      result,
    };

    // Deduplicate identical consecutive rawPayload or prepend up to 50 entries
    const filtered = existing.filter((item) => item.id !== entry.id && item.result.rawPayload !== result.rawPayload);
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
  public deleteHistoryEntry(id: string): ScanHistoryEntry[] {
    const existing = this.getHistory();
    const updated = existing.filter((item) => item.id !== id);
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
  public clearHistory(): void {
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
  public clearAllStoredData(): AppSettings {
    memoryHistoryFallback = [];
    memorySettingsFallback = { ...DEFAULT_SETTINGS };
    try {
      localStorage.removeItem(HISTORY_STORAGE_KEY);
      localStorage.removeItem(SETTINGS_STORAGE_KEY);
    } catch {
      // Sandboxed iframe fallback
    }
    return { ...DEFAULT_SETTINGS };
  }
}

export const storageService = new StorageService();
