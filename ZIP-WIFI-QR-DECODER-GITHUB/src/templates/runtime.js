// =========================================================================
    // CORE QR DECODER & WIFI PARSER ENGINE
    // =========================================================================
    /**
 * ZIP WiFi QR Decoder — Wi-Fi & Multi-Format QR Payload Parser
 *
 * Implements state-machine lexical parsing for ZXing / IEEE 802.11 Wi-Fi QR strings
 * (`WIFI:T:WPA;S:MyNetwork;P:MyPassword;H:false;;`) and Wi-Fi Easy Connect (`DPP:...`).
 *
 * Properly unescapes special characters (`\;`, `\,`, `\:`, `\\`, `\"`) inside SSIDs
 * and passwords without breaking on colons or semicolons inside passwords.
 */

/**
 * Generates a unique ID for scan results
 */
function generateId() {
  return 'zip_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
}

/**
 * Checks if a string is a valid even-length hexadecimal string (used by some routers for hex-encoded SSIDs)
 * Only decodes as hex if explicitly unquoted and all hex chars representing valid printable UTF-8,
 * when flagged or when standard hex criteria apply.
 */
function tryDecodeHexSsid(value, wasQuoted) {
  if (wasQuoted) {
    return {
      decoded: value,
      isHexConverted: false
    };
  }
  if (/^[0-9a-fA-F]+$/.test(value) && value.length >= 8 && value.length % 2 === 0) {
    try {
      const bytes = new Uint8Array(value.length / 2);
      for (let i = 0; i < value.length; i += 2) {
        bytes[i / 2] = parseInt(value.substring(i, i + 2), 16);
      }
      const text = new TextDecoder('utf-8', {
        fatal: true
      }).decode(bytes);
      // Only treat as hex-encoded UTF-8 if it contains non-hex characters or spaces/punctuation
      // and all characters are printable
      if (/^[\x20-\x7E\u00A0-\uFFFF]+$/.test(text) && !/^[0-9a-fA-F]+$/.test(text)) {
        return {
          decoded: text,
          isHexConverted: true
        };
      }
    } catch {
      // Not valid UTF-8 hex
    }
  }
  return {
    decoded: value,
    isHexConverted: false
  };
}

/**
 * Lexical tokenizer for `KEY:VALUE;` pairs inside `WIFI:...;;` or `DPP:...;;` payloads.
 * Respects backslash escapes (`\x`) so escaped semicolons `\;` or colons `\:` inside
 * passwords and SSIDs never prematurely split a field.
 */
function tokenizeEscapedKeyValueBody(body) {
  const fields = [];
  let i = 0;
  const len = body.length;
  while (i < len) {
    // Skip leading semicolons or whitespace between tokens
    while (i < len && (body[i] === ';' || body[i] === ' ' || body[i] === '\r' || body[i] === '\n')) {
      i++;
    }
    if (i >= len) break;

    // Parse key up to unescaped ':'
    let key = '';
    while (i < len && body[i] !== ':' && body[i] !== ';') {
      if (body[i] === '\\' && i + 1 < len) {
        i++;
        key += body[i];
      } else {
        key += body[i];
      }
      i++;
    }
    if (i >= len || body[i] !== ':') {
      // Malformed segment without colon; skip to next semicolon
      while (i < len && body[i] !== ';') {
        if (body[i] === '\\' && i + 1 < len) i += 2;else i++;
      }
      continue;
    }

    // Skip the ':' separator
    i++;

    // Parse value up to unescaped ';'
    let rawChars = '';
    let hasUnescapedChars = false;
    while (i < len) {
      const ch = body[i];
      if (ch === '\\') {
        if (i + 1 < len) {
          const next = body[i + 1];
          // Handle hex escape \xHH if present, or standard character escape (\; \, \: \\ \")
          rawChars += next;
          i += 2;
          continue;
        } else {
          rawChars += '\\';
          i++;
          continue;
        }
      }
      if (ch === ';') {
        i++; // consume field-terminating semicolon
        break;
      }
      rawChars += ch;
      hasUnescapedChars = true;
      i++;
    }

    // Strip surrounding quotes if the entire value was enclosed in unescaped quotes (e.g. S:"MySSID";)
    let wasQuoted = false;
    let finalValue = rawChars;
    if (finalValue.length >= 2 && finalValue.startsWith('"') && finalValue.endsWith('"') && hasUnescapedChars) {
      wasQuoted = true;
      finalValue = finalValue.slice(1, -1);
    }
    const normalizedKey = key.trim().toUpperCase();
    if (normalizedKey) {
      fields.push({
        key: normalizedKey,
        value: finalValue,
        wasQuoted
      });
    }
  }
  return fields;
}

/**
 * Normalizes security type strings from `T:` parameter
 */
function normalizeSecurityType(rawType, transitionDisable, hasEapFields) {
  if (!rawType || rawType.trim() === '') {
    if (hasEapFields) {
      return {
        protocol: 'WPA2-EAP',
        display: 'WPA2-Enterprise (EAP)'
      };
    }
    return {
      protocol: 'nopass',
      display: 'Open (No Encryption)'
    };
  }
  const upper = rawType.trim().toUpperCase();
  if (upper === 'NOPASS' || upper === 'NONE' || upper === 'OPEN') {
    return {
      protocol: 'nopass',
      display: 'Open (nopass)'
    };
  }
  if (upper === 'WEP') {
    return {
      protocol: 'WEP',
      display: 'WEP (Wired Equivalent Privacy)'
    };
  }
  if (upper === 'SAE' || upper === 'WPA3' || upper === 'WPA3-SAE' || upper === 'WPA3-PERSONAL') {
    return {
      protocol: 'WPA3',
      display: 'WPA3-Personal (SAE)'
    };
  }
  if (upper === 'WPA2-EAP' || upper === 'EAP' || upper === 'WPA-EAP' || hasEapFields) {
    return {
      protocol: 'WPA2-EAP',
      display: 'WPA2-Enterprise (802.1X / EAP)'
    };
  }
  if (upper === 'WPA2' || upper === 'WPA2-PSK' || upper === 'WPA/WPA2') {
    if (transitionDisable && (transitionDisable === '1' || transitionDisable.toLowerCase() === 'true')) {
      return {
        protocol: 'WPA3',
        display: 'WPA3 / WPA2 Transition Disabled (SAE)'
      };
    }
    return {
      protocol: 'WPA2',
      display: 'WPA2-Personal (PSK)'
    };
  }
  if (upper === 'WPA' || upper === 'WPA-PSK') {
    if (transitionDisable && (transitionDisable === '1' || transitionDisable.toLowerCase() === 'true')) {
      return {
        protocol: 'WPA3',
        display: 'WPA3 / WPA Transition Disabled'
      };
    }
    return {
      protocol: 'WPA',
      display: 'WPA / WPA2 Personal'
    };
  }
  return {
    protocol: 'Unknown',
    display: rawType.trim()
  };
}

/**
 * Main parser function that accepts any decoded QR payload string and returns a rich,
 * strictly grounded `ParsedQRResult`.
 */
