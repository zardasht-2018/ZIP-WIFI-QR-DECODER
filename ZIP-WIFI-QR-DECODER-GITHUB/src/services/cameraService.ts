/**
 * ZIP WiFi QR Decoder — Camera Service
 *
 * Manages browser `navigator.mediaDevices.getUserMedia` camera streams,
 * device enumeration, front/back lens switching, hardware flashlight (torch)
 * control, and strict camera track cleanup on unmount or scan completion.
 */

export interface CameraDeviceOption {
  deviceId: string;
  label: string;
  facingMode?: 'user' | 'environment';
}

export interface CameraStreamState {
  stream: MediaStream | null;
  activeDeviceId: string;
  torchSupported: boolean;
  torchActive: boolean;
}

export class CameraService {
  private stream: MediaStream | null = null;
  private torchEnabled = false;

  /**
   * Checks whether the current browser context supports `getUserMedia`.
   * Note: Browsers restrict `mediaDevices` to secure contexts (HTTPS or localhost).
   */
  public isCameraApiSupported(): { supported: boolean; reason?: string } {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return { supported: false, reason: 'Browser environment unavailable.' };
    }
    if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
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
   * Lists available video input cameras on the device
   */
  public async listCameras(): Promise<CameraDeviceOption[]> {
    const check = this.isCameraApiSupported();
    if (!check.supported) return [];
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter((d) => d.kind === 'videoinput')
        .map((d, index) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${index + 1}`,
          facingMode: d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear')
            ? 'environment'
            : 'user',
        }));
    } catch {
      return [];
    }
  }

  /**
   * Starts the camera stream and attaches it to the target `<video>` element
   */
  public async startCamera(
    videoElement: HTMLVideoElement,
    preferredDeviceId?: string
  ): Promise<{
    stream: MediaStream;
    cameras: CameraDeviceOption[];
    activeDeviceId: string;
    torchSupported: boolean;
  }> {
    this.stopCamera();

    const check = this.isCameraApiSupported();
    if (!check.supported) {
      throw new Error(check.reason || 'Camera access is not supported in this browser.');
    }

    const constraints: MediaStreamConstraints = {
      audio: false,
      video: preferredDeviceId
        ? {
            deviceId: { exact: preferredDeviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          }
        : {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      // Fallback to basic video: true if ideal constraints fail on older laptops/phones
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
    const settings = videoTrack ? videoTrack.getSettings() : {};
    const activeDeviceId = settings.deviceId || preferredDeviceId || (cameras[0]?.deviceId ?? '');

    let torchSupported = false;
    if (videoTrack && 'getCapabilities' in videoTrack) {
      try {
        const caps = (videoTrack as MediaStreamTrack & { getCapabilities: () => Record<string, unknown> }).getCapabilities();
        torchSupported = Boolean(caps && caps.torch);
      } catch {
        torchSupported = false;
      }
    }

    return {
      stream: this.stream,
      cameras,
      activeDeviceId,
      torchSupported,
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
   * Stops all active media tracks and releases hardware camera resources immediately
   */
  public stopCamera(): void {
    this.torchEnabled = false;
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
