# ZIP WiFi QR Decoder

**SCAN. REVEAL. CONNECT.**

## 1. Project Title
**ZIP WiFi QR Decoder** — Cross-Platform Progressive Web Application (PWA) for Local Wi-Fi QR Code Decoding and Password Extraction.

## 2. Project Description
ZIP WiFi QR Decoder is a privacy-first, client-side web application that decodes Wi-Fi QR codes and immediately extracts and displays the actual encoded Wi-Fi network credentials—most importantly the **Wi-Fi password**, **SSID**, **encryption security type**, and **hidden network status**.

All QR image processing, camera stream scanning, and payload parsing execute 100% locally inside the user's browser. No QR images, network names, or passwords are ever uploaded to an external server.

> **Important Accuracy Notice:** This application extracts passwords and network parameters that are **actually encoded** inside a scanned or uploaded QR code payload (such as standard `WIFI:T:...;S:...;P:...;H:...;;` QR codes). It cannot recover or guess a password from a QR code that does not contain one (such as an incomplete QR payload or a cryptographic public-key `DPP:` Wi-Fi Easy Connect code). When no password is present in the QR payload, the application explicitly displays: `"No password is encoded in this QR code."`

## 3. Main Features
- **Clean, Professional Home Interface**: Opens directly to a distraction-free Home screen with zero fake sample networks or preloaded demonstration galleries, featuring three primary actions:
  1. **SCAN QR CODE**: Live camera scanning via `navigator.mediaDevices.getUserMedia` with automatic detection, scanning frame reticle, camera lens selector, hardware flashlight (torch) toggle where supported, automatic camera stop upon detection, and automatic image-upload fallback when camera access is unavailable.
  2. **UPLOAD QR IMAGE**: Local image decoding supporting **PNG**, **JPG**, **JPEG**, and **WEBP** via desktop drag-and-drop or mobile gallery selection.
  3. **PASTE QR CONTENT**: Direct payload input for decoding `WIFI:...;;`, `DPP:...;;`, or other QR payload strings immediately.
- **RFC / IEEE 802.11 / ZXing Wi-Fi Parser**:
  - State-machine lexical parser (`src/services/wifiParser.ts`) that properly unescapes special characters (`\\`, `\;`, `\,`, `\:`, `\"`) inside passwords and SSIDs without breaking on colons or semicolons.
  - Recognizes **WPA**, **WPA2**, **WPA3 / SAE** (when represented via `T:SAE` or Transition Disable `R:1`), **WPA2-EAP** (`E:`, `A:`, `I:`, `PH2:`), **WEP**, **Open (`nopass`)** networks, and **Wi-Fi Easy Connect (`DPP:`)** public-key provisioning formats.
  - Identifies non-Wi-Fi QR payloads (**Website URLs**, **vCard / MECARD Contacts**, **Email**, **SMS**, **Phone Numbers**, and **Plain Text**) without automatically opening untrusted external URLs.
- **Prominent Password & Results Controls**:
  - Displays extracted passwords in a high-contrast card with **Show / Hide Password**, **Copy Password**, **Copy SSID**, **Copy All Information**, **Download Results (.TXT / .JSON)**, and **Scan Another Code**.
- **Optional Local Scan History**:
  - Locally managed `localStorage` scan history with search filtering, individual entry deletion, full history wipe, and an opt-in/opt-out toggle.

## 4. Technologies Used
- **Frontend Framework**: React 18 + TypeScript
- **Build Tool**: Vite 5
- **Styling**: Tailwind CSS 3 + Modern CSS custom properties
- **QR Decoding Engine**: Multi-engine local decoder (`src/services/qrDecoder.ts`) combining `jsQR`, Browser Native `BarcodeDetector` API, and a built-in ISO/IEC 18004 Reed-Solomon matrix decoder
- **Camera API**: `navigator.mediaDevices.getUserMedia` (`src/services/cameraService.ts`)
- **Offline Support**: Web App Manifest (`public/manifest.json`) + Service Worker (`public/sw.js`)

## 5. Screenshots
*(Screenshots can be placed in `docs/screenshots/` after deployment)*
- `docs/screenshots/home-screen.png` — Clean Home page with **Scan QR Code**, **Upload QR Image**, and **Paste QR Content**
- `docs/screenshots/live-scanner.png` — Live Camera Scanner with reticle frame and flashlight/camera controls
- `docs/screenshots/results-password.png` — Decoded Wi-Fi Results & Prominent Password Extraction view

## 6. Installation Instructions
### Prerequisites
- **Node.js**: v18.0.0 or newer
- **npm**: v9.0.0 or newer

### Clone & Install Dependencies
```bash
git clone https://github.com/<your-username>/ZIP-WIFI-QR-DECODER.git
cd ZIP-WIFI-QR-DECODER
npm install
```

## 7. Development Instructions
Start the local Vite development server with hot module replacement (HMR):
```bash
npm run dev
```
Open `http://localhost:5173` in your browser. Because `localhost` is treated as a secure context by modern browsers, live webcam scanning works during local development.

## 8. Testing Instructions
Run the automated QA and security test suite:
```bash
npm test
```
The test suite (`tests/runTests.cjs`) verifies all 15+ core functional requirements—including WPA, WPA2, WPA3-SAE, WEP, Open networks, Hidden networks, escaped special characters in passwords and SSIDs, missing passwords, non-Wi-Fi URLs, empty payloads, DPP provisioning codes, on-the-fly ephemeral PNG/JPG/WEBP image decoding, local history privacy controls, and clipboard/export formatting.

## 9. Production Build Instructions
Create an optimized production bundle in the `dist/` directory:
```bash
npm run build
```
To preview the production build locally:
```bash
npm run preview
```

## 10. Cloudflare Pages Deployment Instructions
This repository is pre-configured for **Cloudflare Pages** with GitHub integration:

| Setting | Value |
| :--- | :--- |
| **Framework preset** | `Vite` |
| **Build command** | `npm run build` |
| **Build output directory** | `dist` |
| **Production branch** | `main` |
| **Root directory** | `/` |

See `CLOUDFLARE_DEPLOYMENT_GUIDE.md` for step-by-step instructions on connecting your GitHub repository to Cloudflare Pages and testing over HTTPS.

## 11. Privacy and Security Information
- **100% Client-Side Execution**: All QR code image decoding and Wi-Fi payload parsing occur inside the browser on the user's device.
- **Zero External Transmission**: No images, SSIDs, or passwords are ever transmitted to any backend server, cloud API, or analytics tracker.
- **No Credential Logging**: Extracted passwords are never written to console logs or included in exported filenames (downloaded reports use neutral timestamped filenames such as `zip-qr-decoded-report-YYYY-MM-DD.txt`).
- **Untrusted Input Safety**: Decoded website URLs are displayed as text and are never opened automatically.

## 12. Known Limitations
- **HTTPS Required for Live Camera**: Browser security policies require `https://` (or `http://localhost`) for `navigator.mediaDevices.getUserMedia`. Deploying to Cloudflare Pages automatically provides `https://*.pages.dev`.
- **Hardware Flashlight (Torch) Support**: The browser `torch` constraint is supported primarily on Android Chrome/Edge with rear cameras; iOS Safari and desktop webcams generally do not expose hardware flashlight controls to web applications, so the button gracefully disables itself (`Flashlight N/A`) when unsupported.
- **Non-Plaintext Wi-Fi QR Formats**: Wi-Fi Easy Connect (`DPP:`) QR codes encode a cryptographic public key rather than a plaintext passphrase. The decoder accurately extracts the public key, MAC address, and channel info, and informs the user that no plaintext password is present in the QR code.
