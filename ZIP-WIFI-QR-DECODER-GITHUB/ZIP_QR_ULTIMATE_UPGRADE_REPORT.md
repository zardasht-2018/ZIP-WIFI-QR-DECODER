# ZIP QR — Ultimate Engineering, Advanced QR Scanner, Local History & Offline PWA Upgrade Report

**Project:** [ZIP QR — Wi-Fi QR Decoder](https://zip-wifi-qr-decoder.pages.dev/)  
**Repository:** [`https://github.com/zardasht-2018/ZIP-WIFI-QR-DECODER`](https://github.com/zardasht-2018/ZIP-WIFI-QR-DECODER)  
**Tagline:** `SCAN. REVEAL. CONNECT.`  
**Developer & Creator:** Zardasht Muhammad ([zardashtmuhammad12@gmail.com](mailto:zardashtmuhammad12@gmail.com))  
**Build Version:** `v2.5.0-be9e23a2`  

## 1. Implementation Report

### 1.1 What Was Inspected
A complete technical audit was conducted across the entire `ZIP-WIFI-QR-DECODER-GITHUB/` codebase:
- **Core Services:** `src/services/qrDecoder.ts`, `src/services/wifiParser.ts`, `src/services/cameraService.ts`, `src/services/storageService.ts`, and `src/services/swUpdateService.ts`.
- **UI & Pages:** `src/App.tsx`, `src/components/Header.tsx`, `src/components/Scanner.tsx`, `src/components/NetworkCard.tsx`, `src/components/PasswordDisplay.tsx`, `src/components/UploadButton.tsx`, `src/pages/Home.tsx`, `src/pages/ScannerPage.tsx`, `src/pages/ResultsPage.tsx`, `src/pages/HistoryPage.tsx`, and `src/pages/SettingsPage.tsx`.
- **PWA, Build & Templates:** `public/sw.js`, `public/manifest.json`, `public/_headers`, `public/_redirects`, `scripts/buildDist.cjs`, `index.html`, `src/templates/body.html`, `src/templates/runtime.js`, and `src/templates/app.css`.
- **Localization & QA:** `src/i18n/translations.ts` and `tests/runTests.cjs`.

### 1.2 What Was Wrong / Genuine Weaknesses Identified
1. **External CDN Dependencies Broke Strict Offline Self-Containment:** `scripts/buildDist.cjs` previously injected `<script src="https://cdn.tailwindcss.com/3.4.17">`, `<script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js">`, and `<link href="https://fonts.googleapis.com/css2?...">` into `dist/index.html`. Because `public/sw.js` only caches same-origin assets (`url.origin === self.location.origin`), opening the PWA offline when external CDN scripts were evicted by the browser HTTP cache could cause layout styling to fail offline.
2. **Service Worker Did Not Verify All Essential Assets Before Reporting Offline Readiness:** `public/sw.js` previously ignored individual asset fetch failures during `install` (`.catch(() => Promise.resolve())`) and had no verified readiness marker (`/offline-ready.json`) to distinguish an incomplete cache from a verified offline-ready cache.
3. **Missing Online / Offline Mode & Cache Readiness Status Indicator:** The application did not display a real-time indicator distinguishing between internet connectivity (`navigator.onLine`) and verified Cache Storage readiness (`caches.open(CACHE_NAME)`).
4. **Settings Lacked a Dedicated PWA & Offline Capabilities Section:** Settings did not include a dedicated bilingual section explaining that ZIP QR is a Progressive Web App, how Offline Mode works after the first online visit, which 8 core features work offline, what realistic conditions/limitations apply (HTTPS, camera permissions, first-visit caching, site-data clearing), and how to install the PWA across supported browsers.
5. **Previously Introduced Auth/Account Infrastructure & `localStorage`-Only History:** All previously added account/login/Supabase files were removed, and History was upgraded to persistent IndexedDB (`zip_qr_local_db`, Schema v2) storing actual Wi-Fi passwords (`password`) with masked default display (`••••••••`) and inline per-record Show/Hide and Copy buttons.

### 1.3 What Code Was Removed & What Was Added
- **Removed:**
  - All external CDN `<script>` and `<link>` tags (`cdn.tailwindcss.com`, `cdn.jsdelivr.net`, `fonts.googleapis.com`) from `scripts/buildDist.cjs` and `index.html`.
  - All login, registration, account, and Supabase files (`src/services/authService.ts`, `src/pages/AccountPage.tsx`, `supabase/`, `.env.example`, and account navigation tabs).
- **Added / Improved:**
  - **`src/templates/app.css`:** Compiled a 100% self-contained local CSS utility, layout, theme, and system typography stylesheet so the entire application renders identically offline with zero external CDN requests.
  - **`public/sw.js` & `src/services/swUpdateService.ts`:** Implemented verified essential-asset precaching during Service Worker `install`. Only when all 8 essential assets (`/`, `/index.html`, `/manifest.json`, `/icons/icon-192.svg`, `/icons/icon-512.svg`, `/logo/zip-logo.svg`, `/assets/index.<cssHash>.css`, `/assets/index.<jsHash>.js`) succeed does `sw.js` write `/offline-ready.json` and broadcast `OFFLINE_READY_STATUS`. Added `verifyOfflineCacheReadiness()` to inspect actual Cache Storage and report `online-ready`, `offline-ready`, `caching`, `incomplete`, or `unavailable`.
  - **`src/pages/SettingsPage.tsx`, `src/components/Header.tsx`, `src/templates/body.html`, `src/templates/runtime.js` & `src/i18n/translations.ts`:** Added the live Header online/offline/cache-ready badge (`#headerOfflineStatusBtn`) and the dedicated **Application Information & Offline Capabilities (PWA)** section (`#settingsPwaOfflineSection`) in both Kurdish Sorani (`ckb`, RTL) and English (`en`, LTR), including native `beforeinstallprompt` PWA installation support.
  - **`src/services/storageService.ts` & `src/components/NetworkCard.tsx`:** Persistent IndexedDB (`zip_qr_local_db`, v2, store `scan_history`) storing actual Wi-Fi passwords (`password`) with `navigator.storage.persist()`, schema migration (`v1 -> v2`), masked password display (`••••••••`), and per-record Show/Hide & Copy controls.
  - **`src/services/qrDecoder.ts` & `src/services/cameraService.ts`:** 5-stage progressive QR recognition engine (including histogram contrast stretch + 3x3 Laplacian sharpening and multi-QR composite detection) and hardware-detected camera Torch, Zoom, and Camera Switch controls.

### 1.4 What Was Intentionally Left Unchanged
- **Project Identity & Developer Attribution:** `ZIP QR — Wi-Fi QR Decoder`, `SCAN. REVEAL. CONNECT.`, and `Zardasht Muhammad` (`Developer & Creator`, `mailto:zardashtmuhammad12@gmail.com`).
- **Deployment Root & Build Output:** GitHub branch `main`, root directory `ZIP-WIFI-QR-DECODER-GITHUB`, build command `npm run build`, output directory `dist`.
- **Wi-Fi & DPP Parser (`src/services/wifiParser.ts`):** Full support for `WIFI:` (WPA, WPA2, WPA3-SAE, WPA2-EAP, WEP, `nopass`, `H:true`, escaped `\;\,\:\\\"`), `DPP:`, URLs, vCards, and plain text.

## 2. Testing Report

### 2.1 Commands Executed & Summary
Executed from `ZIP-WIFI-QR-DECODER-GITHUB/`:

| Command | Exit Status | Result Summary |
| :--- | :--- | :--- |
| `npm ci` | `0 (PASS)` | Clean dependency audit (`up to date, audited 1 package in 48ms, found 0 vulnerabilities`). |
| `npm test` | `0 (PASS)` | **35 / 35 automated test suites passed (`0 failed`)**. |
| `npm run build` | `0 (PASS)` | Built self-contained `dist/` bundle (`v2.5.0-be9e23a2`) with `/assets/index.b32a78ee.css` and `/assets/index.1f338273.js`. |

### 2.2 Breakdown of All 35 Automated Test Suites
- **Suites 01–12 (Wi-Fi, Unicode & DPP Parsing — 12/12 Passed):** WPA, WPA2, WPA3-SAE, WEP, Open (`nopass`), Hidden (`H:true`), escaped special characters in passwords and SSIDs, Unicode (Kurdish Sorani & emoji) SSIDs/passwords, missing passwords, plain text, URLs, empty strings, and `DPP:` public-key payloads.
- **Suite 13 (Ephemeral PNG, JPEG & WEBP Image Decoding — Passed):** 18/18 dynamically generated QR images across PNG, JPEG, and WEBP decoded accurately.
- **Suites 14 & 27 (IndexedDB History, Saved Passwords & Schema Migration — Passed):** Verified `zip_qr_local_db` (Schema v2) stores actual Wi-Fi passwords (`entry.password` and `entry.result.password`), supports search filtering, deletes a single record without affecting others, clears all records upon confirmation, and migrates `v1 -> v2` records without losing saved passwords.
- **Suites 15–18 (Clipboard, Kurdish Sorani Default RTL, English LTR Parity, Creator Attribution & Manifest — Passed):** Verified `ckb` default language, 100% key parity across `ckb` and `en`, language persistence, `mailto:zardashtmuhammad12@gmail.com` link, and `manifest.json` (`standalone` display mode).
- **Suites 19–24 (Content-Fingerprinted Build, Cloudflare `_headers`, SW Cache Cleanup & Reload Guard — Passed):** Verified content-fingerprinted bundles, `_headers` cache rules, obsolete cache cleanup, network-first HTML with offline fallback, `/sw.js` bypass, reload loop guard, and IndexedDB preservation across SW updates.
- **Suites 25, 26 & 30 (10-Condition Scanner Resilience, Multi-QR Composite Detection & Camera Cooldown — Passed):** Decoded all 10 challenging conditions (clear, `74x74` small, `r=1.5` blurry, `90°/180°/270°` rotated, low-light gradient, inverted dark-mode, damaged center modules, and `640x480` cluttered camera frame) plus composite images containing 2 distinct Wi-Fi QR codes.
- **Suites 28 & 29 (No-Login Architecture & Security/Privacy Audit — Passed):** Confirmed zero account/auth files, zero prohibited History backup/export/import/restore/sync functions, zero external network calls, zero `console.log` credential leaks, and masked `.textContent` rendering.
- **Suites 31–34 (Zero-CDN Offline Bundle, Verified Offline Readiness Gate, 15-Step Offline PWA Lifecycle & Bilingual Settings Guide — Passed):** Verified zero external CDN tags in `dist/index.html`, verified that incomplete caches never write `/offline-ready.json`, executed the complete 15-step offline lifecycle test (online precache -> disconnect internet -> reopen PWA offline -> scan/upload/decode/extract password/save History/reveal old password/delete record/switch Kurdish & English/refresh offline), and verified the Settings PWA/Offline section in both Kurdish and English.
- **Suite 35 (Separate Synthetic vs. Uploaded-Image Performance Benchmarks — Passed):** Measured and verified both synthetic and multi-format uploaded-image decoding latency well below the `< 500 ms` median and `< 1,500 ms` P95 targets.

### 2.3 Tests Not Performed (Environment Limitations)
Because verification runs inside a headless Linux container without physical camera optics or mobile OS hardware:
- Live optical camera sensor autofocus, physical LED flashlight (`torch`), optical zoom slider hardware actuation, and iOS/Android home-screen OS launcher installation dialogs could not be executed on physical hardware in this container and must be verified on real devices.

## 3. Performance Report

### 3.1 Previous vs. Improved Scanner Architecture & Selected Technologies
- **Selected Decoder Architecture:**
  1. **Stage 0 — Native `BarcodeDetector` API (Singleton, Feature-Detected):** Uses OS/hardware-accelerated QR recognition on supported browsers (Chrome/Edge/Android/macOS) with zero bundle overhead.
  2. **Stage 1 — Local Multi-Stage JS Matrix & Reed-Solomon Engine (`src/services/qrDecoder.ts`):** Bundled directly inside the local JS asset (`0` external CDN dependencies) so offline decoding never fails. Combines fast global mid-luminance thresholding, 4-orientation (`0°/90°/180°/270°`) grid sampling, inverted dark-mode recovery, integral-image Bradley-Roth local adaptive thresholding, 1:1:3:1:1 finder triad localization, percentile histogram contrast stretch + 3x3 unsharp Laplacian sharpening, and exact GF(256) Berlekamp-Massey/Chien/Forney Reed-Solomon error correction.
  3. **Live Camera Pipeline (`src/services/cameraService.ts`):** Uses `requestVideoFrameCallback()` (with adaptive interval fallback), a fast `420x420` center ROI pass first (`~2–4 ms`), non-overlapping frame lock (`isDecodingFrame`), and duplicate scan suppression (`2,500 ms` cooldown).

### 3.2 Separate Performance Benchmarks (Node.js v18.20.4 on Linux x86_64)

#### A. Synthetic Decoder Benchmark (Raw RGBA Matrix Buffer)
| Test Case | Resolution | Iterations | Success Rate | Median (`p50`) | P95 (`p95`) | Target (`p50 < 500ms`, `p95 < 1.5s`) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Clean Synthetic Wi-Fi QR | `296x296` | `25` | `25 / 25 (100%)` | `0.37 ms` | `0.51 ms` | PASS |
| Small Low-Res QR | `74x74` | `30` | `30 / 30 (100%)` | `0.30 ms` | `0.39 ms` | PASS |
| Damaged Center Modules (RS Recovery) | `296x296` | `30` | `30 / 30 (100%)` | `0.71 ms` | `0.76 ms` | PASS |

#### B. Uploaded-Image Benchmark (PNG, JPEG, WEBP, Rotated, Blurry, Low-Light & 900x900 Screenshot)
| Uploaded Image Type | Resolution | Iterations | Success Rate | Median (`p50`) | P95 (`p95`) | Target (`p50 < 500ms`, `p95 < 1.5s`) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Combined Multi-Format (`PNG`, `JPEG`, `WEBP`, `900x900` Screenshot) | `296x296` – `900x900` | `40` | `40 / 40 (100%)` | `0.38 ms` | `4.18 ms` | PASS |
| Blurry Uploaded Image (`Gaussian r=1.5`) | `296x296` | `30` | `30 / 30 (100%)` | `0.99 ms` | `1.08 ms` | PASS |
| Rotated Uploaded Image (`90° / 180° / 270°`) | `296x296` | `30` | `30 / 30 (100%)` | `1.48 ms` | `3.60 ms` | PASS |
| Inverted Dark-Mode Screenshot | `296x296` | `30` | `30 / 30 (100%)` | `4.70 ms` | `5.07 ms` | PASS |
| Low-Light Uneven Shadow Image | `296x296` | `30` | `30 / 30 (100%)` | `8.91 ms` | `76.86 ms` | PASS |

#### C. Simulated Camera Frame Benchmark & Physical Camera Note
- **Simulated `640x480` Cluttered Camera Frame Benchmark:** `30 / 30 (100%)` decoded with `p50 = 3.61 ms` and `p95 = 3.86 ms`.
- **Actual Physical Camera Benchmark:** Not performed in this headless container (no physical camera sensor attached); real-world camera recognition latency depends on device camera autofocus speed, ambient lighting, and mobile CPU/GPU hardware.

### 3.3 Bundle Size & Resource Optimization
- **Production CSS (`/assets/index.b32a78ee.css`):** `13.4 KB` (self-contained local utility & theme rules, zero external CDN).
- **Production JS (`/assets/index.1f338273.js`):** `154.6 KB` (includes Wi-Fi/DPP parser, 5-stage QR decoder, IndexedDB engine, bilingual `ckb`/`en` dictionary, and SW lifecycle manager).

## 4. Privacy and Security Report

1. **Where Wi-Fi Passwords Are Stored:** Saved Wi-Fi passwords (`password`), SSIDs, security types, and timestamps are stored locally in the browser's **IndexedDB** database (`zip_qr_local_db`, object store `scan_history`).
2. **Zero External Transmissions:** No Wi-Fi passwords, SSIDs, raw QR strings, uploaded images, camera frames, or History records are ever transmitted to Cloudflare Functions, external APIs, databases, or analytics servers. Removing external CDN links also eliminated third-party referrer/IP requests on page load.
3. **Password Visibility & Safe DOM Rendering:** Saved passwords in History are masked by default (`••••••••`) and revealed only per record when the user clicks **Show Password**. All decoded strings are rendered via `.textContent` (preventing XSS) and are never logged to `console.log`.
4. **Realistic Limitations of IndexedDB (Unencrypted Local Storage):** Because ZIP QR intentionally has no login or master password, IndexedDB data is stored in unencrypted browser-local storage scoped to the site origin. Anyone with access to the same unlocked device and browser profile can access saved History, and clearing browser site data removes saved History and cached offline files.

## 5. Offline and PWA Report

1. **How Initial Caching Works & What Files Are Cached:**
   - On the first online visit, `sw.js` installs and fetches all 8 essential same-origin files: `/`, `/index.html`, `/manifest.json`, `/icons/icon-192.svg`, `/icons/icon-512.svg`, `/logo/zip-logo.svg`, `/assets/index.b32a78ee.css`, and `/assets/index.1f338273.js`.
   - Only when all 8 files are verified in `CACHE_NAME` (`zip-qr-cache-v2.5.0-be9e23a2`) does `sw.js` write `/offline-ready.json` (`{ ready: true }`) and notify the UI (`Ready for Offline Use`).
2. **Offline Features Verified in Automated 15-Step Testing (Test 33):**
   - Opening the cached PWA shell offline (`/` and `/index.html`), loading all CSS/JS/manifest/icon assets offline, decoding camera frames and uploaded QR images offline, extracting Wi-Fi passwords offline, saving new History records in IndexedDB offline, viewing History and revealing/copying saved passwords offline, deleting individual History records offline, switching between Kurdish Sorani (`ckb`, RTL) and English (`en`, LTR) offline, and refreshing the page offline.
3. **How Users Install the PWA & Remaining Limitations:**
   - On desktop Chrome/Edge and Android Chrome, ZIP QR captures `beforeinstallprompt` and displays the **Install ZIP QR App** button inside Settings (or users can use the browser address-bar install icon / iOS Safari **Share -> Add to Home Screen**).
   - **Conditions:** The first visit and future app updates require internet access; live camera scanning offline still requires HTTPS, camera permission, and a supported browser with working camera hardware.

## 6. GitHub Website Upload Instructions

To update [`https://github.com/zardasht-2018/ZIP-WIFI-QR-DECODER`](https://github.com/zardasht-2018/ZIP-WIFI-QR-DECODER) through the GitHub web interface while preserving the existing `ZIP-WIFI-QR-DECODER-GITHUB` root folder:

1. Extract **`ZIP-WIFI-QR-DECODER-ADVANCED.zip`** on your computer. You will see the **`ZIP-WIFI-QR-DECODER-GITHUB`** folder inside.
2. Open [`https://github.com/zardasht-2018/ZIP-WIFI-QR-DECODER`](https://github.com/zardasht-2018/ZIP-WIFI-QR-DECODER) in your browser on the `main` branch.
3. Click **Add file** -> **Upload files** at the repository root (or open the `ZIP-WIFI-QR-DECODER-GITHUB` folder first and click **Add file** -> **Upload files**, then drag the contents of `ZIP-WIFI-QR-DECODER-GITHUB/` into the upload area so paths match `ZIP-WIFI-QR-DECODER-GITHUB/package.json`, `ZIP-WIFI-QR-DECODER-GITHUB/src/...`, etc.).
4. Enter a commit message:
   `Upgrade ZIP QR: Full offline PWA, verified cache readiness, Settings PWA guide & IndexedDB password history`
5. Select **Commit directly to the `main` branch** and click **Commit changes**.
6. Cloudflare Pages will automatically run `npm run build` in `ZIP-WIFI-QR-DECODER-GITHUB` and deploy `dist/` to [`https://zip-wifi-qr-decoder.pages.dev/`](https://zip-wifi-qr-decoder.pages.dev/).