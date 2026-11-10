// =========================================================================
// ZIP QR — Wi-Fi QR Decoder — Production Client-Side Offline-Ready Runtime (v4.1)
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
 * ZIP QR — Wi-Fi QR Decoder — Advanced Multi-Stage Local QR Code Recognition Engine (v4.0)
 *
 * Performs 100% client-side QR code decoding from:
 * 1. Live camera `<video>` frames (via `requestVideoFrameCallback` + ROI cropping + non-blocking lock)
 * 2. Uploaded PNG, JPG/JPEG, and WEBP image files (including multi-QR detection inside one image)
 * 3. Canvas `ImageData` buffers
 *
 * Progressive Multi-Stage Recognition Pipeline (Fastest & Least Destructive First):
 * - Stage 0: Native `BarcodeDetector` API (hardware-accelerated when supported on Chrome/Edge/Android/macOS)
 * - Stage 1: `jsQR` (with `inversionAttempts: 'attemptBoth'`)
 * - Stage 2: Fast Global Mid-Luminance Threshold + Tight Bounding-Box Grid Sampling + 4-Orientation Matrix Rotation
 * - Stage 3: Inverted Global Polarity Recovery (light QR on dark background)
 * - Stage 4: Percentile Histogram Contrast Stretch (1st–99th percentile normalization) + 3x3 Unsharp/Laplacian Sharpening
 *            for low-contrast or blurry QR images
 * - Stage 5: Multi-Threshold Integral-Image Adaptive Binarization (`binarizeAdaptive` with multiple bias levels) +
 *            1:1:3:1:1 Finder Pattern Triad Localization (`locateFinderBoundingBox`) +
 *            Exact Reed-Solomon GF(256) Berlekamp-Massey / Chien / Forney Error Correction
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

// RS Block Table for Versions 1..15 across Error Correction Levels [L, M, Q, H]
const RS_BLOCK_TABLE = [[], [[1, 26, 19], [1, 26, 16], [1, 26, 13], [1, 26, 9]], [[1, 44, 34], [1, 44, 28], [1, 44, 22], [1, 44, 16]], [[1, 70, 55], [1, 70, 44], [2, 35, 17], [2, 35, 13]], [[1, 100, 80], [2, 50, 32], [2, 50, 24], [4, 25, 9]], [[1, 134, 108], [2, 67, 43], [2, 33, 15, 2, 34, 16], [2, 33, 11, 2, 34, 12]], [[2, 86, 68], [4, 43, 27], [4, 43, 19], [4, 43, 15]], [[2, 98, 78], [4, 49, 31], [2, 32, 14, 4, 33, 15], [4, 39, 13, 1, 40, 14]], [[2, 121, 97], [2, 60, 38, 2, 61, 39], [4, 40, 18, 2, 41, 19], [4, 40, 14, 2, 41, 15]], [[2, 146, 116], [3, 58, 36, 2, 59, 37], [4, 36, 16, 4, 37, 17], [4, 36, 12, 4, 37, 13]], [[2, 86, 68, 2, 87, 69], [4, 69, 43, 1, 70, 44], [6, 43, 19, 2, 44, 20], [6, 43, 15, 2, 44, 16]], [[4, 101, 81], [1, 80, 50, 4, 81, 51], [4, 50, 22, 4, 51, 23], [3, 36, 12, 8, 37, 13]], [[2, 116, 92, 2, 117, 93], [6, 58, 36, 2, 59, 37], [4, 46, 20, 6, 47, 21], [7, 42, 14, 4, 43, 15]], [[4, 133, 107], [8, 59, 37, 1, 60, 38], [8, 44, 20, 4, 45, 21], [12, 33, 11, 4, 34, 12]], [[3, 145, 115, 1, 146, 116], [4, 64, 40, 5, 65, 41], [11, 36, 16, 5, 37, 17], [11, 36, 12, 5, 37, 13]], [[5, 109, 87, 1, 110, 88], [5, 65, 41, 5, 66, 42], [5, 54, 24, 7, 55, 25], [11, 36, 12]]];
const FORMAT_INFO_TABLE = [[0x77c4, 0, 0], [0x72f3, 0, 1], [0x7daa, 0, 2], [0x789d, 0, 3], [0x662f, 0, 4], [0x6318, 0, 5], [0x6c41, 0, 6], [0x6976, 0, 7], [0x5412, 1, 0], [0x5125, 1, 1], [0x5e7c, 1, 2], [0x5b4b, 1, 3], [0x45f9, 1, 4], [0x40ce, 1, 5], [0x4f97, 1, 6], [0x4aa0, 1, 7], [0x355f, 2, 0], [0x3068, 2, 1], [0x3f31, 2, 2], [0x3a06, 2, 3], [0x24b4, 2, 4], [0x2183, 2, 5], [0x2eda, 2, 6], [0x2bed, 2, 7], [0x1689, 3, 0], [0x13be, 3, 1], [0x1ce7, 3, 2], [0x19d0, 3, 3], [0x0762, 3, 4], [0x0255, 3, 5], [0x0d0c, 3, 6], [0x083b, 3, 7]];
function popcount16(x) {
  let c = 0;
  while (x) {
    c += x & 1;
    x >>>= 1;
  }
  return c;
}
function decodeFormatInfo(fmtBits1, fmtBits2) {
  let bestDist = 4;
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
 * Exact Reed-Solomon error correction for a single block (Berlekamp-Massey + Chien + Forney + post-correction syndrome verification)
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
  let C = new Uint8Array(ecLength + 1);
  let B = new Uint8Array(ecLength + 1);
  C[0] = 1;
  B[0] = 1;
  let L = 0;
  let m = 1;
  let b = 1;
  for (let r = 0; r < ecLength; r++) {
    let d = syndromes[r];
    for (let i = 1; i <= L; i++) {
      d ^= gfMul(C[i], syndromes[r - i]);
    }
    if (d === 0) {
      m++;
    } else if (2 * L <= r) {
      const T = new Uint8Array(C);
      const scale = gfDiv(d, b);
      for (let i = 0; i + m <= ecLength; i++) {
        C[i + m] ^= gfMul(scale, B[i]);
      }
      L = r + 1 - L;
      B = T;
      b = d;
      m = 1;
    } else {
      const scale = gfDiv(d, b);
      for (let i = 0; i + m <= ecLength; i++) {
        C[i + m] ^= gfMul(scale, B[i]);
      }
      m++;
    }
  }
  if (L * 2 > ecLength) return null;
  const sigma = C.slice(0, L + 1);
  const errorLocations = [];
  for (let i = 0; i < n; i++) {
    const xInv = GF_EXP[(255 - i) % 255];
    let val = 0;
    let xPow = 1;
    for (let j = 0; j <= L; j++) {
      val ^= gfMul(sigma[j], xPow);
      xPow = gfMul(xPow, xInv);
    }
    if (val === 0) {
      errorLocations.push(n - 1 - i);
    }
  }
  if (errorLocations.length !== L) return null;
  const omega = new Uint8Array(ecLength);
  for (let i = 0; i < ecLength; i++) {
    let sum = 0;
    for (let j = 0; j <= i && j <= L; j++) {
      sum ^= gfMul(syndromes[i - j], sigma[j]);
    }
    omega[i] = sum;
  }
  const corrected = new Uint8Array(codewords);
  for (const pos of errorLocations) {
    const power = n - 1 - pos;
    const xk = GF_EXP[power % 255];
    const xInv = GF_EXP[(255 - power % 255) % 255];
    let num = 0;
    let xPow = 1;
    for (let j = 0; j < ecLength; j++) {
      num ^= gfMul(omega[j], xPow);
      xPow = gfMul(xPow, xInv);
    }
    let den = 0;
    let xInvSqPow = 1;
    const xInvSq = gfMul(xInv, xInv);
    for (let j = 1; j <= L; j += 2) {
      den ^= gfMul(sigma[j], xInvSqPow);
      xInvSqPow = gfMul(xInvSqPow, xInvSq);
    }
    if (den === 0) return null;
    const errMag = gfMul(xk, gfDiv(num, den));
    corrected[pos] ^= errMag;
  }
  for (let i = 0; i < ecLength; i++) {
    let sum = 0;
    const alphaI = GF_EXP[i];
    for (let j = 0; j < n; j++) {
      sum = gfMul(sum, alphaI) ^ corrected[j];
    }
    if (sum !== 0) return null;
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
  for (let i = 0; i < size; i++) {
    reserved[6][i] = true;
    reserved[i][6] = true;
  }
  const alignCoords = ALIGNMENT_PATTERNS[version] || [];
  for (const r of alignCoords) {
    for (const c of alignCoords) {
      if (r <= 8 && c <= 8 || r <= 8 && c >= size - 8 || r >= size - 8 && c <= 8) {
        continue;
      }
      markRect(r - 2, c - 2, 5, 5);
    }
  }
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
          fatal: true
        }).decode(new Uint8Array(byteChunks));
      } catch {
        return false;
      }
      byteChunks.length = 0;
    }
    return true;
  };
  while (totalBits - bitOffset >= 4) {
    const mode = readBits(4);
    if (mode === 0) break;
    if (mode === 7) {
      readBits(8);
      continue;
    }
    if (mode === 4) {
      const count = readBits(getCountBits(4, version));
      if (count * 8 > totalBits - bitOffset) return null;
      for (let i = 0; i < count; i++) {
        byteChunks.push(readBits(8));
      }
      if (!flushBytes()) return null;
    } else if (mode === 2) {
      if (!flushBytes()) return null;
      let count = readBits(getCountBits(2, version));
      while (count > 1) {
        if (totalBits - bitOffset < 11) return null;
        const pair = readBits(11);
        output += ALPHANUMERIC_CHARS[Math.floor(pair / 45)] || '';
        output += ALPHANUMERIC_CHARS[pair % 45] || '';
        count -= 2;
      }
      if (count === 1) {
        if (totalBits - bitOffset < 6) return null;
        const single = readBits(6);
        output += ALPHANUMERIC_CHARS[single] || '';
      }
    } else if (mode === 1) {
      if (!flushBytes()) return null;
      let count = readBits(getCountBits(1, version));
      while (count >= 3) {
        if (totalBits - bitOffset < 10) return null;
        const triple = readBits(10);
        output += triple.toString().padStart(3, '0');
        count -= 3;
      }
      if (count === 2) {
        if (totalBits - bitOffset < 7) return null;
        const pair = readBits(7);
        output += pair.toString().padStart(2, '0');
      } else if (count === 1) {
        if (totalBits - bitOffset < 4) return null;
        const single = readBits(4);
        output += single.toString();
      }
    } else {
      break;
    }
  }
  if (!flushBytes()) return null;
  return output.length > 0 ? output : null;
}

/**
 * Rotates a boolean square matrix 90 degrees clockwise
 */
function rotateMatrix90(matrix) {
  const N = matrix.length;
  const out = Array.from({
    length: N
  }, () => Array(N).fill(false));
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      out[c][N - 1 - r] = matrix[r][c];
    }
  }
  return out;
}

/**
 * Checks whether a 7x7 corner of a sampled matrix looks like a QR Finder Pattern
 */
function hasFinderAtCorner(matrix, r0, c0) {
  const N = matrix.length;
  if (r0 + 6 >= N || c0 + 6 >= N) return false;
  let centerDark = 0;
  for (let r = r0 + 2; r <= r0 + 4; r++) {
    for (let c = c0 + 2; c <= c0 + 4; c++) {
      if (matrix[r][c]) centerDark++;
    }
  }
  if (centerDark < 6) return false;
  if (matrix[r0 + 1][c0 + 1] && matrix[r0 + 1][c0 + 5] && matrix[r0 + 5][c0 + 1]) return false;
  return true;
}

/**
 * Decodes a sampled boolean QR module grid (N x N where N = version*4 + 17)
 */
function decodeQRModuleMatrix(matrix) {
  const size = matrix.length;
  if (size < 21 || (size - 17) % 4 !== 0) return null;
  const version = (size - 17) / 4;
  if (version < 1 || version >= RS_BLOCK_TABLE.length) return null;
  let fmt1 = 0;
  let fmt1Rev = 0;
  const fmt1Coords = [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]];
  for (let i = 0; i < 15; i++) {
    const [r, c] = fmt1Coords[i];
    if (matrix[r][c]) {
      fmt1 |= 1 << 14 - i;
      fmt1Rev |= 1 << i;
    }
  }
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
  const seen = new Set();
  const addCand = (ecIndex, mask) => {
    const k = `${ecIndex}:${mask}`;
    if (!seen.has(k)) {
      seen.add(k);
      candidates.push({
        ecIndex,
        mask
      });
    }
  };
  const m1 = decodeFormatInfo(fmt1, fmt2);
  if (m1) addCand(m1.ecIndex, m1.mask);
  const m2 = decodeFormatInfo(fmt1Rev, fmt2Rev);
  if (m2) addCand(m2.ecIndex, m2.mask);
  if (candidates.length === 0) {
    for (let ecIndex = 0; ecIndex < 4; ecIndex++) {
      for (let mask = 0; mask < 8; mask++) {
        addCand(ecIndex, mask);
      }
    }
  }
  const reserved = buildFunctionModuleMap(version);
  for (const {
    ecIndex,
    mask
  } of candidates) {
    const rsSpec = RS_BLOCK_TABLE[version][ecIndex];
    if (!rsSpec) continue;
    const bits = [];
    let row = size - 1;
    let inc = -1;
    for (let col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--;
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
 * Percentile contrast normalization + 3x3 unsharp Laplacian kernel for blurry or low-contrast QR codes
 */
function enhanceAndSharpenGray(gray, width, height) {
  const hist = new Uint32Array(256);
  const total = width * height;
  for (let i = 0; i < total; i++) hist[gray[i]]++;
  const lowTarget = Math.floor(total * 0.02);
  const highTarget = Math.floor(total * 0.98);
  let acc = 0;
  let pLow = 0;
  let pHigh = 255;
  for (let i = 0; i < 256; i++) {
    acc += hist[i];
    if (acc >= lowTarget) {
      pLow = i;
      break;
    }
  }
  acc = 0;
  for (let i = 255; i >= 0; i--) {
    acc += hist[i];
    if (acc >= total - highTarget) {
      pHigh = i;
      break;
    }
  }
  const span = Math.max(1, pHigh - pLow);
  const stretched = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    const v = (gray[i] - pLow) * 255 / span;
    stretched[i] = v <= 0 ? 0 : v >= 255 ? 255 : v | 0;
  }

  // Apply 3x3 sharpening kernel: [0, -1, 0, -1, 5, -1, 0, -1, 0]
  const out = new Uint8Array(stretched);
  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    for (let x = 1; x < width - 1; x++) {
      const idx = row + x;
      const val = 5 * stretched[idx] - stretched[idx - 1] - stretched[idx + 1] - stretched[idx - width] - stretched[idx + width];
      out[idx] = val <= 0 ? 0 : val >= 255 ? 255 : val;
    }
  }
  return out;
}

/**
 * Computes an integral image and performs fast Bradley-Roth local adaptive thresholding
 * to handle low-light gradients, shadows, and uneven illumination.
 */
