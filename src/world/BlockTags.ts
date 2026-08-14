import type { BlockDef } from '../types';

/**
 * P2.7 — Data-driven block tags.
 *
 * Vanilla-style tag inference assigned at registry load (and overridable by
 * data packs through `BlockDef.tags`). Mineable tags drive tool-speed bonuses;
 * `needs_*_tool` tags gate harvestability (a wrong-tier tool breaks the block
 * slowly and drops nothing, matching Java 1.20.1).
 */

export const TAG_MINEABLE_PICKAXE = 'minecraft:mineable/pickaxe';
export const TAG_MINEABLE_AXE = 'minecraft:mineable/axe';
export const TAG_MINEABLE_SHOVEL = 'minecraft:mineable/shovel';
export const TAG_MINEABLE_HOE = 'minecraft:mineable/hoe';
export const TAG_NEEDS_STONE_TOOL = 'minecraft:needs_stone_tool';
export const TAG_NEEDS_IRON_TOOL = 'minecraft:needs_iron_tool';
export const TAG_NEEDS_DIAMOND_TOOL = 'minecraft:needs_diamond_tool';

export type MineableCategory = 'pickaxe' | 'axe' | 'shovel' | 'hoe';

/**
 * Explicit tag corrections for blocks whose names do not encode their vanilla
 * tags. Takes precedence over name inference; data packs may override the
 * whole set through `BlockDef.tags`.
 */
export const BLOCK_TAG_OVERRIDES: Record<string, string[]> = {
  'ender_chest': [TAG_MINEABLE_PICKAXE],
  'crying_obsidian': [TAG_MINEABLE_PICKAXE, TAG_NEEDS_DIAMOND_TOOL],
  'respawn_anchor': [TAG_MINEABLE_PICKAXE, TAG_NEEDS_DIAMOND_TOOL],
};

const STONE_BUTTONS = new Set([
  'stone_button',
  'polished_blackstone_button',
  'stone_pressure_plate',
  'polished_blackstone_pressure_plate',
]);

/** Infer mineable tags from the registry name and JSON material. */
export function inferMineableTags(name: string, material?: string): string[] {
  const has = (...parts: string[]) => parts.some((part) => name.includes(part));

  // Pickaxe-mineable families. Checked first so iron/gold hardware (doors,
  // trapdoors, bars, ore blocks) wins over the axe/shovel patterns below.
  const pickaxe =
    material === 'rock' ||
    name === 'furnace' ||
    name === 'lit_furnace' ||
    STONE_BUTTONS.has(name) ||
    has(
      'ore', 'stone', 'brick', 'cobblestone', 'obsidian', 'terracotta',
      'concrete', 'glass', 'prismarine', 'purpur', 'end_stone', 'glowstone',
      'sea_lantern', 'magma', 'netherite', 'quartz_block', 'anvil', 'cauldron',
      'hopper', 'smoker', 'blast_furnace', 'enchanting_table', 'brewing_stand',
      'ender_chest', 'lantern', 'iron_bars', 'iron_door', 'iron_trapdoor',
      'chain', 'polished_', 'chiseled_', 'cut_', 'smooth_', 'cracked_',
      'mossy_cobblestone', 'cobbled_deepslate', 'reinforced_deepslate',
      'copper', 'amethyst', 'calcite', 'tuff', 'dripstone', 'packed_ice',
      'blue_ice', 'obsidian',
    ) ||
    (has('_block') && has('coal', 'iron', 'gold', 'diamond', 'emerald', 'lapis', 'redstone', 'netherite', 'copper'));
  if (pickaxe) return [TAG_MINEABLE_PICKAXE];

  if (
    material === 'wood' ||
    name.endsWith('_button') ||
    name.endsWith('_pressure_plate') ||
    has(
      'planks', 'log', 'door', 'trapdoor', 'fence', 'sign', 'chest', 'barrel',
      'bookshelf', 'crafting_table', 'campfire', 'composter', 'beehive',
      'bee_nest', 'ladder', 'wood', 'bamboo', 'jukebox', 'note_block',
    )
  ) {
    return [TAG_MINEABLE_AXE];
  }

  if (
    material === 'dirt' ||
    has('grass', 'dirt', 'sand', 'gravel', 'clay', 'snow', 'soul_sand', 'soul_soil', 'mycelium', 'podzol', 'farmland', 'mud', 'rooted_dirt')
  ) {
    return [TAG_MINEABLE_SHOVEL];
  }

  if (has('hay_block', 'dried_kelp', 'leaves', 'wart_block', 'shroomlight', 'sponge', 'moss_block', 'moss_carpet', 'sculk', 'target')) {
    return [TAG_MINEABLE_HOE];
  }

  return [];
}

/** Infer harvest-level tags (needs_*_tool) from the registry name. */
export function inferHarvestTags(name: string): string[] {
  if (name.includes('obsidian') || name.includes('ancient_debris') || name.includes('netherite_block')) {
    return [TAG_NEEDS_DIAMOND_TOOL];
  }
  if (name.includes('diamond_ore') || name.includes('emerald_ore') || name.includes('gold_ore') || name.includes('redstone_ore')) {
    return [TAG_NEEDS_IRON_TOOL];
  }
  if (name.includes('iron_ore') || name.includes('lapis_ore') || name.includes('copper_ore')) {
    return [TAG_NEEDS_STONE_TOOL];
  }
  return [];
}

/**
 * Resolve the full tag set for a block: data-pack `tags` (explicit control) →
 * built-in name overrides → name inference.
 */
export function getBlockTags(block: BlockDef | undefined): string[] {
  if (!block) return [];
  if (block.tags && block.tags.length > 0) return block.tags.slice();
  const explicit = BLOCK_TAG_OVERRIDES[block.name];
  if (explicit) return explicit.slice();
  return [...inferMineableTags(block.name), ...inferHarvestTags(block.name)];
}

export function getMineableCategory(tags: readonly string[]): MineableCategory | undefined {
  if (tags.includes(TAG_MINEABLE_PICKAXE)) return 'pickaxe';
  if (tags.includes(TAG_MINEABLE_AXE)) return 'axe';
  if (tags.includes(TAG_MINEABLE_SHOVEL)) return 'shovel';
  if (tags.includes(TAG_MINEABLE_HOE)) return 'hoe';
  return undefined;
}

/** 0 = no requirement; 1/2/3 = needs stone/iron/diamond tool. */
export function getRequiredHarvestTier(tags: readonly string[]): number {
  if (tags.includes(TAG_NEEDS_DIAMOND_TOOL)) return 3;
  if (tags.includes(TAG_NEEDS_IRON_TOOL)) return 2;
  if (tags.includes(TAG_NEEDS_STONE_TOOL)) return 1;
  return 0;
}
