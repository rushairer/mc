import type { BlockFacing, ItemStack } from '../types';
import {
  cloneItemStack,
  getItemStackMaxSize,
  itemStacksCanMerge,
} from './ItemStackRules';
import { isShulkerBoxStack } from './ShulkerBoxRules';

export type DispenserLikeKind = 'dispenser' | 'dropper';

export interface DispenserActivationResult {
  action: 'empty' | 'insert' | 'eject';
  sourceSlots: (ItemStack | null)[];
  targetSlots?: (ItemStack | null)[];
  stack?: ItemStack;
  sourceSlot?: number;
}

/** Vanilla-style uniform choice among non-empty slots. */
export function selectDispenserSlot(
  slots: readonly (ItemStack | null)[],
  random: () => number = Math.random,
): number {
  const candidates: number[] = [];
  for (let i = 0; i < slots.length; i++) {
    if (slots[i] && slots[i]!.count > 0) candidates.push(i);
  }
  if (candidates.length === 0) return -1;
  const roll = Math.min(0.999999999999, Math.max(0, random()));
  return candidates[Math.floor(roll * candidates.length)];
}

export function dispenserFacingOffset(facing: BlockFacing | undefined): { x: number; y: number; z: number } {
  switch (facing) {
    case 'up': return { x: 0, y: 1, z: 0 };
    case 'down': return { x: 0, y: -1, z: 0 };
    case 'south': return { x: 0, y: 0, z: 1 };
    case 'east': return { x: 1, y: 0, z: 0 };
    case 'west': return { x: -1, y: 0, z: 0 };
    case 'north':
    default: return { x: 0, y: 0, z: -1 };
  }
}

function oneItem(stack: ItemStack): ItemStack {
  const result = cloneItemStack(stack)!;
  result.count = 1;
  return result;
}

/**
 * Try inserting exactly one item into an adjacent container. This is the
 * Dropper-only transfer path; Dispensers never use it.
 */
export function insertOneFromDropper(
  targetSlots: readonly (ItemStack | null)[],
  stack: ItemStack,
  targetContainerType?: string,
): { slots: (ItemStack | null)[]; inserted: boolean } {
  const next = targetSlots.map((slot) => cloneItemStack(slot));
  if (targetContainerType === 'shulker_box' && isShulkerBoxStack(stack)) {
    return { slots: next, inserted: false };
  }

  for (let i = 0; i < next.length; i++) {
    const target = next[i];
    if (!target || !itemStacksCanMerge(target, stack)) continue;
    const max = getItemStackMaxSize(target);
    if (target.count >= max) continue;
    next[i] = { ...target, count: target.count + 1 };
    return { slots: next, inserted: true };
  }

  for (let i = 0; i < next.length; i++) {
    if (next[i]) continue;
    next[i] = oneItem(stack);
    return { slots: next, inserted: true };
  }

  return { slots: next, inserted: false };
}

/**
 * One redstone activation consumes at most one item. Droppers prefer inserting
 * into the container directly in front; otherwise both blocks emit one item.
 *
 * Special Dispenser item behaviors (arrows, buckets, TNT, armor...) can layer
 * on top of the 'eject' action without changing slot-selection semantics.
 */
export function activateDispenserLike(
  kind: DispenserLikeKind,
  sourceSlots: readonly (ItemStack | null)[],
  options: {
    targetSlots?: readonly (ItemStack | null)[];
    targetContainerType?: string;
    random?: () => number;
  } = {},
): DispenserActivationResult {
  const source = sourceSlots.map((slot) => cloneItemStack(slot));
  const sourceSlot = selectDispenserSlot(source, options.random ?? Math.random);
  if (sourceSlot < 0) return { action: 'empty', sourceSlots: source };

  const selected = source[sourceSlot]!;
  const emitted = oneItem(selected);

  if (kind === 'dropper' && options.targetSlots) {
    const inserted = insertOneFromDropper(options.targetSlots, emitted, options.targetContainerType);
    if (inserted.inserted) {
      selected.count -= 1;
      source[sourceSlot] = selected.count > 0 ? selected : null;
      return {
        action: 'insert',
        sourceSlots: source,
        targetSlots: inserted.slots,
        stack: emitted,
        sourceSlot,
      };
    }
  }

  selected.count -= 1;
  source[sourceSlot] = selected.count > 0 ? selected : null;
  return {
    action: 'eject',
    sourceSlots: source,
    targetSlots: options.targetSlots?.map((slot) => cloneItemStack(slot)),
    stack: emitted,
    sourceSlot,
  };
}
