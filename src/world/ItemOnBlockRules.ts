const normalize = (name: string) => name.replace(/^minecraft:/, '').toLowerCase();

const SHOVEL_PATH_TARGETS = new Set([
  'grass',
  'grass_block',
  'dirt',
  'coarse_dirt',
  'podzol',
  'mycelium',
  'rooted_dirt',
]);

export const BONE_MEAL_SPREAD_OFFSETS_26_3 = [
  { x: 1, z: 0 },
  { x: -1, z: 0 },
  { x: 0, z: 1 },
  { x: 0, z: -1 },
  { x: 1, z: 1 },
  { x: 1, z: -1 },
  { x: -1, z: 1 },
  { x: -1, z: -1 },
] as const;

export function resolveShovelPathTargetName(blockName: string): 'dirt_path' | null {
  return SHOVEL_PATH_TARGETS.has(normalize(blockName)) ? 'dirt_path' : null;
}

export function resolveAxeStrippedBlockName(blockName: string): string | null {
  const name = normalize(blockName);
  if (name.startsWith('stripped_')) return null;
  if (
    name.endsWith('_log')
    || name.endsWith('_wood')
    || name.endsWith('_stem')
    || name.endsWith('_hyphae')
  ) {
    return `stripped_${name}`;
  }
  return null;
}

export function rotateBoneMealSpreadOffsets26_3(startIndex: number) {
  const start = ((Math.floor(startIndex) % BONE_MEAL_SPREAD_OFFSETS_26_3.length)
    + BONE_MEAL_SPREAD_OFFSETS_26_3.length) % BONE_MEAL_SPREAD_OFFSETS_26_3.length;
  return Array.from(
    { length: BONE_MEAL_SPREAD_OFFSETS_26_3.length },
    (_, index) => BONE_MEAL_SPREAD_OFFSETS_26_3[(start + index) % BONE_MEAL_SPREAD_OFFSETS_26_3.length],
  );
}
