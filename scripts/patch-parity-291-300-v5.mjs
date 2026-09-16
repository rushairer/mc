import { readFileSync, writeFileSync } from 'node:fs';

function replaceUnique(path, from, to, expectedCount) {
  const before = readFileSync(path, 'utf8');
  let count = 0;
  let cursor = 0;
  while ((cursor = before.indexOf(from, cursor)) >= 0) {
    count++;
    cursor += from.length;
  }
  if (count !== expectedCount) throw new Error(`${path}: expected ${expectedCount} anchors, got ${count}`);
  const first = before.indexOf(from);
  writeFileSync(path, before.slice(0, first) + to + before.slice(first + from.length));
}

replaceUnique(
  'src/systems/ParticleSystem.ts',
  `      if (p.type === 'flame' || p.type === 'smoke' || p.type === 'enchant') {\n        gravityVal = -0.5; // gentle upward drift (buoyancy)`,
  `      if ((p.type === 'flame' || p.type === 'smoke' || p.type === 'enchant')) {\n        gravityVal = -0.5; // gentle upward drift (buoyancy)`,
  1,
);

// Potion drinking and food eating currently send the same C2S consume packet.
// The food path is the second occurrence; make the earlier potion condition
// textually distinct without changing its semantics so the original patcher's
// exact anchor can target Chorus Fruit consumption only.
replaceUnique(
  'src/engine/Game.ts',
  `    if (this.isMultiplayerNetworkConnected()) {\n      this.network.send(PacketType.C2S_ITEM_CONSUME, {`,
  `    if ((this.isMultiplayerNetworkConnected())) {\n      this.network.send(PacketType.C2S_ITEM_CONSUME, {`,
  2,
);

await import(`./patch-parity-291-300.mjs?v=${Date.now()}`);
console.log('Applied parity 291-300 v5 with deterministic source disambiguation.');
