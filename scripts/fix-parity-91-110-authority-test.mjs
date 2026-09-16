import { readFileSync, writeFileSync } from 'node:fs';

const path = 'tests/server-authority-contract.test.ts';
let source = readFileSync(path, 'utf8');
const from = "const end = serverSource.indexOf('spawnDroppedItem(', start);";
const to = "const end = serverSource.indexOf('\\n  spawnDroppedItem(', start);";
const count = source.split(from).length - 1;
if (count !== 1) throw new Error(`expected one respawn test boundary, got ${count}`);
source = source.replace(from, to);
writeFileSync(path, source, 'utf8');
console.log('authority contract now slices through the full respawn method');
