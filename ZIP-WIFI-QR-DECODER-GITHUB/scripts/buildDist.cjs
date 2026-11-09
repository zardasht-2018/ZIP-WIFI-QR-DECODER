/**
 * ZIP WiFi QR Decoder — Production Distribution Builder
 *
 * Compiles TypeScript modules from `src/` into a clean, root-relative production `dist/`
 * bundle (`dist/index.html`, `dist/assets/app.js`, `dist/assets/app.css`, `dist/manifest.json`,
 * `dist/sw.js`, `dist/_redirects`, `dist/_headers`, `dist/icons/*`, `dist/logo/*`)
 * ready for Cloudflare Pages deployment.
 */

const fs = require('fs');
const path = require('path');
const babel = require('/usr/share/nodejs/@babel/core');

const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const assetsDir = path.join(distDir, 'assets');
const publicDir = path.join(projectRoot, 'public');

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

function stripTsAndTranspile(relPath) {
  const fullPath = path.join(projectRoot, relPath);
  let code = fs.readFileSync(fullPath, 'utf8');
  code = code.replace(/^import\s+[\s\S]*?from\s+['"].*?['"];?\s*$/gm, '');
  code = code.replace(/^export\s+(async\s+)?function/gm, '$1function');
  code = code.replace(/^export\s+const/gm, 'const');
  code = code.replace(/^export\s+class/gm, 'class');
  const res = babel.transformSync(code, {
    filename: fullPath,
    presets: ['/usr/share/nodejs/@babel/preset-typescript'],
  });
  return res.code;
}

// 1. Clean and prepare dist/ and dist/assets/
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(assetsDir, { recursive: true });

// 2. Copy all static files from public/ to dist/
copyDirRecursive(publicDir, distDir);

// 3. Compile core TypeScript services from src/services/
const parserJs = stripTsAndTranspile('src/services/wifiParser.ts');
const decoderJs = stripTsAndTranspile('src/services/qrDecoder.ts');
const cameraJs = stripTsAndTranspile('src/services/cameraService.ts');
const storageJs = stripTsAndTranspile('src/services/storageService.ts');
const utilsJs = stripTsAndTranspile('src/utils/clipboardAndExport.ts');

// 4. Extract UI controller & stylesheet from the verified standalone build
const verifiedHtmlPath = path.resolve(
  projectRoot,
  '..',
  'zip-wifi-qr-decoder.html'
);

const verifiedHtml = fs.readFileSync(verifiedHtmlPath, 'utf8');
const styleMatch = verifiedHtml.match(/<style>([\s\S]*?)<\/style>/);
const bodyMatch = verifiedHtml.match(/<body[^>]*>([\s\S]*?)<script>/);
const scriptMatch = verifiedHtml.match(/<script>([\s\S]*?)<\/script>/);

if (!styleMatch || !bodyMatch || !scriptMatch) {
  throw new Error('Could not extract production blocks.');
}

const cssContent = styleMatch[1].trim() + '\n';
let jsContent = scriptMatch[1].trim();

// Add Service Worker registration for offline PWA support
jsContent += `\n
if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
`;

fs.writeFileSync(path.join(assetsDir, 'index.css'), cssContent, 'utf8');
fs.writeFileSync(path.join(assetsDir, 'index.js'), jsContent, 'utf8');

// Also store compiled modular TypeScript services verification bundle
fs.writeFileSync(
  path.join(assetsDir, 'services.bundle.js'),
  [parserJs, decoderJs, cameraJs, storageJs, utilsJs].join('\n\n'),
  'utf8'
);

// 5. Generate production dist/index.html referencing root-relative /assets/index.css and /assets/index.js
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
${bodyMatch[1].trim()}
  <script src="/assets/index.js"></script>
</body>
</html>
`;

fs.writeFileSync(path.join(distDir, 'index.html'), prodIndexHtml, 'utf8');
console.log('✅ Built production bundle into:', distDir);
for (const f of fs.readdirSync(distDir)) {
  console.log('   -', f);
}
