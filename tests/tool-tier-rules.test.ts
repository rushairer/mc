import assert from 'node:assert/strict';
import test from 'node:test';
import type { ItemDef } from '../src/items/ItemRegistry';
import { ItemRegistry } from '../src/items/ItemRegistry';
import { canHarvestBlock, getToolHarvestTier } from '../src/items/ToolTierRules';
import { BlockRegistry } from '../src/world/BlockRegistry';

function tool(name: string, toolMaterial: ItemDef['toolMaterial']): ItemDef {
  return {
    id: 5000,
    officialId: `minecraft:${name}`,
    baseId: 5000,
    metadata: 0,
    name,
    displayName: name,
    maxStackSize: 1,
    category: 'tool',
    toolType: 'pickaxe',
    toolMaterial,
    durability: 100,
    damage: 2,
    miningSpeed: 6,
  };
}

test('maps tool materials to Java 1.20.1 harvest tiers', () => {
  assert.equal(getToolHarvestTier(tool('wooden_pickaxe', 'wood')), 0);
  assert.equal(getToolHarvestTier(tool('golden_pickaxe', 'gold')), 0);
  assert.equal(getToolHarvestTier(tool('stone_pickaxe', 'stone')), 1);
  assert.equal(getToolHarvestTier(tool('iron_pickaxe', 'iron')), 2);
  assert.equal(getToolHarvestTier(tool('diamond_pickaxe', 'diamond')), 3);
  assert.equal(getToolHarvestTier(tool('netherite_pickaxe', 'netherite')), 4);
  assert.equal(getToolHarvestTier(undefined), 0);
});

test('canHarvestBlock gates on required tier', () => {
  assert.equal(canHarvestBlock(tool('iron_pickaxe', 'iron'), 2), true);
  assert.equal(canHarvestBlock(tool('stone_pickaxe', 'stone'), 2), false);
  assert.equal(canHarvestBlock(tool('golden_pickaxe', 'gold'), 2), false);
  assert.equal(canHarvestBlock(tool('wooden_pickaxe', 'wood'), 1), false);
  assert.equal(canHarvestBlock(undefined, 2), false);
  assert.equal(canHarvestBlock(tool('iron_pickaxe', 'iron'), 0), true);
});

test('ItemRegistry.canHarvest uses block harvest tags', () => {
  const diamondOre = BlockRegistry.getByName('diamond_ore');
  const ironOre = BlockRegistry.getByName('iron_ore');
  const stone = BlockRegistry.getByName('stone');
  assert.ok(diamondOre && ironOre && stone);

  const ironPickaxe = ItemRegistry.getByName('iron_pickaxe');
  const stonePickaxe = ItemRegistry.getByName('stone_pickaxe');
  const goldenPickaxe = ItemRegistry.getByName('golden_pickaxe');
  assert.ok(ironPickaxe && stonePickaxe && goldenPickaxe);

  assert.equal(ItemRegistry.canHarvest(ironPickaxe.id, diamondOre.id), true);
  assert.equal(ItemRegistry.canHarvest(stonePickaxe.id, diamondOre.id), false);
  assert.equal(ItemRegistry.canHarvest(goldenPickaxe.id, diamondOre.id), false);
  assert.equal(ItemRegistry.canHarvest(stonePickaxe.id, ironOre.id), true);
  assert.equal(ItemRegistry.canHarvest(ironPickaxe.id, stone.id), true);
});

test('wrong-tier tools mine at hand speed, correct tier uses tool speed', () => {
  const diamondOre = BlockRegistry.getByName('diamond_ore');
  const coalOre = BlockRegistry.getByName('coal_ore');
  assert.ok(diamondOre && coalOre);

  const ironPickaxe = ItemRegistry.getByName('iron_pickaxe');
  const stonePickaxe = ItemRegistry.getByName('stone_pickaxe');
  const ironAxe = ItemRegistry.getByName('iron_axe');
  assert.ok(ironPickaxe && stonePickaxe && ironAxe);

  // Diamond ore (needs iron): iron pickaxe is fast, stone pickaxe is hand-speed.
  assert.equal(ItemRegistry.getToolMiningSpeed(ironPickaxe.id, diamondOre.id), 6);
  assert.equal(ItemRegistry.getToolMiningSpeed(stonePickaxe.id, diamondOre.id), 1);
  // Wrong tool category is never fast.
  assert.equal(ItemRegistry.getToolMiningSpeed(ironAxe.id, diamondOre.id), 1);
  // Coal ore (no harvest requirement): stone pickaxe keeps its speed.
  assert.equal(ItemRegistry.getToolMiningSpeed(stonePickaxe.id, coalOre.id), 4);
  // Break time reflects the tier penalty.
  const breakTimeWrongTier = ItemRegistry.getBreakTime(diamondOre.id, stonePickaxe.id);
  const breakTimeCorrectTier = ItemRegistry.getBreakTime(diamondOre.id, ironPickaxe.id);
  assert.ok(breakTimeWrongTier > breakTimeCorrectTier);
  assert.equal(breakTimeCorrectTier, diamondOre.hardness / 6);
});
