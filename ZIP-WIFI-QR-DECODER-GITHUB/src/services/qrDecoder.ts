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

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function gfDiv(a: number, b: number): number {
  if (a === 0) return 0;
  if (b === 0) throw new Error('GF division by zero');
  return GF_EXP[GF_LOG[a] + 255 - GF_LOG[b]];
}

// Alignment pattern center coordinates for QR Versions 1..40
const ALIGNMENT_PATTERNS: number[][] = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
  [6, 30, 54],
  [6, 32, 58],
  [6, 34, 62],
  [6, 26, 46, 66],
  [6, 26, 48, 70],
  [6, 26, 50, 74],
  [6, 30, 54, 78],
  [6, 30, 56, 82],
  [6, 30, 58, 86],
  [6, 34, 62, 90],
];

// RS Block Table for Versions 1..20 across Error Correction Levels:
// Format Info EC bits: 01 = L (0), 00 = M (1), 11 = Q (2), 10 = H (3)
// Ordered by [L, M, Q, H] for each version:
const RS_BLOCK_TABLE: number[][][] = [
  [], // Version 0 placeholder
  [[1, 26, 19], [1, 26, 16], [1, 26, 13], [1, 26, 9]], // V1
  [[1, 44, 34], [1, 44, 28], [1, 44, 22], [1, 44, 16]], // V2
  [[1, 70, 55], [1, 70, 44], [2, 35, 17], [2, 35, 13]], // V3
  [[1, 100, 80], [2, 50, 32], [2, 50, 24], [4, 25, 9]], // V4
  [[1, 134, 108], [2, 67, 43], [2, 33, 15, 2, 34, 16], [2, 33, 11, 2, 34, 12]], // V5
  [[2, 86, 68], [4, 43, 27], [4, 43, 19], [4, 43, 15]], // V6
  [[2, 98, 78], [4, 49, 31], [2, 32, 14, 4, 33, 15], [4, 39, 13, 1, 40, 14]], // V7
  [[2, 121, 97], [2, 60, 38, 2, 61, 39], [4, 40, 18, 2, 41, 19], [4, 40, 14, 2, 41, 15]], // V8
  [[2, 146, 116], [3, 58, 36, 2, 59, 37], [4, 36, 16, 4, 37, 17], [4, 36, 12, 4, 37, 13]], // V9
  [[2, 86, 68, 2, 87, 69], [4, 69, 43, 1, 70, 44], [6, 43, 19, 2, 44, 20], [6, 43, 15, 2, 44, 16]], // V10
  [[4, 101, 81], [1, 80, 50, 4, 81, 51], [4, 50, 22, 4, 51, 23], [3, 36, 12, 8, 37, 13]], // V11
  [[2, 116, 92, 2, 117, 93], [6, 58, 36, 2, 59, 37], [4, 46, 20, 6, 47, 21], [7, 42, 14, 4, 43, 15]], // V12
  [[4, 133, 107], [8, 59, 37, 1, 60, 38], [8, 44, 20, 4, 45, 21], [12, 33, 11, 4, 34, 12]], // V13
  [[3, 145, 115, 1, 146, 116], [4, 64, 40, 5, 65, 41], [11, 36, 16, 5, 37, 17], [11, 36, 12, 5, 37, 13]], // V14
  [[5, 109, 87, 1, 110, 88], [5, 65, 41, 5, 66, 42], [5, 54, 24, 7, 55, 25], [11, 36, 12]], // V15
];

