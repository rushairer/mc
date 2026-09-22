import type { BlockFacing, BlockMetadata, ItemStack } from '../types';
import { BlockRegistry } from '../world/BlockRegistry';
import { ItemRegistry } from './ItemRegistry';
import { cloneItemStack } from './ItemStackRules';

export const CHISELED_BOOKSHELF_BLOCK_NAME = 'chiseled_bookshelf';
export const CHISELED_BOOKSHELF_SLOT_COUNT = 6;

const BOOK_NAMES = new Set([
  'book',
  'writable_book',
  'written_book',
  'enchanted_book',
  'knowledge_book',
]);

const WOOD_PREFIXES = [
  'oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak',
  'mangrove', 'cherry', 'bamboo', 'crimson', 'warped', 'poplar',
] as const;

export interface WorldHitPoint {
  x: number;
  y: number;
  z: number;
}

export interface ChiseledBookshelfInteractionResult {
  metadata: BlockMetadata;
  held: ItemStack | null;
  removed: ItemStack | null;
  changed: boolean;
  slot: number;
}

export function getChiseledBookshelfItemId(): number | null {
  return BlockRegistry.getByName(CHISELED_BOOKSHELF_BLOCK_NAME)?.id ?? null;
}

export function isChiseledBookshelfBook(stack: ItemStack | null | undefined): stack is ItemStack {
  if (!stack || stack.count <= 0) return false;
  return BOOK_NAMES.has(ItemRegistry.get(stack.id)?.name ?? '');
}

export function isWoodenPlankName(name: string | undefined): boolean {
  if (!name) return false;
  if (name === 'planks' || name === 'wooden_planks') return true;
  return WOOD_PREFIXES.some((prefix) => name === `${prefix}_planks`);
}

export function isWoodenSlabName(name: string | undefined): boolean {
  if (!name) return false;
  if (name === 'wooden_slab' || name === 'wood_slab') return true;
  return WOOD_PREFIXES.some((prefix) => name === `${prefix}_slab`);
}

export function craftChiseledBookshelf(
  grid: Array<ItemStack | null | undefined>,
): ItemStack | null {
  if (grid.length < 9) return null;
  for (let index = 0; index < 9; index++) {
    const stack = grid[index];
    if (!stack || stack.count <= 0) return null;
    const name = ItemRegistry.get(stack.id)?.name;
    const middle = index >= 3 && index <= 5;
    if (middle ? !isWoodenSlabName(name) : !isWoodenPlankName(name)) return null;
  }
  const id = getChiseledBookshelfItemId();
  return id ? { id, count: 1 } : null;
}

export function oppositeHorizontalFacing(facing: BlockFacing): BlockFacing {
  switch (facing) {
    case 'north': return 'south';
    case 'south': return 'north';
    case 'east': return 'west';
    case 'west': return 'east';
    default: return 'north';
  }
}

export function createChiseledBookshelfMetadata(
  facing: BlockFacing = 'north',
  inventory?: Array<ItemStack | null | undefined>,
): BlockMetadata {
  return {
    facing,
    containerType: 'chiseled_bookshelf',
    inventory: Array.from({ length: CHISELED_BOOKSHELF_SLOT_COUNT }, (_, index) => {
      const stack = cloneItemStack(inventory?.[index]);
      if (!stack) return null;
      stack.count = 1;
      return stack;
    }),
  };
}

function normalizedLocal(value: number, base: number): number | null {
  const local = value - base;
  if (!Number.isFinite(local) || local < -1e-4 || local > 1.0001) return null;
  return Math.max(0, Math.min(0.999999, local));
}

/**
 * Resolves Java's visible 3x2 slot grid. The block's facing is its front;
 * clicking any other face is not a book-slot interaction.
 */
