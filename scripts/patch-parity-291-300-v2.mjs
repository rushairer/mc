import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const sourcePath = 'scripts/patch-parity-291-300.mjs';
const source = readFileSync(sourcePath, 'utf8');
const oldBlock = String.raw`  out = once(
    out,
    \`      if (p.type === 'flame' || p.type === 'smoke' || p.type === 'enchant') {\`,
    \`      if (p.type === 'flame' || p.type === 'smoke' || p.type === 'enchant' || p.type === 'teleport') {\`,
    'teleport particle shrink',
  );`;
const newBlock = String.raw`  out = once(
    out,
    \`      // Shrink size for flame, smoke, and glyphs\\n      if (p.type === 'flame' || p.type === 'smoke' || p.type === 'enchant') {\\n        const scale = alpha;\\n        p.mesh.scale.set(scale, scale, scale);\\n      }\`,
    \`      // Shrink size for flame, smoke, glyphs, and teleport particles\\n      if (p.type === 'flame' || p.type === 'smoke' || p.type === 'enchant' || p.type === 'teleport') {\\n        const scale = alpha;\\n        p.mesh.scale.set(scale, scale, scale);\\n      }\`,
    'teleport particle shrink',
  );`;

if (!source.includes(oldBlock)) throw new Error('parity 291-300 ambiguous particle anchor block missing');
const fixed = source.replace(oldBlock, newBlock);
const tempPath = '/tmp/patch-parity-291-300-fixed.mjs';
writeFileSync(tempPath, fixed);
await import(pathToFileURL(tempPath).href + `?v=${Date.now()}`);
console.log('Applied parity 291-300 v2 unique particle anchor.');
