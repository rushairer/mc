import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cloneDeathDrop,
  getDeathXpDrop,
  resetXpAfterDeath,
  shouldDropStackOnDeath,
} from '../src/server/ServerDeathRules';

test('death XP is seven per level and capped at one hundred', () => {
  assert.equal(getDeathXpDrop(0), 0);
  assert.equal(getDeathXpDrop(1), 7);
  assert.equal(getDeathXpDrop(7), 49);
  assert.equal(getDeathXpDrop(14), 98);
  assert.equal(getDeathXpDrop(15), 100);
  assert.equal(getDeathXpDrop(68), 100);
});

test('death XP floors malformed fractional levels instead of overpaying', () => {
  assert.equal(getDeathXpDrop(2.9), 14);
  assert.equal(getDeathXpDrop(-10), 0);
  assert.equal(getDeathXpDrop(Number.NaN), 0);
});

test('keepInventory suppresses XP loss and death XP drops', () => {
  const state = { level: 12, current: 31, progress: 0.5 };
  assert.equal(getDeathXpDrop(12, true), 0);
  assert.deepEqual(resetXpAfterDeath(state, true), state);
});

test('normal death resets all server XP state', () => {
  assert.deepEqual(
    resetXpAfterDeath({ level: 12, current: 31, progress: 0.5 }),
    { level: 0, current: 0, progress: 0 },
  );
});

test('Curse of Vanishing equipment disappears instead of dropping', () => {
  const ordinary = { id: 276, count: 1 };
  const vanishing = {
    id: 276,
    count: 1,
    enchantments: [{ id: 'vanishing_curse' as any, level: 1 }],
  };
  assert.equal(shouldDropStackOnDeath(ordinary), true);
  assert.equal(shouldDropStackOnDeath(vanishing), false);
  assert.equal(shouldDropStackOnDeath(ordinary, true), false);
});

test('death drops are cloned before entering server entities', () => {
  const source = {
    id: 276,
    count: 1,
    enchantments: [{ id: 'sharpness' as const, level: 3 }],
  };
  const clone = cloneDeathDrop(source);
  assert.deepEqual(clone, source);
  assert.notEqual(clone, source);
  assert.notEqual(clone.enchantments, source.enchantments);
});
