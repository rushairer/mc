import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  applyContainerClick,
  containerKey,
  createContainerSlots,
  validateContainerClick,
  validateContainerSlots,
} from '../src/server/ContainerRules';
import { GameServer } from '../src/server/GameServer';

// ─── Container rules (P5.3) ───

test('createContainerSlots sizes by block', () => {
  assert.equal(createContainerSlots('chest').length, 27);
  assert.equal(createContainerSlots('barrel').length, 27);
  assert.equal(createContainerSlots('hopper').length, 5);
  assert.equal(createContainerSlots('unknown').length, 27, 'defaults to chest size');
});

test('validateContainerClick bounds the slot and checks the held item', () => {
  const slots = createContainerSlots('chest');
  assert.equal(validateContainerClick(0, slots, null), true, 'pickup only');
  assert.equal(validateContainerClick(26, slots, { id: 1, count: 1 }), true);
  assert.equal(validateContainerClick(27, slots, null), false, 'out of range');
  assert.equal(validateContainerClick(-1, slots, null), false);
  assert.equal(validateContainerClick(0, slots, { id: 0, count: 1 }), false, 'invalid id');
  assert.equal(validateContainerClick(0, slots, { id: 1, count: 0 }), false);
});

test('applyContainerClick places, swaps and stacks', () => {
  let slots = createContainerSlots('chest');
  slots = applyContainerClick(slots, 0, { id: 5, count: 4 });
  assert.deepEqual(slots[0], { id: 5, count: 4 });
  slots = applyContainerClick(slots, 0, { id: 5, count: 2 });
  assert.deepEqual(slots[0], { id: 5, count: 6 }, 'same-id stacks');
  slots = applyContainerClick(slots, 0, null);
  assert.equal(slots[0], null, 'pickup empties the slot');
});

test('validateContainerSlots rejects wrong sizes and malformed stacks', () => {
  assert.equal(validateContainerSlots(new Array(27).fill(null), 27), true);
  assert.equal(validateContainerSlots(new Array(26).fill(null), 27), false, 'wrong size');
  const bad = new Array(27).fill(null);
  bad[3] = { id: 1, count: 65 };
  assert.equal(validateContainerSlots(bad, 27), false, 'over-stack');
  const badId = new Array(27).fill(null);
  badId[3] = { id: -1, count: 1 };
  assert.equal(validateContainerSlots(badId, 27), false);
});

// ─── World save/load (P5.3) ───

test('GameServer world snapshot round-trips chunks and containers', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mc-save-'));
  const path = join(dir, 'world.json');
  try {
    const server = new GameServer(4242);
    // Seed a block + a container via the public APIs.
    server.setBlock(0, 64, 0, 1, 0);
    const chestKey = containerKey(5, 64, 5);
    (server as any).containerData.set(chestKey, [{ id: 263, count: 3 }]);

    await server.saveWorld(path);
    const reloaded = new GameServer(9999);
    await reloaded.loadWorld(path);
    assert.equal(reloaded.getBlock(0, 64, 0, 0), 1, 'block restored');
    const slots = (reloaded as any).containerData.get(chestKey);
    assert.deepEqual(slots, [{ id: 263, count: 3 }], 'container restored');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
