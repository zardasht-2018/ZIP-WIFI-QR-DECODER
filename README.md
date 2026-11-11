# ZIP QR

**Subtitle:** Wi-Fi QR Decoder  
**Tagline:** `SCAN. REVEAL. CONNECT.`  
**Live Application:** [https://zip-wifi-qr-decoder.pages.dev/](https://zip-wifi-qr-decoder.pages.dev/)  
**GitHub Repository:** [https://github.com/zardasht-2018/ZIP-WIFI-QR-DECODER](https://github.com/zardasht-2018/ZIP-WIFI-QR-DECODER)  
**Creator & Developer:** Zardasht Muhammad ([zardashtmuhammad12@gmail.com](mailto:zardashtmuhammad12@gmail.com))

---

## Overview

**ZIP QR** is a fast, privacy-first, bilingual (Kurdish Sorani `ckb` RTL & English `en` LTR) Progressive Web Application (PWA) for scanning Wi-Fi QR codes, revealing encoded network details, and managing saved scans locally in the browser.

- **No Login, No Registration, No Accounts:** Open the application and immediately use all features.
- **Unlimited Persistent Local IndexedDB History (`zip_qr_local_db`):** Saves scanned networks—including their **actual Wi-Fi passwords**—in local browser IndexedDB without artificial record caps so your History survives closing the browser, restarting your device, and updating the PWA.
- **Masked Password Privacy (`••••••••`):** Saved passwords in History are masked by default and include per-record **Show/Hide Password** and **Copy Password** controls.
- **100% Client-Side & Offline-Ready:** Camera streams, uploaded images, SSIDs, and passwords never leave your device.

---

## Production Build Architecture (Important for Developers)

To guarantee a **100% self-contained, zero-CDN offline PWA bundle** with deterministic SHA-256 asset fingerprinting and instant builds on Cloudflare Pages, `npm run build` executes `scripts/buildDist.cjs`.

### 1. Active Production Source Files (Used by `npm run build` → `dist/`)

When modifying the live production application, edit these files:

| File / Directory | Role in Production Build (`dist/`) |
| :--- | :--- |
| `src/templates/body.html` | **Active HTML UI markup** injected into `dist/index.html` |
| `src/templates/app.css` | **Active stylesheet** fingerprinted into `dist/assets/index.<hash>.css` |
| `src/templates/runtime.js` | **Active client-side application runtime** (Wi-Fi/DPP parser, v5.0 QR recognition engine, camera controller, unlimited IndexedDB history, bilingual i18n, and UI event bindings) fingerprinted into `dist/assets/index.<hash>.js` |
| `public/sw.js` | **Active Service Worker template** injected with `BUILD_VERSION` and hashed asset paths into `dist/sw.js` |
| `public/manifest.json` | **Active PWA Web App Manifest** copied to `dist/manifest.json` |
| `public/icons/*`, `public/logo/*`, `public/favicon*`, `public/apple-touch-icon*` | **Active multi-platform icon suite** copied to `dist/` |
| `public/_headers`, `public/_redirects` | **Active Cloudflare Pages routing and HTTP cache headers** |
| `scripts/buildDist.cjs` | **Production build script** that assembles `dist/` and `dist/version.json` |

### 2. Core TypeScript & CommonJS Verification Modules (Used by `npm test`)

- `src/services/qrDecoder.ts`, `src/services/cameraService.ts`, `src/services/storageService.ts`, `src/services/swUpdateService.ts`, `src/utils/wifiParser.ts`, `src/utils/clipboardAndExport.ts`, `src/i18n/translations.ts` — Canonical TypeScript implementations of the core services.
- `src/compiled/*.cjs` — CommonJS-compiled counterparts of the TypeScript services loaded directly by the Node.js automated test suite (`tests/runTests.cjs`). Whenever you modify logic in `src/services/*.ts` or `src/utils/*.ts`, synchronize the change in `src/compiled/*.cjs` and `src/templates/runtime.js`.

### 3. Reference React/Vite Components (Inactive in `scripts/buildDist.cjs`)

- `src/App.tsx`, `src/main.tsx`, `src/components/*.tsx`, and `src/pages/*.tsx` are retained as modular TypeScript/React reference components. They are **not** compiled by `scripts/buildDist.cjs` during `npm run build`. Do not edit only `.tsx` files expecting those changes to appear in `dist/`—always update `src/templates/body.html`, `src/templates/app.css`, and `src/templates/runtime.js`.

---

## Testing Prerequisites & Local Setup (Windows, macOS & Linux)

The automated test runner (`npm test` → `tests/runTests.cjs`) runs **36 verification suites** across Node.js (v18, v20, v22+) and uses **Python 3** with **OpenCV**, **Pillow**, and **NumPy** to dynamically synthesize tilted, noisy, perspective-warped, and LCD-moiré QR code test images on the fly (so no fake or sensitive QR galleries are bundled in the app).

### Step 1: Install Node.js Dependencies

```bash
npm ci
```

### Step 2: Install Python 3 Image-Synthesis Prerequisites

Ensure **Python 3** (`3.8+`) is installed and available on your `PATH` (as `python3`, `python`, or `py -3`), then install the three required packages:

- **Windows (PowerShell or Command Prompt):**
  ```powershell
  py -3 -m pip install --upgrade pip
  py -3 -m pip install opencv-python pillow numpy
  ```
  *(Or if using `python` directly: `python -m pip install opencv-python pillow numpy`)*

- **macOS / Linux:**
  ```bash
  python3 -m pip install opencv-python pillow numpy
  ```

- **Verify Python Prerequisites:**
  ```bash
  python3 -c "import cv2, PIL, numpy; print('Python QR test prerequisites OK')"
  ```
  *(On Windows, you can also run `py -3 -c "import cv2, PIL, numpy; print('OK')"` — `tests/runTests.cjs` automatically detects `python3`, `python`, or `py -3`.)*

### Step 3: Run the Full 36-Suite Automated Test Runner & Production Build

```bash
npm test
npm run build
```

---

## Cloudflare Pages Deployment Settings

- **Production branch:** `main`
- **Root directory:** `ZIP-WIFI-QR-DECODER-GITHUB` (or `/` if uploaded at repository root)
- **Build command:** `npm run build`
- **Build output directory:** `dist`
