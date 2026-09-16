import { readFileSync, writeFileSync } from 'node:fs';

await import('./patch-parity-259-270.mjs');

const path = 'tests/parity-259-270.test.ts';
const before = readFileSync(path, 'utf8');
const after = before.replace(
  "manifest.axes.visualModels.status, 'partial'",
  "manifest.axes.visualModels.state, 'partial'",
);
if (after === before) throw new Error('parity 270 manifest-state fix anchor missing');
writeFileSync(path, after);
console.log('Applied parity 259-270 v2 manifest-state fix.');
