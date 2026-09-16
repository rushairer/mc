import type { BlockDef } from '../types';

/**
 * Chest lids are blocked by an opaque full/solid block above them. Barrels do
 * not use this rule. Transparent solid blocks such as glass are intentionally
 * not treated as lid blockers.
 */
export function isChestObstructingBlock(block: BlockDef | undefined): boolean {
  return !!block && block.solid && !block.transparent;
}

/**
 * Degrees are the number of other horizontal chest neighbors already touching
 * each chest adjacent to the placement target. Java allows one new partner but
 * rejects triple/corner chest formation.
 */
export function canPlaceChestFromNeighborDegrees(neighborDegrees: readonly number[]): boolean {
  if (neighborDegrees.length > 1) return false;
  return neighborDegrees.length === 0 || neighborDegrees[0] === 0;
}
