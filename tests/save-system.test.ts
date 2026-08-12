import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_RECOVERED_MOBS_PER_DIMENSION,
  SAVE_SCHEMA_VERSION,
  migrateAndValidateSave,
} from '../src/systems/SaveSystem';

function legacyPlayer() {
  return {
    x: 8.5,
    y: 80,
    z: 8.5,
    yaw: 0,
    pitch: 0,
    health: 20,
    hunger: 20,
    flying: false,
    currentDimension: 0,
  };
}

test('migrates unversioned flat saves into dimension buckets', () => {
  const migrated = migrateAndValidateSave({
    player: legacyPlayer(),
    inventory: { slots: [], armor: [] },
    seed: 42,
    chunks: [
      { cx: 0, cz: 0, data: new Uint16Array([1, 2]), dimension: 0 },
      { cx: 2, cz: 3, data: new Uint16Array([3, 4]), dimension: 1 },
    ],
    mobs: [
      { type: 'cow', x: 2, y: 70, z: 2, health: 10, dimension: 0 },
      { type: 'blaze', x: 2, y: 70, z: 2, health: 20, dimension: 1 },
    ],
    timestamp: 1,
  });

  assert.equal(migrated.schemaVersion, SAVE_SCHEMA_VERSION);
  assert.equal(migrated.dimensions[0]?.chunks.length, 1);
  assert.equal(migrated.dimensions[1]?.chunks.length, 1);
  assert.equal(migrated.dimensions[0]?.mobs[0]?.type, 'cow');
  assert.equal(migrated.dimensions[1]?.mobs[0]?.type, 'blaze');
  assert.equal(migrated.inventory.slots.length, 36);
  assert.equal(migrated.inventory.armor.length, 4);
  assert.equal(migrated.recovery?.migratedFrom, 0);
});

test('deduplicates and caps legacy mob explosions', () => {
  const mobs = Array.from({ length: 200 }, (_, index) => ({
    type: index % 2 === 0 ? 'zombie' : 'cow',
    x: index,
    y: 70,
    z: index,
    health: 20,
    dimension: 0,
  }));
  mobs.push({ type: 'zombie', x: 0, y: 70, z: 0, health: 20, dimension: 0 });

  const migrated = migrateAndValidateSave({
    player: legacyPlayer(),
    inventory: { slots: [], armor: [] },
    chunks: [],
    mobs,
  });

  assert.equal(migrated.dimensions[0]?.mobs.length, MAX_RECOVERED_MOBS_PER_DIMENSION);
  assert.ok(migrated.recovery?.warnings.some((warning) => warning.includes('Trimmed dimension 0 mobs')));
});

test('recovers malformed optional state with safe defaults', () => {
  const recovered = migrateAndValidateSave({
    schemaVersion: SAVE_SCHEMA_VERSION,
    player: { x: Number.NaN, health: 999, hunger: -4 },
    inventory: null,
    dimensions: {
      0: {
        chunks: [{ cx: 'bad', cz: 0, data: [] }],
        mobs: [{ type: 'not_a_mob', x: 0, y: 0, z: 0, health: 20 }],
      },
    },
  });

  assert.equal(recovered.player.x, 0.5);
  assert.equal(recovered.player.health, 20);
  assert.equal(recovered.player.hunger, 0);
  assert.equal(recovered.inventory.slots.length, 36);
  assert.equal(recovered.dimensions[0]?.chunks.length, 0);
  assert.equal(recovered.dimensions[0]?.mobs.length, 0);
  assert.equal(recovered.recovery?.recovered, true);
});

test('rejects saves from unsupported future schemas', () => {
  assert.throws(
    () => migrateAndValidateSave({ schemaVersion: SAVE_SCHEMA_VERSION + 1 }),
    /newer than supported/,
  );
});

test('migrates schema v2 saves to v3 scheduled tick storage', () => {
  const migrated = migrateAndValidateSave({
    schemaVersion: 2,
    player: legacyPlayer(),
    inventory: { slots: [], armor: [] },
    dimensions: {},
    simulationTick: 12,
  });

  assert.equal(migrated.schemaVersion, 3);
  assert.deepEqual(migrated.scheduledBlockTicks, []);
  assert.ok(migrated.recovery?.warnings.some((warning) => warning.includes('schema v3')));
});

test('schema v2 to v3 migration does not apply corrupt-legacy mob trimming', () => {
  const mobs = Array.from({ length: 20 }, (_, index) => ({
    type: 'cow',
    x: index,
    y: 70,
    z: index,
    health: 10,
    dimension: 0,
  }));
  const migrated = migrateAndValidateSave({
    schemaVersion: 2,
    player: legacyPlayer(),
    inventory: { slots: [], armor: [] },
    dimensions: { 0: { chunks: [], mobs } },
  });

  assert.equal(migrated.dimensions[0]?.mobs.length, 20);
});

test('validates, canonicalizes, deduplicates, and restores future block ticks', () => {
  const migrated = migrateAndValidateSave({
    schemaVersion: SAVE_SCHEMA_VERSION,
    player: legacyPlayer(),
    inventory: { slots: [], armor: [] },
    dimensions: {},
    simulationTick: 10,
    scheduledBlockTicks: [
      {
        id: 'untrusted',
        type: 'fluid',
        x: 1.9,
        y: 64,
        z: -2.1,
        dimension: 1,
        dueTick: 15,
        priority: 'high',
        payload: { reason: 'bucket_place' },
        order: 2,
      },
      {
        id: 'duplicate-later',
        type: 'fluid',
        x: 1,
        y: 64,
        z: -3,
        dimension: 1,
        dueTick: 18,
        priority: 'low',
        order: 3,
      },
      { id: 'expired', type: 'block_event', x: 0, y: 64, z: 0, dimension: 0, dueTick: 9, priority: 'normal', order: 0 },
      { id: 'invalid', type: 'unknown', x: 0, y: 64, z: 0, dimension: 0, dueTick: 20, priority: 'normal', order: 0 },
    ],
  });

  assert.equal(migrated.scheduledBlockTicks?.length, 1);
  assert.deepEqual(migrated.scheduledBlockTicks?.[0], {
    id: '1:1,64,-3:fluid',
    type: 'fluid',
    x: 1,
    y: 64,
    z: -3,
    dimension: 1,
    dueTick: 15,
    priority: 'high',
    payload: {
      reason: 'bucket_place',
      sourceX: undefined,
      sourceY: undefined,
      sourceZ: undefined,
    },
    order: 2,
  });
});

test('preserves a loaded crossbow projectile through save validation', () => {
  const migrated = migrateAndValidateSave({
    schemaVersion: SAVE_SCHEMA_VERSION,
    player: legacyPlayer(),
    inventory: {
      slots: [{ id: 20071, count: 1, chargedProjectileId: 262 }],
      armor: [],
    },
    dimensions: {},
  });

  assert.deepEqual(migrated.inventory.slots[0], {
    id: 20071,
    count: 1,
    chargedProjectileId: 262,
  });
});
