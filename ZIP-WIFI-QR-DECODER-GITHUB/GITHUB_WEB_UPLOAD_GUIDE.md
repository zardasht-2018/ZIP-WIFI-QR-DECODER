# GitHub Website Upload Guide — `ZIP-WIFI-QR-DECODER` (v2.5.0)

This guide explains how to upload the final **`ZIP-WIFI-QR-DECODER-GITHUB`** (`v2.5.0`) project folder to [https://github.com/zardasht-2018/ZIP-WIFI-QR-DECODER](https://github.com/zardasht-2018/ZIP-WIFI-QR-DECODER) using the GitHub web interface (`github.com`).

---

## 1. Extract the Final Public-Ready ZIP Archive

1. Download **`ZIP-QR-FINAL-PUBLIC-READY.zip`** to your computer.
2. Extract/unzip **`ZIP-QR-FINAL-PUBLIC-READY.zip`**.
3. Inside the extracted archive, locate the **`ZIP-WIFI-QR-DECODER-GITHUB`** folder.
   - **Important:** Do not upload the `.zip` file itself to GitHub. Upload the extracted **`ZIP-WIFI-QR-DECODER-GITHUB`** folder (or its contents into `ZIP-WIFI-QR-DECODER-GITHUB/` on GitHub) so Cloudflare Pages finds `package.json` at `Root Directory: ZIP-WIFI-QR-DECODER-GITHUB`.

---

## 2. Clean Repository Structure Inside `ZIP-WIFI-QR-DECODER-GITHUB/`

- **Root Files:**
  - `package.json` & `package-lock.json` (synchronized at version `2.5.0` for `npm ci`)
  - `index.html`
  - `README.md`
  - `CLOUDFLARE_DEPLOYMENT_GUIDE.md`
  - `GITHUB_WEB_UPLOAD_GUIDE.md`
  - `PUBLIC_RELEASE_CLEANUP_REPORT.md`
- **Directories:**
  - `public/` — PWA `manifest.json`, `sw.js`, `_headers`, `_redirects`, `browserconfig.xml`, favicons, Apple Touch Icons, `icons/`, and `logo/`
  - `scripts/` — `buildDist.cjs` (production builder) and `devServer.cjs` (local preview server)
  - `src/templates/` — `body.html`, `app.css`, and `runtime.js` (active production sources)
  - `src/services/`, `src/utils/`, `src/i18n/`, `src/types/`, `src/compiled/` — Canonical TypeScript & CommonJS verification modules
  - `tests/` — `runTests.cjs` (`1 test suite` • `36 individual tests`)

---

## 3. Uploading via the GitHub Website

1. Open [https://github.com/zardasht-2018/ZIP-WIFI-QR-DECODER](https://github.com/zardasht-2018/ZIP-WIFI-QR-DECODER) in your browser.
2. Click **Add file** → **Upload files**.
3. Drag and drop the **`ZIP-WIFI-QR-DECODER-GITHUB`** folder into the GitHub upload area (or if you are already inside the `ZIP-WIFI-QR-DECODER-GITHUB/` directory on GitHub, drag its inner files and folders directly).
4. Enter a commit message such as:
   ```text
   Release v2.5.0: Final version alignment, test report refinement, and privacy docs
   ```
5. Select **Commit directly to the `main` branch** and click **Commit changes**.
6. Cloudflare Pages (`Root Directory: ZIP-WIFI-QR-DECODER-GITHUB`, `Build Command: npm run build`, `Build Output Directory: dist`) will automatically build and publish the updated site to [https://zip-wifi-qr-decoder.pages.dev/](https://zip-wifi-qr-decoder.pages.dev/).