function parseQRPayload(rawInput) {
  const id = generateId();
  const timestamp = new Date().toISOString();
  if (!rawInput || rawInput.trim().length === 0) {
    return {
      id,
      timestamp,
      rawPayload: '',
      category: 'EMPTY',
      formatLabel: 'Empty QR Payload',
      isWifi: false,
      ssid: 'Empty Payload',
      password: null,
      hasPasswordField: false,
      passwordStatusMessage: 'No password is encoded in this QR code.',
      securityType: 'Unknown',
      securityDisplay: 'N/A',
      hiddenNetwork: false,
      hiddenDisplay: 'N/A',
      extraFields: [],
      warnings: ['The scanned QR code contains an empty payload.']
    };
  }
  const trimmed = rawInput.trim();

  // 1. Standard Wi-Fi Configuration QR Code (`WIFI:...`)
  if (/^WIFI:/i.test(trimmed)) {
    const body = trimmed.slice(5);
    const tokens = tokenizeEscapedKeyValueBody(body);
    const fieldMap = new Map();
    const extraFields = [];
    const warnings = [];
    const knownLabels = {
      E: 'EAP Method',
      A: 'Anonymous Identity',
      I: 'Identity / Username',
      PH2: 'Phase 2 Authentication',
      R: 'Transition Disable (WPA3 Indicator)',
      K: 'Public Key / PKEX',
      B: 'BSSID / Access Point MAC'
    };
    for (const token of tokens) {
      fieldMap.set(token.key, {
        value: token.value,
        wasQuoted: token.wasQuoted
      });
      if (!['S', 'P', 'T', 'H'].includes(token.key)) {
        extraFields.push({
          key: token.key,
          label: knownLabels[token.key] || `Parameter (${token.key})`,
          value: token.value
        });
      }
    }
    const ssidEntry = fieldMap.get('S');
    const passEntry = fieldMap.get('P');
    const typeEntry = fieldMap.get('T');
    const hiddenEntry = fieldMap.get('H');
    const transitionEntry = fieldMap.get('R');
    const hasEap = fieldMap.has('E') || fieldMap.has('I') || fieldMap.has('PH2');
    const {
      protocol,
      display: securityDisplay
    } = normalizeSecurityType(typeEntry?.value, transitionEntry?.value, hasEap);

    // SSID extraction
    let ssid = '';
    if (ssidEntry && ssidEntry.value.length > 0) {
      const hexCheck = tryDecodeHexSsid(ssidEntry.value, ssidEntry.wasQuoted);
      ssid = hexCheck.decoded;
      if (hexCheck.isHexConverted) {
        extraFields.push({
          key: 'S_HEX',
          label: 'Original Hex SSID',
          value: ssidEntry.value
        });
      }
    } else {
      ssid = 'Unnamed Network (No SSID Encoded)';
      warnings.push('No SSID (S:) field was found in this Wi-Fi QR code.');
    }

    // Hidden network status
    let hiddenNetwork = false;
    if (hiddenEntry) {
      const hVal = hiddenEntry.value.trim().toLowerCase();
      hiddenNetwork = hVal === 'true' || hVal === '1' || hVal === 'yes';
    } else if (typeEntry && typeEntry.value.trim().toLowerCase() === 'true' && !passEntry) {
      // Handle rare malformed codes where H: was omitted
      hiddenNetwork = true;
    }

    // Password extraction & status message
    let password = null;
    let hasPasswordField = false;
    let passwordStatusMessage = '';
    if (protocol === 'nopass' && (!passEntry || passEntry.value === '')) {
      password = null;
      hasPasswordField = false;
      passwordStatusMessage = 'Open network — no password required.';
    } else if (passEntry && passEntry.value.length > 0) {
      password = passEntry.value;
      hasPasswordField = true;
      passwordStatusMessage = 'Password extracted from Wi-Fi QR payload.';
    } else {
      password = null;
      hasPasswordField = false;
      passwordStatusMessage = 'No password is encoded in this QR code.';
      if (protocol !== 'nopass') {
        warnings.push('This network specifies encryption, but no password (P:) was encoded in the QR code.');
      }
    }
    return {
      id,
      timestamp,
      rawPayload: rawInput,
      category: 'WIFI',
      formatLabel: 'IEEE 802.11 / ZXing Wi-Fi Configuration (WIFI:)',
      isWifi: true,
      ssid,
      password,
      hasPasswordField,
      passwordStatusMessage,
      securityType: protocol,
      securityDisplay,
      hiddenNetwork,
      hiddenDisplay: hiddenNetwork ? 'Yes' : 'No',
      eapMethod: fieldMap.get('E')?.value,
      anonymousIdentity: fieldMap.get('A')?.value,
      identity: fieldMap.get('I')?.value,
      phase2Method: fieldMap.get('PH2')?.value,
      extraFields,
      warnings
    };
  }

  // 2. Wi-Fi Easy Connect / Device Provisioning Protocol (`DPP:...`)
  if (/^DPP:/i.test(trimmed)) {
    const body = trimmed.slice(4);
    const tokens = tokenizeEscapedKeyValueBody(body);
    const fieldMap = new Map();
    const extraFields = [];
    const dppLabels = {
      C: 'Channel / Operating Class (C)',
      M: 'MAC Address (M)',
      I: 'Device Info / Identifier (I)',
      K: 'Bootstrapping Public Key (K)',
      V: 'DPP Version (V)',
      H: 'Supported Curves / Hash (H)'
    };
    for (const token of tokens) {
      fieldMap.set(token.key, token.value);
      extraFields.push({
        key: token.key,
        label: dppLabels[token.key] || `DPP Parameter (${token.key})`,
        value: token.value
      });
    }
    const deviceInfo = fieldMap.get('I') || fieldMap.get('M') || 'DPP Provisioning Device';
    return {
      id,
      timestamp,
      rawPayload: rawInput,
      category: 'DPP',
      formatLabel: 'Wi-Fi Easy Connect / Device Provisioning Protocol (DPP:)',
      isWifi: true,
      ssid: deviceInfo,
      password: null,
      hasPasswordField: false,
      passwordStatusMessage: 'No password is encoded in this QR code. DPP uses cryptographic public-key bootstrapping instead of a plaintext Wi-Fi password.',
      securityType: 'DPP',
      securityDisplay: 'Wi-Fi Easy Connect (DPP Public-Key Handshake)',
      hiddenNetwork: false,
      hiddenDisplay: 'N/A',
      publicKey: fieldMap.get('K'),
      macAddress: fieldMap.get('M'),
      channelInfo: fieldMap.get('C'),
      extraFields,
      warnings: ['DPP QR codes contain a cryptographic bootstrapping public key (K:) rather than a plaintext Wi-Fi passphrase.']
    };
  }

  // 3. Website URL (`http://` or `https://`)
  if (/^https?:\/\//i.test(trimmed)) {
    let hostname = '';
    let protocol = '';
    try {
      const parsedUrl = new URL(trimmed);
      hostname = parsedUrl.hostname;
      protocol = parsedUrl.protocol.replace(':', '').toUpperCase();
    } catch {
      hostname = 'URL';
      protocol = 'HTTP/HTTPS';
    }
    return {
      id,
      timestamp,
      rawPayload: rawInput,
      category: 'URL',
      formatLabel: `Website URL (${protocol})`,
      isWifi: false,
      ssid: hostname || trimmed,
      password: null,
      hasPasswordField: false,
      passwordStatusMessage: 'No password is encoded in this QR code.',
      securityType: 'Unknown',
      securityDisplay: 'Non-Wi-Fi Payload (Website URL)',
      hiddenNetwork: false,
      hiddenDisplay: 'N/A',
      extraFields: [{
        key: 'URL',
        label: 'Full Destination URL',
        value: trimmed
      }, {
        key: 'HOST',
        label: 'Domain / Hostname',
        value: hostname || 'Unknown'
      }, {
        key: 'SCHEME',
        label: 'Protocol Scheme',
        value: protocol || 'Unknown'
      }],
      warnings: ['This QR code contains a website URL, not Wi-Fi credentials. For your security, external links are never opened automatically.']
    };
  }

  // 4. Contact Card (`BEGIN:VCARD` or `MECARD:`)
  if (/^(BEGIN:VCARD|MECARD:)/i.test(trimmed)) {
    const extraFields = [];
    let contactName = 'Contact Card';
    if (/^MECARD:/i.test(trimmed)) {
      const tokens = tokenizeEscapedKeyValueBody(trimmed.slice(7));
      for (const t of tokens) {
        if (t.key === 'N') contactName = t.value;
        extraFields.push({
          key: t.key,
          label: `MECARD (${t.key})`,
          value: t.value
        });
      }
    } else {
      const lines = trimmed.split(/\r?\n/);
      for (const line of lines) {
        const idx = line.indexOf(':');
        if (idx > 0) {
          const k = line.slice(0, idx).trim();
          const v = line.slice(idx + 1).trim();
          if (k.toUpperCase().startsWith('FN') || k.toUpperCase() === 'N') {
            if (v) contactName = v;
          }
          if (k.toUpperCase() !== 'BEGIN' && k.toUpperCase() !== 'END') {
            extraFields.push({
              key: k,
              label: k,
              value: v
            });
          }
        }
      }
    }
    return {
      id,
      timestamp,
      rawPayload: rawInput,
      category: 'VCARD',
      formatLabel: 'Contact Information (vCard / MECARD)',
      isWifi: false,
      ssid: contactName,
      password: null,
      hasPasswordField: false,
      passwordStatusMessage: 'No password is encoded in this QR code.',
      securityType: 'Unknown',
      securityDisplay: 'Non-Wi-Fi Payload (Contact Card)',
      hiddenNetwork: false,
      hiddenDisplay: 'N/A',
      extraFields,
      warnings: ['This QR code contains contact details rather than Wi-Fi configuration credentials.']
    };
  }

  // 5. Email, SMS, Tel, Geo
  if (/^(mailto:|MATMSG:)/i.test(trimmed)) {
    return {
      id,
      timestamp,
      rawPayload: rawInput,
      category: 'EMAIL',
      formatLabel: 'Email Payload',
      isWifi: false,
      ssid: trimmed.replace(/^(mailto:|MATMSG:)/i, '').split(/[?;]/)[0] || 'Email Address',
      password: null,
      hasPasswordField: false,
      passwordStatusMessage: 'No password is encoded in this QR code.',
      securityType: 'Unknown',
      securityDisplay: 'Non-Wi-Fi Payload (Email)',
      hiddenNetwork: false,
      hiddenDisplay: 'N/A',
      extraFields: [{
        key: 'RAW',
        label: 'Email Payload',
        value: trimmed
      }],
      warnings: ['This QR code encodes an email address/message, not a Wi-Fi network.']
    };
  }
  if (/^(smsto:|sms:)/i.test(trimmed)) {
    return {
      id,
      timestamp,
      rawPayload: rawInput,
      category: 'SMS',
      formatLabel: 'SMS Text Message Payload',
      isWifi: false,
      ssid: 'SMS Message',
      password: null,
      hasPasswordField: false,
      passwordStatusMessage: 'No password is encoded in this QR code.',
      securityType: 'Unknown',
      securityDisplay: 'Non-Wi-Fi Payload (SMS)',
      hiddenNetwork: false,
      hiddenDisplay: 'N/A',
      extraFields: [{
        key: 'RAW',
        label: 'SMS Content',
        value: trimmed
      }],
      warnings: ['This QR code encodes an SMS message, not a Wi-Fi network.']
    };
  }
  if (/^tel:/i.test(trimmed)) {
    return {
      id,
      timestamp,
      rawPayload: rawInput,
      category: 'TEL',
      formatLabel: 'Telephone Number Payload',
      isWifi: false,
      ssid: trimmed.slice(4),
      password: null,
      hasPasswordField: false,
      passwordStatusMessage: 'No password is encoded in this QR code.',
      securityType: 'Unknown',
      securityDisplay: 'Non-Wi-Fi Payload (Phone Number)',
      hiddenNetwork: false,
      hiddenDisplay: 'N/A',
      extraFields: [{
        key: 'TEL',
        label: 'Phone Number',
        value: trimmed.slice(4)
      }],
      warnings: ['This QR code encodes a phone number, not a Wi-Fi network.']
    };
  }

  // 6. Ordinary Text or Unrecognized Payload
  return {
    id,
    timestamp,
    rawPayload: rawInput,
    category: 'TEXT',
    formatLabel: 'Plain Text QR Payload',
    isWifi: false,
    ssid: trimmed.length > 36 ? trimmed.slice(0, 36) + '...' : trimmed,
    password: null,
    hasPasswordField: false,
    passwordStatusMessage: 'No password is encoded in this QR code.',
    securityType: 'Unknown',
    securityDisplay: 'Non-Wi-Fi Payload (Plain Text)',
    hiddenNetwork: false,
    hiddenDisplay: 'N/A',
    extraFields: [{
      key: 'TEXT',
      label: 'Decoded Text Content',
      value: rawInput
    }, {
      key: 'LENGTH',
      label: 'Character Count',
      value: `${rawInput.length} characters`
    }],
    warnings: ['This QR code contains ordinary text rather than a standard WIFI: configuration string.']
  };
}

