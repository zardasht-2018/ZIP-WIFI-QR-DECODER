"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.parseQRPayload = parseQRPayload;
exports.tokenizeEscapedKeyValueBody = tokenizeEscapedKeyValueBody;
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