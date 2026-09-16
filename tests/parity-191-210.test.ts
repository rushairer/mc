import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { BlockRegistry } from '../src/world/BlockRegistry';
import { ItemRegistry } from '../src/items/ItemRegistry';
import { findCraftingResult } from '../src/items/CraftingRecipes';
import { getStonecuttingResults } from '../src/items/StonecuttingRecipes';
import { registerWildernessBound26_3, isWildernessBound26_3Registered } from '../src/world/registerWildernessBound26_3';
import {
  ABANDONED_CAMP_BIOMES,
  CONCRETE_SHAPE_BLOCKS,
  CUSHION_HAS_COLLISION,
  CUSHION_ITEMS,
  CUSHION_PISTON_MOVABLE,
  DAPPLED_FOREST_PASSIVE_MOBS,
  DYE_COLORS,
  EXPLORER_MAP_ITEMS,
  POPLAR_LEAF_BLOCKS,
  RED_SHRUB_COMPOSTABLE,
  SHELF_MUSHROOM_IS_BOUNCY,
  WILDERNESS_BOUND_BLOCKS,
  WILDERNESS_BOUND_VERSION,
  WOOL_SHAPE_BLOCKS,
  canPlaceCushion,
  canRedShrubSpreadWithBoneMeal,
  canSpectatorUsePortal,
  getWildernessBoundIds,
  isAbandonedCampBiome,
  isDappledForestNearColdBiome,
  isExplorerMapExtendable,
  isMushroomFor26_3Recipe,
  poplarLeafVariantForGrowth,
  shelfMushroomAfterBoneMeal,
  shelfMushroomDropCount,
  shouldBreakCushion,
  useStrawBed,
} from '../src/world/WildernessBound26_3';

registerWildernessBound26_3();

const grid = (...ids: number[]) => [...ids, ...new Array(Math.max(0, 9 - ids.length)).fill(0)].slice(0, 9);

test('191: latest content bridge targets Java 26.3 and allocates unique runtime block ids', () => {
  assert.equal(WILDERNESS_BOUND_VERSION, '26.3');
  const ids = WILDERNESS_BOUND_BLOCKS.map(block => block.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every(id => id >= 52000));
});

test('192: poplar core blocks are registered as real block and item definitions', () => {
  for (const name of ['poplar_log', 'poplar_planks', 'poplar_sapling']) {
    const block = BlockRegistry.getByName(name);
    const item = ItemRegistry.getByName(name);
    assert.ok(block, name);
    assert.ok(item, name);
    assert.equal(item!.placeBlockId, block!.id);
  }
});

test('193: poplar leaves expose all three official colors and sapling growth can select each', () => {
  assert.deepEqual(Object.keys(POPLAR_LEAF_BLOCKS), ['red', 'orange', 'yellow']);
  assert.equal(poplarLeafVariantForGrowth(0), 'red');
  assert.equal(poplarLeafVariantForGrowth(0.5), 'orange');
  assert.equal(poplarLeafVariantForGrowth(0.99), 'yellow');
});

test('194: poplar wood set includes stripped wood, stairs, slabs, signs, doors and redstone-adjacent shapes', () => {
  const required = [
    'stripped_poplar_log', 'poplar_wood', 'stripped_poplar_wood', 'poplar_stairs', 'poplar_slab',
    'poplar_fence', 'poplar_fence_gate', 'poplar_door', 'poplar_trapdoor', 'poplar_pressure_plate',
    'poplar_button', 'poplar_sign', 'poplar_hanging_sign',
  ];
  for (const name of required) assert.ok(BlockRegistry.getByName(name), name);
});

test('195: Wilderness Bound registration is idempotent and wired into browser/server entry points', () => {
  registerWildernessBound26_3();
  assert.equal(isWildernessBound26_3Registered(), true);
  const client = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
  const server = readFileSync(new URL('../src/server/standalone.ts', import.meta.url), 'utf8');
  assert.ok(client.includes('registerWildernessBound26_3'));
  assert.ok(server.includes('registerWildernessBound26_3'));
});

test('196: shelf mushroom implements official growth, drops and bounce semantics', () => {
  assert.equal(shelfMushroomAfterBoneMeal('small'), 'large');
  assert.equal(shelfMushroomAfterBoneMeal('large'), 'large');
  assert.equal(shelfMushroomDropCount('small'), 1);
  assert.equal(shelfMushroomDropCount('large'), 2);
  assert.equal(SHELF_MUSHROOM_IS_BOUNCY, true);
  assert.ok(BlockRegistry.getByName('shelf_mushroom'));
});

test('197: red shrub is compostable and bone meal only spreads into a valid adjacent space', () => {
  assert.equal(RED_SHRUB_COMPOSTABLE, true);
  assert.equal(canRedShrubSpreadWithBoneMeal(true), true);
  assert.equal(canRedShrubSpreadWithBoneMeal(false), false);
  assert.ok(BlockRegistry.getByName('red_shrub'));
});

test('198: all sixteen wool colors get stair and slab variants', () => {
  assert.equal(WOOL_SHAPE_BLOCKS.size, 16);
  for (const color of DYE_COLORS) {
    assert.ok(BlockRegistry.getByName(`${color}_wool_stairs`));
    assert.ok(BlockRegistry.getByName(`${color}_wool_slab`));
  }
});

test('199: all sixteen concrete colors get stairs/slabs and stonecutter outputs', () => {
  assert.equal(CONCRETE_SHAPE_BLOCKS.size, 16);
  for (const color of DYE_COLORS) {
    const concrete = ItemRegistry.getByName('concrete');
    const metadata = DYE_COLORS.indexOf(color);
    const concreteId = concrete ? (metadata << 10) | concrete.baseId : undefined;
    if (concreteId === undefined) continue;
    const outputs = getStonecuttingResults(concreteId);
    const names = outputs.map(output => BlockRegistry.get(output.outputBlockId)?.name);
    assert.ok(names.includes(`${color}_concrete_slab`));
    assert.ok(names.includes(`${color}_concrete_stairs`));
  }
});

