import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const sourcePath = 'scripts/patch-parity-291-310-v2.mjs';
const fixedPath = 'scripts/.patch-parity-291-310-v2-fixed.mjs';
let source = fs.readFileSync(sourcePath, 'utf8');

// v2 embeds TypeScript source in template literals. This single unescaped nested
// template literal closes the generator string too early. Use equivalent string
// concatenation in generated TypeScript so the patcher itself is valid ESM.
source = source.replace(
  "  return `${identity.kind}_${identity.registryName}`;",
  "  return identity.kind + '_' + identity.registryName;",
);

fs.writeFileSync(fixedPath, source);
try {
  await import(`${pathToFileURL(process.cwd() + '/' + fixedPath).href}?v=${Date.now()}`);
} finally {
  if (fs.existsSync(fixedPath)) fs.unlinkSync(fixedPath);
}
