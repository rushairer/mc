import assert from 'node:assert/strict';
import test from 'node:test';
import { findCraftingResult } from '../src/items/CraftingRecipes';
import { ItemRegistry } from '../src/items/ItemRegistry';
import { MapSystem } from '../src/systems/MapSystem';
import { BiomeType, type WorldGen } from '../src/world/WorldGen';
import { registerWildernessBound26_3 } from '../src/world/registerWildernessBound26_3';
import {
  isCloneableMapName26_3,
  isExtendableMapName26_3,
  normalizeMapFacingDegrees26_3,
} from '../src/world/WildernessBoundChanges26_3';

registerWildernessBound26_3();

function fakeWorldGen(): WorldGen {
  return {
    seed: 263,
    getBiome: () => BiomeType.Plains,
    getTerrainHeight: () => 90,
  } as WorldGen;
}

function craftingGrid(...ids: number[]): number[] {
  return [...ids, ...new Array(Math.max(0, 9 - ids.length)).fill(0)].slice(0, 9);
}

function itemId(name: string): number {
  const item = ItemRegistry.getByName(name);
  assert.ok(item, `expected registered item ${name}`);
  return item.id;
}

test('231: Mushroom Stew accepts two of the same new Shelf Mushroom', () => {
  const bowl = itemId('bowl');
  const shelf = itemId('shelf_mushroom');
  const stew = itemId('mushroom_stew');
  assert.deepEqual(findCraftingResult(craftingGrid(bowl, shelf, shelf)), { id: stew, count: 1 });
});

test('232: Suspicious Stew accepts any two mushrooms including Shelf Mushroom', () => {
  const bowl = itemId('bowl');
  const shelf = itemId('shelf_mushroom');
  const brown = itemId('brown_mushroom');
  const flower = itemId('dandelion');
  const suspicious = itemId('suspicious_stew');
  assert.deepEqual(
    findCraftingResult(craftingGrid(bowl, shelf, brown, flower)),
    { id: suspicious, count: 1 },
  );
});

test('233: Suspicious Stew still requires two mushrooms plus its effect flower', () => {
  const bowl = itemId('bowl');
  const shelf = itemId('shelf_mushroom');
  const flower = itemId('dandelion');
  const result = findCraftingResult(craftingGrid(bowl, shelf, flower));
  assert.notEqual(result?.id, itemId('suspicious_stew'));
});

test('234: 26.3 map facing normalizes negative and wrapped yaw', () => {
  assert.equal(normalizeMapFacingDegrees26_3(-90), 270);
  assert.equal(normalizeMapFacingDegrees26_3(450), 90);
  assert.equal(normalizeMapFacingDegrees26_3(Number.NaN), 0);
});

test('235: MapSystem emits and updates player facing on filled maps', () => {
  const maps = new MapSystem();
  const world = fakeWorldGen();
  const map = maps.createFilledMap(world, 0, 0, 0, 0, -90);
  assert.equal(map.playerMarker.rotation, 270);
  const updated = maps.updatePlayerMarker(map, 4, -3, 450);
  assert.equal(updated.playerMarker.rotation, 90);
  assert.notDeepEqual(updated.playerMarker, map.playerMarker);
});

test('236: cartography clones preserve directional player markers by value', () => {
  const maps = new MapSystem();
  const map = maps.createFilledMap(fakeWorldGen(), 0, 0, 0, 0, 135);
  const clone = maps.cloneMap(map);
  assert.equal(clone.playerMarker.rotation, 135);
  assert.notEqual(clone.playerMarker, map.playerMarker);
});

test('237: cloneable map tag semantics cover Filled and dedicated Explorer Maps', () => {
  assert.equal(isCloneableMapName26_3('filled_map'), true);
  assert.equal(isCloneableMapName26_3('abandoned_camp_map'), true);
  assert.equal(isCloneableMapName26_3('buried_treasure_map'), true);
  assert.equal(isCloneableMapName26_3('paper'), false);
});

test('238: extendable map tag semantics exclude Explorer and Buried Treasure maps', () => {
  assert.equal(isExtendableMapName26_3('filled_map'), true);
  assert.equal(isExtendableMapName26_3('abandoned_camp_map'), false);
  assert.equal(isExtendableMapName26_3('buried_treasure_map'), false);
});
