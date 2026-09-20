import type { DataPackBlock, DataPackItem } from '../systems/DataPackTypes';
import type { RawRecipe } from '../items/CraftingRecipes';

export const WILDERNESS_BOUND_VERSION = '26.3';

export const DYE_COLORS = [
  'white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray',
  'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black',
] as const;

export type DyeColor = typeof DYE_COLORS[number];
export type PoplarLeafColor = 'red' | 'orange' | 'yellow';
export type ShelfMushroomSize = 'small' | 'large';

const BLOCK_ID_START = 52000;
const CUSHION_ID_START = 54000;
const EXPLORER_MAP_ID_START = 54100;

const blocks: DataPackBlock[] = [];
let nextBlockId = BLOCK_ID_START;

function addBlock(
  name: string,
  options: Partial<DataPackBlock> = {},
): DataPackBlock {
  const block: DataPackBlock = {
    id: nextBlockId++,
    officialId: `minecraft:${name}`,
    name,
    displayName: options.displayName ?? name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    textureKey: options.textureKey ?? name,
    transparent: options.transparent ?? false,
    solid: options.solid ?? true,
    hardness: options.hardness ?? 1,
    luminance: options.luminance ?? 0,
    ...options,
  };
  blocks.push(block);
  return block;
}

const POPLAR_LOG = addBlock('poplar_log', {
  textureKey: 'poplar_log_side', textureTop: 'poplar_log_top', textureBottom: 'poplar_log_top',
  hardness: 2, toolCategory: 'axe',
});
const STRIPPED_POPLAR_LOG = addBlock('stripped_poplar_log', {
  textureKey: 'stripped_poplar_log_side', textureTop: 'stripped_poplar_log_top', textureBottom: 'stripped_poplar_log_top',
  hardness: 2, toolCategory: 'axe',
});
const POPLAR_WOOD = addBlock('poplar_wood', { textureKey: 'poplar_log_side', hardness: 2, toolCategory: 'axe' });
const STRIPPED_POPLAR_WOOD = addBlock('stripped_poplar_wood', { textureKey: 'stripped_poplar_log_side', hardness: 2, toolCategory: 'axe' });
const POPLAR_PLANKS = addBlock('poplar_planks', { hardness: 2, toolCategory: 'axe' });
const POPLAR_SAPLING = addBlock('poplar_sapling', { transparent: true, solid: false, hardness: 0, toolCategory: undefined });

export const POPLAR_LEAF_BLOCKS: Record<PoplarLeafColor, DataPackBlock> = {
  red: addBlock('red_poplar_leaves', { transparent: true, hardness: 0.2 }),
  orange: addBlock('orange_poplar_leaves', { transparent: true, hardness: 0.2 }),
  yellow: addBlock('yellow_poplar_leaves', { transparent: true, hardness: 0.2 }),
};

const POPLAR_STAIRS = addBlock('poplar_stairs', { textureKey: 'poplar_planks', hardness: 2, toolCategory: 'axe' });
const POPLAR_SLAB = addBlock('poplar_slab', { textureKey: 'poplar_planks', hardness: 2, toolCategory: 'axe' });
addBlock('poplar_fence', { textureKey: 'poplar_planks', hardness: 2, toolCategory: 'axe' });
addBlock('poplar_fence_gate', { textureKey: 'poplar_planks', hardness: 2, toolCategory: 'axe' });
addBlock('poplar_door', { textureKey: 'poplar_door', transparent: true, hardness: 3, toolCategory: 'axe' });
addBlock('poplar_trapdoor', { textureKey: 'poplar_trapdoor', transparent: true, hardness: 3, toolCategory: 'axe' });
addBlock('poplar_pressure_plate', { textureKey: 'poplar_planks', hardness: 0.5, toolCategory: 'axe' });
addBlock('poplar_button', { textureKey: 'poplar_planks', transparent: true, hardness: 0.5, toolCategory: 'axe' });
const POPLAR_SIGN = addBlock('poplar_sign', { textureKey: 'poplar_planks', transparent: true, solid: false, hardness: 1, toolCategory: 'axe' });
addBlock('poplar_wall_sign', { textureKey: 'poplar_planks', transparent: true, solid: false, hardness: 1, toolCategory: 'axe' });
const POPLAR_HANGING_SIGN = addBlock('poplar_hanging_sign', { textureKey: 'poplar_planks', transparent: true, solid: false, hardness: 1, toolCategory: 'axe' });
addBlock('poplar_wall_hanging_sign', { textureKey: 'poplar_planks', transparent: true, solid: false, hardness: 1, toolCategory: 'axe' });