function binarizeAdaptive(gray, width, height, invert = false, bias = 5) {
  const integral = new Int32Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    const yOff = y * width;
    const intRowOff = (y + 1) * (width + 1);
    const intPrevOff = y * (width + 1);
    for (let x = 0; x < width; x++) {
      rowSum += gray[yOff + x];
      integral[intRowOff + x + 1] = integral[intPrevOff + x + 1] + rowSum;
    }
  }
  const bin = new Uint8Array(width * height);
  const radius = Math.max(8, Math.floor(Math.min(width, height) / 10));
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height - 1, y + radius);
    const r0 = y0 * (width + 1);
    const r1 = (y1 + 1) * (width + 1);
    const yOff = y * width;
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width - 1, x + radius);
      const area = (x1 - x0 + 1) * (y1 - y0 + 1);
      const sum = integral[r1 + x1 + 1] - integral[r0 + x1 + 1] - integral[r1 + x0] + integral[r0 + x0];
      const localMean = sum / area;
      const isDark = gray[yOff + x] < localMean - bias;
      bin[yOff + x] = (invert ? !isDark : isDark) ? 1 : 0;
    }
  }
  return bin;
}

/**
 * Scans rows for 1:1:3:1:1 QR finder pattern runs and verifies vertical 1:1:3:1:1 symmetry
 * to isolate the true QR code bounding box even when background clutter exists in the camera frame.
 */
function locateFinderBoundingBox(bin, width, height) {
  const centers = [];
  const checkRatio = counts => {
    const total = counts[0] + counts[1] + counts[2] + counts[3] + counts[4];
    if (total < 7) return false;
    const mod = total / 7;
    const tol = mod * 0.65;
    return Math.abs(counts[0] - mod) <= tol && Math.abs(counts[1] - mod) <= tol && Math.abs(counts[2] - 3 * mod) <= 3 * tol && Math.abs(counts[3] - mod) <= tol && Math.abs(counts[4] - mod) <= tol;
  };
  const verifyVertical = (cx, yStart, maxModule) => {
    const x = Math.round(cx);
    if (x < 0 || x >= width || !bin[yStart * width + x]) return null;
    const counts = [0, 0, 0, 0, 0];
    let y = yStart;
    while (y >= 0 && bin[y * width + x]) {
      counts[2]++;
      y--;
    }
    if (y < 0) return null;
    while (y >= 0 && !bin[y * width + x] && counts[1] <= maxModule * 3) {
      counts[1]++;
      y--;
    }
    if (y < 0 || counts[1] > maxModule * 3) return null;
    while (y >= 0 && bin[y * width + x] && counts[0] <= maxModule * 3) {
      counts[0]++;
      y--;
    }
    y = yStart + 1;
    while (y < height && bin[y * width + x]) {
      counts[2]++;
      y++;
    }
    if (y >= height) return null;
    while (y < height && !bin[y * width + x] && counts[3] <= maxModule * 3) {
      counts[3]++;
      y++;
    }
    if (y >= height || counts[3] > maxModule * 3) return null;
    while (y < height && bin[y * width + x] && counts[4] <= maxModule * 3) {
      counts[4]++;
      y++;
    }
    if (!checkRatio(counts)) return null;
    const vSpan = counts[0] + counts[1] + counts[2] + counts[3] + counts[4];
    const cy = y - vSpan / 2;
    return {
      cy,
      vSpan
    };
  };
  const stepY = Math.max(1, Math.floor(height / 160));
  for (let y = 0; y < height; y += stepY) {
    const rowOff = y * width;
    const counts = [0, 0, 0, 0, 0];
    let state = 0;
    for (let x = 0; x < width; x++) {
      const isDark = bin[rowOff + x] === 1;
      if (isDark) {
        if (state === 1 || state === 3) state++;
        counts[state]++;
      } else {
        if (state === 0 && counts[0] === 0) continue;
        if (state === 1 || state === 3) {
          counts[state]++;
        } else if (state === 0 || state === 2) {
          state++;
          counts[state] = 1;
        } else if (state === 4) {
          if (checkRatio(counts)) {
            const hSpan = counts[0] + counts[1] + counts[2] + counts[3] + counts[4];
            const cx = x - hSpan / 2;
            const vCheck = verifyVertical(cx, y, hSpan);
            if (vCheck && Math.abs(vCheck.vSpan - hSpan) <= Math.max(hSpan, vCheck.vSpan) * 0.4) {
              const span = (hSpan + vCheck.vSpan) / 2;
              const existing = centers.find(c => Math.hypot(c.cx - cx, c.cy - vCheck.cy) < span * 0.6);
              if (!existing) {
                centers.push({
                  cx,
                  cy: vCheck.cy,
                  span
                });
              }
            }
          }
          counts[0] = counts[2];
          counts[1] = counts[3];
          counts[2] = counts[4];
          counts[3] = 1;
          counts[4] = 0;
          state = 3;
        }
      }
    }
  }
  if (centers.length < 3) return null;
  centers.sort((a, b) => b.span - a.span);
  const refSpan = centers[0].span;
  const cluster = centers.filter(c => Math.abs(c.span - refSpan) <= refSpan * 0.45);
  if (cluster.length < 3) return null;
  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;
  let spanSum = 0;
  for (const c of cluster) {
    const half = c.span / 2;
    if (c.cx - half < minX) minX = Math.max(0, Math.floor(c.cx - half));
    if (c.cx + half > maxX) maxX = Math.min(width - 1, Math.ceil(c.cx + half));
    if (c.cy - half < minY) minY = Math.max(0, Math.floor(c.cy - half));
    if (c.cy + half > maxY) maxY = Math.min(height - 1, Math.ceil(c.cy + half));
    spanSum += c.span;
  }
  const rMinX = Math.max(0, minX - 2);
  const rMaxX = Math.min(width - 1, maxX + 2);
  const rMinY = Math.max(0, minY - 2);
  const rMaxY = Math.min(height - 1, maxY + 2);
  let tightMinX = rMaxX;
  let tightMaxX = rMinX;
  let tightMinY = rMaxY;
  let tightMaxY = rMinY;
  for (let y = rMinY; y <= rMaxY; y++) {
    const rowOff = y * width;
    for (let x = rMinX; x <= rMaxX; x++) {
      if (bin[rowOff + x] === 1) {
        if (x < tightMinX) tightMinX = x;
        if (x > tightMaxX) tightMaxX = x;
        if (y < tightMinY) tightMinY = y;
        if (y > tightMaxY) tightMaxY = y;
      }
    }
  }
  if (tightMaxX <= tightMinX || tightMaxY <= tightMinY) return null;
  return {
    minX: tightMinX,
    maxX: tightMaxX,
    minY: tightMinY,
    maxY: tightMaxY,
    avgFinderSpan: spanSum / cluster.length
  };
}

/**
 * Samples a binary image inside a bounding box across candidate QR versions and all 4 90-degree orientations
 */
function sampleAndDecodeBoundingBox(bin, width, height, minX, maxX, minY, maxY, hintFinderSpan) {
  const boxW = maxX - minX + 1;
  const boxH = maxY - minY + 1;
  if (boxW < 21 || boxH < 21) return null;
  const candidateVersions = new Set();
  if (hintFinderSpan && hintFinderSpan >= 7) {
    const estMod = hintFinderSpan / 7;
    const estCount = Math.round((boxW + boxH) / 2 / estMod);
    const estVer = Math.round((estCount - 17) / 4);
    for (let dv = -1; dv <= 1; dv++) {
      if (estVer + dv >= 1 && estVer + dv <= 15) candidateVersions.add(estVer + dv);
    }
  }
  let topRun = 0;
  for (let x = minX; x <= maxX; x++) {
    if (bin[minY * width + x] === 1) topRun++;else if (topRun > 0) break;
  }
  if (topRun >= 7) {
    const estMod = topRun / 7;
    const estCount = Math.round((boxW + boxH) / 2 / estMod);
    const estVer = Math.round((estCount - 17) / 4);
    for (let dv = -1; dv <= 1; dv++) {
      if (estVer + dv >= 1 && estVer + dv <= 15) candidateVersions.add(estVer + dv);
    }
  }
  for (let v = 1; v <= 15; v++) candidateVersions.add(v);
  for (const v of candidateVersions) {
    const N = v * 4 + 17;
    const stepX = boxW / N;
    const stepY = boxH / N;
    if (stepX < 0.8 || stepY < 0.8) continue;
    const baseMatrix = Array.from({
      length: N
    }, () => Array(N).fill(false));
    for (let r = 0; r < N; r++) {
      const sampleY = Math.min(height - 1, Math.max(0, Math.floor(minY + (r + 0.5) * stepY)));
      const rowOff = sampleY * width;
      for (let c = 0; c < N; c++) {
        const sampleX = Math.min(width - 1, Math.max(0, Math.floor(minX + (c + 0.5) * stepX)));
        baseMatrix[r][c] = bin[rowOff + sampleX] === 1;
      }
    }
    let rot = baseMatrix;
    for (let angle = 0; angle < 4; angle++) {
      if (angle > 0) rot = rotateMatrix90(rot);
      if (hasFinderAtCorner(rot, 0, 0) && hasFinderAtCorner(rot, 0, N - 7) && hasFinderAtCorner(rot, N - 7, 0)) {
        const decoded = decodeQRModuleMatrix(rot);
        if (decoded) return decoded;
      }
    }
  }
  return null;
}

/**
 * Extracts and decodes a QR code from an `ImageData` buffer using a progressive multi-stage pipeline:
 * - Stage 1: Global `jsQR` (with `inversionAttempts: 'attemptBoth'`) if available in browser
 * - Stage 2: Fast global mid-luminance threshold + tight bounding box + 4-orientation matrix decoder
 * - Stage 3: Inverted global polarity (white QR on dark background)
 * - Stage 4: Integral-image local adaptive thresholding + 1:1:3:1:1 finder pattern localization
 * - Stage 5: Percentile contrast stretch + 3x3 sharpening + multi-threshold adaptive recovery
 */
function extractAndDecodeFromImageData(imageData) {
  const {
    data,
    width,
    height
  } = imageData;
  if (width < 21 || height < 21) return null;

  // Stage 1: Global jsQR (when loaded)
  const globalWindow = typeof window !== 'undefined' ? window : {};
  if (typeof globalWindow.jsQR === 'function') {
    try {
      const res = globalWindow.jsQR(data, width, height, {
        inversionAttempts: 'attemptBoth'
      });
      if (res && res.data) return res.data;
    } catch {
      // Continue to built-in multi-stage engine
    }
  }

  // Convert RGBA to 8-bit luminance
  const totalPixels = width * height;
  const gray = new Uint8Array(totalPixels);
  let minLum = 255;
  let maxLum = 0;
  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const alpha = data[idx + 3];
    const lum = alpha < 128 ? 255 : 77 * data[idx] + 150 * data[idx + 1] + 29 * data[idx + 2] >> 8;
    gray[i] = lum;
    if (lum < minLum) minLum = lum;
    if (lum > maxLum) maxLum = lum;
  }
  if (maxLum - minLum < 8) return null;
  const midThreshold = minLum + maxLum >> 1;

  // Stage 2: Fast Global Threshold (Normal Polarity)
  const binNormal = new Uint8Array(totalPixels);
  let minX = width,
    maxX = -1,
    minY = height,
    maxY = -1;
  for (let y = 0; y < height; y++) {
    const rowOff = y * width;
    for (let x = 0; x < width; x++) {
      if (gray[rowOff + x] < midThreshold) {
        binNormal[rowOff + x] = 1;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX > minX && maxY > minY) {
    const fastRes = sampleAndDecodeBoundingBox(binNormal, width, height, minX, maxX, minY, maxY);
    if (fastRes) return fastRes;
    const finderBox = locateFinderBoundingBox(binNormal, width, height);
    if (finderBox) {
      const locRes = sampleAndDecodeBoundingBox(binNormal, width, height, finderBox.minX, finderBox.maxX, finderBox.minY, finderBox.maxY, finderBox.avgFinderSpan);
      if (locRes) return locRes;
    }
  }

  // Stage 3: Inverted Polarity (Light QR on Dark Background)
  const binInverted = new Uint8Array(totalPixels);
  let invMinX = width,
    invMaxX = -1,
    invMinY = height,
    invMaxY = -1;
  for (let y = 0; y < height; y++) {
    const rowOff = y * width;
    for (let x = 0; x < width; x++) {
      if (gray[rowOff + x] > midThreshold) {
        binInverted[rowOff + x] = 1;
        if (x < invMinX) invMinX = x;
        if (x > invMaxX) invMaxX = x;
        if (y < invMinY) invMinY = y;
        if (y > invMaxY) invMaxY = y;
      }
    }
  }
  if (invMaxX > invMinX && invMaxY > invMinY) {
    const invRes = sampleAndDecodeBoundingBox(binInverted, width, height, invMinX, invMaxX, invMinY, invMaxY);
    if (invRes) return invRes;
  }

  // Stage 4: Integral-Image Local Adaptive Thresholding (Low-Light, Uneven Gradients, Shadows)
  const binAdaptive = binarizeAdaptive(gray, width, height, false, 5);
  const adapFinderBox = locateFinderBoundingBox(binAdaptive, width, height);
  if (adapFinderBox) {
    const adapRes = sampleAndDecodeBoundingBox(binAdaptive, width, height, adapFinderBox.minX, adapFinderBox.maxX, adapFinderBox.minY, adapFinderBox.maxY, adapFinderBox.avgFinderSpan);
    if (adapRes) return adapRes;
  }
  let aMinX = width,
    aMaxX = -1,
    aMinY = height,
    aMaxY = -1;
  for (let y = 0; y < height; y++) {
    const rowOff = y * width;
    for (let x = 0; x < width; x++) {
      if (binAdaptive[rowOff + x] === 1) {
        if (x < aMinX) aMinX = x;
        if (x > aMaxX) aMaxX = x;
        if (y < aMinY) aMinY = y;
        if (y > aMaxY) aMaxY = y;
      }
    }
  }
  if (aMaxX > aMinX && aMaxY > aMinY) {
    const adapFallback = sampleAndDecodeBoundingBox(binAdaptive, width, height, aMinX, aMaxX, aMinY, aMaxY);
    if (adapFallback) return adapFallback;
  }

  // Stage 5: Percentile Contrast Stretch + 3x3 Sharpening + Alternative Adaptive Threshold
  const sharpened = enhanceAndSharpenGray(gray, width, height);
  const binSharpened = binarizeAdaptive(sharpened, width, height, false, 8);
  const sharpFinder = locateFinderBoundingBox(binSharpened, width, height);
  if (sharpFinder) {
    const sharpRes = sampleAndDecodeBoundingBox(binSharpened, width, height, sharpFinder.minX, sharpFinder.maxX, sharpFinder.minY, sharpFinder.maxY, sharpFinder.avgFinderSpan);
    if (sharpRes) return sharpRes;
  }
  return null;
}

/**
 * Detects ALL distinct QR codes present inside an `ImageData` buffer (e.g. side-by-side or stacked QR codes
 * in an uploaded screenshot or comparison sheet).
 */
function extractAllQRCodesFromImageData(imageData) {
  const results = [];
  const addUnique = val => {
    if (val && !results.includes(val)) {
      results.push(val);
    }
  };

  // 1. Try whole image first
  const primary = extractAndDecodeFromImageData(imageData);
  addUnique(primary);
  const {
    data,
    width,
    height
  } = imageData;
  if (width >= 48 && height >= 48) {
    // 2. Check left & right halves if image is wide enough to hold side-by-side QR codes
    const midX = Math.floor(width / 2);
    const cropRegion = (x0, y0, rw, rh) => {
      const buf = new Uint8ClampedArray(rw * rh * 4);
      for (let y = 0; y < rh; y++) {
        const srcStart = ((y0 + y) * width + x0) * 4;
        buf.set(data.subarray(srcStart, srcStart + rw * 4), y * rw * 4);
      }
      return {
        data: buf,
        width: rw,
        height: rh
      };
    };
    if (midX >= 25) {
      addUnique(extractAndDecodeFromImageData(cropRegion(0, 0, midX, height)));
      addUnique(extractAndDecodeFromImageData(cropRegion(midX, 0, width - midX, height)));
    }

    // 3. Check top & bottom halves if image is tall enough to hold stacked QR codes
    const midY = Math.floor(height / 2);
    if (midY >= 25) {
      addUnique(extractAndDecodeFromImageData(cropRegion(0, 0, width, midY)));
      addUnique(extractAndDecodeFromImageData(cropRegion(0, midY, width, height - midY)));
    }
  }
  return results;
}

// Reusable singleton BarcodeDetector & reusable offscreen canvas to avoid per-frame GC allocations
let cachedBarcodeDetector = null;
let barcodeDetectorChecked = false;
let sharedDecodeCanvas = null;
function getSharedCanvas() {
  if (!sharedDecodeCanvas) {
    sharedDecodeCanvas = document.createElement('canvas');
  }
  return sharedDecodeCanvas;
}
function getBarcodeDetector() {
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    if (!barcodeDetectorChecked) {
      barcodeDetectorChecked = true;
      try {
        const BarcodeDetectorCtor = window.BarcodeDetector;
        cachedBarcodeDetector = new BarcodeDetectorCtor({
          formats: ['qr_code']
        });
      } catch {
        cachedBarcodeDetector = null;
      }
    }
  }
  return cachedBarcodeDetector;
}