/**
 * ZIP WiFi QR Decoder — Multi-Engine Local QR Code Decoder
 *
 * Performs 100% client-side QR code decoding from:
 * 1. Live camera `<video>` frames
 * 2. Uploaded PNG, JPG/JPEG, and WEBP image files
 * 3. Canvas `ImageData` buffers
 *
 * Engine cascade:
 * - Engine 1: `jsQR` (when loaded globally or imported)
 * - Engine 2: Browser Native `BarcodeDetector` API (hardware-accelerated on Chrome/Edge/Android/macOS)
 * - Engine 3: Built-in Pure TypeScript/JavaScript ISO/IEC 18004 QR Matrix Extractor & Decoder
 *   (locates finder patterns, computes perspective/grid sampling, unmasks format bits,
 *   de-interleaves Reed-Solomon codewords, and decodes Numeric, Alphanumeric, and UTF-8 Byte modes)
 */

// Precomputed GF(256) tables for QR Reed-Solomon & BCH format info
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();
function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}
function gfDiv(a, b) {
  if (a === 0) return 0;
  if (b === 0) throw new Error('GF division by zero');
  return GF_EXP[GF_LOG[a] + 255 - GF_LOG[b]];
}

// Alignment pattern center coordinates for QR Versions 1..40
const ALIGNMENT_PATTERNS = [[], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50], [6, 30, 54], [6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70], [6, 26, 50, 74], [6, 30, 54, 78], [6, 30, 56, 82], [6, 30, 58, 86], [6, 34, 62, 90]];

// RS Block Table for Versions 1..20 across Error Correction Levels:
// Format Info EC bits: 01 = L (0), 00 = M (1), 11 = Q (2), 10 = H (3)
// Ordered by [L, M, Q, H] for each version:
const RS_BLOCK_TABLE = [[],
// Version 0 placeholder
[[1, 26, 19], [1, 26, 16], [1, 26, 13], [1, 26, 9]],
// V1
[[1, 44, 34], [1, 44, 28], [1, 44, 22], [1, 44, 16]],
// V2
[[1, 70, 55], [1, 70, 44], [2, 35, 17], [2, 35, 13]],
// V3
[[1, 100, 80], [2, 50, 32], [2, 50, 24], [4, 25, 9]],
// V4
[[1, 134, 108], [2, 67, 43], [2, 33, 15, 2, 34, 16], [2, 33, 11, 2, 34, 12]],
// V5
[[2, 86, 68], [4, 43, 27], [4, 43, 19], [4, 43, 15]],
// V6
[[2, 98, 78], [4, 49, 31], [2, 32, 14, 4, 33, 15], [4, 39, 13, 1, 40, 14]],
// V7
[[2, 121, 97], [2, 60, 38, 2, 61, 39], [4, 40, 18, 2, 41, 19], [4, 40, 14, 2, 41, 15]],
// V8
[[2, 146, 116], [3, 58, 36, 2, 59, 37], [4, 36, 16, 4, 37, 17], [4, 36, 12, 4, 37, 13]],
// V9
[[2, 86, 68, 2, 87, 69], [4, 69, 43, 1, 70, 44], [6, 43, 19, 2, 44, 20], [6, 43, 15, 2, 44, 16]],
// V10
[[4, 101, 81], [1, 80, 50, 4, 81, 51], [4, 50, 22, 4, 51, 23], [3, 36, 12, 8, 37, 13]],
// V11
[[2, 116, 92, 2, 117, 93], [6, 58, 36, 2, 59, 37], [4, 46, 20, 6, 47, 21], [7, 42, 14, 4, 43, 15]],
// V12
[[4, 133, 107], [8, 59, 37, 1, 60, 38], [8, 44, 20, 4, 45, 21], [12, 33, 11, 4, 34, 12]],
// V13
[[3, 145, 115, 1, 146, 116], [4, 64, 40, 5, 65, 41], [11, 36, 16, 5, 37, 17], [11, 36, 12, 5, 37, 13]],
// V14
[[5, 109, 87, 1, 110, 88], [5, 65, 41, 5, 66, 42], [5, 54, 24, 7, 55, 25], [11, 36, 12]] // V15
];

const FORMAT_INFO_TABLE = [
// [maskedBits, ecIndex (0:L, 1:M, 2:Q, 3:H), maskPattern]
[0x77c4, 0, 0], [0x72f3, 0, 1], [0x7daa, 0, 2], [0x789d, 0, 3], [0x662f, 0, 4], [0x6318, 0, 5], [0x6c41, 0, 6], [0x6976, 0, 7], [0x5412, 1, 0], [0x5125, 1, 1], [0x5e7c, 1, 2], [0x5b4b, 1, 3], [0x45f9, 1, 4], [0x40ce, 1, 5], [0x4f97, 1, 6], [0x4aa0, 1, 7], [0x355f, 2, 0], [0x3068, 2, 1], [0x3f31, 2, 2], [0x3a06, 2, 3], [0x24b4, 2, 4], [0x2183, 2, 5], [0x2eda, 2, 6], [0x2bed, 2, 7], [0x1689, 3, 0], [0x13be, 3, 1], [0x1ce7, 3, 2], [0x19d0, 3, 3], [0x0762, 3, 4], [0x0255, 3, 5], [0x0d0c, 3, 6], [0x083b, 3, 7]];
function popcount16(x) {
  let c = 0;
  while (x) {
    c += x & 1;
    x >>>= 1;
  }
  return c;
}
function decodeFormatInfo(fmtBits1, fmtBits2) {
  let bestDist = 4; // allow up to 3 bit errors
  let bestMatch = null;
  for (const [pattern, ecIndex, mask] of FORMAT_INFO_TABLE) {
    const d1 = popcount16(fmtBits1 ^ pattern);
    if (d1 < bestDist) {
      bestDist = d1;
      bestMatch = {
        ecIndex,
        mask
      };
    }
    const d2 = popcount16(fmtBits2 ^ pattern);
    if (d2 < bestDist) {
      bestDist = d2;
      bestMatch = {
        ecIndex,
        mask
      };
    }
  }
  return bestMatch;
}
function evaluateMask(mask, row, col) {
  switch (mask) {
    case 0:
      return (row + col) % 2 === 0;
    case 1:
      return row % 2 === 0;
    case 2:
      return col % 3 === 0;
    case 3:
      return (row + col) % 3 === 0;
    case 4:
      return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
    case 5:
      return row * col % 2 + row * col % 3 === 0;
    case 6:
      return (row * col % 2 + row * col % 3) % 2 === 0;
    case 7:
      return ((row + col) % 2 + row * col % 3) % 2 === 0;
    default:
      return false;
  }
}

/**
 * Reed-Solomon error correction for a single block (corrects up to floor(ecBytes/2) symbol errors)
 */