export const SHELF_MUSHROOM_BLOCK = addBlock('shelf_mushroom', {
  transparent: true, solid: false, hardness: 0,
});
export const RED_SHRUB_BLOCK = addBlock('red_shrub', {
  transparent: true, solid: false, hardness: 0,
});
export const STRAW_BED_BLOCK = addBlock('straw_bed', {
  transparent: true, solid: true, hardness: 0.2, behaviorId: 'minecraft:straw_bed',
});

export const WOOL_SHAPE_BLOCKS = new Map<DyeColor, { stairs: DataPackBlock; slab: DataPackBlock }>();
export const CONCRETE_SHAPE_BLOCKS = new Map<DyeColor, { stairs: DataPackBlock; slab: DataPackBlock }>();
for (const color of DYE_COLORS) {
  WOOL_SHAPE_BLOCKS.set(color, {
    stairs: addBlock(`${color}_wool_stairs`, { textureKey: `${color}_wool`, hardness: 0.8 }),
    slab: addBlock(`${color}_wool_slab`, { textureKey: `${color}_wool`, hardness: 0.8 }),
  });
  CONCRETE_SHAPE_BLOCKS.set(color, {
    stairs: addBlock(`${color}_concrete_stairs`, { textureKey: `${color}_concrete`, hardness: 1.8, toolCategory: 'pickaxe' }),
    slab: addBlock(`${color}_concrete_slab`, { textureKey: `${color}_concrete`, hardness: 1.8, toolCategory: 'pickaxe' }),
  });
}

export const WILDERNESS_BOUND_BLOCKS: DataPackBlock[] = blocks;

const NO_DIRECT_ITEM = new Set(['poplar_wall_sign', 'poplar_wall_hanging_sign']);
export const WILDERNESS_BOUND_ITEMS: DataPackItem[] = WILDERNESS_BOUND_BLOCKS
  .filter(block => !NO_DIRECT_ITEM.has(block.name))
  .map(block => ({
    id: block.id,
    officialId: block.officialId,
    baseId: block.id,
    name: block.name,
    displayName: block.displayName,
    maxStackSize: block.name === 'straw_bed' ? 16 : 64,
    category: 'block' as const,
    placeBlockId: block.id,
    behaviorId: 'minecraft:block_item',
  }));

export const CUSHION_ITEMS: DataPackItem[] = DYE_COLORS.map((color, index) => ({
  id: CUSHION_ID_START + index,
  officialId: `minecraft:${color}_cushion`,
  baseId: CUSHION_ID_START + index,
  name: `${color}_cushion`,
  displayName: `${color.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} Cushion`,
  maxStackSize: 16,
  category: 'material',
  behaviorId: 'minecraft:cushion',
}));

export const EXPLORER_MAP_NAMES = [
  'ocean_monument_map', 'woodland_mansion_map', 'buried_trial_chambers_map', 'jungle_pyramid_map',
  'swamp_hut_map', 'desert_village_map', 'plains_village_map', 'savanna_village_map',
  'snowy_village_map', 'taiga_village_map', 'buried_treasure_map', 'buried_ancient_city_map',
  'buried_mineshaft_map', 'desert_pyramid_map', 'abandoned_camp_map', 'warm_ocean_ruins_map',
] as const;

