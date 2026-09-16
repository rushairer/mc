import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CREATIVE_BLOCK_REACH,
  SURVIVAL_BLOCK_REACH,
  canPlaceHeldBlock,
  consumeHeldStack,
  getBlockInteractionReach,
  isBlockActionInReach,
  isValidHotbarSlot,
  isValidInventoryStack,
  isValidWorldY,
} from '../src/server/ServerWorldActionRules';

test('block reach matches Java survival and creative interaction distances', () => {
  assert.equal(SURVIVAL_BLOCK_REACH, 4.5);
  assert.equal(CREATIVE_BLOCK_REACH, 5);
  assert.equal(getBlockInteractionReach('survival'), 4.5);
  assert.equal(getBlockInteractionReach('creative'), 5);
});

test('block reach measures to the target block AABB rather than its center', () => {
  const player = { x: 0.5, y: 64, z: 0.5 };
  assert.equal(isBlockActionInReach(player, 0, 64, -5, 'survival'), true);
  assert.equal(isBlockActionInReach(player, 0, 64, -6, 'survival'), false);
});

test('hotbar selection is restricted to the nine Java hotbar slots', () => {
  for (let slot = 0; slot < 9; slot++) assert.equal(isValidHotbarSlot(slot), true);
  assert.equal(isValidHotbarSlot(-1), false);
  assert.equal(isValidHotbarSlot(9), false);
  assert.equal(isValidHotbarSlot(1.5), false);
  assert.equal(isValidHotbarSlot('1'), false);
});

test('world y validation rejects fractional and out-of-world coordinates', () => {
  assert.equal(isValidWorldY(0, 256), true);
  assert.equal(isValidWorldY(255, 256), true);
  assert.equal(isValidWorldY(-1, 256), false);
  assert.equal(isValidWorldY(256, 256), false);
  assert.equal(isValidWorldY(64.5, 256), false);
});

test('inventory stack validation enforces registered ids and max stack sizes', () => {
  assert.equal(isValidInventoryStack(null), true);
  assert.equal(isValidInventoryStack({ id: 1, count: 64 }), true);
  assert.equal(isValidInventoryStack({ id: 1, count: 65 }), false);
  assert.equal(isValidInventoryStack({ id: 276, count: 2 }), false, 'tools are non-stackable');
  assert.equal(isValidInventoryStack({ id: -1, count: 1 }), false);
});

test('durability values cannot exceed the registry maximum or reach zero', () => {
  assert.equal(isValidInventoryStack({ id: 276, count: 1, durability: 100 }), true);
  assert.equal(isValidInventoryStack({ id: 276, count: 1, durability: 0 }), false);
  assert.equal(isValidInventoryStack({ id: 276, count: 1, durability: 99999 }), false);
});

test('server placement requires the held item to place the requested block', () => {
  assert.equal(canPlaceHeldBlock({ id: 1, count: 1 }, 1), true);
  assert.equal(canPlaceHeldBlock({ id: 1, count: 1 }, 2), false);
  assert.equal(canPlaceHeldBlock({ id: 276, count: 1 }, 1), false);
});

test('consuming a placed stack decrements or clears it without mutating input', () => {
  const stack = { id: 1, count: 2 };
  assert.deepEqual(consumeHeldStack(stack), { id: 1, count: 1 });
  assert.equal(stack.count, 2);
  assert.equal(consumeHeldStack({ id: 1, count: 1 }), null);
});
