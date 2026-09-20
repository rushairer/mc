import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inferItemBehaviorId } from '../src/world/BehaviorIds';
import { getDefaultUseRemainderItemId, getItemUseDurationSeconds } from '../src/items/ItemUseRules';
import { ItemRegistry } from '../src/items/ItemRegistry';
import { shelfMushroomAfterBoneMeal } from '../src/world/WildernessBound26_3';
import {
  resolveAxeStrippedBlockName,
  resolveShovelPathTargetName,
  rotateBoneMealSpreadOffsets26_3,
} from '../src/world/ItemOnBlockRules';
import { registerWildernessBound26_3 } from '../src/world/registerWildernessBound26_3';

registerWildernessBound26_3();
const item = (name: string) => {
  const def = ItemRegistry.getByName(name);
  assert.ok(def, name);
  return def;
};

test('463: Milk Bucket dispatches through a dedicated continuous-use behavior', () => {
  assert.equal(inferItemBehaviorId('milk_bucket'), 'minecraft:milk');
  assert.equal(item('milk_bucket').behaviorId, 'minecraft:milk');
});

test('464: Milk Bucket uses the Java drinking duration and returns an empty Bucket', () => {
  assert.equal(getItemUseDurationSeconds(item('milk_bucket').id), 1.6);
  assert.equal(getDefaultUseRemainderItemId(item('milk_bucket').id), item('bucket').id);
});

test('465: live Milk use clears active effects without changing hunger logic', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  assert.ok(source.includes("id: 'minecraft:milk'"));
  assert.ok(source.includes('this.continueMilkUse(stack, progress.deltaSeconds)'));
  assert.ok(source.includes('this.potionEffects.clear()'));
  assert.ok(source.includes('this.player.absorption = 0'));
});

test('466: every shovel material routes through the shared shovel behavior', () => {
  for (const name of ['wooden_shovel', 'stone_shovel', 'iron_shovel', 'golden_shovel', 'diamond_shovel']) {
    assert.equal(inferItemBehaviorId(name), 'minecraft:shovel', name);
  }
});

test('467: shovel path conversion accepts dirt-family surfaces and rejects stone', () => {
  for (const name of ['grass', 'grass_block', 'dirt', 'coarse_dirt', 'podzol', 'mycelium', 'rooted_dirt']) {
    assert.equal(resolveShovelPathTargetName(name), 'dirt_path', name);
  }
  assert.equal(resolveShovelPathTargetName('stone'), null);
});

test('468: live shovel use requires the top face and free space, then spends durability', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const method = source.match(/private tryUseShovel[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.ok(method.includes("target.face !== 'up'"));
  assert.ok(method.includes('this.chunks.getBlock(x, y + 1, z) !== 0'));
  assert.ok(method.includes("BlockRegistry.getByName('dirt_path')"));
  assert.ok(method.includes('this.inventory.damageTool(this.player.selectedSlot)'));
});

test('469: every axe material routes through the shared axe behavior without catching pickaxes', () => {
  for (const name of ['wooden_axe', 'stone_axe', 'iron_axe', 'golden_axe', 'diamond_axe']) {
    assert.equal(inferItemBehaviorId(name), 'minecraft:axe', name);
  }
  assert.notEqual(inferItemBehaviorId('diamond_pickaxe'), 'minecraft:axe');
});

test('470: axe stripping resolves Poplar log and wood to their stripped 26.3 blocks', () => {
  assert.equal(resolveAxeStrippedBlockName('poplar_log'), 'stripped_poplar_log');
  assert.equal(resolveAxeStrippedBlockName('poplar_wood'), 'stripped_poplar_wood');
  assert.equal(resolveAxeStrippedBlockName('stripped_poplar_log'), null);
});

test('471: live axe stripping preserves block metadata and spends durability', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const method = source.match(/private tryUseAxe[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.ok(method.includes('resolveAxeStrippedBlockName(target.block.name)'));
  assert.ok(method.includes('this.chunks.setBlockMeta(x, y, z, metadata ?? null, true)'));
  assert.ok(method.includes('this.inventory.damageTool(this.player.selectedSlot)'));
});

test('472: Bone Meal has a first-class item-on-block behavior', () => {
  assert.equal(inferItemBehaviorId('bone_meal'), 'minecraft:bone_meal');
  assert.equal(item('bone_meal').behaviorId, 'minecraft:bone_meal');
});

test('473: Shelf Mushroom Bone Meal upgrades small/default state to large once', () => {
  assert.equal(shelfMushroomAfterBoneMeal('small'), 'large');
  assert.equal(shelfMushroomAfterBoneMeal('large'), 'large');
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  assert.ok(source.includes("shelfMushroomSize === 'large'"));
  assert.ok(source.includes("shelfMushroomSize: 'large'"));
});

test('474: Red Shrub Bone Meal checks all adjacent spaces and consumes only after a successful spread', () => {
  const offsets = rotateBoneMealSpreadOffsets26_3(3);
  assert.equal(offsets.length, 8);
  assert.equal(new Set(offsets.map(offset => offset.x + ',' + offset.z)).size, 8);
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const method = source.match(/private tryUseBoneMeal26_3[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.ok(method.includes("target.block.name !== 'red_shrub'"));
  assert.ok(method.includes('BlockRegistry.isSolid(this.chunks.getBlock(nx, y - 1, nz))'));
  assert.ok(method.includes('this.inventory.removeFromSlot(this.player.selectedSlot, 1)'));
  assert.ok(method.includes('return false;'));
});
