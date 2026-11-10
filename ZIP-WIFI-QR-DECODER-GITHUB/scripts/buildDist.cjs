/**
 * ZIP WiFi QR Decoder — Self-Contained Production Distribution Builder
 *
 * Generates the production `dist/` directory (`dist/index.html`, `dist/assets/index.css`,
 * `dist/assets/index.js`, `dist/manifest.json`, `dist/sw.js`, `dist/_redirects`,
 * `dist/_headers`, `dist/icons/*`, `dist/logo/*`) using only standard Node.js built-in modules.
 *
 * Works deterministically in both local environments and Cloudflare Pages build containers.
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const assetsDir = path.join(distDir, 'assets');
const publicDir = path.join(projectRoot, 'public');
const templatesDir = path.join(projectRoot, 'src', 'templates');

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 1. Clean and create dist/ and dist/assets/
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(assetsDir, { recursive: true });

// 2. Copy all static files from public/ to dist/
copyDirRecursive(publicDir, distDir);

// 3. Read self-contained application CSS, HTML body, and JS runtime from src/templates/
const cssContent = fs.readFileSync(path.join(templatesDir, 'app.css'), 'utf8');
const bodyHtml = fs.readFileSync(path.join(templatesDir, 'body.html'), 'utf8');
let jsContent = fs.readFileSync(path.join(templatesDir, 'runtime.js'), 'utf8');

// Append Service Worker registration for offline PWA operation
jsContent += `\n
if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
`;

fs.writeFileSync(path.join(assetsDir, 'index.css'), cssContent, 'utf8');
fs.writeFileSync(path.join(assetsDir, 'index.js'), jsContent, 'utf8');

// 4. Write root-relative dist/index.html
const prodIndexHtml = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0" />
  <meta name="theme-color" content="#050811" />
  <meta name="description" content="ZIP WiFi QR Decoder — SCAN. REVEAL. CONNECT. Extract Wi-Fi passwords, SSIDs, and security settings locally in your browser." />
  <link rel="manifest" href="/manifest.json" />
  <link rel="icon" type="image/svg+xml" href="/logo/zip-logo.svg" />
  <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
  <title>ZIP WiFi QR Decoder — SCAN. REVEAL. CONNECT.</title>
  <script src="https://cdn.tailwindcss.com/3.4.17"></script>
  <script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;600;700;800&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/assets/index.css" />
</head>
<body data-theme="electric-blue" class="min-h-screen flex flex-col selection:bg-sky-500 selection:text-white">
${bodyHtml.trim()}
  <script src="/assets/index.js"></script>
</body>
</html>
`;

fs.writeFileSync(path.join(distDir, 'index.html'), prodIndexHtml, 'utf8');
console.log('✅ Built production bundle into:', distDir);
for (const f of fs.readdirSync(distDir)) {
  console.log('   -', f);
}
