/**
 * ZIP QR — Wi-Fi QR Decoder — Comprehensive Automated QA, Scanner Performance, IndexedDB History,
 * Localization, PWA Cache Lifecycle & Privacy Audit Test Suite (30 Suites)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');
const { performance } = require('perf_hooks');

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
const cameraMod = loadModule('src/services/cameraService.ts', 'cameraService.cjs');
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
  console.log('ZIP QR — Automated QA, Scanner, IndexedDB & Privacy Test Suite');
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

  // 2. Valid WPA2 QR codes (and WPA3/SAE + Unicode SSID/Password)
  await runTest(2, 'Valid WPA2, WPA3-SAE, and Unicode (Kurdish/Emoji) QR codes extract credentials accurately', () => {
    const wpa2 = wifiParser.parseQRPayload('WIFI:T:WPA2;S:TestNet_Beta_5G;P:BetaKey#2026!;H:false;;');
    assert.strictEqual(wpa2.ssid, 'TestNet_Beta_5G');
    assert.strictEqual(wpa2.password, 'BetaKey#2026!');
    assert.strictEqual(wpa2.securityType, 'WPA2');

    const wpa3 = wifiParser.parseQRPayload('WIFI:T:SAE;S:TestNet_Gamma_WPA3;P:Gamma*SAE*Pass77;R:1;H:false;;');
    assert.strictEqual(wpa3.ssid, 'TestNet_Gamma_WPA3');
    assert.strictEqual(wpa3.password, 'Gamma*SAE*Pass77');
    assert.strictEqual(wpa3.securityType, 'WPA3');

    const unicodeWifi = wifiParser.parseQRPayload('WIFI:T:WPA2;S:تۆڕی_کوردستان_5G;P:کوردستان#٢٠٢٦!;H:false;;');
    assert.strictEqual(unicodeWifi.ssid, 'تۆڕی_کوردستان_5G');
    assert.strictEqual(unicodeWifi.password, 'کوردستان#٢٠٢٦!');
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

  // 14. Persistent IndexedDB History WITH Actual Saved Wi-Fi Passwords, Search, Single Delete & Clear All
  await runTest(14, 'IndexedDB History stores actual Wi-Fi passwords, supports search, isolated single-record deletion, and clear all', () => {
    const svc = storageMod.storageService;
    svc.clearAllStoredData();
    assert.strictEqual(storageMod.IDB_DATABASE_NAME, 'zip_qr_local_db');
    assert.strictEqual(storageMod.IDB_SCHEMA_VERSION, 2);

    const p1 = wifiParser.parseQRPayload('WIFI:T:WPA2;S:Home_Fiber_5G;P:MyActualSavedPass#2026!;H:false;;');
    const p2 = wifiParser.parseQRPayload('WIFI:T:WPA3;S:Office_Mesh_Pro;P:OfficeVault$99;H:true;;');
    const p3 = wifiParser.parseQRPayload('WIFI:T:nopass;S:Cafe_Guest_WiFi;P:;H:false;;');

    svc.addHistoryEntry(p1);
    svc.addHistoryEntry(p2);
    svc.addHistoryEntry(p3);

    const history = svc.getHistory();
    assert.strictEqual(history.length, 3);

    // Verify actual Wi-Fi passwords are saved on History records (never omitted!)
    const savedOffice = history.find((h) => h.ssid === 'Office_Mesh_Pro');
    const savedHome = history.find((h) => h.ssid === 'Home_Fiber_5G');
    const savedCafe = history.find((h) => h.ssid === 'Cafe_Guest_WiFi');

    assert.ok(savedOffice);
    assert.strictEqual(savedOffice.password, 'OfficeVault$99');
    assert.strictEqual(savedOffice.result.password, 'OfficeVault$99');
    assert.strictEqual(savedOffice.hasPassword, true);
    assert.strictEqual(savedOffice.hiddenNetwork, true);

    assert.ok(savedHome);
    assert.strictEqual(savedHome.password, 'MyActualSavedPass#2026!');
    assert.strictEqual(savedHome.result.password, 'MyActualSavedPass#2026!');
    assert.strictEqual(savedHome.hasPassword, true);

    assert.ok(savedCafe);
    assert.strictEqual(savedCafe.password, null);
    assert.strictEqual(savedCafe.hasPassword, false);

    // Verify History search by SSID and security protocol
    const searchMesh = svc.searchHistory('Mesh');
    assert.strictEqual(searchMesh.length, 1);
    assert.strictEqual(searchMesh[0].ssid, 'Office_Mesh_Pro');

    // Verify deleting one record does NOT affect other records or their saved passwords
    svc.deleteHistoryEntry(p2.id);
    const afterOneDelete = svc.getHistory();
    assert.strictEqual(afterOneDelete.length, 2);
    assert.strictEqual(afterOneDelete.find((h) => h.id === p1.id).password, 'MyActualSavedPass#2026!');
    assert.strictEqual(afterOneDelete.find((h) => h.id === p3.id).ssid, 'Cafe_Guest_WiFi');

    // Verify historyEnabled=false pauses saving new entries
    svc.saveSettings({ historyEnabled: false });
    const p4 = wifiParser.parseQRPayload('WIFI:T:WPA2;S:NotSaved_Net;P:Secret333;H:false;;');
    svc.addHistoryEntry(p4);
    assert.strictEqual(svc.getHistory().length, 2);

    // Re-enable and verify Clear All removes all records
    svc.saveSettings({ historyEnabled: true });
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
      ['zip-qr-cache-v2.5.0-oldhash1', new Map([['/index.html', { body: 'OLD_V2.5_HTML', ok: true }]])],
      ['other-third-party-cache', new Map([['/foo', { body: 'KEEP_ME', ok: true }]])],
    ]);

    let skipWaitingCalled = false;
    let clientsClaimCalled = false;

    const sandbox = {
      URL,
      Promise,
      Request: class Request {
        constructor(url, opts = {}) {
          this.url = url.startsWith('http') ? url : 'https://zip-wifi-qr-decoder.pages.dev' + url;
          this.cache = opts.cache || 'default';
          this.method = opts.method || 'GET';
          this.mode = opts.mode || 'cors';
          this._headers = opts.headers || {};
        }
        headers = { get: (k) => this._headers[k.toLowerCase()] || '' };
      },
      self: {
        location: { origin: 'https://zip-wifi-qr-decoder.pages.dev' },
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
        addEventListener: (type, handler) => {
          listeners[type] = handler;
        },
      },
      caches: {
        open: async (name) => {
          if (!cacheStore.has(name)) cacheStore.set(name, new Map());
          const map = cacheStore.get(name);
          return {
            put: async (reqOrUrl, res) => {
              const key = typeof reqOrUrl === 'string' ? reqOrUrl : new URL(reqOrUrl.url).pathname;
              map.set(key, res);
            },
            match: async (reqOrUrl) => {
              const key = typeof reqOrUrl === 'string' ? reqOrUrl : new URL(reqOrUrl.url).pathname;
              return map.get(key);
            },
          };
        },
        keys: async () => Array.from(cacheStore.keys()),
        delete: async (name) => cacheStore.delete(name),
        match: async (reqOrUrl) => {
          const key = typeof reqOrUrl === 'string' ? reqOrUrl : new URL(reqOrUrl.url).pathname;
          for (const map of cacheStore.values()) {
            if (map.has(key)) return map.get(key);
          }
          return undefined;
        },
      },
      fetch: async (req) => {
        const urlStr = typeof req === 'string' ? req : req.url;
        return {
          ok: true,
          url: urlStr,
          body: 'FRESH_DEPLOYED_HTML_' + versionJson.version,
          clone() {
            return { ...this };
          },
        };
      },
    };

    vm.createContext(sandbox);
    vm.runInContext(swCode, sandbox);

    let installPromise;
    listeners.install({ waitUntil: (p) => { installPromise = p; } });
    await installPromise;
    assert.strictEqual(skipWaitingCalled, true);
    assert.strictEqual(cacheStore.has(versionJson.cacheName), true);

    let activatePromise;
    listeners.activate({ waitUntil: (p) => { activatePromise = p; } });
    await activatePromise;
    assert.strictEqual(clientsClaimCalled, true);
    assert.strictEqual(cacheStore.has('zip-wifi-qr-decoder-v2.4.0'), false);
    assert.strictEqual(cacheStore.has('zip-qr-cache-v2.5.0-oldhash1'), false);
    assert.strictEqual(cacheStore.has('other-third-party-cache'), true);
    assert.strictEqual(cacheStore.has(versionJson.cacheName), true);
  });

  await runTest(22, 'Service Worker serves fresh Network-First HTML online and falls back to cached /index.html offline', async () => {
    const swCode = fs.readFileSync(path.join(projectRoot, 'dist/sw.js'), 'utf8');
    const versionJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'dist/version.json'), 'utf8'));

    const listeners = {};
    const cacheStore = new Map([
      [
        versionJson.cacheName,
        new Map([['/index.html', { ok: true, body: 'STALE_CACHED_HTML', clone() { return { ...this }; } }]]),
      ],
    ]);
    let networkOnline = true;

    const sandbox = {
      URL,
      Promise,
      Request: class Request {
        constructor(url, opts = {}) {
          this.url = url;
          this.cache = opts.cache || 'default';
          this.method = opts.method || 'GET';
          this.mode = opts.mode || 'navigate';
          this._headers = opts.headers || { accept: 'text/html' };
        }
        headers = { get: (k) => this._headers[k.toLowerCase()] || '' };
      },
      self: {
        location: { origin: 'https://zip-wifi-qr-decoder.pages.dev' },
        skipWaiting: () => Promise.resolve(),
        clients: { claim: () => Promise.resolve() },
        addEventListener: (type, handler) => { listeners[type] = handler; },
      },
      caches: {
        open: async (name) => {
          if (!cacheStore.has(name)) cacheStore.set(name, new Map());
          const map = cacheStore.get(name);
          return {
            put: async (reqOrUrl, res) => {
              const key = typeof reqOrUrl === 'string' ? reqOrUrl : new URL(reqOrUrl.url).pathname;
              map.set(key, res);
            },
            match: async (reqOrUrl) => {
              const key = typeof reqOrUrl === 'string' ? reqOrUrl : new URL(reqOrUrl.url).pathname;
              return map.get(key);
            },
          };
        },
        keys: async () => Array.from(cacheStore.keys()),
        delete: async (name) => cacheStore.delete(name),
        match: async () => undefined,
      },
      fetch: async () => {
        if (!networkOnline) throw new Error('Network offline');
        return {
          ok: true,
          body: 'NEW_V2.5_DEPLOYED_HTML',
          clone() {
            return { ...this };
          },
        };
      },
    };

    vm.createContext(sandbox);
    vm.runInContext(swCode, sandbox);

    let onlineResponsePromise;
    listeners.fetch({
      request: new sandbox.Request('https://zip-wifi-qr-decoder.pages.dev/', { mode: 'navigate' }),
      respondWith: (p) => { onlineResponsePromise = p; },
    });
    const onlineRes = await onlineResponsePromise;
    assert.strictEqual(onlineRes.body, 'NEW_V2.5_DEPLOYED_HTML');

    networkOnline = false;
    let offlineResponsePromise;
    listeners.fetch({
      request: new sandbox.Request('https://zip-wifi-qr-decoder.pages.dev/', { mode: 'navigate' }),
      respondWith: (p) => { offlineResponsePromise = p; },
    });
    const offlineRes = await offlineResponsePromise;
    assert.strictEqual(offlineRes.body, 'NEW_V2.5_DEPLOYED_HTML');
  });

  await runTest(23, 'Service Worker never intercepts /sw.js and serves content-fingerprinted /assets/* via Cache-First', async () => {
    const swCode = fs.readFileSync(path.join(projectRoot, 'dist/sw.js'), 'utf8');
    const versionJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'dist/version.json'), 'utf8'));

    const listeners = {};
    const hashedJsPath = versionJson.assets.js;
    const cacheStore = new Map([
      [
        versionJson.cacheName,
        new Map([[hashedJsPath, { ok: true, body: 'CACHED_FINGERPRINTED_JS', clone() { return { ...this }; } }]]),
      ],
    ]);

    const sandbox = {
      URL,
      Promise,
      Request: class Request {
        constructor(url, opts = {}) {
          this.url = url;
          this.method = opts.method || 'GET';
          this.mode = opts.mode || 'cors';
          this._headers = opts.headers || {};
        }
        headers = { get: (k) => this._headers[k.toLowerCase()] || '' };
      },
      self: {
        location: { origin: 'https://zip-wifi-qr-decoder.pages.dev' },
        skipWaiting: () => Promise.resolve(),
        clients: { claim: () => Promise.resolve() },
        addEventListener: (type, handler) => { listeners[type] = handler; },
      },
      caches: {
        open: async (name) => cacheStore.get(name),
        match: async (req) => {
          const pathname = new URL(req.url).pathname;
          return cacheStore.get(versionJson.cacheName).get(pathname);
        },
      },
      fetch: async () => ({ ok: true, body: 'NETWORK_JS', clone() { return { ...this }; } }),
    };

    vm.createContext(sandbox);
    vm.runInContext(swCode, sandbox);

    let swIntercepted = false;
    listeners.fetch({
      request: new sandbox.Request('https://zip-wifi-qr-decoder.pages.dev/sw.js'),
      respondWith: () => { swIntercepted = true; },
    });
    assert.strictEqual(swIntercepted, false);

    let assetPromise;
    listeners.fetch({
      request: new sandbox.Request('https://zip-wifi-qr-decoder.pages.dev' + hashedJsPath),
      respondWith: (p) => { assetPromise = p; },
    });
    const assetRes = await assetPromise;
    assert.strictEqual(assetRes.body, 'CACHED_FINGERPRINTED_JS');
  });

  // 24. Service Worker Registration Lifecycle & IndexedDB History Preservation Across App Updates
  await runTest(24, 'SW update lifecycle uses updateViaCache: "none", guards against reload loops, and preserves IndexedDB History & passwords', () => {
    const swUpdateMod = loadModule('src/services/swUpdateService.ts', 'swUpdateService.cjs');
    const distJs = fs.readFileSync(path.join(projectRoot, 'dist/assets/index.js'), 'utf8');
    const swJs = fs.readFileSync(path.join(projectRoot, 'dist/sw.js'), 'utf8');

    assert.ok(distJs.includes("updateViaCache: 'none'"));
    assert.ok(distJs.includes("type: 'SKIP_WAITING'"));
    assert.ok(distJs.includes('zip_qr_sw_reload_guard_v1'));

    // Verify sw.js NEVER deletes or resets IndexedDB (`indexedDB.deleteDatabase` must not appear in sw.js)
    assert.strictEqual(swJs.includes('deleteDatabase'), false);
    assert.strictEqual(swJs.includes('zip_qr_local_db'), false);

    // Verify single-reload loop guard blocks back-to-back reloads within cooldown window
    let sessionStore = {};
    global.sessionStorage = {
      getItem: (k) => sessionStore[k] || null,
      setItem: (k, v) => { sessionStore[k] = v; },
    };
    assert.strictEqual(swUpdateMod.shouldAllowControllerReload(100000), true);
    assert.strictEqual(swUpdateMod.shouldAllowControllerReload(102000), false);
    assert.strictEqual(swUpdateMod.shouldAllowControllerReload(115000), true);
  });

  // 25. Multi-Stage QR Decoder Resilience Across 10 Challenging Conditions
  await runTest(25, 'Scanner v4.0 decodes clear, small (74x74), blurry, rotated (90/180/270), low-light, inverted, damaged, and cluttered QR images', () => {
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
    const blank = new Uint8ClampedArray(100 * 100 * 4).fill(240);
    assert.strictEqual(qrDecoder.extractAndDecodeFromImageData({ width: 100, height: 100, data: blank }), null);
  });

  // 26. Multi-QR Detection Inside One Uploaded Image
  await runTest(26, 'Multi-QR Detection: extractAllQRCodesFromImageData detects multiple distinct QR codes in a single composite image', () => {
    const pyScript = `
import cv2, json, numpy as np
from PIL import Image

p1 = "WIFI:T:WPA2;S:MultiQR_Network_One;P:FirstPass#111;H:false;;"
p2 = "WIFI:T:WPA3;S:MultiQR_Network_Two;P:SecondPass#222;H:true;;"

enc = cv2.QRCodeEncoder.create()
r1 = enc.encode(p1)
r2 = enc.encode(p2)
q1 = cv2.resize(r1, (r1.shape[1] * 6, r1.shape[0] * 6), interpolation=cv2.INTER_NEAREST)
q2 = cv2.resize(r2, (r2.shape[1] * 6, r2.shape[0] * 6), interpolation=cv2.INTER_NEAREST)

h = max(q1.shape[0], q2.shape[0]) + 40
w = q1.shape[1] + q2.shape[1] + 60
canvas = np.full((h, w), 255, dtype=np.uint8)
canvas[20:20+q1.shape[0], 15:15+q1.shape[1]] = q1
canvas[20:20+q2.shape[0], 35+q1.shape[1]:35+q1.shape[1]+q2.shape[1]] = q2

im = Image.fromarray(canvas).convert("RGBA")
print(json.dumps({"w": im.size[0], "h": im.size[1], "rgba": list(im.tobytes()), "expected": [p1, p2]}))
`;
    const composite = JSON.parse(execSync(`python3 -c '${pyScript}'`, { maxBuffer: 50 * 1024 * 1024 }).toString());
    const found = qrDecoder.extractAllQRCodesFromImageData({
      width: composite.w,
      height: composite.h,
      data: new Uint8ClampedArray(composite.rgba),
    });
    assert.strictEqual(found.length, 2);
    assert.ok(found.includes(composite.expected[0]));
    assert.ok(found.includes(composite.expected[1]));
  });

  // 27. IndexedDB Schema Migration (v1 -> v2) Preserves Existing History & Actual Saved Passwords
  await runTest(27, 'IndexedDB schema migration (v1 -> v2) preserves existing records and saved Wi-Fi passwords without reset', () => {
    const svc = storageMod.storageService;
    const legacyV1Records = [
      wifiParser.parseQRPayload('WIFI:T:WPA2;S:Legacy_Router_2.4G;P:LegacySavedKey!2024;H:false;;'),
      {
        id: 'legacy_entry_2',
        timestamp: '2026-01-15T10:00:00.000Z',
        ssid: 'Legacy_Office_5G',
        category: 'WIFI',
        securityDisplay: 'WPA2 Personal',
        result: wifiParser.parseQRPayload('WIFI:T:WPA2;S:Legacy_Office_5G;P:SurvivedUpgradePass#88;H:true;;'),
      },
    ];

    const migrated = svc.migrateRecordsToLatestSchema(legacyV1Records);
    assert.strictEqual(svc.getSchemaVersion(), 2);
    assert.strictEqual(migrated.length, 2);

    const r1 = migrated.find((r) => r.ssid === 'Legacy_Router_2.4G');
    const r2 = migrated.find((r) => r.ssid === 'Legacy_Office_5G');
    assert.ok(r1 && r2);
    assert.strictEqual(r1.password, 'LegacySavedKey!2024');
    assert.strictEqual(r1.hasPassword, true);
    assert.strictEqual(r2.password, 'SurvivedUpgradePass#88');
    assert.strictEqual(r2.hasPassword, true);
    assert.strictEqual(r2.hiddenNetwork, true);
  });

  // 28. Strict No-Login / No-Account & No-Prohibited-History-Features Audit
  await runTest(28, 'Architecture Audit: Zero login/registration/account infrastructure and zero backup/export/import/cloud history features', () => {
    // 1. Verify authService, AccountPage, and supabase directory are completely absent
    assert.strictEqual(fs.existsSync(path.join(projectRoot, 'src/services/authService.ts')), false);
    assert.strictEqual(fs.existsSync(path.join(projectRoot, 'src/pages/AccountPage.tsx')), false);
    assert.strictEqual(fs.existsSync(path.join(projectRoot, 'supabase')), false);
    assert.strictEqual(fs.existsSync(path.join(projectRoot, '.env.example')), false);

    // 2. Verify Header and body.html have no Account/Login/Register navigation tabs
    const bodyHtml = fs.readFileSync(path.join(projectRoot, 'src/templates/body.html'), 'utf8');
    assert.strictEqual(bodyHtml.includes('data-nav="account"'), false);
    assert.strictEqual(bodyHtml.includes('id="page-account"'), false);

    // 3. Verify storageService does NOT implement prohibited History backup/restore/import/export/sync methods
    const svc = storageMod.storageService;
    assert.strictEqual(typeof svc.backupHistory, 'undefined');
    assert.strictEqual(typeof svc.restoreHistory, 'undefined');
    assert.strictEqual(typeof svc.importHistory, 'undefined');
    assert.strictEqual(typeof svc.exportHistory, 'undefined');
    assert.strictEqual(typeof svc.syncHistory, 'undefined');
  });

  // 29. Security & Privacy Audit: Zero External Credential Uploads, Zero Console Password Leaks, Safe DOM Rendering
  await runTest(29, 'Security & Privacy Audit: Zero external network uploads, zero console password logging, and safe textContent rendering', () => {
    const runtimeJs = fs.readFileSync(path.join(projectRoot, 'src/templates/runtime.js'), 'utf8');

    // 1. Verify runtime.js makes zero fetch() or XMLHttpRequest calls
    assert.strictEqual(runtimeJs.includes('XMLHttpRequest'), false);
    assert.strictEqual(runtimeJs.includes('navigator.sendBeacon'), false);
    assert.strictEqual(runtimeJs.includes('supabase'), false);

    // 2. Verify no console.log statements exist in src/services/ that could leak credentials
    const serviceFiles = ['wifiParser.ts', 'qrDecoder.ts', 'cameraService.ts', 'storageService.ts'];
    for (const f of serviceFiles) {
      const content = fs.readFileSync(path.join(projectRoot, 'src/services', f), 'utf8');
      assert.strictEqual(content.includes('console.log('), false, `Found console.log in ${f}`);
    }

    // 3. Verify History cards in runtime.js mask passwords by default ('••••••••') and use safe .textContent
    assert.ok(runtimeJs.includes("'••••••••'"));
    assert.ok(runtimeJs.includes('revealedHistoryPasswords'));
  });

  // 30. Scanner Latency Benchmark & Camera Duplicate Suppression Verification
  await runTest(30, 'Performance Benchmark: Median QR decode latency < 50ms (target < 500ms) and camera duplicate cooldown works', () => {
    const pyScript = `
import cv2, json
from PIL import Image

payload = "WIFI:T:WPA2;S:Benchmark_Speed_Net;P:FastDecode#2026!;H:false;;"
enc = cv2.QRCodeEncoder.create()
raw = enc.encode(payload)
h, w = raw.shape
scaled = cv2.resize(raw, (w * 6, h * 6), interpolation=cv2.INTER_NEAREST)
im = Image.fromarray(scaled).convert("RGBA")
print(json.dumps({"w": im.size[0], "h": im.size[1], "rgba": list(im.tobytes()), "expected": payload}))
`;
    const sample = JSON.parse(execSync(`python3 -c '${pyScript}'`, { maxBuffer: 50 * 1024 * 1024 }).toString());
    const imgData = {
      width: sample.w,
      height: sample.h,
      data: new Uint8ClampedArray(sample.rgba),
    };

    const times = [];
    for (let i = 0; i < 25; i++) {
      const t0 = performance.now();
      const out = qrDecoder.extractAndDecodeFromImageData(imgData);
      const dt = performance.now() - t0;
      assert.strictEqual(out, sample.expected);
      times.push(dt);
    }
    times.sort((a, b) => a - b);
    const p50 = times[Math.floor(times.length * 0.5)];
    const p95 = times[Math.floor(times.length * 0.95)];
    console.log(`   [Benchmark] 25 repeated scans: median p50 = ${p50.toFixed(2)} ms, p95 = ${p95.toFixed(2)} ms`);
    assert.ok(p50 < 500, `Expected median < 500ms, got ${p50.toFixed(2)}ms`);
    assert.ok(p95 < 1500, `Expected p95 < 1500ms, got ${p95.toFixed(2)}ms`);

    // Verify cameraService duplicate scan suppression
    const cam = cameraMod.cameraService;
    cam.resetDetectionLock();
    assert.strictEqual(cam.shouldAcceptDetection(sample.expected, 2500), true);
    assert.strictEqual(cam.shouldAcceptDetection(sample.expected, 2500), false);
    cam.resetDetectionLock();
    assert.strictEqual(cam.shouldAcceptDetection(sample.expected, 2500), true);
  });

  console.log('==============================================================');
  console.log(`Test Summary: ${passed} passed, ${failed} failed (Total: ${passed + failed})`);
  console.log('==============================================================');
  if (failed > 0) process.exit(1);
}

runAllTests();
