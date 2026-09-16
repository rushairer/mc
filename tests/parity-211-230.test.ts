import assert from 'node:assert/strict';
import test from 'node:test';
import { ItemRegistry } from '../src/items/ItemRegistry';
import { Chunk } from '../src/world/Chunk';
import { BiomeType, type WorldGen } from '../src/world/WorldGen';
import { MapSystem } from '../src/systems/MapSystem';
import { getCartographyAction, isCartographyMapItem26_3 } from '../src/ui/CartographyUI';
import { registerWildernessBound26_3 } from '../src/world/registerWildernessBound26_3';
import {
  CUSHION_DAMPENS_VIBRATIONS_26_3,
  CUSHION_HAS_COLLISION_26_3,
  CUSHION_PISTON_REACTION_26_3,
  CushionSeatSystem26_3,
  StrawBedSession26_3,
  applyShelfMushroomBounce26_3,
  canZoomMapStack26_3,
  cloneExplorerMapStack26_3,
  isExplorerMapCreativeVisible26_3,
  isWoolShapeVibrationDampener26_3,
  migrateLegacyExplorerMapName26_3,
  resolveWildernessBoundTraderTrades26_3,
  snapCushionPlacement,
} from '../src/world/WildernessBoundGameplay26_3';
import {
  abandonedCampVariantForLegacyBiome26_3,
  buildAbandonedCampLoot26_3,
  decorateAbandonedCampChunk26_3,
  findExplorerCampTarget26_3,
  getAbandonedCampPlanForCell26_3,
  type AbandonedCampPlan26_3,
} from '../src/world/AbandonedCamp26_3';

registerWildernessBound26_3();

function fakeWorldGen(
  biome: (x: number, z: number) => BiomeType = () => BiomeType.Plains,
): WorldGen {
  return {
    seed: 263,
    getBiome: biome,
    getTerrainHeight: () => 70,
  } as WorldGen;
}

function findCamp(worldGen: WorldGen): AbandonedCampPlan26_3 {
  for (let x = -20; x <= 20; x++) {
    for (let z = -20; z <= 20; z++) {
      const plan = getAbandonedCampPlanForCell26_3(worldGen, x, z);
      if (plan) return plan;
    }
  }
  throw new Error('expected deterministic abandoned camp candidate');
}

test('211: cushion placement snaps horizontally while preserving support top height', () => {
  const point = snapCushionPlacement({
    hitX: 12.91,
    hitZ: -3.12,
    supportTopY: 64.5,
    flatSurface: true,
    supportingBlock: true,
    color: 'red',
  });
  assert.deepEqual(point, { x: 12.5, y: 64.5, z: -3.5 });
  assert.equal(snapCushionPlacement({ hitX: 0, hitZ: 0, supportTopY: 1, flatSurface: false, supportingBlock: true, color: 'white' }), null);
});

test('212: only one cushion may occupy the same snapped cushion position', () => {
  const seats = new CushionSeatSystem26_3();
  const request = { hitX: 1.2, hitZ: 2.8, supportTopY: 65, flatSurface: true, supportingBlock: true, color: 'blue' as const };
  assert.ok(seats.place(request, '1,64,2'));
  assert.equal(seats.place(request, '1,64,2'), null);
});

test('213: cushion interaction seats one player and rejects a second occupant', () => {
  const seats = new CushionSeatSystem26_3();
  const seat = seats.place({ hitX: 1.2, hitZ: 2.8, supportTopY: 65, flatSurface: true, supportingBlock: true, color: 'blue' }, 'support')!;
  assert.equal(seats.sit('alex', seat).seated, true);
  assert.equal(seats.sit('steve', seat).reason, 'occupied');
  assert.equal(seats.isPlayerSitting('alex'), true);
});

test('214: standing releases cushion occupancy for the next player', () => {
  const seats = new CushionSeatSystem26_3();
  const seat = seats.place({ hitX: 1, hitZ: 2, supportTopY: 65, flatSurface: true, supportingBlock: true, color: 'orange' }, 'support')!;
  seats.sit('alex', seat);
  assert.equal(seats.stand('alex'), true);
  assert.equal(seats.sit('steve', seat).seated, true);
});

