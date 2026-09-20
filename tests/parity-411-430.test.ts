import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  applyServerContainerClick,
  createContainerSlots,
  parseContainerClickIntent,
  returnContainerCursorToInventory,
  validateContainerSlots,
} from '../src/server/ContainerRules';
import { ItemRegistry } from '../src/items/ItemRegistry';
import { registerWildernessBound26_3 } from '../src/world/registerWildernessBound26_3';

registerWildernessBound26_3();

const emptyPlayer = () => new Array(36).fill(null);
const item = (name: string) => {
  const def = ItemRegistry.getByName(name);
  assert.ok(def, name);
  return def;
};
const state = (
  containerSlots = createContainerSlots('chest'),
  playerSlots = emptyPlayer(),
  cursor = null as any,
) => ({ containerSlots, playerSlots, cursor });

test('411: container intent accepts right-click and shift modifiers without item snapshots', () => {
  assert.deepEqual(
    parseContainerClickIntent({
      area: 'container',
      slotIndex: 4,
      button: 'right',
      shift: true,
      item: { id: 57, count: 64 },
    }),
    { area: 'container', slotIndex: 4, button: 'right', shift: true },
  );
});

test('412: container intent rejects invalid buttons and non-boolean shift flags', () => {
  assert.equal(parseContainerClickIntent({ area: 'container', slotIndex: 0, button: 'middle' }), null);
  assert.equal(parseContainerClickIntent({ area: 'player', slotIndex: 0, shift: 'yes' }), null);
});

test('413: legacy left-click packets remain backward compatible', () => {
  assert.deepEqual(
    parseContainerClickIntent({ area: 'player', slotIndex: 8 }),
    { area: 'player', slotIndex: 8 },
  );
});

test('414: server left-click respects the effective max size of damageable items', () => {
  const sword = item('diamond_sword');
  const slots = createContainerSlots('chest');
  slots[0] = { id: sword.id, count: 1 };
  const next = applyServerContainerClick(
    state(slots, emptyPlayer(), { id: sword.id, count: 1 }),
    { area: 'container', slotIndex: 0 },
  )!;
  assert.deepEqual(next.containerSlots[0], { id: sword.id, count: 1 });
  assert.deepEqual(next.cursor, { id: sword.id, count: 1 });
});

test('415: persisted container validation rejects over-stacked damageable items', () => {
  const sword = item('diamond_sword');
  const slots = createContainerSlots('chest');
  slots[0] = { id: sword.id, count: 2 };
  assert.equal(validateContainerSlots(slots, 27), false);
});

test('416: right-click pickup takes the larger half of an odd stack', () => {
  const slots = createContainerSlots('chest');
  slots[0] = { id: 5, count: 5 };
  const next = applyServerContainerClick(state(slots), {
    area: 'container', slotIndex: 0, button: 'right',
  })!;
  assert.deepEqual(next.cursor, { id: 5, count: 3 });
  assert.deepEqual(next.containerSlots[0], { id: 5, count: 2 });
});

test('417: right-click pickup of a single item clears the slot', () => {
  const slots = createContainerSlots('chest');
  slots[0] = { id: 5, count: 1 };
  const next = applyServerContainerClick(state(slots), {
    area: 'container', slotIndex: 0, button: 'right',
  })!;
  assert.deepEqual(next.cursor, { id: 5, count: 1 });
  assert.equal(next.containerSlots[0], null);
});

test('418: right-click places exactly one cursor item into an empty slot', () => {
  const next = applyServerContainerClick(
    state(createContainerSlots('chest'), emptyPlayer(), { id: 5, count: 4 }),
    { area: 'container', slotIndex: 0, button: 'right' },
  )!;
  assert.deepEqual(next.containerSlots[0], { id: 5, count: 1 });
  assert.deepEqual(next.cursor, { id: 5, count: 3 });
});

test('419: right-click adds exactly one item to a compatible stack', () => {
  const slots = createContainerSlots('chest');
  slots[0] = { id: 5, count: 10 };
  const next = applyServerContainerClick(
    state(slots, emptyPlayer(), { id: 5, count: 4 }),
    { area: 'container', slotIndex: 0, button: 'right' },
  )!;
  assert.deepEqual(next.containerSlots[0], { id: 5, count: 11 });
  assert.deepEqual(next.cursor, { id: 5, count: 3 });
});

test('420: right-click refuses to merge incompatible stacks', () => {
  const slots = createContainerSlots('chest');
  slots[0] = { id: 1, count: 8 };
  const next = applyServerContainerClick(
    state(slots, emptyPlayer(), { id: 5, count: 4 }),
    { area: 'container', slotIndex: 0, button: 'right' },
  )!;
  assert.deepEqual(next.containerSlots[0], { id: 1, count: 8 });
  assert.deepEqual(next.cursor, { id: 5, count: 4 });
});

test('421: right-click refuses an already-full compatible stack', () => {
  const slots = createContainerSlots('chest');
  slots[0] = { id: 5, count: 64 };
  const next = applyServerContainerClick(
    state(slots, emptyPlayer(), { id: 5, count: 4 }),
    { area: 'container', slotIndex: 0, button: 'right' },
  )!;
  assert.deepEqual(next.containerSlots[0], { id: 5, count: 64 });
  assert.deepEqual(next.cursor, { id: 5, count: 4 });
});

