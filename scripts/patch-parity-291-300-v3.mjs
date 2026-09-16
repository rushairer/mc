import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const sourcePath = 'scripts/patch-parity-291-300.mjs';
const source = readFileSync(sourcePath, 'utf8');
const label = "    'teleport particle shrink',";
const labelIndex = source.indexOf(label);
if (labelIndex < 0 || source.indexOf(label, labelIndex + label.length) >= 0) {
  throw new Error('expected exactly one teleport particle shrink label');
}
const start = source.lastIndexOf('  out = once(', labelIndex);
const close = source.indexOf('  );', labelIndex);
if (start < 0 || close < 0) throw new Error('unable to bound teleport particle shrink block');
const end = close + '  );'.length;
const replacement = String.raw`  out = once(
    out,
    \`      // Shrink size for flame, smoke, and glyphs\\n      if (p.type === 'flame' || p.type === 'smoke' || p.type === 'enchant') {\\n        const scale = alpha;\\n        p.mesh.scale.set(scale, scale, scale);\\n      }\`,
    \`      // Shrink size for flame, smoke, glyphs, and teleport particles\\n      if (p.type === 'flame' || p.type === 'smoke' || p.type === 'enchant' || p.type === 'teleport') {\\n        const scale = alpha;\\n        p.mesh.scale.set(scale, scale, scale);\\n      }\`,
    'teleport particle shrink',
  );`;

const fixed = source.slice(0, start) + replacement + source.slice(end);
const tempPath = '/tmp/patch-parity-291-300-fixed.mjs';
writeFileSync(tempPath, fixed);
await import(pathToFileURL(tempPath).href + `?v=${Date.now()}`);
console.log('Applied parity 291-300 v3 bounded particle anchor.');