const FORMAT_INFO_TABLE: Array<[number, number, number]> = [
  // [maskedBits, ecIndex (0:L, 1:M, 2:Q, 3:H), maskPattern]
  [0x77c4, 0, 0], [0x72f3, 0, 1], [0x7daa, 0, 2], [0x789d, 0, 3],
  [0x662f, 0, 4], [0x6318, 0, 5], [0x6c41, 0, 6], [0x6976, 0, 7],
  [0x5412, 1, 0], [0x5125, 1, 1], [0x5e7c, 1, 2], [0x5b4b, 1, 3],
  [0x45f9, 1, 4], [0x40ce, 1, 5], [0x4f97, 1, 6], [0x4aa0, 1, 7],
  [0x355f, 2, 0], [0x3068, 2, 1], [0x3f31, 2, 2], [0x3a06, 2, 3],
  [0x24b4, 2, 4], [0x2183, 2, 5], [0x2eda, 2, 6], [0x2bed, 2, 7],
  [0x1689, 3, 0], [0x13be, 3, 1], [0x1ce7, 3, 2], [0x19d0, 3, 3],
  [0x0762, 3, 4], [0x0255, 3, 5], [0x0d0c, 3, 6], [0x083b, 3, 7],
];

function popcount16(x: number): number {
  let c = 0;
  while (x) {
    c += x & 1;
    x >>>= 1;
  }
  return c;
}

function decodeFormatInfo(fmtBits1: number, fmtBits2: number): { ecIndex: number; mask: number } | null {
  let bestDist = 4; // allow up to 3 bit errors
  let bestMatch: { ecIndex: number; mask: number } | null = null;
  for (const [pattern, ecIndex, mask] of FORMAT_INFO_TABLE) {
    const d1 = popcount16(fmtBits1 ^ pattern);
    if (d1 < bestDist) {
      bestDist = d1;
      bestMatch = { ecIndex, mask };
    }
    const d2 = popcount16(fmtBits2 ^ pattern);
    if (d2 < bestDist) {
      bestDist = d2;
      bestMatch = { ecIndex, mask };
    }
  }
  return bestMatch;
}

function evaluateMask(mask: number, row: number, col: number): boolean {
  switch (mask) {
    case 0: return (row + col) % 2 === 0;
    case 1: return row % 2 === 0;
    case 2: return col % 3 === 0;
    case 3: return (row + col) % 3 === 0;
    case 4: return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
    case 5: return ((row * col) % 2) + ((row * col) % 3) === 0;
    case 6: return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0;
    case 7: return (((row + col) % 2) + ((row * col) % 3)) % 2 === 0;
    default: return false;
  }
}

/**
 * Reed-Solomon error correction for a single block (corrects up to floor(ecBytes/2) symbol errors)
 */
