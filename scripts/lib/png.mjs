// Minimal PNG alpha handling, no dependencies. Codex sometimes returns an RGBA PNG with transparent regions
// for print-style designs; a poster should be opaque, so such files are flattened onto a solid background.
import { readFile, writeFile } from 'node:fs/promises';
import { deflateSync, inflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = buf => { let c = 0xffffffff; for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const out = Buffer.alloc(12 + data.length); out.writeUInt32BE(data.length, 0); out.write(type, 4, 'ascii'); data.copy(out, 8); out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length); return out; };

// Decode 8-bit, non-interlaced PNGs of colour type 6 (RGBA), 4 (gray+alpha), 2 (RGB) or 0 (gray). Anything else: null.
export function decodePng(buf) {
  if (buf.length < 33 || !buf.subarray(0, 8).equals(SIGNATURE)) return null;
  let width, height, depth, type, interlace; const idat = [];
  for (let o = 8; o + 8 <= buf.length;) {
    const len = buf.readUInt32BE(o), kind = buf.toString('ascii', o + 4, o + 8), data = buf.subarray(o + 8, o + 8 + len);
    if (kind === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); depth = data[8]; type = data[9]; interlace = data[12]; }
    else if (kind === 'IDAT') idat.push(data);
    else if (kind === 'IEND') break;
    o += 12 + len;
  }
  const channels = { 6: 4, 4: 2, 2: 3, 0: 1 }[type];
  if (!width || depth !== 8 || interlace !== 0 || !channels) return null;
  const raw = inflateSync(Buffer.concat(idat)), stride = width * channels, pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), out = pixels.subarray(y * stride, (y + 1) * stride), prev = y ? pixels.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? out[i - channels] : 0, b = prev ? prev[i] : 0, c = prev && i >= channels ? prev[i - channels] : 0;
      let predictor = 0;
      if (filter === 1) predictor = a; else if (filter === 2) predictor = b; else if (filter === 3) predictor = (a + b) >> 1;
      else if (filter === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); predictor = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[i] = (line[i] + predictor) & 0xff;
    }
  }
  return { width, height, type, channels, pixels };
}

// Encode 8-bit PNG data: `channels` 3 (RGB) or 4 (RGBA), Sub filter on every row.
export function encodePng(width, height, data, channels = 3) {
  const stride = width * channels, raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) { raw[y * (stride + 1)] = 1; for (let i = 0; i < stride; i++) raw[y * (stride + 1) + 1 + i] = (data[y * stride + i] - (i >= channels ? data[y * stride + i - channels] : 0)) & 0xff; }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = channels === 4 ? 6 : 2;
  return Buffer.concat([SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]);
}
export const encodeRgb = (width, height, rgb) => encodePng(width, height, rgb, 3);

const parseColor = value => { const m = String(value || '#ffffff').trim().match(/^#?([0-9a-f]{6})$/i); const n = parseInt(m ? m[1] : 'ffffff', 16); return [n >> 16, (n >> 8) & 255, n & 255]; };

// Flatten transparent areas onto `background` (hex). Returns { flattened, transparent } where `transparent` is the share of
// pixels that were not opaque. Files with (almost) no transparency, or in formats this module cannot read, are left alone.
export async function flattenAlpha(path, { background = '#ffffff', threshold = 0.002 } = {}) {
  if (!/\.png$/i.test(path)) return { flattened: false, transparent: 0 };
  const image = decodePng(await readFile(path));
  if (!image || (image.type !== 6 && image.type !== 4)) return { flattened: false, transparent: 0 };
  const { width, height, channels, pixels } = image, total = width * height, alphaAt = i => pixels[i * channels + channels - 1];
  let see = 0; for (let i = 0; i < total; i++) if (alphaAt(i) < 250) see++;
  const transparent = see / total;
  if (transparent < threshold) return { flattened: false, transparent };
  const [br, bg, bb] = parseColor(background), rgb = Buffer.alloc(total * 3);
  for (let i = 0; i < total; i++) {
    const a = alphaAt(i) / 255, base = i * channels, [r, g, b] = channels === 4 ? [pixels[base], pixels[base + 1], pixels[base + 2]] : [pixels[base], pixels[base], pixels[base]];
    rgb[i * 3] = Math.round(r * a + br * (1 - a)); rgb[i * 3 + 1] = Math.round(g * a + bg * (1 - a)); rgb[i * 3 + 2] = Math.round(b * a + bb * (1 - a));
  }
  await writeFile(path, encodeRgb(width, height, rgb));
  return { flattened: true, transparent };
}
