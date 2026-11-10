import React, { useEffect, useRef, useState } from 'react';
import { cameraService, CameraDeviceOption } from '../services/cameraService';
import { decodeQRFromSource } from '../services/qrDecoder';
import { UploadButton } from './UploadButton';
import { SupportedLanguage, TRANSLATIONS } from '../i18n/translations';

interface ScannerProps {
  preferredCameraId?: string;
  language?: SupportedLanguage;
  onDetected: (rawPayload: string, sourceLabel?: string) => void;
  onCancel: () => void;
  onCameraChange?: (deviceId: string) => void;
}

export const Scanner: React.FC<ScannerProps> = ({
  preferredCameraId,
  language = 'ckb',
  onDetected,
  onCancel,
  onCameraChange,
}) => {
  const t = TRANSLATIONS[language];
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scanTimerRef = useRef<number | null>(null);

  const [cameras, setCameras] = useState<CameraDeviceOption[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string>(preferredCameraId || '');
  const [torchSupported, setTorchSupported] = useState<boolean>(false);
  const [torchActive, setTorchActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  const stopScanLoop = () => {
    if (scanTimerRef.current !== null) {
      window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    cameraService.stopCamera();
  };

  const startLiveScanner = async (deviceId?: string) => {
    stopScanLoop();
    setCameraError(null);
    setIsInitializing(true);

    if (!videoRef.current) {
      setIsInitializing(false);
      return;
    }

    try {
      const info = await cameraService.startCamera(videoRef.current, deviceId);
      setCameras(info.cameras);
      setActiveDeviceId(info.activeDeviceId);
      setTorchSupported(info.torchSupported);
      setTorchActive(false);
      setIsInitializing(false);

      scanTimerRef.current = window.setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return;
        const decoded = await decodeQRFromSource(videoRef.current);
        if (decoded) {
          stopScanLoop();
          onDetected(decoded, 'Live Camera Scan');
        }
      }, 220);
    } catch {
      setIsInitializing(false);
      setCameraError(t.scannerFallbackDenied);
    }
  };

  useEffect(() => {
    void startLiveScanner(preferredCameraId);
    return () => {
      stopScanLoop();
    };
  }, []);

  const handleCameraSwitch = (newDeviceId: string) => {
    setActiveDeviceId(newDeviceId);
    if (onCameraChange) onCameraChange(newDeviceId);
    void startLiveScanner(newDeviceId);
  };

  const handleToggleTorch = async () => {
    const state = await cameraService.toggleTorch(!torchActive);
    setTorchActive(state);
  };

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-[#070b16] shadow-2xl">
        <div className="relative aspect-[4/3] w-full max-h-[460px] bg-black flex items-center justify-center">
          <video
            ref={videoRef}
            className={`h-full w-full object-cover ${cameraError ? 'hidden' : 'block'}`}
            muted
            playsInline
          />

          {!cameraError && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-6">
              <div className="relative h-56 w-56 sm:h-64 sm:w-64 rounded-3xl border-2 border-sky-400/80 shadow-[0_0_40px_rgba(56,189,248,0.25)]">
                <div className="absolute inset-x-2 top-1/2 h-0.5 -translate-y-1/2 bg-gradient-to-r from-transparent via-sky-400 to-transparent shadow-[0_0_12px_#38bdf8] animate-pulse" />
              </div>
              <p className="mt-4 rounded-full bg-black/70 px-4 py-1.5 text-xs font-semibold text-sky-300 backdrop-blur-md">
                {isInitializing ? t.scannerOpeningStream : t.scannerAlignPrompt}
              </p>
            </div>
          )}

          {cameraError && (
            <div className="mx-auto max-w-md p-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
                <span className="text-xl font-bold">!</span>
              </div>
              <h3 className="text-base font-bold text-white">{t.scannerFallbackTitle}</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-300">{cameraError}</p>
              <button
                type="button"
                onClick={() => void startLiveScanner(activeDeviceId)}
                className="mt-4 rounded-xl border border-sky-500/40 bg-sky-500/15 px-4 py-2 text-xs font-bold uppercase tracking-wider text-sky-300 hover:bg-sky-500/25"
              >
                {t.btnRetryCamera}
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/90 bg-[#0b1020] p-4">
          <div className="flex flex-wrap items-center gap-2">
            {cameras.length > 1 && (
              <select
                aria-label="Select Camera"
                value={activeDeviceId}
                onChange={(e) => handleCameraSwitch(e.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
              >
                {cameras.map((cam) => (
                  <option key={cam.deviceId} value={cam.deviceId}>
                    {cam.label}
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              disabled={!torchSupported}
              onClick={handleToggleTorch}
              className={`rounded-xl border px-3.5 py-2 text-xs font-bold uppercase tracking-wider transition ${
                torchSupported
                  ? torchActive
                    ? 'border-amber-400 bg-amber-400/20 text-amber-200'
                    : 'border-slate-700 bg-slate-800 text-slate-200 hover:border-sky-400'
                  : 'cursor-not-allowed border-slate-800 bg-slate-900/50 text-slate-600'
              }`}
            >
              {torchSupported
                ? torchActive
                  ? t.flashlightOn
                  : t.flashlightOff
                : t.flashlightNA}
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              stopScanLoop();
              onCancel();
            }}
            className="rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            {t.btnCancel}
          </button>
        </div>
      </div>

      <UploadButton
        variant="dropzone"
        language={language}
        label={t.btnUploadFromGallery}
        onDecodedPayload={(payload, label) => {
          stopScanLoop();
          onDetected(payload, label);
        }}
        onError={(msg) => setCameraError(msg)}
      />
    </div>
  );
};
