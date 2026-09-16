import { readFileSync, writeFileSync } from 'node:fs';

const particlePath = 'src/systems/ParticleSystem.ts';
const before = readFileSync(particlePath, 'utf8');
const from = `      if (p.type === 'flame' || p.type === 'smoke' || p.type === 'enchant') {\n        gravityVal = -0.5; // gentle upward drift (buoyancy)`;
const to = `      if ((p.type === 'flame' || p.type === 'smoke' || p.type === 'enchant')) {\n        gravityVal = -0.5; // gentle upward drift (buoyancy)`;
const first = before.indexOf(from);
if (first < 0 || before.indexOf(from, first + from.length) >= 0) {
  throw new Error('expected one ParticleSystem gravity condition anchor');
}
writeFileSync(particlePath, before.slice(0, first) + to + before.slice(first + from.length));

await import(`./patch-parity-291-300.mjs?v=${Date.now()}`);
console.log('Applied parity 291-300 v4 after deterministic ParticleSystem anchor disambiguation.');
