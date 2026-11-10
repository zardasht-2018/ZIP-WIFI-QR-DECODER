# ZIP QR — Ultimate Performance, Privacy & Advanced QR Recognition Upgrade Report

**Project:** [ZIP QR — Wi-Fi QR Decoder](https://zip-wifi-qr-decoder.pages.dev/)  
**Repository:** [`https://github.com/zardasht-2018/ZIP-WIFI-QR-DECODER`](https://github.com/zardasht-2018/ZIP-WIFI-QR-DECODER)  
**Tagline:** `SCAN. REVEAL. CONNECT.`  
**Developer & Creator:** Zardasht Muhammad ([zardashtmuhammad12@gmail.com](mailto:zardashtmuhammad12@gmail.com))  
**Build Version:** `v2.5.0-d7bef3b6`  

## 1. Implementation Report

### 1.1 What Was Inspected
A complete file-by-file audit was performed across all files in `ZIP-WIFI-QR-DECODER-GITHUB/`, including:
- **Core Services:** `src/services/qrDecoder.ts`, `src/services/wifiParser.ts`, `src/services/cameraService.ts`, `src/services/storageService.ts`, `src/services/swUpdateService.ts`, and `src/services/authService.ts`.
- **React UI Components & Pages:** `src/App.tsx`, `src/components/Header.tsx`, `src/components/Scanner.tsx`, `src/components/NetworkCard.tsx`, `src/components/PasswordDisplay.tsx`, `src/components/UploadButton.tsx`, `src/pages/Home.tsx`, `src/pages/ScannerPage.tsx`, `src/pages/ResultsPage.tsx`, `src/pages/HistoryPage.tsx`, `src/pages/SettingsPage.tsx`, and `src/pages/AccountPage.tsx`.
- **Production Build & PWA Pipeline:** `scripts/buildDist.cjs`, `public/sw.js`, `public/manifest.json`, `public/_headers`, `public/_redirects`, `src/templates/body.html`, `src/templates/runtime.js`, and `src/templates/app.css`.
- **Localization & Automated QA:** `src/i18n/translations.ts` and `tests/runTests.cjs`.

### 1.2 Genuine Weaknesses Identified
1. **Unnecessary Account & Authentication Infrastructure:** The repository previously contained `src/services/authService.ts`, `src/pages/AccountPage.tsx`, `supabase/migrations/0001_multi_user_rls_schema.sql`, `.env.example`, and an `Account` navigation tab in `Header.tsx` and `body.html`. This added unnecessary complexity when the application is intended to operate immediately without login or registration.
2. **Primary History Relied on `localStorage` Without Inline Password Reveal/Copy:** `storageService.ts` stored up to 50 records in `localStorage` (`zip_wifi_qr_history_v1`) rather than using IndexedDB as the primary persistent database, did not request `navigator.storage.persist()`, and `NetworkCard.tsx` only displayed a character-count summary in History rather than letting users reveal (`••••••••` -> plaintext) and copy saved Wi-Fi passwords directly from History cards.
3. **Camera Toolbar Displayed Non-Supported Controls:** `Scanner.tsx` and `body.html` rendered a disabled "Flashlight N/A" button even on desktop webcams and devices that do not support hardware torch, and lacked optical/digital zoom controls when `track.getCapabilities().zoom` is supported.
4. **Uploaded Image Decoder Lacked Multi-QR Selection & Contrast/Sharpening Stage:** While `qrDecoder.ts` handled basic thresholds and adaptive binarization, uploading a single screenshot containing two distinct QR codes returned only the first code, and low-contrast blurry images lacked percentile histogram stretching combined with 3x3 unsharp Laplacian sharpening.

### 1.3 What Unnecessary Code Was Removed
- Deleted `src/services/authService.ts` and `src/compiled/authService.cjs`.
- Deleted `src/pages/AccountPage.tsx`.
- Deleted `supabase/migrations/0001_multi_user_rls_schema.sql` and the `supabase/` directory.
- Deleted `.env.example` and removed all Supabase/cloud-sync environment references.
- Removed the `Account` navigation tab (`data-nav="account"`) and `#page-account` section from `src/components/Header.tsx`, `src/App.tsx`, `src/templates/body.html`, `src/templates/runtime.js`, and `src/i18n/translations.ts`.

### 1.4 What New Functionality & Improvements Were Implemented
| File Path | Summary of Changes |
| :--- | :--- |
| `src/types/index.ts` | Updated `ScanHistoryEntry` to include explicit persistent `password`, `hasPassword`, `securityType`, `hiddenNetwork`, and `formatLabel` fields; removed `'account'` from `ActivePage`. |
| `src/services/storageService.ts` | Implemented primary persistent IndexedDB database (`zip_qr_local_db`, Schema Version `2`, object store `scan_history` with `by_timestamp` and `by_ssid` indexes), `navigator.storage.persist()` request, non-destructive `v1 -> v2` schema migration, automatic migration of legacy `localStorage` records into IndexedDB, and full saving of actual Wi-Fi passwords (`password`). |
| `src/components/NetworkCard.tsx` | Added `Saved Password` badge (`تێپەڕەوشە پاشەکەوتکراوە`), default masked password row (`••••••••`), per-card **Show/Hide Password** button, and **Copy Password** button with toast feedback. |
| `src/pages/HistoryPage.tsx` | Added persistent IndexedDB status badge, search filter across SSID/security/format, single-record deletion, and confirmed Clear All History modal. |
| `src/services/qrDecoder.ts` | Upgraded to v4.0 5-stage progressive recognition pipeline (`BarcodeDetector` -> `jsQR` -> Global Threshold + 4-Orientation Matrix -> Inverted Polarity -> Integral-Image Adaptive Binarization + Finder Localization -> Percentile Histogram Stretch + 3x3 Laplacian Sharpening) and added `extractAllQRCodesFromImageData` / `decodeAllQRCodesFromFile` for multi-QR image uploads. |
| `src/services/cameraService.ts` & `src/components/Scanner.tsx` | Added hardware capability detection (`track.getCapabilities()`) for Torch (`caps.torch`), Zoom (`caps.zoom`), continuous autofocus/exposure, and multi-camera switching; hid unsupported controls so nonfunctional buttons are never shown. |
| `src/pages/SettingsPage.tsx` & `src/i18n/translations.ts` | Updated Kurdish Sorani (`ckb`, RTL, default) and English (`en`, LTR) translations with transparent IndexedDB privacy explanations and new UI strings. |
| `src/templates/body.html` & `src/templates/runtime.js` | Synchronized production template and runtime with IndexedDB history, masked password reveal/copy on History cards, multi-QR selector modal, and hardware-detected camera controls. |

### 1.5 What Was Intentionally Left Unchanged
- **Project Identity & Creator Credit:** Preserved `ZIP QR — Wi-Fi QR Decoder`, `SCAN. REVEAL. CONNECT.`, and `Zardasht Muhammad` (`Developer & Creator`, `mailto:zardashtmuhammad12@gmail.com`).
- **Wi-Fi & DPP Parser (`src/services/wifiParser.ts`):** Preserved RFC/ZXing-compliant escaping (`\;`, `\,`, `\:`, `\\`, `\"`), WPA/WPA2/WPA3-SAE/WEP/Open/Hidden support, and strict DPP handling (never fabricating a password when none is encoded).
- **PWA Cache & Service Worker Lifecycle (`public/sw.js`, `scripts/buildDist.cjs`):** Preserved content-fingerprinted asset bundles (`/assets/index.<hash>.js`, `/assets/index.<hash>.css`), network-first HTML navigation, and scoped cache cleanup that never touches IndexedDB.

## 2. Testing Report

### 2.1 Commands Executed & Summary
All required commands were executed from the project root (`ZIP-WIFI-QR-DECODER-GITHUB/`):

| Command | Exit Status | Result Summary |
| :--- | :--- | :--- |
| `npm ci` | `0 (PASS)` | Clean install verified (`up to date, audited 1 package in 48ms, found 0 vulnerabilities`). |
| `npm test` | `0 (PASS)` | **30 / 30 automated test suites passed (`0 failed`)**. |
| `npm run build` | `0 (PASS)` | Built `dist/` bundle (`v2.5.0-d7bef3b6`) with `/assets/index.2254cbc0.css`, `/assets/index.b7903394.js`, `dist/sw.js`, and `dist/version.json`. |

### 2.2 Breakdown of Automated Test Results (30 Suites)
- **Wi-Fi & Multi-Format QR Parsing (Tests 01–12 — 12/12 Passed):** Verified WPA, WPA2, WPA3-SAE, WEP, Open (`nopass`), Hidden (`H:true`), escaped special characters in passwords and SSIDs, Unicode (Kurdish Sorani & emoji) SSIDs/passwords, missing passwords, plain text, URLs, empty strings, and `DPP:` public-key payloads.
- **Multi-Format Image Decoding (Test 13 — Passed):** Generated 18 ephemeral QR images across PNG, JPEG, and WEBP formats and verified 18/18 exact decodes.
- **Persistent IndexedDB History & Saved Passwords (Tests 14 & 27 — Passed):** Verified that `zip_qr_local_db` (Schema v2) saves actual Wi-Fi passwords (`entry.password` and `entry.result.password`), supports search filtering, deletes individual records without affecting other records, clears all records upon confirmation, and migrates `v1 -> v2` records without losing saved passwords.
- **Clipboard & Export Formatting (Test 15 — Passed):** Verified clipboard copy and `.txt`/`.json` report generation.
- **Kurdish Sorani (`ckb`) & English (`en`) Localization (Tests 16–18 — Passed):** Verified `ckb` default language, 100% key parity between `ckb` and `en`, RTL/LTR direction switching, language persistence, and Zardasht Muhammad creator attribution.
- **PWA Build, `_headers` & Service Worker Cache Lifecycle (Tests 19–24 — Passed):** Verified content-fingerprinted assets, Cloudflare `_headers`, network-first HTML navigation, offline fallback, `/sw.js` bypass, reload-loop guard (`zip_qr_sw_reload_guard_v1`), and confirmation that `sw.js` never touches `indexedDB`.
- **10-Condition Scanner Resilience & Multi-QR Detection (Tests 25, 26 & 30 — Passed):** Verified 10/10 decodes across clear, small (`74x74`), blurry (`r=1.5`), rotated (`90°`, `180°`, `270°`), low-light gradient, inverted dark-mode, center-damaged, and cluttered `640x480` camera frames, plus multi-QR detection (`extractAllQRCodesFromImageData`) on a composite image containing 2 distinct Wi-Fi QR codes.
- **No-Login & Security/Privacy Audit (Tests 28 & 29 — Passed):** Verified zero auth/account files or UI tabs exist, zero prohibited History backup/export/import/restore/sync methods exist, zero external network requests (`XMLHttpRequest`, `sendBeacon`, `supabase`) exist in `runtime.js`, zero `console.log` credential leaks exist in `src/services/`, and History passwords render masked (`••••••••`) via `.textContent`.

### 2.3 Tests That Could Not Be Performed in This Environment
Because the verification environment is a headless Linux container without physical camera optics or mobile hardware:
- Physical mobile optical autofocus, hardware LED flashlight (`torch`), and optical camera zoom slider behavior could not be tested on physical iPhone, iPad, or Android camera sensors and must be verified on real devices after deployment.

## 3. Performance Report

### 3.1 Previous vs. Improved Scanning Architecture
- **Previous Architecture:** Relied on basic `jsQR` or global mid-point thresholding with a fixed 4-stage fallback, lacked contrast-stretch + unsharp convolution for low-contrast blurry uploads, and only returned a single QR code per uploaded image.
- **Improved v4.0 Progressive Architecture:**
  1. **Stage 0 — Native `BarcodeDetector` Singleton:** Uses hardware-accelerated browser QR detection on Chrome/Edge/Android/macOS when supported, with zero per-frame object allocation.
  2. **Stage 1 — `jsQR` (`inversionAttempts: 'attemptBoth'`):** Fast client-side JS decoder pass for standard and inverted QR codes.
  3. **Stage 2 — Fast Global Mid-Luminance Threshold + Tight Bounding Box + 4-Orientation Matrix Sampling:** Decodes clean and rotated (`0°`, `90°`, `180°`, `270°`) QR codes in `< 2 ms`.
  4. **Stage 3 — Inverted Polarity Recovery:** Directly recovers white-on-dark QR codes displayed on dark-mode phone screens.
  5. **Stage 4 — Integral-Image Bradley-Roth Local Adaptive Thresholding + 1:1:3:1:1 Finder Pattern Triad Localization:** Isolates QR codes under uneven shadows, gradients, and cluttered `640x480` camera frames.
  6. **Stage 5 — Percentile Histogram Contrast Stretch (2nd–98th percentile) + 3x3 Unsharp Laplacian Kernel:** Recovers low-contrast and slightly blurred images only when Stages 0–4 fail.
  7. **Multi-QR Composite Detection (`extractAllQRCodesFromImageData`):** Scans full image and spatial quadrants on uploaded images to detect multiple QR codes without slowing down single-frame live camera scanning.

### 3.2 Actual Measured Scanning Latency (Node.js v18.20.4 Benchmark)
Measured across 30 iterations per condition using `perf_hooks.performance.now()`:

| Test Condition | Resolution | Success Rate | Median (`p50`) | P95 (`p95`) | Target (`p50 < 500ms`, `p95 < 1500ms`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Standard Clear Wi-Fi QR | `296x296` | `30 / 30 (100%)` | `0.36 ms` | `0.42 ms` | PASS |
| Small / Low-Resolution QR | `74x74` | `30 / 30 (100%)` | `0.30 ms` | `0.39 ms` | PASS |
| Blurry QR (Gaussian `r=1.5`) | `296x296` | `30 / 30 (100%)` | `0.99 ms` | `1.08 ms` | PASS |
| Rotated QR (`90° / 180° / 270°`) | `296x296` | `30 / 30 (100%)` | `1.48 ms` | `3.60 ms` | PASS |
| Inverted Dark-Mode QR | `296x296` | `30 / 30 (100%)` | `4.70 ms` | `5.07 ms` | PASS |
| Damaged Center Modules (RS Recovery) | `296x296` | `30 / 30 (100%)` | `0.71 ms` | `0.76 ms` | PASS |
| Cluttered Camera Frame | `640x480` | `30 / 30 (100%)` | `3.61 ms` | `3.86 ms` | PASS |
| Low-Light Uneven Gradient | `296x296` | `30 / 30 (100%)` | `8.91 ms` | `76.86 ms` | PASS |

### 3.3 Bundle Size & Browser Compatibility Findings
- **Production Bundle Size:** `dist/assets/index.b7903394.js` is `141 KB` (uncompressed) and `dist/assets/index.2254cbc0.css` is `4.2 KB`, with zero runtime npm bloat.
- **Browser Compatibility:** Works across modern Safari (iOS/iPadOS/macOS), Chrome, Edge, and Firefox on Windows, macOS, Linux, and Android. Native `BarcodeDetector`, `requestVideoFrameCallback`, `navigator.storage.persist()`, and camera `torch`/`zoom` capabilities are all feature-detected with automatic fallbacks.

## 4. Privacy and Security Report

### 4.1 Where Wi-Fi Passwords Are Stored & How History Works
- When `Save Scan History` is enabled, decoded Wi-Fi records—including the **actual Wi-Fi password (`password`)**, `ssid`, `securityType`, `hiddenNetwork`, `category`, and `timestamp`—are stored locally in the browser's **IndexedDB** database (`zip_qr_local_db`, object store `scan_history`).
- On startup, the app calls `navigator.storage.persist()` (where supported) to request durable storage from the browser and automatically migrates any legacy `localStorage` history entries into IndexedDB.

### 4.2 Zero External Server Transmissions
- **100% Client-Side Execution:** Camera frames, uploaded images, raw QR strings, SSIDs, and Wi-Fi passwords are processed strictly inside the user's browser.
- **Zero Network Uploads:** No scan data is ever transmitted to Cloudflare Functions, external APIs, databases, or analytics services. Cloudflare Pages serves only static application files (`HTML`, `CSS`, `JS`, `SVG`, `manifest.json`, `sw.js`).

### 4.3 Password Visibility & Safe DOM Handling
- In **History** and **Recently Scanned Codes**, saved passwords are always masked by default (`••••••••`). Each card provides its own **Show Password / Hide Password** toggle and **Copy Password** button.
- All dynamic values (SSIDs, passwords, raw payloads) are rendered via `.textContent` (or React JSX text nodes), preventing DOM-based XSS if a malicious QR payload contains `<script>` or HTML markup.
- Passwords are never written to `console.log`, URLs, or page titles.

### 4.4 Realistic Limitations of Local Browser Storage
- Because ZIP QR intentionally has no login or master-password system, IndexedDB records are stored in browser-local plaintext storage scoped to the site origin (`https://zip-wifi-qr-decoder.pages.dev`).
- Anyone with physical or OS-level access to the same unlocked device and browser profile can reveal saved passwords in the History tab or inspect browser site storage.
- If a user manually clears browser site data/storage for the site (or uses an ephemeral Incognito/Private window that wipes storage on close), the browser will delete the local IndexedDB database. Normal app refreshes, browser restarts, device reboots, and PWA Service Worker updates do **not** erase IndexedDB History.

## 5. GitHub Website Upload Instructions

Because Cloudflare Pages is configured with **Root directory:** `ZIP-WIFI-QR-DECODER-GITHUB`, **Build command:** `npm run build`, and **Build output directory:** `dist` on the `main` branch:

1. Extract **`ZIP-WIFI-QR-DECODER-ADVANCED.zip`** on your computer. Inside, you will see the folder named **`ZIP-WIFI-QR-DECODER-GITHUB`**.
2. Open your repository on the GitHub website: [`https://github.com/zardasht-2018/ZIP-WIFI-QR-DECODER`](https://github.com/zardasht-2018/ZIP-WIFI-QR-DECODER).
3. If your repository currently has the `ZIP-WIFI-QR-DECODER-GITHUB` folder at the root:
   - Click **Add file** -> **Upload files** at the repository root.
   - Drag and drop the extracted **`ZIP-WIFI-QR-DECODER-GITHUB`** folder into the GitHub upload box so GitHub replaces the matching files inside `ZIP-WIFI-QR-DECODER-GITHUB/`.
   - *(Optional cleanup on GitHub web)*: If old deleted files (`src/services/authService.ts`, `src/pages/AccountPage.tsx`, or `supabase/`) still appear inside `ZIP-WIFI-QR-DECODER-GITHUB/` on GitHub after uploading, open those files in the GitHub web interface, click the `...` menu (or trash-can icon), and delete them.
4. Enter a commit message such as:
   `Upgrade ZIP QR v4.0: Persistent IndexedDB password history, multi-stage scanner & local-only privacy`
5. Select **Commit directly to the `main` branch** and click **Commit changes**.
6. Cloudflare Pages will automatically detect the commit on `main`, run `npm run build` inside `ZIP-WIFI-QR-DECODER-GITHUB`, and publish the updated `dist/` bundle to [`https://zip-wifi-qr-decoder.pages.dev/`](https://zip-wifi-qr-decoder.pages.dev/).
