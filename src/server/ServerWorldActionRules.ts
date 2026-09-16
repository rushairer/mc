import type { ItemStack } from '../types';
import { ItemRegistry } from '../items/ItemRegistry';

export const SURVIVAL_BLOCK_REACH = 4.5;
export const CREATIVE_BLOCK_REACH = 5;

export interface ServerPlayerPoint {
  x: number;
  y: number;
  z: number;
}

export function getBlockInteractionReach(gameMode: 'survival' | 'creative' = 'survival'): number {
  return gameMode === 'creative' ? CREATIVE_BLOCK_REACH : SURVIVAL_BLOCK_REACH;
}

/**
 * Server-side block reach validation against the nearest point of the target
 * block AABB. The player coordinates are feet coordinates.
 */
export function isBlockActionInReach(
  player: ServerPlayerPoint,
  blockX: number,
  blockY: number,
  blockZ: number,
  gameMode: 'survival' | 'creative' = 'survival',
): boolean {
  if (![player.x, player.y, player.z, blockX, blockY, blockZ].every(Number.isFinite)) return false;
  const eyeX = player.x;
  const eyeY = player.y + 1.62;
  const eyeZ = player.z;
  const closestX = Math.max(blockX, Math.min(blockX + 1, eyeX));
  const closestY = Math.max(blockY, Math.min(blockY + 1, eyeY));
  const closestZ = Math.max(blockZ, Math.min(blockZ + 1, eyeZ));
  const dx = eyeX - closestX;
  const dy = eyeY - closestY;
  const dz = eyeZ - closestZ;
  const reach = getBlockInteractionReach(gameMode);
  return dx * dx + dy * dy + dz * dz <= reach * reach + 1e-9;
}

export function isValidHotbarSlot(slot: unknown): slot is number {
  return typeof slot === 'number' && Number.isInteger(slot) && slot >= 0 && slot < 9;
}

export function isValidBlockCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value);
}

export function isValidWorldY(y: unknown, worldHeight: number): y is number {
  return isValidBlockCoordinate(y) && y >= 0 && y < worldHeight;
}

export function isValidInventoryStack(stack: ItemStack | null | undefined): boolean {
  if (stack == null) return true;
  if (!Number.isInteger(stack.id) || stack.id <= 0) return false;
  const def = ItemRegistry.get(stack.id);
  if (!def) return false;
  if (!Number.isInteger(stack.count) || stack.count <= 0 || stack.count > def.maxStackSize) return false;
  if (stack.durability !== undefined) {
    if (!def.durability) return false;
    if (!Number.isFinite(stack.durability) || stack.durability <= 0 || stack.durability > def.durability) return false;
  }
  return true;
}

export function canPlaceHeldBlock(stack: ItemStack | null | undefined, blockId: number): boolean {
  if (!stack || stack.count <= 0 || !Number.isInteger(blockId) || blockId <= 0) return false;
  return ItemRegistry.getPlaceBlockId(stack.id) === blockId;
}

export function consumeHeldStack(stack: ItemStack): ItemStack | null {
  const count = stack.count - 1;
  return count > 0 ? { ...stack, count } : null;
}
