import assert from 'node:assert/strict';
import test from 'node:test';
import { FluidSystem, type FluidTickAccess } from '../src/systems/FluidSystem';
import type { BlockMetadata } from '../src/types';

function createWorld(
  initial: Array<[number, number, number, number, BlockMetadata?]>,
  dimension = 0,
) {
  const blocks = new Map<string, number>();
  const metadata = new Map<string, BlockMetadata>();
  const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
  for (const [x, y, z, id, meta] of initial) {
    blocks.set(key(x, y, z), id);
    if (meta) metadata.set(key(x, y, z), meta);
  }
  const access: FluidTickAccess = {
    dimension,
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
  assert.equal(result.delayTicks, 5);
});

test('Overworld and End lava use the Java 30-game-tick flow delay', () => {
  const fluid = new FluidSystem();
  for (const dimension of [0, 2]) {
    const world = createWorld([
      [0, 10, 0, 11],
      [0, 9, 0, 1],
    ], dimension);
    assert.equal(fluid.processTick(0, 10, 0, world.access).delayTicks, 30);
  }
});

test('Nether lava uses the Java 10-game-tick flow delay', () => {
  const fluid = new FluidSystem();
  const world = createWorld([
    [0, 10, 0, 11],
    [0, 9, 0, 1],
  ], 1);
  assert.equal(fluid.processTick(0, 10, 0, world.access).delayTicks, 10);
});

test('lava horizontal decay is two levels outside Nether and one in Nether', () => {
  const fluid = new FluidSystem();

  const overworld = createWorld([
    [-1, 10, 0, 11],
    [0, 9, 0, 1],
  ], 0);
  fluid.processTick(0, 10, 0, overworld.access);
  assert.equal(overworld.blocks.get(overworld.key(0, 10, 0)), 10);
  assert.equal(overworld.metadata.get(overworld.key(0, 10, 0))?.fluidLevel, 6);

  const nether = createWorld([
    [-1, 10, 0, 11],
    [0, 9, 0, 1],
  ], 1);
  fluid.processTick(0, 10, 0, nether.access);
  assert.equal(nether.blocks.get(nether.key(0, 10, 0)), 10);
  assert.equal(nether.metadata.get(nether.key(0, 10, 0))?.fluidLevel, 7);
});

test('falling water is full flowing water rather than a new source block', () => {
  const fluid = new FluidSystem();
  const world = createWorld([
    [0, 11, 0, 9],
  ]);

  fluid.processTick(0, 10, 0, world.access);

  assert.equal(world.blocks.get(world.key(0, 10, 0)), 8);
  assert.equal(world.metadata.get(world.key(0, 10, 0))?.fluidLevel, 8);
});

test('falling lava is full flowing lava rather than a new source block', () => {
  const fluid = new FluidSystem();
  const world = createWorld([
    [0, 11, 0, 11],
  ]);

  fluid.processTick(0, 10, 0, world.access);

  assert.equal(world.blocks.get(world.key(0, 10, 0)), 10);
  assert.equal(world.metadata.get(world.key(0, 10, 0))?.fluidLevel, 8);
});

test('two adjacent water sources create a source when supported below', () => {
  const fluid = new FluidSystem();
  const world = createWorld([
    [-1, 10, 0, 9],
    [1, 10, 0, 9],
    [0, 9, 0, 1],
  ]);

  fluid.processTick(0, 10, 0, world.access);

  assert.equal(world.blocks.get(world.key(0, 10, 0)), 9);
  assert.equal(world.metadata.has(world.key(0, 10, 0)), false);
});

test('adjacent lava sources never create a new lava source', () => {
  const fluid = new FluidSystem();
  const world = createWorld([
    [-1, 10, 0, 11],
    [1, 10, 0, 11],
    [0, 9, 0, 1],
  ], 0);

  fluid.processTick(0, 10, 0, world.access);

  assert.equal(world.blocks.get(world.key(0, 10, 0)), 10);
  assert.equal(world.metadata.get(world.key(0, 10, 0))?.fluidLevel, 6);
});

test('water touching a lava source from the side creates obsidian', () => {
  const fluid = new FluidSystem();
  const world = createWorld([
    [0, 10, 0, 11],
    [1, 10, 0, 9],
  ]);

  const result = fluid.processTick(0, 10, 0, world.access);

  assert.equal(world.blocks.get(world.key(0, 10, 0)), 49);
  assert.equal(result.changed, true);
});

test('water touching flowing lava from the side creates cobblestone', () => {
  const fluid = new FluidSystem();
  const world = createWorld([
    [0, 10, 0, 10, { fluidLevel: 6 }],
    [1, 10, 0, 9],
  ]);

  const result = fluid.processTick(0, 10, 0, world.access);

  assert.equal(world.blocks.get(world.key(0, 10, 0)), 4);
  assert.equal(result.changed, true);
});

test('lava flowing downward into water turns the water cell into stone', () => {
  const fluid = new FluidSystem();
  const world = createWorld([
    [0, 10, 0, 10, { fluidLevel: 6 }],
    [0, 9, 0, 9],
  ]);

  const result = fluid.processTick(0, 10, 0, world.access);

  assert.equal(world.blocks.get(world.key(0, 10, 0)), 10, 'lava remains in its current cell');
  assert.equal(world.blocks.get(world.key(0, 9, 0)), 1, 'water below becomes stone');
  assert.equal(result.changed, true);
});
