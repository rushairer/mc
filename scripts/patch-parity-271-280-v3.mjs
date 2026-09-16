import { readFileSync, writeFileSync } from 'node:fs';

await import('./patch-parity-271-280-v2.mjs');

const path = 'tests/parity-271-280.test.ts';
const before = readFileSync(path, 'utf8');
const anchor = `    undefined,\n    undefined,\n    undefined,\n    (_mob, eventName) => events.push(eventName),`;
const replacement = `    undefined,\n    undefined,\n    undefined,\n    undefined,\n    (_mob, eventName) => events.push(eventName),`;
if (!before.includes(anchor)) throw new Error('MobSystem bounce callback test anchor missing');
writeFileSync(path, before.replace(anchor, replacement));
console.log('Applied parity 271-280 v3 MobSystem callback alignment.');
