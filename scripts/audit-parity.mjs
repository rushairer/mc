import fs from 'node:fs';

const manifest = JSON.parse(fs.readFileSync('docs/parity-manifest.json', 'utf8'));
const blocks = JSON.parse(fs.readFileSync('src/items/data/blocks.json', 'utf8'));
const items = JSON.parse(fs.readFileSync('src/items/data/items.json', 'utf8'));

const errors = [];
const allowedStates = new Set(['complete', 'partial', 'missing', 'unknown', 'not-applicable']);
const requiredAxes = ['definitions', 'visualModels', 'behavior', 'automatedAcceptance'];

if (manifest.schemaVersion !== 1) errors.push('Unsupported parity manifest schema.');
if (manifest.target?.edition !== 'java' || manifest.target?.version !== '1.20.1') {
  errors.push('Parity target must remain fixed to Minecraft Java 1.20.1.');
}
if ('overallCompletion' in manifest || 'completionPercent' in manifest) {
  errors.push('Do not collapse parity into a single completion percentage.');
}

for (const axis of requiredAxes) {
  if (!allowedStates.has(manifest.axes?.[axis]?.state)) errors.push(`Missing or invalid axis state: ${axis}`);
}
for (const [systemName, axes] of Object.entries(manifest.systems ?? {})) {
  for (const axis of requiredAxes) {
    if (!allowedStates.has(axes?.[axis])) errors.push(`${systemName}.${axis} has an invalid state.`);
  }
}

if (manifest.inventory?.baseBlockDefinitions !== blocks.length) {
  errors.push(`Manifest block count ${manifest.inventory?.baseBlockDefinitions} does not match registry ${blocks.length}.`);
}
if (manifest.inventory?.baseItemDefinitions !== items.length) {
  errors.push(`Manifest item count ${manifest.inventory?.baseItemDefinitions} does not match registry ${items.length}.`);
}

const requiredGates = [
  'unitTests', 'typeCheck', 'productionBuild', 'browserSmoke',
  'newWorldInteractiveSecondsMax', 'targetFpsAt1080pRenderDistance8',
  'longRunMinutes', 'unboundedEntityGrowthAllowed', 'consoleErrorsAllowed',
];
for (const gate of requiredGates) {
  if (!(gate in (manifest.releaseGates ?? {}))) errors.push(`Missing release gate: ${gate}`);
}

console.log(`Parity target: Minecraft Java ${manifest.target?.version}`);
for (const axis of requiredAxes) console.log(`${axis}: ${manifest.axes?.[axis]?.state}`);
console.log(`Tracked systems: ${Object.keys(manifest.systems ?? {}).length}`);

if (errors.length) {
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log('Parity manifest is valid.');
}
