# Cloudflare Pages Deployment Guide — `ZIP-WIFI-QR-DECODER`

This guide documents the exact production build architecture and configuration for deploying **ZIP QR** (`https://zip-wifi-qr-decoder.pages.dev/`) on **Cloudflare Pages** via **GitHub Integration** (`https://github.com/zardasht-2018/ZIP-WIFI-QR-DECODER`).

---

## 1. Required Cloudflare Pages Build Settings

Configure your Cloudflare Pages project with these exact settings:

| Configuration Field | Required Value |
| :--- | :--- |
| **Repository** | `ZIP-WIFI-QR-DECODER` |
| **Production branch** | `main` |
| **Root Directory** | `ZIP-WIFI-QR-DECODER-GITHUB` |
| **Build Command** | `npm run build` |
| **Build Output Directory** | `dist` |

> **Important Architecture Note:** The production build is **not** a Vite build. Running `npm run build` executes `node scripts/buildDist.cjs`, a deterministic Node.js static builder that compiles and content-hashes `src/templates/body.html`, `src/templates/app.css`, `src/templates/runtime.js`, and `public/*` directly into `dist/`. In Cloudflare Pages, you can leave **Framework preset** set to **`None`** (or any static preset as long as **Build Command** is `npm run build` and **Build Output Directory** is `dist`).

---

## 2. How the Production Build Pipeline Works

When Cloudflare Pages pulls a commit from the `main` branch of `ZIP-WIFI-QR-DECODER` inside `ZIP-WIFI-QR-DECODER-GITHUB`:

1. **Dependency Check (`npm clean-install` / `npm install`):** Reads `package.json` and `package-lock.json` inside `ZIP-WIFI-QR-DECODER-GITHUB/`.
2. **Static Bundle Generation (`npm run build` → `node scripts/buildDist.cjs`):**
   - Copies all static files from `public/` (`manifest.json`, `_headers`, `_redirects`, `browserconfig.xml`, favicons, Apple Touch Icons, and standard/maskable PWA icons) into `dist/`.
   - Reads `src/templates/app.css`, `src/templates/body.html`, and `src/templates/runtime.js`.
   - Computes SHA-256 content hashes and writes immutable fingerprinted bundles (`dist/assets/index.<cssHash>.css` and `dist/assets/index.<jsHash>.js`).
   - Injects the unique build version (`v2.5.0-<combinedHash>`) and hashed asset paths into `dist/sw.js` and `dist/version.json`.
   - Generates `dist/index.html` referencing the fingerprinted assets with zero external CDN dependencies.
3. **Edge Publication:** Publishes `dist/` to Cloudflare's global HTTPS edge network, applying the cache rules in `dist/_headers` (`no-cache, no-store, must-revalidate` on `/`, `/index.html`, `/sw.js`, and `immutable` on `/assets/*`).

---

## 3. Active Production Sources vs. Development/Testing Files

- **Active Production Source Files (Used by `npm run build`):**
  - `src/templates/body.html`
  - `src/templates/app.css`
  - `src/templates/runtime.js`
  - `public/` (`sw.js`, `manifest.json`, `_headers`, `_redirects`, `icons/`, `logo/`, favicons, Apple Touch Icons)
  - `scripts/buildDist.cjs`
- **Development & Testing Resources (Used by `npm test` and `npm run dev`):**
  - `tests/runTests.cjs`
  - `src/compiled/*.cjs`
  - `src/services/*.ts`, `src/utils/*.ts`, `src/i18n/translations.ts`, `src/types/index.ts`
  - `scripts/devServer.cjs`
  - `index.html`

---

## 4. Step-by-Step Cloudflare Pages Setup & Verification

1. Open the **Cloudflare Dashboard** → **Workers & Pages** → select your **`zip-wifi-qr-decoder`** Pages project (or click **Create → Pages → Connect to Git** and select **`ZIP-WIFI-QR-DECODER`**).
2. Go to **Settings → Builds & deployments** and verify:
   - **Production branch:** `main`
   - **Root Directory:** `ZIP-WIFI-QR-DECODER-GITHUB`
   - **Build Command:** `npm run build`
   - **Build Output Directory:** `dist`
3. No environment variables or Supabase secrets are needed—the application is 100% client-side.
4. Trigger a deployment by pushing or uploading updated files to the `main` branch on GitHub.
5. Once deployed, open [https://zip-wifi-qr-decoder.pages.dev/](https://zip-wifi-qr-decoder.pages.dev/) and [https://zip-wifi-qr-decoder.pages.dev/version.json](https://zip-wifi-qr-decoder.pages.dev/version.json) to confirm the latest `v2.5.0-<hash>` build is active.
