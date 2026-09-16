import { readFileSync, writeFileSync } from 'node:fs';

function patch(path, from, to, label) {
  let source = readFileSync(path, 'utf8');
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`expected one ${label} target, got ${count}`);
  source = source.replace(from, to);
  writeFileSync(path, source, 'utf8');
}

patch(
  'src/engine/Game.ts',
  "if (this.player.health <= 0 && !isNetworkConnected)",
  "if (this.player.health <= 0 && !this.network.isConnected)",
  'network death authority',
);

patch(
  'src/App.tsx',
  "  chestInventory: null,\n",
  "  chestInventory: null,\n  serverContainerCursor: null,\n",
  'initial server container cursor',
);

console.log('client authority wiring fixes applied');
