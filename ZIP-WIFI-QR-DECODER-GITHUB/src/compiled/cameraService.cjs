"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.cameraService = exports.CameraService = void 0;
/**
 * ZIP QR — Wi-Fi QR Decoder — High-Speed Camera Service (v3.0)
 *
 * Manages browser `navigator.mediaDevices.getUserMedia` camera streams,
 * device enumeration, rear-camera priority on mobile, adaptive HD resolution,
 * continuous autofocus & exposure constraints where supported, hardware flashlight
 * (torch) control, non-blocking `requestVideoFrameCallback` frame processing,
 * duplicate scan suppression, and strict camera track cleanup on unmount/detection.
 */

class CameraService {
  stream = null;
  torchEnabled = false;
  lastDecodedPayload = '';
  lastDecodedTimestamp = 0;

  /**
   * Checks whether the current browser context supports `getUserMedia`.
   */
  isCameraApiSupported() {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return {
        supported: false,
        reason: 'Browser environment unavailable.'
      };
    }
    if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return {
        supported: false,
        reason: 'Camera access requires a secure HTTPS connection or localhost.'
      };
    }
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      return {
        supported: false,
        reason: 'Your browser does not expose the Camera API (navigator.mediaDevices.getUserMedia).'
      };
    }
    return {
      supported: true
    };
  }

  /**
   * Lists available video input cameras on the device, sorting rear/environment cameras first
   */
  async listCameras() {
    const check = this.isCameraApiSupported();
    if (!check.supported) return [];
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter(d => d.kind === 'videoinput').map((d, index) => {
        const lower = (d.label || '').toLowerCase();
        const isBack = lower.includes('back') || lower.includes('rear') || lower.includes('environment') || lower.includes('traseira');
        return {
          deviceId: d.deviceId,
          label: d.label || `Camera ${index + 1}`,
          facingMode: isBack ? 'environment' : 'user'
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
  shouldAcceptDetection(payload, cooldownMs = 2500) {
    const now = Date.now();
    if (payload === this.lastDecodedPayload && now - this.lastDecodedTimestamp < cooldownMs) {
      return false;
    }
    this.lastDecodedPayload = payload;
    this.lastDecodedTimestamp = now;
    return true;
  }
  resetDetectionLock() {
    this.lastDecodedPayload = '';
    this.lastDecodedTimestamp = 0;
  }

  /**
   * Starts the camera stream, applies continuous focus/exposure optimization where supported,
   * and attaches it to the target `<video>` element.
   */
  async startCamera(videoElement, preferredDeviceId) {
    this.stopCamera();
    const check = this.isCameraApiSupported();
    if (!check.supported) {
      throw new Error(check.reason || 'Camera access is not supported in this browser.');
    }
    const videoConstraints = preferredDeviceId ? {
      deviceId: {
        exact: preferredDeviceId
      },
      width: {
        ideal: 1280
      },
      height: {
        ideal: 720
      },
      frameRate: {
        ideal: 30,
        max: 60
      }
    } : {
      facingMode: {
        ideal: 'environment'
      },
      width: {
        ideal: 1280
      },
      height: {
        ideal: 720
      },
      frameRate: {
        ideal: 30,
        max: 60
      }
    };
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: videoConstraints
      });
    } catch {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      } catch (fallbackErr) {
        const msg = fallbackErr instanceof Error ? fallbackErr.name : '';
        if (msg === 'NotAllowedError' || msg === 'PermissionDeniedError') {
          throw new Error('Camera permission was denied. Please allow camera access in your browser settings or upload a QR image below.');
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
        const caps = videoTrack.getCapabilities();
        torchSupported = Boolean(caps && caps.torch);

        // Apply continuous autofocus & continuous exposure when supported by mobile/webcam hardware
        const advancedConstraints = {};
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
            advanced: [advancedConstraints]
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
      torchSupported
    };
  }

  /**
   * Toggles hardware flashlight (torch) if supported by the active camera track
   */
  async toggleTorch(enable) {
    if (!this.stream) return false;
    const track = this.stream.getVideoTracks()[0];
    if (!track) return false;
    const targetState = enable !== undefined ? enable : !this.torchEnabled;
    try {
      await track.applyConstraints({
        advanced: [{
          torch: targetState
        }]
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
  stopCamera() {
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
exports.CameraService = CameraService;
const cameraService = new CameraService();
exports.cameraService = cameraService;