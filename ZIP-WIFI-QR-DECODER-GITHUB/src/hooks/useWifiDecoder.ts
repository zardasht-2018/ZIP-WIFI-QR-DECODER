import { useState, useCallback } from 'react';
import { ParsedQRResult } from '../types';
import { parseQRPayload } from '../services/wifiParser';
import { decodeQRFromFile } from '../services/qrDecoder';

/**
 * Custom hook encapsulating Wi-Fi QR decoding from raw strings and uploaded files
 */
export function useWifiDecoder() {
  const [lastResult, setLastResult] = useState<ParsedQRResult | null>(null);
  const [isDecoding, setIsDecoding] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const decodeString = useCallback((rawPayload: string): ParsedQRResult => {
    setError(null);
    const parsed = parseQRPayload(rawPayload);
    setLastResult(parsed);
    return parsed;
  }, []);

  const decodeFile = useCallback(async (file: File): Promise<ParsedQRResult | null> => {
    setIsDecoding(true);
    setError(null);
    try {
      const raw = await decodeQRFromFile(file);
      const parsed = parseQRPayload(raw);
      setLastResult(parsed);
      return parsed;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'QR image decoding failed.');
      return null;
    } finally {
      setIsDecoding(false);
    }
  }, []);

  return {
    lastResult,
    isDecoding,
    error,
    decodeString,
    decodeFile,
  };
}
