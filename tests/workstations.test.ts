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

test('cartography action resolution follows 1.20.1 rules', () => {
  const map = { id: 358, count: 1, map: { id: 1, centerX: 0, centerZ: 0, scale: 1, dimension: 0, pixels: ['#000000'], playerMarker: { x: 16, z: 16 } } };
  const lockedMap = { ...map, map: { ...map.map, locked: true } };
  const emptyMap = { id: 395, count: 1 };
  const paper = { id: 339, count: 1 };
  const glassPane = { id: 102, count: 1 };

  assert.equal(getCartographyAction(map as any, emptyMap as any), 'clone');
  assert.equal(getCartographyAction(map as any, paper as any), 'zoom');
  assert.equal(getCartographyAction(map as any, glassPane as any), 'lock');
  assert.equal(getCartographyAction(lockedMap as any, emptyMap as any), null, 'locked maps cannot be modified');
  assert.equal(getCartographyAction(map as any, { id: 1, count: 1 } as any), null, 'unrelated ingredient');
  assert.equal(getCartographyAction(null, emptyMap as any), null);
});

test('MapSystem clones, zooms out and locks maps', () => {
  const maps = new MapSystem();
  const worldGen = new WorldGen(12345);
  const original = maps.createFilledMap(worldGen, 0, 0, 0, 1);

  const clone = maps.cloneMap(original);
  assert.notEqual(clone.id, original.id);
  assert.deepEqual(clone.pixels, original.pixels);
  assert.equal(clone.scale, original.scale);

  const zoomed = maps.zoomOutMap(original, worldGen);
  assert.equal(zoomed.scale, 2);
  assert.notEqual(zoomed.pixels.length, 0);

  const maxed = maps.zoomOutMap(zoomed, worldGen);
  assert.equal(maxed.scale, 4);
  const capped = maps.zoomOutMap(maxed, worldGen);
  assert.equal(capped.scale, 4, 'scale caps at 4');

  const locked = maps.lockMap(original);
  assert.equal(locked.locked, true);
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
