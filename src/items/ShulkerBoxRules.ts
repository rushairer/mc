import type { BlockFacing, BlockMetadata, ItemStack } from '../types';
import { ItemRegistry } from './ItemRegistry';
import { cloneItemStack } from './ItemStackRules';

export const SHULKER_BOX_SLOT_COUNT = 27;

export function isShulkerBoxName(name: string | null | undefined): boolean {
  return name === 'shulker_box' || !!name?.endsWith('_shulker_box');
}

export function isShulkerBoxStack(stack: ItemStack | null | undefined): stack is ItemStack {
  return !!stack && isShulkerBoxName(ItemRegistry.get(stack.id)?.name);
}

export function canStoreInShulkerBox(stack: ItemStack | null | undefined): boolean {
  return !!stack && !isShulkerBoxStack(stack);
}

export function normalizeShulkerBoxContents(contents: readonly (ItemStack | null | undefined)[] | null | undefined): (ItemStack | null)[] {
  return Array.from({ length: SHULKER_BOX_SLOT_COUNT }, (_, index) => cloneItemStack(contents?.[index]));
}

export function createShulkerBoxMetadata(stack?: ItemStack | null, facing: BlockFacing = 'up'): BlockMetadata {
  return { facing, containerType: 'shulker_box', inventory: normalizeShulkerBoxContents(stack?.shulkerBoxContents) };
}

export function createShulkerBoxDropStack(blockId: number, metadata?: BlockMetadata | null): ItemStack {
  const itemId = ItemRegistry.getItemIdForPlacedBlock(blockId) ?? blockId;
  const result: ItemStack = { id: itemId, count: 1 };
  const contents = normalizeShulkerBoxContents(metadata?.inventory);
  if (contents.some(Boolean)) result.shulkerBoxContents = contents;
  return result;
}

export function shulkerBoxOpeningOffset(facing: BlockFacing | undefined): { x: number; y: number; z: number } {
  switch (facing ?? 'up') {
    case 'down': return { x: 0, y: -1, z: 0 };
    case 'north': return { x: 0, y: 0, z: -1 };
    case 'south': return { x: 0, y: 0, z: 1 };
    case 'east': return { x: 1, y: 0, z: 0 };
    case 'west': return { x: -1, y: 0, z: 0 };
    default: return { x: 0, y: 1, z: 0 };
  }
}
