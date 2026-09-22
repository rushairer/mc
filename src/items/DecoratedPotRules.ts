import type { BlockFacing, BlockMetadata, ItemStack } from '../types';
import { BlockRegistry } from '../world/BlockRegistry';
import { ItemRegistry } from './ItemRegistry';
import { cloneItemStack, getItemStackMaxSize, itemStacksCanMerge } from './ItemStackRules';

export const DECORATED_POT_BLOCK_NAME = 'decorated_pot';
export const BRICK_ITEM_ID = 336;

export type DecoratedPotFace = 'back' | 'left' | 'right' | 'front';

export interface DecoratedPotDecorations {
  back?: ItemStack;
  left?: ItemStack;
  right?: ItemStack;
  front?: ItemStack;
}

export const DECORATED_POT_FACES: readonly DecoratedPotFace[] = ['back', 'left', 'right', 'front'];

export function getDecoratedPotItemId(): number | null {
  return BlockRegistry.getByName(DECORATED_POT_BLOCK_NAME)?.id ?? null;
}

export function isPotterySherdName(name: string | undefined): boolean {
  return !!name && name.endsWith('_pottery_sherd');
}

export function isDecoratedPotIngredient(stack: ItemStack | null | undefined): stack is ItemStack {
  if (!stack || stack.count <= 0) return false;
  const name = ItemRegistry.get(stack.id)?.name;
  return stack.id === BRICK_ITEM_ID || isPotterySherdName(name);
}

export function defaultDecoratedPotDecorations(): DecoratedPotDecorations {
  return {
    back: { id: BRICK_ITEM_ID, count: 1 },
    left: { id: BRICK_ITEM_ID, count: 1 },
    right: { id: BRICK_ITEM_ID, count: 1 },
    front: { id: BRICK_ITEM_ID, count: 1 },
  };
}

function one(stack: ItemStack | null | undefined): ItemStack {
  const cloned = cloneItemStack(stack) ?? { id: BRICK_ITEM_ID, count: 1 };
  cloned.count = 1;
  return cloned;
}

export function normalizeDecoratedPotDecorations(
  decorations: DecoratedPotDecorations | null | undefined,
): DecoratedPotDecorations {
  return {
    back: one(decorations?.back),
    left: one(decorations?.left),
    right: one(decorations?.right),
    front: one(decorations?.front),
  };
}

/**
 * Java crafting_decorated_pot uses the cross-shaped 3x3 grid:
 * north/top = back, west = left, east = right, south/bottom = front.
 */
export function craftDecoratedPot(grid: Array<ItemStack | null | undefined>): ItemStack | null {
  if (grid.length < 9) return null;
  const active = grid
    .map((stack, index) => ({ stack, index }))
    .filter((entry) => !!entry.stack && entry.stack.count > 0);
  const expected = [1, 3, 5, 7];
  if (active.length !== 4 || active.some((entry) => !expected.includes(entry.index))) return null;

  const back = grid[1];
  const left = grid[3];
  const right = grid[5];
  const front = grid[7];
  if (![back, left, right, front].every(isDecoratedPotIngredient)) return null;

  const resultId = getDecoratedPotItemId();
  if (!resultId) return null;
  return {
    id: resultId,
    count: 1,
    potDecorations: normalizeDecoratedPotDecorations({
      back: back!,
      left: left!,
      right: right!,
      front: front!,
    }),
  };
}

export function decoratedPotDecorationStacks(
  decorations: DecoratedPotDecorations | null | undefined,
): ItemStack[] {
  const normalized = normalizeDecoratedPotDecorations(decorations);
  return DECORATED_POT_FACES.map((face) => cloneItemStack(normalized[face])!).filter(Boolean);
}

export function createDecoratedPotMetadata(
  stack: ItemStack | null | undefined,
  facing: BlockFacing = 'north',
): BlockMetadata {
  return {
    facing,
    containerType: 'decorated_pot',
    inventory: [null],
    potDecorations: normalizeDecoratedPotDecorations(stack?.potDecorations),
  };
}

export function decoratedPotItemFromMetadata(meta: BlockMetadata | null | undefined): ItemStack | null {
  const id = getDecoratedPotItemId();
  if (!id) return null;
  return {
    id,
    count: 1,
    potDecorations: normalizeDecoratedPotDecorations(meta?.potDecorations),
  };
}

export function isDecoratedPotBreakingTool(stack: ItemStack | null | undefined): boolean {
  if (!stack) return false;
  const name = ItemRegistry.get(stack.id)?.name ?? '';
  return name === 'trident'
    || name === 'mace'
    || name.endsWith('_sword')
    || name.endsWith('_axe')
    || name.endsWith('_pickaxe')
    || name.endsWith('_shovel')
    || name.endsWith('_hoe')
    || name.endsWith('_spear');
}

export interface DecoratedPotInsertResult {
  metadata: BlockMetadata;
  held: ItemStack | null;
  inserted: number;
}

export function insertOneIntoDecoratedPot(
  meta: BlockMetadata | null | undefined,
  held: ItemStack | null | undefined,
  creative = false,
): DecoratedPotInsertResult {
  const currentMeta: BlockMetadata = {
    ...(meta ?? {}),
    containerType: 'decorated_pot',
    inventory: Array.isArray(meta?.inventory) && meta!.inventory!.length > 0
      ? meta!.inventory!.map((entry) => cloneItemStack(entry))
      : [null],
    potDecorations: normalizeDecoratedPotDecorations(meta?.potDecorations),
  };
  currentMeta.inventory = [currentMeta.inventory?.[0] ?? null];

  if (!held || held.count <= 0) {
    return { metadata: currentMeta, held: cloneItemStack(held), inserted: 0 };
  }

  const existing = currentMeta.inventory[0];
  const maxStack = getItemStackMaxSize(held);
  if (existing && (!itemStacksCanMerge(existing, held) || existing.count >= maxStack)) {
    return { metadata: currentMeta, held: cloneItemStack(held), inserted: 0 };
  }

  if (existing) {
    existing.count += 1;
  } else {
    const inserted = cloneItemStack(held)!;
    inserted.count = 1;
    currentMeta.inventory[0] = inserted;
  }

  const nextHeld = cloneItemStack(held)!;
  if (!creative) nextHeld.count -= 1;
  return {
    metadata: currentMeta,
    held: creative ? nextHeld : nextHeld.count > 0 ? nextHeld : null,
    inserted: 1,
  };
}

export function decoratedPotBreakDrops(
  meta: BlockMetadata | null | undefined,
  tool: ItemStack | null | undefined,
  silkTouch = false,
  forcedShatter = false,
): ItemStack[] {
  if (forcedShatter || (isDecoratedPotBreakingTool(tool) && !silkTouch)) {
    return decoratedPotDecorationStacks(meta?.potDecorations);
  }
  const intact = decoratedPotItemFromMetadata(meta);
  return intact ? [intact] : [];
}

export function decoratedPotComparatorSignal(meta: BlockMetadata | null | undefined): number {
  const stack = meta?.inventory?.[0];
  if (!stack || stack.count <= 0) return 0;
  const maxStack = getItemStackMaxSize(stack);
  return Math.max(1, Math.min(15, Math.floor(1 + 14 * stack.count / Math.max(1, maxStack))));
}
