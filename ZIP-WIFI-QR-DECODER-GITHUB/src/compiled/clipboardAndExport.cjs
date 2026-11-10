"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.copyTextToClipboard = copyTextToClipboard;
exports.downloadDecodedResult = downloadDecodedResult;
exports.formatResultReport = formatResultReport;
/**
 * ZIP QR — Wi-Fi QR Decoder — Clipboard & Safe Export Utilities
 */

/**
 * Copies text to clipboard using modern Clipboard API with `document.execCommand('copy')` fallback
 * for sandboxed iframes and older mobile browsers.
 */
async function copyTextToClipboard(text) {
  if (!text) return false;
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to execCommand fallback
    }
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Formats all decoded information from a `ParsedQRResult` into a structured human-readable report
 */
function formatResultReport(result) {
  const lines = ['==================================================', 'ZIP QR — Wi-Fi QR Decoder — Decoded Credential Report', 'SCAN. REVEAL. CONNECT.', '==================================================', `Scan Timestamp     : ${new Date(result.timestamp).toLocaleString()}`, `Payload Format     : ${result.formatLabel}`, `Payload Category   : ${result.category}`, '--------------------------------------------------', 'NETWORK INFORMATION', '--------------------------------------------------', `1. Wi-Fi Name (SSID)      : ${result.ssid}`, `2. Wi-Fi Password         : ${result.hasPasswordField && result.password !== null ? result.password : result.passwordStatusMessage}`, `3. Security Type          : ${result.securityDisplay}`, `4. Hidden Network Status  : ${result.hiddenDisplay}`, `5. QR Payload Format      : ${result.formatLabel}`];
  if (result.extraFields.length > 0) {
    lines.push('--------------------------------------------------');
    lines.push('6. ADDITIONAL ENCODED PARAMETERS');
    lines.push('--------------------------------------------------');
    for (const item of result.extraFields) {
      lines.push(`- ${item.label} [${item.key}]: ${item.value}`);
    }
  }
  lines.push('--------------------------------------------------');
  lines.push('RAW DECODED QR PAYLOAD');
  lines.push('--------------------------------------------------');
  lines.push(result.rawPayload || '(empty)');
  lines.push('==================================================');
  return lines.join('\n');
}

/**
 * Downloads the decoded result as a `.txt` or `.json` file.
 * Security requirement: Never expose passwords or sensitive SSID strings in exported filenames!
 */
function downloadDecodedResult(result, format = 'txt') {
  const dateStamp = new Date(result.timestamp).toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const safeFilename = `zip-qr-decoded-report-${dateStamp}.${format}`;
  const content = format === 'json' ? JSON.stringify(result, null, 2) : formatResultReport(result);
  const mimeType = format === 'json' ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8';
  const blob = new Blob([content], {
    type: mimeType
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = safeFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}