function reedSolomonCorrect(codewords, ecLength) {
  const n = codewords.length;
  const syndromes = new Uint8Array(ecLength);
  let hasErrors = false;
  for (let i = 0; i < ecLength; i++) {
    let sum = 0;
    const alphaI = GF_EXP[i];
    for (let j = 0; j < n; j++) {
      sum = gfMul(sum, alphaI) ^ codewords[j];
    }
    syndromes[i] = sum;
    if (sum !== 0) hasErrors = true;
  }
  if (!hasErrors) {
    return codewords.slice(0, n - ecLength);
  }

  // Berlekamp-Massey algorithm to find error locator polynomial sigma(x)
  let sigma = new Uint8Array([1]);
  let oldSigma = new Uint8Array([1]);
  for (let i = 0; i < ecLength; i++) {
    let delta = syndromes[i];
    for (let j = 1; j < sigma.length; j++) {
      delta ^= gfMul(sigma[j], syndromes[i - j]);
    }
    const shiftedOld = new Uint8Array(oldSigma.length + 1);
    shiftedOld.set(oldSigma, 1);
    oldSigma = shiftedOld;
    if (delta !== 0) {
      if (oldSigma.length > sigma.length) {
        const newSigma = new Uint8Array(oldSigma.length);
        for (let j = 0; j < oldSigma.length; j++) {
          newSigma[j] = gfMul(oldSigma[j], delta);
        }
        oldSigma = new Uint8Array(sigma.length);
        for (let j = 0; j < sigma.length; j++) {
          oldSigma[j] = gfDiv(sigma[j], delta);
        }
        sigma = newSigma;
      }
      const nextSigma = new Uint8Array(Math.max(sigma.length, oldSigma.length));
      nextSigma.set(sigma);
      for (let j = 0; j < oldSigma.length; j++) {
        nextSigma[j] ^= gfMul(delta, oldSigma[j]);
      }
      sigma = nextSigma;
    }
  }
  const numErrors = sigma.length - 1;
  if (numErrors * 2 > ecLength) return null;

  // Chien search to find error locations
  const errorLocations = [];
  for (let i = 0; i < n; i++) {
    const xInv = GF_EXP[(255 - i) % 255];
    let val = 0;
    let xPow = 1;
    for (let j = 0; j < sigma.length; j++) {
      val ^= gfMul(sigma[j], xPow);
      xPow = gfMul(xPow, xInv);
    }
    if (val === 0) {
      errorLocations.push(n - 1 - i);
    }
  }
  if (errorLocations.length !== numErrors) return null;

  // Compute error evaluator polynomial omega(x) = S(x) * sigma(x) mod x^ecLength
  const omega = new Uint8Array(ecLength);
  for (let i = 0; i < ecLength; i++) {
    let sum = 0;
    for (let j = 0; j <= i && j < sigma.length; j++) {
      sum ^= gfMul(syndromes[i - j], sigma[j]);
    }
    omega[i] = sum;
  }

  // Forney algorithm to compute error magnitudes
  const corrected = new Uint8Array(codewords);
  for (const pos of errorLocations) {
    const i = n - 1 - pos;
    const xInv = GF_EXP[(255 - i) % 255];
    let num = 0;
    let xPow = 1;
    for (let j = 0; j < omega.length; j++) {
      num ^= gfMul(omega[j], xPow);
      xPow = gfMul(xPow, xInv);
    }
    let den = 0;
    let xInvSqPow = 1;
    const xInvSq = gfMul(xInv, xInv);
    for (let j = 1; j < sigma.length; j += 2) {
      den ^= gfMul(sigma[j], xInvSqPow);
      xInvSqPow = gfMul(xInvSqPow, xInvSq);
    }
    if (den === 0) return null;
    const errMag = gfDiv(num, den);
    corrected[pos] ^= errMag;
  }
  return corrected.slice(0, n - ecLength);
}

/**
 * Builds function module reservation map for a given QR version
 */
function buildFunctionModuleMap(version) {
  const size = version * 4 + 17;
  const reserved = Array.from({
    length: size
  }, () => Array(size).fill(false));

  // Finder patterns + separators
  const markRect = (r0, c0, h, w) => {
    for (let r = r0; r < r0 + h; r++) {
      for (let c = c0; c < c0 + w; c++) {
        if (r >= 0 && r < size && c >= 0 && c < size) {
          reserved[r][c] = true;
        }
      }
    }
  };
  markRect(0, 0, 9, 9);
  markRect(0, size - 8, 9, 8);
  markRect(size - 8, 0, 8, 9);

  // Timing patterns
  for (let i = 0; i < size; i++) {
    reserved[6][i] = true;
    reserved[i][6] = true;
  }

  // Alignment patterns
  const alignCoords = ALIGNMENT_PATTERNS[version] || [];
  for (const r of alignCoords) {
    for (const c of alignCoords) {
      // Skip if overlapping with finder patterns
      if (r <= 8 && c <= 8 || r <= 8 && c >= size - 8 || r >= size - 8 && c <= 8) {
        continue;
      }
      markRect(r - 2, c - 2, 5, 5);
    }
  }

  // Version info blocks for Version >= 7
  if (version >= 7) {
    markRect(0, size - 11, 6, 3);
    markRect(size - 11, 0, 3, 6);
  }
  return reserved;
}
const ALPHANUMERIC_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

/**
 * Decodes data bits from de-interleaved QR data codewords
 */
function decodeDataCodewords(dataBytes, version) {
  let bitOffset = 0;
  const totalBits = dataBytes.length * 8;
  const readBits = count => {
    let val = 0;
    for (let i = 0; i < count; i++) {
      if (bitOffset >= totalBits) return 0;
      const byteIdx = bitOffset >> 3;
      const bitIdx = 7 - (bitOffset & 7);
      val = val << 1 | dataBytes[byteIdx] >> bitIdx & 1;
      bitOffset++;
    }
    return val;
  };
  const getCountBits = (mode, ver) => {
    if (ver <= 9) {
      if (mode === 1) return 10;
      if (mode === 2) return 9;
      if (mode === 4) return 8;
      return 8;
    } else if (ver <= 26) {
      if (mode === 1) return 12;
      if (mode === 2) return 11;
      if (mode === 4) return 16;
      return 10;
    } else {
      if (mode === 1) return 14;
      if (mode === 2) return 13;
      if (mode === 4) return 16;
      return 12;
    }
  };
  let output = '';
  const byteChunks = [];
  const flushBytes = () => {
    if (byteChunks.length > 0) {
      try {
        output += new TextDecoder('utf-8', {
          fatal: false
        }).decode(new Uint8Array(byteChunks));
      } catch {
        output += String.fromCharCode(...byteChunks);
      }
      byteChunks.length = 0;
    }
  };
  while (totalBits - bitOffset >= 4) {
    const mode = readBits(4);
    if (mode === 0) {
      // Terminator
      break;
    }
    if (mode === 7) {
      // ECI mode: read 8-bit ECI designator and continue
      readBits(8);
      continue;
    }
    if (mode === 4) {
      // 8-bit Byte Mode
      const count = readBits(getCountBits(4, version));
      for (let i = 0; i < count; i++) {
        byteChunks.push(readBits(8));
      }
      flushBytes();
    } else if (mode === 2) {
      // Alphanumeric Mode
      flushBytes();
      let count = readBits(getCountBits(2, version));
      while (count > 1) {
        const pair = readBits(11);
        output += ALPHANUMERIC_CHARS[Math.floor(pair / 45)] || '';
        output += ALPHANUMERIC_CHARS[pair % 45] || '';
        count -= 2;
      }
      if (count === 1) {
        const single = readBits(6);
        output += ALPHANUMERIC_CHARS[single] || '';
      }
    } else if (mode === 1) {
      // Numeric Mode
      flushBytes();
      let count = readBits(getCountBits(1, version));
      while (count >= 3) {
        const triple = readBits(10);
        output += triple.toString().padStart(3, '0');
        count -= 3;
      }
      if (count === 2) {
        const pair = readBits(7);
        output += pair.toString().padStart(2, '0');
      } else if (count === 1) {
        const single = readBits(4);
        output += single.toString();
      }
    } else {
      break;
    }
  }
  flushBytes();
  return output.length > 0 ? output : null;
}

/**
 * Decodes a sampled boolean QR module grid (N x N where N = version*4 + 17)
 */