test('215: unsupported cushions break and retain Java 26.3 physical policy', () => {
  const seats = new CushionSeatSystem26_3();
  seats.place({ hitX: 1, hitZ: 2, supportTopY: 65, flatSurface: true, supportingBlock: true, color: 'white' }, 'support-a');
  seats.place({ hitX: 3, hitZ: 4, supportTopY: 65, flatSurface: true, supportingBlock: true, color: 'black' }, 'support-b');
  assert.equal(seats.breakUnsupported('support-a').length, 1);
  assert.equal(CUSHION_HAS_COLLISION_26_3, false);
  assert.equal(CUSHION_PISTON_REACTION_26_3, 'block');
  assert.equal(CUSHION_DAMPENS_VIBRATIONS_26_3, false);
});

test('216: successful straw-bed sleep never sets spawn and consumes the bed once', () => {
  const session = new StrawBedSession26_3();
  assert.deepEqual(session.use('overworld'), {
    canSleep: true,
    destroyed: true,
    setsSpawn: false,
    sleptStatIncrement: 1,
  });
  assert.equal(session.getSleptCount(), 1);
});

test('217: Nether/End straw-bed attempts destroy the bed without counting a sleep', () => {
  const session = new StrawBedSession26_3();
  assert.equal(session.use('nether').canSleep, false);
  assert.equal(session.use('end').canSleep, false);
  assert.equal(session.getSleptCount(), 0);
});

test('218: wool stairs and slabs dampen vibrations like their full wool block', () => {
  assert.equal(isWoolShapeVibrationDampener26_3('red_wool'), true);
  assert.equal(isWoolShapeVibrationDampener26_3('red_wool_stairs'), true);
  assert.equal(isWoolShapeVibrationDampener26_3('red_wool_slab'), true);
  assert.equal(isWoolShapeVibrationDampener26_3('red_concrete_slab'), false);
});

test('219: shelf mushrooms bounce falling entities unless they are sneaking', () => {
  const bounce = applyShelfMushroomBounce26_3(-0.8, false);
  assert.equal(bounce.bounced, true);
  assert.equal(bounce.verticalVelocity, 0.4);
  assert.equal(bounce.soundEvent, 'block.shelf_mushroom.fall');
  assert.equal(applyShelfMushroomBounce26_3(-0.8, true).bounced, false);
});

test('220: explorer map items are excluded from creative visibility policy', () => {
  const id = ItemRegistry.getByName('abandoned_camp_map')!.id;
  assert.equal(isExplorerMapCreativeVisible26_3(id), false);
  assert.equal(isExplorerMapCreativeVisible26_3(ItemRegistry.getByName('bread')!.id), true);
});

test('221: explorer map clone keeps dedicated item type and deep-clones map arrays', () => {
  const id = ItemRegistry.getByName('abandoned_camp_map')!.id;
  const stack = {
    id,
    count: 1,
    map: { id: 8, centerX: 0, centerZ: 0, scale: 2, dimension: 0, pixels: ['#000'], playerMarker: { x: 2, z: 3 } },
  };
  const clone = cloneExplorerMapStack26_3(stack)!;
  assert.equal(clone.id, id);
  assert.notEqual(clone.map!.pixels, stack.map.pixels);
  assert.equal(canZoomMapStack26_3(stack), false);
});

test('222: legacy renamed explorer maps migrate to their 26.3 dedicated names', () => {
  assert.equal(migrateLegacyExplorerMapName26_3('ocean_monument_explorer_map'), 'ocean_monument_map');
  assert.equal(migrateLegacyExplorerMapName26_3('trial_chambers_explorer_map'), 'buried_trial_chambers_map');
  assert.equal(migrateLegacyExplorerMapName26_3('filled_map'), 'filled_map');
});

test('223: MapSystem creates explorer maps centered on located structures', () => {
  const maps = new MapSystem();
  const world = fakeWorldGen();
  const explorer = maps.createExplorerMap(world, 0, 0, 0, 'abandoned_camp_map', 512, -256, 2);
  assert.equal(explorer.explorerItemName, 'abandoned_camp_map');
  assert.equal(explorer.targetMarker?.structure, 'abandoned_camp_map');
  assert.ok(explorer.targetMarker!.x >= 0 && explorer.targetMarker!.x < 128);
  assert.ok(explorer.targetMarker!.z >= 0 && explorer.targetMarker!.z < 128);
});

