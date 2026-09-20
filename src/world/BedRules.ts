import type { BlockFacing, BlockMetadata } from '../types';

export type BedDimension = 'overworld' | 'nether' | 'end';

export interface BedUseDecision {
  canSleep: boolean;
  setsSpawn: boolean;
  explodes: boolean;
  blockedByMonsters: boolean;
}

/** Base Java bed dimension/time/safety contract. */
export function resolveBedUse(
  dimension: BedDimension,
  canSleepNow: boolean,
  monstersNearby = false,
): BedUseDecision {
  if (dimension !== 'overworld') {
    return { canSleep: false, setsSpawn: false, explodes: true, blockedByMonsters: false };
  }
  const blockedByMonsters = canSleepNow && monstersNearby;
  return {
    canSleep: canSleepNow && !monstersNearby,
    setsSpawn: !blockedByMonsters,
    explodes: false,
    blockedByMonsters,
  };
}

export interface BedPosition { x: number; y: number; z: number }

function horizontalOffset(facing: BlockFacing | undefined): { x: number; z: number } {
  switch (facing) {
    case 'east': return { x: 1, z: 0 };
    case 'west': return { x: -1, z: 0 };
    case 'south': return { x: 0, z: 1 };
    case 'north':
    default: return { x: 0, z: -1 };
  }
}

/** Return the head block regardless of whether the player clicked head or foot. */
export function getBedHeadPosition(position: BedPosition, metadata: Pick<BlockMetadata, 'facing' | 'bedPart'> | undefined): BedPosition {
  if (metadata?.bedPart === 'head') return { ...position };
  const offset = horizontalOffset(metadata?.facing);
  return { x: position.x + offset.x, y: position.y, z: position.z + offset.z };
}

/** Return the other half of a placed bed from either its head or foot. */
export function getBedOtherPosition(
  position: BedPosition,
  metadata: Pick<BlockMetadata, 'facing' | 'bedPart'> | undefined,
): BedPosition {
  const offset = horizontalOffset(metadata?.facing);
  const direction = metadata?.bedPart === 'head' ? -1 : 1;
  return {
    x: position.x + offset.x * direction,
    y: position.y,
    z: position.z + offset.z * direction,
  };
}

/** Java sleep safety box: 8 blocks horizontally and 5 vertically from the bed. */
export function isMonsterWithinBedSleepRange(bed: BedPosition, monster: BedPosition): boolean {
  return Math.abs(monster.x - bed.x) <= 8
    && Math.abs(monster.z - bed.z) <= 8
    && Math.abs(monster.y - bed.y) <= 5;
}
