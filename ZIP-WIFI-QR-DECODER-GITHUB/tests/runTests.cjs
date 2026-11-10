/**
 * ZIP QR — Wi-Fi QR Decoder — Independent Automated QA Test Suite
 *
 * Verifies:
 * 1. Valid WPA QR codes
 * 2. Valid WPA2 & WPA3-SAE QR codes
 * 3. WEP QR codes
 * 4. Open network QR codes (nopass)
 * 5. Hidden networks
 * 6. Passwords containing special characters (\; \, \: \\ \")
 * 7. SSIDs containing special characters
 * 8. Missing passwords ("No password is encoded in this QR code.")
 * 9. Invalid / plain text QR payloads
 * 10. Ordinary website URL QR codes
 * 11. Empty QR payloads
 * 12. DPP QR recognition (Wi-Fi Easy Connect without fake plaintext password)
 * 13. Ephemeral image upload decoding (on-the-fly generated PNG, JPG, and WEBP QR images)
 * 14. History management (opt-in/out, add, delete single, clear all)
 * 15. Copy-to-clipboard & safe export report formatting (ZIP QR — Wi-Fi QR Decoder)
 * 16. Kurdish Sorani (ckb) default language, English (en) parity, and language persistence
 * 17. Developer/Creator identity (Zardasht Muhammad, mailto:zardashtmuhammad12@gmail.com)
 * 18. PWA manifest & index.html branding (ZIP QR — Wi-Fi QR Decoder, short_name: ZIP QR)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
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

const wifiParser = loadModule('src/services/wifiParser.ts', 'wifiParser.cjs');
const qrDecoder = loadModule('src/services/qrDecoder.ts', 'qrDecoder.cjs');
const storageMod = loadModule('src/services/storageService.ts', 'storageService.cjs');
const clipMod = loadModule('src/utils/clipboardAndExport.ts', 'clipboardAndExport.cjs');
const i18nMod = loadModule('src/i18n/translations.ts', 'translations.cjs');

let passed = 0;
let failed = 0;

function runTest(id, title, fn) {
  try {
    fn();
    console.log(`✅ [TEST ${String(id).padStart(2, '0')}] PASS: ${title}`);
    passed++;
  } catch (err) {
    console.error(`❌ [TEST ${String(id).padStart(2, '0')}] FAIL: ${title}`);
    console.error('   Reason:', err && err.message ? err.message : err);
    failed++;
  }
}

console.log('==============================================================');
console.log('ZIP QR — Wi-Fi QR Decoder — Automated QA & Localization Runner');
console.log('==============================================================');

// 1. Valid WPA QR codes
runTest(1, 'Valid WPA QR codes extract SSID, password, WPA security, and hidden status', () => {
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
runTest(2, 'Valid WPA2 & WPA3-SAE QR codes extract credentials and encryption accurately', () => {
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
runTest(3, 'WEP QR codes identify WEP protocol and extract hexadecimal/ASCII key', () => {
  const res = wifiParser.parseQRPayload('WIFI:T:WEP;S:TestNet_WEP;P:A1B2C3D4E5;H:false;;');
  assert.strictEqual(res.ssid, 'TestNet_WEP');
  assert.strictEqual(res.password, 'A1B2C3D4E5');
  assert.strictEqual(res.securityType, 'WEP');
  assert.strictEqual(res.hasPasswordField, true);
});

// 4. Open network QR codes
runTest(4, 'Open network QR codes (nopass) display "Open network — no password required."', () => {
  const res = wifiParser.parseQRPayload('WIFI:T:nopass;S:TestNet_Open;P:;H:false;;');
  assert.strictEqual(res.ssid, 'TestNet_Open');
  assert.strictEqual(res.password, null);
  assert.strictEqual(res.hasPasswordField, false);
  assert.strictEqual(res.securityType, 'nopass');
  assert.strictEqual(res.passwordStatusMessage, 'Open network — no password required.');
});

// 5. Hidden networks
runTest(5, 'Hidden networks (H:true) report hiddenNetwork=true and hiddenDisplay="Yes"', () => {
  const res = wifiParser.parseQRPayload('WIFI:T:WPA2;S:TestNet_Hidden;P:HiddenKey99!;H:true;;');
  assert.strictEqual(res.ssid, 'TestNet_Hidden');
  assert.strictEqual(res.password, 'HiddenKey99!');
  assert.strictEqual(res.hiddenNetwork, true);
  assert.strictEqual(res.hiddenDisplay, 'Yes');
});

// 6. Passwords containing special characters
runTest(6, 'Passwords containing escaped special characters (\\; \\, \\: \\\\ \\") unescape cleanly', () => {
  const raw = 'WIFI:T:WPA2;S:TestNet_EscapedPass;P:K3y\\;With\\:Special\\,Chars\\"\\\\!;H:false;;';
  const res = wifiParser.parseQRPayload(raw);
  assert.strictEqual(res.ssid, 'TestNet_EscapedPass');
  assert.strictEqual(res.password, 'K3y;With:Special,Chars"\\!');
  assert.strictEqual(res.hasPasswordField, true);
});

// 7. SSIDs containing special characters
runTest(7, 'SSIDs containing escaped special characters (\\; \\: \\,) unescape without splitting', () => {
  const raw = 'WIFI:T:WPA;S:Net\\;Name\\:With\\,Punctuation;P:StandardPass2026;H:false;;';
  const res = wifiParser.parseQRPayload(raw);
  assert.strictEqual(res.ssid, 'Net;Name:With,Punctuation');
  assert.strictEqual(res.password, 'StandardPass2026');
});

// 8. Missing passwords
runTest(8, 'Encrypted Wi-Fi QR codes missing a password display "No password is encoded in this QR code."', () => {
  const raw = 'WIFI:T:WPA2;S:TestNet_NoPassword;H:false;;';
  const res = wifiParser.parseQRPayload(raw);
  assert.strictEqual(res.ssid, 'TestNet_NoPassword');
  assert.strictEqual(res.password, null);
  assert.strictEqual(res.hasPasswordField, false);
  assert.strictEqual(res.passwordStatusMessage, 'No password is encoded in this QR code.');
  assert.ok(res.warnings.length > 0);
});

// 9. Invalid / non-Wi-Fi text QR payloads
runTest(9, 'Invalid or plain text QR payloads are not misinterpreted as Wi-Fi credentials', () => {
  const raw = 'Plain text QR note without any Wi-Fi parameters.';
  const res = wifiParser.parseQRPayload(raw);
  assert.strictEqual(res.isWifi, false);
  assert.strictEqual(res.category, 'TEXT');
  assert.strictEqual(res.password, null);
  assert.strictEqual(res.hasPasswordField, false);
  assert.strictEqual(res.passwordStatusMessage, 'No password is encoded in this QR code.');
});

// 10. Ordinary website QR codes
runTest(10, 'Website URL QR codes are identified as URL and never mistaken for Wi-Fi passwords', () => {
  const raw = 'https://www.wi-fi.org/discover-wi-fi/security';
  const res = wifiParser.parseQRPayload(raw);
  assert.strictEqual(res.isWifi, false);
  assert.strictEqual(res.category, 'URL');
  assert.strictEqual(res.ssid, 'www.wi-fi.org');
  assert.strictEqual(res.password, null);
  assert.ok(res.warnings[0].includes('never opened automatically'));
});

// 11. Empty QR payloads
runTest(11, 'Empty or whitespace-only QR payloads return EMPTY category safely', () => {
  const res = wifiParser.parseQRPayload('   ');
  assert.strictEqual(res.category, 'EMPTY');
  assert.strictEqual(res.isWifi, false);
  assert.strictEqual(res.password, null);
  assert.strictEqual(res.passwordStatusMessage, 'No password is encoded in this QR code.');
});

// 12. DPP QR recognition
runTest(12, 'DPP (Wi-Fi Easy Connect) QR codes extract public key & MAC and never fake a password', () => {
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
runTest(13, 'Ephemeral QR code images generated on-the-fly (PNG, JPG, WEBP) decode accurately', () => {
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
    assert.strictEqual(
      decoded,
      item.expected,
      `Mismatch on ${item.name}.${item.fmt}: got ${decoded}`
    );
  }
});

// 14. History management (opt-in/out, add, delete single, clear all)
runTest(14, 'History service respects opt-in/out privacy settings, single delete, and clear all', () => {
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
runTest(15, 'Clipboard fallback and formatted credential report preserve all decoded fields', async () => {
  const sample = wifiParser.parseQRPayload(
    'WIFI:T:WPA2;S:Test_Verify_Net;P:Verify#Pass!2026;H:true;;'
  );
  const report = clipMod.formatResultReport(sample);
  assert.ok(report.includes('ZIP QR — Wi-Fi QR Decoder'));
  assert.ok(report.includes('Test_Verify_Net'));
  assert.ok(report.includes('Verify#Pass!2026'));
  assert.ok(report.includes('WPA2-Personal (PSK)'));
  assert.ok(report.includes('Hidden Network Status  : Yes'));

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
runTest(16, 'Kurdish Sorani (ckb) is default language with complete translation parity and persistence', () => {
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

// 17. Developer / Creator Identity Verification (Zardasht Muhammad & mailto link)
runTest(17, 'Creator identity credits Zardasht Muhammad in Kurdish & English with valid mailto link', () => {
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
runTest(18, 'PWA manifest.json and index.html use shortened ZIP QR — Wi-Fi QR Decoder branding', () => {
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

setTimeout(() => {
  console.log('==============================================================');
  console.log(`Test Summary: ${passed} passed, ${failed} failed (Total: ${passed + failed})`);
  console.log('==============================================================');
  if (failed > 0) process.exit(1);
}, 100);