export const EXPLORER_MAP_ITEMS: DataPackItem[] = EXPLORER_MAP_NAMES.map((name, index) => ({
  id: EXPLORER_MAP_ID_START + index,
  officialId: `minecraft:${name}`,
  baseId: EXPLORER_MAP_ID_START + index,
  name,
  displayName: name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
  maxStackSize: 1,
  category: 'material',
  behaviorId: 'minecraft:readable',
}));

export const WILDERNESS_BOUND_ALL_ITEMS: DataPackItem[] = [
  ...WILDERNESS_BOUND_ITEMS,
  ...CUSHION_ITEMS,
  ...EXPLORER_MAP_ITEMS,
];

export const DAPPLED_FOREST_PASSIVE_MOBS = ['sheep', 'chicken', 'cow', 'pig', 'rabbit', 'fox'] as const;

export const ABANDONED_CAMP_BIOMES = [
  'meadow', 'cherry_grove', 'forest', 'birch_forest', 'old_growth_birch_forest', 'flower_forest',
  'windswept_forest', 'dappled_forest', 'taiga', 'snowy_taiga', 'old_growth_spruce_taiga',
  'old_growth_pine_taiga', 'sparse_jungle', 'bamboo_jungle', 'swamp', 'savanna',
  'wooded_badlands', 'pale_garden',
] as const;

export interface CushionPlacementContext {
  flatSurface: boolean;
  supportingBlock: boolean;
  occupiedByCushion: boolean;
}

export function canPlaceCushion(context: CushionPlacementContext): boolean {
  return context.flatSurface && context.supportingBlock && !context.occupiedByCushion;
}

export const CUSHION_HAS_COLLISION = false;
export const CUSHION_PISTON_MOVABLE = false;

export function shouldBreakCushion(supportingBlockPresent: boolean): boolean {
  return !supportingBlockPresent;
}

export function shelfMushroomAfterBoneMeal(size: ShelfMushroomSize): ShelfMushroomSize {
  return size === 'small' ? 'large' : 'large';
}

export function shelfMushroomDropCount(size: ShelfMushroomSize): number {
  return size === 'large' ? 2 : 1;
}

export const SHELF_MUSHROOM_IS_BOUNCY = true;
export const RED_SHRUB_COMPOSTABLE = true;

export function canRedShrubSpreadWithBoneMeal(adjacentReplaceable: boolean): boolean {
  return adjacentReplaceable;
}

export function poplarLeafVariantForGrowth(randomUnit: number): PoplarLeafColor {
  const normalized = Math.max(0, Math.min(0.999999, randomUnit));
  if (normalized < 1 / 3) return 'red';
  if (normalized < 2 / 3) return 'orange';
  return 'yellow';
}

export interface StrawBedUseResult {
  canSleep: boolean;
  setsSpawn: false;
  destroyAfterUse: true;
}

export function useStrawBed(dimension: 'overworld' | 'nether' | 'end' | string): StrawBedUseResult {
  return {
    canSleep: dimension === 'overworld',
    setsSpawn: false,
    destroyAfterUse: true,
  };
}

export function canSpectatorUsePortal(gameMode: string): boolean {
  return gameMode === 'spectator';
}

export function isExplorerMapExtendable(itemName: string): boolean {
  return !EXPLORER_MAP_NAMES.includes(itemName as typeof EXPLORER_MAP_NAMES[number]);
}

export function isDappledForestNearColdBiome(neighborTemperatures: number[]): boolean {
  return neighborTemperatures.some(value => Number.isFinite(value) && value <= 0.5);
}

export function isAbandonedCampBiome(biome: string): boolean {
  return ABANDONED_CAMP_BIOMES.includes(biome as typeof ABANDONED_CAMP_BIOMES[number]);
}

export function isMushroomFor26_3Recipe(name: string): boolean {
  return name === 'brown_mushroom' || name === 'red_mushroom' || name === 'shelf_mushroom';
}

