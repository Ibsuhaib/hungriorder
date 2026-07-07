// Generates solid-brand PWA PNG icons (navy background, gold circle) with zero
// image dependencies — raw PNG chunks + node:zlib. Replace with real brand
// icons before launch; these exist so the PWA manifest is valid out of the box.
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const NAVY = [15, 23, 42];
const GOLD = [212, 163, 115];

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function makeIcon(size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor RGB

  const stride = size * 3 + 1;
  const raw = Buffer.alloc(stride * size);
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.32;
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const inside = (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
      const [cr, cg, cb] = inside ? GOLD : NAVY;
      const o = y * stride + 1 + x * 3;
      raw[o] = cr;
      raw[o + 1] = cg;
      raw[o + 2] = cb;
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const targets = [
  ['packages/customer-app/public', [192, 512]],
  ['packages/admin-app/public', [192, 512]],
];

for (const [dir, sizes] of targets) {
  const abs = path.join(root, dir);
  fs.mkdirSync(abs, { recursive: true });
  for (const size of sizes) {
    const file = path.join(abs, `pwa-${size}x${size}.png`);
    fs.writeFileSync(file, makeIcon(size));
    console.log('wrote', path.relative(root, file));
  }
}
