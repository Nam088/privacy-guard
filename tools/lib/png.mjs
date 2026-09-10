/**
 * Minimal, dependency free PNG reader and writer.
 *
 * Purpose: browser screenshots are emitted as 32 bit RGBA PNG (colour type 6),
 * but the Chrome Web Store only accepts 24 bit PNG with no alpha channel
 * (colour type 2). This module decodes a screenshot, composites it over an
 * opaque background, and re-encodes it without an alpha channel.
 *
 * Scope is intentionally narrow: 8 bit samples, non interlaced, colour type
 * 2 or 6. That covers every PNG Chromium produces. Anything else throws.
 */

import zlib from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const COLOUR_TYPE_RGB = 2;
const COLOUR_TYPE_RGBA = 6;

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/**
 * Reverse the per scanline filter that PNG applies before compression.
 * Operates in place on `raw` and returns the unfiltered pixel buffer.
 */
function unfilter(raw, width, height, bytesPerPixel) {
  const stride = width * bytesPerPixel;
  const out = Buffer.alloc(stride * height);

  let pos = 0;
  for (let y = 0; y < height; y += 1) {
    const filterType = raw[pos];
    pos += 1;
    const rowStart = y * stride;
    const prevStart = rowStart - stride;

    for (let x = 0; x < stride; x += 1) {
      const rawByte = raw[pos + x];
      const left = x >= bytesPerPixel ? out[rowStart + x - bytesPerPixel] : 0;
      const up = y > 0 ? out[prevStart + x] : 0;
      const upLeft = y > 0 && x >= bytesPerPixel ? out[prevStart + x - bytesPerPixel] : 0;

      let value;
      switch (filterType) {
        case 0:
          value = rawByte;
          break;
        case 1:
          value = rawByte + left;
          break;
        case 2:
          value = rawByte + up;
          break;
        case 3:
          value = rawByte + ((left + up) >> 1);
          break;
        case 4:
          value = rawByte + paeth(left, up, upLeft);
          break;
        default:
          throw new Error(`Unsupported PNG filter type ${filterType} on row ${y}`);
      }
      out[rowStart + x] = value & 0xff;
    }
    pos += stride;
  }

  return out;
}

/**
 * Decode a PNG into `{ width, height, channels, pixels }`.
 * `pixels` is a tightly packed buffer of 8 bit samples.
 */
export function decodePng(buffer) {
  if (!buffer.subarray(0, 8).equals(SIGNATURE)) {
    throw new Error('Not a PNG file: signature mismatch');
  }

  let offset = 8;
  let header = null;
  const idatParts = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === 'IHDR') {
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colourType: data[9],
        interlace: data[12],
      };
    } else if (type === 'IDAT') {
      idatParts.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }

  if (!header) {
    throw new Error('Malformed PNG: no IHDR chunk');
  }
  if (header.bitDepth !== 8) {
    throw new Error(`Unsupported PNG bit depth ${header.bitDepth}, expected 8`);
  }
  if (header.interlace !== 0) {
    throw new Error('Unsupported interlaced PNG');
  }
  if (header.colourType !== COLOUR_TYPE_RGB && header.colourType !== COLOUR_TYPE_RGBA) {
    throw new Error(
      `Unsupported PNG colour type ${header.colourType}, expected ${COLOUR_TYPE_RGB} or ${COLOUR_TYPE_RGBA}`,
    );
  }

  const channels = header.colourType === COLOUR_TYPE_RGBA ? 4 : 3;
  const inflated = zlib.inflateSync(Buffer.concat(idatParts));
  const pixels = unfilter(inflated, header.width, header.height, channels);

  return { width: header.width, height: header.height, channels, pixels };
}

/**
 * Encode tightly packed 24 bit RGB samples as a colour type 2 PNG.
 */