export function buildWildernessBoundRecipes(resolveId: (name: string) => number | undefined): Record<string, RawRecipe[]> {
  const recipes: Record<string, RawRecipe[]> = {};
  const add = (resultId: number | undefined, recipe: RawRecipe) => {
    if (resultId === undefined) return;
    (recipes[String(resultId)] ??= []).push(recipe);
  };

  const poplarPlanks = POPLAR_PLANKS.id;
  for (const input of [POPLAR_LOG.id, STRIPPED_POPLAR_LOG.id, POPLAR_WOOD.id, STRIPPED_POPLAR_WOOD.id]) {
    add(poplarPlanks, { ingredients: [input], result: { id: poplarPlanks, count: 4 } });
  }
  add(POPLAR_STAIRS.id, {
    inShape: [[poplarPlanks, null, null], [poplarPlanks, poplarPlanks, null], [poplarPlanks, poplarPlanks, poplarPlanks]],
    result: { id: POPLAR_STAIRS.id, count: 4 },
  });
  add(POPLAR_SLAB.id, { inShape: [[poplarPlanks, poplarPlanks, poplarPlanks]], result: { id: POPLAR_SLAB.id, count: 6 } });

  const hay = resolveId('hay_block');
  if (hay !== undefined) add(STRAW_BED_BLOCK.id, {
    inShape: [[hay, hay, hay]],
    result: { id: STRAW_BED_BLOCK.id, count: 4 },
  });

  DYE_COLORS.forEach((color, index) => {
    const wool = resolveId(`${color}_wool`);
    const woolShapes = WOOL_SHAPE_BLOCKS.get(color)!;
    if (wool !== undefined) {
      add(woolShapes.slab.id, { inShape: [[wool, wool, wool]], result: { id: woolShapes.slab.id, count: 6 } });
      add(woolShapes.stairs.id, {
        inShape: [[wool, null, null], [wool, wool, null], [wool, wool, wool]],
        result: { id: woolShapes.stairs.id, count: 4 },
      });
      const cushion = CUSHION_ITEMS[index];
      add(cushion.id, { inShape: [[woolShapes.slab.id, woolShapes.slab.id, woolShapes.slab.id]], result: { id: cushion.id, count: 1 } });
    }

    const concrete = resolveId(`${color}_concrete`);
    const concreteShapes = CONCRETE_SHAPE_BLOCKS.get(color)!;
    if (concrete !== undefined) {
      add(concreteShapes.slab.id, { inShape: [[concrete, concrete, concrete]], result: { id: concreteShapes.slab.id, count: 6 } });
      add(concreteShapes.stairs.id, {
        inShape: [[concrete, null, null], [concrete, concrete, null], [concrete, concrete, concrete]],
        result: { id: concreteShapes.stairs.id, count: 4 },
      });
    }
  });

  const bowl = resolveId('bowl');
  const stew = resolveId('mushroom_stew');
  const mushroomIds = ['brown_mushroom', 'red_mushroom', 'shelf_mushroom']
    .map(resolveId)
    .filter((id): id is number => id !== undefined);
  if (bowl !== undefined && stew !== undefined) {
    for (let i = 0; i < mushroomIds.length; i++) {
      for (let j = i; j < mushroomIds.length; j++) {
        add(stew, { ingredients: [bowl, mushroomIds[i], mushroomIds[j]], result: { id: stew, count: 1 } });
      }
    }
  }

  return recipes;
}

export function getWildernessBoundIds() {
  return {
    poplarLog: POPLAR_LOG.id,
    poplarPlanks: POPLAR_PLANKS.id,
    poplarSapling: POPLAR_SAPLING.id,
    poplarSign: POPLAR_SIGN.id,
    poplarHangingSign: POPLAR_HANGING_SIGN.id,
    shelfMushroom: SHELF_MUSHROOM_BLOCK.id,
    redShrub: RED_SHRUB_BLOCK.id,
    strawBed: STRAW_BED_BLOCK.id,
  };
}
