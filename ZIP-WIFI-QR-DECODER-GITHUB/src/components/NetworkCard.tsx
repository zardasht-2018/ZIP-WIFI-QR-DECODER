import React from 'react';
import { ParsedQRResult } from '../types';
import { SupportedLanguage, TRANSLATIONS } from '../i18n/translations';

interface NetworkCardProps {
  result: ParsedQRResult;
  onSelect?: (result: ParsedQRResult) => void;
  onDelete?: (id: string) => void;
  compact?: boolean;
  language?: SupportedLanguage;
}

export const NetworkCard: React.FC<NetworkCardProps> = ({
  result,
  onSelect,
  onDelete,
  compact = false,
  language = 'ckb',
}) => {
  const t = TRANSLATIONS[language];
  const badgeColor =
    result.category === 'WIFI'
      ? 'border-sky-500/40 bg-sky-500/10 text-sky-300'
      : result.category === 'DPP'
      ? 'border-purple-500/40 bg-purple-500/10 text-purple-300'
      : 'border-slate-600/50 bg-slate-800/80 text-slate-300';

  return (
    <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-800/90 bg-[#0b1020]/90 p-4 transition hover:border-sky-500/40 sm:flex-row sm:items-center sm:p-5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            dir="ltr"
            className={`rounded-lg border px-2.5 py-0.5 text-[11px] font-bold uppercase ${badgeColor}`}
          >
            {result.category === 'WIFI' ? result.securityType : result.category}
          </span>
          {result.hiddenNetwork && (
            <span className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
              {t.badgeHiddenSsid}
            </span>
          )}
          <span className="text-xs text-slate-400" dir="ltr">
            {new Date(result.timestamp).toLocaleString()}
          </span>
        </div>

        <h4 dir="ltr" className="mt-2 truncate text-start font-mono text-base font-bold text-white sm:text-lg">
          {result.ssid}
        </h4>

        {!compact && (
          <p className="mt-1 truncate text-xs text-slate-400">
            {result.hasPasswordField && result.password !== null
              ? `${t.historyPasswordExtractedPrefix} (${result.password.length} ${t.charsSuffix}) • ${result.securityDisplay}`
              : result.securityType === 'nopass'
              ? t.openNetworkNoPasswordMsg
              : t.noPasswordEncodedMsg}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {onSelect && (
          <button
            type="button"
            onClick={() => onSelect(result)}
            className="rounded-xl bg-sky-500/15 px-4 py-2 text-xs font-bold uppercase tracking-wider text-sky-300 transition hover:bg-sky-500/25"
          >
            {t.btnOpenResult}
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(result.id)}
            className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20"
          >
            {t.btnDeleteEntry}
          </button>
        )}
      </div>
    </div>
  );
};
