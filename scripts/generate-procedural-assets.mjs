import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const visualMap = JSON.parse(fs.readFileSync('src/items/data/visual-map.json', 'utf8'));

const blockDir = 'public/mc-assets/textures/block';
const itemDir = 'public/mc-assets/textures/item';

function safeFileName(key) {
  return key.replace(/[^a-z0-9_./-]/gi, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '') || 'unknown';
}

function crc32(buf) {
  let crc = ~0;
  for (const byte of buf) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) {
      crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  typeBuf.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 8 + data.length);
  return out;
}

function writePng(file, pixels, width = 16, height = 16) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    pixels.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]));
}

function hashColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return [
    Math.min(220, Math.max(50, (hash & 0xFF0000) >> 16)),
    Math.min(220, Math.max(50, (hash & 0x00FF00) >> 8)),
    Math.min(220, Math.max(50, hash & 0x0000FF)),
    255,
  ];
}

const palette = {
  stone: [140, 140, 140, 255],
  dirt: [139, 94, 52, 255],
  grass_top: [91, 140, 50, 255],
  grass_side: [111, 127, 53, 255],
  water: [36, 102, 212, 189],
  lava: [216, 90, 22, 255],
  sand: [222, 193, 146, 255],
  red_sand: [186, 99, 56, 255],
  cobblestone: [122, 122, 122, 255],
  gravel: [143, 133, 133, 255],
  oak_planks: [188, 152, 98, 255],
  spruce_planks: [107, 66, 38, 255],
  birch_planks: [212, 196, 154, 255],
  jungle_planks: [168, 121, 75, 255],
  acacia_planks: [186, 99, 56, 255],
  dark_oak_planks: [76, 50, 31, 255],
  oak_log_side: [107, 81, 29, 255],
  spruce_log_side: [74, 46, 26, 255],
  birch_log_side: [215, 207, 170, 255],
  jungle_log_side: [111, 77, 46, 255],
  acacia_log_side: [124, 75, 56, 255],
  dark_oak_log_side: [58, 37, 24, 255],
  oak_log_top: [183, 144, 95, 255],
  spruce_log_top: [107, 66, 38, 255],
  birch_log_top: [228, 216, 170, 255],
  jungle_log_top: [155, 107, 59, 255],
  acacia_log_top: [186, 99, 56, 255],
  dark_oak_log_top: [76, 50, 31, 255],
  oak_leaves: [58, 125, 26, 220],
  spruce_leaves: [47, 90, 34, 220],
  birch_leaves: [111, 165, 51, 220],
  jungle_leaves: [47, 125, 58, 220],
  acacia_leaves: [77, 138, 36, 220],
  dark_oak_leaves: [37, 79, 24, 220],
};

function drawTexture(key) {
  const pixels = Buffer.alloc(16 * 16 * 4);
  const base = palette[key] ?? hashColor(key);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const i = (y * 16 + x) * 4;
      const noise = ((x * 17 + y * 31 + key.length * 13) % 23) - 11;
      pixels[i] = Math.max(0, Math.min(255, base[0] + noise));
      pixels[i + 1] = Math.max(0, Math.min(255, base[1] + noise));
      pixels[i + 2] = Math.max(0, Math.min(255, base[2] + noise));
      pixels[i + 3] = base[3];
    }
  }

  if (key === 'grass_side') {
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 16; x++) {
        const i = (y * 16 + x) * 4;
        pixels[i] = 91; pixels[i + 1] = 140; pixels[i + 2] = 50; pixels[i + 3] = 255;
      }
    }
  }

  if (key.includes('planks')) {
    for (const y of [4, 8, 12]) {
      for (let x = 0; x < 16; x++) {
        const i = (y * 16 + x) * 4;
        pixels[i] *= 0.75; pixels[i + 1] *= 0.75; pixels[i + 2] *= 0.75;
      }
    }
  }

  if (key.includes('log_top')) {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const dx = x - 7.5;
        const dy = y - 7.5;
        const ring = Math.floor(Math.sqrt(dx * dx + dy * dy));
        if (ring % 3 === 0) {
          const i = (y * 16 + x) * 4;
          pixels[i] *= 0.75; pixels[i + 1] *= 0.75; pixels[i + 2] *= 0.75;
        }
      }
    }
  }

  if (key === 'birch_log_side') {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const i = (y * 16 + x) * 4;
        pixels[i] = 218; pixels[i + 1] = 214; pixels[i + 2] = 184; pixels[i + 3] = 255;
      }
    }
    for (const [x, y, w] of [[1, 2, 4], [9, 4, 5], [4, 7, 3], [12, 9, 3], [2, 12, 5]]) {
      for (let yy = y; yy < y + 1; yy++) {
        for (let xx = x; xx < x + w; xx++) {
          const i = (yy * 16 + xx) * 4;
          pixels[i] = 62; pixels[i + 1] = 58; pixels[i + 2] = 44;
        }
      }
    }
  }

  if (key === 'water') {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const i = (y * 16 + x) * 4;
        pixels[i] = 36; pixels[i + 1] = 102; pixels[i + 2] = 212; pixels[i + 3] = 189;
      }
    }
    for (const [x, y, w] of [[2, 4, 7], [1, 7, 5], [10, 8, 4], [7, 11, 6], [3, 14, 4]]) {
      for (let xx = x; xx < x + w; xx++) {
        const i = (y * 16 + xx) * 4;
        pixels[i] = 150; pixels[i + 1] = 205; pixels[i + 2] = 255; pixels[i + 3] = 95;
      }
    }
  }

  return pixels;
}

const blockKeys = new Set();
for (const visual of Object.values(visualMap.blockStates)) {
  for (const key of Object.values(visual.faces)) {
    if (key.startsWith('block:')) blockKeys.add(key.slice('block:'.length));
  }
}

const itemKeys = new Set();
for (const visual of Object.values(visualMap.items)) {
  if (visual.icon?.startsWith('item:')) itemKeys.add(visual.icon.slice('item:'.length));
}

for (const key of blockKeys) writePng(path.join(blockDir, `${safeFileName(key)}.png`), drawTexture(key));
for (const key of itemKeys) writePng(path.join(itemDir, `${safeFileName(key)}.png`), drawTexture(key));

console.log(`Generated ${blockKeys.size} block textures and ${itemKeys.size} item textures.`);
