import { BlockRegistry } from '../world/BlockRegistry';

/**
 * P3.5 — Stonecutter recipes (data-driven subset of Java 1.20.1).
 * Input is a stone-family block; each entry cuts it into one product. Slabs
 * and walls yield 2 per input, other products 1.
 */

export interface StonecuttingRecipe {
  input: string;
  output: string;
  count: number;
}

export interface StonecuttingResult {
  outputBlockId: number;
  count: number;
}

export const STONECUTTING_RECIPES: StonecuttingRecipe[] = [
  // Stone family
  { input: 'stone', output: 'stone_slab', count: 2 },
  { input: 'stone', output: 'stone_stairs', count: 1 },
  { input: 'stone', output: 'stonebrick', count: 1 },
  { input: 'stone', output: 'stone_brick_slab', count: 2 },
  { input: 'stone', output: 'stone_brick_stairs', count: 1 },
  { input: 'stone', output: 'chiseled_stone_bricks', count: 1 },
  // Cobblestone family
  { input: 'cobblestone', output: 'cobblestone_slab', count: 2 },
  { input: 'cobblestone', output: 'cobblestone_stairs', count: 1 },
  { input: 'cobblestone', output: 'cobblestone_wall', count: 1 },
  { input: 'cobblestone', output: 'mossy_cobblestone_slab', count: 2 },
  { input: 'cobblestone', output: 'mossy_cobblestone_stairs', count: 1 },
  // Sandstone family
  { input: 'sandstone', output: 'sandstone_slab', count: 2 },
  { input: 'sandstone', output: 'sandstone_stairs', count: 1 },
  { input: 'sandstone', output: 'cut_sandstone', count: 1 },
  { input: 'sandstone', output: 'cut_sandstone_slab', count: 2 },
  { input: 'sandstone', output: 'chiseled_sandstone', count: 1 },
  { input: 'sandstone', output: 'sandstone_wall', count: 1 },
  // Red sandstone family
  { input: 'red_sandstone', output: 'red_sandstone_slab', count: 2 },
  { input: 'red_sandstone', output: 'red_sandstone_stairs', count: 1 },
  { input: 'red_sandstone', output: 'cut_red_sandstone', count: 1 },
  { input: 'red_sandstone', output: 'cut_red_sandstone_slab', count: 2 },
  { input: 'red_sandstone', output: 'chiseled_red_sandstone', count: 1 },
  { input: 'red_sandstone', output: 'red_sandstone_wall', count: 1 },
  // Andesite family
  { input: 'andesite', output: 'andesite_slab', count: 2 },
  { input: 'andesite', output: 'andesite_stairs', count: 1 },
  { input: 'andesite', output: 'andesite_wall', count: 1 },
  { input: 'andesite', output: 'polished_andesite', count: 1 },
  { input: 'polished_andesite', output: 'polished_andesite_slab', count: 2 },
  { input: 'polished_andesite', output: 'polished_andesite_stairs', count: 1 },
  // Diorite family
  { input: 'diorite', output: 'diorite_slab', count: 2 },
  { input: 'diorite', output: 'diorite_stairs', count: 1 },
  { input: 'diorite', output: 'diorite_wall', count: 1 },
  { input: 'diorite', output: 'polished_diorite', count: 1 },
  { input: 'polished_diorite', output: 'polished_diorite_slab', count: 2 },
  { input: 'polished_diorite', output: 'polished_diorite_stairs', count: 1 },
  // Granite family
  { input: 'granite', output: 'granite_slab', count: 2 },
  { input: 'granite', output: 'granite_stairs', count: 1 },
  { input: 'granite', output: 'granite_wall', count: 1 },
  { input: 'granite', output: 'polished_granite', count: 1 },
  { input: 'polished_granite', output: 'polished_granite_slab', count: 2 },
  { input: 'polished_granite', output: 'polished_granite_stairs', count: 1 },
  // Prismarine family
  { input: 'prismarine', output: 'prismarine_slab', count: 2 },
  { input: 'prismarine', output: 'prismarine_stairs', count: 1 },
  { input: 'prismarine', output: 'prismarine_wall', count: 1 },
  { input: 'prismarine', output: 'prismarine_bricks', count: 1 },
  { input: 'prismarine', output: 'dark_prismarine', count: 1 },
  // Purpur family
  { input: 'purpur_block', output: 'purpur_slab', count: 2 },
  { input: 'purpur_block', output: 'purpur_stairs', count: 1 },
  // Quartz family
  { input: 'quartz_block', output: 'quartz_slab', count: 2 },
  { input: 'quartz_block', output: 'quartz_stairs', count: 1 },
  { input: 'quartz_block', output: 'chiseled_quartz_block', count: 1 },
  { input: 'quartz_block', output: 'quartz_bricks', count: 1 },
  { input: 'quartz_block', output: 'smooth_quartz_slab', count: 2 },
  { input: 'quartz_block', output: 'smooth_quartz_stairs', count: 1 },
  // Nether brick family
  { input: 'nether_brick', output: 'nether_brick_slab', count: 2 },
  { input: 'nether_brick', output: 'nether_brick_stairs', count: 1 },
  { input: 'nether_brick', output: 'nether_brick_wall', count: 1 },
  { input: 'nether_brick', output: 'red_nether_brick', count: 1 },
  { input: 'nether_brick', output: 'chiseled_nether_bricks', count: 1 },
  // Stone bricks family
  { input: 'stonebrick', output: 'stone_brick_slab', count: 2 },
  { input: 'stonebrick', output: 'stone_brick_stairs', count: 1 },
  { input: 'stonebrick', output: 'chiseled_stone_bricks', count: 1 },
  { input: 'stonebrick', output: 'mossy_stone_bricks', count: 1 },
  { input: 'stonebrick', output: 'cracked_stone_bricks', count: 1 },
  // Blackstone family
  { input: 'blackstone', output: 'blackstone_slab', count: 2 },
  { input: 'blackstone', output: 'blackstone_stairs', count: 1 },
  { input: 'blackstone', output: 'blackstone_wall', count: 1 },
  { input: 'blackstone', output: 'polished_blackstone', count: 1 },
  { input: 'polished_blackstone', output: 'polished_blackstone_slab', count: 2 },
  { input: 'polished_blackstone', output: 'polished_blackstone_stairs', count: 1 },
  // Deepslate family
  { input: 'cobbled_deepslate', output: 'cobbled_deepslate_slab', count: 2 },
  { input: 'cobbled_deepslate', output: 'cobbled_deepslate_stairs', count: 1 },
  { input: 'cobbled_deepslate', output: 'cobbled_deepslate_wall', count: 1 },
  { input: 'cobbled_deepslate', output: 'polished_deepslate', count: 1 },
  { input: 'deepslate', output: 'deepslate_bricks', count: 1 },
  { input: 'deepslate', output: 'deepslate_tiles', count: 1 },
  { input: 'deepslate', output: 'chiseled_deepslate', count: 1 },
  // Tuff family
  { input: 'tuff', output: 'polished_tuff', count: 1 },
  { input: 'tuff', output: 'tuff_bricks', count: 1 },
  { input: 'tuff', output: 'chiseled_tuff', count: 1 },
  // Misc
  { input: 'mud_bricks', output: 'mud_brick_slab', count: 2 },
  { input: 'mud_bricks', output: 'mud_brick_stairs', count: 1 },
  { input: 'end_stone', output: 'end_stone_bricks', count: 1 },
];

/** Resolve all stonecutting products for a block id, in registration order. */
export function getStonecuttingResults(inputBlockId: number): StonecuttingResult[] {
  const def = BlockRegistry.get(inputBlockId);
  if (!def) return [];
  const out: StonecuttingResult[] = [];
  for (const recipe of STONECUTTING_RECIPES) {
    if (recipe.input !== def.name) continue;
    const outputDef = BlockRegistry.getByName(recipe.output);
    if (!outputDef) continue;
    out.push({ outputBlockId: outputDef.id, count: recipe.count });
  }
  return out;
}

/** Whether a block can be used as a stonecutter input. */
export function isStonecuttingInput(blockId: number): boolean {
  const def = BlockRegistry.get(blockId);
  if (!def) return false;
  return STONECUTTING_RECIPES.some((recipe) => recipe.input === def.name);
}
