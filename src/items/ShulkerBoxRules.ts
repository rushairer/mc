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

const SHULKER_DYE_COLORS: Record<string, string> = {
  black_dye: 'black', ink_sac: 'black',
  blue_dye: 'blue', lapis_lazuli: 'blue',
  brown_dye: 'brown', cocoa_beans: 'brown',
  cyan_dye: 'cyan',
  gray_dye: 'gray',
  green_dye: 'green', cactus_green: 'green',
  light_blue_dye: 'light_blue',
  light_gray_dye: 'light_gray',
  lime_dye: 'lime',
  magenta_dye: 'magenta',
  orange_dye: 'orange',
  pink_dye: 'pink',
  purple_dye: 'purple',
  red_dye: 'red', rose_red: 'red',
  white_dye: 'white', bone_meal: 'white',
  yellow_dye: 'yellow', dandelion_yellow: 'yellow',
};

export function shulkerBoxDyeColor(stack: ItemStack | null | undefined): string | null {
  if (!stack) return null;
  const name = ItemRegistry.get(stack.id)?.name;
  return name ? (SHULKER_DYE_COLORS[name] ?? null) : null;
}

/**
 * Java Shulker Box crafting:
 * - shell / chest / shell in one vertical column -> one undyed Shulker Box
 * - any Shulker Box + one dye, shapeless -> the matching colored box
 *   while preserving the box's full item components.
 */
export function craftShulkerBox(grid: readonly (ItemStack | null | undefined)[]): ItemStack | null {
  const cells = Array.from({ length: 9 }, (_, index) => grid[index] ?? null);
  const active = cells
    .map((stack, index) => ({ stack, index }))
    .filter((entry): entry is { stack: ItemStack; index: number } => !!entry.stack);

  if (active.length === 2) {
    const box = active.find(({ stack }) => isShulkerBoxStack(stack))?.stack;
    const dye = active.find(({ stack }) => shulkerBoxDyeColor(stack) !== null)?.stack;
    if (box && dye) {
      const color = shulkerBoxDyeColor(dye);
      const target = color ? ItemRegistry.getByName(`${color}_shulker_box`) : undefined;
      if (!target) return null;
      const result = cloneItemStack(box)!;
      result.id = target.id;
      result.count = 1;
      return result;
    }
  }

  if (active.length !== 3) return null;
  const [top, middle, bottom] = active.sort((a, b) => a.index - b.index);
  const topRow = Math.floor(top.index / 3);
  const midRow = Math.floor(middle.index / 3);
  const bottomRow = Math.floor(bottom.index / 3);
  const col = top.index % 3;
  if (topRow !== 0 || midRow !== 1 || bottomRow !== 2) return null;
  if ((middle.index % 3) !== col || (bottom.index % 3) !== col) return null;

  const topName = ItemRegistry.get(top.stack.id)?.name;
  const middleName = ItemRegistry.get(middle.stack.id)?.name;
  const bottomName = ItemRegistry.get(bottom.stack.id)?.name;
  if (topName !== 'shulker_shell' || middleName !== 'chest' || bottomName !== 'shulker_shell') return null;

  const result = ItemRegistry.getByName('shulker_box');
  return result ? { id: result.id, count: 1 } : null;
}
