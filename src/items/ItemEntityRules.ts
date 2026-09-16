import { ItemRegistry } from './ItemRegistry';
import { cloneItemStack, itemStacksCanMerge } from './ItemStackRules';
import type { ItemStack } from '../types';

export const ITEM_ENTITY_DESPAWN_SECONDS = 300;
export const ITEM_ENTITY_DEFAULT_PICKUP_DELAY_SECONDS = 0.5;
export const ITEM_ENTITY_MERGE_INTERVAL_SECONDS = 0.5;

const PLAYER_HALF_WIDTH = 0.3;
const PLAYER_HEIGHT = 1.8;
const PICKUP_EXPAND_XZ = 1.0;
const PICKUP_EXPAND_Y = 0.5;
const ITEM_ENTITY_WIDTH = 0.25;
const ITEM_ENTITY_HEIGHT = 0.25;
const MERGE_EXPAND_XZ = 0.5;

export interface PositionLike {
  x: number;
  y: number;
  z: number;
}

export interface InsertItemStackResult {
  inserted: number;
  remaining: ItemStack | null;
}

/** Java playerTouch uses the player's collision box inflated by 1.0 X/Z and 0.5 Y. */
export function isWithinItemPickupBounds(item: PositionLike, playerBase: PositionLike): boolean {
  const dx = Math.abs(item.x - playerBase.x);
  const dy = item.y - playerBase.y;
  const dz = Math.abs(item.z - playerBase.z);
  return dx <= PLAYER_HALF_WIDTH + PICKUP_EXPAND_XZ
    && dz <= PLAYER_HALF_WIDTH + PICKUP_EXPAND_XZ
    && dy >= -PICKUP_EXPAND_Y
    && dy <= PLAYER_HEIGHT + PICKUP_EXPAND_Y;
}

/** ItemEntity merge search inflates its 0.25-wide AABB by 0.5 only in X/Z. */
export function canItemEntityPositionsMerge(a: PositionLike, b: PositionLike): boolean {
  return Math.abs(a.x - b.x) <= ITEM_ENTITY_WIDTH + MERGE_EXPAND_XZ
    && Math.abs(a.y - b.y) <= ITEM_ENTITY_HEIGHT
    && Math.abs(a.z - b.z) <= ITEM_ENTITY_WIDTH + MERGE_EXPAND_XZ;
}

/**
 * Insert a complete modeled ItemStack into ordinary player inventory slots.
 * Existing slots merge only when all stack components match. The incoming stack
 * is never mutated; a deep-cloned remainder is returned when capacity is partial.
 */
export function insertItemStackIntoSlots(
  slots: (ItemStack | null)[],
  incoming: ItemStack,
): InsertItemStackResult {
  const working = cloneItemStack(incoming);
  if (!working || working.count <= 0) return { inserted: 0, remaining: null };

  const requested = working.count;
  const maxStack = ItemRegistry.getMaxStackSize(working.id);

  for (let i = 0; i < slots.length && working.count > 0; i++) {
    const slot = slots[i];
    if (!slot || !itemStacksCanMerge(slot, working) || slot.count >= maxStack) continue;
    const moved = Math.min(working.count, maxStack - slot.count);
    slot.count += moved;
    working.count -= moved;
  }

  for (let i = 0; i < slots.length && working.count > 0; i++) {
    if (slots[i]) continue;
    const moved = Math.min(working.count, maxStack);
    const placed = cloneItemStack(working)!;
    placed.count = moved;
    slots[i] = placed;
    working.count -= moved;
  }

  return {
    inserted: requested - working.count,
    remaining: working.count > 0 ? working : null,
  };
}

/** Transfer as much as possible from donor into receiver without changing stack identity. */
export function mergeItemEntityStacks(receiver: ItemStack, donor: ItemStack): number {
  if (!itemStacksCanMerge(receiver, donor)) return 0;
  const maxStack = ItemRegistry.getMaxStackSize(receiver.id);
  if (receiver.count >= maxStack || donor.count <= 0) return 0;
  const moved = Math.min(donor.count, maxStack - receiver.count);
  receiver.count += moved;
  donor.count -= moved;
  return moved;
}
