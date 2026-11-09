# GitHub Website Upload Guide — `ZIP-WIFI-QR-DECODER`

This guide explains how to upload the complete **`ZIP-WIFI-QR-DECODER`** source code repository using the **GitHub Website** (`github.com`) browser uploader, without needing GitHub Desktop or the `git` command-line client.

> **Important Rule**: Do **not** upload `ZIP-WIFI-QR-DECODER-GITHUB.zip` as a single `.zip` file into GitHub, because GitHub does not automatically extract `.zip` archives. First extract `ZIP-WIFI-QR-DECODER-GITHUB.zip` on your computer so that all individual folders (`public/`, `src/`, `tests/`, `scripts/`) and root files (`package.json`, `index.html`, `vite.config.ts`, etc.) are visible.

## 1. Repository File Count & Size Audit

- **Prepared Source Folder**: `ZIP-WIFI-QR-DECODER-GITHUB`
- **Total File Count**: **38 files** (well below GitHub's 90-file per-batch limit)
- **Total Uncompressed Size**: **~158 KB**
- **Largest Single File**: `src/services/qrDecoder.ts` (**25.4 KB** — 0 files exceed GitHub's 20 MB/25 MB browser limit)
- **Excluded Artifacts**: `node_modules/`, `dist/`, `.git/`, `.env`, API keys, and sample QR image collections are strictly excluded.

## 2. Step-by-Step GitHub Website Upload Plan

### Step 1 — Extract the Local Archive
1. Download **`ZIP-WIFI-QR-DECODER-GITHUB.zip`** to your computer.
2. Right-click **`ZIP-WIFI-QR-DECODER-GITHUB.zip`** and select **Extract All...** (Windows) or double-click to unzip (macOS / Linux).
3. Open the extracted folder so you can see `package.json`, `index.html`, `src/`, `public/`, `tests/`, and `scripts/` directly at the top level.

### Step 2 — Create the Public GitHub Repository
1. Sign in to [https://github.com](https://github.com).
2. Click the **`+`** icon in the top-right corner and select **New repository**.
3. Enter the Repository name: **`ZIP-WIFI-QR-DECODER`**
4. Select **Public**.
5. **Leave unchecked** *"Add a README file"*, *"Add .gitignore"*, and *"Choose a license"* (because those files are already included in your prepared folder).
6. Click **Create repository**.

### Step 3 — Open the GitHub Browser File Uploader
1. On the newly created repository page, click the link **uploading an existing file** (inside the *"Quick setup — if you’ve done this kind of thing before"* box).
2. You will see the drag-and-drop area: *"Drag files here to add them to your repository"*.

### Step 4 — Upload Batch Plan (1 Single Batch or 2 Optional Sub-Batches)

Because the entire clean repository contains **38 files** (under the 90-file limit) and **0 files over 20 MB**, modern desktop browsers (Chrome, Edge, Safari, Firefox) allow you to drag and drop all root files and folders in **Batch 1** at once while preserving directory structure.

#### Option A: Single-Batch Full Folder Drag-and-Drop (Recommended — 38 files total)
- **Destination Directory in GitHub**: Repository Root (`/`)
- **Action**: Open your extracted folder on your computer, select all **9 root files** and **4 folders** listed below, and drag them together into the GitHub browser upload box:
  - **Root Files (9 files)**:
    - `.gitignore`
    - `README.md`
    - `index.html`
    - `package.json`
    - `package-lock.json`
    - `postcss.config.js`
    - `tailwind.config.js`
    - `tsconfig.json`
    - `vite.config.ts`
  - **Folders (29 files across 4 folders — folder paths preserved automatically on drag-and-drop)**:
    - `public/` (7 files: `_headers`, `_redirects`, `manifest.json`, `sw.js`, `icons/icon-192.svg`, `icons/icon-512.svg`, `logo/zip-logo.svg`)
    - `scripts/` (1 file: `buildDist.cjs`)
    - `src/` (20 files across `App.tsx`, `main.tsx`, `components/`, `pages/`, `services/`, `hooks/`, `utils/`, `styles/`, `types/`)
    - `tests/` (1 file: `runTests.cjs`)
- **Commit Changes**:
  - In the **Commit changes** box at the bottom, enter: `Initial release of ZIP WiFi QR Decoder`
  - Select **Commit directly to the `main` branch**.
  - Click **Commit changes**.

#### Option B: Two-Batch Upload (If Uploading on a Mobile/Tablet Browser)
- **Batch 1 (17 files) → Destination: Repository Root (`/`)**:
  - Upload the 9 root files (`package.json`, `package-lock.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.js`, `postcss.config.js`, `README.md`, `.gitignore`) plus `public/` (7 files) and `tests/` (1 file).
- **Batch 2 (21 files) → Destination: Repository Root (`/`)**:
  - Click **Add file → Upload files** at the repository root (`/`), then drag the `src/` folder (20 files) and `scripts/` folder (1 file) into the upload box and click **Commit changes**.

## 3. Post-Upload Verification Checklist on GitHub
After your upload finishes, check your repository main page (`https://github.com/<your-username>/ZIP-WIFI-QR-DECODER`) and confirm that:
- `package.json` is visible **directly at the root** of the repository (not nested inside an extra `ZIP-WIFI-QR-DECODER/` subfolder).
- The folders `public/`, `src/`, `tests/`, and `scripts/` appear at the root level.
- The active branch name in the top-left dropdown is **`main`**.
