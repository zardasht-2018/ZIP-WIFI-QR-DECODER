import React from 'react';
import { Scanner } from '../components/Scanner';

interface ScannerPageProps {
  preferredCameraId?: string;
  onDetected: (rawPayload: string, sourceLabel?: string) => void;
  onCancel: () => void;
  onCameraChange: (deviceId: string) => void;
}

export const ScannerPage: React.FC<ScannerPageProps> = ({
  preferredCameraId,
  onDetected,
  onCancel,
  onCameraChange,
}) => {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-black text-white">Live Wi-Fi QR Scanner</h1>
          <p className="text-xs text-slate-400">
            Point your camera at a Wi-Fi QR code or upload a screenshot from your device gallery.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="self-start rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-200 hover:bg-slate-700 sm:self-auto"
        >
          Back to Home
        </button>
      </div>

      <Scanner
        preferredCameraId={preferredCameraId}
        onDetected={onDetected}
        onCancel={onCancel}
        onCameraChange={onCameraChange}
      />
    </div>
  );
};
