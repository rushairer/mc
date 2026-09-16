import { readFileSync, writeFileSync } from 'node:fs';

await import('./patch-parity-271-280-v3.mjs');

const path = 'tests/parity-271-280.test.ts';
const before = readFileSync(path, 'utf8');
const after = before.replace('  system.clear();', '  system.dispose();');
if (after === before) throw new Error('MobSystem dispose cleanup test anchor missing');
writeFileSync(path, after);
console.log('Applied parity 271-280 v4 MobSystem cleanup fix.');
