import type { ItemStack } from '../types';
import { ItemRegistry } from './ItemRegistry';

/** Deep-clone every structured field currently carried by the project ItemStack. */
export function cloneItemStack(stack: ItemStack | null | undefined): ItemStack | null {
  if (!stack) return null;
  const clone: ItemStack = { ...stack };
  if (stack.enchantments) clone.enchantments = stack.enchantments.map((entry) => ({ ...entry }));
  if (stack.bundleContents) clone.bundleContents = stack.bundleContents.map((entry) => cloneItemStack(entry)!).filter(Boolean);
  if (stack.potDecorations) {
    clone.potDecorations = {
      back: cloneItemStack(stack.potDecorations.back) ?? undefined,
      left: cloneItemStack(stack.potDecorations.left) ?? undefined,
      right: cloneItemStack(stack.potDecorations.right) ?? undefined,
      front: cloneItemStack(stack.potDecorations.front) ?? undefined,
    };
  }
  if (stack.potion) {
    clone.potion = {
      ...stack.potion,
      effect: stack.potion.effect ? { ...stack.potion.effect } : undefined,
    };
  }
  if (stack.map) {
    clone.map = {
      ...stack.map,
      pixels: [...stack.map.pixels],
      playerMarker: { ...stack.map.playerMarker },
    };
  }
  if (stack.book) clone.book = { ...stack.book, pages: [...stack.book.pages] };
  if (stack.patterns) clone.patterns = stack.patterns.map((pattern) => ({ ...pattern }));
  if (stack.foodEffects) clone.foodEffects = stack.foodEffects.map((effect) => ({ ...effect }));
  return clone;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) sorted[key] = canonicalize(record[key]);
  return sorted;
}

/** Stack identity excludes count but includes every other modeled component. */
export function itemStackIdentity(stack: ItemStack): string {
  const { count: _count, ...identity } = stack;
  return JSON.stringify(canonicalize(identity));
}

/** Java-style stack merging requires the same item and the same stack components. */
export function itemStacksCanMerge(
  a: ItemStack | null | undefined,
  b: ItemStack | null | undefined,
): boolean {
  if (!a || !b || a.id !== b.id) return false;
  return itemStackIdentity(a) === itemStackIdentity(b);
}

/** Effective Java stack size, clamped and forced to one for damageable items. */
export function getItemStackMaxSize(stack: Pick<ItemStack, 'id' | 'durability'>): number {
  const def = ItemRegistry.get(stack.id);
  if (stack.durability !== undefined || def?.durability !== undefined) return 1;
  return Math.max(1, Math.min(64, ItemRegistry.getMaxStackSize(stack.id)));
}

export function isValidItemStack(stack: ItemStack | null | undefined): boolean {
  if (!stack) return false;
  return Number.isInteger(stack.id)
    && stack.id > 0
    && Number.isInteger(stack.count)
    && stack.count > 0
    && stack.count <= getItemStackMaxSize(stack);
}
