export type FurnaceKind = 'furnace' | 'smoker' | 'blast_furnace';

/** Smokers and blast furnaces process valid recipes at twice furnace speed. */
export function getFurnaceCookSpeed(kind: FurnaceKind | string | undefined): number {
  return kind === 'smoker' || kind === 'blast_furnace' ? 2 : 1;
}
