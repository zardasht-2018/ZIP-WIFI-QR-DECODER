# ZIP QR (v2.5.0) — Final Cross-Platform Test Compatibility & Public-Release Report

- **Project:** ZIP QR (`Wi-Fi QR Decoder`)
- **Release Version:** `2.5.0` (`v2.5.0-d12c5892`)
- **Live Website:** [https://zip-wifi-qr-decoder.pages.dev/](https://zip-wifi-qr-decoder.pages.dev/)
- **GitHub Repository:** [https://github.com/zardasht-2018/ZIP-WIFI-QR-DECODER](https://github.com/zardasht-2018/ZIP-WIFI-QR-DECODER)
- **Creator & Developer:** Zardasht Muhammad ([zardashtmuhammad12@gmail.com](mailto:zardashtmuhammad12@gmail.com))

---

## 1. Exact File Changed in This Final Fix

| Modified File | Change Summary |
| :--- | :--- |
| `tests/runTests.cjs` | Replaced all remaining hardcoded `execSync(\`python3 -c '...'\`)` invocations in **Tests 13, 26, 33, 35, and 36** (alongside **Test 25**) with `runPythonJson(pyScript)`, and updated `getPythonCommand()` to probe `['python3', 'python', 'py -3']` via `stdin` (`${candidate} -`) rather than `-c "..."`. Zero `python3 -c` or single-quoted shell commands remain anywhere in `tests/runTests.cjs`, ensuring 100% compatibility with Windows `cmd.exe`, Windows PowerShell, macOS, and Linux shells while preserving `maxBuffer: 150 * 1024 * 1024` for large synthesized image fixtures. |
| `PUBLIC_RELEASE_CLEANUP_REPORT.md` | Updated verification report documenting the cross-platform `tests/runTests.cjs` fix. |

*(No production source files, QR decoding algorithms, Wi-Fi parser, IndexedDB History, PWA Service Worker, icons, branding, or Cloudflare configurations were modified.)*

---

## 2. Verification of All Python Invocations in `tests/runTests.cjs`

All 6 Python-based image synthesis tests in `tests/runTests.cjs` now exclusively call `runPythonJson(...)`:

1. **Line 49 (`getPythonCommand`)**: `execSync(\`${candidate} -\`, { input: 'import cv2, PIL, numpy\n', stdio: 'ignore' })` — Detects `python3`, `python`, or `py -3` via `stdin`.
2. **Line 61 (`runPythonJson`)**: `execSync(\`${pyCmd} -\`, { input: pyScript, maxBuffer: 150 * 1024 * 1024 })` — Pipes Python script over `stdin` and parses JSON stdout.
3. **Line 289 (`Test 13`)**: `const fixtures = runPythonJson(pyScript);` (PNG, JPG, WEBP on-the-fly QR fixtures).
4. **Line 795 (`Test 25`)**: `const items = runPythonJson(pyScript);` (10 challenging camera/lighting/blur/rotation QR conditions).
5. **Line 866 (`Test 26`)**: `const composite = runPythonJson(pyScript);` (Multi-QR composite image fixture).
6. **Line 1172 (`Test 33`)**: `const offlineImg = runPythonJson(pyOfflineQr);` (15-step offline PWA QR image fixture).
7. **Line 1267 (`Test 35`)**: `const data = runPythonJson(pyBench);` (Multi-format `1600px` uploaded image benchmark fixtures).
8. **Line 1374 (`Test 36`)**: `const cases = runPythonJson(pyLcd);` (LCD subpixel moiré, dark-room, tilted, and 4-corner perspective keystone regression fixtures).

---

## 3. Command Verification Results (`npm ci`, `npm test`, `npm run build`)

1. **`npm ci`:**
   - Output: `up to date, audited 1 package in 52ms — found 0 vulnerabilities`
2. **`npm test` (`node tests/runTests.cjs`):**
   - **Test Suites:** `1 passed, 0 failed (1 total)`
   - **Individual Tests:** `36 passed, 0 failed (36 total)` (`[TEST 01]` through `[TEST 36]`)
   - **Assertions:** `369 verified`
3. **`npm run build` (`node scripts/buildDist.cjs`):**
   - Output: `Built production bundle [v2.5.0-d12c5892] into dist/`

---

## 4. GitHub Website Upload Instructions (`ZIP-QR-FINAL-PUBLIC-READY.zip`)

1. Extract **`ZIP-QR-FINAL-PUBLIC-READY.zip`** on your computer.
2. Open [https://github.com/zardasht-2018/ZIP-WIFI-QR-DECODER](https://github.com/zardasht-2018/ZIP-WIFI-QR-DECODER).
3. Click **Add file** → **Upload files**, and drag the **`ZIP-WIFI-QR-DECODER-GITHUB`** folder (or its inner files if uploading directly inside `ZIP-WIFI-QR-DECODER-GITHUB/`) into the upload area.
4. Commit directly to the **`main`** branch. Cloudflare Pages (`Repository: ZIP-WIFI-QR-DECODER`, `Production branch: main`, `Root Directory: ZIP-WIFI-QR-DECODER-GITHUB`, `Build Command: npm run build`, `Build Output Directory: dist`) will automatically build and deploy `v2.5.0` to [https://zip-wifi-qr-decoder.pages.dev/](https://zip-wifi-qr-decoder.pages.dev/).
