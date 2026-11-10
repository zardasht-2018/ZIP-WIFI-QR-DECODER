import React, { useState } from 'react';
import { ParsedQRResult, ScanHistoryEntry } from '../types';
import { NetworkCard } from '../components/NetworkCard';
import { SupportedLanguage, TRANSLATIONS } from '../i18n/translations';

interface HistoryPageProps {
  history: ScanHistoryEntry[];
  historyEnabled: boolean;
  language?: SupportedLanguage;
  onToggleHistoryEnabled: (enabled: boolean) => void;
  onSelectResult: (result: ParsedQRResult) => void;
  onDeleteEntry: (id: string) => void;
  onClearAll: () => void;
  onScanNow: () => void;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({
  history,
  historyEnabled,
  language = 'ckb',
  onToggleHistoryEnabled,
  onSelectResult,
  onDeleteEntry,
  onClearAll,
  onScanNow,
}) => {
  const t = TRANSLATIONS[language];
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmClearModal, setConfirmClearModal] = useState(false);

  const filteredHistory = history.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.ssid.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.securityDisplay.toLowerCase().includes(q)
    );
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-slate-800 bg-[#080d1a] p-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-black text-white">{t.historyTitle}</h1>
          <p className="mt-1 text-xs text-slate-400">{t.historySubtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-200">
            <input
              type="checkbox"
              checked={historyEnabled}
              onChange={(e) => onToggleHistoryEnabled(e.target.checked)}
              className="h-4 w-4 accent-sky-500"
            />
            <span>{t.labelSaveHistory}</span>
          </label>

          {history.length > 0 && (
            <button
              type="button"
              onClick={() => setConfirmClearModal(true)}
              className="rounded-xl border border-rose-500/40 bg-rose-500/15 px-4 py-2 text-xs font-bold uppercase tracking-wider text-rose-300 hover:bg-rose-500/25"
            >
              {t.btnClearAllHistory}
            </button>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmClearModal && (
        <div className="rounded-2xl border border-rose-500/50 bg-[#160b16] p-5 shadow-xl">
          <h3 className="text-sm font-bold text-white">{t.modalClearTitle}</h3>
          <p className="mt-1 text-xs text-slate-300">{t.modalClearDesc}</p>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                onClearAll();
                setConfirmClearModal(false);
              }}
              className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold uppercase text-white hover:bg-rose-500"
            >
              {t.btnConfirmClear}
            </button>
            <button
              type="button"
              onClick={() => setConfirmClearModal(false)}
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300"
            >
              {t.btnCancel}
            </button>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      {history.length > 0 && (
        <div className="flex items-center gap-3">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.historySearchPlaceholder}
            className="w-full rounded-2xl border border-slate-800 bg-[#080d1a] px-4 py-3 text-xs text-white focus:border-sky-400 focus:outline-none"
          />
        </div>
      )}

      {filteredHistory.length === 0 ? (
        <div className="rounded-3xl border border-slate-800 bg-[#080d1a] p-10 text-center">
          <p className="text-sm font-semibold text-white">
            {history.length === 0 ? t.historyEmptyText : t.historyNoMatchText}
          </p>
          <button
            type="button"
            onClick={onScanNow}
            className="mt-5 rounded-xl bg-gradient-to-r from-sky-500 to-purple-600 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white"
          >
            {t.btnScanQrCode}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredHistory.map((entry) => (
            <NetworkCard
              key={entry.id}
              result={entry.result}
              language={language}
              onSelect={onSelectResult}
              onDelete={onDeleteEntry}
            />
          ))}
        </div>
      )}
    </div>
  );
};
