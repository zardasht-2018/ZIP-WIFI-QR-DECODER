import React, { useState } from 'react';
import { ParsedQRResult } from '../types';
import { copyTextToClipboard } from '../utils/clipboardAndExport';

interface PasswordDisplayProps {
  result: ParsedQRResult;
  defaultMasked?: boolean;
  onNotify: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export const PasswordDisplay: React.FC<PasswordDisplayProps> = ({
  result,
  defaultMasked = false,
  onNotify,
}) => {
  const [isVisible, setIsVisible] = useState<boolean>(!defaultMasked);
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopyPassword = async () => {
    if (!result.hasPasswordField || result.password === null) return;
    const ok = await copyTextToClipboard(result.password);
    if (ok) {
      setCopied(true);
      onNotify('Wi-Fi password copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2000);
    } else {
      onNotify('Unable to copy automatically. Please select and copy the password text.', 'error');
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-sky-500/40 bg-gradient-to-br from-[#0c1428] via-[#090d1a] to-[#130d26] p-5 shadow-xl shadow-sky-500/10 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-sky-400 shadow-[0_0_10px_#38bdf8]" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-sky-400">
            Extracted Wi-Fi Password
          </h3>
        </div>
        {result.hasPasswordField && result.password !== null && (
          <span className="rounded-md bg-slate-800/90 px-2.5 py-0.5 font-mono text-xs text-slate-300">
            {result.password.length} chars
          </span>
        )}
      </div>

      {result.hasPasswordField && result.password !== null ? (
        <div className="mt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div
              className="flex-1 overflow-x-auto rounded-xl border border-slate-700/80 bg-[#050811] px-4 py-4 font-mono text-xl font-bold tracking-wide text-white sm:text-2xl"
              data-testid="extracted-password-value"
            >
              {isVisible ? result.password : '•'.repeat(Math.min(24, Math.max(8, result.password.length)))}
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsVisible((prev) => !prev)}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800/90 px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-200 transition hover:border-sky-400/50 hover:text-white sm:flex-initial"
              >
                {isVisible ? 'Hide Password' : 'Show Password'}
              </button>

              <button
                type="button"
                onClick={handleCopyPassword}
                className="flex-1 rounded-xl bg-gradient-to-r from-sky-500 to-purple-600 px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-sky-500/25 transition hover:brightness-110 sm:flex-initial"
              >
                {copied ? 'Copied!' : 'Copy Password'}
              </button>
            </div>
          </div>
          <p className="mt-2.5 text-xs text-slate-400">
            Exact character-for-character passphrase decoded locally from the QR payload.
          </p>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm font-semibold text-amber-200">
          {result.passwordStatusMessage}
        </div>
      )}
    </div>
  );
};
