import assert from 'node:assert/strict';
import test from 'node:test';
import { CHUNK_SIZE } from '../src/constants';
import { HopperSystem } from '../src/systems/HopperSystem';
import { BlockRegistry } from '../src/world/BlockRegistry';

function createHarness() {
  const hopperId = BlockRegistry.getByName('hopper')?.id;
  assert.ok(hopperId !== undefined, 'hopper block is registered');

  const hopperMeta: any = {
    facing: 'down',
    inventory: new Array(5).fill(null),
    transferCooldown: 0,
    powered: false,
  };
  const x = 0;
  const y = 64;
  const z = 0;
  const index = x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
  const data: number[] = [];
  data[index] = hopperId!;
  const metadata = new Map<number, any>([[index, hopperMeta]]);
  const chunk: any = { cx: 0, cz: 0, data, metadata };

  const chunks: any = {
    chunks: new Map([['0,0', chunk]]),
    getBlockMeta: () => undefined,
    setBlockMeta: () => {},
  };

  let nextEntityId = 1;
  const items = new Map<number, any>();
  const droppedItems: any = {
    items,
    removeItem(id: number) { items.delete(id); },
  };
  const spawn = (count: number, pickupDelay = 0, itemId = 331) => {
    const id = nextEntityId++;
    items.set(id, {
      id,
      itemId,
      count,
      pickupDelay,
      position: { x: 0.5, y: 65.0, z: 0.5 },
    });
    return id;
  };

  let changes = 0;
  const hopper = new HopperSystem(chunks, droppedItems, () => { changes++; });
  return { hopper, hopperMeta, items, spawn, getChanges: () => changes };
}

test('hopper suction ignores player item pickupDelay', () => {
  const { hopper, hopperMeta, items, spawn } = createHarness();
  spawn(1, 10);
  hopper.update(0.05);
  assert.equal(hopperMeta.inventory[0]?.count, 1);
  assert.equal(items.size, 0);
});

test('hopper absorbs an entire compatible item entity stack in one collection event', () => {
  const { hopper, hopperMeta, items, spawn } = createHarness();
  spawn(32, 0);
  hopper.update(0.05);
  assert.equal(hopperMeta.inventory[0]?.count, 32);
  assert.equal(items.size, 0);
});

test('hopper waits exactly eight game ticks before the next collection', () => {
  const { hopper, hopperMeta, items, spawn, getChanges } = createHarness();
  spawn(1);
  hopper.update(0.05);
  assert.equal(hopperMeta.inventory[0]?.count, 1);
  assert.equal(hopperMeta.transferCooldown, 0.4);
  assert.equal(getChanges(), 1);

  spawn(1);
  hopper.update(0.35);
  assert.equal(hopperMeta.inventory[0]?.count, 1, 'second entity waits while cooldown remains');
  assert.equal(items.size, 1);

  hopper.update(0.05);
  assert.equal(hopperMeta.inventory[0]?.count, 2, 'second entity is collected at the exact 8-tick boundary');
  assert.equal(items.size, 0);
  assert.equal(getChanges(), 2);
});