export function resolveChiseledBookshelfSlot(
  block: { x: number; y: number; z: number },
  facing: BlockFacing | undefined,
  clickedFace: BlockFacing | undefined,
  hit: WorldHitPoint | undefined,
): number | null {
  if (!hit || !facing || clickedFace !== facing) return null;
  if (facing === 'up' || facing === 'down') return null;

  const localX = normalizedLocal(hit.x, block.x);
  const localY = normalizedLocal(hit.y, block.y);
  const localZ = normalizedLocal(hit.z, block.z);
  if (localX === null || localY === null || localZ === null) return null;

  let horizontal: number;
  switch (facing) {
    case 'south': horizontal = localX; break;
    case 'north': horizontal = 1 - localX; break;
    case 'west': horizontal = localZ; break;
    case 'east': horizontal = 1 - localZ; break;
    default: return null;
  }

  const column = Math.max(0, Math.min(2, Math.floor(horizontal * 3)));
  const row = localY >= 0.5 ? 0 : 1;
  return row * 3 + column;
}

export function chiseledBookshelfOccupancyMask(meta: BlockMetadata | null | undefined): number {
  let mask = 0;
  for (let slot = 0; slot < CHISELED_BOOKSHELF_SLOT_COUNT; slot++) {
    if (meta?.inventory?.[slot]) mask |= 1 << slot;
  }
  return mask;
}

export function chiseledBookshelfComparatorSignal(meta: BlockMetadata | null | undefined): number {
  const slot = meta?.chiseledBookshelfLastInteractedSlot;
  return Number.isInteger(slot) && slot! >= 0 && slot! < CHISELED_BOOKSHELF_SLOT_COUNT
    ? slot! + 1
    : 0;
}

export function interactChiseledBookshelfSlot(
  meta: BlockMetadata | null | undefined,
  slot: number,
  held: ItemStack | null | undefined,
  creative = false,
): ChiseledBookshelfInteractionResult {
  const normalizedSlot = Math.floor(slot);
  const current = createChiseledBookshelfMetadata(
    meta?.facing ?? 'north',
    meta?.inventory,
  );
  current.chiseledBookshelfLastInteractedSlot = meta?.chiseledBookshelfLastInteractedSlot;

  if (normalizedSlot < 0 || normalizedSlot >= CHISELED_BOOKSHELF_SLOT_COUNT) {
    return {
      metadata: current,
      held: cloneItemStack(held),
      removed: null,
      changed: false,
      slot: normalizedSlot,
    };
  }

  const existing = current.inventory?.[normalizedSlot] ?? null;
  if (existing) {
    current.inventory![normalizedSlot] = null;
    current.chiseledBookshelfLastInteractedSlot = normalizedSlot;
    return {
      metadata: current,
      held: cloneItemStack(held),
      removed: cloneItemStack(existing),
      changed: true,
      slot: normalizedSlot,
    };
  }

  if (!isChiseledBookshelfBook(held)) {
    return {
      metadata: current,
      held: cloneItemStack(held),
      removed: null,
      changed: false,
      slot: normalizedSlot,
    };
  }

  const stored = cloneItemStack(held)!;
  stored.count = 1;
  current.inventory![normalizedSlot] = stored;
  current.chiseledBookshelfLastInteractedSlot = normalizedSlot;

  const nextHeld = cloneItemStack(held)!;
  if (!creative) nextHeld.count -= 1;
  return {
    metadata: current,
    held: creative ? nextHeld : nextHeld.count > 0 ? nextHeld : null,
    removed: null,
    changed: true,
    slot: normalizedSlot,
  };
}

export function firstChiseledBookshelfInsertionSlot(
  meta: BlockMetadata | null | undefined,
  item: ItemStack,
): number | null {
  if (!isChiseledBookshelfBook(item)) return null;
  for (let slot = 0; slot < CHISELED_BOOKSHELF_SLOT_COUNT; slot++) {
    if (!meta?.inventory?.[slot]) return slot;
  }
  return null;
}

export function firstChiseledBookshelfExtractionSlot(
  meta: BlockMetadata | null | undefined,
): number | null {
  for (let slot = 0; slot < CHISELED_BOOKSHELF_SLOT_COUNT; slot++) {
    if (meta?.inventory?.[slot]) return slot;
  }
  return null;
}
