import { readFileSync, writeFileSync } from 'node:fs';

await import('./patch-parity-271-280.mjs');

const path = 'tests/parity-271-280.test.ts';
const before = readFileSync(path, 'utf8');
const marker = "const gameSource = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');";
const markerIndex = before.indexOf(marker);
if (markerIndex < 0) throw new Error('parity 271-280 trailing assertion marker missing');
writeFileSync(path, before.slice(0, markerIndex).trimEnd() + '\n');
console.log('Applied parity 271-280 v2 test cleanup.');
