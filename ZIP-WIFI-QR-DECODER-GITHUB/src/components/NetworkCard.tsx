import React, { useState } from 'react';
import { ParsedQRResult } from '../types';
import { copyTextToClipboard } from '../utils/clipboardAndExport';
import { SupportedLanguage, TRANSLATIONS } from '../i18n/translations';

interface NetworkCardProps {
  result: ParsedQRResult;
  onSelect?: (result: ParsedQRResult) => void;
  onDelete?: (id: string) => void;
  onNotify?: (message: string, type?: 'success' | 'info' | 'error') => void;
  compact?: boolean;
  language?: SupportedLanguage;
}

export const NetworkCard: React.FC<NetworkCardProps> = ({
  result,
  onSelect,
  onDelete,
  onNotify,
  compact = false,
  language = 'ckb',
}) => {
  const t = TRANSLATIONS[language];
  const [showPassword, setShowPassword] = useState(false);

  const hasSavedPassword = Boolean(result.hasPasswordField && result.password !== null && result.password.length > 0);

  const badgeColor =
    result.category === 'WIFI'
      ? 'border-sky-500/40 bg-sky-500/10 text-sky-300'
      : result.category === 'DPP'
      ? 'border-purple-500/40 bg-purple-500/10 text-purple-300'
      : 'border-slate-600/50 bg-slate-800/80 text-slate-300';

  const handleCopyPassword = async () => {
    if (!hasSavedPassword || result.password === null) return;
    const ok = await copyTextToClipboard(result.password);
    if (ok && onNotify) {
      onNotify(t.toastPasswordCopied, 'success');
    }
  };

  return (
    <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-800/90 bg-[#0b1020]/90 p-4 transition hover:border-sky-500/40 sm:p-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              dir="ltr"
              className={`rounded-lg border px-2.5 py-0.5 text-[11px] font-bold uppercase ${badgeColor}`}
            >
              {result.category === 'WIFI' ? result.securityType : result.category}
            </span>
            {hasSavedPassword && (
              <span className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                {t.badgeSavedPassword}
              </span>
            )}
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

          {!compact && !hasSavedPassword && (
            <p className="mt-1 truncate text-xs text-slate-400">
              {result.securityType === 'nopass'
                ? t.openNetworkNoPasswordMsg
                : result.category === 'DPP'
                ? t.dppNoPasswordMsg
                : t.noPasswordEncodedMsg}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
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

      {/* Saved Wi-Fi Password Row (Masked by default: •••••••• with Show/Hide & Copy) */}
      {hasSavedPassword && result.password !== null && (
        <div className="flex flex-col justify-between gap-2.5 rounded-xl border border-slate-800 bg-[#050811] px-3.5 py-2.5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
              {t.infoLabel2Password}:
            </span>
            <span
              dir="ltr"
              className="font-mono text-sm font-bold text-sky-300 truncate"
            >
              {showPassword ? result.password : '••••••••'}
            </span>
            <span dir="ltr" className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 shrink-0">
              {result.password.length} {t.charsSuffix}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-200 hover:border-sky-400 hover:text-white"
            >
              {showPassword ? t.btnHidePassword : t.btnShowPassword}
            </button>
            <button
              type="button"
              onClick={() => void handleCopyPassword()}
              className="rounded-lg bg-gradient-to-r from-sky-500 to-purple-600 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white hover:brightness-110"
            >
              {t.btnCopyPassword}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
