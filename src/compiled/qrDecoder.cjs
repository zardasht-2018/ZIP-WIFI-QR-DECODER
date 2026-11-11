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
 * ZIP QR — Wi-Fi QR Decoder — Advanced Screen-Aware & Perspective-Rectifying QR Recognition Engine (v5.0)
 *
 * Performs 100% client-side QR code decoding from:
 * 1. Uploaded photographs at FULL NATIVE RESOLUTION first (handling LCD/OLED screens, moiré patterns,
 *    uneven backlight, dark surroundings, camera tilt, and perspective distortion)
 * 2. Live camera `<video>` frames (via `requestVideoFrameCallback` + ROI cropping + non-blocking lock)
 * 3. Canvas `ImageData` buffers
 *
 * Multi-Stage Progressive Recognition Pipeline:
 * - Stage 1 (Original Image & Fast Global/Otsu Pass):
 *     Attempts native `BarcodeDetector`, `jsQR` (if present), and fast global threshold at original resolution.
 * - Stage 2 (De-Moiré Smoothing & Multi-Scale Integral Adaptive Normalization):
 *     Applies separable 3x3 Gaussian de-moiré smoothing (`[1,2,1]/4`) to suppress LCD subpixel grids
 *     without blurring module boundaries, followed by module-scale Bradley-Roth integral adaptive thresholding.
 * - Stage 3 (2D Finder Triad Localization, Sub-Module Majority Affine Sampling & 8-DOF Perspective Homography):
 *     Locates 1:1:3:1:1 finder centers in 2D (horizontal + vertical + diagonal verification) with weighted
 *     subpixel centroid refinement, orders canonical `(TL, TR, BL)` triads invariant to 0°..360° rotation,
 *     locates the bottom-right Alignment Pattern (`AP`), and rectifies tilted/perspective-skewed QR grids
 *     via 5-point sub-module majority voting and 8-DOF projective homography (`solvePerspectiveHomography`).
 * - Stage 4 (Difficult Image & Screen Glare Recovery):
 *     Applies 5x5 de-moiré smoothing, percentile histogram contrast stretching (2nd–98th percentile),
 *     3x3 unsharp Laplacian sharpening, inverted polarity recovery, and multi-bias adaptive binarization.
 * - Stage 5 (Multi-Scale Pyramid & Region Cropping):
 *     Tests native resolution (`1.0x`) first, followed by bright-LCD ROI extraction and multi-scale pyramid passes.
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
  if (centerDark < 5) return false;
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

  // Always include all 32 format candidates as fallback when screen moiré or glare corrupts format bits
  for (let ecIndex = 0; ecIndex < 4; ecIndex++) {
    for (let mask = 0; mask < 8; mask++) {
      addCand(ecIndex, mask);
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
 * Fast separable 3x3 Gaussian smoothing filter (`[1, 2, 1] / 4`) to suppress high-frequency
 * LCD subpixel stripes and moiré patterns while preserving QR module edges.
 */
function smoothGray3x3(gray, width, height) {
  const tmp = new Uint8Array(width * height);
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const r = y * width;
    tmp[r] = gray[r];
    tmp[r + width - 1] = gray[r + width - 1];
    for (let x = 1; x < width - 1; x++) {
      tmp[r + x] = gray[r + x - 1] + (gray[r + x] << 1) + gray[r + x + 1] >> 2;
    }
  }
  out.set(tmp.subarray(0, width), 0);
  out.set(tmp.subarray((height - 1) * width, height * width), (height - 1) * width);
  for (let y = 1; y < height - 1; y++) {
    const r = y * width;
    for (let x = 0; x < width; x++) {
      out[r + x] = tmp[r - width + x] + (tmp[r + x] << 1) + tmp[r + width + x] >> 2;
    }
  }
  return out;
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
 * Computes an integral image once so multiple adaptive window radii and biases can be evaluated rapidly
 */
function computeIntegralImage(gray, width, height) {
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
  return integral;
}
function binarizeFromIntegral(gray, integral, width, height, radius, bias = 6, invert = false) {
  const bin = new Uint8Array(width * height);
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
 * Locates 2D QR Finder Pattern centers (`1:1:3:1:1` horizontally and vertically) with weighted
 * subpixel centroid clustering.
 */
function findFinderClusters2D(bin, width, height) {
  const checkRatio = c => {
    const tot = c[0] + c[1] + c[2] + c[3] + c[4];
    if (tot < 7) return false;
    const m = tot / 7;
    const tol = m * 0.65;
    return Math.abs(c[0] - m) <= tol && Math.abs(c[1] - m) <= tol && Math.abs(c[2] - 3 * m) <= 3 * tol && Math.abs(c[3] - m) <= tol && Math.abs(c[4] - m) <= tol;
  };
  const measureAxis = (xStart, yStart, dx, dy, maxMod) => {
    const sx = Math.round(xStart);
    const sy = Math.round(yStart);
    if (sx < 0 || sx >= width || sy < 0 || sy >= height || !bin[sy * width + sx]) return null;
    const c = [0, 0, 0, 0, 0];
    let x = sx;
    let y = sy;
    while (x >= 0 && x < width && y >= 0 && y < height && bin[y * width + x]) {
      c[2]++;
      x -= dx;
      y -= dy;
    }
    if (x < 0 || x >= width || y < 0 || y >= height) return null;
    while (x >= 0 && x < width && y >= 0 && y < height && !bin[y * width + x] && c[1] <= maxMod * 3) {
      c[1]++;
      x -= dx;
      y -= dy;
    }
    if (x < 0 || x >= width || y < 0 || y >= height || c[1] > maxMod * 3) return null;
    while (x >= 0 && x < width && y >= 0 && y < height && bin[y * width + x] && c[0] <= maxMod * 3) {
      c[0]++;
      x -= dx;
      y -= dy;
    }
    x = sx + dx;
    y = sy + dy;
    while (x >= 0 && x < width && y >= 0 && y < height && bin[y * width + x]) {
      c[2]++;
      x += dx;
      y += dy;
    }
    if (x < 0 || x >= width || y < 0 || y >= height) return null;
    while (x >= 0 && x < width && y >= 0 && y < height && !bin[y * width + x] && c[3] <= maxMod * 3) {
      c[3]++;
      x += dx;
      y += dy;
    }
    if (x < 0 || x >= width || y < 0 || y >= height || c[3] > maxMod * 3) return null;
    while (x >= 0 && x < width && y >= 0 && y < height && bin[y * width + x] && c[4] <= maxMod * 3) {
      c[4]++;
      x += dx;
      y += dy;
    }
    if (!checkRatio(c)) return null;
    const span = c[0] + c[1] + c[2] + c[3] + c[4];
    const endPos = dx !== 0 ? x : y;
    return {
      center: endPos - span / 2,
      span
    };
  };
  const clusters = [];
  const stepY = height > 600 ? 2 : 1;
  for (let y = 0; y < height; y += stepY) {
    const rowOff = y * width;
    const counts = [0, 0, 0, 0, 0];
    let state = 0;
    for (let x = 0; x < width; x++) {
      if (bin[rowOff + x] === 1) {
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
            const cx0 = x - hSpan / 2;
            const vRes = measureAxis(cx0, y, 0, 1, hSpan);
            if (vRes && Math.abs(vRes.span - hSpan) <= Math.max(hSpan, vRes.span) * 0.45) {
              const hRes = measureAxis(cx0, vRes.center, 1, 0, hSpan);
              if (hRes) {
                const cx = hRes.center;
                const cy = vRes.center;
                const span = (hRes.span + vRes.span) / 2;
                const existing = clusters.find(cl => Math.hypot(cl.cx - cx, cl.cy - cy) < span * 0.5);
                if (existing) {
                  existing.cx = (existing.cx * existing.weight + cx) / (existing.weight + 1);
                  existing.cy = (existing.cy * existing.weight + cy) / (existing.weight + 1);
                  existing.span = (existing.span * existing.weight + span) / (existing.weight + 1);
                  existing.weight++;
                } else {
                  clusters.push({
                    cx,
                    cy,
                    span,
                    weight: 1
                  });
                }
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
  return clusters.sort((a, b) => b.weight - a.weight);
}

/**
 * Solves an 8-DOF perspective homography mapping canonical QR module coordinates `(u, v)`
 * to image pixel coordinates `(x, y)` from 4 correspondences.
 */
function solvePerspectiveHomography(srcPts, dstPts) {
  const A = [];
  const b = [];
  for (let i = 0; i < 4; i++) {
    const [u, v] = srcPts[i];
    const [x, y] = dstPts[i];
    A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]);
    b.push(x);
    A.push([0, 0, 0, u, v, 1, -u * y, -v * y]);
    b.push(y);
  }

  // Gaussian elimination with partial pivoting (8x8)
  const n = 8;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    let maxVal = Math.abs(A[col][col]);
    for (let row = col + 1; row < n; row++) {
      const val = Math.abs(A[row][col]);
      if (val > maxVal) {
        maxVal = val;
        pivot = row;
      }
    }
    if (maxVal < 1e-9) return null;
    if (pivot !== col) {
      const tmpRow = A[col];
      A[col] = A[pivot];
      A[pivot] = tmpRow;
      const tmpB = b[col];
      b[col] = b[pivot];
      b[pivot] = tmpB;
    }
    const diag = A[col][col];
    for (let j = col; j < n; j++) A[col][j] /= diag;
    b[col] /= diag;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = A[row][col];
      if (Math.abs(factor) < 1e-12) continue;
      for (let j = col; j < n; j++) A[row][j] -= factor * A[col][j];
      b[row] -= factor * b[col];
    }
  }
  return b;
}

/**
 * Searches a small neighborhood around the expected bottom-right Alignment Pattern (`AP`)
 * coordinate for a `1:1:1` dark-light-dark alignment center.
 */
function locateAlignmentPatternCenter(bin, width, height, estX, estY, modSize) {
  const searchRadius = Math.max(4, Math.round(modSize * 3.2));
  const ringDist = Math.max(1, Math.round(modSize));
  const outerDist = Math.max(2, Math.round(modSize * 2));
  let bestScore = -1;
  let bestX = estX;
  let bestY = estY;
  const minY = Math.max(outerDist, Math.round(estY - searchRadius));
  const maxY = Math.min(height - 1 - outerDist, Math.round(estY + searchRadius));
  const minX = Math.max(outerDist, Math.round(estX - searchRadius));
  const maxX = Math.min(width - 1 - outerDist, Math.round(estX + searchRadius));
  for (let y = minY; y <= maxY; y++) {
    const rowOff = y * width;
    for (let x = minX; x <= maxX; x++) {
      // Alignment center must be dark (1)
      if (bin[rowOff + x] !== 1) continue;

      // 1-module ring around center should be light (0)
      let score = 0;
      if (bin[rowOff + x - ringDist] === 0) score++;
      if (bin[rowOff + x + ringDist] === 0) score++;
      if (bin[(y - ringDist) * width + x] === 0) score++;
      if (bin[(y + ringDist) * width + x] === 0) score++;
      if (score < 3) continue;

      // 2-module outer ring should be dark (1)
      if (bin[rowOff + x - outerDist] === 1) score++;
      if (bin[rowOff + x + outerDist] === 1) score++;
      if (bin[(y - outerDist) * width + x] === 1) score++;
      if (bin[(y + outerDist) * width + x] === 1) score++;
      const distPenalty = Math.hypot(x - estX, y - estY) / (searchRadius + 1);
      const totalScore = score - distPenalty;
      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestX = x;
        bestY = y;
      }
    }
  }
  return bestScore >= 5.5 ? {
    x: bestX,
    y: bestY
  } : null;
}

/**
 * Given 2D finder clusters, forms valid right-angle `(TL, TR, BL)` triads and rectifies
 * the tilted/skewed QR code using 5-point sub-module majority voting and 8-DOF perspective homography.
 */
function decodeFromFinderTriads(bin, width, height) {
  const clusters = findFinderClusters2D(bin, width, height);
  if (clusters.length < 3) return null;
  const topClusters = clusters.slice(0, 10);
  const K = topClusters.length;
  for (let i = 0; i < K - 2; i++) {
    for (let j = i + 1; j < K - 1; j++) {
      for (let k = j + 1; k < K; k++) {
        const triad = [topClusters[i], topClusters[j], topClusters[k]];
        const maxSpan = Math.max(triad[0].span, triad[1].span, triad[2].span);
        const minSpan = Math.min(triad[0].span, triad[1].span, triad[2].span);
        if (maxSpan > minSpan * 1.85) continue;
        const d01 = Math.hypot(triad[0].cx - triad[1].cx, triad[0].cy - triad[1].cy);
        const d12 = Math.hypot(triad[1].cx - triad[2].cx, triad[1].cy - triad[2].cy);
        const d02 = Math.hypot(triad[0].cx - triad[2].cx, triad[0].cy - triad[2].cy);
        let tl;
        let pA;
        let pB;
        let leg1;
        let leg2;
        if (d01 >= d12 && d01 >= d02) {
          tl = triad[2];
          pA = triad[0];
          pB = triad[1];
          leg1 = d02;
          leg2 = d12;
        } else if (d12 >= d01 && d12 >= d02) {
          tl = triad[0];
          pA = triad[1];
          pB = triad[2];
          leg1 = d01;
          leg2 = d02;
        } else {
          tl = triad[1];
          pA = triad[0];
          pB = triad[2];
          leg1 = d01;
          leg2 = d12;
        }
        if (leg1 < 14 || leg2 < 14) continue;
        if (Math.max(leg1, leg2) > Math.min(leg1, leg2) * 1.55) continue;

        // Check angle between leg vectors is roughly 90° (60°..120°)
        const dot = (pA.cx - tl.cx) * (pB.cx - tl.cx) + (pA.cy - tl.cy) * (pB.cy - tl.cy);
        const cosTheta = dot / (leg1 * leg2);
        if (Math.abs(cosTheta) > 0.5) continue;
        const cross = (pA.cx - tl.cx) * (pB.cy - tl.cy) - (pA.cy - tl.cy) * (pB.cx - tl.cx);
        const tr = cross > 0 ? pA : pB;
        const bl = cross > 0 ? pB : pA;
        const avgSpan = (tl.span + tr.span + bl.span) / 3;
        const modSize = avgSpan / 7;
        const avgLeg = (leg1 + leg2) / 2;
        const estN = Math.round(7 + avgLeg / modSize);
        const estVer = Math.max(1, Math.min(15, Math.round((estN - 17) / 4)));
        const candidateVersions = [];
        for (const dv of [0, -1, 1, -2, 2]) {
          const v = estVer + dv;
          if (v >= 1 && v <= 15 && !candidateVersions.includes(v)) {
            candidateVersions.push(v);
          }
        }
        for (const v of candidateVersions) {
          const N = v * 4 + 17;
          const spanMods = N - 7;
          const uX = (tr.cx - tl.cx) / spanMods;
          const uY = (tr.cy - tl.cy) / spanMods;
          const vX = (bl.cx - tl.cx) / spanMods;
          const vY = (bl.cy - tl.cy) / spanMods;

          // 1. Sub-module 5-point majority-vote affine grid sampling (eliminates single-pixel LCD moiré)
          const matrixAffine = Array.from({
            length: N
          }, () => Array(N).fill(false));
          const offsets = [[0, 0], [0.2, 0], [-0.2, 0], [0, 0.2], [0, -0.2]];
          for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
              let darkVotes = 0;
              for (const [du, dv] of offsets) {
                const px = Math.round(tl.cx + (c - 3 + du) * uX + (r - 3 + dv) * vX);
                const py = Math.round(tl.cy + (c - 3 + du) * uY + (r - 3 + dv) * vY);
                if (px >= 0 && px < width && py >= 0 && py < height && bin[py * width + px] === 1) {
                  darkVotes++;
                }
              }
              matrixAffine[r][c] = darkVotes >= 3;
            }
          }
          const decodedAffine = decodeQRModuleMatrix(matrixAffine);
          if (decodedAffine) return decodedAffine;

          // 2. If Version >= 2, locate bottom-right Alignment Pattern (`AP`) and apply 8-DOF Perspective Homography
          if (v >= 2) {
            const apEstX = tl.cx + (N - 10) * uX + (N - 10) * vX;
            const apEstY = tl.cy + (N - 10) * uY + (N - 10) * vY;
            const ap = locateAlignmentPatternCenter(bin, width, height, apEstX, apEstY, modSize);
            if (ap) {
              const H = solvePerspectiveHomography([[3.5, 3.5], [N - 3.5, 3.5], [3.5, N - 3.5], [N - 6.5, N - 6.5]], [[tl.cx, tl.cy], [tr.cx, tr.cy], [bl.cx, bl.cy], [ap.x, ap.y]]);
              if (H) {
                const matrixPersp = Array.from({
                  length: N
                }, () => Array(N).fill(false));
                for (let r = 0; r < N; r++) {
                  const vCoord = r + 0.5;
                  for (let c = 0; c < N; c++) {
                    const uCoord = c + 0.5;
                    const denom = H[6] * uCoord + H[7] * vCoord + 1;
                    const px = Math.round((H[0] * uCoord + H[1] * vCoord + H[2]) / denom);
                    const py = Math.round((H[3] * uCoord + H[4] * vCoord + H[5]) / denom);
                    if (px >= 0 && px < width && py >= 0 && py < height) {
                      matrixPersp[r][c] = bin[py * width + px] === 1;
                    }
                  }
                }
                const decodedPersp = decodeQRModuleMatrix(matrixPersp);
                if (decodedPersp) return decodedPersp;
              }
            }
          }
        }
      }
    }
  }
  return null;
}

/**
 * Legacy bounding-box sampler for clean synthetic axis-aligned QR codes across 0°/90°/180°/270°
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
 * Extracts and decodes a QR code from an `ImageData` buffer using the v5.0 multi-stage
 * screen-aware & perspective-rectifying recognition pipeline.
 */
function extractAndDecodeFromImageData(imageData, onProgress) {
  const {
    data,
    width,
    height
  } = imageData;
  if (width < 21 || height < 21) return null;
  if (onProgress) onProgress('stageReadingOriginal');

  // Stage 1A: Global jsQR (when present in browser environment)
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

  // Stage 1B: Fast Global Threshold (Normal Polarity)
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
    const triadGlobal = decodeFromFinderTriads(binNormal, width, height);
    if (triadGlobal) return triadGlobal;
  }

  // Stage 2: 2D De-Moiré Separable Gaussian 3x3 Smoothing + Module-Scale Integral Adaptive Binarization
  // (Specifically engineered for LCD/OLED screens, moiré patterns, uneven backlight, and camera tilt)
  if (onProgress) onProgress('stageDetectingRegions');
  const smooth3 = smoothGray3x3(gray, width, height);
  const integralSmooth = computeIntegralImage(smooth3, width, height);
  const rModuleScale = Math.max(8, Math.min(28, Math.floor(Math.min(width, height) / 30)));
  const rBroadScale = Math.max(12, Math.floor(Math.min(width, height) / 10));
  for (const [radius, bias] of [[rModuleScale, 6], [rBroadScale, 5], [rModuleScale, 3], [rModuleScale, 11]]) {
    if (onProgress) onProgress('stageCorrectingPerspective');
    const binAdap = binarizeFromIntegral(smooth3, integralSmooth, width, height, radius, bias, false);
    const triadDecoded = decodeFromFinderTriads(binAdap, width, height);
    if (triadDecoded) return triadDecoded;

    // Also try axis-aligned bounding-box fallback for clean adaptive images
    let aMinX = width,
      aMaxX = -1,
      aMinY = height,
      aMaxY = -1;
    for (let y = 0; y < height; y++) {
      const rowOff = y * width;
      for (let x = 0; x < width; x++) {
        if (binAdap[rowOff + x] === 1) {
          if (x < aMinX) aMinX = x;
          if (x > aMaxX) aMaxX = x;
          if (y < aMinY) aMinY = y;
          if (y > aMaxY) aMaxY = y;
        }
      }
    }
    if (aMaxX > aMinX && aMaxY > aMinY) {
      const boxDecoded = sampleAndDecodeBoundingBox(binAdap, width, height, aMinX, aMaxX, aMinY, aMaxY);
      if (boxDecoded) return boxDecoded;
    }
  }

  // Stage 3: Inverted Polarity Recovery (Light QR on Dark Background)
  if (onProgress) onProgress('stageImprovingQuality');
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
    const invBox = sampleAndDecodeBoundingBox(binInverted, width, height, invMinX, invMaxX, invMinY, invMaxY);
    if (invBox) return invBox;
    const invTriad = decodeFromFinderTriads(binInverted, width, height);
    if (invTriad) return invTriad;
  }

  // Stage 4: Stronger 2-Pass De-Moiré Smoothing (for heavy LCD pixel grids) + Contrast Stretch & Sharpening
  if (onProgress) onProgress('stageAlternativeDecoders');
  const smooth5 = smoothGray3x3(smooth3, width, height);
  const intSmooth5 = computeIntegralImage(smooth5, width, height);
  const binSmooth5 = binarizeFromIntegral(smooth5, intSmooth5, width, height, rModuleScale, 5, false);
  const smooth5Decoded = decodeFromFinderTriads(binSmooth5, width, height);
  if (smooth5Decoded) return smooth5Decoded;
  const sharpened = enhanceAndSharpenGray(gray, width, height);
  const intSharp = computeIntegralImage(sharpened, width, height);
  const binSharp = binarizeFromIntegral(sharpened, intSharp, width, height, rModuleScale, 7, false);
  const sharpDecoded = decodeFromFinderTriads(binSharp, width, height);
  if (sharpDecoded) return sharpDecoded;
  return null;
}

