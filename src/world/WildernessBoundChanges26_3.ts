import type { RawRecipe } from '../items/CraftingRecipes';
import { EXPLORER_MAP_NAMES } from './WildernessBound26_3';

export const WILDERNESS_BOUND_MUSHROOMS_26_3 = [
  'brown_mushroom',
  'red_mushroom',
  'shelf_mushroom',
] as const;

/** Flowers that retain the vanilla Suspicious Stew recipe role in 26.3. */
export const SUSPICIOUS_STEW_FLOWERS_26_3 = [
  'dandelion',
  'poppy',
  'blue_orchid',
  'allium',
  'azure_bluet',
  'red_tulip',
  'orange_tulip',
  'white_tulip',
  'pink_tulip',
  'oxeye_daisy',
  'cornflower',
  'lily_of_the_valley',
  'wither_rose',
  'torchflower',
] as const;

export function isWildernessBoundMushroom26_3(name: string): boolean {
  return WILDERNESS_BOUND_MUSHROOMS_26_3.includes(
    name as typeof WILDERNESS_BOUND_MUSHROOMS_26_3[number],
  );
}

/**
 * Java 26.3 changed Suspicious Stew to accept any two mushrooms. The flower
 * still controls the effect; this project's recipe result does not yet carry
 * the flower-derived stew effect component, so this bridge models ingredient
 * acceptance while preserving the dedicated Suspicious Stew output item.
 */
export function buildWildernessBoundChangeRecipes26_3(
  resolveId: (name: string) => number | undefined,
): Record<string, RawRecipe[]> {
  const recipes: Record<string, RawRecipe[]> = {};
  const bowl = resolveId('bowl');
  const suspiciousStew = resolveId('suspicious_stew');
  const mushrooms = WILDERNESS_BOUND_MUSHROOMS_26_3
    .map(resolveId)
    .filter((id): id is number => id !== undefined);

  if (bowl === undefined || suspiciousStew === undefined || mushrooms.length === 0) return recipes;

  const anyMushroom = [...mushrooms];
  const entries: RawRecipe[] = [];
  for (const flowerName of SUSPICIOUS_STEW_FLOWERS_26_3) {
    const flower = resolveId(flowerName);
    if (flower === undefined) continue;
    entries.push({
      ingredients: [bowl, anyMushroom, anyMushroom, flower],
      result: { id: suspiciousStew, count: 1 },
    });
  }
  if (entries.length > 0) recipes[String(suspiciousStew)] = entries;
  return recipes;
}

export function isCloneableMapName26_3(name: string): boolean {
  return name === 'filled_map'
    || EXPLORER_MAP_NAMES.includes(name as typeof EXPLORER_MAP_NAMES[number]);
}

/**
 * Explorer/Buried Treasure maps are dedicated Explorer Map items in 26.3 and
 * are deliberately excluded from #minecraft:extendable_maps.
 */
export function isExtendableMapName26_3(name: string): boolean {
  return name === 'filled_map';
}

export function normalizeMapFacingDegrees26_3(yawDegrees: number): number {
  if (!Number.isFinite(yawDegrees)) return 0;
  const normalized = yawDegrees % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

/** 26.3 parity rule: random wandering/swimming sleeps when no player is nearby. */
export function shouldRunRandomMovement26_3(playerNearby: boolean): boolean {
  return playerNearby;
}

/**
 * Java 26.3 interaction priority: when a shield is available with a main-hand
 * hoe or shovel, shield raising wins over tilling/path making.
 */
export function shouldPrioritizeShieldUse26_3(
  mainHandName: string | undefined,
  offhandName: string | undefined,
): boolean {
  return offhandName === 'shield'
    && !!mainHandName
    && (mainHandName.endsWith('_hoe') || mainHandName.endsWith('_shovel'));
}

export type PoplarLeafColor26_3 = 'red' | 'orange' | 'yellow';

export function fallingLeafParticle26_3(blockName: string): string | null {
  if (blockName === 'spruce_leaves') return null;
  const match = /^(red|orange|yellow)_poplar_leaves$/.exec(blockName);
  return match ? `minecraft:${match[1]}_poplar_leaves` : null;
}

export const SHELF_MUSHROOM_SOUNDS_26_3 = [
  'block.shelf_mushroom.break',
  'block.shelf_mushroom.fall',
  'block.shelf_mushroom.place',
  'block.shelf_mushroom.step',
  'block.shelf_mushroom.bounce',
] as const;

export const POPLAR_LEAVES_SOUNDS_26_3 = [
  'block.poplar_leaves.ambient',
  'block.poplar_leaves.break',
  'block.poplar_leaves.fall',
  'block.poplar_leaves.place',
  'block.poplar_leaves.step',
  'block.poplar_leaves.hit',
] as const;

export const STRAW_BED_SOUNDS_26_3 = [
  'block.straw_bed.break',
  'block.straw_bed.break_leave',
  'block.straw_bed.step',
  'block.straw_bed.place',
  'block.straw_bed.hit',
  'block.straw_bed.fall',
] as const;

export const RED_SHRUB_SOUNDS_26_3 = [
  'block.red_shrub.break',
  'block.red_shrub.place',
] as const;

export const CUSHION_SOUNDS_26_3 = [
  'entity.cushion.break',
  'entity.cushion.place',
  'entity.cushion.get_up',
  'entity.cushion.sit',
] as const;

export interface VillagerTradeRefreshState26_3 {
  level: number;
  revision: number;
}

/**
 * Trading screens can stay open while newly unlocked level-up offers appear.
 * Consumers can use the monotonically increasing revision to invalidate any
 * memoized/open offer list without closing the UI.
 */
export function levelUpVillagerTrades26_3(
  state: VillagerTradeRefreshState26_3,
  nextLevel: number,
): { state: VillagerTradeRefreshState26_3; refreshOpenTradingUi: boolean } {
  const level = Math.max(state.level, Math.floor(nextLevel));
  if (level <= state.level) return { state: { ...state }, refreshOpenTradingUi: false };
  return {
    state: { level, revision: state.revision + 1 },
    refreshOpenTradingUi: true,
  };
}
