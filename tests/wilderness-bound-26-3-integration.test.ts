import assert from 'node:assert/strict';
import test from 'node:test';
import { Chunk } from '../src/world/Chunk';
import { BlockRegistry } from '../src/world/BlockRegistry';
import { ItemRegistry } from '../src/items/ItemRegistry';
import { BiomeType, WorldGen } from '../src/world/WorldGen';
import { registerWildernessBound26_3 } from '../src/world/registerWildernessBound26_3';
import {
  decorateWildernessBoundChunk,
  isDappledForestOverlay,
  isWildernessBoundWorldGen26_3Installed,
} from '../src/world/WildernessBoundWorldGen26_3';
import { POPLAR_LEAF_BLOCKS, getWildernessBoundIds } from '../src/world/WildernessBound26_3';

registerWildernessBound26_3();

test('26.3 supplement registers poplar shelf and both poplar boat items', () => {
  const shelf = BlockRegistry.getByName('poplar_shelf');
  assert.ok(shelf);
  assert.equal(ItemRegistry.getByName('poplar_shelf')?.placeBlockId, shelf.id);
  assert.equal(ItemRegistry.getByName('poplar_boat')?.behaviorId, 'minecraft:boat');
  assert.equal(ItemRegistry.getByName('poplar_chest_boat')?.behaviorId, 'minecraft:boat');
});

test('26.3 bridge gives legacy wool and concrete all modern color aliases', () => {
  for (const name of ['white_wool', 'black_wool', 'white_concrete', 'black_concrete']) {
    const item = ItemRegistry.getByName(name);
    assert.ok(item, name);
    assert.equal(item.category, 'block');
    assert.equal(item.placeBlockId, item.id);
  }
});

test('Dappled Forest overlay decorates a real chunk with deterministic poplar content', () => {
  assert.equal(isWildernessBoundWorldGen26_3Installed(), true);

  const worldGen = new WorldGen(263);
  worldGen.getBiome = ((wx: number) => wx >= 80 ? BiomeType.Snow : BiomeType.Forest) as WorldGen['getBiome'];
  worldGen.getTerrainHeight = (() => 64) as WorldGen['getTerrainHeight'];

  assert.equal(isDappledForestOverlay(worldGen, 8, 8), true);
  assert.equal(isDappledForestOverlay(worldGen, 96, 8), false);

  const chunk = new Chunk(0, 0);
  for (let x = 0; x < 16; x++) {
    for (let z = 0; z < 16; z++) chunk.setBlock(x, 64, z, 2);
  }

  assert.equal(decorateWildernessBoundChunk(worldGen, chunk), true);
  const ids = getWildernessBoundIds();
  const leafIds = new Set(Object.values(POPLAR_LEAF_BLOCKS).map(block => block.id));
  let logs = 0;
  let leaves = 0;
  let shelfMushrooms = 0;
  for (let y = 65; y < 90; y++) {
    for (let x = 0; x < 16; x++) {
      for (let z = 0; z < 16; z++) {
        const id = chunk.getBlock(x, y, z);
        if (id === ids.poplarLog) logs++;
        if (leafIds.has(id)) leaves++;
        if (id === ids.shelfMushroom) shelfMushrooms++;
      }
    }
  }
  assert.ok(logs >= 7, `expected poplar logs, got ${logs}`);
  assert.ok(leaves > 0, 'expected poplar leaf canopy');
  assert.ok(shelfMushrooms > 0, 'expected shelf mushroom attached to poplar trunk');
});
