# ZIP QR — Wi-Fi QR Decoder

**Tagline:** `SCAN. REVEAL. CONNECT.`  
**Live Application:** [https://zip-wifi-qr-decoder.pages.dev/](https://zip-wifi-qr-decoder.pages.dev/)  
**GitHub Repository:** [https://github.com/zardasht-2018/ZIP-WIFI-QR-DECODER](https://github.com/zardasht-2018/ZIP-WIFI-QR-DECODER)  
**Developer & Creator:** Zardasht Muhammad ([zardashtmuhammad12@gmail.com](mailto:zardashtmuhammad12@gmail.com))

---

## Overview

**ZIP QR — Wi-Fi QR Decoder** is a fast, privacy-first, bilingual (Kurdish Sorani `ckb` RTL & English `en` LTR) Progressive Web Application (PWA) that decodes Wi-Fi QR codes locally in the browser and reveals their exact encoded credentials—including the **Wi-Fi password**, **SSID**, **Security Type** (`WPA`, `WPA2`, `WPA3-SAE`, `WPA2-EAP`, `WEP`, `Open`, `DPP`), and **Hidden Network Status**.

- **No Login, No Registration, No Accounts:** Open the application and immediately use all features.
- **Persistent Local IndexedDB History (`zip_qr_local_db`):** Saves scanned networks—including their **actual Wi-Fi passwords**—in local browser IndexedDB so your History survives closing the browser, restarting your phone/computer, and installing or updating the PWA.
- **Masked Password Privacy (`••••••••`):** Saved passwords in History are masked by default and include per-record **Show/Hide Password** and **Copy Password** controls.
- **100% Client-Side Privacy:** Camera streams, uploaded images, SSIDs, and passwords never leave your device.

---

## Core Features

1. **Multi-Stage v4.0 QR Recognition Engine (`src/services/qrDecoder.ts`)**
   - Hardware-accelerated `BarcodeDetector` (when supported) + `jsQR` (`attemptBoth`) + fast global threshold + 4-orientation (`0°/90°/180°/270°`) matrix sampling + inverted dark-mode recovery + integral-image Bradley-Roth local adaptive thresholding + 1:1:3:1:1 finder triad localization + percentile contrast stretch & 3x3 sharpening + exact Reed-Solomon GF(256) error correction.
   - Detects multiple QR codes inside a single uploaded image and presents a clean selector modal.
2. **Hardware-Aware Live Camera Scanner (`src/services/cameraService.ts`)**
   - Prioritizes rear/environment cameras on mobile devices, uses `requestVideoFrameCallback` with a center ROI pass, and dynamically exposes **Flashlight (Torch)**, **Optical/Digital Zoom**, and **Camera Switch** controls only when supported by the device hardware.
3. **Full Kurdish Sorani (`ckb`, RTL, Default) & English (`en`, LTR) Localization (`src/i18n/translations.ts`)**
   - Instant language switching in the header and Settings page with automatic persistence.
4. **Update-Safe PWA Service Worker (`public/sw.js` & `scripts/buildDist.cjs`)**
   - Network-first HTML navigation, content-fingerprinted `/assets/index.<hash>.js` and `.css` bundles, automatic old cache cleanup, and zero interference with IndexedDB History.

---

## Local Development & Verification Commands

```bash
npm ci
npm test
npm run build
```

## Cloudflare Pages Deployment Settings

- **Production branch:** `main`
- **Root directory:** `ZIP-WIFI-QR-DECODER-GITHUB`
- **Build command:** `npm run build`
- **Build output directory:** `dist`
