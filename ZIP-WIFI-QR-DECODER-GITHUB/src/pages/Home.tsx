import React, { useState } from 'react';
import { ActivePage, ParsedQRResult, ScanHistoryEntry } from '../types';
import { UploadButton } from '../components/UploadButton';
import { NetworkCard } from '../components/NetworkCard';
import { SupportedLanguage, TRANSLATIONS } from '../i18n/translations';

interface HomeProps {
  language?: SupportedLanguage;
  onNavigate: (page: ActivePage) => void;
  onDecodedPayload: (rawPayload: string, sourceLabel?: string) => void;
  onSelectHistoryResult: (result: ParsedQRResult) => void;
  recentHistory: ScanHistoryEntry[];
  onError: (message: string) => void;
}

export const Home: React.FC<HomeProps> = ({
  language = 'ckb',
  onNavigate,
  onDecodedPayload,
  onSelectHistoryResult,
  recentHistory,
  onError,
}) => {
  const t = TRANSLATIONS[language];
  const [pastedPayload, setPastedPayload] = useState('');

  const handlePasteDecode = () => {
    const trimmed = pastedPayload.trim();
    if (!trimmed) {
      onError(t.toastEnterPayload);
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
            <span>{t.heroBadge}</span>
          </div>

          <h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl" dir="ltr">
            {t.brandPrimary}{' '}
            <span className="text-xl font-bold text-sky-400 sm:text-3xl">
              — {t.brandSecondary}
            </span>
          </h1>
          <p className="mt-2 font-mono text-xs font-bold uppercase tracking-[0.25em] text-purple-300 sm:text-sm" dir="ltr">
            {t.tagline}
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
            {t.heroDescription}
          </p>

          <div className="mt-8 flex flex-col items-stretch justify-center gap-4 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => onNavigate('scanner')}
              className="flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-sky-500 to-purple-600 px-8 py-4 text-sm font-black uppercase tracking-wider text-white shadow-xl shadow-sky-500/25 transition hover:brightness-110"
            >
              <span>{t.btnScanQrCode}</span>
            </button>

            <UploadButton
              variant="secondary"
              language={language}
              label={t.btnUploadQrImage}
              onDecodedPayload={onDecodedPayload}
              onError={onError}
            />
          </div>
        </div>
      </section>

      {/* 3 Primary Action Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Action 1: Scan QR Code */}
        <section className="rounded-3xl border border-slate-800/90 bg-[#080d1a] p-6 flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-sky-400">
              {t.card1Step}
            </span>
            <h2 className="mt-1 text-lg font-bold text-white">{t.card1Title}</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{t.card1Desc}</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('scanner')}
            className="mt-6 w-full rounded-2xl bg-gradient-to-r from-sky-500 to-purple-600 px-5 py-3.5 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-sky-500/20 transition hover:brightness-110"
          >
            {t.card1Btn}
          </button>
        </section>

        {/* Action 2: Upload QR Image */}
        <section className="rounded-3xl border border-slate-800/90 bg-[#080d1a] p-6 flex flex-col justify-between">
          <div className="mb-4">
            <span className="text-[11px] font-bold uppercase tracking-widest text-purple-300">
              {t.card2Step}
            </span>
            <h2 className="mt-1 text-lg font-bold text-white">{t.card2Title}</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{t.card2Desc}</p>
          </div>
          <UploadButton
            variant="dropzone"
            language={language}
            label={t.card2Btn}
            onDecodedPayload={onDecodedPayload}
            onError={onError}
          />
        </section>

        {/* Action 3: Paste QR Content */}
        <section className="rounded-3xl border border-slate-800/90 bg-[#080d1a] p-6 flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-300">
              {t.card3Step}
            </span>
            <h2 className="mt-1 text-lg font-bold text-white">{t.card3Title}</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{t.card3Desc}</p>
          </div>

          <div className="mt-4 space-y-3">
            <input
              type="text"
              dir="ltr"
              value={pastedPayload}
              onChange={(e) => setPastedPayload(e.target.value)}
              placeholder={t.card3Placeholder}
              className="w-full rounded-xl border border-slate-700/80 bg-[#050811] px-3.5 py-2.5 text-left font-mono text-xs text-white placeholder-slate-500 focus:border-sky-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={handlePasteDecode}
              className="w-full rounded-2xl border border-sky-500/40 bg-sky-500/15 px-5 py-3.5 text-xs font-black uppercase tracking-wider text-sky-300 transition hover:bg-sky-500/25"
            >
              {t.card3Btn}
            </button>
          </div>
        </section>
      </div>

      {/* Recently Scanned Codes */}
      <section className="rounded-3xl border border-slate-800/90 bg-[#080d1a] p-6">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-white sm:text-lg">{t.recentHeading}</h2>
            <p className="text-xs text-slate-400">{t.recentSubheading}</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('history')}
            className="rounded-xl border border-slate-700 px-3.5 py-1.5 text-xs font-bold text-sky-300 hover:border-sky-500/40"
          >
            {t.btnManageHistory}
          </button>
        </div>

        {recentHistory.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-slate-800/70 bg-[#0b1020]/50 p-6 text-center text-xs text-slate-400">
            {t.emptyRecentText}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {recentHistory.slice(0, 3).map((entry) => (
              <NetworkCard
                key={entry.id}
                result={entry.result}
                language={language}
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