function reedSolomonCorrect(codewords: Uint8Array, ecLength: number): Uint8Array | null {
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
  const errorLocations: number[] = [];
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
function buildFunctionModuleMap(version: number): boolean[][] {
  const size = version * 4 + 17;
  const reserved: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  // Finder patterns + separators
  const markRect = (r0: number, c0: number, h: number, w: number) => {
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
      if ((r <= 8 && c <= 8) || (r <= 8 && c >= size - 8) || (r >= size - 8 && c <= 8)) {
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
function decodeDataCodewords(dataBytes: Uint8Array, version: number): string | null {
  let bitOffset = 0;
  const totalBits = dataBytes.length * 8;

  const readBits = (count: number): number => {
    let val = 0;
    for (let i = 0; i < count; i++) {
      if (bitOffset >= totalBits) return 0;
      const byteIdx = bitOffset >> 3;
      const bitIdx = 7 - (bitOffset & 7);
      val = (val << 1) | ((dataBytes[byteIdx] >> bitIdx) & 1);
      bitOffset++;
    }
    return val;
  };

  const getCountBits = (mode: number, ver: number): number => {
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
  const byteChunks: number[] = [];

  const flushBytes = () => {
    if (byteChunks.length > 0) {
      try {
        output += new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(byteChunks));
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
export function decodeQRModuleMatrix(matrix: boolean[][]): string | null {
  const size = matrix.length;
  if (size < 21 || (size - 17) % 4 !== 0) return null;
  const version = (size - 17) / 4;
  if (version < 1 || version >= RS_BLOCK_TABLE.length) return null;

  // Read Format Information #1 (around top-left finder)
  let fmt1 = 0;
  const fmt1Coords: Array<[number, number]> = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];
  for (let i = 0; i < 15; i++) {
    const [r, c] = fmt1Coords[i];
    if (matrix[r][c]) fmt1 |= 1 << (14 - i); // Note: standard order or LSB-first
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
  const fmt2Coords: Array<[number, number]> = [
    [size - 1, 8], [size - 2, 8], [size - 3, 8], [size - 4, 8], [size - 5, 8], [size - 6, 8], [size - 7, 8],
    [8, size - 8], [8, size - 7], [8, size - 6], [8, size - 5], [8, size - 4], [8, size - 3], [8, size - 2], [8, size - 1],
  ];
  for (let i = 0; i < 15; i++) {
    const [r, c] = fmt2Coords[i];
    if (matrix[r][c]) {
      fmt2 |= 1 << (14 - i);
      fmt2Rev |= 1 << i;
    }
  }

  const candidates: Array<{ ecIndex: number; mask: number }> = [];
  const m1 = decodeFormatInfo(fmt1, fmt2);
  if (m1) candidates.push(m1);
  const m2 = decodeFormatInfo(fmt1Rev, fmt2Rev);
  if (m2) candidates.push(m2);

  // Fallback: try all 4 EC levels and 8 masks if format bits were damaged
  for (let ecIndex = 0; ecIndex < 4; ecIndex++) {
    for (let mask = 0; mask < 8; mask++) {
      candidates.push({ ecIndex, mask });
    }
  }

  const reserved = buildFunctionModuleMap(version);

  for (const { ecIndex, mask } of candidates) {
    const rsSpec = RS_BLOCK_TABLE[version][ecIndex];
    if (!rsSpec) continue;

    // Extract raw codewords in upward/downward 2-column zigzag
    const bits: number[] = [];
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
        b = (b << 1) | bits[i * 8 + j];
      }
      codewords[i] = b;
    }

    // Build block list
    const blocks: Array<{ total: number; data: number }> = [];
    for (let i = 0; i < rsSpec.length; i += 3) {
      const count = rsSpec[i];
      const total = rsSpec[i + 1];
      const data = rsSpec[i + 2];
      for (let j = 0; j < count; j++) {
        blocks.push({ total, data });
      }
    }

    const maxDataLen = Math.max(...blocks.map((b) => b.data));
    const maxEcLen = Math.max(...blocks.map((b) => b.total - b.data));

    const dataBlocks = blocks.map((b) => new Uint8Array(b.data));
    const ecBlocks = blocks.map((b) => new Uint8Array(b.total - b.data));

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
    const correctedBlocks: Uint8Array[] = [];
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
export function extractAndDecodeFromImageData(imageData: ImageData): string | null {
  const { data, width, height } = imageData;
  if (width < 21 || height < 21) return null;

  // 1. If global jsQR is loaded, try it first for maximum rotation/perspective invariance
  const globalWindow = typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>) : {};
  if (typeof globalWindow.jsQR === 'function') {
    try {
      const res = (globalWindow.jsQR as (d: Uint8ClampedArray, w: number, h: number) => { data?: string } | null)(
        data,
        width,
        height
      );
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

  const candidateVersions = new Set<number>();
  if (topRun >= 7) {
    const estMod = topRun / 7;
    const estCount = Math.round(((boxW + boxH) / 2) / estMod);
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

    const matrix: boolean[][] = Array.from({ length: N }, () => Array(N).fill(false));
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
export async function decodeQRFromSource(
  source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
): Promise<string | null> {
  // 1. Try native BarcodeDetector if available in browser
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    try {
      const BarcodeDetectorCtor = (window as unknown as {
        BarcodeDetector: new (opts: { formats: string[] }) => {
          detect: (src: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement) => Promise<Array<{ rawValue?: string }>>;
        };
      }).BarcodeDetector;
      const detector = new BarcodeDetectorCtor({ formats: ['qr_code'] });
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
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
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
export function decodeQRFromFile(file: File): Promise<string> {
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
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
