/**
 * ZIP QR — Wi-Fi QR Decoder — Type Definitions
 */

import { SupportedLanguage } from '../i18n/translations';

export type SecurityProtocol =
  | 'WPA'
  | 'WPA2'
  | 'WPA3'
  | 'WPA2-EAP'
  | 'WEP'
  | 'nopass'
  | 'DPP'
  | 'Unknown';

export type QRPayloadCategory =
  | 'WIFI'
  | 'DPP'
  | 'URL'
  | 'VCARD'
  | 'EMAIL'
  | 'SMS'
  | 'TEL'
  | 'GEO'
  | 'TEXT'
  | 'EMPTY';

export interface ExtraMetadataItem {
  key: string;
  label: string;
  value: string;
}

export interface ParsedQRResult {
  id: string;
  timestamp: string;
  rawPayload: string;
  category: QRPayloadCategory;
  formatLabel: string;
  isWifi: boolean;
  ssid: string;
  password: string | null;
  hasPasswordField: boolean;
  passwordStatusMessage: string;
  securityType: SecurityProtocol;
  securityDisplay: string;
  hiddenNetwork: boolean;
  hiddenDisplay: 'Yes' | 'No' | 'N/A';
  eapMethod?: string;
  anonymousIdentity?: string;
  identity?: string;
  phase2Method?: string;
  publicKey?: string;
  macAddress?: string;
  channelInfo?: string;
  extraFields: ExtraMetadataItem[];
  warnings: string[];
}

/**
 * Persistent Local History Record stored in IndexedDB (`zip_qr_local_db` -> `scan_history`).
 * Stores the actual decoded Wi-Fi password locally on the user's browser profile so users
 * can reveal and copy their saved Wi-Fi passwords across sessions, restarts, and app updates.
 */
export interface ScanHistoryEntry {
  id: string;
  timestamp: string;
  ssid: string;
  password: string | null;
  hasPassword: boolean;
  securityType: SecurityProtocol;
  securityDisplay: string;
  hiddenNetwork: boolean;
  category: QRPayloadCategory;
  formatLabel: string;
  result: ParsedQRResult;
}

export interface AppSettings {
  language: SupportedLanguage;
  historyEnabled: boolean;
  autoMaskPassword: boolean;
  accentTheme: 'electric-blue' | 'cyber-purple' | 'emerald-shield';
  soundEffects: boolean;
  preferredCameraId: string;
}

export type ActivePage = 'home' | 'scanner' | 'results' | 'history' | 'settings';
