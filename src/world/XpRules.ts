/**
 * P2.7 — Data-driven experience rules.
 *
 * Java 1.20.1 XP sources that were previously hardcoded in the game loop are
 * centralized here: block (ore) mining XP, fishing XP and breeding XP. Mob
 * death XP (`MobDef.xpDrop`) and smelting XP (`recipe.xp`) were already
 * data-driven.
 */

export interface XpRange {
  min: number;
  max: number;
}

/** Block mining XP by registry name (Java 1.20.1 values). */
export const BLOCK_XP_RULES: Readonly<Record<string, XpRange>> = {
  'coal_ore': { min: 0, max: 2 },
  'deepslate_coal_ore': { min: 0, max: 2 },
  'diamond_ore': { min: 3, max: 7 },
  'deepslate_diamond_ore': { min: 3, max: 7 },
  'emerald_ore': { min: 3, max: 7 },
  'deepslate_emerald_ore': { min: 3, max: 7 },
  'lapis_ore': { min: 2, max: 5 },
  'deepslate_lapis_ore': { min: 2, max: 5 },
  'redstone_ore': { min: 1, max: 5 },
  'deepslate_redstone_ore': { min: 1, max: 5 },
  'nether_quartz_ore': { min: 2, max: 5 },
  'nether_gold_ore': { min: 0, max: 1 },
};

export const FISHING_XP_RANGE: XpRange = { min: 1, max: 6 };
export const BREEDING_XP_RANGE: XpRange = { min: 1, max: 7 };

export function getBlockXpRange(blockName: string): XpRange | undefined {
  return BLOCK_XP_RULES[blockName];
}

/** Inclusive roll over [min, max]; deterministic for a given rng. */
export function rollXp(range: XpRange, rng: () => number): number {
  return range.min + Math.floor(rng() * (range.max - range.min + 1));
}

export function rollBlockXp(blockName: string, rng: () => number): number {
  const range = getBlockXpRange(blockName);
  if (!range) return 0;
  return rollXp(range, rng);
}