test('224: MapSystem refuses to zoom dedicated explorer map data', () => {
  const maps = new MapSystem();
  const world = fakeWorldGen();
  const explorer = maps.createExplorerMap(world, 0, 0, 0, 'abandoned_camp_map', 256, 256, 2);
  assert.equal(maps.canZoomOutMap(explorer), false);
  assert.equal(maps.zoomOutMap(explorer, world).scale, 2);
});

test('225: cartography accepts explorer maps for cloning but rejects paper zooming', () => {
  const id = ItemRegistry.getByName('abandoned_camp_map')!.id;
  const explorer = {
    id,
    count: 1,
    map: { id: 2, centerX: 0, centerZ: 0, scale: 2, dimension: 0, pixels: [], playerMarker: { x: 0, z: 0 } },
  };
  assert.equal(isCartographyMapItem26_3(explorer), true);
  assert.equal(getCartographyAction(explorer, { id: 395, count: 1 }), 'clone');
  assert.equal(getCartographyAction(explorer, { id: 339, count: 1 }), null);
});

test('226: legacy biome adapter selects official abandoned-camp variants only', () => {
  assert.equal(abandonedCampVariantForLegacyBiome26_3(fakeWorldGen(() => BiomeType.Plains), 0, 0), 'meadow');
  assert.equal(abandonedCampVariantForLegacyBiome26_3(fakeWorldGen(() => BiomeType.Swamp), 0, 0), 'swamp');
  assert.equal(abandonedCampVariantForLegacyBiome26_3(fakeWorldGen(() => BiomeType.Ocean), 0, 0), null);
});

test('227: abandoned-camp cell planning is deterministic and slope-gated', () => {
  const world = fakeWorldGen();
  const plan = findCamp(world);
  assert.deepEqual(getAbandonedCampPlanForCell26_3(world, plan.cellX, plan.cellZ), plan);
  const steep = { ...world, getTerrainHeight: (x: number) => x % 10 === 0 ? 90 : 70 } as WorldGen;
  const sameCell = getAbandonedCampPlanForCell26_3(steep, plan.cellX, plan.cellZ);
  assert.ok(sameCell === null || sameCell.centerY >= 70);
});

test('228: explorer camp targeting never points to the same camp biome variant', () => {
  const mixed = fakeWorldGen((x) => x < 0 ? BiomeType.Forest : BiomeType.Plains);
  let checked = false;
  for (let x = -12; x <= 12 && !checked; x++) {
    for (let z = -12; z <= 12 && !checked; z++) {
      const source = getAbandonedCampPlanForCell26_3(mixed, x, z);
      if (!source) continue;
      const target = findExplorerCampTarget26_3(mixed, source, 8);
      if (!target) continue;
      assert.notEqual(target.variant, source.variant);
      checked = true;
    }
  }
  assert.equal(checked, true);
});

test('229: abandoned-camp loot includes 26.3 camping gear and an explorer map', () => {
  const world = fakeWorldGen();
  const plan = findCamp(world);
  const loot = buildAbandonedCampLoot26_3(world, plan, 'chest').filter(Boolean);
  const names = loot.map(entry => ItemRegistry.get(entry!.id)?.name);
  assert.ok(names.includes('white_cushion'));
  assert.ok(names.includes('straw_bed'));
  assert.ok(names.some(name => !!name && name.endsWith('_map')));
  assert.equal(resolveWildernessBoundTraderTrades26_3().length, 2);
});

test('230: abandoned-camp decorator writes real container metadata into generated chunks', () => {
  const world = fakeWorldGen();
  const plan = findCamp(world);
  const chestX = plan.centerX + 4;
  const chestZ = plan.centerZ + 2;
  const chunk = new Chunk(Math.floor(chestX / 16), Math.floor(chestZ / 16));
  for (let x = 0; x < 16; x++) {
    for (let z = 0; z < 16; z++) chunk.setBlock(x, 70, z, 2);
  }
  const placed = decorateAbandonedCampChunk26_3(world, chunk);
  assert.ok(placed.some(candidate => candidate.id === plan.id));
  const localX = chestX - chunk.cx * 16;
  const localZ = chestZ - chunk.cz * 16;
  const meta = chunk.getBlockMeta(localX, plan.centerY + 1, localZ);
  assert.equal(meta?.containerType, 'chest');
  assert.ok(meta?.inventory?.some(Boolean));
});
