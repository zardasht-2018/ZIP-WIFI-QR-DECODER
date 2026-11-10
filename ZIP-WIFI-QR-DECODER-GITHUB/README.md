# ZIP QR — Wi-Fi QR Decoder

**SCAN. REVEAL. CONNECT.**

- **Live Website**: [https://zip-wifi-qr-decoder.pages.dev/](https://zip-wifi-qr-decoder.pages.dev/)
- **GitHub Repository**: [https://github.com/zardasht-2018/ZIP-WIFI-QR-DECODER](https://github.com/zardasht-2018/ZIP-WIFI-QR-DECODER)
- **Created and developed by**: **Zardasht Muhammad** ([zardashtmuhammad12@gmail.com](mailto:zardashtmuhammad12@gmail.com))
- **دروستکراو و پەرەپێدراوە لەلایەن زەردەشت محمد.**

## 1. Project Overview
**ZIP QR — Wi-Fi QR Decoder** is a privacy-first, bilingual (**Kurdish Sorani `ckb` RTL** & **English `en` LTR**) Progressive Web Application (PWA) that decodes Wi-Fi QR codes locally in the browser and immediately extracts and displays the actual encoded **Wi-Fi password**, **SSID**, **encryption security type**, and **hidden network status**.

## 2. Main Features
- **Bilingual Kurdish Sorani & English Interface**:
  - Defaults to **Kurdish Sorani (`ckb`, `dir="rtl"`)** for first-time visitors, with instant switching between **کوردی** and **English (`en`, `dir="ltr"`)** in the top navigation header and Settings page.
  - Automatically persists the user's language choice in `localStorage` across sessions.
  - Preserves strict LTR direction (`dir="ltr"`) for technical values (SSIDs, passwords, raw `WIFI:` / `DPP:` payloads, email addresses, and URLs) so credentials are never reversed in RTL mode.
- **Three Clean Ways to Decode a QR Code**:
  1. **SCAN QR CODE (`سکانکردنی کۆدی QR`)**: Live camera scanner via `navigator.mediaDevices.getUserMedia` with camera selector, flashlight toggle where supported, and automatic image-upload fallback.
  2. **UPLOAD QR IMAGE (`بارکردنی وێنەی QR`)**: Local image decoding for **PNG**, **JPG**, **JPEG**, and **WEBP** via desktop drag-and-drop or mobile gallery selection.
  3. **PASTE QR CONTENT (`لکاندنی ناوەڕۆکی QR`)**: Direct payload input for `WIFI:...;;` and `DPP:...;;` strings.
- **Prominent Password Extraction & Controls**:
  - Supports **WPA**, **WPA2**, **WPA3 / SAE**, **WPA2-EAP**, **WEP**, **Open (`nopass`)**, hidden networks, escaped characters (`\;`, `\,`, `\:`, `\\`, `\"`), and **Wi-Fi Easy Connect (`DPP:`)**.
  - Includes **Show / Hide Password**, **Copy Password**, **Copy All Information**, and **Download Results (.TXT / .JSON)**.
- **Developer & Creator Identity**:
  - Dedicated Creator Card in the About section crediting **Zardasht Muhammad** (*Developer & Creator*) with a direct `mailto:zardashtmuhammad12@gmail.com` contact button.

## 3. Development, Testing & Production Build

```bash
npm ci
npm test
npm run build
```

- **Build command**: `npm run build`
- **Build output directory**: `dist`
- **Production branch**: `main`
