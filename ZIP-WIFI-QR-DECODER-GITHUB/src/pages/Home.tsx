import React, { useState } from 'react';
import { ActivePage, ParsedQRResult, ScanHistoryEntry } from '../types';
import { UploadButton } from '../components/UploadButton';
import { NetworkCard } from '../components/NetworkCard';

interface HomeProps {
  onNavigate: (page: ActivePage) => void;
  onDecodedPayload: (rawPayload: string, sourceLabel?: string) => void;
  onSelectHistoryResult: (result: ParsedQRResult) => void;
  recentHistory: ScanHistoryEntry[];
  onError: (message: string) => void;
}

export const Home: React.FC<HomeProps> = ({
  onNavigate,
  onDecodedPayload,
  onSelectHistoryResult,
  recentHistory,
  onError,
}) => {
  const [pastedPayload, setPastedPayload] = useState('');

  const handlePasteDecode = () => {
    const trimmed = pastedPayload.trim();
    if (!trimmed) {
      onError('Please paste a QR code payload string to decode.');
      return;
    }
    onDecodedPayload(trimmed, 'Pasted QR Content');
    setPastedPayload('');
  };

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-800/90 bg-gradient-to-br from-[#0b1224] via-[#070b16] to-[#120b24] p-6 shadow-2xl sm:p-10">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-sky-300">
            <span>100% Local In-Browser Decoding • Zero Cloud Uploads</span>
          </div>

          <h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl">
            ZIP WiFi QR Decoder
          </h1>
          <p className="mt-2 font-mono text-xs font-bold uppercase tracking-[0.25em] text-purple-300 sm:text-sm">
            SCAN. REVEAL. CONNECT.
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
            Extract and reveal the exact Wi-Fi password, SSID, encryption protocol (WPA, WPA2,
            WPA3, WEP, Open, or DPP), and hidden network status encoded inside your Wi-Fi QR code
            using your camera, an uploaded image, or pasted QR content.
          </p>

          <div className="mt-8 flex flex-col items-stretch justify-center gap-4 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => onNavigate('scanner')}
              className="flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-sky-500 to-purple-600 px-8 py-4 text-sm font-black uppercase tracking-wider text-white shadow-xl shadow-sky-500/25 transition hover:brightness-110"
            >
              <span>SCAN QR CODE</span>
            </button>

            <UploadButton
              variant="secondary"
              label="UPLOAD QR IMAGE"
              onDecodedPayload={onDecodedPayload}
              onError={onError}
            />
          </div>
        </div>
      </section>

      {/* Primary Action Cards: Upload QR Image & Paste QR Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Action 2: Upload QR Image Dropzone */}
        <section
          aria-label="Upload QR Image"
          className="rounded-3xl border border-slate-800/90 bg-[#080d1a] p-6 flex flex-col justify-between"
        >
          <div className="mb-4">
            <span className="text-[11px] font-bold uppercase tracking-widest text-sky-400">
              Image Decoder
            </span>
            <h2 className="mt-1 text-lg font-bold text-white">UPLOAD QR IMAGE</h2>
            <p className="mt-1 text-xs text-slate-400">
              Select or drag and drop a QR code image (PNG, JPG, JPEG, or WEBP) from your device.
            </p>
          </div>
          <UploadButton
            variant="dropzone"
            label="UPLOAD QR IMAGE"
            onDecodedPayload={onDecodedPayload}
            onError={onError}
          />
        </section>

        {/* Action 3: Paste QR Content */}
        <section
          aria-label="Paste QR Content"
          className="rounded-3xl border border-slate-800/90 bg-[#080d1a] p-6 flex flex-col justify-between"
        >
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-purple-400">
              Direct Payload Decoder
            </span>
            <h2 className="mt-1 text-lg font-bold text-white">PASTE QR CONTENT</h2>
            <p className="mt-1 text-xs text-slate-400">
              Paste a raw Wi-Fi QR payload string (such as <code className="text-sky-300">WIFI:T:...;S:...;P:...;;</code> or <code className="text-purple-300">DPP:...;;</code>) to extract its credentials immediately.
            </p>
          </div>

          <div className="mt-4 space-y-3">
            <textarea
              rows={3}
              value={pastedPayload}
              onChange={(e) => setPastedPayload(e.target.value)}
              placeholder="Paste WIFI:... or DPP:... QR payload content here"
              className="w-full rounded-2xl border border-slate-700/80 bg-[#050811] p-3.5 font-mono text-xs text-white placeholder-slate-500 focus:border-sky-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={handlePasteDecode}
              className="w-full rounded-2xl bg-gradient-to-r from-sky-500 to-purple-600 px-6 py-3.5 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-sky-500/20 transition hover:brightness-110"
            >
              DECODE PASTED QR CONTENT
            </button>
          </div>
        </section>
      </div>

      {/* Recently Scanned Codes (User's own local history only) */}
      <section className="rounded-3xl border border-slate-800/90 bg-[#080d1a] p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white sm:text-lg">Recently Scanned Codes</h2>
            <p className="text-xs text-slate-400">
              Stored privately in your browser&apos;s local storage
            </p>
          </div>
          {recentHistory.length > 0 && (
            <button
              type="button"
              onClick={() => onNavigate('history')}
              className="rounded-xl border border-slate-700 px-3 py-1.5 text-xs font-semibold text-sky-300 hover:border-sky-500/40"
            >
              View All ({recentHistory.length})
            </button>
          )}
        </div>

        {recentHistory.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-slate-800/70 bg-[#0b1020]/50 p-6 text-center text-xs text-slate-400">
            No QR codes scanned yet. Use <strong>SCAN QR CODE</strong>, <strong>UPLOAD QR IMAGE</strong>, or <strong>PASTE QR CONTENT</strong> above to decode your first QR code.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {recentHistory.slice(0, 3).map((entry) => (
              <NetworkCard
                key={entry.id}
                result={entry.result}
                onSelect={onSelectHistoryResult}
                compact
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
