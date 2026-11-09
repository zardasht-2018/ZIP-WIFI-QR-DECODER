import React, { useState } from 'react';
import { AppSettings } from '../types';

interface SettingsPageProps {
  settings: AppSettings;
  historyCount: number;
  onUpdateSettings: (partial: Partial<AppSettings>) => void;
  onClearAllStoredData: () => void;
  onNotify: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  settings,
  historyCount,
  onUpdateSettings,
  onClearAllStoredData,
  onNotify,
}) => {
  const [confirmWipe, setConfirmWipe] = useState(false);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="rounded-3xl border border-slate-800 bg-[#080d1a] p-6">
        <h1 className="text-2xl font-black text-white">Settings & Privacy Control</h1>
        <p className="mt-1 text-xs text-slate-400">
          Configure appearance, password display behavior, and local storage privacy controls.
        </p>
      </div>

      {/* Theme Settings */}
      <section className="rounded-3xl border border-slate-800 bg-[#080d1a] p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-sky-400">
          1. Theme & Display Preferences
        </h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(
            [
              {
                id: 'electric-blue',
                title: 'Electric Blue & Purple',
                desc: 'Signature ZIP dark cyber surface',
              },
              {
                id: 'cyber-purple',
                title: 'Neon Violet Core',
                desc: 'Deep obsidian with ultraviolet glow',
              },
              {
                id: 'emerald-shield',
                title: 'Emerald Security',
                desc: 'High-contrast tactical dark theme',
              },
            ] as const
          ).map((theme) => (
            <button
              key={theme.id}
              type="button"
              onClick={() => {
                onUpdateSettings({ accentTheme: theme.id });
                onNotify(`Theme updated to ${theme.title}`, 'info');
              }}
              className={`rounded-2xl border p-4 text-left transition ${
                settings.accentTheme === theme.id
                  ? 'border-sky-400 bg-sky-500/15 text-white'
                  : 'border-slate-800 bg-[#0b1222] text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="text-sm font-bold">{theme.title}</div>
              <div className="mt-1 text-xs text-slate-400">{theme.desc}</div>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-[#0b1222] p-4">
          <div>
            <div className="text-sm font-bold text-white">Mask Extracted Password by Default</div>
            <div className="text-xs text-slate-400">
              When enabled, passwords start hidden (••••••) until you tap &quot;Show Password&quot;.
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.autoMaskPassword}
            onChange={(e) => onUpdateSettings({ autoMaskPassword: e.target.checked })}
            className="h-5 w-5 accent-sky-500"
          />
        </div>
      </section>

      {/* History Preferences */}
      <section className="rounded-3xl border border-slate-800 bg-[#080d1a] p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-sky-400">
          2. Scan History Preferences
        </h2>

        <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-[#0b1222] p-4">
          <div>
            <div className="text-sm font-bold text-white">Enable Optional Scan History</div>
            <div className="text-xs text-slate-400">
              Keep a local list of scanned QR codes in this browser ({historyCount} entries
              currently stored).
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.historyEnabled}
            onChange={(e) => onUpdateSettings({ historyEnabled: e.target.checked })}
            className="h-5 w-5 accent-sky-500"
          />
        </div>
      </section>

      {/* Privacy & Security Architecture */}
      <section className="rounded-3xl border border-slate-800 bg-[#080d1a] p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-sky-400">
          3. Security & Zero-Cloud Privacy Guarantee
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs text-slate-300">
          <div className="rounded-2xl border border-slate-800 bg-[#0b1222] p-4">
            <div className="font-bold text-white">100% Local In-Browser Decoding</div>
            <p className="mt-1 text-slate-400">
              All camera frames and uploaded QR images are decoded directly inside your browser&apos;s
              JavaScript memory. No images or passwords are ever uploaded to any external server.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-[#0b1222] p-4">
            <div className="font-bold text-white">Safe Export & Untrusted Input Sanitization</div>
            <p className="mt-1 text-slate-400">
              Exported files use neutral timestamped filenames so credentials are never leaked in
              filesystem listings, and external URLs are never opened automatically.
            </p>
          </div>
        </div>

        <div className="pt-2">
          {!confirmWipe ? (
            <button
              type="button"
              onClick={() => setConfirmWipe(true)}
              className="rounded-xl border border-rose-500/40 bg-rose-500/15 px-5 py-3 text-xs font-bold uppercase tracking-wider text-rose-300 hover:bg-rose-500/25"
            >
              Clear All Stored Data (History & Settings)
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-rose-500/40 bg-rose-950/30 p-4">
              <span className="text-xs font-semibold text-rose-200">
                Wipe all local history and reset settings to factory defaults?
              </span>
              <button
                type="button"
                onClick={() => {
                  onClearAllStoredData();
                  setConfirmWipe(false);
                }}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold uppercase text-white"
              >
                Confirm Wipe
              </button>
              <button
                type="button"
                onClick={() => setConfirmWipe(false)}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </section>

      {/* About ZIP */}
      <section className="rounded-3xl border border-slate-800 bg-[#080d1a] p-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-sky-400">
          4. About ZIP WiFi QR Decoder
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-slate-300">
          <strong>ZIP WiFi QR Decoder (v2.4.0 PWA)</strong> — Tagline:{' '}
          <span className="font-mono text-sky-300">SCAN. REVEAL. CONNECT.</span> Engineered for
          cross-platform compatibility across iPhone, iPad, Android, Windows, macOS, and Linux.
          Supports IEEE 802.11 / ZXing <code className="text-sky-300">WIFI:</code> payloads (WPA,
          WPA2, WPA3-SAE, WPA2-EAP, WEP, Open), RFC-compliant backslash character unescaping, and
          Wi-Fi Alliance Easy Connect (<code className="text-purple-300">DPP:</code>) QR inspection.
        </p>
      </section>
    </div>
  );
};
