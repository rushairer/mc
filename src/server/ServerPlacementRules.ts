import type { BlockFacing, BlockMetadata } from '../types';
import type { BlockPlacementPlan } from '../world/BlockPlacement';
import type { BlockPosition } from '../world/BehaviorRegistry';

export interface ServerPlacementCell {
  position: BlockPosition;
  blockId: number;
  metadata: BlockMetadata | null;
}

export function horizontalFacingFromYaw(yaw: number): BlockFacing {
  if (!Number.isFinite(yaw)) return 'north';
  const x = -Math.sin(yaw);
  const z = -Math.cos(yaw);
  if (Math.abs(x) > Math.abs(z)) return x > 0 ? 'east' : 'west';
  return z > 0 ? 'south' : 'north';
}

export function signRotationFromYaw(yaw: number): number {
  if (!Number.isFinite(yaw)) return 0;
  return ((Math.round(((yaw + Math.PI) * 16) / (2 * Math.PI)) % 16) + 16) % 16;
}

export function horizontalOffset(facing: BlockFacing): { x: number; z: number } {
  switch (facing) {
    case 'east': return { x: 1, z: 0 };
    case 'west': return { x: -1, z: 0 };
    case 'south': return { x: 0, z: 1 };
    case 'north':
    default: return { x: 0, z: -1 };
  }
}

export function getDoorSidePosition(
  x: number,
  z: number,
  facing: BlockFacing,
  side: 'left' | 'right',
): { x: number; z: number } {
  switch (facing) {
    case 'north': return side === 'left' ? { x: x - 1, z } : { x: x + 1, z };
    case 'south': return side === 'left' ? { x: x + 1, z } : { x: x - 1, z };
    case 'east': return side === 'left' ? { x, z: z - 1 } : { x, z: z + 1 };
    case 'west': return side === 'left' ? { x, z: z + 1 } : { x, z: z - 1 };
    default: return side === 'left' ? { x: x - 1, z } : { x: x + 1, z };
  }
}

export function resolveDoorHinge(
  x: number,
  z: number,
  facing: BlockFacing,
  playerX: number,
  playerZ: number,
  leftMatchingDoor: boolean,
  rightMatchingDoor: boolean,
): 'left' | 'right' {
  if (leftMatchingDoor && !rightMatchingDoor) return 'right';
  if (rightMatchingDoor && !leftMatchingDoor) return 'left';

  const centerX = x + 0.5;
  const centerZ = z + 0.5;
  switch (facing) {
    case 'north': return playerX < centerX ? 'left' : 'right';
    case 'south': return playerX > centerX ? 'left' : 'right';
    case 'east': return playerZ < centerZ ? 'left' : 'right';
    case 'west': return playerZ > centerZ ? 'left' : 'right';
    default: return 'left';
  }
}

export function createServerPlacementCells(
  plan: BlockPlacementPlan,
  yaw: number,
  doorHinge: 'left' | 'right' = 'left',
): ServerPlacementCell[] {
  const facing = horizontalFacingFromYaw(yaw);
  const base = plan.position;

  if (plan.kind === 'door') {
    return [
      {
        position: { ...base },
        blockId: plan.blockId,
        metadata: { facing, doorHalf: 'lower', hinge: doorHinge, open: false, powered: false },
      },
      {
        position: { x: base.x, y: base.y + 1, z: base.z },
        blockId: plan.blockId,
        metadata: { facing, doorHalf: 'upper', hinge: doorHinge, open: false, powered: false },
      },
    ];
  }

  if (plan.kind === 'bed') {
    const delta = horizontalOffset(facing);
    return [
      {
        position: { ...base },
        blockId: plan.blockId,
        metadata: { facing, bedPart: 'foot' },
      },
      {
        position: { x: base.x + delta.x, y: base.y, z: base.z + delta.z },
        blockId: plan.blockId,
        metadata: { facing, bedPart: 'head' },
      },
    ];
  }

  if (plan.kind === 'slab') {
    return [{
      position: { ...base },
      blockId: plan.blockId,
      metadata: plan.slabHalf ? { slabHalf: plan.slabHalf } : null,
    }];
  }

  return [{
    position: { ...base },
    blockId: plan.blockId,
    metadata: null,
  }];
}

export function isPlacementReplaceableBlockName(name: string | undefined): boolean {
  if (!name || name === 'air') return true;
  return name === 'tall_grass'
    || name === 'dead_bush'
    || name === 'snow_layer'
    || name.endsWith('_flower')
    || name.endsWith('_sapling');
}
