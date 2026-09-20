import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ItemRegistry } from '../src/items/ItemRegistry';
import {
  SERVER_TNT_FUSE_SECONDS,
  adjacentBlockPosition,
  bucketFillItemName,
  bucketPlacedBlockName,
  isValidServerItemUseForHeldStack,
  parseServerItemUseIntent,
  replaceOneHeldItem,
} from '../src/server/ServerItemUseRules';
import { registerWildernessBound26_3 } from '../src/world/registerWildernessBound26_3';

registerWildernessBound26_3();

test('503: targeted item-use packets parse block and entity intents and reject malformed coordinates', () => {
  assert.deepEqual(
    parseServerItemUseIntent({ kind: 'block', itemId: 325, x: 1, y: 64, z: -2, face: 'up' }),
    { kind: 'block', itemId: 325, x: 1, y: 64, z: -2, face: 'up' },
  );
  assert.deepEqual(
    parseServerItemUseIntent({ kind: 'entity', itemId: 359, entityId: 12 }),
    { kind: 'entity', itemId: 359, entityId: 12 },
  );
  assert.equal(parseServerItemUseIntent({ kind: 'block', itemId: 325, x: 1.5, y: 64, z: 0, face: 'up' }), null);
  assert.equal(parseServerItemUseIntent({ kind: 'block', itemId: 325, x: 1, y: 64, z: 0, face: 'sideways' }), null);
});

test('504: server item-use validation rejects spoofed held item ids and unsupported items', () => {
  const bucket = ItemRegistry.getByName('bucket'); assert.ok(bucket);
  const stone = ItemRegistry.getByName('stone') ?? ItemRegistry.get(1); assert.ok(stone);
  const intent = parseServerItemUseIntent({ kind: 'block', itemId: bucket.id, x: 0, y: 64, z: 0, face: 'up' })!;
  assert.equal(isValidServerItemUseForHeldStack(intent, { id: bucket.id, count: 1 }), true);
  assert.equal(isValidServerItemUseForHeldStack(intent, { id: stone.id, count: 1 }), false);
});

test('505: block item-use adjacency is face-derived rather than client-selected', () => {
  assert.deepEqual(adjacentBlockPosition(10, 64, 10, 'east'), { x: 11, y: 64, z: 10 });
  assert.deepEqual(adjacentBlockPosition(10, 64, 10, 'down'), { x: 10, y: 63, z: 10 });
});

test('506: bucket source rules accept stationary Water, Lava, and Powder Snow only', () => {
  assert.equal(bucketFillItemName('water'), 'water_bucket');
  assert.equal(bucketFillItemName('lava'), 'lava_bucket');
  assert.equal(bucketFillItemName('powder_snow'), 'powder_snow_bucket');
  assert.equal(bucketFillItemName('flowing_water'), null);
  assert.equal(bucketFillItemName('stone'), null);
});

test('507: filled bucket rules resolve the authoritative placed block', () => {
  assert.equal(bucketPlacedBlockName('water_bucket'), 'water');
  assert.equal(bucketPlacedBlockName('lava_bucket'), 'lava');
  assert.equal(bucketPlacedBlockName('powder_snow_bucket'), 'powder_snow');
  assert.equal(bucketPlacedBlockName('milk_bucket'), null);
});

test('508: stacked empty buckets leave the stack and emit one filled-bucket remainder', () => {
  const result = replaceOneHeldItem({ id: 325, count: 4 }, 326, false);
  assert.deepEqual(result.held, { id: 325, count: 3 });
  assert.deepEqual(result.remainder, { id: 326, count: 1 });
  assert.deepEqual(replaceOneHeldItem({ id: 326, count: 1 }, 325, false), {
    held: { id: 325, count: 1 },
    remainder: null,
  });
});

test('509: multiplayer Bucket use is routed to C2S_ITEM_USE before local world mutation', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const method = source.match(/private tryUseBucket[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.ok(method.includes('this.sendServerBlockItemUse(stack, target)'));
  assert.ok(method.indexOf('this.sendServerBlockItemUse(stack, target)') < method.indexOf('this.chunks.setBlock('));
});

test('510: server block item use validates real game-mode reach and owns Bucket world/inventory updates', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const method = source.match(/private handleServerBlockItemUse[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.ok(method.includes('isBlockActionInReach(session, intent.x, intent.y, intent.z, session.gameMode)'));
  assert.ok(method.includes('bucketFillItemName(targetBlock.name)'));
  assert.ok(method.includes('this.applyServerHeldReplacement(session, held, filledBucket.id)'));
  assert.ok(method.includes('bucketPlacedBlockName(itemName)'));
  assert.ok(source.includes("isBlockActionInReach(session, x, y, z, session.gameMode)"));
});

test('511: multiplayer Flint and Steel is server-authoritative for fire, portal updates, durability, and TNT priming', () => {
  const client = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const clientMethod = client.match(/private tryUseFlintAndSteel[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.ok(clientMethod.includes('this.sendServerBlockItemUse(held, target)'));

  const server = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  assert.ok(server.includes("targetBlock.name === 'tnt'"));
  assert.ok(server.includes("BlockRegistry.getByName('fire')"));
  assert.ok(server.includes('this.dimensionGen.findAndActivatePortalFrame('));
  assert.ok(server.includes('this.damageServerHeldTool(session, held)'));
});

test('512: server-primed TNT uses the Java-style four-second fuse before authoritative explosion', () => {
  assert.equal(SERVER_TNT_FUSE_SECONDS, 4);
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  assert.ok(source.includes('private primedTnt: Map<number, ServerPrimedTnt>'));
  assert.ok(source.includes('fuseSeconds: SERVER_TNT_FUSE_SECONDS'));
  assert.ok(source.includes('this.tickPrimedTnt(dt)'));
  assert.ok(source.includes('this.triggerExplosion(tnt.position, 4, tnt.dimension)'));
});
