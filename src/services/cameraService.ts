/**
 * ZIP QR — Wi-Fi QR Decoder — High-Speed Camera Service (v4.0)
 *
 * Manages browser `navigator.mediaDevices.getUserMedia` camera streams,
 * device enumeration, rear-camera priority on mobile, adaptive HD resolution,
 * continuous autofocus & exposure constraints where supported, hardware flashlight
 * (torch) & zoom capability detection and control, non-blocking `requestVideoFrameCallback`
 * frame processing, duplicate scan suppression, and strict camera track cleanup.
 */

export interface CameraDeviceOption {
  deviceId: string;
  label: string;
  facingMode?: 'user' | 'environment';
}

export interface CameraHardwareCapabilities {
  torchSupported: boolean;
  zoomSupported: boolean;
  zoomMin: number;
  zoomMax: number;
  zoomStep: number;
  currentZoom: number;
}

export class CameraService {
  private stream: MediaStream | null = null;
  private torchEnabled = false;
  private currentZoom = 1;
  private lastDecodedPayload = '';
  private lastDecodedTimestamp = 0;

  /**
   * Checks whether the current browser context supports `getUserMedia`.
   */
  public isCameraApiSupported(): { supported: boolean; reason?: string } {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return { supported: false, reason: 'Browser environment unavailable.' };
    }
    if (
      !window.isSecureContext &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      return {
        supported: false,
        reason: 'Camera access requires a secure HTTPS connection or localhost.',
      };
    }
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      return {
        supported: false,
        reason: 'Your browser does not expose the Camera API (navigator.mediaDevices.getUserMedia).',
      };
    }
    return { supported: true };
  }

  /**
   * Lists available video input cameras on the device, sorting rear/environment cameras first
   */
  public async listCameras(): Promise<CameraDeviceOption[]> {
    const check = this.isCameraApiSupported();
    if (!check.supported) return [];
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices
        .filter((d) => d.kind === 'videoinput')
        .map((d, index) => {
          const lower = (d.label || '').toLowerCase();
          const isBack =
            lower.includes('back') ||
            lower.includes('rear') ||
            lower.includes('environment') ||
            lower.includes('traseira');
          return {
            deviceId: d.deviceId,
            label: d.label || `Camera ${index + 1}`,
            facingMode: (isBack ? 'environment' : 'user') as 'environment' | 'user',
          };
        });
      // Prefer rear cameras first on mobile devices
      cams.sort((a, b) => {
        if (a.facingMode === 'environment' && b.facingMode !== 'environment') return -1;
        if (a.facingMode !== 'environment' && b.facingMode === 'environment') return 1;
        return 0;
      });
      return cams;
    } catch {
      return [];
    }
  }

  /**
   * Prevents duplicate back-to-back emissions of the exact same QR code within a cooldown window
   */
  public shouldAcceptDetection(payload: string, cooldownMs = 2500): boolean {
    const now = Date.now();
    if (payload === this.lastDecodedPayload && now - this.lastDecodedTimestamp < cooldownMs) {
      return false;
    }
    this.lastDecodedPayload = payload;
    this.lastDecodedTimestamp = now;
    return true;
  }

  public resetDetectionLock(): void {
    this.lastDecodedPayload = '';
    this.lastDecodedTimestamp = 0;
  }

  /**
   * Starts the camera stream, applies continuous focus/exposure optimization where supported,
   * detects hardware torch and zoom capabilities, and attaches it to the target `<video>` element.
   */
  public async startCamera(
    videoElement: HTMLVideoElement,
    preferredDeviceId?: string,
    facingModeHint?: 'environment' | 'user'
  ): Promise<{
    stream: MediaStream;
    cameras: CameraDeviceOption[];
    activeDeviceId: string;
    torchSupported: boolean;
    zoomSupported: boolean;
    zoomMin: number;
    zoomMax: number;
    zoomStep: number;
    currentZoom: number;
  }> {
    this.stopCamera();

    const check = this.isCameraApiSupported();
    if (!check.supported) {
      throw new Error(check.reason || 'Camera access is not supported in this browser.');
    }

    const videoConstraints: MediaTrackConstraints = preferredDeviceId
      ? {
          deviceId: { exact: preferredDeviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 60 },
        }
      : {
          facingMode: { ideal: facingModeHint || 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 60 },
        };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: videoConstraints,
      });
    } catch {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      } catch (fallbackErr) {
        const msg = fallbackErr instanceof Error ? fallbackErr.name : '';
        if (msg === 'NotAllowedError' || msg === 'PermissionDeniedError') {
          throw new Error(
            'Camera permission was denied. Please allow camera access in your browser settings or upload a QR image below.'
          );
        }
        if (msg === 'NotFoundError' || msg === 'DevicesNotFoundError') {
          throw new Error('No camera hardware was detected on this device. Please use the Upload QR Image option.');
        }
        if (msg === 'NotReadableError' || msg === 'TrackStartError') {
          throw new Error('Camera is currently in use by another application. Please close other apps or upload a QR image.');
        }
        throw new Error('Unable to initialize camera stream. You can still upload any QR image file below.');
      }
    }

    videoElement.srcObject = this.stream;
    videoElement.setAttribute('playsinline', 'true');
    await videoElement.play();

    const cameras = await this.listCameras();
    const videoTrack = this.stream.getVideoTracks()[0];
    const settings = (videoTrack ? videoTrack.getSettings() : {}) as Record<string, unknown>;
    const activeDeviceId =
      (typeof settings.deviceId === 'string' ? settings.deviceId : '') ||
      preferredDeviceId ||
      (cameras[0]?.deviceId ?? '');

    let torchSupported = false;
    let zoomSupported = false;
    let zoomMin = 1;
    let zoomMax = 1;
    let zoomStep = 0.1;
    let currentZoom = 1;

    if (videoTrack && 'getCapabilities' in videoTrack) {
      try {
        const caps = (
          videoTrack as MediaStreamTrack & { getCapabilities: () => Record<string, unknown> }
        ).getCapabilities();
        torchSupported = Boolean(caps && caps.torch);

        if (caps && caps.zoom && typeof caps.zoom === 'object') {
          const z = caps.zoom as { min?: number; max?: number; step?: number };
          const minVal = typeof z.min === 'number' ? z.min : 1;
          const maxVal = typeof z.max === 'number' ? z.max : 1;
          if (maxVal > minVal) {
            zoomSupported = true;
            zoomMin = minVal;
            zoomMax = Math.min(maxVal, 5);
            zoomStep = typeof z.step === 'number' && z.step > 0 ? z.step : 0.1;
            currentZoom = typeof settings.zoom === 'number' ? settings.zoom : minVal;
            this.currentZoom = currentZoom;
          }
        }

        // Apply continuous autofocus & continuous exposure when supported by mobile/webcam hardware
        const advancedConstraints: Record<string, unknown> = {};
        if (Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
          advancedConstraints.focusMode = 'continuous';
        }
        if (Array.isArray(caps.exposureMode) && caps.exposureMode.includes('continuous')) {
          advancedConstraints.exposureMode = 'continuous';
        }
        if (Array.isArray(caps.whiteBalanceMode) && caps.whiteBalanceMode.includes('continuous')) {
          advancedConstraints.whiteBalanceMode = 'continuous';
        }
        if (Object.keys(advancedConstraints).length > 0) {
          await videoTrack.applyConstraints({
            advanced: [advancedConstraints as MediaTrackConstraintSet],
          });
        }
      } catch {
        // Ignore unsupported advanced hardware constraints
      }
    }

    return {
      stream: this.stream,
      cameras,
      activeDeviceId,
      torchSupported,
      zoomSupported,
      zoomMin,
      zoomMax,
      zoomStep,
      currentZoom,
    };
  }

  /**
   * Toggles hardware flashlight (torch) if supported by the active camera track
   */
  public async toggleTorch(enable?: boolean): Promise<boolean> {
    if (!this.stream) return false;
    const track = this.stream.getVideoTracks()[0];
    if (!track) return false;

    const targetState = enable !== undefined ? enable : !this.torchEnabled;
    try {
      await track.applyConstraints({
        advanced: [{ torch: targetState } as unknown as MediaTrackConstraintSet],
      });
      this.torchEnabled = targetState;
      return this.torchEnabled;
    } catch {
      return false;
    }
  }

  /**
   * Adjusts optical/digital camera zoom when supported by the active camera track
   */
  public async setZoom(zoomValue: number): Promise<number> {
    if (!this.stream) return this.currentZoom;
    const track = this.stream.getVideoTracks()[0];
    if (!track) return this.currentZoom;

    try {
      await track.applyConstraints({
        advanced: [{ zoom: zoomValue } as unknown as MediaTrackConstraintSet],
      });
      this.currentZoom = zoomValue;
      return this.currentZoom;
    } catch {
      return this.currentZoom;
    }
  }

  /**
   * Stops all active media tracks and releases hardware camera resources immediately
   */
  public stopCamera(): void {
    this.torchEnabled = false;
    this.currentZoom = 1;
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        try {
          track.stop();
        } catch {
          // ignore
        }
      }
      this.stream = null;
    }
  }
}

export const cameraService = new CameraService();
