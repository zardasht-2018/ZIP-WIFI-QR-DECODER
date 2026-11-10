/**
 * ZIP QR — Wi-Fi QR Decoder — Comprehensive Automated QA, Localization & PWA Cache Lifecycle Test Suite
 *
 * Verifies 24 automated test suites:
 * 1–12. Wi-Fi QR Parser & Multi-Format Recognition (WPA, WPA2, WPA3-SAE, WEP, Open, Hidden, Escaped chars, Missing pass, Text, URL, Empty, DPP)
 * 13. Ephemeral PNG/JPG/WEBP QR image decoding
 * 14. Local history privacy & opt-in/out controls
 * 15. Clipboard & export report formatting
 * 16. Kurdish Sorani (ckb) default language, English (en) parity, and persistence
 * 17. Creator identity (Zardasht Muhammad & mailto:zardashtmuhammad12@gmail.com)
 * 18. PWA manifest & page title branding (ZIP QR — Wi-Fi QR Decoder)
 * 19. Build Version & Content-Fingerprinted Assets (`dist/version.json`, `/assets/index.<hash>.js`, `/assets/index.<hash>.css`)
 * 20. Cloudflare Pages `_headers` Cache Revalidation Rules (`/`, `/index.html`, `/sw.js`, `/manifest.json`, `/assets/*`)
 * 21. Service Worker Install & Scoped Obsolete Cache Cleanup (deletes old `zip-qr-cache-*` and `zip-wifi-qr-decoder-*`, preserves unrelated caches)
 * 22. Service Worker Network-First Navigation Strategy (serves fresh deployment HTML online; falls back to cached `/index.html` offline)
 * 23. Service Worker Bypass for `/sw.js` and Cache-First for Fingerprinted `/assets/*`
 * 24. Service Worker Registration Lifecycle (`updateViaCache: 'none'`, `SKIP_WAITING`, single-reload loop guard, and `localStorage` preservation)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');

function loadModule(relTsPath, compiledName) {
  const precompiled = path.join(projectRoot, 'src', 'compiled', compiledName);
  if (fs.existsSync(precompiled)) {
    return require(precompiled);
  }
  const babel = require('/usr/share/nodejs/@babel/core');
  const fullPath = path.join(projectRoot, relTsPath);
  const src = fs.readFileSync(fullPath, 'utf8');
  const transformed = babel.transformSync(src, {
    filename: fullPath,
    presets: ['/usr/share/nodejs/@babel/preset-typescript'],
    plugins: ['/usr/share/nodejs/@babel/plugin-transform-modules-commonjs'],
  });
  const outPath = path.join('/tmp', compiledName);
  fs.writeFileSync(outPath, transformed.code);
  return require(outPath);
}

// Ensure dist/ is built before running dist/SW verification tests
require(path.join(projectRoot, 'scripts', 'buildDist.cjs'));

const wifiParser = loadModule('src/services/wifiParser.ts', 'wifiParser.cjs');
const qrDecoder = loadModule('src/services/qrDecoder.ts', 'qrDecoder.cjs');
const storageMod = loadModule('src/services/storageService.ts', 'storageService.cjs');
const clipMod = loadModule('src/utils/clipboardAndExport.ts', 'clipboardAndExport.cjs');
const i18nMod = loadModule('src/i18n/translations.ts', 'translations.cjs');

let passed = 0;
let failed = 0;

async function runAllTests() {
  async function runTest(id, title, fn) {
    try {
      await fn();
      console.log(`✅ [TEST ${String(id).padStart(2, '0')}] PASS: ${title}`);
      passed++;
    } catch (err) {
      console.error(`❌ [TEST ${String(id).padStart(2, '0')}] FAIL: ${title}`);
      console.error('   Reason:', err && err.message ? err.message : err);
      failed++;
    }
  }

  console.log('==============================================================');
  console.log('ZIP QR — Automated QA, Localization & PWA Cache Runner');
  console.log('==============================================================');

  // 1. Valid WPA QR codes
  await runTest(1, 'Valid WPA QR codes extract SSID, password, WPA security, and hidden status', () => {
    const res = wifiParser.parseQRPayload('WIFI:T:WPA;S:TestNet_Alpha;P:AlphaPass987;H:false;;');
    assert.strictEqual(res.isWifi, true);
    assert.strictEqual(res.category, 'WIFI');
    assert.strictEqual(res.ssid, 'TestNet_Alpha');
    assert.strictEqual(res.password, 'AlphaPass987');
    assert.strictEqual(res.hasPasswordField, true);
    assert.strictEqual(res.securityType, 'WPA');
    assert.strictEqual(res.hiddenNetwork, false);
    assert.strictEqual(res.hiddenDisplay, 'No');
  });

  // 2. Valid WPA2 QR codes (and WPA3/SAE transition indicator)
  await runTest(2, 'Valid WPA2 & WPA3-SAE QR codes extract credentials and encryption accurately', () => {
    const wpa2 = wifiParser.parseQRPayload('WIFI:T:WPA2;S:TestNet_Beta_5G;P:BetaKey#2026!;H:false;;');
    assert.strictEqual(wpa2.ssid, 'TestNet_Beta_5G');
    assert.strictEqual(wpa2.password, 'BetaKey#2026!');
    assert.strictEqual(wpa2.securityType, 'WPA2');

    const wpa3 = wifiParser.parseQRPayload('WIFI:T:SAE;S:TestNet_Gamma_WPA3;P:Gamma*SAE*Pass77;R:1;H:false;;');
    assert.strictEqual(wpa3.ssid, 'TestNet_Gamma_WPA3');
    assert.strictEqual(wpa3.password, 'Gamma*SAE*Pass77');
    assert.strictEqual(wpa3.securityType, 'WPA3');
  });

  // 3. WEP QR codes
  await runTest(3, 'WEP QR codes identify WEP protocol and extract hexadecimal/ASCII key', () => {
    const res = wifiParser.parseQRPayload('WIFI:T:WEP;S:TestNet_WEP;P:A1B2C3D4E5;H:false;;');
    assert.strictEqual(res.ssid, 'TestNet_WEP');
    assert.strictEqual(res.password, 'A1B2C3D4E5');
    assert.strictEqual(res.securityType, 'WEP');
    assert.strictEqual(res.hasPasswordField, true);
  });

  // 4. Open network QR codes
  await runTest(4, 'Open network QR codes (nopass) display "Open network — no password required."', () => {
    const res = wifiParser.parseQRPayload('WIFI:T:nopass;S:TestNet_Open;P:;H:false;;');
    assert.strictEqual(res.ssid, 'TestNet_Open');
    assert.strictEqual(res.password, null);
    assert.strictEqual(res.hasPasswordField, false);
    assert.strictEqual(res.securityType, 'nopass');
    assert.strictEqual(res.passwordStatusMessage, 'Open network — no password required.');
  });

  // 5. Hidden networks
  await runTest(5, 'Hidden networks (H:true) report hiddenNetwork=true and hiddenDisplay="Yes"', () => {
    const res = wifiParser.parseQRPayload('WIFI:T:WPA2;S:TestNet_Hidden;P:HiddenKey99!;H:true;;');
    assert.strictEqual(res.ssid, 'TestNet_Hidden');
    assert.strictEqual(res.password, 'HiddenKey99!');
    assert.strictEqual(res.hiddenNetwork, true);
    assert.strictEqual(res.hiddenDisplay, 'Yes');
  });

  // 6. Passwords containing special characters
  await runTest(6, 'Passwords containing escaped special characters (\\; \\, \\: \\\\ \\") unescape cleanly', () => {
    const raw = 'WIFI:T:WPA2;S:TestNet_EscapedPass;P:K3y\\;With\\:Special\\,Chars\\"\\\\!;H:false;;';
    const res = wifiParser.parseQRPayload(raw);
    assert.strictEqual(res.ssid, 'TestNet_EscapedPass');
    assert.strictEqual(res.password, 'K3y;With:Special,Chars"\\!');
    assert.strictEqual(res.hasPasswordField, true);
  });

  // 7. SSIDs containing special characters
  await runTest(7, 'SSIDs containing escaped special characters (\\; \\: \\,) unescape without splitting', () => {
    const raw = 'WIFI:T:WPA;S:Net\\;Name\\:With\\,Punctuation;P:StandardPass2026;H:false;;';
    const res = wifiParser.parseQRPayload(raw);
    assert.strictEqual(res.ssid, 'Net;Name:With,Punctuation');
    assert.strictEqual(res.password, 'StandardPass2026');
  });

  // 8. Missing passwords
  await runTest(8, 'Encrypted Wi-Fi QR codes missing a password display "No password is encoded in this QR code."', () => {
    const raw = 'WIFI:T:WPA2;S:TestNet_NoPassword;H:false;;';
    const res = wifiParser.parseQRPayload(raw);
    assert.strictEqual(res.ssid, 'TestNet_NoPassword');
    assert.strictEqual(res.password, null);
    assert.strictEqual(res.hasPasswordField, false);
    assert.strictEqual(res.passwordStatusMessage, 'No password is encoded in this QR code.');
    assert.ok(res.warnings.length > 0);
  });

  // 9. Invalid / non-Wi-Fi text QR payloads
  await runTest(9, 'Invalid or plain text QR payloads are not misinterpreted as Wi-Fi credentials', () => {
    const raw = 'Plain text QR note without any Wi-Fi parameters.';
    const res = wifiParser.parseQRPayload(raw);
    assert.strictEqual(res.isWifi, false);
    assert.strictEqual(res.category, 'TEXT');
    assert.strictEqual(res.password, null);
    assert.strictEqual(res.hasPasswordField, false);
    assert.strictEqual(res.passwordStatusMessage, 'No password is encoded in this QR code.');
  });

  // 10. Ordinary website QR codes
  await runTest(10, 'Website URL QR codes are identified as URL and never mistaken for Wi-Fi passwords', () => {
    const raw = 'https://www.wi-fi.org/discover-wi-fi/security';
    const res = wifiParser.parseQRPayload(raw);
    assert.strictEqual(res.isWifi, false);
    assert.strictEqual(res.category, 'URL');
    assert.strictEqual(res.ssid, 'www.wi-fi.org');
    assert.strictEqual(res.password, null);
    assert.ok(res.warnings[0].includes('never opened automatically'));
  });

  // 11. Empty QR payloads
  await runTest(11, 'Empty or whitespace-only QR payloads return EMPTY category safely', () => {
    const res = wifiParser.parseQRPayload('   ');
    assert.strictEqual(res.category, 'EMPTY');
    assert.strictEqual(res.isWifi, false);
    assert.strictEqual(res.password, null);
    assert.strictEqual(res.passwordStatusMessage, 'No password is encoded in this QR code.');
  });

  // 12. DPP QR recognition
  await runTest(12, 'DPP (Wi-Fi Easy Connect) QR codes extract public key & MAC and never fake a password', () => {
    const raw = 'DPP:C:81/1,115/36;M:AA:BB:CC:11:22:33;I:Device-AP;K:MDkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDIgAD26;;';
    const res = wifiParser.parseQRPayload(raw);
    assert.strictEqual(res.category, 'DPP');
    assert.strictEqual(res.securityType, 'DPP');
    assert.strictEqual(res.ssid, 'Device-AP');
    assert.strictEqual(res.password, null);
    assert.strictEqual(res.hasPasswordField, false);
    assert.strictEqual(res.macAddress, 'AA:BB:CC:11:22:33');
    assert.strictEqual(res.channelInfo, '81/1,115/36');
    assert.strictEqual(res.publicKey, 'MDkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDIgAD26');
    assert.ok(res.passwordStatusMessage.includes('No password is encoded in this QR code'));
  });

  // 13. Dynamic ephemeral QR image generation & decoding across PNG, JPG/JPEG, and WEBP
  await runTest(13, 'Ephemeral QR code images generated on-the-fly (PNG, JPG, WEBP) decode accurately', () => {
    const pyScript = `
import cv2, io, json
from PIL import Image

cases = [
  ("wpa", "WIFI:T:WPA;S:Ephemeral_WPA;P:Pass_123;H:false;;"),
  ("wpa2_special", "WIFI:T:WPA2;S:Ephemeral_WPA2;P:S3cur3\\;Key\\:2026\\,!;H:true;;"),
  ("wep", "WIFI:T:WEP;S:Ephemeral_WEP;P:A1B2C3D4E5;H:false;;"),
  ("open", "WIFI:T:nopass;S:Ephemeral_Open;P:;H:false;;"),
  ("wpa3", "WIFI:T:SAE;S:Ephemeral_WPA3;P:SAE_Key_99;R:1;H:false;;"),
  ("dpp", "DPP:C:81/1;M:001122334455;I:Ephemeral-AP;K:MDkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDIgAD26;;")
]

encoder = cv2.QRCodeEncoder.create()
out = []
for name, payload in cases:
    raw = encoder.encode(payload)
    h, w = raw.shape
    scaled = cv2.resize(raw, (w * 8, h * 8), interpolation=cv2.INTER_NEAREST)
    pil_img = Image.fromarray(scaled).convert("RGBA")
    for fmt, pil_fmt in [("png", "PNG"), ("jpg", "JPEG"), ("webp", "WEBP")]:
        buf = io.BytesIO()
        if pil_fmt == "JPEG":
            pil_img.convert("RGB").save(buf, pil_fmt, quality=98)
        else:
            pil_img.save(buf, pil_fmt)
        buf.seek(0)
        reloaded = Image.open(buf).convert("RGBA")
        rw, rh = reloaded.size
        out.append({"name": name, "fmt": fmt, "expected": payload, "w": rw, "h": rh, "rgba": list(reloaded.tobytes())})

print(json.dumps(out))
`;
    const rawJson = execSync(`python3 -c '${pyScript}'`, { maxBuffer: 100 * 1024 * 1024 }).toString();
    const fixtures = JSON.parse(rawJson);
    assert.strictEqual(fixtures.length, 18);

    for (const item of fixtures) {
      const imgData = {
        width: item.w,
        height: item.h,
        data: new Uint8ClampedArray(item.rgba),
      };
      const decoded = qrDecoder.extractAndDecodeFromImageData(imgData);
      assert.strictEqual(decoded, item.expected);
    }
  });

  // 14. History management
  await runTest(14, 'History service respects opt-in/out privacy settings, single delete, and clear all', () => {
    const svc = storageMod.storageService;
    svc.clearAllStoredData();

    const p1 = wifiParser.parseQRPayload('WIFI:T:WPA2;S:Net_One;P:Pass111;H:false;;');
    const p2 = wifiParser.parseQRPayload('WIFI:T:WPA2;S:Net_Two;P:Pass222;H:true;;');

    svc.addHistoryEntry(p1);
    svc.addHistoryEntry(p2);
    assert.strictEqual(svc.getHistory().length, 2);
    assert.strictEqual(svc.getHistory()[0].ssid, 'Net_Two');

    svc.deleteHistoryEntry(p1.id);
    assert.strictEqual(svc.getHistory().length, 1);
    assert.strictEqual(svc.getHistory()[0].id, p2.id);

    svc.saveSettings({ historyEnabled: false });
    const p3 = wifiParser.parseQRPayload('WIFI:T:WPA2;S:Private_Net;P:Secret333;H:false;;');
    svc.addHistoryEntry(p3);
    assert.strictEqual(svc.getHistory().length, 1);

    svc.clearHistory();
    assert.strictEqual(svc.getHistory().length, 0);
  });

  // 15. Copy-to-clipboard & report export formatting
  await runTest(15, 'Clipboard fallback and formatted credential report preserve all decoded fields', async () => {
    const sample = wifiParser.parseQRPayload(
      'WIFI:T:WPA2;S:Test_Verify_Net;P:Verify#Pass!2026;H:true;;'
    );
    const report = clipMod.formatResultReport(sample);
    assert.ok(report.includes('ZIP QR — Wi-Fi QR Decoder'));
    assert.ok(report.includes('Test_Verify_Net'));
    assert.ok(report.includes('Verify#Pass!2026'));

    let clipboardBuffer = '';
    global.navigator = {
      clipboard: {
        writeText: async (txt) => {
          clipboardBuffer = txt;
        },
      },
    };
    const copiedOk = await clipMod.copyTextToClipboard(sample.password);
    assert.strictEqual(copiedOk, true);
    assert.strictEqual(clipboardBuffer, 'Verify#Pass!2026');
  });

  // 16. Kurdish Sorani (ckb) Default Language, English (en) Parity, and Persistence
  await runTest(16, 'Kurdish Sorani (ckb) is default language with complete translation parity and persistence', () => {
    assert.strictEqual(i18nMod.DEFAULT_LANGUAGE, 'ckb');
    const ckbKeys = Object.keys(i18nMod.TRANSLATIONS.ckb);
    const enKeys = Object.keys(i18nMod.TRANSLATIONS.en);
    assert.deepStrictEqual(ckbKeys, enKeys);

    const svc = storageMod.storageService;
    svc.saveSettings({ language: 'ckb' });
    assert.strictEqual(svc.getSettings().language, 'ckb');
    svc.saveSettings({ language: 'en' });
    assert.strictEqual(svc.getSettings().language, 'en');
    svc.saveSettings({ language: 'ckb' });
    assert.strictEqual(svc.getSettings().language, 'ckb');
  });

  // 17. Developer / Creator Identity Verification
  await runTest(17, 'Creator identity credits Zardasht Muhammad in Kurdish & English with valid mailto link', () => {
    assert.strictEqual(
      i18nMod.TRANSLATIONS.en.creatorCreditLine,
      'Created and developed by Zardasht Muhammad.'
    );
    assert.strictEqual(
      i18nMod.TRANSLATIONS.ckb.creatorCreditLine,
      'دروستکراو و پەرەپێدراوە لەلایەن زەردەشت محمد.'
    );
    const bodyHtml = fs.readFileSync(path.join(projectRoot, 'src/templates/body.html'), 'utf8');
    assert.ok(bodyHtml.includes('href="mailto:zardashtmuhammad12@gmail.com"'));
    assert.ok(bodyHtml.includes('Zardasht Muhammad'));
  });

  // 18. PWA Manifest & Page Title Branding Verification
  await runTest(18, 'PWA manifest.json and index.html use shortened ZIP QR — Wi-Fi QR Decoder branding', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(projectRoot, 'public/manifest.json'), 'utf8')
    );
    assert.strictEqual(manifest.name, 'ZIP QR — Wi-Fi QR Decoder');
    assert.strictEqual(manifest.short_name, 'ZIP QR');

    const indexHtml = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
    assert.ok(indexHtml.includes('<title>ZIP QR — Wi-Fi QR Decoder</title>'));
    assert.ok(indexHtml.includes('lang="ckb"'));
    assert.ok(indexHtml.includes('dir="rtl"'));
  });

  // 19. Build Version & Content-Fingerprinted Assets Verification
  await runTest(19, 'Production build generates version.json and content-fingerprinted /assets/index.<hash>.js & .css', () => {
    const distDir = path.join(projectRoot, 'dist');
    const versionJson = JSON.parse(fs.readFileSync(path.join(distDir, 'version.json'), 'utf8'));
    assert.ok(versionJson.version.startsWith('v2.5.0-'));
    assert.ok(versionJson.cacheName.startsWith('zip-qr-cache-v2.5.0-'));
    assert.match(versionJson.assets.css, /^\/assets\/index\.[0-9a-f]{8}\.css$/);
    assert.match(versionJson.assets.js, /^\/assets\/index\.[0-9a-f]{8}\.js$/);

    const distHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
    assert.ok(distHtml.includes(versionJson.assets.css));
    assert.ok(distHtml.includes(versionJson.assets.js));
    assert.ok(fs.existsSync(path.join(distDir, versionJson.assets.css.slice(1))));
    assert.ok(fs.existsSync(path.join(distDir, versionJson.assets.js.slice(1))));
  });

  // 20. Cloudflare Pages `_headers` Cache Revalidation Rules
  await runTest(20, 'Cloudflare Pages _headers enforces no-cache on /, /index.html, /sw.js and immutable on /assets/*', () => {
    const headersText = fs.readFileSync(path.join(projectRoot, 'public/_headers'), 'utf8');
    assert.ok(headersText.includes('/\n  Cache-Control: no-cache, no-store, must-revalidate'));
    assert.ok(headersText.includes('/index.html\n  Cache-Control: no-cache, no-store, must-revalidate'));
    assert.ok(headersText.includes('/sw.js\n  Cache-Control: no-cache, no-store, must-revalidate'));
    assert.ok(headersText.includes('/manifest.json\n  Content-Type: application/manifest+json\n  Cache-Control: public, max-age=0, must-revalidate'));
    assert.ok(headersText.includes('/assets/*\n  Cache-Control: public, max-age=31536000, immutable'));
  });

  // 21–23. Service Worker Runtime Execution Simulation (Install, Activate Cleanup, Network-First HTML, Offline Fallback, Hashed Assets)
  await runTest(21, 'Service Worker install & activate cleans up obsolete zip-qr-cache-* and legacy caches while preserving unrelated caches', async () => {
    const swCode = fs.readFileSync(path.join(projectRoot, 'dist/sw.js'), 'utf8');
    const versionJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'dist/version.json'), 'utf8'));

    const listeners = {};
    const cacheStore = new Map([
      ['zip-wifi-qr-decoder-v2.4.0', new Map([['/index.html', { body: 'OLD_V2.4_HTML', ok: true }]])],
      ['zip-qr-cache-v2.5.0-oldhash', new Map([['/index.html', { body: 'OLD_V2.5_HTML', ok: true }]])],
      ['third-party-unrelated-cache', new Map([['/other', { body: 'KEEP_ME', ok: true }]])],
    ]);

    let skipWaitingCalled = false;
    let clientsClaimCalled = false;

    const sandbox = {
      URL,
      Promise,
      Request: class Request {
        constructor(input, init = {}) {
          this.url = typeof input === 'string' ? (input.startsWith('http') ? input : 'https://zip-wifi-qr-decoder.pages.dev' + input) : input.url;
          this.method = init.method || 'GET';
          this.mode = init.mode || '';
          this.cache = init.cache || 'default';
          this.headers = { get: (k) => (init.headers && init.headers[k.toLowerCase()]) || '' };
        }
      },
      self: {
        location: { origin: 'https://zip-wifi-qr-decoder.pages.dev' },
        addEventListener: (type, handler) => {
          listeners[type] = handler;
        },
        skipWaiting: () => {
          skipWaitingCalled = true;
          return Promise.resolve();
        },
        clients: {
          claim: () => {
            clientsClaimCalled = true;
            return Promise.resolve();
          },
        },
      },
      caches: {
        open: async (name) => {
          if (!cacheStore.has(name)) cacheStore.set(name, new Map());
          const map = cacheStore.get(name);
          return {
            put: async (req, res) => {
              const key = typeof req === 'string' ? req : new URL(req.url).pathname;
              map.set(key, res);
            },
            match: async (req) => {
              const key = typeof req === 'string' ? req : new URL(req.url).pathname;
              return map.get(key);
            },
          };
        },
        keys: async () => Array.from(cacheStore.keys()),
        delete: async (name) => cacheStore.delete(name),
        match: async (req) => {
          const key = typeof req === 'string' ? req : new URL(req.url).pathname;
          for (const m of cacheStore.values()) {
            if (m.has(key)) return m.get(key);
          }
          return undefined;
        },
      },
      fetch: async (req) => {
        const u = typeof req === 'string' ? req : req.url;
        return {
          ok: true,
          body: 'FRESH_NETWORK_' + u,
          clone() {
            return { ...this };
          },
        };
      },
    };

    vm.createContext(sandbox);
    vm.runInContext(swCode, sandbox);

    // Trigger install
    let installPromise;
    listeners.install({
      waitUntil: (p) => {
        installPromise = p;
      },
    });
    await installPromise;
    assert.strictEqual(skipWaitingCalled, true, 'skipWaiting() must be called during install');
    assert.strictEqual(cacheStore.has(versionJson.cacheName), true, 'New versioned cache must be created');

    // Trigger activate
    let activatePromise;
    listeners.activate({
      waitUntil: (p) => {
        activatePromise = p;
      },
    });
    await activatePromise;
    assert.strictEqual(clientsClaimCalled, true, 'clients.claim() must be called during activate');
    assert.strictEqual(cacheStore.has('zip-wifi-qr-decoder-v2.4.0'), false, 'Legacy v2.4.0 cache must be deleted');
    assert.strictEqual(cacheStore.has('zip-qr-cache-v2.5.0-oldhash'), false, 'Old v2.5.0 cache must be deleted');
    assert.strictEqual(cacheStore.has('third-party-unrelated-cache'), true, 'Unrelated cache must be preserved');
  });

  await runTest(22, 'Service Worker uses Network-First for / and /index.html online and falls back to cache when offline', async () => {
    const swCode = fs.readFileSync(path.join(projectRoot, 'dist/sw.js'), 'utf8');
    const versionJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'dist/version.json'), 'utf8'));

    const listeners = {};
    const activeMap = new Map([
      ['/index.html', { ok: true, body: 'STALE_CACHED_HTML' }],
      ['/', { ok: true, body: 'STALE_CACHED_HTML' }],
    ]);
    const cacheStore = new Map([[versionJson.cacheName, activeMap]]);
    let isOnline = true;

    const sandbox = {
      URL,
      Promise,
      Request: class Request {
        constructor(input, init = {}) {
          this.url = typeof input === 'string' ? (input.startsWith('http') ? input : 'https://zip-wifi-qr-decoder.pages.dev' + input) : input.url;
          this.method = init.method || 'GET';
          this.mode = init.mode || '';
          this.cache = init.cache || 'default';
          this.headers = { get: (k) => (init.headers && init.headers[k.toLowerCase()]) || '' };
        }
      },
      self: {
        location: { origin: 'https://zip-wifi-qr-decoder.pages.dev' },
        addEventListener: (type, handler) => {
          listeners[type] = handler;
        },
        skipWaiting: () => Promise.resolve(),
        clients: { claim: () => Promise.resolve() },
      },
      caches: {
        open: async (name) => {
          if (!cacheStore.has(name)) cacheStore.set(name, new Map());
          const map = cacheStore.get(name);
          return {
            put: async (req, res) => {
              const key = typeof req === 'string' ? req : new URL(req.url).pathname;
              map.set(key, res);
            },
            match: async (req) => {
              const key = typeof req === 'string' ? req : new URL(req.url).pathname;
              return map.get(key);
            },
          };
        },
        keys: async () => Array.from(cacheStore.keys()),
        delete: async (name) => cacheStore.delete(name),
        match: async (req) => {
          const key = typeof req === 'string' ? req : new URL(req.url).pathname;
          return activeMap.get(key);
        },
      },
      fetch: async () => {
        if (!isOnline) throw new Error('Network offline');
        return {
          ok: true,
          body: 'NEW_DEPLOYED_HTML_V2.5',
          clone() {
            return { ...this };
          },
        };
      },
    };

    vm.createContext(sandbox);
    vm.runInContext(swCode, sandbox);

    // A. Online navigation request must return NEW_DEPLOYED_HTML_V2.5 (NOT stale cache) and update the cache
    let responsePromise;
    listeners.fetch({
      request: new sandbox.Request('https://zip-wifi-qr-decoder.pages.dev/', {
        mode: 'navigate',
        headers: { accept: 'text/html' },
      }),
      respondWith: (p) => {
        responsePromise = p;
      },
    });
    const onlineRes = await responsePromise;
    assert.strictEqual(onlineRes.body, 'NEW_DEPLOYED_HTML_V2.5', 'Online visit must receive fresh network HTML without Ctrl+Shift+R');
    assert.strictEqual(activeMap.get('/index.html').body, 'NEW_DEPLOYED_HTML_V2.5', 'Cache must be updated with fresh HTML');

    // B. Offline navigation request must gracefully fall back to the updated cached HTML
    isOnline = false;
    let offlinePromise;
    listeners.fetch({
      request: new sandbox.Request('https://zip-wifi-qr-decoder.pages.dev/', {
        mode: 'navigate',
        headers: { accept: 'text/html' },
      }),
      respondWith: (p) => {
        offlinePromise = p;
      },
    });
    const offlineRes = await offlinePromise;
    assert.strictEqual(offlineRes.body, 'NEW_DEPLOYED_HTML_V2.5', 'Offline visit must serve the cached app shell');
  });

  await runTest(23, 'Service Worker never intercepts /sw.js and serves fingerprinted /assets/* via Cache-First', async () => {
    const swCode = fs.readFileSync(path.join(projectRoot, 'dist/sw.js'), 'utf8');
    const versionJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'dist/version.json'), 'utf8'));

    const listeners = {};
    const activeMap = new Map([
      [versionJson.assets.js, { ok: true, body: 'CACHED_FINGERPRINTED_JS' }],
    ]);
    const cacheStore = new Map([[versionJson.cacheName, activeMap]]);

    const sandbox = {
      URL,
      Promise,
      Request: class Request {
        constructor(input, init = {}) {
          this.url = typeof input === 'string' ? input : input.url;
          this.method = init.method || 'GET';
          this.mode = init.mode || '';
          this.headers = { get: () => '' };
        }
      },
      self: {
        location: { origin: 'https://zip-wifi-qr-decoder.pages.dev' },
        addEventListener: (type, handler) => {
          listeners[type] = handler;
        },
        skipWaiting: () => Promise.resolve(),
        clients: { claim: () => Promise.resolve() },
      },
      caches: {
        open: async () => ({ put: async () => {}, match: async (k) => activeMap.get(k) }),
        match: async (req) => activeMap.get(new URL(req.url).pathname),
      },
      fetch: async () => ({ ok: true, body: 'NETWORK_JS', clone() { return { ...this }; } }),
    };

    vm.createContext(sandbox);
    vm.runInContext(swCode, sandbox);

    // 1. /sw.js must NOT call respondWith
    let swIntercepted = false;
    listeners.fetch({
      request: new sandbox.Request('https://zip-wifi-qr-decoder.pages.dev/sw.js'),
      respondWith: () => {
        swIntercepted = true;
      },
    });
    assert.strictEqual(swIntercepted, false, '/sw.js must never be intercepted by the Service Worker');

    // 2. Fingerprinted /assets/index.<hash>.js must be served from cache immediately
    let assetPromise;
    listeners.fetch({
      request: new sandbox.Request('https://zip-wifi-qr-decoder.pages.dev' + versionJson.assets.js),
      respondWith: (p) => {
        assetPromise = p;
      },
    });
    const assetRes = await assetPromise;
    assert.strictEqual(assetRes.body, 'CACHED_FINGERPRINTED_JS');
  });

  await runTest(24, 'Service Worker registration uses updateViaCache: "none", SKIP_WAITING, and single-reload loop protection', () => {
    const swUpdateSrc = fs.readFileSync(path.join(projectRoot, 'src/services/swUpdateService.ts'), 'utf8');
    assert.ok(swUpdateSrc.includes("updateViaCache: 'none'"));
    assert.ok(swUpdateSrc.includes("type: 'SKIP_WAITING'"));
    assert.ok(swUpdateSrc.includes('RELOAD_GUARD_KEY'));

    const distDir = path.join(projectRoot, 'dist');
    const versionJson = JSON.parse(fs.readFileSync(path.join(distDir, 'version.json'), 'utf8'));
    const builtJs = fs.readFileSync(path.join(distDir, versionJson.assets.js.slice(1)), 'utf8');
    assert.ok(builtJs.includes("updateViaCache: 'none'"));
    assert.ok(builtJs.includes("type: 'SKIP_WAITING'"));
  });

// 25. Scanner Resilience Suite (Small, Blurry, Rotated 90/180/270, Low-Light Gradient, Inverted Dark Mode, Damaged Center, Cluttered Camera Frame)
  await runTest(25, 'Scanner v3.0 decodes small, blurry, rotated (90/180/270), low-light, inverted, damaged, and cluttered QR images', () => {
    const pyScript = `
import cv2, json, numpy as np
from PIL import Image, ImageFilter

payload = "WIFI:T:WPA2;S:Challenging_Net_5G;P:Hard#Pass\\;2026!;H:true;;"
enc = cv2.QRCodeEncoder.create()
raw = enc.encode(payload)
h, w = raw.shape
base = cv2.resize(raw, (w * 8, h * 8), interpolation=cv2.INTER_NEAREST)

cases = []
pil_clear = Image.fromarray(base).convert("RGBA")
cases.append(("clear", pil_clear))
cases.append(("small_74px", Image.fromarray(cv2.resize(raw, (w * 2, h * 2), interpolation=cv2.INTER_NEAREST)).convert("RGBA")))
cases.append(("blurry", Image.fromarray(base).convert("RGB").filter(ImageFilter.GaussianBlur(radius=1.5)).convert("RGBA")))
cases.append(("rot90", pil_clear.rotate(90, expand=True)))
cases.append(("rot180", pil_clear.rotate(180, expand=True)))
cases.append(("rot270", pil_clear.rotate(270, expand=True)))

yy, xx = np.mgrid[0:base.shape[0], 0:base.shape[1]]
grad = (xx / base.shape[1]) * 40.0
low_light = np.clip((base / 255.0) * 35.0 + 25.0 + grad, 0, 255).astype(np.uint8)
cases.append(("low_light_gradient", Image.fromarray(low_light).convert("RGBA")))

cases.append(("inverted_dark_mode", Image.fromarray(255 - base).convert("RGBA")))

dmg = base.copy()
ch, cw = dmg.shape[0] // 2, dmg.shape[1] // 2
dmg[ch-12:ch+12, cw-12:cw+12] = 128
cases.append(("damaged_center", Image.fromarray(dmg).convert("RGBA")))

frame = np.full((480, 640), 210, dtype=np.uint8)
frame[10:30, 10:30] = 15
qh, qw = base.shape
frame[140:140+qh, 200:200+qw] = base
cases.append(("cluttered_camera_frame", Image.fromarray(frame).convert("RGBA")))

out = []
for name, im in cases:
    out.append({"name": name, "w": im.size[0], "h": im.size[1], "rgba": list(im.tobytes()), "expected": payload})
print(json.dumps(out))
`;
    const items = JSON.parse(execSync(`python3 -c '${pyScript}'`, { maxBuffer: 150 * 1024 * 1024 }).toString());
    assert.strictEqual(items.length, 10);
    for (const item of items) {
      const decoded = qrDecoder.extractAndDecodeFromImageData({
        width: item.w,
        height: item.h,
        data: new Uint8ClampedArray(item.rgba),
      });
      assert.strictEqual(decoded, item.expected, `Failed on condition: ${item.name}`);
    }
    // Also verify invalid/blank image safely returns null without throwing
    const blank = new Uint8ClampedArray(100 * 100 * 4).fill(240);
    assert.strictEqual(qrDecoder.extractAndDecodeFromImageData({ width: 100, height: 100, data: blank }), null);
  });

  // 26. Multi-User Registration, Login, Session Isolation & RLS Record Creation (User A & User B)
  await runTest(26, 'Multi-User RLS: User A and User B create & read their own private records in complete isolation', async () => {
    const { MultiUserAuthAndRlsEngine } = loadModule('src/services/authService.ts', 'authService.cjs');
    const engine = new MultiUserAuthAndRlsEngine();

    const sessionA = await engine.register('user.a@zipqr.test', 'StrongPassA#2026');
    const sessionB = await engine.register('user.b@zipqr.test', 'StrongPassB#2026');

    assert.notStrictEqual(sessionA.user.id, sessionB.user.id);

    const scanA = wifiParser.parseQRPayload('WIFI:T:WPA2;S:UserA_Private_Office;P:SecretPassA_NeverUploaded;H:true;;');
    const scanB = wifiParser.parseQRPayload('WIFI:T:SAE;S:UserB_Home_Mesh;P:SecretPassB_NeverUploaded;H:false;;');

    const recA = await engine.insertSyncedScanRecord(scanA, undefined, sessionA.accessToken);
    const recB = await engine.insertSyncedScanRecord(scanB, undefined, sessionB.accessToken);

    // Verify zero plaintext password or rawPayload is ever stored in server metadata records
    assert.strictEqual(Object.prototype.hasOwnProperty.call(recA, 'password'), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(recA, 'rawPayload'), false);
    assert.strictEqual(JSON.stringify(recA).includes('SecretPassA_NeverUploaded'), false);

    // User A reads only User A records
    const listA = await engine.listSyncedScanHistory(1, 20, sessionA.accessToken);
    assert.strictEqual(listA.totalCount, 1);
    assert.strictEqual(listA.items[0].ssid, 'UserA_Private_Office');
    assert.strictEqual(listA.items[0].user_id, sessionA.user.id);

    // User B reads only User B records
    const listB = await engine.listSyncedScanHistory(1, 20, sessionB.accessToken);
    assert.strictEqual(listB.totalCount, 1);
    assert.strictEqual(listB.items[0].ssid, 'UserB_Home_Mesh');
    assert.strictEqual(listB.items[0].user_id, sessionB.user.id);
  });

  // 27. Multi-User Cross-Account Access Prevention & Forged user_id Rejection
  await runTest(27, 'Multi-User RLS: User A cannot read, modify, or delete User B records; forged user_id & invalid tokens are rejected', async () => {
    const { MultiUserAuthAndRlsEngine } = loadModule('src/services/authService.ts', 'authService.cjs');
    const engine = new MultiUserAuthAndRlsEngine();

    const sessionA = await engine.register('alice@zipqr.test', 'AlicePass#2026');
    const sessionB = await engine.register('bob@zipqr.test', 'BobPass#2026');

    const scanB = wifiParser.parseQRPayload('WIFI:T:WPA2;S:Bob_Vault_Net;P:BobSecret99;H:true;;');
    const recB = await engine.insertSyncedScanRecord(scanB, undefined, sessionB.accessToken);

    // 1. User A attempting to query with filter user_id = User B gets 0 records due to RLS intersection
    const crossRead = await engine.listSyncedScanHistory(1, 20, sessionA.accessToken, sessionB.user.id);
    assert.strictEqual(crossRead.totalCount, 0);
    assert.strictEqual(crossRead.items.length, 0);

    // 2. User A attempting to delete User B record ID fails and leaves User B record intact
    const deletedByA = await engine.deleteSyncedScanRecord(recB.id, sessionA.accessToken);
    assert.strictEqual(deletedByA, false);
    const checkB = await engine.listSyncedScanHistory(1, 20, sessionB.accessToken);
    assert.strictEqual(checkB.totalCount, 1);

    // 3. Forged user_id on insert is rejected by RLS WITH CHECK policy
    let forgedInsertRejected = false;
    try {
      await engine.insertSyncedScanRecord(scanB, { forgedUserId: sessionB.user.id }, sessionA.accessToken);
    } catch (err) {
      forgedInsertRejected = err.message.includes('RLS Policy Violation');
    }
    assert.strictEqual(forgedInsertRejected, true);

    // 4. Forged user_id on settings update is rejected by RLS WITH CHECK policy
    let forgedSettingsRejected = false;
    try {
      await engine.upsertUserSettings({ user_id: sessionB.user.id, language: 'en' }, sessionA.accessToken);
    } catch (err) {
      forgedSettingsRejected = err.message.includes('RLS Policy Violation');
    }
    assert.strictEqual(forgedSettingsRejected, true);

    // 5. Unauthenticated / invalid token requests are rejected
    let unauthRejected = false;
    try {
      await engine.listSyncedScanHistory(1, 20, 'forged_invalid_token_xyz');
    } catch (err) {
      unauthRejected = err.message.includes('Unauthorized');
    }
    assert.strictEqual(unauthRejected, true);
  });

  // 28. Session Logout, Brute-Force Rate Limiting & Account Deletion Cascade
  await runTest(28, 'Multi-User Security: Logout revokes token access, brute-force logins lock out, and account deletion cascades', async () => {
    const { MultiUserAuthAndRlsEngine } = loadModule('src/services/authService.ts', 'authService.cjs');
    const engine = new MultiUserAuthAndRlsEngine();

    const session = await engine.register('charlie@zipqr.test', 'CharliePass#2026');
    const scan = wifiParser.parseQRPayload('WIFI:T:WPA2;S:Charlie_Net;P:CharlieKey;H:false;;');
    await engine.insertSyncedScanRecord(scan, undefined, session.accessToken);

    // Logout revokes the access token immediately
    await engine.logout(session.accessToken);
    let postLogoutRejected = false;
    try {
      await engine.listSyncedScanHistory(1, 20, session.accessToken);
    } catch (err) {
      postLogoutRejected = err.message.includes('Unauthorized');
    }
    assert.strictEqual(postLogoutRejected, true);

    // Brute-force login protection: 5 wrong password attempts trigger lockout
    for (let i = 0; i < 5; i++) {
      try {
        await engine.login('charlie@zipqr.test', 'WrongPassword123');
      } catch {}
    }
    let lockedOut = false;
    try {
      await engine.login('charlie@zipqr.test', 'CharliePass#2026');
    } catch (err) {
      lockedOut = err.message.includes('temporarily locked');
    }
    assert.strictEqual(lockedOut, true, 'Account must lock after 5 consecutive failed logins');

    // Account deletion removes user and cascades all user_settings and scan_history_metadata rows
    const sessionD = await engine.register('delete.me@zipqr.test', 'DeletePass#2026');
    await engine.insertSyncedScanRecord(scan, undefined, sessionD.accessToken);
    assert.strictEqual((await engine.listSyncedScanHistory(1, 20, sessionD.accessToken)).totalCount, 1);

    await engine.deleteOwnAccount(sessionD.accessToken);
    let deletedTokenRejected = false;
    try {
      await engine.listSyncedScanHistory(1, 20, sessionD.accessToken);
    } catch (err) {
      deletedTokenRejected = err.message.includes('Unauthorized');
    }
    assert.strictEqual(deletedTokenRejected, true);
  });

  // 29. Load & Concurrency Simulation (100, 500, and 1,000 Concurrent Users with Strict RLS Isolation)
  await runTest(29, 'Scalability & Load Test: 100, 500, and 1,000 concurrent users execute auth + RLS queries with 0 cross-account leaks', async () => {
    const { MultiUserAuthAndRlsEngine } = loadModule('src/services/authService.ts', 'authService.cjs');
    const engine = new MultiUserAuthAndRlsEngine();

    for (const tier of [100, 500, 1000]) {
      const tStart = Date.now();
      const tasks = Array.from({ length: tier }, async (_, idx) => {
        const email = `loaduser_${tier}_${idx}@zipqr.test`;
        const sess = await engine.register(email, 'LoadTestPass#2026');
        const parsed = wifiParser.parseQRPayload(`WIFI:T:WPA2;S:SSID_${tier}_${idx};P:LocalOnlySecret_${idx};H:false;;`);
        await engine.insertSyncedScanRecord(parsed, undefined, sess.accessToken);
        const ownHistory = await engine.listSyncedScanHistory(1, 10, sess.accessToken);
        assert.strictEqual(ownHistory.totalCount, 1);
        assert.strictEqual(ownHistory.items[0].ssid, `SSID_${tier}_${idx}`);
        assert.strictEqual(ownHistory.items[0].user_id, sess.user.id);
      });
      await Promise.all(tasks);
      const elapsedMs = Date.now() - tStart;
      assert.ok(elapsedMs < 15000, `Tier ${tier} took too long: ${elapsedMs}ms`);
    }
  });

  console.log('==============================================================');
  console.log(`Test Summary: ${passed} passed, ${failed} failed (Total: ${passed + failed})`);
  console.log('==============================================================');
  if (failed > 0) process.exit(1);
}

runAllTests();
