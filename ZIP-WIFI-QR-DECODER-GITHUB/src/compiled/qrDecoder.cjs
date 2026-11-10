"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.decodeAllQRCodesFromFile = decodeAllQRCodesFromFile;
exports.decodeAllQRCodesFromSource = decodeAllQRCodesFromSource;
exports.decodeQRFromFile = decodeQRFromFile;
exports.decodeQRFromSource = decodeQRFromSource;
exports.decodeQRModuleMatrix = decodeQRModuleMatrix;
exports.extractAllQRCodesFromImageData = extractAllQRCodesFromImageData;
exports.extractAndDecodeFromImageData = extractAndDecodeFromImageData;
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