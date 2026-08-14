import assert from 'node:assert/strict';
import test from 'node:test';
import { BlockRegistry } from '../src/world/BlockRegistry';
import {
  getBlockTags,
  getMineableCategory,
  getRequiredHarvestTier,
  inferHarvestTags,
  inferMineableTags,
  TAG_MINEABLE_AXE,
  TAG_MINEABLE_HOE,
  TAG_MINEABLE_PICKAXE,
  TAG_MINEABLE_SHOVEL,
  TAG_NEEDS_DIAMOND_TOOL,
  TAG_NEEDS_IRON_TOOL,
  TAG_NEEDS_STONE_TOOL,
} from '../src/world/BlockTags';

test('infers mineable tags from name patterns', () => {
  assert.deepEqual(inferMineableTags('stone', 'rock'), [TAG_MINEABLE_PICKAXE]);
  assert.deepEqual(inferMineableTags('planks', 'wood'), [TAG_MINEABLE_AXE]);
  assert.deepEqual(inferMineableTags('dirt', 'dirt'), [TAG_MINEABLE_SHOVEL]);
  assert.deepEqual(inferMineableTags('hay_block'), [TAG_MINEABLE_HOE]);
  assert.deepEqual(inferMineableTags('oak_leaves'), [TAG_MINEABLE_HOE]);
  assert.deepEqual(inferMineableTags('air'), []);
});

test('iron hardware and stone controls mine with pickaxe, not axe', () => {
  assert.deepEqual(inferMineableTags('iron_door'), [TAG_MINEABLE_PICKAXE]);
  assert.deepEqual(inferMineableTags('iron_trapdoor'), [TAG_MINEABLE_PICKAXE]);
  assert.deepEqual(inferMineableTags('iron_bars'), [TAG_MINEABLE_PICKAXE]);
  assert.deepEqual(inferMineableTags('stone_button'), [TAG_MINEABLE_PICKAXE]);
  assert.deepEqual(inferMineableTags('oak_button'), [TAG_MINEABLE_AXE]);
});

test('infers harvest-level tags for ores and hard blocks', () => {
  assert.deepEqual(inferHarvestTags('obsidian'), [TAG_NEEDS_DIAMOND_TOOL]);
  assert.deepEqual(inferHarvestTags('diamond_ore'), [TAG_NEEDS_IRON_TOOL]);
  assert.deepEqual(inferHarvestTags('deepslate_emerald_ore'), [TAG_NEEDS_IRON_TOOL]);
  assert.deepEqual(inferHarvestTags('nether_gold_ore'), [TAG_NEEDS_IRON_TOOL]);
  assert.deepEqual(inferHarvestTags('iron_ore'), [TAG_NEEDS_STONE_TOOL]);
  assert.deepEqual(inferHarvestTags('deepslate_lapis_ore'), [TAG_NEEDS_STONE_TOOL]);
  assert.deepEqual(inferHarvestTags('coal_ore'), []);
});

test('registry blocks resolve to expected tags', () => {
  assert.ok(getBlockTags(BlockRegistry.getByName('stone'))?.includes(TAG_MINEABLE_PICKAXE));
  assert.ok(getBlockTags(BlockRegistry.getByName('diamond_ore'))?.includes(TAG_NEEDS_IRON_TOOL));
  assert.ok(getBlockTags(BlockRegistry.getByName('iron_ore'))?.includes(TAG_NEEDS_STONE_TOOL));
  assert.ok(getBlockTags(BlockRegistry.getByName('obsidian'))?.includes(TAG_NEEDS_DIAMOND_TOOL));
  assert.ok(getBlockTags(BlockRegistry.getByName('planks'))?.includes(TAG_MINEABLE_AXE));
  assert.ok(getBlockTags(BlockRegistry.getByName('sand'))?.includes(TAG_MINEABLE_SHOVEL));
  assert.ok(getBlockTags(BlockRegistry.getByName('hay_block'))?.includes(TAG_MINEABLE_HOE));
});

test('explicit tag overrides win over inference', () => {
  const enderChest = BlockRegistry.getByName('ender_chest');
  const tags = getBlockTags(enderChest);
  assert.ok(tags.includes(TAG_MINEABLE_PICKAXE));
  assert.ok(!tags.includes(TAG_MINEABLE_AXE));
});

test('maps tags to mineable category and harvest tier', () => {
  assert.equal(getMineableCategory([TAG_MINEABLE_PICKAXE]), 'pickaxe');
  assert.equal(getMineableCategory([TAG_MINEABLE_HOE]), 'hoe');
  assert.equal(getMineableCategory([]), undefined);
  assert.equal(getRequiredHarvestTier([TAG_NEEDS_STONE_TOOL]), 1);
  assert.equal(getRequiredHarvestTier([TAG_NEEDS_IRON_TOOL]), 2);
  assert.equal(getRequiredHarvestTier([TAG_NEEDS_DIAMOND_TOOL]), 3);
  assert.equal(getRequiredHarvestTier([]), 0);
});