/**
 * Decodes a QR code from an `HTMLImageElement`, `HTMLVideoElement`, or `HTMLCanvasElement`
 * using a fast ROI-first strategy for live video frames and multi-scale recovery for uploaded images.
 */
async function decodeQRFromSource(source) {
  const detector = getBarcodeDetector();
  if (detector) {
    try {
      const results = await detector.detect(source);
      if (results && results.length > 0 && results[0].rawValue) {
        return results[0].rawValue;
      }
    } catch {
      // Fall through to canvas decoder
    }
  }
  const canvas = getSharedCanvas();
  let w = 0;
  let h = 0;
  const isVideo = typeof HTMLVideoElement !== 'undefined' && source instanceof HTMLVideoElement;
  if (isVideo) {
    w = source.videoWidth;
    h = source.videoHeight;
  } else if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement) {
    w = source.naturalWidth || source.width;
    h = source.naturalHeight || source.height;
  } else {
    w = source.width;
    h = source.height;
  }
  if (w <= 0 || h <= 0) return null;
  const ctx = canvas.getContext('2d', {
    willReadFrequently: true
  });
  if (!ctx) return null;

  // For live video frames: fast center Region-of-Interest (ROI) pass at 420x420 first (~2–4ms)
  if (isVideo) {
    const minDim = Math.min(w, h);
    const cropSize = Math.floor(minDim * 0.78);
    const sx = Math.floor((w - cropSize) / 2);
    const sy = Math.floor((h - cropSize) / 2);
    const roiTarget = Math.min(420, cropSize);
    canvas.width = roiTarget;
    canvas.height = roiTarget;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, sx, sy, cropSize, cropSize, 0, 0, roiTarget, roiTarget);
    const roiData = ctx.getImageData(0, 0, roiTarget, roiTarget);
    const roiDecoded = extractAndDecodeFromImageData(roiData);
    if (roiDecoded) return roiDecoded;

    // Full-frame fallback at 560px max dimension
    const scale = Math.min(1, 560 / Math.max(w, h));
    const fw = Math.max(21, Math.round(w * scale));
    const fh = Math.max(21, Math.round(h * scale));
    canvas.width = fw;
    canvas.height = fh;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, 0, 0, fw, fh);
    return extractAndDecodeFromImageData(ctx.getImageData(0, 0, fw, fh));
  }

  // For uploaded static images: multi-scale + rotation recovery
  const maxDim = Math.max(w, h);
  const scales = maxDim < 180 ? [2.0, 1.0] : [Math.min(1, 900 / maxDim), Math.min(1, 512 / maxDim)];
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
 * Decodes all QR codes present in an uploaded image element or canvas
 */
async function decodeAllQRCodesFromSource(source) {
  const unique = [];
  const add = val => {
    if (val && !unique.includes(val)) unique.push(val);
  };
  const detector = getBarcodeDetector();
  if (detector) {
    try {
      const results = await detector.detect(source);
      if (results && results.length > 0) {
        for (const r of results) add(r.rawValue);
      }
    } catch {
      // ignore
    }
  }
  const canvas = getSharedCanvas();
  const w = typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement ? source.naturalWidth || source.width : source.width;
  const h = typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement ? source.naturalHeight || source.height : source.height;
  if (w > 0 && h > 0) {
    const ctx = canvas.getContext('2d', {
      willReadFrequently: true
    });
    if (ctx) {
      const maxDim = Math.max(w, h);
      const scale = maxDim < 180 ? 2.0 : Math.min(1, 900 / maxDim);
      const sw = Math.max(21, Math.round(w * scale));
      const sh = Math.max(21, Math.round(h * scale));
      canvas.width = sw;
      canvas.height = sh;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, sw, sh);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(source, 0, 0, sw, sh);
      const imgData = ctx.getImageData(0, 0, sw, sh);
      for (const found of extractAllQRCodesFromImageData(imgData)) {
        add(found);
      }
    }
  }
  return unique;
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

/**
 * Decodes one or more QR codes from an uploaded image File (supporting multi-QR selection)
 */
