import { ItemRegistry } from '../items/ItemRegistry';
import { BlockRegistry } from './BlockRegistry';
import type { ItemStack } from '../types';

export type FurnaceKind = 'furnace' | 'smoker' | 'blast_furnace';
export type FurnaceQuickMoveSource = 'container_input' | 'container_fuel' | 'container_output' | 'player_main' | 'player_hotbar';
export type FurnaceQuickMoveTarget = 'input' | 'fuel' | 'player_inventory' | 'main' | 'hotbar';

const normalizeName = (name: string | undefined) => name?.toLowerCase().replace(/^minecraft:/, '');

export function getFurnaceSemanticName(itemId: number): string | undefined {
  return normalizeName(ItemRegistry.get(itemId)?.name ?? BlockRegistry.get(itemId)?.name);
}

function isFoodItem(itemId: number): boolean {
  return !!ItemRegistry.get(itemId) && ItemRegistry.isFood(itemId);
}

function isSmokerRecipe(inputId: number, outputId: number): boolean {
  const inputName = getFurnaceSemanticName(inputId);
  if (inputName === 'chorus_fruit') return false;
  return inputName === 'kelp' || isFoodItem(inputId) || isFoodItem(outputId);
}

function isBlastFurnaceRecipe(inputId: number): boolean {
  const name = getFurnaceSemanticName(inputId);
  if (!name) return false;
  if (name.includes('_ore') || name.startsWith('raw_')) return true;
  return /^(iron|golden|chainmail)_(sword|pickaxe|axe|shovel|hoe|helmet|chestplate|leggings|boots)$/.test(name);
}

/**
 * Java keeps one general smelting recipe set plus specialist subsets for the
 * smoker and blast furnace. Keeping this policy here prevents UI/runtime drift.
 */
export function isFurnaceRecipeAllowed(
  kind: FurnaceKind | string | undefined,
  inputId: number,
  outputId: number,
): boolean {
  if (kind === 'smoker') return isSmokerRecipe(inputId, outputId);
  if (kind === 'blast_furnace') return isBlastFurnaceRecipe(inputId);
  return true;
}

/** Smokers and blast furnaces process valid recipes at twice furnace speed. */
export function getFurnaceCookSpeed(kind: FurnaceKind | string | undefined): number {
  return kind === 'smoker' || kind === 'blast_furnace' ? 2 : 1;
}

/**
 * Specialist furnaces consume fuel twice as fast so one fuel item still cooks
 * approximately the same number of valid items as a regular furnace.
 */
export function getFurnaceFuelBurnTime(
  kind: FurnaceKind | string | undefined,
  baseBurnTime: number,
): number {
  if (baseBurnTime <= 0) return 0;
  return kind === 'smoker' || kind === 'blast_furnace' ? baseBurnTime / 2 : baseBurnTime;
}

export function canAcceptFurnaceOutput(
  output: ItemStack | null | undefined,
  resultItemId: number,
  resultCount: number,
  maxStackSize: number,
): boolean {
  if (!output) return resultCount <= maxStackSize;
  return output.id === resultItemId && output.count + resultCount <= maxStackSize;
}

/** Return the crafting remainder left when one furnace fuel item is consumed. */
export function getFurnaceFuelRemainder(fuel: ItemStack | null | undefined): ItemStack | undefined {
  if (!fuel) return undefined;
  const name = getFurnaceSemanticName(fuel.id);
  const def = ItemRegistry.get(fuel.id) ?? BlockRegistry.get(fuel.id);
  const legacyBaseId = def && def.baseId >= 256 ? -1 : (fuel.id & 0x3FF);
  if (name !== 'lava_bucket' && legacyBaseId !== 327) return undefined;
  const bucketId = ItemRegistry.getByName('bucket')?.id ?? 325;
  return { id: bucketId, count: 1 };
}

/** Empty bucket in the fuel slot collects the water released by a wet sponge. */
export function getWetSpongeFuelRemainder(
  inputName: string | undefined,
  fuelSlot: ItemStack | null | undefined,
): ItemStack | undefined {
  if (normalizeName(inputName) !== 'wet_sponge') return undefined;
  const bucketId = ItemRegistry.getByName('bucket')?.id ?? 325;
  if (fuelSlot?.id !== bucketId) return undefined;
  const waterBucketId = ItemRegistry.getByName('water_bucket')?.id ?? 326;
  return { id: waterBucketId, count: 1 };
}

/**
 * Vanilla quick-move gives smeltable inputs priority over fuel, then moves
 * unrelated player items between main inventory and hotbar.
 */
export function getFurnaceQuickMoveTarget(
  source: FurnaceQuickMoveSource,
  options: { canSmelt: boolean; isFuel: boolean },
): FurnaceQuickMoveTarget {
  if (source === 'container_input' || source === 'container_fuel' || source === 'container_output') {
    return 'player_inventory';
  }
  if (options.canSmelt) return 'input';
  if (options.isFuel) return 'fuel';
  return source === 'player_main' ? 'hotbar' : 'main';
}
