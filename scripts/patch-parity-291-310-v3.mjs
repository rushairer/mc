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

  // The modern placement rewrite retires the legacy `baseId` local. Keep the
  // Wither skull special-case on the new legacy-only ID variable as well.
  const placementPath = 'src/world/BlockPlacement.ts';
  let placement = fs.readFileSync(placementPath, 'utf8');
  const before = 'checksWitherSpawn: baseId === 144';
  if (!placement.includes(before)) {
    throw new Error(`witherspawn parity anchor missing in ${placementPath}`);
  }
  placement = placement.replace(before, 'checksWitherSpawn: legacyBaseId === 144');
  fs.writeFileSync(placementPath, placement);
} finally {
  if (fs.existsSync(fixedPath)) fs.unlinkSync(fixedPath);
}