function decodeAllQRCodesFromFile(file) {
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
          const payloads = await decodeAllQRCodesFromSource(img);
          if (payloads.length > 0) {
            resolve(payloads);
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
    // BILINGUAL LOCALIZATION DICTIONARY (Kurdish Sorani ckb RTL & English en LTR)
    // =========================================================================
    const TRANSLATIONS = {
  "ckb": {
    "brandPrimary": "ZIP QR",
    "brandSecondary": "Wi-Fi QR Decoder",
    "brandDisplayTitle": "ZIP QR — Wi-Fi QR Decoder",
    "tagline": "SCAN. REVEAL. CONNECT.",
    "navHome": "سەرەکی",
    "navScanner": "سکانەر",
    "navResults": "ئەنجامەکان",
    "navHistory": "مێژوو",
    "navSettings": "ڕێکخستنەکان",
    "langKurdish": "کوردی",
    "langEnglish": "English",
    "statusOnline": "سەرهێڵ: پەیوەستە",
    "statusOffline": "دۆخی بێ ئینتەرنێت (Offline Mode)",
    "statusOfflineReady": "ئامادەیە بۆ کارکردن بەبێ ئینتەرنێت",
    "statusCachingProgress": "خەریکی پاشەکەوتکردنی فایلە پێویستەکانە...",
    "statusOfflineIncomplete": "ئامادەکاری کارکردنی بێ ئینتەرنێت تەواو نەبووە",
    "statusOnlineAndReady": "سەرهێڵ و ئامادەیە بۆ کارکردن بەبێ ئینتەرنێت",
    "statusOfflineAndReady": "دۆخی بێ ئینتەرنێت — ئامادەیە (کارکردن لە بیرگەی ناوخۆیی)",
    "statusOfflineUnavailable": "تایبەتمەندی Offline لەم ژینگەیەدا بەردەست نییە",
    "heroBadge": "١٠٠٪ شیکردنەوەی ناوخۆیی لەناو وێبگەڕ • کاردەکات بەبێ ئینتەرنێت (Offline PWA)",
    "heroDescription": "هەر کۆدێکی QRـی وای-فای بە کامێرا سکان بکە یان وێنەی QR باربکە (PNG، JPG، JPEG، WEBP) بۆ دەرهێنان و پیشاندانی دەستبەجێی تێپەڕەوشەی وای-فای، ناوی تۆڕ (SSID)، جۆری پاراستن (WPA، WPA2، WPA3، WEP، کراوە، DPP)، و پاشەکەوتکردنی تەواوی مێژوو لەسەر ئامێرەکەت.",
    "btnScanQrCode": "سکانکردنی کۆدی QR",
    "btnUploadQrImage": "بارکردنی وێنەی QR",
    "card1Step": "١. کامێرای ڕاستەوخۆ",
    "card1Title": "سکانکردنی کۆدی QR",
    "card1Desc": "کامێرای ئامێرەکەت بکەرەوە بۆ ناسینەوە و خوێندنەوەی خودکارانەی کۆدی QRـی وای-فای بە شێوەی ڕاستەوخۆ.",
    "card1Btn": "کردنەوەی سکانەری کامێرا",
    "card2Step": "٢. هەڵبژاردنی وێنە و ڕاکێشان",
    "card2Title": "بارکردنی وێنەی QR",
    "card2Desc": "فایلی وێنەی کۆدی QR (PNG، JPG، JPEG، یان WEBP) لە گەلەری مۆبایل یان کۆمپیوتەرەکەت هەڵبژێرە یان ڕایبکێشە بۆ ئێرە.",
    "card2Btn": "هەڵبژاردنی وێنەی QR",
    "card3Step": "٣. دەقی ڕاستەوخۆی کۆد",
    "card3Title": "لکاندنی ناوەڕۆکی QR",
    "card3Desc": "دەقی ناوەڕۆکی کۆدی QRـی وای-فای (WIFI:...;; یان DPP:...;;) لێرە بلکێنە بۆ دەرهێنانی زانیارییەکانی بە دەستبەجێ.",
    "card3Placeholder": "دەقی WIFI:... یان DPP:... لێرە بلکێنە",
    "card3Btn": "شیکردنەوەی ناوەڕۆکی QR",
    "recentHeading": "کۆدە سکانکراوەکانی دوایی",
    "recentSubheading": "پاشەکەوتکراوە لە بنکەدراوەی ناوخۆیی وێبگەڕ (IndexedDB) لەگەڵ تێپەڕەوشەکان",
    "btnManageHistory": "بەڕێوەبردنی مێژوو",
    "emptyRecentText": "هێشتا هیچ کۆدێکی QR سکان نەکراوە. لە سەرەوە سکانکردنی کۆدی QR، بارکردنی وێنەی QR، یان لکاندنی ناوەڕۆکی QR بەکاربهێنە.",
    "multiQrTitle": "چەند کۆدێکی QR لە وێنەکەدا دۆزرایەوە",
    "multiQrSubtitle": "تکایە ئەو کۆدەی QR هەڵبژێرە کە دەتەوێت زانیاری و تێپەڕەوشەکەی ببینیت:",
    "btnSelectThisQr": "بینینی ئەم کۆدە",
    "scannerTitle": "سکانەری ڕاستەوخۆی QRـی وای-فای",
    "scannerSubtitle": "کۆدی QRـی وای-فای بخەرە ناو چوارچێوەکە یان وێنەیەک لە گەلەری ئامێرەکەت هەڵبژێرە.",
    "btnCancel": "پاشگەزبوونەوە",
    "scannerRequestingCamera": "داواکردنی مۆڵەتی کامێرا...",
    "scannerOpeningStream": "کردنەوەی پەخشی کامێرا...",
    "scannerAlignPrompt": "کۆدی QRـی وای-فای بخەرە ناو چوارچێوەی سکانکردن...",
    "scannerFallbackTitle": "کامێرا بەردەست نییە — بارکردنی وێنە چالاکە",
    "scannerFallbackNoApi": "تایبەتمەندی کامێرا (getUserMedia) لەم وێبگەڕەدا بەردەست نییە. دەتوانیت ڕاستەوخۆ هەر وێنەیەکی PNG، JPG، یان WEBP باربکەیت.",
    "scannerFallbackDenied": "مۆڵەتی کامێرا ڕەتکرایەوە یان هیچ کامێرایەک لەسەر ئەم ئامێرە نەدۆزرایەوە. دوگمەی بارکردنی وێنەی QR لە خوارەوە بەکاربهێنە.",
    "btnRetryCamera": "هەوڵدانەوەی کامێرا",
    "btnFallbackUpload": "بارکردنی وێنەی QR لەبری کامێرا",
    "defaultCameraLabel": "کامێرای بنەڕەتی ئامێر",
    "cameraItemPrefix": "کامێرا",
    "btnSwitchCamera": "گۆڕینی کامێرا",
    "flashlightOn": "فلاش: داگیرساوە",
    "flashlightOff": "فلاش: کوژاوەتەوە",
    "flashlightNA": "فلاش بەردەست نییە",
    "zoomLabel": "نزیککردنەوە (Zoom)",
    "btnUploadFromGallery": "بارکردن لە گەلەرییەوە",
    "resultsEmptyTitle": "هێشتا هیچ کۆدێکی QR سکان نەکراوە",
    "resultsEmptyDesc": "لە پەڕەی سەرەکی کۆدێکی QRـی وای-فای بە کامێرا سکان بکە، وێنەیەک باربکە، یان دەقی کۆدەکە بلکێنە.",
    "btnScanAnother": "سکانکردنی کۆدێکی تر",
    "btnCopySsid": "لەبەرگرتنەوەی ناوی تۆڕ (SSID)",
    "sourcePrefix": "سەرچاوە:",
    "decodedOnPrefix": "شیکراوەتەوە لە ڕێکەوتی",
    "extractedPasswordHeading": "تێپەڕەوشەی دەرهێنراوی وای-فای",
    "charsSuffix": "پیت/هێما",
    "btnShowPassword": "پیشاندانی تێپەڕەوشە",
    "btnHidePassword": "شاردنەوەی تێپەڕەوشە",
    "btnCopyPassword": "لەبەرگرتنەوەی تێپەڕەوشە",
    "passwordExactNote": "ڕاستەوخۆ و بە شێوەی ناوخۆیی لە ناوەڕۆکی کۆدی QR دەرهێنراوە و لە بنکەدراوەی ناوخۆیی وێبگەڕەکەت پاشەکەوت کراوە.",
    "noPasswordEncodedMsg": "هیچ تێپەڕەوشەیەک لەم کۆدی QRـەدا تۆمار نەکراوە.",
    "openNetworkNoPasswordMsg": "تۆڕی کراوە — پێویستی بە تێپەڕەوشە نییە.",
    "dppNoPasswordMsg": "هیچ تێپەڕەوشەیەک لەم کۆدی QRـەدا تۆمار نەکراوە. پڕۆتۆکۆلی DPP کلیلی گشتی نهێنیبەندی بەکاردەهێنێت لەبری تێپەڕەوشەی ئاسایی.",
    "networkInfoHeading": "زانیارییەکانی تۆڕ",
    "infoLabel1Ssid": "١. ناوی تۆڕی وای-فای (SSID)",
    "infoLabel2Password": "٢. تێپەڕەوشەی وای-فای",
    "infoLabel3Security": "٣. جۆری پاراستن (Security Type)",
    "infoLabel4Hidden": "٤. دۆخی تۆڕی شاراوە",
    "infoLabel5Format": "٥. جۆری فۆرماتی کۆدی QR",
    "infoLabel6Extra": "٦. زانیارییە زیادە تۆمارکراوەکانی ناو کۆدی QR",
    "infoNoExtraParams": "هیچ پارامێتەرێکی زیادە لەم کۆدی QRـەدا بوونی نییە.",
    "infoRawPayloadLabel": "دەقی ڕەسەنی ناوەڕۆکی کۆدی QR",
    "btnCopyAllInfo": "لەبەرگرتنەوەی هەموو زانیارییەکان",
    "btnDownloadTxt": "داگرتنی ئەنجامەکان (.TXT)",
    "btnDownloadJson": "داگرتنی ئەنجامەکان (.JSON)",
    "pasteAnotherHeading": "پشکنەری دەقی ناوەڕۆکی کۆدی QR",
    "pasteAnotherDesc": "هەر دەقێکی WIFI:T:...;S:...;P:...;; یان DPP:...;; لێرە بلکێنە بۆ شیکردنەوەی ڕاستەوخۆ:",
    "btnDecodePayload": "شیکردنەوەی دەق",
    "hiddenYes": "بەڵێ",
    "hiddenNo": "نەخێر",
    "hiddenNA": "بەردەست نییە",
    "historyTitle": "مێژووی سکانکردن",
    "historySubtitle": "تۆمارە پاشەکەوتکراوەکانی وای-فای لەگەڵ تێپەڕەوشەکانیان لە بنکەدراوەی ناوخۆیی وێبگەڕ (IndexedDB) هەڵگیراون و دوای داخستنی وێبگەڕ دەمێننەوە.",
    "historyStorageBadge": "بنکەدراوەی هەمیشەیی IndexedDB • تەنها لەسەر ئەم ئامێرە",
    "labelSaveHistory": "پاشەکەوتکردنی مێژووی سکان",
    "btnClearAllHistory": "سڕینەوەی هەموو مێژوو",
    "modalClearTitle": "دڵنیابوونەوە لە سڕینەوەی تەواوی مێژوو",
    "modalClearDesc": "ئایا دڵنیایت کە دەتەوێت هەموو تۆمارەکانی مێژووی سکان و تێپەڕەوشە پاشەکەوتکراوەکان بە هەمیشەیی لە بنکەدراوەی وێبگەڕەکەت بسڕیتەوە؟",
    "btnConfirmClear": "بەڵێ، هەمووی بسڕەوە",
    "historySearchPlaceholder": "گەڕان لە مێژوودا بەپێی ناوی تۆڕ (SSID)، جۆری پاراستن، یان فۆرمات...",
    "historyEmptyText": "مێژووی ناوخۆیی سکانکردن لە ئێستادا بەتاڵە.",
    "historyNoMatchText": "هیچ تۆمارێکی مێژوو لەگەڵ گەڕانەکەت ناگونجێت.",
    "btnOpenResult": "وردەکاری تەواو",
    "btnDeleteEntry": "سڕینەوە",
    "badgeHiddenSsid": "تۆڕی شاراوە",
    "badgeSavedPassword": "تێپەڕەوشە پاشەکەوتکراوە",
    "historyPasswordExtractedPrefix": "تێپەڕەوشە پاشەکەوتکراوە",
    "settingsTitle": "ڕێکخستنەکان، تایبەتمەندی و زانیاری سیستەم",
    "settingsSubtitle": "گۆڕینی زمان، ڕووکاری ڕەنگەکان، کۆنترۆڵکردنی تایبەتمەندی داتای ناوخۆیی، و زانیاری کارکردنی بێ ئینتەرنێت (PWA).",
    "settingsLanguageHeading": "زمان / Language",
    "settingsLanguageDesc": "زمانی پیشاندانی بەرنامەکە هەڵبژێرە (بە شێوەی خودکارانە پاشەکەوت دەکرێت).",
    "settingsThemeHeading": "ڕێکخستنی ڕووکار (Theme)",
    "theme1Title": "شینی کارەبایی و مۆر",
    "theme1Desc": "ڕووکاری تاریکی بنەڕەتی ZIP QR",
    "theme2Title": "ڕووکاری وەنەوشەیی سایبەر",
    "theme2Desc": "ڕەنگی تاریکی قووڵ لەگەڵ درەوشانەوەی وەنەوشەیی",
    "theme3Title": "قەڵغانی زومڕەدی",
    "theme3Desc": "ڕووکاری تاریکی جیاوازی بەرز",
    "maskPasswordTitle": "شاردنەوەی تێپەڕەوشە بە شێوەی بنەڕەتی لە پەڕەی ئەنجامەکان",
    "maskPasswordDesc": "سەرەتا تێپەڕەوشەکە بە شاراوەیی (••••••••) پیشان بدە تا ئەو کاتەی کرتە لە پیشاندانی تێپەڕەوشە دەکەیت (لە پەڕەی مێژوودا هەمیشە بە شاراوەیی پیشان دەدرێت).",
    "historyPrefsHeading": "ڕێکخستنەکانی مێژووی IndexedDB",
    "enableHistoryTitle": "چالاککردنی مێژووی هەمیشەیی ناوخۆیی (لەگەڵ تێپەڕەوشەکان)",
    "enableHistoryDesc": "پاشەکەوتکردنی خودکارانەی تۆڕە سکانکراوەکان و تێپەڕەوشەی ڕاستەقینەی وای-فای لە بنکەدراوەی IndexedDBـی وێبگەڕەکەت تا دوای داخستنی وێبگەڕ یان کوژاندنەوەی ئامێرەکەش بمێننەوە.",
    "sysInfoSectionHeading": "زانیاری بەرنامە و توانای کارکردن بەبێ ئینتەرنێت (PWA)",
    "sysInfoReadinessLabel": "دۆخی ئامادەیی کارکردنی بێ ئینتەرنێت:",
    "sysInfoPwaTitle": "دەربارەی ZIP QR",
    "sysInfoPwaDesc": "ZIP QR بەرنامەیەکی وێبی پێشکەوتووە (Progressive Web App - PWA) کە دەتوانیت لە وێبگەڕە پشتگیریکراوەکان بەکاریبهێنیت و لە ئامێرە پشتگیریکراوەکان وەک ئەپێک دایمەزرێنیت.",
    "sysInfoOfflineTitle": "کارکردن بەبێ ئینتەرنێت",
    "sysInfoOfflineDesc": "ZIP QR دەتوانێت دوای یەکەم جار کردنەوەی سەرکەوتووی بەرنامەکە بە ئینتەرنێت و تەواوبوونی پاشەکەوتکردنی فایلە پێویستەکان، بەبێ پەیوەندی بە ئینتەرنێتیش کار بکات.",
    "sysInfoFeaturesHeading": "لە دوای ئامادەبوونی Offline Mode، دەتوانیت:",
    "sysInfoFeat1": "QR Code بە کامێرا بسکەنیت.",
    "sysInfoFeat2": "وێنەی QR Upload بکەیت و بخوێنیتەوە.",
    "sysInfoFeat3": "زانیارییەکانی Wi-Fi و پاسوۆردەکە بدۆزیتەوە.",
    "sysInfoFeat4": "مێژووی Scan ـەکانت ببینیت.",
    "sysInfoFeat5": "پاسوۆردە پاشەکەوتکراوەکانت ببینیت و کۆپی بکەیت.",
    "sysInfoFeat6": "تۆماری نوێی سکان لە بنکەدراوەی ناوخۆیی پاشەکەوت بکەیت.",
    "sysInfoFeat7": "زمان بگۆڕیت لە نێوان کوردی سۆرانی و ئینگلیزی.",
    "sysInfoFeat8": "Settings و زانیارییەکانی بەرنامەکە بەکاربهێنیت.",
    "sysInfoConditionsHeading": "تێبینی گرنگ:",
    "sysInfoCond1": "بۆ یەکەم جار باربوونی بەرنامەکە، دامەزراندن، و وەرگرتنی نوێکارییەکان پێویستت بە ئینتەرنێت هەیە.",
    "sysInfoCond2": "سکەنکردن بە کامێرا پێویستی بە HTTPS، ڕێگەپێدانی کامێرا و وێبگەڕێکی پشتگیریکار هەیە.",
    "sysInfoCond3": "سڕینەوەی داتای وێبگەڕ یان Site Data ڕەنگە مێژوو و فایلە پاشەکەوتکراوەکان بسڕێتەوە، و سیاسەتی بیرگەی وێبگەڕ کار دەکاتە سەر مانەوەی داتا.",
    "sysInfoCond4": "کارکردنی بێ ئینتەرنێت ناتوانێت تێپەڕەوشەیەک بگەڕێنێتەوە کە هەرگیز لەناو کۆدی QRـەکەدا تۆمار نەکرابێت.",
    "pwaInstallHeading": "دامەزراندنی بەرنامەی ZIP QR لەسەر ئامێرەکەت",
    "pwaInstallDesc": "دەتوانیت ZIP QR لەسەر مۆبایل یان کۆمپیوتەرەکەت دابمەزرێنیت بۆ ئەزموونێکی وەک ئەپی سەربەخۆ. بەردەستبوونی دامەزراندن بەندە بە وێبگەڕ و سیستەمی کارپێکردنی ئامێرەکەت.",
    "btnInstallPwa": "دامەزراندنی ئەپی ZIP QR",
    "pwaInstalledBadge": "ئەپەکە دامەزراوە (کارکردن وەک ئەپی سەربەخۆ)",
    "pwaManualInstallHint": "بۆ دامەزراندن: لە مێنوی وێبگەڕەکەت هەڵبژاردنی \"Add to Home Screen\" (لە iPhone/Android) یان ئایکۆنی \"Install ZIP QR\" لە شریتی ناونیشانی وێبگەڕەکەت بەکاربهێنە.",
    "privacyHeading": "زانیاری تایبەتمەندی و ڕاستگۆیی تەکنیکی",
    "privacyCard1Title": "١٠٠٪ کارکردن لەسەر ئامێری بەکارهێنەر (بێ سێرڤەر)",
    "privacyCard1Desc": "پەخشی کامێرا، وێنە بارکراوەکانی QR، و تێپەڕەوشەکانی وای-فای بە تەواوی لەناو وێبگەڕەکەت شیدەکرێنەوە. هیچ زانیارییەک هەرگیز بۆ هیچ سێرڤەر یان لایەنێکی دەرەکی نانێردرێت.",
    "privacyCard2Title": "تایبەتمەندی و سنووردارێتی بیرگەی ناوخۆیی (IndexedDB)",
    "privacyCard2Desc": "مێژوو و تێپەڕەوشەکان لەسەر پڕۆفایلی وێبگەڕی ئەم ئامێرە هەڵدەگیرێن بەبێ پێویستی بە چوونەژوورەوە. تێپەڕەوشەکان لە ڕووکاردا بە هێمای (••••••••) دەشاردرێنەوە، بەڵام هەر کەسێک دەستی بگاتە هەمان پڕۆفایلی وێبگەڕ و داتای ئامێرەکەت دەتوانێت بیانبینێت.",
    "privacyCard3Title": "پاراستنی داتای دەرەکی و نوێکردنەوەی سەلامەت",
    "privacyCard3Desc": "نوێکردنەوەی بەرنامەکە (PWA Service Worker) تەنها فایلە کاتییەکانی ڕووکار نوێ دەکاتەوە و هەرگیز بنکەدراوەی مێژووی وای-فایەکانت ناسڕێتەوە.",
    "btnClearAllStoredData": "سڕینەوەی هەموو داتا پاشەکەوتکراوەکان (مێژووی IndexedDB و ڕێکخستنەکان)",
    "confirmWipePrompt": "دڵنیایت لە سڕینەوەی هەموو مێژووی IndexedDB و گەڕاندنەوەی ڕێکخستنەکان بۆ دۆخی بنەڕەتی؟",
    "btnConfirmWipe": "تەواو، هەمووی بسڕەوە",
    "aboutHeading": "دەربارەی گەشەپێدەر و پڕۆژەی ZIP QR",
    "aboutDescription": "ZIP QR — Wi-Fi QR Decoder (وەشانی PWA) — SCAN. REVEAL. CONNECT. دیزاین کراوە بۆ ئایفۆن، ئایپاد، مۆبایل و تابلێتەکانی ئەندرۆید، ویندۆز، ماکبووک، و کۆمپیوتەرەکانی لینوکس. پشتگیری لە تۆڕەکانی WPA، WPA2، WPA3-SAE، WPA2-EAP، WEP، تۆڕە کراوەکان (nopass)، تۆڕە شاراوەکان، هێما تایبەتەکان (\\; \\, \\: \\\\ \\\")، و کۆدەکانی Wi-Fi Easy Connect (DPP:) دەکات.",
    "creatorSectionBadge": "زانیاری گەشەپێدەر و دروستکەر",
    "creatorNameLabel": "ناو",
    "creatorNameValue": "زەردەشت محمد (Zardasht Muhammad)",
    "creatorTitleLabel": "ناونیشانی پیشەیی",
    "creatorTitleValue": "گەشەپێدەر و دروستکەر (Developer & Creator)",
    "creatorProjectLabel": "پڕۆژە",
    "creatorProjectValue": "ZIP QR — Wi-Fi QR Decoder",
    "creatorCreditLine": "دروستکراو و پەرەپێدراوە لەلایەن زەردەشت محمد.",
    "creatorContactBtn": "پەیوەندیکردن بە ئیمەیڵ",
    "creatorEmailLabel": "ئیمەیڵی پەیوەندی",
    "footerLeft": "ZIP QR — Wi-Fi QR Decoder • SCAN. REVEAL. CONNECT.",
    "footerRight": "١٠٠٪ شیکردنەوەی ناوخۆیی کۆدی QR لەناو وێبگەڕ • کاردەکات بەبێ ئینتەرنێت (Offline PWA)",
    "toastPasswordExtracted": "تێپەڕەوشە دەرهێنرا و لە مێژوو پاشەکەوت کرا بۆ",
    "toastDecodedPayload": "کۆدی QR بە سەرکەوتوویی شیکرایەوە",
    "toastPasswordCopied": "تێپەڕەوشەی وای-فای لەبەرگیرایەوە!",
    "toastSsidCopied": "ناوی تۆڕ (SSID) لەبەرگیرایەوە!",
    "toastAllCopied": "هەموو زانیارییەکانی تۆڕ لەبەرگیرانەوە!",
    "toastDownloadedTxt": "ڕاپۆرتی ئەنجامەکان داگیرا (.txt)",
    "toastDownloadedJson": "فایلی داتای ئەنجامەکان داگیرا (.json)",
    "toastEnterPayload": "تکایە دەقی ناوەڕۆکی کۆدی QR بنووسە یان بلکێنە بۆ شیکردنەوە.",
    "toastHistoryEnabled": "پاشەکەوتکردنی مێژووی سکان لە IndexedDB چالاک کرا.",
    "toastHistoryPaused": "پاشەکەوتکردنی مێژووی سکان ڕاگیرا.",
    "toastHistoryCleared": "تەواوی مێژووی سکان لە IndexedDB سڕایەوە.",
    "toastEntryDeleted": "تۆمارەکە لە مێژووی سکان سڕایەوە.",
    "toastThemeUpdated": "ڕووکاری بەرنامە نوێکرایەوە.",
    "toastDataWiped": "هەموو داتای IndexedDB و ڕێکخستنە ناوخۆییەکان سڕانەوە.",
    "toastLanguageChanged": "زمان گۆڕدرا بۆ کوردی سۆرانی.",
    "toastDecodeError": "هیچ کۆدێکی دروستی QR لەم وێنەیەدا نەدۆزرایەوە.",
    "toastTorchUnsupported": "کۆنترۆڵکردنی فلاش لەسەر ئەم کامێرایە پشتگیری ناکرێت.",
    "toastMultipleQrFound": "چەند کۆدێکی QR لە وێنەکەدا دۆزرایەوە — دانەیەکیان هەڵبژێرە.",
    "toastOfflineReadyConfirmed": "هەموو فایلە پێویستەکان پاشەکەوت کران — ئامادەیە بۆ کارکردن بەبێ ئینتەرنێت."
  },
  "en": {
    "brandPrimary": "ZIP QR",
    "brandSecondary": "Wi-Fi QR Decoder",
    "brandDisplayTitle": "ZIP QR — Wi-Fi QR Decoder",
    "tagline": "SCAN. REVEAL. CONNECT.",
    "navHome": "Home",
    "navScanner": "Scanner",
    "navResults": "Results",
    "navHistory": "History",
    "navSettings": "Settings",
    "langKurdish": "کوردی",
    "langEnglish": "English",
    "statusOnline": "Online: Connected",
    "statusOffline": "Offline: Offline Mode",
    "statusOfflineReady": "Ready for Offline Use",
    "statusCachingProgress": "Essential resources still caching...",
    "statusOfflineIncomplete": "Offline preparation incomplete",
    "statusOnlineAndReady": "Online and ready for offline use",
    "statusOfflineAndReady": "Offline and ready (running from local cache)",
    "statusOfflineUnavailable": "Offline capability unavailable in this browser context",
    "heroBadge": "100% Local In-Browser Decoding • Full Offline PWA Support",
    "heroDescription": "Scan any Wi-Fi QR code with your camera or upload a QR image (PNG, JPG, JPEG, WEBP) to immediately extract and reveal the exact encoded Wi-Fi Password, SSID, Security Type (WPA, WPA2, WPA3, WEP, Open, DPP), and keep persistent local History on your device.",
    "btnScanQrCode": "SCAN QR CODE",
    "btnUploadQrImage": "UPLOAD QR IMAGE",
    "card1Step": "1. Live Camera",
    "card1Title": "SCAN QR CODE",
    "card1Desc": "Open your device camera to automatically detect and decode a physical Wi-Fi QR code in real time.",
    "card1Btn": "OPEN CAMERA SCANNER",
    "card2Step": "2. Image Picker & Dropzone",
    "card2Title": "UPLOAD QR IMAGE",
    "card2Desc": "Select or drag and drop a QR image file (PNG, JPG, JPEG, or WEBP) from your gallery or computer.",
    "card2Btn": "SELECT QR IMAGE",
    "card3Step": "3. Direct Payload",
    "card3Title": "PASTE QR CONTENT",
    "card3Desc": "Paste an actual Wi-Fi QR payload string (WIFI:...;; or DPP:...;;) to extract its credentials immediately.",
    "card3Placeholder": "Paste WIFI:... or DPP:... payload here",
    "card3Btn": "DECODE QR CONTENT",
    "recentHeading": "Recently Scanned Codes",
    "recentSubheading": "Persisted in your browser IndexedDB database with saved Wi-Fi passwords",
    "btnManageHistory": "Manage History",
    "emptyRecentText": "No QR codes scanned yet. Use SCAN QR CODE, UPLOAD QR IMAGE, or PASTE QR CONTENT above to decode a QR code.",
    "multiQrTitle": "Multiple QR Codes Detected in Image",
    "multiQrSubtitle": "Select which detected QR code you want to inspect:",
    "btnSelectThisQr": "Open This QR Code",
    "scannerTitle": "Live Wi-Fi QR Scanner",
    "scannerSubtitle": "Align the Wi-Fi QR code inside the frame or select an image from your gallery.",
    "btnCancel": "Cancel",
    "scannerRequestingCamera": "Requesting camera access...",
    "scannerOpeningStream": "Opening camera stream...",
    "scannerAlignPrompt": "Align Wi-Fi QR code within the scanning frame...",
    "scannerFallbackTitle": "Camera Unavailable — Image Upload Active",
    "scannerFallbackNoApi": "Camera API (getUserMedia) is unavailable in this browser context. You can upload any PNG, JPG, or WEBP QR image directly.",
    "scannerFallbackDenied": "Camera access was denied or no camera hardware was detected. Use the Upload QR Image button below to decode from a file.",
    "btnRetryCamera": "Retry Camera",
    "btnFallbackUpload": "Upload QR Image Instead",
    "defaultCameraLabel": "Default Environment Camera",
    "cameraItemPrefix": "Camera",
    "btnSwitchCamera": "Switch Camera",
    "flashlightOn": "Flashlight: ON",
    "flashlightOff": "Flashlight: OFF",
    "flashlightNA": "Flashlight N/A",
    "zoomLabel": "Zoom",
    "btnUploadFromGallery": "Upload from Gallery",
    "resultsEmptyTitle": "No QR Code Scanned Yet",
    "resultsEmptyDesc": "Scan a Wi-Fi QR code with your camera, upload a QR image, or paste QR content on the Home page.",
    "btnScanAnother": "SCAN ANOTHER CODE",
    "btnCopySsid": "Copy SSID",
    "sourcePrefix": "Source:",
    "decodedOnPrefix": "Decoded on",
    "extractedPasswordHeading": "EXTRACTED WI-FI PASSWORD",
    "charsSuffix": "chars",
    "btnShowPassword": "SHOW PASSWORD",
    "btnHidePassword": "HIDE PASSWORD",
    "btnCopyPassword": "COPY PASSWORD",
    "passwordExactNote": "Decoded locally directly from the QR code payload with full special-character unescaping and saved to local IndexedDB History.",
    "noPasswordEncodedMsg": "No password is encoded in this QR code.",
    "openNetworkNoPasswordMsg": "Open network — no password required.",
    "dppNoPasswordMsg": "No password is encoded in this QR code. DPP uses cryptographic public-key bootstrapping instead of a plaintext Wi-Fi password.",
    "networkInfoHeading": "NETWORK INFORMATION",
    "infoLabel1Ssid": "1. Wi-Fi Name (SSID)",
    "infoLabel2Password": "2. Wi-Fi Password",
    "infoLabel3Security": "3. Security Type",
    "infoLabel4Hidden": "4. Hidden Network Status",
    "infoLabel5Format": "5. QR Payload Format",
    "infoLabel6Extra": "6. Additional Information Actually Present in QR Code",
    "infoNoExtraParams": "No additional optional parameters are encoded in this QR code.",
    "infoRawPayloadLabel": "Exact Raw QR Payload",
    "btnCopyAllInfo": "COPY ALL INFORMATION",
    "btnDownloadTxt": "DOWNLOAD RESULTS (.TXT)",
    "btnDownloadJson": "DOWNLOAD RESULTS (.JSON)",
    "pasteAnotherHeading": "Raw QR Payload String Tester",
    "pasteAnotherDesc": "Paste any raw WIFI:T:...;S:...;P:...;; or DPP:...;; string to decode it directly:",
    "btnDecodePayload": "Decode Payload",
    "hiddenYes": "Yes",
    "hiddenNo": "No",
    "hiddenNA": "N/A",
    "historyTitle": "Scan History",
    "historySubtitle": "Previously scanned networks and their actual Wi-Fi passwords are stored persistently in local browser IndexedDB across sessions and restarts.",
    "historyStorageBadge": "Persistent IndexedDB Storage • Strictly Local on This Device",
    "labelSaveHistory": "Save Scan History",
    "btnClearAllHistory": "Clear All History",
    "modalClearTitle": "Confirm Clearing All Scan History",
    "modalClearDesc": "Are you sure you want to permanently delete all saved scan history records and passwords from your browser IndexedDB database?",
    "btnConfirmClear": "Yes, Delete All",
    "historySearchPlaceholder": "Search history by network name (SSID), security protocol, or format...",
    "historyEmptyText": "Your local scan history is currently empty.",
    "historyNoMatchText": "No scan history entries match your search filter.",
    "btnOpenResult": "Full Details",
    "btnDeleteEntry": "Delete",
    "badgeHiddenSsid": "Hidden SSID",
    "badgeSavedPassword": "Saved Password",
    "historyPasswordExtractedPrefix": "Saved password",
    "settingsTitle": "Settings, Privacy & System Information",
    "settingsSubtitle": "Customize language, theme accents, local IndexedDB storage controls, and inspect PWA & offline capabilities.",
    "settingsLanguageHeading": "Language / زمان",
    "settingsLanguageDesc": "Select the application interface language (saved automatically).",
    "settingsThemeHeading": "Theme Settings",
    "theme1Title": "Electric Blue & Purple",
    "theme1Desc": "Default ZIP dark neon palette",
    "theme2Title": "Cyber Violet Core",
    "theme2Desc": "Deep obsidian with violet accents",
    "theme3Title": "Emerald Security",
    "theme3Desc": "High-contrast tactical dark theme",
    "maskPasswordTitle": "Mask Password by Default on Results Page",
    "maskPasswordDesc": "Start with password masked (••••••••) on the Results page until you tap SHOW PASSWORD (passwords in History are always masked by default).",
    "historyPrefsHeading": "IndexedDB History Preferences",
    "enableHistoryTitle": "Enable Persistent Local History (Including Wi-Fi Passwords)",
    "enableHistoryDesc": "Automatically save scanned networks and actual Wi-Fi passwords in your browser IndexedDB database so they remain available after closing the browser or restarting your device.",
    "sysInfoSectionHeading": "Application Information & Offline Capabilities (PWA)",
    "sysInfoReadinessLabel": "Current Offline Readiness Status:",
    "sysInfoPwaTitle": "About ZIP QR",
    "sysInfoPwaDesc": "ZIP QR is a Progressive Web App (PWA). You can use it through a supported web browser and install it on supported devices for an app-like experience.",
    "sysInfoOfflineTitle": "Offline Functionality",
    "sysInfoOfflineDesc": "ZIP QR can work without an internet connection after your first successful online visit and once all essential application files have been successfully cached.",
    "sysInfoFeaturesHeading": "When offline readiness is complete, you can:",
    "sysInfoFeat1": "Scan QR codes using your camera.",
    "sysInfoFeat2": "Upload and decode QR images.",
    "sysInfoFeat3": "Extract encoded Wi-Fi information and passwords.",
    "sysInfoFeat4": "View your local scan History.",
    "sysInfoFeat5": "Reveal and copy previously saved Wi-Fi passwords.",
    "sysInfoFeat6": "Save new scans locally in IndexedDB.",
    "sysInfoFeat7": "Switch between supported languages (Kurdish Sorani & English).",
    "sysInfoFeat8": "Access application settings and local information.",
    "sysInfoConditionsHeading": "Important Conditions & Limitations:",
    "sysInfoCond1": "The first successful visit, initial caching, and application updates require an internet connection.",
    "sysInfoCond2": "Live camera scanning requires HTTPS, camera permission, and a supported browser.",
    "sysInfoCond3": "Clearing browser or site data may remove saved History and cached application files, and browser storage policies may affect persistent data.",
    "sysInfoCond4": "Offline functionality cannot recover information that was never encoded inside a QR code (such as DPP public-key codes).",
    "pwaInstallHeading": "Install ZIP QR on Your Device",
    "pwaInstallDesc": "Install ZIP QR on your device for a more app-like experience. Installation availability depends on your browser and operating system.",
    "btnInstallPwa": "Install ZIP QR App",
    "pwaInstalledBadge": "Installed (Running in Standalone App Mode)",
    "pwaManualInstallHint": "To install: Open your browser menu and select \"Add to Home Screen\" (iOS/Android) or click the \"Install ZIP QR\" icon in the address bar (Desktop Chrome/Edge).",
    "privacyHeading": "Privacy Architecture & Technical Transparency",
    "privacyCard1Title": "100% Client-Side Execution (Zero Server Uploads)",
    "privacyCard1Desc": "Camera frames, uploaded QR images, SSIDs, and Wi-Fi passwords are decoded and stored strictly inside your browser. No scan data is ever sent to Cloudflare Functions, external APIs, or analytics servers.",
    "privacyCard2Title": "Local Browser Storage Model & Realistic Limitations",
    "privacyCard2Desc": "History and saved passwords are stored in browser-local IndexedDB without requiring an account. Passwords are masked (••••••••) in the UI and excluded from console logs, but anyone with direct access to the same unlocked browser profile or device storage can access saved History.",
    "privacyCard3Title": "Update-Safe Persistence",
    "privacyCard3Desc": "PWA Service Worker updates only refresh static application caches and never erase your IndexedDB Wi-Fi History unless you explicitly clear History or wipe browser site data.",
    "btnClearAllStoredData": "Clear All Stored Data (IndexedDB History & Preferences)",
    "confirmWipePrompt": "Confirm wiping all IndexedDB history and resetting settings?",
    "btnConfirmWipe": "Confirm Wipe",
    "aboutHeading": "Developer & Creator Profile",
    "aboutDescription": "ZIP QR — Wi-Fi QR Decoder (PWA) — SCAN. REVEAL. CONNECT. Designed for iPhones, iPads, Android phones & tablets, Windows, MacBooks, and Linux computers. Supports WPA, WPA2, WPA3-SAE, WPA2-EAP, WEP, Open (nopass), hidden networks, escaped special characters (\\; \\, \\: \\\\ \\\"), and Wi-Fi Easy Connect (DPP:).",
    "creatorSectionBadge": "Developer & Creator Identity",
    "creatorNameLabel": "Name",
    "creatorNameValue": "Zardasht Muhammad",
    "creatorTitleLabel": "Professional Title",
    "creatorTitleValue": "Developer & Creator",
    "creatorProjectLabel": "Project",
    "creatorProjectValue": "ZIP QR — Wi-Fi QR Decoder",
    "creatorCreditLine": "Created and developed by Zardasht Muhammad.",
    "creatorContactBtn": "Contact via Email",
    "creatorEmailLabel": "Contact Email",
    "footerLeft": "ZIP QR — Wi-Fi QR Decoder • SCAN. REVEAL. CONNECT.",
    "footerRight": "100% Local In-Browser QR Decoding • Full Offline PWA Support",
    "toastPasswordExtracted": "Password extracted and saved locally for",
    "toastDecodedPayload": "Decoded QR code",
    "toastPasswordCopied": "Wi-Fi Password copied to clipboard!",
    "toastSsidCopied": "SSID copied to clipboard!",
    "toastAllCopied": "All network information copied to clipboard!",
    "toastDownloadedTxt": "Downloaded decoded report (.txt)",
    "toastDownloadedJson": "Downloaded decoded JSON (.json)",
    "toastEnterPayload": "Please enter a QR payload string to decode.",
    "toastHistoryEnabled": "Persistent IndexedDB scan history enabled.",
    "toastHistoryPaused": "Scan history paused.",
    "toastHistoryCleared": "Cleared all records from IndexedDB scan history.",
    "toastEntryDeleted": "Deleted entry from IndexedDB scan history.",
    "toastThemeUpdated": "Theme updated.",
    "toastDataWiped": "All local IndexedDB history and preferences have been cleared.",
    "toastLanguageChanged": "Language switched to English.",
    "toastDecodeError": "Could not decode a valid QR code from this image.",
    "toastTorchUnsupported": "Flashlight control not supported on this camera.",
    "toastMultipleQrFound": "Multiple QR codes detected in image — select one below.",
    "toastOfflineReadyConfirmed": "All essential app files cached — ready for offline use!"
  }
};

    // =========================================================================
    // PERSISTENT INDEXEDDB HISTORY & SETTINGS MANAGEMENT (NO ACCOUNTS / LOCAL-ONLY)
    // =========================================================================
    const IDB_DATABASE_NAME = 'zip_qr_local_db';
    const IDB_SCHEMA_VERSION = 2;
    const IDB_HISTORY_STORE = 'scan_history';

    const STORAGE_KEYS = {
      LEGACY_HISTORY: 'zip_wifi_qr_history_v1',
      SETTINGS: 'zip_wifi_qr_settings_v1',
      LANGUAGE: 'zip_qr_lang_v1'
    };

    let appSettings = {
      language: 'ckb',
      historyEnabled: true,
      autoMaskPassword: false,
      accentTheme: 'electric-blue',
      preferredCameraId: ''
    };

    let scanHistory = [];
    let idbInstance = null;
    let currentResult = null;
    let currentSourceLabel = '';
    let isPasswordVisible = true;
    let revealedHistoryPasswords = new Set();
    let activeStream = null;
    let availableCameras = [];
    let scanIntervalId = null;
    let rvfcHandle = null;
    let isDecodingFrame = false;
    let lastDecodedPayload = '';
    let lastDecodedTime = 0;
    let torchEnabled = false;
    let deferredInstallPrompt = null;
    let currentOfflineStatus = {
      isOnline: typeof navigator !== 'undefined' && 'onLine' in navigator ? Boolean(navigator.onLine) : true,
      cacheReady: false,
      state: 'caching'
    };

    function getT() {
      const lang = appSettings.language === 'en' ? 'en' : 'ckb';
      return TRANSLATIONS[lang];
    }

    function normalizeHistoryEntry(input) {
      const isEntry = input && input.result && typeof input.result === 'object';
      const res = isEntry ? input.result : input;
      const explicitPassword = isEntry && input.password !== undefined ? input.password : (res.password !== undefined ? res.password : null);
      const hasPassword = Boolean(res.hasPasswordField && explicitPassword !== null && String(explicitPassword).length > 0);
      const normalizedResult = Object.assign({}, res, {
        password: explicitPassword,
        hasPasswordField: res.hasPasswordField !== undefined ? res.hasPasswordField : explicitPassword !== null
      });
      return {
        id: (isEntry ? input.id : res.id) || ('scan_' + Date.now()),
        timestamp: (isEntry ? input.timestamp : res.timestamp) || new Date().toISOString(),
        ssid: (isEntry ? input.ssid : res.ssid) || '(Unnamed Network)',
        password: explicitPassword,
        hasPassword: hasPassword,
        securityType: res.securityType || 'Unknown',
        securityDisplay: (isEntry ? input.securityDisplay : res.securityDisplay) || 'Unknown',
        hiddenNetwork: Boolean(res.hiddenNetwork),
        category: (isEntry ? input.category : res.category) || 'WIFI',
        formatLabel: res.formatLabel || 'Wi-Fi Network Configuration (WIFI:)',
        result: normalizedResult
      };
    }

    // =========================================================================
    // VERIFIED OFFLINE CACHE READINESS & ONLINE/OFFLINE STATUS ENGINE
    // =========================================================================
    async function verifyOfflineCacheReadiness() {
      const isOnline = typeof navigator !== 'undefined' && 'onLine' in navigator ? Boolean(navigator.onLine) : true;
      if (typeof window === 'undefined' || !('serviceWorker' in navigator) || typeof caches === 'undefined') {
        return { isOnline: isOnline, cacheReady: false, state: 'unavailable' };
      }
      try {
        const keys = await caches.keys();
        const zipCaches = keys.filter((k) => k.indexOf('zip-qr-cache-') === 0);
        if (zipCaches.length === 0) {
          return { isOnline: isOnline, cacheReady: false, state: isOnline ? 'caching' : 'incomplete' };
        }
        const activeName = zipCaches[zipCaches.length - 1];
        const cache = await caches.open(activeName);
        const hasIndex = Boolean(await cache.match('/index.html'));
        const hasManifest = Boolean(await cache.match('/manifest.json'));
        const hasMarker = Boolean(await cache.match('/offline-ready.json'));
        const ready = hasIndex && hasManifest && hasMarker;
        if (ready) {
          return { isOnline: isOnline, cacheReady: true, state: isOnline ? 'online-ready' : 'offline-ready' };
        }
        return { isOnline: isOnline, cacheReady: false, state: isOnline ? 'caching' : 'incomplete' };
      } catch (e) {
        return { isOnline: isOnline, cacheReady: false, state: 'incomplete' };
      }
    }

    function renderOfflineStatusIndicators() {
      const t = getT();
      const hdrBtn = document.getElementById('headerOfflineStatusBtn');
      const hdrDot = document.getElementById('headerOfflineStatusDot');
      const hdrText = document.getElementById('headerOfflineStatusText');
      const setBadge = document.getElementById('settingsOfflineReadinessBadge');
      const setDot = document.getElementById('settingsOfflineReadinessDot');
      const setText = document.getElementById('settingsOfflineReadinessText');

      const isOnline = currentOfflineStatus.isOnline;
      const cacheReady = currentOfflineStatus.cacheReady;
      const state = currentOfflineStatus.state;

      if (hdrBtn && hdrDot && hdrText) {
        if (!isOnline) {
          hdrText.textContent = cacheReady ? t.statusOfflineAndReady : t.statusOffline;
          hdrBtn.className = cacheReady
            ? 'inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-bold text-amber-300 transition'
            : 'inline-flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/10 px-2.5 py-1.5 text-[11px] font-bold text-rose-300 transition';
          hdrDot.className = cacheReady ? 'h-2 w-2 rounded-full bg-amber-400' : 'h-2 w-2 rounded-full bg-rose-400';
        } else {
          hdrText.textContent = cacheReady ? t.statusOfflineReady : t.statusOnline;
          hdrBtn.className = cacheReady
            ? 'inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-bold text-emerald-300 transition'
            : 'inline-flex items-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-500/10 px-2.5 py-1.5 text-[11px] font-bold text-sky-300 transition';
          hdrDot.className = 'h-2 w-2 rounded-full bg-emerald-400';
        }
      }

      if (setBadge && setDot && setText) {
        let label = t.statusCachingProgress;
        if (state === 'online-ready') label = t.statusOnlineAndReady;
        else if (state === 'offline-ready') label = t.statusOfflineAndReady;
        else if (state === 'caching') label = t.statusCachingProgress;
        else if (state === 'incomplete') label = t.statusOfflineIncomplete;
        else label = t.statusOfflineUnavailable;

        setText.textContent = label;
        if (cacheReady) {
          setBadge.className = 'inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3.5 py-2 text-xs font-bold text-emerald-300';
          setDot.className = 'h-2.5 w-2.5 rounded-full bg-emerald-400';
        } else {
          setBadge.className = 'inline-flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/15 px-3.5 py-2 text-xs font-bold text-amber-300';
          setDot.className = 'h-2.5 w-2.5 rounded-full bg-amber-400';
        }
      }
    }

    async function refreshOfflineStatus() {
      currentOfflineStatus = await verifyOfflineCacheReadiness();
      renderOfflineStatusIndicators();
    }
    if (typeof window !== 'undefined') {
      window.__zipRefreshOfflineStatus = refreshOfflineStatus;
    }

    function loadStoredSettings() {
      try {
        const rawSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
        const savedLang = localStorage.getItem(STORAGE_KEYS.LANGUAGE);
        if (rawSettings) {
          const parsed = JSON.parse(rawSettings);
          appSettings = Object.assign({}, appSettings, parsed);
        }
        if (savedLang === 'ckb' || savedLang === 'en') {
          appSettings.language = savedLang;
        } else if (appSettings.language !== 'ckb' && appSettings.language !== 'en') {
          appSettings.language = 'ckb';
        }
      } catch (e) {
        appSettings.language = 'ckb';
      }
      try {
        const rawLegacy = localStorage.getItem(STORAGE_KEYS.LEGACY_HISTORY);
        if (rawLegacy) {
          const parsed = JSON.parse(rawLegacy);
          if (Array.isArray(parsed)) {
            scanHistory = parsed.map(normalizeHistoryEntry);
          }
        }
      } catch (e) {}
    }

    function saveSettingsState() {
      try {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(appSettings));
        localStorage.setItem(STORAGE_KEYS.LANGUAGE, appSettings.language);
      } catch (e) {}
      applySettingsToUI();
    }

    async function initIndexedDBHistory() {
      try {
        if (navigator.storage && typeof navigator.storage.persist === 'function') {
          navigator.storage.persist().catch(() => {});
        }
      } catch (e) {}

      if (typeof indexedDB === 'undefined' || !indexedDB) {
        renderHistoryViews();
        return;
      }

      try {
        idbInstance = await new Promise((resolve, reject) => {
          const req = indexedDB.open(IDB_DATABASE_NAME, IDB_SCHEMA_VERSION);
          req.onupgradeneeded = (event) => {
            const db = req.result;
            const tx = req.transaction;
            let store;
            if (!db.objectStoreNames.contains(IDB_HISTORY_STORE)) {
              store = db.createObjectStore(IDB_HISTORY_STORE, { keyPath: 'id' });
            } else {
              store = tx.objectStore(IDB_HISTORY_STORE);
            }
            if (!store.indexNames.contains('by_timestamp')) {
              store.createIndex('by_timestamp', 'timestamp', { unique: false });
            }
            if (!store.indexNames.contains('by_ssid')) {
              store.createIndex('by_ssid', 'ssid', { unique: false });
            }
            const oldVersion = event.oldVersion || 0;
            if (oldVersion > 0 && oldVersion < 2) {
              const curReq = store.openCursor();
              curReq.onsuccess = () => {
                const cursor = curReq.result;
                if (cursor) {
                  cursor.update(normalizeHistoryEntry(cursor.value));
                  cursor.continue();
                }
              };
            }
          };
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });

        const idbRows = await new Promise((resolve) => {
          const tx = idbInstance.transaction(IDB_HISTORY_STORE, 'readonly');
          const store = tx.objectStore(IDB_HISTORY_STORE);
          const getAllReq = store.getAll();
          getAllReq.onsuccess = () => resolve(Array.isArray(getAllReq.result) ? getAllReq.result.map(normalizeHistoryEntry) : []);
          getAllReq.onerror = () => resolve([]);
        });

        const merged = new Map();
        [...scanHistory, ...idbRows].forEach((entry) => {
          const norm = normalizeHistoryEntry(entry);
          if (!merged.has(norm.id)) merged.set(norm.id, norm);
        });

        scanHistory = Array.from(merged.values())
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 200);

        for (const item of scanHistory) {
          await idbPutRecord(item);
        }
        try {
          if (localStorage.getItem(STORAGE_KEYS.LEGACY_HISTORY)) {
            localStorage.removeItem(STORAGE_KEYS.LEGACY_HISTORY);
          }
        } catch (e) {}

        if (!currentResult && scanHistory.length > 0) {
          currentResult = scanHistory[0].result;
          currentSourceLabel = 'Recent History';
          renderResultsPage();
        }
        renderHistoryViews();
      } catch (e) {
        renderHistoryViews();
      }
    }

    function idbPutRecord(entry) {
      if (!idbInstance) return Promise.resolve(false);
      return new Promise((resolve) => {
        try {
          const tx = idbInstance.transaction(IDB_HISTORY_STORE, 'readwrite');
          tx.objectStore(IDB_HISTORY_STORE).put(entry);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch (e) {
          resolve(false);
        }
      });
    }

    function idbDeleteRecord(id) {
      if (!idbInstance) return Promise.resolve(false);
      return new Promise((resolve) => {
        try {
          const tx = idbInstance.transaction(IDB_HISTORY_STORE, 'readwrite');
          tx.objectStore(IDB_HISTORY_STORE).delete(id);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch (e) {
          resolve(false);
        }
      });
    }

    function idbClearAllRecords() {
      if (!idbInstance) return Promise.resolve(false);
      return new Promise((resolve) => {
        try {
          const tx = idbInstance.transaction(IDB_HISTORY_STORE, 'readwrite');
          tx.objectStore(IDB_HISTORY_STORE).clear();
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch (e) {
          resolve(false);
        }
      });
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
        'ZIP QR — Wi-Fi QR Decoder — Decoded Credential Report',
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
    // BILINGUAL LANGUAGE & RTL/LTR ENGINE
    // =========================================================================
    function applyLanguageToDOM() {
      const lang = appSettings.language === 'en' ? 'en' : 'ckb';
      const isRtl = lang === 'ckb';
      const t = TRANSLATIONS[lang];

      document.documentElement.setAttribute('lang', lang);
      document.documentElement.setAttribute('dir', isRtl ? 'rtl' : 'ltr');
      document.body.setAttribute('dir', isRtl ? 'rtl' : 'ltr');
      document.title = t.brandDisplayTitle;

      document.querySelectorAll('[data-i18n]').forEach((el) => {
        const key = el.getAttribute('data-i18n');
        if (key && typeof t[key] === 'string') {
          el.textContent = t[key];
        }
      });

      document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (key && typeof t[key] === 'string') {
          el.setAttribute('placeholder', t[key]);
        }
      });

      const defCamOpt = document.getElementById('defaultCameraOption');
      if (defCamOpt) defCamOpt.textContent = t.defaultCameraLabel;

      const hdrCkb = document.getElementById('headerLangCkbBtn');
      const hdrEn = document.getElementById('headerLangEnBtn');
      if (hdrCkb && hdrEn) {
        if (lang === 'ckb') {
          hdrCkb.className = 'lang-switch-btn zip-gradient-btn rounded-lg px-2.5 py-1.5 text-xs font-bold text-white transition-all';
          hdrEn.className = 'lang-switch-btn rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-400 hover:text-white transition-all';
        } else {
          hdrEn.className = 'lang-switch-btn zip-gradient-btn rounded-lg px-2.5 py-1.5 text-xs font-bold text-white transition-all';
          hdrCkb.className = 'lang-switch-btn rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-400 hover:text-white transition-all';
        }
      }

      const setCkb = document.getElementById('settingsLangCkbBtn');
      const setEn = document.getElementById('settingsLangEnBtn');
      if (setCkb && setEn) {
        if (lang === 'ckb') {
          setCkb.className = 'settings-lang-card rounded-2xl border border-sky-400 bg-sky-500/15 p-4 text-start transition';
          setEn.className = 'settings-lang-card rounded-2xl border border-slate-800 zip-card p-4 text-start transition';
        } else {
          setEn.className = 'settings-lang-card rounded-2xl border border-sky-400 bg-sky-500/15 p-4 text-start transition';
          setCkb.className = 'settings-lang-card rounded-2xl border border-slate-800 zip-card p-4 text-start transition';
        }
      }

      const torchBtn = document.getElementById('scannerTorchBtn');
      if (torchBtn && !torchBtn.classList.contains('hidden')) {
        torchBtn.textContent = torchEnabled ? t.flashlightOn : t.flashlightOff;
      }

      renderOfflineStatusIndicators();
      renderResultsPage();
      renderHistoryViews();
    }

    function setLanguage(newLang) {
      const normalized = newLang === 'en' ? 'en' : 'ckb';
      appSettings.language = normalized;
      saveSettingsState();
      showToast(TRANSLATIONS[normalized].toastLanguageChanged);
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
          btn.className = 'nav-tab zip-gradient-btn rounded-xl px-2.5 py-2 text-xs font-bold text-white transition-all sm:px-3.5';
        } else {
          btn.className = 'nav-tab rounded-xl px-2.5 py-2 text-xs font-bold text-slate-400 hover:bg-slate-800/70 hover:text-white transition-all sm:px-3.5';
        }
      });

      if (pageId === 'scanner') {
        startLiveCameraScanner(appSettings.preferredCameraId);
      } else if (pageId === 'results') {
        renderResultsPage();
      } else if (pageId === 'history') {
        renderHistoryViews();
      } else if (pageId === 'settings') {
        void refreshOfflineStatus();
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // =========================================================================
    // HANDLE DECODED QR PAYLOAD & MULTI-QR SELECTION
    // =========================================================================
    function handleDecodedQR(rawPayload, sourceLabel) {
      const t = getT();
      const parsed = parseQRPayload(rawPayload);
      currentResult = parsed;
      currentSourceLabel = sourceLabel || 'QR Scan';
      isPasswordVisible = !appSettings.autoMaskPassword;

      const multiModal = document.getElementById('multiQrModal');
      if (multiModal) multiModal.classList.add('hidden');

      if (appSettings.historyEnabled) {
        const entry = normalizeHistoryEntry(parsed);
        const duplicates = scanHistory.filter((item) => item.id === entry.id || item.result.rawPayload === parsed.rawPayload);
        duplicates.forEach((d) => {
          void idbDeleteRecord(d.id);
        });
        scanHistory = [
          entry,
          ...scanHistory.filter((item) => item.id !== entry.id && item.result.rawPayload !== parsed.rawPayload)
        ].slice(0, 200);
        void idbPutRecord(entry);
        renderHistoryViews();
      }

      navigateTo('results');
      if (parsed.hasPasswordField && parsed.password !== null) {
        showToast(t.toastPasswordExtracted + ' "' + parsed.ssid + '"!');
      } else {
        showToast(t.toastDecodedPayload + ' (' + parsed.formatLabel + ')');
      }
    }

    function handleUploadedPayloads(payloads, sourceLabel) {
      if (!payloads || payloads.length === 0) {
        showToast(getT().toastDecodeError);
        return;
      }
      if (payloads.length === 1) {
        handleDecodedQR(payloads[0], sourceLabel);
        return;
      }
      const t = getT();
      const modal = document.getElementById('multiQrModal');
      const container = document.getElementById('multiQrListContainer');
      if (!modal || !container) {
        handleDecodedQR(payloads[0], sourceLabel);
        return;
      }
      container.innerHTML = '';
      payloads.forEach((raw) => {
        const parsed = parseQRPayload(raw);
        const card = document.createElement('div');
        card.className = 'flex items-center justify-between gap-3 rounded-2xl border border-slate-700 bg-[#070b16] p-4';

        const left = document.createElement('div');
        left.className = 'min-w-0';
        const badge = document.createElement('span');
        badge.setAttribute('dir', 'ltr');
        badge.className = 'rounded border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-300';
        badge.textContent = parsed.category === 'WIFI' ? parsed.securityType : parsed.category;
        const ssid = document.createElement('p');
        ssid.setAttribute('dir', 'ltr');
        ssid.className = 'font-mono-code mt-1.5 truncate text-sm font-bold text-white';
        ssid.textContent = parsed.ssid;
        left.appendChild(badge);
        left.appendChild(ssid);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'zip-gradient-btn rounded-xl px-3.5 py-2 text-xs font-bold text-white shrink-0';
        btn.textContent = t.btnSelectThisQr;
        btn.addEventListener('click', () => {
          modal.classList.add('hidden');
          handleDecodedQR(raw, sourceLabel);
        });

        card.appendChild(left);
        card.appendChild(btn);
        container.appendChild(card);
      });
      modal.classList.remove('hidden');
      showToast(t.toastMultipleQrFound);
    }

    // =========================================================================
    // RENDER RESULTS PAGE
    // =========================================================================
    function renderResultsPage() {
      const t = getT();
      const emptyEl = document.getElementById('resultsEmptyState');
      const wrapEl = document.getElementById('resultsContentWrap');
      if (!emptyEl || !wrapEl) return;
      if (!currentResult) {
        emptyEl.classList.remove('hidden');
        wrapEl.classList.add('hidden');
        return;
      }
      emptyEl.classList.add('hidden');
      wrapEl.classList.remove('hidden');

      document.getElementById('resCategoryBadge').textContent = currentResult.category;
      document.getElementById('resSourceBadge').textContent = t.sourcePrefix + ' ' + currentSourceLabel;
      document.getElementById('resSsidHeading').textContent = currentResult.ssid;
      document.getElementById('resTimestampText').textContent =
        t.decodedOnPrefix + ' ' + new Date(currentResult.timestamp).toLocaleString();

      const passValContainer = document.getElementById('resPasswordValueContainer');
      const noPassNotice = document.getElementById('resNoPasswordNotice');
      const passCharCount = document.getElementById('resPasswordCharCount');
      const passField = document.getElementById('resPasswordField');
      const toggleBtn = document.getElementById('resTogglePasswordBtn');

      const localizedNoPassMsg =
        currentResult.securityType === 'nopass'
          ? t.openNetworkNoPasswordMsg
          : currentResult.category === 'DPP'
          ? t.dppNoPasswordMsg
          : t.noPasswordEncodedMsg;

      if (currentResult.hasPasswordField && currentResult.password !== null) {
        passValContainer.classList.remove('hidden');
        noPassNotice.classList.add('hidden');
        passCharCount.textContent = currentResult.password.length + ' ' + t.charsSuffix;
        passCharCount.classList.remove('hidden');
        passField.textContent = isPasswordVisible ? currentResult.password : '••••••••';
        toggleBtn.textContent = isPasswordVisible ? t.btnHidePassword : t.btnShowPassword;
      } else {
        passValContainer.classList.add('hidden');
        noPassNotice.classList.remove('hidden');
        passCharCount.classList.add('hidden');
        noPassNotice.textContent = localizedNoPassMsg;
      }

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

      const localizedHidden =
        currentResult.hiddenDisplay === 'Yes'
          ? t.hiddenYes
          : currentResult.hiddenDisplay === 'No'
          ? t.hiddenNo
          : t.hiddenNA;

      document.getElementById('infoSsid').textContent = currentResult.ssid;
      document.getElementById('infoPassword').textContent =
        currentResult.hasPasswordField && currentResult.password !== null
          ? (isPasswordVisible ? currentResult.password : '••••••••')
          : localizedNoPassMsg;
      document.getElementById('infoSecurity').textContent = currentResult.securityDisplay;
      document.getElementById('infoHidden').textContent = localizedHidden;
      document.getElementById('infoFormat').textContent = currentResult.formatLabel;
      document.getElementById('infoRawPayload').textContent = currentResult.rawPayload;

      const extraContainer = document.getElementById('infoExtraFields');
      extraContainer.innerHTML = '';
      if (!currentResult.extraFields || currentResult.extraFields.length === 0) {
        const p = document.createElement('p');
        p.className = 'text-xs text-slate-400 sm:col-span-2';
        p.textContent = t.infoNoExtraParams;
        extraContainer.appendChild(p);
      } else {
        currentResult.extraFields.forEach((item) => {
          const card = document.createElement('div');
          card.className = 'rounded-xl border border-slate-800 zip-card p-3';
          const lbl = document.createElement('span');
          lbl.className = 'text-[11px] font-semibold text-slate-400';
          lbl.textContent = item.label;
          const val = document.createElement('p');
          val.setAttribute('dir', 'ltr');
          val.className = 'font-mono-code mt-1 break-all text-left text-xs text-white';
          val.textContent = item.value;
          card.appendChild(lbl);
          card.appendChild(val);
          extraContainer.appendChild(card);
        });
      }
    }

    // =========================================================================
    // RENDER PERSISTENT HISTORY CARDS (WITH MASKED SAVED PASSWORDS + REVEAL/COPY)
    // =========================================================================
    function createHistoryCardElement(entry, compact) {
      const t = getT();
      const res = entry.result;
      const savedPass = entry.password !== undefined ? entry.password : res.password;
      const hasSavedPassword = Boolean(res.hasPasswordField && savedPass !== null && String(savedPass).length > 0);
      const isRevealed = revealedHistoryPasswords.has(entry.id);

      const wrapper = document.createElement('div');
      wrapper.className = 'flex flex-col justify-between gap-3 rounded-2xl border border-slate-800/90 zip-card p-4 transition hover:border-sky-500/40';

      const topRow = document.createElement('div');
      topRow.className = 'flex flex-col justify-between gap-3 sm:flex-row sm:items-center';

      const left = document.createElement('div');
      left.className = 'min-w-0 flex-1';

      const badges = document.createElement('div');
      badges.className = 'flex flex-wrap items-center gap-2';

      const catBadge = document.createElement('span');
      catBadge.setAttribute('dir', 'ltr');
      catBadge.className = 'rounded-lg border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-300';
      catBadge.textContent = res.category === 'WIFI' ? res.securityType : res.category;
      badges.appendChild(catBadge);

      if (hasSavedPassword) {
        const pBadge = document.createElement('span');
        pBadge.className = 'rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300';
        pBadge.textContent = t.badgeSavedPassword;
        badges.appendChild(pBadge);
      }

      if (res.hiddenNetwork) {
        const hBadge = document.createElement('span');
        hBadge.className = 'rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300';
        hBadge.textContent = t.badgeHiddenSsid;
        badges.appendChild(hBadge);
      }

      const dateSpan = document.createElement('span');
      dateSpan.setAttribute('dir', 'ltr');
      dateSpan.className = 'text-[11px] text-slate-400';
      dateSpan.textContent = new Date(entry.timestamp).toLocaleString();
      badges.appendChild(dateSpan);

      const title = document.createElement('h4');
      title.setAttribute('dir', 'ltr');
      title.className = 'font-mono-code mt-1.5 truncate text-start text-base font-bold text-white';
      title.textContent = entry.ssid;

      left.appendChild(badges);
      left.appendChild(title);

      if (!compact && !hasSavedPassword) {
        const sub = document.createElement('p');
        sub.className = 'mt-1 truncate text-xs text-slate-400';
        sub.textContent = res.securityType === 'nopass'
          ? t.openNetworkNoPasswordMsg
          : res.category === 'DPP'
          ? t.dppNoPasswordMsg
          : t.noPasswordEncodedMsg;
        left.appendChild(sub);
      }

      const actions = document.createElement('div');
      actions.className = 'flex items-center gap-2 shrink-0';

      const openBtn = document.createElement('button');
      openBtn.type = 'button';
      openBtn.className = 'rounded-xl bg-sky-500/15 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-sky-300 hover:bg-sky-500/25';
      openBtn.textContent = t.btnOpenResult;
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
        delBtn.textContent = t.btnDeleteEntry;
        delBtn.addEventListener('click', () => {
          scanHistory = scanHistory.filter((item) => item.id !== entry.id);
          revealedHistoryPasswords.delete(entry.id);
          void idbDeleteRecord(entry.id);
          renderHistoryViews();
          showToast(getT().toastEntryDeleted);
        });
        actions.appendChild(delBtn);
      }

      topRow.appendChild(left);
      topRow.appendChild(actions);
      wrapper.appendChild(topRow);

      if (hasSavedPassword) {
        const passRow = document.createElement('div');
        passRow.className = 'flex flex-col justify-between gap-2.5 rounded-xl border border-slate-800 bg-[#050811] px-3.5 py-2.5 sm:flex-row sm:items-center';

        const passLeft = document.createElement('div');
        passLeft.className = 'flex items-center gap-2.5 min-w-0';

        const lbl = document.createElement('span');
        lbl.className = 'text-[11px] font-bold uppercase tracking-wider text-slate-400 shrink-0';
        lbl.textContent = t.infoLabel2Password + ':';

        const val = document.createElement('span');
        val.setAttribute('dir', 'ltr');
        val.className = 'font-mono-code text-sm font-bold text-sky-300 truncate';
        val.textContent = isRevealed ? String(savedPass) : '••••••••';

        const lenBadge = document.createElement('span');
        lenBadge.setAttribute('dir', 'ltr');
        lenBadge.className = 'rounded bg-slate-800 px-1.5 py-0.5 font-mono-code text-[10px] text-slate-400 shrink-0';
        lenBadge.textContent = String(savedPass).length + ' ' + t.charsSuffix;

        passLeft.appendChild(lbl);
        passLeft.appendChild(val);
        passLeft.appendChild(lenBadge);

        const passBtns = document.createElement('div');
        passBtns.className = 'flex items-center gap-2 shrink-0';

        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-200 hover:border-sky-400 hover:text-white';
        toggleBtn.textContent = isRevealed ? t.btnHidePassword : t.btnShowPassword;
        toggleBtn.addEventListener('click', () => {
          if (revealedHistoryPasswords.has(entry.id)) {
            revealedHistoryPasswords.delete(entry.id);
          } else {
            revealedHistoryPasswords.add(entry.id);
          }
          renderHistoryViews();
        });

        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'zip-gradient-btn rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white hover:brightness-110';
        copyBtn.textContent = t.btnCopyPassword;
        copyBtn.addEventListener('click', async () => {
          const ok = await copyToClipboardSafe(String(savedPass));
          if (ok) showToast(getT().toastPasswordCopied);
        });

        passBtns.appendChild(toggleBtn);
        passBtns.appendChild(copyBtn);

        passRow.appendChild(passLeft);
        passRow.appendChild(passBtns);
        wrapper.appendChild(passRow);
      }

      return wrapper;
    }

    function renderHistoryViews() {
      const t = getT();
      const badge = document.getElementById('navHistoryBadge');
      if (badge) badge.textContent = String(scanHistory.length);

      const homeList = document.getElementById('homeRecentList');
      if (homeList) {
        homeList.innerHTML = '';
        if (scanHistory.length === 0) {
          const empty = document.createElement('div');
          empty.className = 'rounded-2xl border border-slate-800/70 zip-card p-6 text-center text-xs text-slate-400';
          empty.textContent = t.emptyRecentText;
          homeList.appendChild(empty);
        } else {
          scanHistory.slice(0, 3).forEach((entry) => {
            homeList.appendChild(createHistoryCardElement(entry, true));
          });
        }
      }

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
            item.securityDisplay.toLowerCase().includes(q) ||
            (item.securityType && item.securityType.toLowerCase().includes(q))
          );
        });

        if (filtered.length === 0) {
          const empty = document.createElement('div');
          empty.className = 'rounded-3xl border border-slate-800 zip-surface p-10 text-center text-xs text-slate-400';
          empty.textContent = scanHistory.length === 0 ? t.historyEmptyText : t.historyNoMatchText;
          fullList.appendChild(empty);
        } else {
          filtered.forEach((entry) => {
            fullList.appendChild(createHistoryCardElement(entry, false));
          });
        }
      }
    }

    // =========================================================================
    // HIGH-SPEED LIVE CAMERA SCANNER LIFECYCLE (requestVideoFrameCallback + ROI + Hardware Capabilities)
    // =========================================================================
    function stopLiveCameraScanner() {
      if (scanIntervalId !== null) {
        clearInterval(scanIntervalId);
        scanIntervalId = null;
      }
      const video = document.getElementById('scannerVideo');
      if (rvfcHandle !== null && video && typeof video.cancelVideoFrameCallback === 'function') {
        try { video.cancelVideoFrameCallback(rvfcHandle); } catch (e) {}
        rvfcHandle = null;
      }
      isDecodingFrame = false;
      torchEnabled = false;
      if (activeStream) {
        activeStream.getTracks().forEach((t) => {
          try { t.stop(); } catch (e) {}
        });
        activeStream = null;
      }
      if (video) video.srcObject = null;
    }

    async function processSingleCameraFrame(video) {
      if (isDecodingFrame || !video || video.readyState < 2) return false;
      isDecodingFrame = true;
      try {
        const decoded = await decodeQRFromSource(video);
        if (decoded) {
          const now = Date.now();
          if (decoded === lastDecodedPayload && now - lastDecodedTime < 2500) {
            return false;
          }
          lastDecodedPayload = decoded;
          lastDecodedTime = now;
          stopLiveCameraScanner();
          handleDecodedQR(decoded, 'Live Camera Scan');
          return true;
        }
      } finally {
        isDecodingFrame = false;
      }
      return false;
    }

    async function startLiveCameraScanner(preferredDeviceId) {
      stopLiveCameraScanner();
      lastDecodedPayload = '';
      lastDecodedTime = 0;
      const t = getT();
      const video = document.getElementById('scannerVideo');
      const reticle = document.getElementById('scannerReticleOverlay');
      const fallbackBox = document.getElementById('scannerFallbackBox');
      const fallbackReason = document.getElementById('scannerFallbackReason');
      const statusPill = document.getElementById('scannerStatusPill');
      const torchBtn = document.getElementById('scannerTorchBtn');
      const camSelect = document.getElementById('cameraDeviceSelect');
      const switchCamBtn = document.getElementById('scannerSwitchCameraBtn');
      const zoomWrap = document.getElementById('scannerZoomWrap');
      const zoomSlider = document.getElementById('scannerZoomSlider');
      const zoomValue = document.getElementById('scannerZoomValue');

      if (torchBtn) torchBtn.classList.add('hidden');
      if (camSelect) camSelect.classList.add('hidden');
      if (switchCamBtn) switchCamBtn.classList.add('hidden');
      if (zoomWrap) {
        zoomWrap.classList.add('hidden');
        zoomWrap.classList.remove('flex');
      }

      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        video.classList.add('hidden');
        reticle.classList.add('hidden');
        fallbackBox.classList.remove('hidden');
        fallbackReason.textContent = t.scannerFallbackNoApi;
        return;
      }

      video.classList.remove('hidden');
      reticle.classList.remove('hidden');
      fallbackBox.classList.add('hidden');
      statusPill.textContent = t.scannerOpeningStream;

      const constraints = {
        audio: false,
        video: preferredDeviceId
          ? { deviceId: { exact: preferredDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 60 } }
          : { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 60 } }
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
          fallbackReason.textContent = t.scannerFallbackDenied;
          return;
        }
      }

      video.srcObject = activeStream;
      try {
        await video.play();
      } catch (e) {}
      statusPill.textContent = getT().scannerAlignPrompt;

      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cams = devices.filter((d) => d.kind === 'videoinput');
        cams.sort((a, b) => {
          const aBack = (a.label || '').toLowerCase().includes('back') || (a.label || '').toLowerCase().includes('rear');
          const bBack = (b.label || '').toLowerCase().includes('back') || (b.label || '').toLowerCase().includes('rear');
          return (bBack ? 1 : 0) - (aBack ? 1 : 0);
        });
        availableCameras = cams;
        if (cams.length > 1) {
          camSelect.innerHTML = '';
          cams.forEach((c, idx) => {
            const opt = document.createElement('option');
            opt.value = c.deviceId;
            opt.textContent = c.label || (getT().cameraItemPrefix + ' ' + (idx + 1));
            camSelect.appendChild(opt);
          });
          const activeTrack = activeStream.getVideoTracks()[0];
          const curId = activeTrack && activeTrack.getSettings ? activeTrack.getSettings().deviceId : '';
          if (curId) camSelect.value = curId;
          camSelect.classList.remove('hidden');
          switchCamBtn.classList.remove('hidden');
        }
      } catch (e) {}

      const track = activeStream.getVideoTracks()[0];
      if (track && typeof track.getCapabilities === 'function') {
        try {
          const caps = track.getCapabilities();
          const settings = typeof track.getSettings === 'function' ? track.getSettings() : {};

          if (caps && caps.torch) {
            torchBtn.classList.remove('hidden');
            torchBtn.textContent = getT().flashlightOff;
          }

          if (caps && caps.zoom && typeof caps.zoom === 'object' && caps.zoom.max > caps.zoom.min) {
            const minZ = typeof caps.zoom.min === 'number' ? caps.zoom.min : 1;
            const maxZ = Math.min(typeof caps.zoom.max === 'number' ? caps.zoom.max : 3, 5);
            const stepZ = typeof caps.zoom.step === 'number' && caps.zoom.step > 0 ? caps.zoom.step : 0.1;
            const curZ = typeof settings.zoom === 'number' ? settings.zoom : minZ;
            zoomSlider.min = String(minZ);
            zoomSlider.max = String(maxZ);
            zoomSlider.step = String(stepZ);
            zoomSlider.value = String(curZ);
            zoomValue.textContent = Number(curZ).toFixed(1) + 'x';
            zoomWrap.classList.remove('hidden');
            zoomWrap.classList.add('flex');
          }

          const adv = {};
          if (Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) adv.focusMode = 'continuous';
          if (Array.isArray(caps.exposureMode) && caps.exposureMode.includes('continuous')) adv.exposureMode = 'continuous';
          if (Object.keys(adv).length > 0) {
            track.applyConstraints({ advanced: [adv] }).catch(() => {});
          }
        } catch (e) {}
      }

      if (typeof video.requestVideoFrameCallback === 'function') {
        let lastFrameCheck = 0;
        const onVideoFrame = async (now) => {
          if (!activeStream) return;
          if (now - lastFrameCheck >= 85 && !isDecodingFrame) {
            lastFrameCheck = now;
            const found = await processSingleCameraFrame(video);
            if (found) return;
          }
          if (activeStream && typeof video.requestVideoFrameCallback === 'function') {
            rvfcHandle = video.requestVideoFrameCallback(onVideoFrame);
          }
        };
        rvfcHandle = video.requestVideoFrameCallback(onVideoFrame);
      } else {
        scanIntervalId = setInterval(() => {
          void processSingleCameraFrame(video);
        }, 100);
      }
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
          btn.className = 'theme-card rounded-2xl border border-sky-400 bg-sky-500/15 p-4 text-start transition';
        } else {
          btn.className = 'theme-card rounded-2xl border border-slate-800 zip-card p-4 text-start transition';
        }
      });

      applyLanguageToDOM();
    }

    // =========================================================================
    // WIRE ALL EVENT LISTENERS ON DOM READY
    // =========================================================================
    window.addEventListener('DOMContentLoaded', () => {
      loadStoredSettings();
      applySettingsToUI();
      navigateTo('home');
      void initIndexedDBHistory();
      void refreshOfflineStatus();

      window.addEventListener('online', () => { void refreshOfflineStatus(); });
      window.addEventListener('offline', () => { void refreshOfflineStatus(); });

      // Native PWA installation & standalone mode detection
      const installBtn = document.getElementById('settingsInstallPwaBtn');
      const installedBadge = document.getElementById('settingsPwaInstalledBadge');
      const manualHint = document.getElementById('settingsInstallManualHint');

      if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
        if (installedBadge) installedBadge.classList.remove('hidden');
        if (manualHint) manualHint.classList.add('hidden');
      }

      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredInstallPrompt = e;
        if (installBtn) installBtn.classList.remove('hidden');
        if (manualHint) manualHint.classList.add('hidden');
      });

      if (installBtn) {
        installBtn.addEventListener('click', async () => {
          if (!deferredInstallPrompt) return;
          await deferredInstallPrompt.prompt();
          await deferredInstallPrompt.userChoice;
          deferredInstallPrompt = null;
          installBtn.classList.add('hidden');
        });
      }

      const hdrOfflineBtn = document.getElementById('headerOfflineStatusBtn');
      if (hdrOfflineBtn) {
        hdrOfflineBtn.addEventListener('click', () => navigateTo('settings'));
      }

      document.querySelectorAll('[data-lang-switch]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const targetLang = btn.getAttribute('data-lang-switch');
          setLanguage(targetLang);
        });
      });

      document.querySelectorAll('.nav-tab').forEach((btn) => {
        btn.addEventListener('click', () => {
          navigateTo(btn.getAttribute('data-nav'));
        });
      });

      document.getElementById('brandHomeBtn').addEventListener('click', () => navigateTo('home'));
      document.getElementById('homeScanBtn').addEventListener('click', () => navigateTo('scanner'));
      document.getElementById('homeCardScanBtn').addEventListener('click', () => navigateTo('scanner'));
      document.getElementById('homeViewAllHistoryBtn').addEventListener('click', () => navigateTo('history'));

      const multiCloseBtn = document.getElementById('multiQrCloseBtn');
      if (multiCloseBtn) {
        multiCloseBtn.addEventListener('click', () => {
          document.getElementById('multiQrModal').classList.add('hidden');
        });
      }

      const triggerHomePasteDecode = () => {
        const pasteInput = document.getElementById('homePasteInput');
        if (pasteInput && pasteInput.value.trim()) {
          handleDecodedQR(pasteInput.value.trim(), 'Pasted QR Content');
          pasteInput.value = '';
        } else {
          showToast(getT().toastEnterPayload);
        }
      };
      document.getElementById('homePasteDecodeBtn').addEventListener('click', triggerHomePasteDecode);
      document.getElementById('homePasteInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          triggerHomePasteDecode();
        }
      });

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
          const payloads = await decodeAllQRCodesFromFile(file);
          handleUploadedPayloads(payloads, 'Uploaded Image (' + file.name + ')');
        } catch (err) {
          showToast(getT().toastDecodeError);
        } finally {
          fileInput.value = '';
        }
      });

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
          const payloads = await decodeAllQRCodesFromFile(file);
          handleUploadedPayloads(payloads, 'Dropped Image (' + file.name + ')');
        } catch (err) {
          showToast(getT().toastDecodeError);
        }
      });

      document.getElementById('scannerCancelTopBtn').addEventListener('click', () => navigateTo('home'));
      document.getElementById('scannerCancelBottomBtn').addEventListener('click', () => navigateTo('home'));
      document.getElementById('scannerRetryCameraBtn').addEventListener('click', () => startLiveCameraScanner(appSettings.preferredCameraId));
      document.getElementById('cameraDeviceSelect').addEventListener('change', (e) => {
        appSettings.preferredCameraId = e.target.value;
        saveSettingsState();
        startLiveCameraScanner(e.target.value);
      });
      document.getElementById('scannerSwitchCameraBtn').addEventListener('click', () => {
        if (availableCameras.length < 2) return;
        const selectEl = document.getElementById('cameraDeviceSelect');
        const curIdx = availableCameras.findIndex((c) => c.deviceId === selectEl.value);
        const nextCam = availableCameras[(curIdx + 1) % availableCameras.length];
        if (nextCam) {
          selectEl.value = nextCam.deviceId;
          appSettings.preferredCameraId = nextCam.deviceId;
          saveSettingsState();
          startLiveCameraScanner(nextCam.deviceId);
        }
      });
      document.getElementById('scannerTorchBtn').addEventListener('click', async () => {
        if (!activeStream) return;
        const track = activeStream.getVideoTracks()[0];
        if (!track) return;
        try {
          torchEnabled = !torchEnabled;
          await track.applyConstraints({ advanced: [{ torch: torchEnabled }] });
          document.getElementById('scannerTorchBtn').textContent = torchEnabled ? getT().flashlightOn : getT().flashlightOff;
        } catch (e) {
          showToast(getT().toastTorchUnsupported);
        }
      });
      document.getElementById('scannerZoomSlider').addEventListener('input', async (e) => {
        const z = Number(e.target.value);
        document.getElementById('scannerZoomValue').textContent = z.toFixed(1) + 'x';
        if (!activeStream) return;
        const track = activeStream.getVideoTracks()[0];
        if (!track) return;
        try {
          await track.applyConstraints({ advanced: [{ zoom: z }] });
        } catch (err) {}
      });

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
        if (ok) showToast(getT().toastPasswordCopied);
      });

      document.getElementById('resCopySsidBtn').addEventListener('click', async () => {
        if (!currentResult) return;
        const ok = await copyToClipboardSafe(currentResult.ssid);
        if (ok) showToast(getT().toastSsidCopied);
      });

      document.getElementById('resCopyAllBtn').addEventListener('click', async () => {
        if (!currentResult) return;
        const report = buildFormattedReport(currentResult);
        const ok = await copyToClipboardSafe(report);
        if (ok) showToast(getT().toastAllCopied);
      });

      document.getElementById('resDownloadTxtBtn').addEventListener('click', () => {
        if (!currentResult) return;
        downloadReportFile(currentResult, 'txt');
        showToast(getT().toastDownloadedTxt);
      });

      document.getElementById('resDownloadJsonBtn').addEventListener('click', () => {
        if (!currentResult) return;
        downloadReportFile(currentResult, 'json');
        showToast(getT().toastDownloadedJson);
      });

      document.getElementById('manualDecodeBtn').addEventListener('click', () => {
        const input = document.getElementById('manualPayloadInput');
        if (input && input.value.trim()) {
          handleDecodedQR(input.value.trim(), 'Pasted QR Content');
          input.value = '';
        } else {
          showToast(getT().toastEnterPayload);
        }
      });

      document.getElementById('historySearchInput').addEventListener('input', () => renderHistoryViews());
      document.getElementById('historyToggleCheckbox').addEventListener('change', (e) => {
        appSettings.historyEnabled = e.target.checked;
        saveSettingsState();
        showToast(appSettings.historyEnabled ? getT().toastHistoryEnabled : getT().toastHistoryPaused);
      });
      document.getElementById('historyClearAllBtn').addEventListener('click', () => {
        document.getElementById('historyClearModal').classList.remove('hidden');
      });
      document.getElementById('historyCancelClearBtn').addEventListener('click', () => {
        document.getElementById('historyClearModal').classList.add('hidden');
      });
      document.getElementById('historyConfirmClearBtn').addEventListener('click', () => {
        scanHistory = [];
        revealedHistoryPasswords.clear();
        void idbClearAllRecords();
        renderHistoryViews();
        document.getElementById('historyClearModal').classList.add('hidden');
        showToast(getT().toastHistoryCleared);
      });

      document.querySelectorAll('.theme-card').forEach((btn) => {
        btn.addEventListener('click', () => {
          appSettings.accentTheme = btn.getAttribute('data-theme-choice');
          saveSettingsState();
          showToast(getT().toastThemeUpdated);
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
        const preservedLang = appSettings.language || 'ckb';
        scanHistory = [];
        revealedHistoryPasswords.clear();
        void idbClearAllRecords();
        appSettings = {
          language: preservedLang,
          historyEnabled: true,
          autoMaskPassword: false,
          accentTheme: 'electric-blue',
          preferredCameraId: ''
        };
        try {
          localStorage.removeItem(STORAGE_KEYS.LEGACY_HISTORY);
          localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(appSettings));
          localStorage.setItem(STORAGE_KEYS.LANGUAGE, preservedLang);
        } catch (e) {}
        applySettingsToUI();
        renderHistoryViews();
        document.getElementById('settingsWipeConfirmBox').classList.add('hidden');
        showToast(getT().toastDataWiped);
      });
    });
