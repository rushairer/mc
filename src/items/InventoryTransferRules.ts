import type { ItemStack } from '../types';
import { cloneItemStack, getItemStackMaxSize, itemStacksCanMerge } from './ItemStackRules';

export interface StackTransferResult {
  moved: number;
  sourceRemaining: number;
}

function validDestinationIndices(slots: (ItemStack | null)[], indices: number[], sourceIndex: number): number[] {
  return indices.filter((index) => Number.isInteger(index) && index >= 0 && index < slots.length && index !== sourceIndex);
}

/** Move one source stack into a destination range, merging before opening empty slots. */
export function moveStackToIndices(
  slots: (ItemStack | null)[],
  sourceIndex: number,
  destinationIndices: number[],
): StackTransferResult {
  if (!Number.isInteger(sourceIndex) || sourceIndex < 0 || sourceIndex >= slots.length) {
    return { moved: 0, sourceRemaining: 0 };
  }
  const source = slots[sourceIndex];
  if (!source || source.count <= 0) return { moved: 0, sourceRemaining: 0 };

  const destinations = validDestinationIndices(slots, destinationIndices, sourceIndex);
  const originalCount = source.count;
  const maxStack = getItemStackMaxSize(source);

  for (const index of destinations) {
    if (source.count <= 0) break;
    const target = slots[index];
    if (!target || !itemStacksCanMerge(target, source)) continue;
    const targetMax = getItemStackMaxSize(target);
    if (target.count >= targetMax) continue;
    const moved = Math.min(source.count, targetMax - target.count);
    target.count += moved;
    source.count -= moved;
  }

  for (const index of destinations) {
    if (source.count <= 0) break;
    if (slots[index]) continue;
    const moved = Math.min(source.count, maxStack);
    const placed = cloneItemStack(source)!;
    placed.count = moved;
    slots[index] = placed;
    source.count -= moved;
  }

  if (source.count <= 0) slots[sourceIndex] = null;
  return { moved: originalCount - Math.max(0, source.count), sourceRemaining: Math.max(0, source.count) };
}

/** Java player inventory quick-move: hotbar <-> main inventory. */
export function quickMovePlayerInventory(slots: (ItemStack | null)[], sourceIndex: number): number {
  if (sourceIndex < 0 || sourceIndex >= 36) return 0;
  const destinationIndices = sourceIndex < 9
    ? Array.from({ length: 27 }, (_, i) => i + 9)
    : Array.from({ length: 9 }, (_, i) => i);
  return moveStackToIndices(slots, sourceIndex, destinationIndices).moved;
}

export interface RightClickStackResult {
  slot: ItemStack | null;
  cursor: ItemStack | null;
  moved: number;
}

/** Place one item from the cursor into an empty or compatible slot. */
export function placeOneFromCursor(
  slot: ItemStack | null,
  cursor: ItemStack | null,
): RightClickStackResult {
  const nextSlot = cloneItemStack(slot);
  const nextCursor = cloneItemStack(cursor);
  if (!nextCursor || nextCursor.count <= 0) return { slot: nextSlot, cursor: null, moved: 0 };

  if (!nextSlot) {
    const placed = cloneItemStack(nextCursor)!;
    placed.count = 1;
    nextCursor.count -= 1;
    return { slot: placed, cursor: nextCursor.count > 0 ? nextCursor : null, moved: 1 };
  }

  if (!itemStacksCanMerge(nextSlot, nextCursor)) {
    return { slot: nextSlot, cursor: nextCursor, moved: 0 };
  }
  const maxStack = getItemStackMaxSize(nextSlot);
  if (nextSlot.count >= maxStack) return { slot: nextSlot, cursor: nextCursor, moved: 0 };
  nextSlot.count += 1;
  nextCursor.count -= 1;
  return { slot: nextSlot, cursor: nextCursor.count > 0 ? nextCursor : null, moved: 1 };
}
