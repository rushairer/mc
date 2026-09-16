import type { ItemDef } from '../items/ItemRegistry';
import type { BlockFacing, BlockMetadata } from '../types';
import { BlockRegistry } from './BlockRegistry';
import type { BlockInteractionContext, BlockPosition } from './BehaviorRegistry';

export type BlockPlacementFailure =
  | 'not_placeable'
  | 'missing_face'
  | 'unsupported_face'
  | 'inside_player'
  | 'invalid_support';

export type BlockPlacementKind = 'simple' | 'door' | 'bed' | 'slab';

export interface BlockPlacementPlan {
  kind: BlockPlacementKind;
  position: BlockPosition;
  blockId: number;
  facing: BlockFacing;
  slabHalf?: 'top' | 'bottom' | 'double';
  opensSignEditor: boolean;
  schedulesFluid: boolean;
  checksWitherSpawn: boolean;
}

export type BlockPlacementDecision =
  | { ok: true; plan: BlockPlacementPlan }
  | { ok: false; reason: BlockPlacementFailure };

export interface BlockPlacementWorldView {
  getBlock(position: BlockPosition): number;
  getBlockMetadata(position: BlockPosition): BlockMetadata | undefined;
}

export interface BlockPlacementRequest {
  item: ItemDef;
  target: BlockInteractionContext;
  placeBlockId: number | undefined;
  playerOccupiedCells: readonly BlockPosition[];
}

const FACE_OFFSETS: Record<BlockFacing, BlockPosition> = {
  north: { x: 0, y: 0, z: -1 },
  south: { x: 0, y: 0, z: 1 },
  east: { x: 1, y: 0, z: 0 },
  west: { x: -1, y: 0, z: 0 },
  up: { x: 0, y: 1, z: 0 },
  down: { x: 0, y: -1, z: 0 },
};

function offset(position: BlockPosition, face: BlockFacing): BlockPosition {
  const delta = FACE_OFFSETS[face];
  return {
    x: position.x + delta.x,
    y: position.y + delta.y,
    z: position.z + delta.z,
  };
}

function samePosition(left: BlockPosition, right: BlockPosition): boolean {
  return left.x === right.x && left.y === right.y && left.z === right.z;
}

function isDoorName(name: string): boolean {
  return name.endsWith('door') && !name.includes('trapdoor');
}

function isSingleSlabName(name: string): boolean {
  return name.includes('slab') && !name.includes('double');
}

function canMergeTargetSlab(face: BlockFacing, metadata: BlockMetadata | undefined): boolean {
  const half = metadata?.slabHalf ?? 'bottom';
  return (face === 'up' && half === 'bottom') || (face === 'down' && half === 'top');
}

function resolveDoubleSlabId(blockId: number, blockName: string): number {
  const doubleName = blockName.startsWith('double_') ? blockName : `double_${blockName}`;
  return BlockRegistry.getByName(doubleName)?.id
    ?? BlockRegistry.getByName(`minecraft:${doubleName}`)?.id
    ?? blockId;
}

/**
 * Pure placement planning. It performs no world mutation, item consumption,
 * sound, UI, or network work so placement edge cases can be replayed in tests.
 */
export function planBlockPlacement(
  request: BlockPlacementRequest,
  world: BlockPlacementWorldView,
): BlockPlacementDecision {
  const face = request.target.face;
  if (!face) return { ok: false, reason: 'missing_face' };

  let blockId = request.placeBlockId;
  if (blockId === undefined || blockId <= 0) return { ok: false, reason: 'not_placeable' };

  if (blockId === 63 || blockId === 176) {
    if (face === 'down') return { ok: false, reason: 'unsupported_face' };
    if (face !== 'up') blockId = blockId === 63 ? 68 : 177;
  }

  const block = BlockRegistry.get(blockId) ?? BlockRegistry.getByName(request.item.name);
  const blockName = block?.name ?? request.item.name;
  const isSlab = isSingleSlabName(blockName);
  let position = offset(request.target.position, face);
  let slabHalf: BlockPlacementPlan['slabHalf'];

  if (
    isSlab
    && request.target.blockId === blockId
    && canMergeTargetSlab(face, world.getBlockMetadata(request.target.position))
  ) {
    position = { ...request.target.position };
    const doubleBlockId = resolveDoubleSlabId(blockId, blockName);
    slabHalf = doubleBlockId === blockId ? 'double' : undefined;
    blockId = doubleBlockId;
  } else if (isSlab && world.getBlock(position) === blockId) {
    const doubleBlockId = resolveDoubleSlabId(blockId, blockName);
    slabHalf = doubleBlockId === blockId ? 'double' : undefined;
    blockId = doubleBlockId;
  } else if (isSlab) {
    slabHalf = face === 'up' ? 'bottom' : 'top';
  }

  if (request.playerOccupiedCells.some((cell) => samePosition(cell, position))) {
    return { ok: false, reason: 'inside_player' };
  }

  // Legacy packed block IDs must not leak into modern high runtime IDs.
  const registeredBaseId = block?.baseId ?? blockId;
  const legacyBaseId = registeredBaseId < 256 ? registeredBaseId & 0x3FF : undefined;
  const blockBelowId = world.getBlock({ x: position.x, y: position.y - 1, z: position.z });
  const blockBelow = BlockRegistry.get(blockBelowId);
  const registeredBelowBaseId = blockBelow?.baseId ?? blockBelowId;
  const legacyBelowBaseId = registeredBelowBaseId < 256 ? registeredBelowBaseId & 0x3FF : undefined;
  if ((legacyBaseId === 115 || blockName === 'nether_wart') && legacyBelowBaseId !== 88 && blockBelow?.name !== 'soul_sand') {
    return { ok: false, reason: 'invalid_support' };
  }
  if (
    (legacyBaseId === 59 || legacyBaseId === 141 || legacyBaseId === 142 || ['wheat', 'carrots', 'potatoes'].includes(blockName))
    && legacyBelowBaseId !== 60
    && blockBelow?.name !== 'farmland'
  ) {
    return { ok: false, reason: 'invalid_support' };
  }

  const isDoor = isDoorName(request.item.name) || isDoorName(blockName);
  const isBed = legacyBaseId === 26 || blockName === 'bed' || blockName.endsWith('_bed');
  return {
    ok: true,
    plan: {
      kind: isDoor ? 'door' : isBed ? 'bed' : isSlab ? 'slab' : 'simple',
      position,
      blockId,
      facing: face,
      slabHalf,
      opensSignEditor: blockId === 63 || blockId === 68,
      schedulesFluid: BlockRegistry.isFluid(blockId),
      checksWitherSpawn: legacyBaseId === 144 && ((blockId >> 10) & 0xF) === 1,
    },
  };
}

