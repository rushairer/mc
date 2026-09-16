import type { ItemStack } from '../types';

export type FurnaceKind = 'furnace' | 'smoker' | 'blast_furnace';

/** Smokers and blast furnaces process valid recipes at twice furnace speed. */
export function getFurnaceCookSpeed(kind: FurnaceKind | string | undefined): number {
  return kind === 'smoker' || kind === 'blast_furnace' ? 2 : 1;
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

/** Empty bucket in the fuel slot collects the water released by a wet sponge. */
export function getWetSpongeFuelRemainder(
  inputName: string | undefined,
  fuelSlot: ItemStack | null | undefined,
): ItemStack | undefined {
  if (inputName !== 'wet_sponge' || fuelSlot?.id !== 325) return undefined;
  return { id: 326, count: 1 };
}
