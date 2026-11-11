/**
 * ZIP WiFi QR Decoder — Local Development & Preview Server
 *
 * Serves the built `dist/` folder over HTTP on port 5173 (or PORT env var).
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// Ensure dist/ is up to date before serving
require('./buildDist.cjs');

const distDir = path.resolve(__dirname, '..', 'dist');
const port = Number(process.env.PORT || 5173);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml',
};

const server = http.createServer((req, res) => {
  const safeUrl = (req.url || '/').split('?')[0];
  let filePath = path.join(distDir, safeUrl === '/' ? 'index.html' : safeUrl);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(distDir, 'index.html');
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`ZIP WiFi QR Decoder running at http://localhost:${port}`);
});
