import React, { useState } from 'react';
import { ParsedQRResult } from '../types';
import { PasswordDisplay } from '../components/PasswordDisplay';
import {
  copyTextToClipboard,
  downloadDecodedResult,
  formatResultReport,
} from '../utils/clipboardAndExport';
import { SupportedLanguage, TRANSLATIONS } from '../i18n/translations';

interface ResultsPageProps {
  result: ParsedQRResult | null;
  sourceLabel?: string;
  autoMaskPassword?: boolean;
  language?: SupportedLanguage;
  onScanAnother: () => void;
  onDecodedPayload: (rawPayload: string, sourceLabel?: string) => void;
  onNotify: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export const ResultsPage: React.FC<ResultsPageProps> = ({
  result,
  sourceLabel,
  autoMaskPassword = false,
  language = 'ckb',
  onScanAnother,
  onDecodedPayload,
  onNotify,
}) => {
  const t = TRANSLATIONS[language];
  const [customPayloadInput, setCustomPayloadInput] = useState('');

  if (!result) {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-slate-800 bg-[#080d1a] p-8 text-center">
        <h2 className="text-xl font-bold text-white">{t.resultsEmptyTitle}</h2>
        <p className="mt-2 text-sm text-slate-400">{t.resultsEmptyDesc}</p>
        <button
          type="button"
          onClick={onScanAnother}
          className="mt-6 rounded-2xl bg-gradient-to-r from-sky-500 to-purple-600 px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-sky-500/20"
        >
          {t.btnScanQrCode}
        </button>
      </div>
    );
  }

  const handleCopyAll = async () => {
    const report = formatResultReport(result);
    const ok = await copyTextToClipboard(report);
    if (ok) {
      onNotify(t.toastAllCopied, 'success');
    }
  };

  const handleCopySsid = async () => {
    const ok = await copyTextToClipboard(result.ssid);
    if (ok) {
      onNotify(t.toastSsidCopied, 'success');
    }
  };

  const localizedHiddenStatus =
    result.hiddenDisplay === 'Yes'
      ? t.hiddenYes
      : result.hiddenDisplay === 'No'
      ? t.hiddenNo
      : t.hiddenNA;

  const localizedNoPasswordMsg =
    result.securityType === 'nopass'
      ? t.openNetworkNoPasswordMsg
      : result.category === 'DPP'
      ? t.dppNoPasswordMsg
      : t.noPasswordEncodedMsg;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-slate-800 bg-[#080d1a] p-6 sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              dir="ltr"
              className="rounded-lg border border-sky-500/40 bg-sky-500/15 px-2.5 py-0.5 text-xs font-bold uppercase text-sky-300"
            >
              {result.category}
            </span>
            {sourceLabel && (
              <span className="rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-0.5 text-xs text-slate-300">
                {t.sourcePrefix} <span dir="ltr">{sourceLabel}</span>
              </span>
            )}
          </div>
          <h1
            dir="ltr"
            className="mt-2 break-all text-start font-mono text-2xl font-black text-white sm:text-3xl"
          >
            {result.ssid}
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            {t.decodedOnPrefix}{' '}
            <span dir="ltr">{new Date(result.timestamp).toLocaleString()}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleCopySsid}
            className="rounded-xl border border-slate-700 bg-slate-800/90 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-200 hover:border-sky-400"
          >
            {t.btnCopySsid}
          </button>
          <button
            type="button"
            onClick={onScanAnother}
            className="rounded-xl bg-gradient-to-r from-sky-500 to-purple-600 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-sky-500/20 hover:brightness-110"
          >
            {t.btnScanAnother}
          </button>
        </div>
      </div>

      {/* Prominent Password Extraction Card */}
      <PasswordDisplay
        result={result}
        defaultMasked={autoMaskPassword}
        language={language}
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
          {t.networkInfoHeading}
        </h2>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-800/90 bg-[#0b1222] p-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {t.infoLabel1Ssid}
            </span>
            <p
              dir="ltr"
              className="mt-1 break-all text-left font-mono text-base font-bold text-white"
            >
              {result.ssid}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800/90 bg-[#0b1222] p-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {t.infoLabel2Password}
            </span>
            <p
              dir="ltr"
              className="mt-1 break-all text-left font-mono text-base font-bold text-sky-300"
            >
              {result.hasPasswordField && result.password !== null
                ? result.password
                : localizedNoPasswordMsg}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800/90 bg-[#0b1222] p-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {t.infoLabel3Security}
            </span>
            <p dir="ltr" className="mt-1 text-left text-base font-bold text-white">
              {result.securityDisplay}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800/90 bg-[#0b1222] p-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {t.infoLabel4Hidden}
            </span>
            <p className="mt-1 text-base font-bold text-white">{localizedHiddenStatus}</p>
          </div>

          <div className="rounded-2xl border border-slate-800/90 bg-[#0b1222] p-4 sm:col-span-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {t.infoLabel5Format}
            </span>
            <p dir="ltr" className="mt-1 text-left text-sm font-semibold text-purple-300">
              {result.formatLabel}
            </p>
          </div>
        </div>

        {/* 6. Additional Information Present in the QR Code */}
        <div className="mt-6 border-t border-slate-800 pt-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            {t.infoLabel6Extra}
          </h3>
          {result.extraFields.length === 0 ? (
            <p className="mt-2 text-xs text-slate-400">{t.infoNoExtraParams}</p>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {result.extraFields.map((item, idx) => (
                <div
                  key={`${item.key}-${idx}`}
                  className="rounded-xl border border-slate-800 bg-[#0b1222] p-3"
                >
                  <span className="text-[11px] font-semibold text-slate-400">{item.label}</span>
                  <p dir="ltr" className="mt-1 break-all text-left font-mono text-xs text-white">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Raw Payload Inspector */}
        <div className="mt-6 border-t border-slate-800 pt-5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {t.infoRawPayloadLabel}
          </span>
          <pre
            dir="ltr"
            className="mt-2 overflow-x-auto rounded-xl border border-slate-800 bg-[#050811] p-3.5 text-left font-mono text-xs text-slate-300"
          >
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
            {t.btnCopyAllInfo}
          </button>

          <button
            type="button"
            onClick={() => {
              downloadDecodedResult(result, 'txt');
              onNotify(t.toastDownloadedTxt, 'info');
            }}
            className="rounded-xl border border-purple-500/40 bg-purple-500/15 px-4 py-3 text-xs font-bold uppercase tracking-wider text-purple-200 transition hover:bg-purple-500/25"
          >
            {t.btnDownloadTxt}
          </button>

          <button
            type="button"
            onClick={() => {
              downloadDecodedResult(result, 'json');
              onNotify(t.toastDownloadedJson, 'info');
            }}
            className="rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-200 transition hover:border-sky-400"
          >
            {t.btnDownloadJson}
          </button>

          <button
            type="button"
            onClick={onScanAnother}
            className="ms-auto rounded-xl bg-gradient-to-r from-sky-500 to-purple-600 px-5 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-sky-500/20"
          >
            {t.btnScanAnother}
          </button>
        </div>
      </div>

      {/* Paste Another QR Payload */}
      <div className="rounded-3xl border border-slate-800 bg-[#080d1a] p-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
          {t.pasteAnotherHeading}
        </h3>
        <p className="mt-1 text-xs text-slate-400">{t.pasteAnotherDesc}</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            dir="ltr"
            value={customPayloadInput}
            onChange={(e) => setCustomPayloadInput(e.target.value)}
            placeholder={t.card3Placeholder}
            className="flex-1 rounded-xl border border-slate-700 bg-[#050811] px-4 py-2.5 text-left font-mono text-xs text-white focus:border-sky-400 focus:outline-none"
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
            {t.btnDecodePayload}
          </button>
        </div>
      </div>
    </div>
  );
};
