import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  applyContainerClick,
  applyServerContainerClick,
  canStacksMerge,
  containerKey,
  createContainerSlots,
  parseContainerClickIntent,
  returnContainerCursorToInventory,
  validateContainerClick,
  validateContainerSlots,
} from '../src/server/ContainerRules';
import { GameServer } from '../src/server/GameServer';

// ─── Container rules (P5.3) ───

test('createContainerSlots sizes by block', () => {
  assert.equal(createContainerSlots('chest').length, 27);
  assert.equal(createContainerSlots('barrel').length, 27);
  assert.equal(createContainerSlots('hopper').length, 5);
  assert.equal(createContainerSlots('unknown').length, 27, 'defaults to chest size');
});

test('validateContainerClick bounds the slot and checks the held item', () => {
  const slots = createContainerSlots('chest');
  assert.equal(validateContainerClick(0, slots, null), true, 'pickup only');
  assert.equal(validateContainerClick(26, slots, { id: 1, count: 1 }), true);
  assert.equal(validateContainerClick(27, slots, null), false, 'out of range');
  assert.equal(validateContainerClick(-1, slots, null), false);
  assert.equal(validateContainerClick(0, slots, { id: 0, count: 1 }), false, 'invalid id');
  assert.equal(validateContainerClick(0, slots, { id: 1, count: 0 }), false);
  assert.equal(validateContainerClick(0, slots, { id: 276, count: 2 }), false, 'registry stack limit');
});

test('applyContainerClick places, swaps and stacks for local callers', () => {
  let slots = createContainerSlots('chest');
  slots = applyContainerClick(slots, 0, { id: 5, count: 4 });
  assert.deepEqual(slots[0], { id: 5, count: 4 });
  slots = applyContainerClick(slots, 0, { id: 5, count: 2 });
  assert.deepEqual(slots[0], { id: 5, count: 6 }, 'same-id stacks');
  slots = applyContainerClick(slots, 0, null);
  assert.equal(slots[0], null, 'pickup empties the slot');
});

test('validateContainerSlots rejects wrong sizes and registry over-stacks', () => {
  assert.equal(validateContainerSlots(new Array(27).fill(null), 27), true);
  assert.equal(validateContainerSlots(new Array(26).fill(null), 27), false, 'wrong size');
  const bad = new Array(27).fill(null);
  bad[3] = { id: 1, count: 65 };
  assert.equal(validateContainerSlots(bad, 27), false, 'over-stack');
  const badToolStack = new Array(27).fill(null);
  badToolStack[3] = { id: 276, count: 2 };
  assert.equal(validateContainerSlots(badToolStack, 27), false, 'non-stackable tools');
  const badId = new Array(27).fill(null);
  badId[3] = { id: -1, count: 1 };
  assert.equal(validateContainerSlots(badId, 27), false);
});

test('container click packets contain only area and slot intent', () => {
  assert.deepEqual(parseContainerClickIntent({ area: 'container', slotIndex: 5, item: { id: 57, count: 64 } }), {
    area: 'container', slotIndex: 5,
  });
  assert.deepEqual(parseContainerClickIntent({ area: 'player', slotIndex: 8 }), { area: 'player', slotIndex: 8 });
  assert.equal(parseContainerClickIntent({ area: 'cursor', slotIndex: 0 }), null);
  assert.equal(parseContainerClickIntent({ area: 'container', slotIndex: -1 }), null);
});

test('server picks up and places stacks using its own cursor state', () => {
  const containerSlots = createContainerSlots('chest');
  containerSlots[0] = { id: 5, count: 12 };
  const state = { containerSlots, playerSlots: new Array(36).fill(null), cursor: null };
  const picked = applyServerContainerClick(state, { area: 'container', slotIndex: 0 })!;
  assert.deepEqual(picked.cursor, { id: 5, count: 12 });
  assert.equal(picked.containerSlots[0], null);
  const placed = applyServerContainerClick(picked, { area: 'player', slotIndex: 4 })!;
  assert.deepEqual(placed.playerSlots[4], { id: 5, count: 12 });
  assert.equal(placed.cursor, null);
  assert.deepEqual(state.containerSlots[0], { id: 5, count: 12 }, 'source state is immutable');
});

test('server stacks only matching item metadata and respects registry max stack', () => {
  const containerSlots = createContainerSlots('chest');
  containerSlots[0] = { id: 5, count: 63 };
  const state = { containerSlots, playerSlots: new Array(36).fill(null), cursor: { id: 5, count: 4 } };
  const next = applyServerContainerClick(state, { area: 'container', slotIndex: 0 })!;
  assert.deepEqual(next.containerSlots[0], { id: 5, count: 64 });
  assert.deepEqual(next.cursor, { id: 5, count: 3 });

  const enchanted = { id: 276, count: 1, enchantments: [{ id: 'sharpness' as const, level: 1 }] };
  const plain = { id: 276, count: 1 };
  assert.equal(canStacksMerge(enchanted, plain), false);
});

test('server swaps unlike cursor and slot stacks without accepting client item snapshots', () => {
  const containerSlots = createContainerSlots('chest');
  containerSlots[0] = { id: 1, count: 32 };
  const next = applyServerContainerClick(
    { containerSlots, playerSlots: new Array(36).fill(null), cursor: { id: 5, count: 16 } },
    { area: 'container', slotIndex: 0 },
  )!;
  assert.deepEqual(next.containerSlots[0], { id: 5, count: 16 });
  assert.deepEqual(next.cursor, { id: 1, count: 32 });
});

test('closing a container returns cursor items to partial stacks before empty slots', () => {
  const playerSlots = new Array(36).fill(null);
  playerSlots[0] = { id: 5, count: 62 };
  const next = returnContainerCursorToInventory({
    containerSlots: createContainerSlots('chest'),
    playerSlots,
    cursor: { id: 5, count: 5 },
  });
  assert.deepEqual(next.playerSlots[0], { id: 5, count: 64 });
  assert.deepEqual(next.playerSlots[1], { id: 5, count: 3 });
  assert.equal(next.cursor, null);
});

test('container close preserves a cursor remainder when inventory is full', () => {
  const playerSlots = new Array(36).fill(null).map(() => ({ id: 1, count: 64 }));
  const next = returnContainerCursorToInventory({
    containerSlots: createContainerSlots('chest'),
    playerSlots,
    cursor: { id: 5, count: 5 },
  });
  assert.deepEqual(next.cursor, { id: 5, count: 5 });
});

// ─── World save/load (P5.3) ───

test('GameServer world snapshot round-trips chunks and containers', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mc-save-'));
  const path = join(dir, 'world.json');
  try {
    const server = new GameServer(4242);
    server.setBlock(0, 64, 0, 1, 0);
    const chestKey = containerKey(5, 64, 5);
    (server as any).containerData.set(chestKey, [{ id: 263, count: 3 }]);

    await server.saveWorld(path);
    const reloaded = new GameServer(9999);
    await reloaded.loadWorld(path);
    assert.equal(reloaded.getBlock(0, 64, 0, 0), 1, 'block restored');
    const slots = (reloaded as any).containerData.get(chestKey);
    assert.deepEqual(slots, [{ id: 263, count: 3 }], 'container restored');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