test('200: generated 26.3 block items preserve official ids and placement targets', () => {
  const sample = ['red_poplar_leaves', 'white_wool_slab', 'black_concrete_stairs', 'straw_bed'];
  for (const name of sample) {
    const block = BlockRegistry.getByName(name)!;
    const item = ItemRegistry.getByName(name)!;
    assert.equal(item.officialId, `minecraft:${name}`);
    assert.equal(item.placeBlockId, block.id);
  }
});

test('201: cushion content exposes exactly sixteen colored item variants', () => {
  assert.equal(CUSHION_ITEMS.length, 16);
  assert.equal(new Set(CUSHION_ITEMS.map(item => item.officialId)).size, 16);
  for (const color of DYE_COLORS) assert.ok(ItemRegistry.getByName(`${color}_cushion`));
});

test('202: cushion placement enforces flat support, cushion exclusivity, no collision and no piston movement', () => {
  assert.equal(canPlaceCushion({ flatSurface: true, supportingBlock: true, occupiedByCushion: false }), true);
  assert.equal(canPlaceCushion({ flatSurface: false, supportingBlock: true, occupiedByCushion: false }), false);
  assert.equal(canPlaceCushion({ flatSurface: true, supportingBlock: false, occupiedByCushion: false }), false);
  assert.equal(canPlaceCushion({ flatSurface: true, supportingBlock: true, occupiedByCushion: true }), false);
  assert.equal(CUSHION_HAS_COLLISION, false);
  assert.equal(CUSHION_PISTON_MOVABLE, false);
  assert.equal(shouldBreakCushion(false), true);
});

test('203: three hay bales craft four straw beds', () => {
  const hay = ItemRegistry.getByName('hay_block')!.id;
  const strawBed = getWildernessBoundIds().strawBed;
  assert.deepEqual(findCraftingResult(grid(hay, hay, hay)), { id: strawBed, count: 4 });
});

test('204: straw beds sleep only in overworld, never set spawn, and are destroyed on use', () => {
  assert.deepEqual(useStrawBed('overworld'), { canSleep: true, setsSpawn: false, destroyAfterUse: true });
  assert.deepEqual(useStrawBed('nether'), { canSleep: false, setsSpawn: false, destroyAfterUse: true });
  assert.deepEqual(useStrawBed('end'), { canSleep: false, setsSpawn: false, destroyAfterUse: true });
});

test('205: 26.3 mushroom recipe classification includes shelf mushrooms alongside both classic mushrooms', () => {
  assert.equal(isMushroomFor26_3Recipe('brown_mushroom'), true);
  assert.equal(isMushroomFor26_3Recipe('red_mushroom'), true);
  assert.equal(isMushroomFor26_3Recipe('shelf_mushroom'), true);
  assert.equal(isMushroomFor26_3Recipe('crimson_fungus'), false);
});

test('206: dappled forest profile is cold-adjacent and uses the official passive/neutral mob set', () => {
  assert.equal(isDappledForestNearColdBiome([0.8, 0.7, 0.4]), true);
  assert.equal(isDappledForestNearColdBiome([0.8, 0.7, 0.6]), false);
  assert.deepEqual([...DAPPLED_FOREST_PASSIVE_MOBS], ['sheep', 'chicken', 'cow', 'pig', 'rabbit', 'fox']);
});

test('207: abandoned camp structure policy covers all eighteen official biome variants', () => {
  assert.equal(ABANDONED_CAMP_BIOMES.length, 18);
  assert.equal(isAbandonedCampBiome('dappled_forest'), true);
  assert.equal(isAbandonedCampBiome('bamboo_jungle'), true);
  assert.equal(isAbandonedCampBiome('desert'), false);
});

test('208: explorer maps are dedicated items and are not extendable', () => {
  assert.equal(EXPLORER_MAP_ITEMS.length, 16);
  assert.ok(ItemRegistry.getByName('abandoned_camp_map'));
  assert.equal(isExplorerMapExtendable('abandoned_camp_map'), false);
  assert.equal(isExplorerMapExtendable('filled_map'), true);
});

test('209: spectator portal policy allows portal interaction specifically for spectator mode', () => {
  assert.equal(canSpectatorUsePortal('spectator'), true);
  assert.equal(canSpectatorUsePortal('survival'), false);
  assert.equal(canSpectatorUsePortal('creative'), false);
});

test('210: 26.3 crafting bridge produces wool/concrete shapes and colored cushions with modern runtime ids', () => {
  const whiteWool = ItemRegistry.getByName('white_wool')!.id;
  const woolSlab = ItemRegistry.getByName('white_wool_slab')!.id;
  assert.deepEqual(findCraftingResult(grid(whiteWool, whiteWool, whiteWool)), { id: woolSlab, count: 6 });

  const concrete = ItemRegistry.getByName('concrete')!;
  const whiteConcrete = concrete.baseId; // metadata 0 is white concrete
  const concreteSlab = ItemRegistry.getByName('white_concrete_slab')!.id;
  assert.deepEqual(findCraftingResult(grid(whiteConcrete, whiteConcrete, whiteConcrete)), { id: concreteSlab, count: 6 });

  const whiteCushion = ItemRegistry.getByName('white_cushion')!.id;
  assert.deepEqual(findCraftingResult(grid(woolSlab, woolSlab, woolSlab)), { id: whiteCushion, count: 1 });
});
