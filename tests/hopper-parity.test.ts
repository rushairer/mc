import assert from 'node:assert/strict';
import test from 'node:test';
import { CHUNK_SIZE } from '../src/constants';
import {
  HopperSystem,
  canHopperExtractSlot,
  getHopperExtractionSlots,
  getHopperInsertionSlots,
  getHopperTargetSlotLimit,
} from '../src/systems/HopperSystem';
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


test('furnace hopper faces expose Java input fuel and output slots', () => {
  assert.deepEqual(getHopperInsertionSlots('furnace', 'top', { id: 4, count: 1 }), [0]);
  assert.deepEqual(getHopperInsertionSlots('smoker', 'side', { id: 263, count: 1 }), [1]);
  assert.deepEqual(getHopperInsertionSlots('blast_furnace', 'side', { id: 4, count: 1 }), []);
  assert.deepEqual(getHopperExtractionSlots('furnace', 3), [2, 1]);
  assert.equal(canHopperExtractSlot('furnace', 2, { id: 265, count: 1 }), true);
  assert.equal(canHopperExtractSlot('furnace', 1, { id: 325, count: 1 }), true);
  assert.equal(canHopperExtractSlot('furnace', 1, { id: 263, count: 1 }), false);
});

test('brewing stand top accepts ingredients while side accepts fuel or bottles', () => {
  assert.deepEqual(getHopperInsertionSlots('brewing_stand', 'top', { id: 372, count: 1 }), [3]);
  assert.deepEqual(getHopperInsertionSlots('brewing_stand', 'top', { id: 373, count: 1 }), []);
  assert.deepEqual(getHopperInsertionSlots('brewing_stand', 'side', { id: 377, count: 1 }), [4]);
  assert.deepEqual(getHopperInsertionSlots('brewing_stand', 'side', { id: 373, count: 1 }), [0, 1, 2]);
  assert.deepEqual(getHopperInsertionSlots('brewing_stand', 'side', { id: 374, count: 1 }), [0, 1, 2]);
  assert.deepEqual(getHopperInsertionSlots('brewing_stand', 'side', { id: 353, count: 1 }), []);
});

test('brewing stand bottom exposes bottles plus the ingredient remainder edge case', () => {
  assert.deepEqual(getHopperExtractionSlots('brewing_stand', 5), [0, 1, 2, 3]);
  assert.equal(canHopperExtractSlot('brewing_stand', 0, { id: 373, count: 1 }), true);
  assert.equal(canHopperExtractSlot('brewing_stand', 3, { id: 374, count: 1 }), true);
  assert.equal(canHopperExtractSlot('brewing_stand', 3, { id: 372, count: 1 }), false);
  assert.equal(canHopperExtractSlot('brewing_stand', 4, { id: 377, count: 1 }), false);
});

test('brewing bottle slots are single-item slots and generic containers expose their full size', () => {
  assert.equal(getHopperTargetSlotLimit('brewing_stand', 0, 374), 1);
  assert.deepEqual(getHopperExtractionSlots('chest', 54), Array.from({ length: 54 }, (_, i) => i));
});