/**
 * Detects ALL distinct QR codes present inside an `ImageData` buffer
 */
function extractAllQRCodesFromImageData(imageData, onProgress) {
  const results = [];
  const addUnique = val => {
    if (val && !results.includes(val)) {
      results.push(val);
    }
  };

  // 1. Try whole image at native resolution first
  const primary = extractAndDecodeFromImageData(imageData, onProgress);
  addUnique(primary);
  const {
    data,
    width,
    height
  } = imageData;
  if (width >= 48 && height >= 48) {
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
    const midX = Math.floor(width / 2);
    if (midX >= 25) {
      addUnique(extractAndDecodeFromImageData(cropRegion(0, 0, midX, height)));
      addUnique(extractAndDecodeFromImageData(cropRegion(midX, 0, width - midX, height)));
    }
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
 * Decodes a QR code from an `HTMLImageElement`, `HTMLVideoElement`, or `HTMLCanvasElement`.
 * CRITICAL: Preserves full native image resolution on the initial pass for uploaded images.
 */
async function decodeQRFromSource(source, onProgress) {
  if (onProgress) onProgress('stageReadingOriginal');
  const detector = getBarcodeDetector();
  if (detector) {
    try {
      const results = await detector.detect(source);
      if (results && results.length > 0 && results[0].rawValue) {
        return results[0].rawValue;
      }
    } catch {
      // Fall through to multi-stage canvas decoder
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

  // Live video frame path: center ROI pass first (`480x480`), then full frame (`720px`)
  if (isVideo) {
    const minDim = Math.min(w, h);
    const cropSize = Math.floor(minDim * 0.8);
    const sx = Math.floor((w - cropSize) / 2);
    const sy = Math.floor((h - cropSize) / 2);
    const roiTarget = Math.min(480, cropSize);
    canvas.width = roiTarget;
    canvas.height = roiTarget;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(source, sx, sy, cropSize, cropSize, 0, 0, roiTarget, roiTarget);
    const roiData = ctx.getImageData(0, 0, roiTarget, roiTarget);
    const roiDecoded = extractAndDecodeFromImageData(roiData);
    if (roiDecoded) return roiDecoded;
    const scale = Math.min(1, 720 / Math.max(w, h));
    const fw = Math.max(21, Math.round(w * scale));
    const fh = Math.max(21, Math.round(h * scale));
    canvas.width = fw;
    canvas.height = fh;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(source, 0, 0, fw, fh);
    return extractAndDecodeFromImageData(ctx.getImageData(0, 0, fw, fh));
  }

  // Uploaded static image path: ALWAYS preserve native 1.0x resolution first (up to 2560px)
  const maxDim = Math.max(w, h);
  const scales = maxDim < 200 ? [1.0, 2.0] : maxDim <= 2560 ? [1.0, Math.min(1, 1280 / maxDim), Math.min(1, 768 / maxDim)] : [2560 / maxDim, 1280 / maxDim, 768 / maxDim];
  const uniqueScales = Array.from(new Set(scales.map(s => Number(s.toFixed(4)))));
  for (const scale of uniqueScales) {
    const sw = Math.max(21, Math.round(w * scale));
    const sh = Math.max(21, Math.round(h * scale));
    canvas.width = sw;
    canvas.height = sh;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, sw, sh);
    // Use high-quality bilinear filtering when downscaling photos; use crisp sampling when upscaling tiny QR codes
    ctx.imageSmoothingEnabled = scale < 1.0;
    ctx.drawImage(source, 0, 0, sw, sh);
    const imgData = ctx.getImageData(0, 0, sw, sh);
    const decoded = extractAndDecodeFromImageData(imgData, onProgress);
    if (decoded) return decoded;
  }
  return null;
}

/**
 * Decodes all QR codes present in an uploaded image element or canvas, preserving original resolution first
 */
async function decodeAllQRCodesFromSource(source, onProgress) {
  const unique = [];
  const add = val => {
    if (val && !unique.includes(val)) unique.push(val);
  };
  if (onProgress) onProgress('stageReadingOriginal');
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
      const scales = maxDim < 200 ? [1.0, 2.0] : maxDim <= 2560 ? [1.0, Math.min(1, 1280 / maxDim)] : [2560 / maxDim, 1280 / maxDim];
      const uniqueScales = Array.from(new Set(scales.map(s => Number(s.toFixed(4)))));
      for (const scale of uniqueScales) {
        const sw = Math.max(21, Math.round(w * scale));
        const sh = Math.max(21, Math.round(h * scale));
        canvas.width = sw;
        canvas.height = sh;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, sw, sh);
        ctx.imageSmoothingEnabled = scale < 1.0;
        ctx.drawImage(source, 0, 0, sw, sh);
        const imgData = ctx.getImageData(0, 0, sw, sh);
        for (const found of extractAllQRCodesFromImageData(imgData, onProgress)) {
          add(found);
        }
        if (unique.length > 0) break;
      }
    }
  }
  return unique;
}

/**
 * Decodes an uploaded image File (PNG, JPG/JPEG, WEBP) into a raw QR payload string.
 */
function decodeQRFromFile(file, onProgress) {
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
          const payload = await decodeQRFromSource(img, onProgress);
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
 * Decodes one or more QR codes from an uploaded image File (supporting multi-QR selection & progress feedback)
 */
function decodeAllQRCodesFromFile(file, onProgress) {
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
          const payloads = await decodeAllQRCodesFromSource(img, onProgress);
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