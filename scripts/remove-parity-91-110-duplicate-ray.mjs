import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/systems/MobSystem.ts';
const source = readFileSync(path, 'utf8');
const marker = '  /** Return the nearest mob intersected by the entity interaction ray without mutating it. */';
const nextMarker = '  /** Player attacks mob via raycast. Returns true if hit. */';
const start = source.indexOf(marker);
if (start < 0) throw new Error('temporary duplicate getMobInRay marker not found');
const end = source.indexOf(nextMarker, start);
if (end < 0) throw new Error('playerAttackMob marker not found after duplicate ray helper');
const cleaned = source.slice(0, start) + source.slice(end);
if ((cleaned.match(/\n  getMobInRay\(/g) ?? []).length !== 1) {
  throw new Error('expected exactly one canonical getMobInRay after cleanup');
}
writeFileSync(path, cleaned, 'utf8');
console.log('removed temporary duplicate getMobInRay; canonical method retained');
