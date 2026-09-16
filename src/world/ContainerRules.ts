import type { BlockDef } from '../types';

/**
 * Chest lids are blocked by an opaque full/solid block above them. Barrels do
 * not use this rule. Transparent solid blocks such as glass are intentionally
 * not treated as lid blockers.
 */
export function isChestObstructingBlock(block: BlockDef | undefined): boolean {
  return !!block && block.solid && !block.transparent;
}
