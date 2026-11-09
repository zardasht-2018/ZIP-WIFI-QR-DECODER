import React, { useRef, useState } from 'react';
import { decodeQRFromFile } from '../services/qrDecoder';

interface UploadButtonProps {
  onDecodedPayload: (rawPayload: string, sourceLabel?: string) => void;
  onError: (message: string) => void;
  variant?: 'primary' | 'secondary' | 'dropzone';
  label?: string;
}

export const UploadButton: React.FC<UploadButtonProps> = ({
  onDecodedPayload,
  onError,
  variant = 'secondary',
  label = 'UPLOAD QR IMAGE',
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setIsProcessing(true);
    try {
      const payload = await decodeQRFromFile(file);
      onDecodedPayload(payload, `Uploaded Image (${file.name})`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not decode a QR code from the selected image.');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    void handleFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    void handleFile(file);
  };

  if (variant === 'dropzone') {
    return (
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
          isDragging
            ? 'border-sky-400 bg-sky-500/10'
            : 'border-slate-700/80 bg-[#0b1020]/90 hover:border-purple-500/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          onChange={handleInputChange}
          className="hidden"
        />
        <p className="text-sm font-semibold text-white">
          {isProcessing ? 'Decoding QR Image Locally...' : 'Drag & Drop a QR Image Here'}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Supports PNG, JPG/JPEG, and WEBP from desktop or mobile photo gallery
        </p>
        <button
          type="button"
          disabled={isProcessing}
          onClick={() => fileInputRef.current?.click()}
          className="mt-4 inline-flex items-center justify-center rounded-xl border border-sky-500/40 bg-sky-500/15 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-sky-300 transition hover:bg-sky-500/25"
        >
          {isProcessing ? 'Processing...' : label}
        </button>
      </div>
    );
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        onChange={handleInputChange}
        className="hidden"
      />
      <button
        type="button"
        disabled={isProcessing}
        onClick={() => fileInputRef.current?.click()}
        className={
          variant === 'primary'
            ? 'flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-purple-600 px-6 py-4 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-sky-500/25 transition hover:brightness-110 sm:w-auto'
            : 'flex w-full items-center justify-center gap-2 rounded-2xl border border-purple-500/40 bg-purple-500/10 px-6 py-4 text-sm font-bold uppercase tracking-wider text-purple-200 transition hover:bg-purple-500/20 sm:w-auto'
        }
      >
        <span>{isProcessing ? 'DECODING IMAGE...' : label}</span>
      </button>
    </>
  );
};
