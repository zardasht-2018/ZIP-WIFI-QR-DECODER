import React, { useState } from 'react';
import { ParsedQRResult } from '../types';
import { PasswordDisplay } from '../components/PasswordDisplay';
import {
  copyTextToClipboard,
  downloadDecodedResult,
  formatResultReport,
} from '../utils/clipboardAndExport';

interface ResultsPageProps {
  result: ParsedQRResult | null;
  sourceLabel?: string;
  autoMaskPassword?: boolean;
  onScanAnother: () => void;
  onDecodedPayload: (rawPayload: string, sourceLabel?: string) => void;
  onNotify: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export const ResultsPage: React.FC<ResultsPageProps> = ({
  result,
  sourceLabel,
  autoMaskPassword = false,
  onScanAnother,
  onDecodedPayload,
  onNotify,
}) => {
  const [customPayloadInput, setCustomPayloadInput] = useState('');

  if (!result) {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-slate-800 bg-[#080d1a] p-8 text-center">
        <h2 className="text-xl font-bold text-white">No QR Code Decoded Yet</h2>
        <p className="mt-2 text-sm text-slate-400">
          Scan a Wi-Fi QR code with your camera, upload a QR image file, or paste QR content to inspect its credentials.
        </p>
        <button
          type="button"
          onClick={onScanAnother}
          className="mt-6 rounded-2xl bg-gradient-to-r from-sky-500 to-purple-600 px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-sky-500/20"
        >
          Scan QR Code
        </button>
      </div>
    );
  }

  const handleCopyAll = async () => {
    const report = formatResultReport(result);
    const ok = await copyTextToClipboard(report);
    if (ok) {
      onNotify('All decoded network information copied to clipboard!', 'success');
    } else {
      onNotify('Unable to copy automatically.', 'error');
    }
  };

  const handleCopySsid = async () => {
    const ok = await copyTextToClipboard(result.ssid);
    if (ok) {
      onNotify(`SSID "${result.ssid}" copied to clipboard!`, 'success');
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-slate-800 bg-[#080d1a] p-6 sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg border border-sky-500/40 bg-sky-500/15 px-2.5 py-0.5 text-xs font-bold uppercase text-sky-300">
              {result.category}
            </span>
            {sourceLabel && (
              <span className="rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-0.5 text-xs text-slate-300">
                Source: {sourceLabel}
              </span>
            )}
          </div>
          <h1 className="mt-2 break-all text-2xl font-black text-white sm:text-3xl">
            {result.ssid}
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Decoded on {new Date(result.timestamp).toLocaleString()}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleCopySsid}
            className="rounded-xl border border-slate-700 bg-slate-800/90 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-200 hover:border-sky-400"
          >
            Copy SSID
          </button>
          <button
            type="button"
            onClick={onScanAnother}
            className="rounded-xl bg-gradient-to-r from-sky-500 to-purple-600 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-sky-500/20 hover:brightness-110"
          >
            Scan Another Code
          </button>
        </div>
      </div>

      {/* Prominent Password Extraction Card */}
      <PasswordDisplay
        result={result}
        defaultMasked={autoMaskPassword}
        onNotify={onNotify}
      />

      {/* Warnings / Non-Wi-Fi Advisories */}
      {result.warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200 space-y-1">
          {result.warnings.map((w, idx) => (
            <p key={idx} className="font-medium">
              • {w}
            </p>
          ))}
        </div>
      )}

      {/* NETWORK INFORMATION GRID */}
      <div className="rounded-3xl border border-slate-800 bg-[#080d1a] p-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-sky-400">
          NETWORK INFORMATION
        </h2>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-800/90 bg-[#0b1222] p-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              1. Wi-Fi Name (SSID)
            </span>
            <p className="mt-1 break-all font-mono text-base font-bold text-white">
              {result.ssid}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800/90 bg-[#0b1222] p-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              2. Wi-Fi Password
            </span>
            <p className="mt-1 break-all font-mono text-base font-bold text-sky-300">
              {result.hasPasswordField && result.password !== null
                ? result.password
                : result.passwordStatusMessage}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800/90 bg-[#0b1222] p-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              3. Security Type
            </span>
            <p className="mt-1 text-base font-bold text-white">{result.securityDisplay}</p>
          </div>

          <div className="rounded-2xl border border-slate-800/90 bg-[#0b1222] p-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              4. Hidden Network Status
            </span>
            <p className="mt-1 text-base font-bold text-white">{result.hiddenDisplay}</p>
          </div>

          <div className="rounded-2xl border border-slate-800/90 bg-[#0b1222] p-4 sm:col-span-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              5. QR Payload Format
            </span>
            <p className="mt-1 text-sm font-semibold text-purple-300">{result.formatLabel}</p>
          </div>
        </div>

        {/* 6. Additional Information Present in the QR Code */}
        <div className="mt-6 border-t border-slate-800 pt-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            6. Additional Information Encoded in QR Code
          </h3>
          {result.extraFields.length === 0 ? (
            <p className="mt-2 text-xs text-slate-400">
              No additional optional parameters (such as EAP identity, phase 2 method, or BSSID) are
              present in this QR code.
            </p>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {result.extraFields.map((item, idx) => (
                <div
                  key={`${item.key}-${idx}`}
                  className="rounded-xl border border-slate-800 bg-[#0b1222] p-3"
                >
                  <span className="text-[11px] font-semibold text-slate-400">{item.label}</span>
                  <p className="mt-1 break-all font-mono text-xs text-white">{item.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Raw Payload Inspector */}
        <div className="mt-6 border-t border-slate-800 pt-5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Exact Raw QR Payload String
          </span>
          <pre className="mt-2 overflow-x-auto rounded-xl border border-slate-800 bg-[#050811] p-3.5 font-mono text-xs text-slate-300">
            {result.rawPayload}
          </pre>
        </div>

        {/* Action Controls Bar */}
        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-800 pt-5">
          <button
            type="button"
            onClick={handleCopyAll}
            className="rounded-xl bg-sky-500/20 px-4 py-3 text-xs font-bold uppercase tracking-wider text-sky-300 transition hover:bg-sky-500/30"
          >
            Copy All Information
          </button>

          <button
            type="button"
            onClick={() => {
              downloadDecodedResult(result, 'txt');
              onNotify('Downloaded decoded report (.txt)', 'info');
            }}
            className="rounded-xl border border-purple-500/40 bg-purple-500/15 px-4 py-3 text-xs font-bold uppercase tracking-wider text-purple-200 transition hover:bg-purple-500/25"
          >
            Download Results (.TXT)
          </button>

          <button
            type="button"
            onClick={() => {
              downloadDecodedResult(result, 'json');
              onNotify('Downloaded decoded JSON data (.json)', 'info');
            }}
            className="rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-200 transition hover:border-sky-400"
          >
            Download Results (.JSON)
          </button>

          <button
            type="button"
            onClick={onScanAnother}
            className="ml-auto rounded-xl bg-gradient-to-r from-sky-500 to-purple-600 px-5 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-sky-500/20"
          >
            Scan Another Code
          </button>
        </div>
      </div>

      {/* Paste Another QR Payload */}
      <div className="rounded-3xl border border-slate-800 bg-[#080d1a] p-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
          Paste Another QR Content String
        </h3>
        <p className="mt-1 text-xs text-slate-400">
          Paste a raw <code className="text-sky-300">WIFI:...;;</code> or{' '}
          <code className="text-purple-300">DPP:...;;</code> payload string to decode it directly:
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={customPayloadInput}
            onChange={(e) => setCustomPayloadInput(e.target.value)}
            placeholder="Paste WIFI:... or DPP:... QR payload here"
            className="flex-1 rounded-xl border border-slate-700 bg-[#050811] px-4 py-2.5 font-mono text-xs text-white focus:border-sky-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => {
              if (customPayloadInput.trim()) {
                onDecodedPayload(customPayloadInput.trim(), 'Pasted QR Content');
                setCustomPayloadInput('');
              }
            }}
            className="rounded-xl border border-sky-500/40 bg-sky-500/15 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-sky-300 hover:bg-sky-500/25"
          >
            Decode String
          </button>
        </div>
      </div>
    </div>
  );
};
