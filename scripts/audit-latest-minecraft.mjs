import fs from 'node:fs';

const manifest = JSON.parse(fs.readFileSync('docs/parity-manifest.json', 'utf8'));
const target = manifest.target?.version;

if (!target) {
  console.error('Parity manifest does not define target.version.');
  process.exit(1);
}

const response = await fetch('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json');
if (!response.ok) {
  throw new Error(`Failed to fetch Mojang version manifest: ${response.status}`);
}

const official = await response.json();
const latestRelease = official.latest?.release;
if (!latestRelease) throw new Error('Mojang version manifest did not include latest.release');

console.log(`Configured parity target: Minecraft Java ${target}`);
console.log(`Mojang latest release: Minecraft Java ${latestRelease}`);

if (target !== latestRelease) {
  console.error(`Parity target is stale: configured ${target}, latest stable is ${latestRelease}.`);
  process.exit(1);
}

console.log('Parity target matches Mojang latest stable Java release.');
