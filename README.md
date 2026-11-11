# ZIP QR

**Subtitle:** Wi-Fi QR Decoder  
**Version:** `2.5.0`  
**Tagline:** `SCAN. REVEAL. CONNECT.`  
**Live Application:** [https://zip-wifi-qr-decoder.pages.dev/](https://zip-wifi-qr-decoder.pages.dev/)  
**GitHub Repository:** [https://github.com/zardasht-2018/ZIP-WIFI-QR-DECODER](https://github.com/zardasht-2018/ZIP-WIFI-QR-DECODER)  
**Creator & Developer:** Zardasht Muhammad ([zardashtmuhammad12@gmail.com](mailto:zardashtmuhammad12@gmail.com))

---

## Overview

**ZIP QR** is a fast, bilingual (Kurdish Sorani `ckb` RTL & English `en` LTR) Progressive Web Application (PWA) for scanning Wi-Fi QR codes, revealing encoded network details, and managing saved scans locally in the browser.

---

## Privacy & Network Behavior

- **Local QR Decoding:** All QR image decoding, camera frame analysis, and Wi-Fi payload parsing (`WIFI:...` and `DPP:...`) happen locally in your browser.
- **No Transmission of Credentials or Media:** Wi-Fi passwords, SSIDs, decoded QR contents, uploaded images, and live camera frames are never transmitted to any backend server or external third-party service.
- **Normal Static Hosting & Update Requests:** Standard HTTPS requests to the hosting origin (Cloudflare Pages) are required to load the application's static files (`index.html`, JS/CSS bundles, `manifest.json`, icons) on initial visit and to check for and receive PWA Service Worker updates (`sw.js`, `version.json`). The application loads zero external CDN scripts or third-party fonts.
- **Browser-Local IndexedDB History (`zip_qr_local_db`):** Scanned networks—including their **actual Wi-Fi passwords**—are stored locally in your browser's `IndexedDB` without artificial record limits so your History persists across browser restarts and PWA updates. Saved passwords are masked (`••••••••`) by default in the History view with per-record **Show/Hide** and **Copy** controls, and remain accessible to anyone with direct access to the same unlocked browser profile on your device.

---

## Production Build Architecture

The production build uses a **deterministic Node.js static build pipeline** (`npm run build` → `node scripts/buildDist.cjs`). It does **not** use Vite or a React bundler.

### 1. Active Production Source Files (`npm run build` → `dist/`)

When modifying the live production application, edit these active source files:

| File / Directory | Role in Production Build (`dist/`) |
| :--- | :--- |
| `src/templates/body.html` | **Active HTML UI markup** injected into `dist/index.html` |
| `src/templates/app.css` | **Active self-contained stylesheet** fingerprinted into `dist/assets/index.<hash>.css` |
| `src/templates/runtime.js` | **Active client-side application runtime** (Wi-Fi/DPP parser, v5.0 screen-aware QR recognition engine, camera controller, unlimited IndexedDB history, bilingual i18n, and UI event bindings) fingerprinted into `dist/assets/index.<hash>.js` |
| `public/sw.js` | **Active Service Worker template** injected with `BUILD_VERSION` (`v2.5.0-<hash>`) and fingerprinted asset paths into `dist/sw.js` |
| `public/manifest.json` | **Active PWA Web App Manifest** (`name: "ZIP QR"`, `short_name: "ZIP QR"`) copied to `dist/manifest.json` |
| `public/icons/*`, `public/logo/*`, `public/favicon*`, `public/apple-touch-icon*`, `public/browserconfig.xml` | **Active multi-platform icon suite** (Android, iOS/iPadOS, Windows, macOS, Linux, standard & maskable PNGs, ICO, SVG) copied to `dist/` |
| `public/_headers`, `public/_redirects` | **Active Cloudflare Pages routing and HTTP cache-control headers** copied to `dist/` |
| `scripts/buildDist.cjs` | **Production build script** that compiles and hashes all assets into `dist/` and generates `dist/version.json` |

### 2. Development & Automated Testing Resources

The following files are retained specifically for local development preview, canonical TypeScript modularity, and the automated test suite (`npm test` — **1 test suite** running **36 individual tests**):

| File / Directory | Purpose |
| :--- | :--- |
| `scripts/devServer.cjs` | Local HTTP preview server (`npm run dev` / `npm run preview`) serving `dist/` on `http://localhost:5173` |
| `tests/runTests.cjs` | Automated test runner (`1 test suite` • `36 individual tests`) verifying QR decoding, Wi-Fi parsing, IndexedDB History, i18n, and offline PWA caching |
| `src/compiled/*.cjs` | CommonJS modules (`qrDecoder.cjs`, `wifiParser.cjs`, `cameraService.cjs`, `storageService.cjs`, `swUpdateService.cjs`, `clipboardAndExport.cjs`, `translations.cjs`) loaded directly by `tests/runTests.cjs` |
| `src/services/*.ts`, `src/utils/*.ts`, `src/i18n/translations.ts`, `src/types/index.ts` | Canonical TypeScript source definitions audited by `tests/runTests.cjs` and synchronized with `src/compiled/*.cjs` and `src/templates/runtime.js` |
| `index.html` | Root HTML metadata reference validated by the automated test suite |

---

## Testing Prerequisites & Local Setup (Windows, macOS & Linux)

The automated test runner (`npm test` → `tests/runTests.cjs`) runs **1 test suite** containing **36 individual tests** on Node.js (`v18`, `v20`, `v22+`) and invokes **Python 3** with **OpenCV**, **Pillow**, and **NumPy** to dynamically synthesize tilted, noisy, perspective-warped, and LCD-moiré QR test fixtures on the fly.

### Step 1: Install Node.js Dependencies

```bash
npm ci
```

### Step 2: Install Python 3 Image-Synthesis Prerequisites

Ensure **Python 3** (`3.8+`) is installed and available on your `PATH` (as `python3`, `python`, or `py -3`), then install the required packages:

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

### Step 3: Run Tests & Production Build

```bash
npm test
npm run build
```

---

## Cloudflare Pages Deployment Settings

Use these exact settings in **Cloudflare Dashboard → Workers & Pages → Settings → Builds & deployments**:

| Configuration Field | Exact Value |
| :--- | :--- |
| **Repository** | `ZIP-WIFI-QR-DECODER` |
| **Production branch** | `main` |
| **Root Directory** | `ZIP-WIFI-QR-DECODER-GITHUB` |
| **Build Command** | `npm run build` |
| **Build Output Directory** | `dist` |
