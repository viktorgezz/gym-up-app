// Renders the app icon (a tilted dumbbell on mint) to PNG and SVG, and the iOS launch
// screens (the icon centred on the app background), without any image dependencies:
// shapes are signed-distance rounded rectangles, rasterized with 4×4 supersampling.
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import SPLASH_SCREENS from './splash-screens.json' with { type: 'json' };

const OUT = new URL('../public/icons/', import.meta.url);
const SPLASH_OUT = new URL('../public/splash/', import.meta.url);
const BG = [62, 230, 168];
const FG = [4, 19, 13];
/** App background (--bg); iOS shows the launch screen until the first paint. */
const SPLASH_BG = [11, 11, 12];
/** Icon size on the launch screen, in points. */
const SPLASH_ICON_PT = 120;
const SS = 4;
/** The dumbbell rises to the right. */
const ANGLE_DEG = -45;

// Glyph in a 64-unit box, drawn horizontally around the centre: [cx, cy, halfW, halfH, radius].
const RECTS = [
  [32, 32, 13, 2.75, 2.75], // bar
  [21.5, 32, 3.25, 11.5, 2.25], // inner plates
  [42.5, 32, 3.25, 11.5, 2.25],
  [15.25, 32, 2.5, 7.5, 2], // outer plates
  [48.75, 32, 2.5, 7.5, 2],
];

function sdRoundRect(px, py, [cx, cy, hw, hh, r]) {
  const qx = Math.abs(px - cx) - (hw - r);
  const qy = Math.abs(py - cy) - (hh - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

const COS = Math.cos((-ANGLE_DEG * Math.PI) / 180);
const SIN = Math.sin((-ANGLE_DEG * Math.PI) / 180);

/** Coverage of the glyph at a point in the 64-unit box (0 or 1). */
function glyphAlpha(x, y) {
  // Rotate the sample back into the glyph's horizontal frame.
  const dx = x - 32;
  const dy = y - 32;
  const gx = 32 + dx * COS - dy * SIN;
  const gy = 32 + dx * SIN + dy * COS;
  return RECTS.some((r) => sdRoundRect(gx, gy, r) <= 0) ? 1 : 0;
}

/** Inside the rounded square of the icon (rx 14, as in the SVG) in the 64-unit box. */
function inRoundedSquare(x, y) {
  return sdRoundRect(x, y, [32, 32, 32, 32, 14]) <= 0;
}

/** scale < 1 shrinks the glyph toward the centre (maskable safe zone). */
function render(size, scale = 1) {
  const px = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let cover = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = ((x + (sx + 0.5) / SS) / size) * 64;
          const v = ((y + (sy + 0.5) / SS) / size) * 64;
          cover += glyphAlpha(32 + (u - 32) / scale, 32 + (v - 32) / scale);
        }
      }
      cover /= SS * SS;
      const o = (y * size + x) * 3;
      for (let c = 0; c < 3; c++) px[o + c] = Math.round(BG[c] + (FG[c] - BG[c]) * cover);
    }
  }
  return encodePng(size, size, px);
}

/** Launch screen: the rounded icon centred on the app background. */
function renderSplash(width, height, ratio) {
  const px = Buffer.alloc(width * height * 3);
  for (let i = 0; i < width * height; i++) px.set(SPLASH_BG, i * 3);
  const size = SPLASH_ICON_PT * ratio;
  const x0 = Math.round((width - size) / 2);
  const y0 = Math.round((height - size) / 2);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sum = [0, 0, 0];
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = ((x + (sx + 0.5) / SS) / size) * 64;
          const v = ((y + (sy + 0.5) / SS) / size) * 64;
          const a = glyphAlpha(u, v);
          for (let c = 0; c < 3; c++) sum[c] += inRoundedSquare(u, v) ? BG[c] + (FG[c] - BG[c]) * a : SPLASH_BG[c];
        }
      }
      const o = ((y0 + y) * width + x0 + x) * 3;
      for (let c = 0; c < 3; c++) px[o + c] = Math.round(sum[c] / (SS * SS));
    }
  }
  return encodePng(width, height, px);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgb) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // RGB
  const stride = width * 3;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const hex = (c) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="${hex(BG)}"/>
  <g fill="${hex(FG)}" transform="rotate(${ANGLE_DEG} 32 32)">
${RECTS.map(([cx, cy, hw, hh, r]) => `    <rect x="${cx - hw}" y="${cy - hh}" width="${hw * 2}" height="${hh * 2}" rx="${r}"/>`).join('\n')}
  </g>
</svg>
`;

mkdirSync(OUT, { recursive: true });
writeFileSync(new URL('icon-192.png', OUT), render(192));
writeFileSync(new URL('icon-512.png', OUT), render(512));
writeFileSync(new URL('icon-maskable-512.png', OUT), render(512, 0.8));
writeFileSync(new URL('apple-touch-icon.png', OUT), render(180));
writeFileSync(new URL('favicon.svg', OUT), svg);
console.log('Icons written to public/icons/');

// Portrait and landscape for every screen; the names match the tags vite.config.ts injects.
mkdirSync(SPLASH_OUT, { recursive: true });
for (const { width, height, ratio } of SPLASH_SCREENS) {
  for (const [w, h] of [
    [width, height],
    [height, width],
  ]) {
    writeFileSync(new URL(`${w * ratio}x${h * ratio}.png`, SPLASH_OUT), renderSplash(w * ratio, h * ratio, ratio));
  }
}
console.log(`Launch screens written to public/splash/ (${SPLASH_SCREENS.length * 2})`);