test('422: shift-click container to player merges partial stacks before empty slots', () => {
  const container = createContainerSlots('chest');
  const player = emptyPlayer();
  container[0] = { id: 5, count: 5 };
  player[9] = { id: 5, count: 62 };
  const next = applyServerContainerClick(state(container, player), {
    area: 'container', slotIndex: 0, shift: true,
  })!;
  assert.equal(next.containerSlots[0], null);
  assert.deepEqual(next.playerSlots[9], { id: 5, count: 64 });
  assert.deepEqual(next.playerSlots[10], { id: 5, count: 3 });
});

test('423: shift-click from a container fills main inventory before hotbar', () => {
  const container = createContainerSlots('chest');
  container[0] = { id: 5, count: 3 };
  const next = applyServerContainerClick(state(container), {
    area: 'container', slotIndex: 0, shift: true,
  })!;
  assert.deepEqual(next.playerSlots[9], { id: 5, count: 3 });
  assert.equal(next.playerSlots[0], null);
});

test('424: shift-click player to container merges before using an empty container slot', () => {
  const container = createContainerSlots('chest');
  const player = emptyPlayer();
  container[0] = { id: 5, count: 62 };
  player[0] = { id: 5, count: 5 };
  const next = applyServerContainerClick(state(container, player), {
    area: 'player', slotIndex: 0, shift: true,
  })!;
  assert.equal(next.playerSlots[0], null);
  assert.deepEqual(next.containerSlots[0], { id: 5, count: 64 });
  assert.deepEqual(next.containerSlots[1], { id: 5, count: 3 });
});

test('425: shift-click keeps different stack components separate', () => {
  const container = createContainerSlots('chest');
  const player = emptyPlayer();
  container[0] = { id: 5, count: 10, customName: 'A' };
  player[0] = { id: 5, count: 2, customName: 'B' };
  const next = applyServerContainerClick(state(container, player), {
    area: 'player', slotIndex: 0, shift: true,
  })!;
  assert.deepEqual(next.containerSlots[0], { id: 5, count: 10, customName: 'A' });
  assert.deepEqual(next.containerSlots[1], { id: 5, count: 2, customName: 'B' });
});

test('426: shift-click merges stacks only when modeled components are identical', () => {
  const container = createContainerSlots('chest');
  const player = emptyPlayer();
  container[0] = { id: 5, count: 10, customName: 'A' };
  player[0] = { id: 5, count: 2, customName: 'A' };
  const next = applyServerContainerClick(state(container, player), {
    area: 'player', slotIndex: 0, shift: true,
  })!;
  assert.deepEqual(next.containerSlots[0], { id: 5, count: 12, customName: 'A' });
  assert.equal(next.playerSlots[0], null);
});

test('427: shift-click respects sixteen-item stack limits', () => {
  const pearl = item('ender_pearl');
  assert.equal(pearl.maxStackSize, 16);
  const container = createContainerSlots('chest');
  const player = emptyPlayer();
  container[0] = { id: pearl.id, count: 15 };
  player[0] = { id: pearl.id, count: 4 };
  const next = applyServerContainerClick(state(container, player), {
    area: 'player', slotIndex: 0, shift: true,
  })!;
  assert.deepEqual(next.containerSlots[0], { id: pearl.id, count: 16 });
  assert.deepEqual(next.containerSlots[1], { id: pearl.id, count: 3 });
  assert.equal(next.playerSlots[0], null);
});

test('428: quick-move leaves the server-owned cursor untouched', () => {
  const container = createContainerSlots('chest');
  container[0] = { id: 5, count: 2 };
  const next = applyServerContainerClick(
    state(container, emptyPlayer(), { id: 1, count: 7 }),
    { area: 'container', slotIndex: 0, shift: true },
  )!;
  assert.deepEqual(next.cursor, { id: 1, count: 7 });
});

test('429: container close uses the effective max size for a damageable cursor item', () => {
  const sword = item('diamond_sword');
  const next = returnContainerCursorToInventory(
    state(createContainerSlots('chest'), emptyPlayer(), { id: sword.id, count: 1 }),
  );
  assert.deepEqual(next.playerSlots[0], { id: sword.id, count: 1 });
  assert.equal(next.cursor, null);
});

test('430: runtime and UI keep container transactions intent-only and modifier-aware', () => {
  const game = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const server = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const chest = readFileSync(new URL('../src/ui/ChestUI.tsx', import.meta.url), 'utf8');
  const hopper = readFileSync(new URL('../src/ui/HopperUI.tsx', import.meta.url), 'utf8');

  const method = game.match(/serverContainerClick\([\s\S]*?return true;\n  \}/)?.[0] ?? '';
  assert.ok(method.includes('C2S_CONTAINER_CLICK'));
  assert.ok(method.includes('...options'));
  assert.ok(!method.includes('item:'));
  assert.ok(server.includes('const intent = parseContainerClickIntent(packet.payload);'));
  assert.ok(server.includes('const next = applyServerContainerClick({'));
  assert.ok(chest.includes('onContextMenu={(e) => {'));
  assert.ok(chest.includes("button: 'right'"));
  assert.ok(chest.includes('shift: e.shiftKey'));
  assert.ok(hopper.includes("button: 'right'"));
  assert.ok(hopper.includes('shift: e.shiftKey'));
});
