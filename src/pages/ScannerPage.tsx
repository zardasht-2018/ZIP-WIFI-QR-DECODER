import React from 'react';
import { Scanner } from '../components/Scanner';
import { SupportedLanguage, TRANSLATIONS } from '../i18n/translations';

interface ScannerPageProps {
  preferredCameraId?: string;
  language?: SupportedLanguage;
  onDetected: (rawPayload: string, sourceLabel?: string) => void;
  onMultipleDetected?: (payloads: string[], sourceLabel?: string) => void;
  onCancel: () => void;
  onCameraChange: (deviceId: string) => void;
}

export const ScannerPage: React.FC<ScannerPageProps> = ({
  preferredCameraId,
  language = 'ckb',
  onDetected,
  onMultipleDetected,
  onCancel,
  onCameraChange,
}) => {
  const t = TRANSLATIONS[language];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white">{t.scannerTitle}</h1>
          <p className="text-xs text-slate-400">{t.scannerSubtitle}</p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-200 hover:bg-slate-700"
        >
          {t.btnCancel}
        </button>
      </div>

      <Scanner
        preferredCameraId={preferredCameraId}
        language={language}
        onDetected={onDetected}
        onMultipleDetected={onMultipleDetected}
        onCancel={onCancel}
        onCameraChange={onCameraChange}
      />
    </div>
  );
};