export function encodeRgbPng({ width, height, pixels }) {
  const stride = width * 3;
  if (pixels.length !== stride * height) {
    throw new Error(`Pixel buffer is ${pixels.length} bytes, expected ${stride * height}`);
  }

  // Filter type 0 (None) on every scanline. Screenshots compress well enough
  // that adaptive filtering is not worth the extra code path here.
  const rawWithFilters = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    rawWithFilters[y * (stride + 1)] = 0;
    pixels.copy(rawWithFilters, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = COLOUR_TYPE_RGB;
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(rawWithFilters, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Drop the alpha channel from a PNG, compositing over an opaque background.
 * Already opaque input is passed through unchanged in appearance.
 *
 * @param {Buffer} buffer  Source PNG (colour type 2 or 6)
 * @param {[number, number, number]} background  RGB to composite against
 * @returns {Buffer} 24 bit RGB PNG
 */
export function stripAlpha(buffer, background = [255, 255, 255]) {
  const { width, height, channels, pixels } = decodePng(buffer);

  if (channels === 3) {
    return encodeRgbPng({ width, height, pixels });
  }

  const [bgR, bgG, bgB] = background;
  const rgb = Buffer.alloc(width * height * 3);

  for (let i = 0, o = 0; i < pixels.length; i += 4, o += 3) {
    const alpha = pixels[i + 3];
    if (alpha === 255) {
      rgb[o] = pixels[i];
      rgb[o + 1] = pixels[i + 1];
      rgb[o + 2] = pixels[i + 2];
    } else {
      const a = alpha / 255;
      rgb[o] = Math.round(pixels[i] * a + bgR * (1 - a));
      rgb[o + 1] = Math.round(pixels[i + 1] * a + bgG * (1 - a));
      rgb[o + 2] = Math.round(pixels[i + 2] * a + bgB * (1 - a));
    }
  }

  return encodeRgbPng({ width, height, pixels: rgb });
}

/**
 * Drop the alpha channel and downscale by an exact integer factor, averaging
 * each factor x factor block of source pixels.
 *
 * This exists so the canvas can be rendered at 2x and averaged down to the
 * required size: text and UI edges end up supersampled rather than rasterised
 * once at the final resolution. Because the factor is exact, a box average is
 * the correct filter and no general resampler is needed.
 *
 * @param {Buffer} buffer  Source PNG (colour type 2 or 6)
 * @param {number} factor  Integer downscale factor; must divide both dimensions
 * @param {[number, number, number]} background  RGB to composite against
 * @returns {Buffer} 24 bit RGB PNG
 */
export function flattenAndDownscale(buffer, factor, background = [255, 255, 255]) {
  if (!Number.isInteger(factor) || factor < 1) {
    throw new Error(`Downscale factor must be a positive integer, got ${factor}`);
  }
  if (factor === 1) {
    return stripAlpha(buffer, background);
  }

  const { width, height, channels, pixels } = decodePng(buffer);
  if (width % factor !== 0 || height % factor !== 0) {
    throw new Error(
      `Source ${width}x${height} is not divisible by downscale factor ${factor}`,
    );
  }

  const outWidth = width / factor;
  const outHeight = height / factor;
  const [bgR, bgG, bgB] = background;
  const out = Buffer.alloc(outWidth * outHeight * 3);
  const samples = factor * factor;
  const srcStride = width * channels;

  for (let oy = 0; oy < outHeight; oy += 1) {
    for (let ox = 0; ox < outWidth; ox += 1) {
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;

      for (let by = 0; by < factor; by += 1) {
        const rowStart = (oy * factor + by) * srcStride;
        for (let bx = 0; bx < factor; bx += 1) {
          const i = rowStart + (ox * factor + bx) * channels;
          const alpha = channels === 4 ? pixels[i + 3] : 255;
          if (alpha === 255) {
            sumR += pixels[i];
            sumG += pixels[i + 1];
            sumB += pixels[i + 2];
          } else {
            const a = alpha / 255;
            sumR += pixels[i] * a + bgR * (1 - a);
            sumG += pixels[i + 1] * a + bgG * (1 - a);
            sumB += pixels[i + 2] * a + bgB * (1 - a);
          }
        }
      }

      const o = (oy * outWidth + ox) * 3;
      out[o] = Math.round(sumR / samples);
      out[o + 1] = Math.round(sumG / samples);
      out[o + 2] = Math.round(sumB / samples);
    }
  }

  return encodeRgbPng({ width: outWidth, height: outHeight, pixels: out });
}

/**
 * Read back the IHDR of an encoded PNG. Used to assert store requirements.
 */
export function inspectPng(buffer) {
  if (!buffer.subarray(0, 8).equals(SIGNATURE)) {
    throw new Error('Not a PNG file: signature mismatch');
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    bitDepth: buffer[24],
    colourType: buffer[25],
    hasAlpha: buffer[25] === COLOUR_TYPE_RGBA || buffer[25] === 4,
    bytes: buffer.length,
  };
}
