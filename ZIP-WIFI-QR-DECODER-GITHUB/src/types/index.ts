/**
 * ZIP WiFi QR Decoder — Type Definitions
 */

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

export interface ScanHistoryEntry {
  id: string;
  timestamp: string;
  ssid: string;
  category: QRPayloadCategory;
  securityDisplay: string;
  result: ParsedQRResult;
}

export interface AppSettings {
  historyEnabled: boolean;
  autoMaskPassword: boolean;
  accentTheme: 'electric-blue' | 'cyber-purple' | 'emerald-shield';
  soundEffects: boolean;
  preferredCameraId: string;
}

export type ActivePage = 'home' | 'scanner' | 'results' | 'history' | 'settings';
