import assert from 'node:assert/strict';
import test from 'node:test';
import type { BlockDef } from '../src/types';
import {
  getBlockLootTable,
  pickWeightedLootEntry,
  rollBlockLoot,
  rollLootTable,
  type LootTable,
} from '../src/world/LootSystem';
import { BlockRegistry } from '../src/world/BlockRegistry';

/** Deterministic rng from a fixed sequence (loops at the end). */
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

test('rollLootTable is deterministic for a given rng', () => {
  const table: LootTable = {
    pools: [{ rolls: { min: 2, max: 4 }, entries: [{ itemId: 10, min: 1, max: 3, weight: 1 }] }],
  };
  const rng = seq([0.5, 0.4, 0.2]);
  const first = rollLootTable(table, rng);
  const second = rollLootTable(table, seq([0.5, 0.4, 0.2]));
  assert.deepEqual(first, second);
});

test('weighted single-pick pools select exactly one entry', () => {
  const table: LootTable = {
    pools: [{ rolls: 1, entries: [{ itemId: 318, min: 1, max: 1, weight: 1 }, { itemId: 13, min: 1, max: 1, weight: 9 }] }],
  };
  assert.deepEqual(rollLootTable(table, seq([0.0])), [{ itemId: 318, count: 1 }]);
  assert.deepEqual(rollLootTable(table, seq([0.95])), [{ itemId: 13, count: 1 }]);
});

test('chance entries gate independently', () => {
  const table: LootTable = {
    pools: [{ rolls: 1, entries: [{ itemId: 42, min: 1, max: 1, chance: 0.5 }] }],
  };
  assert.deepEqual(rollLootTable(table, seq([0.4])), [{ itemId: 42, count: 1 }]);
  assert.deepEqual(rollLootTable(table, seq([0.6])), []);
});

test('pickWeightedLootEntry picks by weight and honors bounds', () => {
  const entries = [
    { itemId: 1, min: 1, max: 1, weight: 1 },
    { itemId: 2, min: 1, max: 1, weight: 3 },
  ];
  assert.equal(pickWeightedLootEntry(entries, seq([0.0]))?.itemId, 1);
  assert.equal(pickWeightedLootEntry(entries, seq([0.9]))?.itemId, 2);
  assert.equal(pickWeightedLootEntry([], seq([0.5])), undefined);
  assert.equal(pickWeightedLootEntry([entries[0]], seq([0.5]))?.itemId, 1);
});

test('default block loot is a self-drop with no randomness', () => {
  const stone = BlockRegistry.getByName('stone');
  assert.ok(stone);
  assert.deepEqual(rollBlockLoot(stone, seq([0.5])), [{ itemId: stone.id, count: 1 }]);
});

test('named block loot tables replace self-drops', () => {
  const cases: Array<[string, number]> = [
    ['grass', 3],        // grass -> dirt
    ['coal_ore', 263],   // -> coal
    ['diamond_ore', 264],// -> diamond
    ['redstone_ore', 331],
    ['clay', 337],
    ['cauldron', 380],
  ];
  for (const [name, itemId] of cases) {
    const block = BlockRegistry.getByName(name);
    assert.ok(block, `block ${name} exists`);
    assert.deepEqual(rollBlockLoot(block, seq([0.5])), [{ itemId, count: 1 }], name);
  }
});

test('gravel flint odds follow the weighted table', () => {
  const gravel = BlockRegistry.getByName('gravel');
  assert.ok(gravel);
  let flint = 0;
  const trials = 2000;
  for (let i = 0; i < trials; i++) {
    const drops = rollBlockLoot(gravel, seq([i / trials]));
    if (drops[0]?.itemId === 318) flint++;
  }
  // Expect ~10%; tolerate a wide band to keep the test robust.
  const rate = flint / trials;
  assert.ok(rate > 0.05 && rate < 0.2, `flint rate ${rate}`);
});

test('lootTable id resolves through named tables (data pack hook)', () => {
  const fakeBlock: BlockDef = {
    id: 9999,
    officialId: 'minecraft:gravel',
    name: 'gravel',
    textureKey: 'gravel',
    transparent: false,
    solid: true,
    hardness: 0.6,
    lootTable: 'minecraft:blocks/gravel',
  };
  assert.equal(getBlockLootTable(fakeBlock), getBlockLootTable(BlockRegistry.getByName('gravel')));
});
