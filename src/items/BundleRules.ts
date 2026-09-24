import type { ItemStack } from '../types';
import { cloneItemStack, getItemStackMaxSize, itemStacksCanMerge } from './ItemStackRules';
import { isShulkerBoxStack } from './ShulkerBoxRules';
export { isShulkerBoxStack } from './ShulkerBoxRules';

export const BUNDLE_CAPACITY = 64;
export const BUNDLE_NESTED_BASE_WEIGHT = 4;
export const BUNDLE_TOOLTIP_MAX_VISIBLE_TYPES = 12;

export function isBundleItemName(name: string | undefined): boolean {
  return name === 'bundle' || !!name?.endsWith('_bundle');
}

export function isBundleStack(stack: ItemStack | null | undefined): stack is ItemStack {
  return !!stack && isBundleItemName(ItemRegistry.get(stack.id)?.name);
}


export function bundleUnitWeight(stack: ItemStack): number {
  if (isBundleStack(stack)) {
    return BUNDLE_NESTED_BASE_WEIGHT + bundleUsedCapacity(stack);
  }
  const maxStack = getItemStackMaxSize(stack);
  return Math.max(1, Math.ceil(BUNDLE_CAPACITY / Math.max(1, maxStack)));
}

export function bundleUsedCapacity(bundle: ItemStack | null | undefined): number {
  if (!isBundleStack(bundle)) return 0;
  let used = 0;
  for (const stack of bundle.bundleContents ?? []) {
    used += bundleUnitWeight(stack) * Math.max(0, Math.floor(stack.count));
    if (used >= BUNDLE_CAPACITY) return BUNDLE_CAPACITY;
  }
  return Math.min(BUNDLE_CAPACITY, used);
}

export function bundleRemainingCapacity(bundle: ItemStack | null | undefined): number {
  return Math.max(0, BUNDLE_CAPACITY - bundleUsedCapacity(bundle));
}

export function bundleCanAccept(
  bundle: ItemStack | null | undefined,
  incoming: ItemStack | null | undefined,
): boolean {
  if (!isBundleStack(bundle) || !incoming || incoming.count <= 0 || isShulkerBoxStack(incoming)) return false;
  const unitWeight = bundleUnitWeight(incoming);
  return unitWeight > 0 && unitWeight <= bundleRemainingCapacity(bundle);
}

export interface BundleInsertResult {
  bundle: ItemStack;
  remaining: ItemStack | null;
  insertedCount: number;
}

export function insertIntoBundle(bundle: ItemStack, incoming: ItemStack): BundleInsertResult {
  const nextBundle = cloneItemStack(bundle)!;
  const remaining = cloneItemStack(incoming)!;
  nextBundle.bundleContents = (nextBundle.bundleContents ?? []).map((entry) => cloneItemStack(entry)!);

  if (!bundleCanAccept(nextBundle, remaining)) {
    return { bundle: nextBundle, remaining, insertedCount: 0 };
  }

  const weight = bundleUnitWeight(remaining);
  const capacity = bundleRemainingCapacity(nextBundle);
  const insertCount = Math.max(0, Math.min(remaining.count, Math.floor(capacity / weight)));
  if (insertCount <= 0) return { bundle: nextBundle, remaining, insertedCount: 0 };

  const stored = cloneItemStack(remaining)!;
  stored.count = insertCount;
  const mergeIndex = nextBundle.bundleContents.findIndex((entry) =>
    itemStacksCanMerge(entry, stored) && entry.count < getItemStackMaxSize(entry)
  );
  if (mergeIndex >= 0) {
    const current = nextBundle.bundleContents[mergeIndex];
    const maxStack = getItemStackMaxSize(current);
    const mergeCount = Math.min(insertCount, maxStack - current.count);
    current.count += mergeCount;
    const [merged] = nextBundle.bundleContents.splice(mergeIndex, 1);
    nextBundle.bundleContents.unshift(merged);
    if (mergeCount < insertCount) {
      const overflow = cloneItemStack(stored)!;
      overflow.count = insertCount - mergeCount;
      nextBundle.bundleContents.unshift(overflow);
    }
  } else {
    nextBundle.bundleContents.unshift(stored);
  }

  remaining.count -= insertCount;
  return {
    bundle: nextBundle,
    remaining: remaining.count > 0 ? remaining : null,
    insertedCount: insertCount,
  };
}

export interface BundleRemoveResult {
  bundle: ItemStack;
  removed: ItemStack | null;
}

export function removeOneFromBundle(bundle: ItemStack, selectedIndex = 0): BundleRemoveResult {
  const nextBundle = cloneItemStack(bundle)!;
  const contents = (nextBundle.bundleContents ?? []).map((entry) => cloneItemStack(entry)!);
  nextBundle.bundleContents = contents;
  if (contents.length === 0) return { bundle: nextBundle, removed: null };

  const index = Math.max(0, Math.min(contents.length - 1, Math.floor(selectedIndex)));
  const selected = contents[index];
  const removed = cloneItemStack(selected)!;
  removed.count = 1;
  selected.count -= 1;
  if (selected.count <= 0) contents.splice(index, 1);
  else {
    contents.splice(index, 1);
    contents.unshift(selected);
  }
  return { bundle: nextBundle, removed };
}

export function visibleBundleContents(bundle: ItemStack | null | undefined): ItemStack[] {
  if (!isBundleStack(bundle)) return [];
  return (bundle.bundleContents ?? [])
    .slice(0, BUNDLE_TOOLTIP_MAX_VISIBLE_TYPES)
    .map((entry) => cloneItemStack(entry)!);
}

export function bundleFullnessFraction(bundle: ItemStack | null | undefined): number {
  return Math.max(0, Math.min(1, bundleUsedCapacity(bundle) / BUNDLE_CAPACITY));
}
