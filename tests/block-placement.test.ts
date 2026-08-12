import assert from 'node:assert/strict';
import test from 'node:test';
import type { ItemDef } from '../src/items/ItemRegistry';
import type { BlockFacing, BlockMetadata } from '../src/types';
import { planBlockPlacement, type BlockPlacementWorldView } from '../src/world/BlockPlacement';
import { BlockRegistry } from '../src/world/BlockRegistry';
import type { BlockInteractionContext, BlockPosition } from '../src/world/BehaviorRegistry';

function item(name: string, placeBlockId: number): ItemDef {
  return {
    id: 9000 + placeBlockId,
    officialId: `minecraft:${name}`,
    baseId: 9000 + placeBlockId,
    metadata: 0,
    name,
    displayName: name,
    maxStackSize: 64,
    category: 'block',
    placeBlockId,
    behaviorId: 'minecraft:block_item',
  };
}

function target(blockId: number, face: BlockFacing, position: BlockPosition = { x: 0, y: 64, z: 0 }): BlockInteractionContext {
  const block = BlockRegistry.get(blockId) ?? BlockRegistry.getByName('stone');
  assert.ok(block);
  return { position, face, blockId, block, heldItem: null };
}

function world(
  blocks: Record<string, number> = {},
  metadata: Record<string, BlockMetadata> = {},
): BlockPlacementWorldView {
  const key = ({ x, y, z }: BlockPosition) => `${x},${y},${z}`;
  return {
    getBlock: (position) => blocks[key(position)] ?? 0,
    getBlockMetadata: (position) => metadata[key(position)],
  };
}

const noPlayerCollision = [{ x: 100, y: 100, z: 100 }];

test('plans ordinary placement on the targeted face', () => {
  const decision = planBlockPlacement({
    item: item('stone', 1),
    target: target(1, 'east'),
    placeBlockId: 1,
    playerOccupiedCells: noPlayerCollision,
  }, world());

  assert.equal(decision.ok, true);
  if (!decision.ok) return;
  assert.deepEqual(decision.plan.position, { x: 1, y: 64, z: 0 });
  assert.equal(decision.plan.kind, 'simple');
  assert.equal(decision.plan.facing, 'east');
});

test('distinguishes trapdoors from two-block doors', () => {
  const trapdoor = planBlockPlacement({
    item: item('oak_trapdoor', 96),
    target: target(1, 'up'),
    placeBlockId: 96,
    playerOccupiedCells: noPlayerCollision,
  }, world());
  const door = planBlockPlacement({
    item: item('oak_door', 64),
    target: target(1, 'up'),
    placeBlockId: 64,
    playerOccupiedCells: noPlayerCollision,
  }, world());

  assert.equal(trapdoor.ok && trapdoor.plan.kind, 'simple');
  assert.equal(door.ok && door.plan.kind, 'door');
});

test('selects standing and wall sign variants and rejects ceiling placement', () => {
  const standing = planBlockPlacement({
    item: item('sign', 63),
    target: target(1, 'up'),
    placeBlockId: 63,
    playerOccupiedCells: noPlayerCollision,
  }, world());
  const wallSign = planBlockPlacement({
    item: item('sign', 63),
    target: target(1, 'north'),
    placeBlockId: 63,
    playerOccupiedCells: noPlayerCollision,
  }, world());
  const ceiling = planBlockPlacement({
    item: item('sign', 63),
    target: target(1, 'down'),
    placeBlockId: 63,
    playerOccupiedCells: noPlayerCollision,
  }, world());

  assert.equal(standing.ok && standing.plan.blockId, 63);
  assert.equal(wallSign.ok && wallSign.plan.blockId, 68);
  assert.deepEqual(ceiling, { ok: false, reason: 'unsupported_face' });
});

test('requires farmland below crop placement', () => {
  const request = {
    item: item('wheat_seeds', 59),
    target: target(60, 'up', { x: 4, y: 63, z: 4 }),
    placeBlockId: 59,
    playerOccupiedCells: noPlayerCollision,
  };

  const supported = planBlockPlacement(request, world({ '4,63,4': 60 }));
  const unsupported = planBlockPlacement(request, world({ '4,63,4': 3 }));

  assert.equal(supported.ok, true);
  assert.deepEqual(unsupported, { ok: false, reason: 'invalid_support' });
});

test('merges compatible slab halves at the target position', () => {
  const legacy = planBlockPlacement({
    item: item('stone_slab', 44),
    target: target(44, 'up'),
    placeBlockId: 44,
    playerOccupiedCells: noPlayerCollision,
  }, world({ '0,64,0': 44 }, { '0,64,0': { slabHalf: 'bottom' } }));

  const modernSlabId = BlockRegistry.getByName('oak_slab')?.id;
  assert.ok(modernSlabId);
  const modern = planBlockPlacement({
    item: item('oak_slab', modernSlabId),
    target: target(modernSlabId, 'up'),
    placeBlockId: modernSlabId,
    playerOccupiedCells: noPlayerCollision,
  }, world({ '0,64,0': modernSlabId }, { '0,64,0': { slabHalf: 'bottom' } }));

  assert.equal(legacy.ok && legacy.plan.blockId, 43);
  assert.deepEqual(legacy.ok && legacy.plan.position, { x: 0, y: 64, z: 0 });
  assert.equal(modern.ok && modern.plan.blockId, modernSlabId);
  assert.equal(modern.ok && modern.plan.slabHalf, 'double');
});

test('rejects placement into either occupied player cell', () => {
  const decision = planBlockPlacement({
    item: item('stone', 1),
    target: target(1, 'up'),
    placeBlockId: 1,
    playerOccupiedCells: [{ x: 0, y: 65, z: 0 }],
  }, world());

  assert.deepEqual(decision, { ok: false, reason: 'inside_player' });
});