function decodeQRModuleMatrix(matrix) {
  const size = matrix.length;
  if (size < 21 || (size - 17) % 4 !== 0) return null;
  const version = (size - 17) / 4;
  if (version < 1 || version >= RS_BLOCK_TABLE.length) return null;

  // Read Format Information #1 (around top-left finder)
  let fmt1 = 0;
  const fmt1Coords = [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]];
  for (let i = 0; i < 15; i++) {
    const [r, c] = fmt1Coords[i];
    if (matrix[r][c]) fmt1 |= 1 << 14 - i; // Note: standard order or LSB-first
  }

  // Also check reversed bit order (used by Kazuhiko Arase / OpenCV encoders)
  let fmt1Rev = 0;
  for (let i = 0; i < 15; i++) {
    const [r, c] = fmt1Coords[i];
    if (matrix[r][c]) fmt1Rev |= 1 << i;
  }

  // Read Format Information #2 (bottom-left + top-right)
  let fmt2 = 0;
  let fmt2Rev = 0;
  const fmt2Coords = [[size - 1, 8], [size - 2, 8], [size - 3, 8], [size - 4, 8], [size - 5, 8], [size - 6, 8], [size - 7, 8], [8, size - 8], [8, size - 7], [8, size - 6], [8, size - 5], [8, size - 4], [8, size - 3], [8, size - 2], [8, size - 1]];
  for (let i = 0; i < 15; i++) {
    const [r, c] = fmt2Coords[i];
    if (matrix[r][c]) {
      fmt2 |= 1 << 14 - i;
      fmt2Rev |= 1 << i;
    }
  }
  const candidates = [];
  const m1 = decodeFormatInfo(fmt1, fmt2);
  if (m1) candidates.push(m1);
  const m2 = decodeFormatInfo(fmt1Rev, fmt2Rev);
  if (m2) candidates.push(m2);

  // Fallback: try all 4 EC levels and 8 masks if format bits were damaged
  for (let ecIndex = 0; ecIndex < 4; ecIndex++) {
    for (let mask = 0; mask < 8; mask++) {
      candidates.push({
        ecIndex,
        mask
      });
    }
  }
  const reserved = buildFunctionModuleMap(version);
  for (const {
    ecIndex,
    mask
  } of candidates) {
    const rsSpec = RS_BLOCK_TABLE[version][ecIndex];
    if (!rsSpec) continue;

    // Extract raw codewords in upward/downward 2-column zigzag
    const bits = [];
    let row = size - 1;
    let inc = -1;
    for (let col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--; // skip vertical timing pattern
      while (true) {
        for (let c = 0; c < 2; c++) {
          const currCol = col - c;
          if (!reserved[row][currCol]) {
            let dark = matrix[row][currCol];
            if (evaluateMask(mask, row, currCol)) {
              dark = !dark;
            }
            bits.push(dark ? 1 : 0);
          }
        }
        row += inc;
        if (row < 0 || row >= size) {
          row -= inc;
          inc = -inc;
          break;
        }
      }
    }
    const totalCodewords = Math.floor(bits.length / 8);
    const codewords = new Uint8Array(totalCodewords);
    for (let i = 0; i < totalCodewords; i++) {
      let b = 0;
      for (let j = 0; j < 8; j++) {
        b = b << 1 | bits[i * 8 + j];
      }
      codewords[i] = b;
    }

    // Build block list
    const blocks = [];
    for (let i = 0; i < rsSpec.length; i += 3) {
      const count = rsSpec[i];
      const total = rsSpec[i + 1];
      const data = rsSpec[i + 2];
      for (let j = 0; j < count; j++) {
        blocks.push({
          total,
          data
        });
      }
    }
    const maxDataLen = Math.max(...blocks.map(b => b.data));
    const maxEcLen = Math.max(...blocks.map(b => b.total - b.data));
    const dataBlocks = blocks.map(b => new Uint8Array(b.data));
    const ecBlocks = blocks.map(b => new Uint8Array(b.total - b.data));
    let cwIdx = 0;
    for (let i = 0; i < maxDataLen; i++) {
      for (let b = 0; b < blocks.length; b++) {
        if (i < dataBlocks[b].length && cwIdx < codewords.length) {
          dataBlocks[b][i] = codewords[cwIdx++];
        }
      }
    }
    for (let i = 0; i < maxEcLen; i++) {
      for (let b = 0; b < blocks.length; b++) {
        if (i < ecBlocks[b].length && cwIdx < codewords.length) {
          ecBlocks[b][i] = codewords[cwIdx++];
        }
      }
    }

    // Run Reed-Solomon error correction on each block
    let allValid = true;
    const correctedBlocks = [];
    for (let b = 0; b < blocks.length; b++) {
      const fullBlock = new Uint8Array(blocks[b].total);
      fullBlock.set(dataBlocks[b], 0);
      fullBlock.set(ecBlocks[b], dataBlocks[b].length);
      const corrected = reedSolomonCorrect(fullBlock, ecBlocks[b].length);
      if (!corrected) {
        allValid = false;
        break;
      }
      correctedBlocks.push(corrected);
    }
    if (!allValid) continue;
    const totalDataBytes = correctedBlocks.reduce((acc, b) => acc + b.length, 0);
    const mergedData = new Uint8Array(totalDataBytes);
    let offset = 0;
    for (const cb of correctedBlocks) {
      mergedData.set(cb, offset);
      offset += cb.length;
    }
    const decodedText = decodeDataCodewords(mergedData, version);
    if (decodedText !== null && decodedText.length > 0) {
      return decodedText;
    }
  }
  return null;
}

/**
 * Extracts a QR boolean matrix from an `ImageData` buffer by locating the bounding box
 * and finder patterns (1:1:3:1:1 dark/light ratio) or uniform grid modules.
 */
function extractAndDecodeFromImageData(imageData) {
  const {
    data,
    width,
    height
  } = imageData;
  if (width < 21 || height < 21) return null;

  // 1. If global jsQR is loaded, try it first for maximum rotation/perspective invariance
  const globalWindow = typeof window !== 'undefined' ? window : {};
  if (typeof globalWindow.jsQR === 'function') {
    try {
      const res = globalWindow.jsQR(data, width, height);
      if (res && res.data) return res.data;
    } catch {
      // continue to built-in engine
    }
  }

  // 2. Convert RGBA to grayscale luminance
  const gray = new Uint8Array(width * height);
  let minLum = 255;
  let maxLum = 0;
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    const alpha = data[idx + 3];
    // Treat transparent pixels as white background
    const lum = alpha < 128 ? 255 : Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
    gray[i] = lum;
    if (lum < minLum) minLum = lum;
    if (lum > maxLum) maxLum = lum;
  }
  const threshold = Math.floor((minLum + maxLum) / 2);
  if (maxLum - minLum < 20) return null; // Blank/uniform image

  // Find tight bounding box of dark pixels
  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    const rowOff = y * width;
    for (let x = 0; x < width; x++) {
      if (gray[rowOff + x] < threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX <= minX || maxY <= minY) return null;
  const boxW = maxX - minX + 1;
  const boxH = maxY - minY + 1;

  // Estimate module size from top-left finder pattern's top border run length (7 modules wide)
  let topRun = 0;
  for (let x = minX; x <= maxX; x++) {
    if (gray[minY * width + x] < threshold) {
      topRun++;
    } else if (topRun > 0) {
      break;
    }
  }
  const candidateVersions = new Set();
  if (topRun >= 7) {
    const estMod = topRun / 7;
    const estCount = Math.round((boxW + boxH) / 2 / estMod);
    const estVer = Math.round((estCount - 17) / 4);
    for (let dv = -1; dv <= 1; dv++) {
      if (estVer + dv >= 1 && estVer + dv <= 15) {
        candidateVersions.add(estVer + dv);
      }
    }
  }

  // Add all standard versions 1..15 as candidates
  for (let v = 1; v <= 15; v++) {
    candidateVersions.add(v);
  }
  for (const v of candidateVersions) {
    const N = v * 4 + 17;
    const stepX = boxW / N;
    const stepY = boxH / N;
    if (stepX < 0.8 || stepY < 0.8) continue;
    const matrix = Array.from({
      length: N
    }, () => Array(N).fill(false));
    for (let r = 0; r < N; r++) {
      const sampleY = Math.min(height - 1, Math.max(0, Math.floor(minY + (r + 0.5) * stepY)));
      for (let c = 0; c < N; c++) {
        const sampleX = Math.min(width - 1, Math.max(0, Math.floor(minX + (c + 0.5) * stepX)));
        matrix[r][c] = gray[sampleY * width + sampleX] < threshold;
      }
    }

    // Quick sanity check on top-left finder pattern center (r=3, c=3 should be dark, r=1, c=1 should be light)
    if (!matrix[3][3] || matrix[1][1] || !matrix[0][0]) {
      continue;
    }
    const decoded = decodeQRModuleMatrix(matrix);
    if (decoded) {
      return decoded;
    }
  }
  return null;
}

/**
 * Decodes a QR code from an `HTMLImageElement`, `HTMLVideoElement`, or `HTMLCanvasElement`
 * using both Browser Native `BarcodeDetector` (if supported) and `extractAndDecodeFromImageData`.
 */
async function decodeQRFromSource(source) {
  // 1. Try native BarcodeDetector if available in browser
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    try {
      const BarcodeDetectorCtor = window.BarcodeDetector;
      const detector = new BarcodeDetectorCtor({
        formats: ['qr_code']
      });
      const results = await detector.detect(source);
      if (results && results.length > 0 && results[0].rawValue) {
        return results[0].rawValue;
      }
    } catch {
      // Fallback to Canvas ImageData decoder
    }
  }

  // 2. Render source to an offscreen canvas and decode via ImageData engine
  const canvas = document.createElement('canvas');
  let w = 0;
  let h = 0;
  if (source instanceof HTMLVideoElement) {
    w = source.videoWidth;
    h = source.videoHeight;
  } else if (source instanceof HTMLImageElement) {
    w = source.naturalWidth || source.width;
    h = source.naturalHeight || source.height;
  } else {
    w = source.width;
    h = source.height;
  }
  if (w <= 0 || h <= 0) return null;

  // Try original scale (clamped to 1024px) and a crisp 512px scale
  const scales = [Math.min(1, 1024 / Math.max(w, h)), Math.min(1, 512 / Math.max(w, h))];
  const ctx = canvas.getContext('2d', {
    willReadFrequently: true
  });
  if (!ctx) return null;
  for (const scale of scales) {
    const sw = Math.max(21, Math.round(w * scale));
    const sh = Math.max(21, Math.round(h * scale));
    canvas.width = sw;
    canvas.height = sh;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, sw, sh);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, 0, 0, sw, sh);
    const imgData = ctx.getImageData(0, 0, sw, sh);
    const decoded = extractAndDecodeFromImageData(imgData);
    if (decoded) return decoded;
  }
  return null;
}

/**
 * Decodes an uploaded image File (PNG, JPG/JPEG, WEBP) into a raw QR payload string.
 */
