import assert from 'node:assert/strict';
import test from 'node:test';
import type { BlockDef } from '../src/types';
import {
  blockStateKey,
  createBlockStateSchema,
  mergeBlockStateMetadata,
  normalizeBlockStateProperties,
  resolveBlockState,
  synchronizeBlockMetadata,
} from '../src/world/BlockState';

function block(name: string, id = 53): BlockDef {
  return {
    id,
    officialId: `minecraft:${name}`,
    name,
    textureKey: name,
    transparent: false,
    solid: true,
    hardness: 1,
    luminance: 0,
    stateSchema: createBlockStateSchema(name),
  };
}

test('derives canonical properties for stateful block families', () => {
  const stairs = createBlockStateSchema('oak_stairs');
  assert.ok(stairs);
  assert.deepEqual(Object.keys(stairs.properties).sort(), ['facing', 'half', 'shape', 'waterlogged']);

  const normalized = normalizeBlockStateProperties(stairs, {
    facing: 'east',
    half: 'top',
    shape: 'invalid',
    unknown: true,
  });
  assert.deepEqual(normalized, {
    facing: 'east',
    half: 'top',
    shape: 'straight',
    waterlogged: false,
  });
});

test('does not confuse wall signs or wooden buttons with wall and log families', () => {
  const wallSign = createBlockStateSchema('oak_wall_sign');
  assert.ok(wallSign);
  assert.deepEqual(Object.keys(wallSign.properties).sort(), ['facing', 'waterlogged']);

  const woodenButton = createBlockStateSchema('oak_button');
  assert.ok(woodenButton);
  assert.deepEqual(Object.keys(woodenButton.properties).sort(), ['face', 'facing', 'powered']);
});

test('resolves legacy metadata into a canonical block state', () => {
  const definition = block('oak_stairs');
  const state = resolveBlockState(definition, (3 << 10) | definition.id, {
    stairFacing: 'west',
    blockState: { shape: 'inner_left', waterlogged: true },
  });

  assert.equal(state.baseId, definition.id);
  assert.equal(state.legacyMetadata, 3);
  assert.deepEqual(state.properties, {
    facing: 'west',
    half: 'bottom',
    shape: 'inner_left',
    waterlogged: true,
  });
  assert.equal(
    blockStateKey(state),
    'minecraft:oak_stairs[facing=west,half=bottom,shape=inner_left,waterlogged=true]',
  );
});

test('merges canonical properties without discarding legacy block metadata', () => {
  const metadata = mergeBlockStateMetadata(
    { facing: 'north', open: false, signText: ['hello'] },
    { facing: 'south', open: true },
  );
  assert.deepEqual(metadata.signText, ['hello']);
  assert.equal(metadata.facing, 'north');
  assert.deepEqual(metadata.blockState, { facing: 'south', open: true });
});

test('synchronizes legacy door fields into persisted canonical properties', () => {
  const definition = block('oak_door', 64);
  const metadata = synchronizeBlockMetadata(definition, 64, {
    facing: 'east',
    doorHalf: 'upper',
    hinge: 'right',
    open: true,
    powered: false,
  });
  assert.deepEqual(metadata.blockState, {
    facing: 'east',
    half: 'upper',
    hinge: 'right',
    open: true,
    powered: false,
  });
});

test('preserves modern double slab state through legacy metadata synchronization', () => {
  const definition = block('oak_slab', 30527);
  const metadata = synchronizeBlockMetadata(definition, definition.id, {
    slabHalf: 'double',
  });

  assert.deepEqual(metadata.blockState, {
    type: 'double',
    waterlogged: false,
  });
});
