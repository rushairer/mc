import assert from 'node:assert/strict';
import test from 'node:test';
import { BlockRegistry } from '../src/world/BlockRegistry';
import { WorldGen } from '../src/world/WorldGen';
import { getStonecuttingResults, isStonecuttingInput, STONECUTTING_RECIPES } from '../src/items/StonecuttingRecipes';
import { MapSystem, type MapData } from '../src/systems/MapSystem';
import { BANNER_PATTERNS, getBannerPatternById } from '../src/items/BannerPatterns';
import { getCartographyAction } from '../src/ui/CartographyUI';

// ─── Stonecutter recipes (P3.5) ───

test('stonecutter resolves products for stone families', () => {
  const stone = BlockRegistry.getByName('stone');
  const cobblestone = BlockRegistry.getByName('cobblestone');
  assert.ok(stone && cobblestone);

  const stoneResults = getStonecuttingResults(stone.id);
  assert.ok(stoneResults.length >= 3, `stone products: ${stoneResults.length}`);
  assert.ok(stoneResults.some((r) => r.count === 2), 'slabs yield 2 per input');

  const cobbleResults = getStonecuttingResults(cobblestone.id);
  assert.ok(cobbleResults.some((r) => BlockRegistry.get(r.outputBlockId)?.name === 'cobblestone_stairs'));

  assert.equal(isStonecuttingInput(stone.id), true);
  assert.equal(isStonecuttingInput(cobblestone.id), true);
  const dirt = BlockRegistry.getByName('dirt');
  assert.ok(dirt);
  assert.equal(isStonecuttingInput(dirt.id), false);
});

test('every stonecutting recipe input and output resolves to a registered block', () => {
  for (const recipe of STONECUTTING_RECIPES) {
    assert.ok(BlockRegistry.getByName(recipe.input), `input ${recipe.input}`);
    assert.ok(BlockRegistry.getByName(recipe.output), `output ${recipe.output}`);
  }
});

// ─── Cartography table (P3.5) ───

test('cartography action resolution follows Java 1.20.1 lock and scale rules', () => {
  const map = { id: 358, count: 1, map: { id: 1, centerX: 0, centerZ: 0, scale: 1, dimension: 0, pixels: ['#000000'], playerMarker: { x: 64, z: 64 } } };
  const lockedMap = { ...map, map: { ...map.map, locked: true } };
  const maxScaleMap = { ...map, map: { ...map.map, scale: 4 } };
  const emptyMap = { id: 395, count: 1 };
  const paper = { id: 339, count: 1 };
  const glassPane = { id: 102, count: 1 };

  assert.equal(getCartographyAction(map as any, emptyMap as any), 'clone');
  assert.equal(getCartographyAction(map as any, paper as any), 'zoom');
  assert.equal(getCartographyAction(map as any, glassPane as any), 'lock');
  assert.equal(getCartographyAction(lockedMap as any, emptyMap as any), 'clone', 'locked maps remain copyable');
  assert.equal(getCartographyAction(lockedMap as any, paper as any), null, 'locked maps cannot be zoomed');
  assert.equal(getCartographyAction(lockedMap as any, glassPane as any), null, 'already-locked maps cannot be relocked');
  assert.equal(getCartographyAction(maxScaleMap as any, paper as any), null, 'scale 4 maps cannot zoom farther');
  assert.equal(getCartographyAction(map as any, { id: 1, count: 1 } as any), null, 'unrelated ingredient');
  assert.equal(getCartographyAction(null, emptyMap as any), null);
});

test('new maps use Java 128x128 pixels and default scale level zero', () => {
  const maps = new MapSystem();
  const worldGen = new WorldGen(12345);
  const map = maps.createFilledMap(worldGen, 0, 0, 0);
  assert.equal(map.scale, 0);
  assert.equal(map.pixels.length, 128 * 128);
  assert.deepEqual(map.playerMarker, { x: 64, z: 64, rotation: 0 });
});

test('map scale is a level whose sample stride doubles as 2^scale', () => {
  const maps = new MapSystem();
  const samples: Array<[number, number]> = [];
  const fakeWorldGen: any = {
    getBiome: (x: number, z: number) => {
      samples.push([x, z]);
      return 0;
    },
    getTerrainHeight: () => 64,
  };
  const map = maps.createFilledMap(fakeWorldGen, 0, 0, 0, 2);
  assert.equal(map.scale, 2);
  assert.equal(samples.length, 128 * 128);
  assert.deepEqual(samples[1], [map.centerX - 63 * 4, map.centerZ - 64 * 4]);
});

test('maps snap their centers to the Java global map grid', () => {
  const maps = new MapSystem();
  const fakeWorldGen: any = { getBiome: () => 0, getTerrainHeight: () => 64 };

  const origin = maps.createFilledMap(fakeWorldGen, 0, 0, 0, 0);
  assert.deepEqual([origin.centerX, origin.centerZ], [0, 0]);

  const eastSouth = maps.createFilledMap(fakeWorldGen, 70, -70, 0, 0);
  assert.deepEqual([eastSouth.centerX, eastSouth.centerZ], [128, -128]);
  assert.deepEqual(eastSouth.playerMarker, { x: 6, z: 122, rotation: 0 });

  const scaleTwo = maps.createFilledMap(fakeWorldGen, 0, 0, 0, 2);
  assert.deepEqual([scaleTwo.centerX, scaleTwo.centerZ], [192, 192]);
});

test('MapSystem zooms one scale level at a time and caps at four', () => {
  const maps = new MapSystem();
  const fakeWorldGen: any = { getBiome: () => 0, getTerrainHeight: () => 64 };
  const original = maps.createFilledMap(fakeWorldGen, 0, 0, 0, 0);

  const levelOne = maps.zoomOutMap(original, fakeWorldGen);
  assert.equal(levelOne.scale, 1);
  const levelTwo = maps.zoomOutMap(levelOne, fakeWorldGen);
  assert.equal(levelTwo.scale, 2);
  const levelThree = maps.zoomOutMap(levelTwo, fakeWorldGen);
  assert.equal(levelThree.scale, 3);
  const levelFour = maps.zoomOutMap(levelThree, fakeWorldGen);
  assert.equal(levelFour.scale, 4);
  const capped = maps.zoomOutMap(levelFour, fakeWorldGen);
  assert.equal(capped.scale, 4, 'scale caps at 4');
});

test('locked map clones preserve frozen state while receiving a fresh map id', () => {
  const maps = new MapSystem();
  const original: MapData = {
    id: 40,
    centerX: 0,
    centerZ: 0,
    scale: 1,
    dimension: 0,
    pixels: ['#000000'],
    playerMarker: { x: 64, z: 64 },
    locked: true,
  };
  maps.restoreFromMaps([original]);
  const clone = maps.cloneMap(original);
  assert.notEqual(clone.id, original.id);
  assert.equal(clone.locked, true);
  assert.deepEqual(clone.pixels, original.pixels);
  assert.notEqual(clone.pixels, original.pixels, 'clone owns an independent pixel array');
});

// ─── Loom patterns (P3.5) ───

test('banner pattern data resolves by id', () => {
  assert.ok(BANNER_PATTERNS.length >= 8);
  assert.equal(getBannerPatternById('cross')?.name, 'Cross');
  assert.equal(getBannerPatternById('nope'), undefined);
});

test('MapData lock flag round-trips through the item map type', () => {
  const data: MapData = { id: 1, centerX: 0, centerZ: 0, scale: 1, dimension: 0, pixels: [], playerMarker: { x: 0, z: 0 }, locked: true };
  assert.equal(data.locked, true);
});