function decodeQRFromFile(file) {
  return new Promise((resolve, reject) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/bmp'];
    const ext = file.name.toLowerCase().split('.').pop() || '';
    const allowedExts = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'];
    if (!allowedTypes.includes(file.type) && !allowedExts.includes(ext)) {
      reject(new Error('Unsupported file format. Please upload a PNG, JPG/JPEG, or WEBP image.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read the selected image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('The selected file is not a valid image.'));
      img.onload = async () => {
        try {
          const payload = await decodeQRFromSource(img);
          if (payload) {
            resolve(payload);
          } else {
            reject(new Error('No valid QR code was detected in this image. Ensure the QR code is clear and well-lit.'));
          }
        } catch (err) {
          reject(err instanceof Error ? err : new Error('QR decoding error.'));
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

    // =========================================================================
    // APPLICATION STATE & STORAGE MANAGEMENT
    // =========================================================================
    const STORAGE_KEYS = {
      HISTORY: 'zip_wifi_qr_history_v1',
      SETTINGS: 'zip_wifi_qr_settings_v1'
    };

    let appSettings = {
      historyEnabled: true,
      autoMaskPassword: false,
      accentTheme: 'electric-blue',
      preferredCameraId: ''
    };

    let scanHistory = [];
    let currentResult = null;
    let currentSourceLabel = '';
    let isPasswordVisible = true;
    let activeStream = null;
    let scanIntervalId = null;
    let torchEnabled = false;

    function loadStoredState() {
      try {
        const rawSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
        if (rawSettings) {
          appSettings = Object.assign({}, appSettings, JSON.parse(rawSettings));
        }
      } catch (e) {}
      try {
        const rawHistory = localStorage.getItem(STORAGE_KEYS.HISTORY);
        if (rawHistory) {
          const parsed = JSON.parse(rawHistory);
          if (Array.isArray(parsed)) scanHistory = parsed;
        }
      } catch (e) {}
    }

    function saveSettingsState() {
      try {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(appSettings));
      } catch (e) {}
      applySettingsToUI();
    }

    function saveHistoryState() {
      try {
        localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(scanHistory));
      } catch (e) {}
      renderHistoryViews();
    }

    function showToast(message) {
      const banner = document.getElementById('toastBanner');
      if (!banner) return;
      banner.textContent = message;
      banner.classList.remove('hidden');
      clearTimeout(window.__zipToastTimer);
      window.__zipToastTimer = setTimeout(() => {
        banner.classList.add('hidden');
      }, 3000);
    }

    async function copyToClipboardSafe(text) {
      if (!text) return false;
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        try {
          await navigator.clipboard.writeText(text);
          return true;
        } catch (e) {}
      }
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', 'true');
        ta.style.position = 'fixed';
        ta.style.top = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
      } catch (e) {
        return false;
      }
    }

    function buildFormattedReport(res) {
      const lines = [
        '==================================================',
        'ZIP WiFi QR Decoder — Decoded Credential Report',
        'SCAN. REVEAL. CONNECT.',
        '==================================================',
        'Scan Timestamp     : ' + new Date(res.timestamp).toLocaleString(),
        'Payload Format     : ' + res.formatLabel,
        'Payload Category   : ' + res.category,
        '--------------------------------------------------',
        'NETWORK INFORMATION',
        '--------------------------------------------------',
        '1. Wi-Fi Name (SSID)      : ' + res.ssid,
        '2. Wi-Fi Password         : ' + (res.hasPasswordField && res.password !== null ? res.password : res.passwordStatusMessage),
        '3. Security Type          : ' + res.securityDisplay,
        '4. Hidden Network Status  : ' + res.hiddenDisplay,
        '5. QR Payload Format      : ' + res.formatLabel
      ];
      if (res.extraFields && res.extraFields.length > 0) {
        lines.push('--------------------------------------------------');
        lines.push('6. ADDITIONAL ENCODED PARAMETERS');
        lines.push('--------------------------------------------------');
        res.extraFields.forEach((f) => {
          lines.push('- ' + f.label + ' [' + f.key + ']: ' + f.value);
        });
      }
      lines.push('--------------------------------------------------');
      lines.push('RAW DECODED QR PAYLOAD');
      lines.push('--------------------------------------------------');
      lines.push(res.rawPayload || '(empty)');
      lines.push('==================================================');
      return lines.join('\n');
    }

    function downloadReportFile(res, ext) {
      const stamp = new Date(res.timestamp).toISOString().slice(0, 19).replace(/[:T]/g, '-');
      const safeName = 'zip-qr-decoded-report-' + stamp + '.' + ext;
      const body = ext === 'json' ? JSON.stringify(res, null, 2) : buildFormattedReport(res);
      const mime = ext === 'json' ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8';
      const blob = new Blob([body], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = safeName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    // =========================================================================
    // NAVIGATION & PAGE SWITCHING
    // =========================================================================
    function navigateTo(pageId) {
      if (pageId !== 'scanner') {
        stopLiveCameraScanner();
      }
      const pages = ['home', 'scanner', 'results', 'history', 'settings'];
      pages.forEach((p) => {
        const el = document.getElementById('page-' + p);
        if (el) {
          if (p === pageId) el.classList.remove('hidden');
          else el.classList.add('hidden');
        }
      });

      document.querySelectorAll('.nav-tab').forEach((btn) => {
        const target = btn.getAttribute('data-nav');
        if (target === pageId) {
          btn.className = 'nav-tab zip-gradient-btn rounded-xl px-3 py-2 text-xs font-bold text-white transition-all sm:px-3.5';
        } else {
          btn.className = 'nav-tab rounded-xl px-3 py-2 text-xs font-bold text-slate-400 hover:bg-slate-800/70 hover:text-white transition-all sm:px-3.5';
        }
      });

      if (pageId === 'scanner') {
        startLiveCameraScanner(appSettings.preferredCameraId);
      } else if (pageId === 'results') {
        renderResultsPage();
      } else if (pageId === 'history') {
        renderHistoryViews();
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // =========================================================================
    // HANDLE DECODED QR PAYLOAD
    // =========================================================================
    function handleDecodedQR(rawPayload, sourceLabel) {
      const parsed = parseQRPayload(rawPayload);
      currentResult = parsed;
      currentSourceLabel = sourceLabel || 'QR Scan';
      isPasswordVisible = !appSettings.autoMaskPassword;

      if (appSettings.historyEnabled) {
        const entry = {
          id: parsed.id,
          timestamp: parsed.timestamp,
          ssid: parsed.ssid,
          category: parsed.category,
          securityDisplay: parsed.securityDisplay,
          result: parsed
        };
        scanHistory = [
          entry,
          ...scanHistory.filter((item) => item.result.rawPayload !== parsed.rawPayload)
        ].slice(0, 50);
        saveHistoryState();
      }

      navigateTo('results');
      if (parsed.hasPasswordField && parsed.password !== null) {
        showToast('Password extracted for "' + parsed.ssid + '"!');
      } else {
        showToast('Decoded QR code (' + parsed.formatLabel + ')');
      }
    }

    // =========================================================================
    // RENDER RESULTS PAGE
    // =========================================================================
    function renderResultsPage() {
      const emptyEl = document.getElementById('resultsEmptyState');
      const wrapEl = document.getElementById('resultsContentWrap');
      if (!currentResult) {
        emptyEl.classList.remove('hidden');
        wrapEl.classList.add('hidden');
        return;
      }
      emptyEl.classList.add('hidden');
      wrapEl.classList.remove('hidden');

      document.getElementById('resCategoryBadge').textContent = currentResult.category;
      document.getElementById('resSourceBadge').textContent = 'Source: ' + currentSourceLabel;
      document.getElementById('resSsidHeading').textContent = currentResult.ssid;
      document.getElementById('resTimestampText').textContent = 'Decoded on ' + new Date(currentResult.timestamp).toLocaleString();

      const passValContainer = document.getElementById('resPasswordValueContainer');
      const noPassNotice = document.getElementById('resNoPasswordNotice');
      const passCharCount = document.getElementById('resPasswordCharCount');
      const passField = document.getElementById('resPasswordField');
      const toggleBtn = document.getElementById('resTogglePasswordBtn');

      if (currentResult.hasPasswordField && currentResult.password !== null) {
        passValContainer.classList.remove('hidden');
        noPassNotice.classList.add('hidden');
        passCharCount.textContent = currentResult.password.length + ' chars';
        passCharCount.classList.remove('hidden');
        passField.textContent = isPasswordVisible
          ? currentResult.password
          : '•'.repeat(Math.min(24, Math.max(8, currentResult.password.length)));
        toggleBtn.textContent = isPasswordVisible ? 'HIDE PASSWORD' : 'SHOW PASSWORD';
      } else {
        passValContainer.classList.add('hidden');
        noPassNotice.classList.remove('hidden');
        passCharCount.classList.add('hidden');
        noPassNotice.textContent = currentResult.passwordStatusMessage;
      }

      // Warnings
      const warnBox = document.getElementById('resWarningsBox');
      warnBox.innerHTML = '';
      if (currentResult.warnings && currentResult.warnings.length > 0) {
        warnBox.classList.remove('hidden');
        currentResult.warnings.forEach((w) => {
          const p = document.createElement('p');
          p.textContent = '• ' + w;
          warnBox.appendChild(p);
        });
      } else {
        warnBox.classList.add('hidden');
      }

      // Network Information Grid
      document.getElementById('infoSsid').textContent = currentResult.ssid;
      document.getElementById('infoPassword').textContent =
        currentResult.hasPasswordField && currentResult.password !== null
          ? currentResult.password
          : currentResult.passwordStatusMessage;
      document.getElementById('infoSecurity').textContent = currentResult.securityDisplay;
      document.getElementById('infoHidden').textContent = currentResult.hiddenDisplay;
      document.getElementById('infoFormat').textContent = currentResult.formatLabel;
      document.getElementById('infoRawPayload').textContent = currentResult.rawPayload;

      // Extra fields
      const extraContainer = document.getElementById('infoExtraFields');
      extraContainer.innerHTML = '';
      if (!currentResult.extraFields || currentResult.extraFields.length === 0) {
        const p = document.createElement('p');
        p.className = 'text-xs text-slate-400 sm:col-span-2';
        p.textContent = 'No additional optional parameters are encoded in this QR code.';
        extraContainer.appendChild(p);
      } else {
        currentResult.extraFields.forEach((item) => {
          const card = document.createElement('div');
          card.className = 'rounded-xl border border-slate-800 zip-card p-3';
          const lbl = document.createElement('span');
          lbl.className = 'text-[11px] font-semibold text-slate-400';
          lbl.textContent = item.label;
          const val = document.createElement('p');
          val.className = 'font-mono-code mt-1 break-all text-xs text-white';
          val.textContent = item.value;
          card.appendChild(lbl);
          card.appendChild(val);
          extraContainer.appendChild(card);
        });
      }
    }

    // =========================================================================
    // RENDER HISTORY LISTS
    // =========================================================================

    function createHistoryCardElement(entry, compact) {
      const res = entry.result;
      const row = document.createElement('div');
      row.className = 'flex flex-col justify-between gap-3 rounded-2xl border border-slate-800/90 zip-card p-4 transition hover:border-sky-500/40 sm:flex-row sm:items-center';

      const left = document.createElement('div');
      left.className = 'min-w-0 flex-1';

      const badges = document.createElement('div');
      badges.className = 'flex flex-wrap items-center gap-2';

      const catBadge = document.createElement('span');
      catBadge.className = 'rounded-lg border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-300';
      catBadge.textContent = res.category === 'WIFI' ? res.securityType : res.category;
      badges.appendChild(catBadge);

      if (res.hiddenNetwork) {
        const hBadge = document.createElement('span');
        hBadge.className = 'rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300';
        hBadge.textContent = 'Hidden SSID';
        badges.appendChild(hBadge);
      }

      const dateSpan = document.createElement('span');
      dateSpan.className = 'text-[11px] text-slate-400';
      dateSpan.textContent = new Date(entry.timestamp).toLocaleString();
      badges.appendChild(dateSpan);

      const title = document.createElement('h4');
      title.className = 'mt-1.5 truncate text-base font-bold text-white';
      title.textContent = entry.ssid;

      left.appendChild(badges);
      left.appendChild(title);

      if (!compact) {
        const sub = document.createElement('p');
        sub.className = 'font-mono-code mt-1 truncate text-xs text-slate-400';
        sub.textContent = res.hasPasswordField && res.password !== null
          ? 'Password extracted (' + res.password.length + ' chars) • ' + res.securityDisplay
          : res.passwordStatusMessage;
        left.appendChild(sub);
      }

      const actions = document.createElement('div');
      actions.className = 'flex items-center gap-2 shrink-0';

      const openBtn = document.createElement('button');
      openBtn.type = 'button';
      openBtn.className = 'rounded-xl bg-sky-500/15 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-sky-300 hover:bg-sky-500/25';
      openBtn.textContent = 'Open Result';
      openBtn.addEventListener('click', () => {
        currentResult = res;
        currentSourceLabel = 'Scan History';
        isPasswordVisible = !appSettings.autoMaskPassword;
        navigateTo('results');
      });
      actions.appendChild(openBtn);

      if (!compact) {
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20';
        delBtn.textContent = 'Delete';
        delBtn.addEventListener('click', () => {
          scanHistory = scanHistory.filter((item) => item.id !== entry.id);
          saveHistoryState();
          showToast('Deleted entry from scan history.');
        });
        actions.appendChild(delBtn);
      }

      row.appendChild(left);
      row.appendChild(actions);
      return row;
    }

    function renderHistoryViews() {
      const badge = document.getElementById('navHistoryBadge');
      if (badge) badge.textContent = String(scanHistory.length);

      // Home recent list
      const homeList = document.getElementById('homeRecentList');
      if (homeList) {
        homeList.innerHTML = '';
        if (scanHistory.length === 0) {
          const empty = document.createElement('div');
          empty.className = 'rounded-2xl border border-slate-800/70 zip-card p-6 text-center text-xs text-slate-400';
          empty.textContent = 'No QR codes scanned yet. Use SCAN QR CODE, UPLOAD QR IMAGE, or PASTE QR CONTENT above to decode a QR code.';
          homeList.appendChild(empty);
        } else {
          scanHistory.slice(0, 3).forEach((entry) => {
            homeList.appendChild(createHistoryCardElement(entry, true));
          });
        }
      }

      // Full history page
      const fullList = document.getElementById('historyListContainer');
      const queryInput = document.getElementById('historySearchInput');
      if (fullList) {
        fullList.innerHTML = '';
        const q = queryInput ? queryInput.value.trim().toLowerCase() : '';
        const filtered = scanHistory.filter((item) => {
          if (!q) return true;
          return (
            item.ssid.toLowerCase().includes(q) ||
            item.category.toLowerCase().includes(q) ||
            item.securityDisplay.toLowerCase().includes(q)
          );
        });

        if (filtered.length === 0) {
          const empty = document.createElement('div');
          empty.className = 'rounded-3xl border border-slate-800 zip-surface p-10 text-center text-xs text-slate-400';
          empty.textContent = scanHistory.length === 0
            ? 'Your local scan history is currently empty.'
            : 'No scan history entries match your search filter.';
          fullList.appendChild(empty);
        } else {
          filtered.forEach((entry) => {
            fullList.appendChild(createHistoryCardElement(entry, false));
          });
        }
      }
    }

    // =========================================================================
    // LIVE CAMERA SCANNER LIFECYCLE
    // =========================================================================
    function stopLiveCameraScanner() {
      if (scanIntervalId !== null) {
        clearInterval(scanIntervalId);
        scanIntervalId = null;
      }
      torchEnabled = false;
      if (activeStream) {
        activeStream.getTracks().forEach((t) => {
          try { t.stop(); } catch (e) {}
        });
        activeStream = null;
      }
      const video = document.getElementById('scannerVideo');
      if (video) video.srcObject = null;
    }

    async function startLiveCameraScanner(preferredDeviceId) {
      stopLiveCameraScanner();
      const video = document.getElementById('scannerVideo');
      const reticle = document.getElementById('scannerReticleOverlay');
      const fallbackBox = document.getElementById('scannerFallbackBox');
      const fallbackReason = document.getElementById('scannerFallbackReason');
      const statusPill = document.getElementById('scannerStatusPill');
      const torchBtn = document.getElementById('scannerTorchBtn');
      const camSelect = document.getElementById('cameraDeviceSelect');

      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        video.classList.add('hidden');
        reticle.classList.add('hidden');
        fallbackBox.classList.remove('hidden');
        fallbackReason.textContent = 'Camera API (getUserMedia) is unavailable in this browser context. You can upload any PNG, JPG, or WEBP QR image directly.';
        return;
      }

      video.classList.remove('hidden');
      reticle.classList.remove('hidden');
      fallbackBox.classList.add('hidden');
      statusPill.textContent = 'Opening camera stream...';

      const constraints = {
        audio: false,
        video: preferredDeviceId
          ? { deviceId: { exact: preferredDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
      };

      try {
        activeStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        try {
          activeStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } catch (fallbackErr) {
          video.classList.add('hidden');
          reticle.classList.add('hidden');
          fallbackBox.classList.remove('hidden');
          fallbackReason.textContent = 'Camera access was denied or no camera hardware was detected. Use the Upload QR Image button below to decode from a file.';
          return;
        }
      }

      video.srcObject = activeStream;
      try {
        await video.play();
      } catch (e) {}
      statusPill.textContent = 'Scanning for Wi-Fi QR Code...';

      // Populate camera list
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cams = devices.filter((d) => d.kind === 'videoinput');
        if (cams.length > 0) {
          camSelect.innerHTML = '';
          cams.forEach((c, idx) => {
            const opt = document.createElement('option');
            opt.value = c.deviceId;
            opt.textContent = c.label || ('Camera ' + (idx + 1));
            camSelect.appendChild(opt);
          });
          const activeTrack = activeStream.getVideoTracks()[0];
          const curId = activeTrack && activeTrack.getSettings ? activeTrack.getSettings().deviceId : '';
          if (curId) camSelect.value = curId;
        }
      } catch (e) {}

      // Check torch capability
      const track = activeStream.getVideoTracks()[0];
      let hasTorch = false;
      if (track && typeof track.getCapabilities === 'function') {
        try {
          const caps = track.getCapabilities();
          hasTorch = Boolean(caps && caps.torch);
        } catch (e) {}
      }
      if (hasTorch) {
        torchBtn.disabled = false;
        torchBtn.className = 'rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-slate-200 hover:border-sky-400';
        torchBtn.textContent = 'Flashlight: OFF';
      } else {
        torchBtn.disabled = true;
        torchBtn.className = 'rounded-xl border border-slate-800 bg-slate-900/60 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 cursor-not-allowed';
        torchBtn.textContent = 'Flashlight N/A';
      }

      scanIntervalId = setInterval(async () => {
        if (!video || video.readyState < 2) return;
        const decoded = await decodeQRFromSource(video);
        if (decoded) {
          stopLiveCameraScanner();
          handleDecodedQR(decoded, 'Live Camera Scan');
        }
      }, 220);
    }

    // =========================================================================
    // APPLY SETTINGS TO UI
    // =========================================================================
    function applySettingsToUI() {
      document.body.setAttribute('data-theme', appSettings.accentTheme || 'electric-blue');
      const histCheck1 = document.getElementById('historyToggleCheckbox');
      const histCheck2 = document.getElementById('settingsHistoryCheckbox');
      const maskCheck = document.getElementById('settingsMaskCheckbox');
      if (histCheck1) histCheck1.checked = Boolean(appSettings.historyEnabled);
      if (histCheck2) histCheck2.checked = Boolean(appSettings.historyEnabled);
      if (maskCheck) maskCheck.checked = Boolean(appSettings.autoMaskPassword);

      document.querySelectorAll('.theme-card').forEach((btn) => {
        const t = btn.getAttribute('data-theme-choice');
        if (t === appSettings.accentTheme) {
          btn.className = 'theme-card rounded-2xl border border-sky-400 bg-sky-500/15 p-4 text-left transition';
        } else {
          btn.className = 'theme-card rounded-2xl border border-slate-800 zip-card p-4 text-left transition';
        }
      });
    }

    // =========================================================================
    // WIRE ALL EVENT LISTENERS ON DOM READY
    // =========================================================================
    window.addEventListener('DOMContentLoaded', () => {
      loadStoredState();
      applySettingsToUI();

      if (scanHistory.length > 0) {
        currentResult = scanHistory[0].result;
        currentSourceLabel = 'Recent History';
      } else {
        currentResult = null;
        currentSourceLabel = '';
      }
      renderHistoryViews();
      navigateTo('home');

      // Navigation tabs
      document.querySelectorAll('.nav-tab').forEach((btn) => {
        btn.addEventListener('click', () => {
          navigateTo(btn.getAttribute('data-nav'));
        });
      });

      document.getElementById('brandHomeBtn').addEventListener('click', () => navigateTo('home'));
      document.getElementById('homeScanBtn').addEventListener('click', () => navigateTo('scanner'));
      document.getElementById('homeCardScanBtn').addEventListener('click', () => navigateTo('scanner'));
      document.getElementById('homeViewAllHistoryBtn').addEventListener('click', () => navigateTo('history'));

      // Home Paste QR Content action
      const triggerHomePasteDecode = () => {
        const pasteInput = document.getElementById('homePasteInput');
        if (pasteInput && pasteInput.value.trim()) {
          handleDecodedQR(pasteInput.value.trim(), 'Pasted QR Content');
          pasteInput.value = '';
        } else {
          showToast('Please paste a QR payload string to decode.');
        }
      };
      document.getElementById('homePasteDecodeBtn').addEventListener('click', triggerHomePasteDecode);
      document.getElementById('homePasteInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          triggerHomePasteDecode();
        }
      });

      // File upload triggers
      const fileInput = document.getElementById('globalQrFileInput');
      const triggerFileSelect = () => fileInput.click();
      document.getElementById('homeUploadBtn').addEventListener('click', triggerFileSelect);
      document.getElementById('dropzoneBrowseBtn').addEventListener('click', triggerFileSelect);
      document.getElementById('scannerGalleryBtn').addEventListener('click', triggerFileSelect);
      document.getElementById('scannerFallbackUploadBtn').addEventListener('click', triggerFileSelect);
      document.getElementById('resultsEmptyUploadBtn').addEventListener('click', triggerFileSelect);

      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        try {
          const payload = await decodeQRFromFile(file);
          handleDecodedQR(payload, 'Uploaded Image (' + file.name + ')');
        } catch (err) {
          showToast(err && err.message ? err.message : 'Could not decode QR image.');
        } finally {
          fileInput.value = '';
        }
      });

      // Drag and drop on home dropzone
      const dropzone = document.getElementById('homeDropzone');
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('border-sky-400');
      });
      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('border-sky-400');
      });
      dropzone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropzone.classList.remove('border-sky-400');
        const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (!file) return;
        try {
          const payload = await decodeQRFromFile(file);
          handleDecodedQR(payload, 'Dropped Image (' + file.name + ')');
        } catch (err) {
          showToast(err && err.message ? err.message : 'Could not decode dropped QR image.');
        }
      });

      // Scanner controls
      document.getElementById('scannerCancelTopBtn').addEventListener('click', () => navigateTo('home'));
      document.getElementById('scannerCancelBottomBtn').addEventListener('click', () => navigateTo('home'));
      document.getElementById('scannerRetryCameraBtn').addEventListener('click', () => startLiveCameraScanner(appSettings.preferredCameraId));
      document.getElementById('cameraDeviceSelect').addEventListener('change', (e) => {
        appSettings.preferredCameraId = e.target.value;
        saveSettingsState();
        startLiveCameraScanner(e.target.value);
      });
      document.getElementById('scannerTorchBtn').addEventListener('click', async () => {
        if (!activeStream) return;
        const track = activeStream.getVideoTracks()[0];
        if (!track) return;
        try {
          torchEnabled = !torchEnabled;
          await track.applyConstraints({ advanced: [{ torch: torchEnabled }] });
          document.getElementById('scannerTorchBtn').textContent = torchEnabled ? 'Flashlight: ON' : 'Flashlight: OFF';
        } catch (e) {
          showToast('Flashlight control not supported on this camera.');
        }
      });

      // Results controls
      document.getElementById('resultsEmptyScanBtn').addEventListener('click', () => navigateTo('scanner'));
      document.getElementById('resScanAnotherTopBtn').addEventListener('click', () => navigateTo('scanner'));
      document.getElementById('resScanAnotherBottomBtn').addEventListener('click', () => navigateTo('scanner'));

      document.getElementById('resTogglePasswordBtn').addEventListener('click', () => {
        isPasswordVisible = !isPasswordVisible;
        renderResultsPage();
      });

      document.getElementById('resCopyPasswordBtn').addEventListener('click', async () => {
        if (!currentResult || !currentResult.hasPasswordField || currentResult.password === null) return;
        const ok = await copyToClipboardSafe(currentResult.password);
        if (ok) showToast('Wi-Fi Password copied to clipboard!');
      });

      document.getElementById('resCopySsidBtn').addEventListener('click', async () => {
        if (!currentResult) return;
        const ok = await copyToClipboardSafe(currentResult.ssid);
        if (ok) showToast('SSID "' + currentResult.ssid + '" copied to clipboard!');
      });

      document.getElementById('resCopyAllBtn').addEventListener('click', async () => {
        if (!currentResult) return;
        const report = buildFormattedReport(currentResult);
        const ok = await copyToClipboardSafe(report);
        if (ok) showToast('All network information copied to clipboard!');
      });

      document.getElementById('resDownloadTxtBtn').addEventListener('click', () => {
        if (!currentResult) return;
        downloadReportFile(currentResult, 'txt');
        showToast('Downloaded decoded report (.txt)');
      });

      document.getElementById('resDownloadJsonBtn').addEventListener('click', () => {
        if (!currentResult) return;
        downloadReportFile(currentResult, 'json');
        showToast('Downloaded decoded JSON (.json)');
      });

      document.getElementById('manualDecodeBtn').addEventListener('click', () => {
        const input = document.getElementById('manualPayloadInput');
        if (input && input.value.trim()) {
          handleDecodedQR(input.value.trim(), 'Manual Payload Input');
          input.value = '';
        } else {
          showToast('Please enter a QR payload string to decode.');
        }
      });

      // History controls
      document.getElementById('historySearchInput').addEventListener('input', () => renderHistoryViews());
      document.getElementById('historyToggleCheckbox').addEventListener('change', (e) => {
        appSettings.historyEnabled = e.target.checked;
        saveSettingsState();
        showToast(appSettings.historyEnabled ? 'Scan history enabled.' : 'Scan history paused.');
      });
      document.getElementById('historyClearAllBtn').addEventListener('click', () => {
        document.getElementById('historyClearModal').classList.remove('hidden');
      });
      document.getElementById('historyCancelClearBtn').addEventListener('click', () => {
        document.getElementById('historyClearModal').classList.add('hidden');
      });
      document.getElementById('historyConfirmClearBtn').addEventListener('click', () => {
        scanHistory = [];
        saveHistoryState();
        document.getElementById('historyClearModal').classList.add('hidden');
        showToast('Cleared all scan history.');
      });

      // Settings controls
      document.querySelectorAll('.theme-card').forEach((btn) => {
        btn.addEventListener('click', () => {
          appSettings.accentTheme = btn.getAttribute('data-theme-choice');
          saveSettingsState();
          showToast('Theme updated.');
        });
      });
      document.getElementById('settingsMaskCheckbox').addEventListener('change', (e) => {
        appSettings.autoMaskPassword = e.target.checked;
        saveSettingsState();
      });
      document.getElementById('settingsHistoryCheckbox').addEventListener('change', (e) => {
        appSettings.historyEnabled = e.target.checked;
        saveSettingsState();
      });
      document.getElementById('settingsWipeDataBtn').addEventListener('click', () => {
        document.getElementById('settingsWipeConfirmBox').classList.remove('hidden');
      });
      document.getElementById('settingsCancelWipeBtn').addEventListener('click', () => {
        document.getElementById('settingsWipeConfirmBox').classList.add('hidden');
      });
      document.getElementById('settingsConfirmWipeBtn').addEventListener('click', () => {
        scanHistory = [];
        appSettings = {
          historyEnabled: true,
          autoMaskPassword: false,
          accentTheme: 'electric-blue',
          preferredCameraId: ''
        };
        try {
          localStorage.removeItem(STORAGE_KEYS.HISTORY);
          localStorage.removeItem(STORAGE_KEYS.SETTINGS);
        } catch (e) {}
        applySettingsToUI();
        renderHistoryViews();
        document.getElementById('settingsWipeConfirmBox').classList.add('hidden');
        showToast('All local data and preferences have been cleared.');
      });
    });
