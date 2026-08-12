import assert from 'node:assert/strict';
import test from 'node:test';
import { FluidSystem, type FluidTickAccess } from '../src/systems/FluidSystem';
import type { BlockMetadata } from '../src/types';

function createWorld(initial: Array<[number, number, number, number, BlockMetadata?]>) {
  const blocks = new Map<string, number>();
  const metadata = new Map<string, BlockMetadata>();
  const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
  for (const [x, y, z, id, meta] of initial) {
    blocks.set(key(x, y, z), id);
    if (meta) metadata.set(key(x, y, z), meta);
  }
  const access: FluidTickAccess = {
    getBlock: (x, y, z) => blocks.get(key(x, y, z)) ?? 0,
    getBlockMeta: (x, y, z) => metadata.get(key(x, y, z)),
    setBlock: (x, y, z, id) => blocks.set(key(x, y, z), id),
    setBlockMeta: (x, y, z, meta) => {
      if (meta) metadata.set(key(x, y, z), meta);
      else metadata.delete(key(x, y, z));
    },
  };
  return { access, blocks, metadata, key };
}

test('a scheduled water tick deterministically fills an adjacent air cell', () => {
  const fluid = new FluidSystem();
  const world = createWorld([
    [-1, 10, 0, 9],
    [0, 9, 0, 1],
  ]);

  const result = fluid.processTick(0, 10, 0, world.access);

  assert.equal(world.blocks.get(world.key(0, 10, 0)), 8);
  assert.equal(world.metadata.get(world.key(0, 10, 0))?.fluidLevel, 7);
  assert.equal(result.changed, true);
  assert.equal(result.delayTicks, 5);
  assert.deepEqual(
    result.next.map(({ x, y, z }) => `${x},${y},${z}`).sort(),
    ['-1,10,0', '0,10,-1', '0,10,1', '0,11,0', '0,9,0', '1,10,0'],
  );
});

test('source water schedules propagation but remains unchanged', () => {
  const fluid = new FluidSystem();
  const world = createWorld([
    [0, 10, 0, 9],
    [0, 9, 0, 1],
  ]);

  const result = fluid.processTick(0, 10, 0, world.access);

  assert.equal(world.blocks.get(world.key(0, 10, 0)), 9);
  assert.equal(result.changed, false);
  assert.equal(result.next.length, 4);
});

test('lava meeting side water becomes cobblestone on its scheduled tick', () => {
  const fluid = new FluidSystem();
  const world = createWorld([
    [0, 10, 0, 11],
    [1, 10, 0, 9],
  ]);

  const result = fluid.processTick(0, 10, 0, world.access);

  assert.equal(world.blocks.get(world.key(0, 10, 0)), 4);
  assert.equal(result.changed, true);
  assert.equal(result.delayTicks, 10);
});
