import { readFileSync, writeFileSync } from 'node:fs';

await import('./patch-parity-259-270.mjs');

const testPath = 'tests/parity-259-270.test.ts';
const testBefore = readFileSync(testPath, 'utf8');
const testAfter = testBefore.replace(
  "manifest.axes.visualModels.status, 'partial'",
  "manifest.axes.visualModels.state, 'partial'",
);
if (testAfter === testBefore) throw new Error('parity 270 manifest-state fix anchor missing');
writeFileSync(testPath, testAfter);

const appPath = 'src/App.tsx';
const appBefore = readFileSync(appPath, 'utf8');
const appAnchor = "  attackCooldownProgress: 1,\n  currentDimension: 0,";
const appReplacement = "  attackCooldownProgress: 1,\n  improvedTransparency26_3: { enabled: false, backend: 'sorted-alpha', fullOit: false },\n  currentDimension: 0,";
if (!appBefore.includes(appAnchor)) throw new Error('App initial GameState transparency anchor missing');
if (appBefore.includes('improvedTransparency26_3: { enabled: false')) throw new Error('App initial GameState already patched unexpectedly');
writeFileSync(appPath, appBefore.replace(appAnchor, appReplacement));

console.log('Applied parity 259-270 v2 manifest and App GameState fixes.');
