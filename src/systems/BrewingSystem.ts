import type { ItemStack, PotionKind } from '../types';
import type { PotionEffectData } from './PotionEffect';

export interface BrewingRecipe {
  ingredientId: number;
  inputKind: PotionKind;
  outputKind: PotionKind;
  outputName: string;
  effect?: PotionEffectData;
}

/** P3.4 — potion modifier (redstone/glowstone/gunpowder/dragon's breath). */
export interface PotionModifier {
  ingredientId: number;
  name: string;
  matches: (bottle: ItemStack) => boolean;
  modify: (bottle: ItemStack) => ItemStack;
}

export type BrewAction =
  | { kind: 'brew'; recipe: BrewingRecipe }
  | { kind: 'modify'; modifier: PotionModifier };

const POTION_ID = 373;
const GLASS_BOTTLE_ID = 374;
const NETHER_WART_ID = 372;
const GHAST_TEAR_ID = 370;
const SUGAR_ID = 353;
const SPIDER_EYE_ID = 375;
const BLAZE_POWDER_ID = 377;
const MAGMA_CREAM_ID = 378;
const FERMENTED_SPIDER_EYE_ID = 376;
const PUFFERFISH_ID = 20218;
const RABBIT_FOOT_ID = 414;
const GOLDEN_APPLE_ID = 322;

export const BREWING_RECIPES: BrewingRecipe[] = [
  { ingredientId: NETHER_WART_ID, inputKind: 'water', outputKind: 'awkward', outputName: 'Awkward Potion' },
  { ingredientId: GHAST_TEAR_ID, inputKind: 'awkward', outputKind: 'regeneration', outputName: 'Potion of Regeneration', effect: { id: 'regeneration', level: 1, duration: 45 } },
  { ingredientId: SUGAR_ID, inputKind: 'awkward', outputKind: 'speed', outputName: 'Potion of Swiftness', effect: { id: 'speed', level: 1, duration: 180 } },
  { ingredientId: SPIDER_EYE_ID, inputKind: 'awkward', outputKind: 'poison', outputName: 'Potion of Poison', effect: { id: 'poison', level: 1, duration: 45 } },
  { ingredientId: BLAZE_POWDER_ID, inputKind: 'awkward', outputKind: 'strength', outputName: 'Potion of Strength', effect: { id: 'strength', level: 1, duration: 180 } },
  { ingredientId: 382, inputKind: 'awkward', outputKind: 'healing', outputName: 'Potion of Healing', effect: { id: 'healing', level: 1, duration: 0 } }, // speckled_melon
  { ingredientId: MAGMA_CREAM_ID, inputKind: 'awkward', outputKind: 'fire_resistance', outputName: 'Potion of Fire Resistance', effect: { id: 'fire_resistance', level: 1, duration: 180 } },
  { ingredientId: FERMENTED_SPIDER_EYE_ID, inputKind: 'awkward', outputKind: 'hunger', outputName: 'Potion of Hunger', effect: { id: 'hunger', level: 1, duration: 90 } },
  { ingredientId: FERMENTED_SPIDER_EYE_ID, inputKind: 'speed', outputKind: 'slowness', outputName: 'Potion of Slowness', effect: { id: 'slowness', level: 1, duration: 90 } },
  { ingredientId: PUFFERFISH_ID, inputKind: 'awkward', outputKind: 'water_breathing', outputName: 'Potion of Water Breathing', effect: { id: 'water_breathing', level: 1, duration: 180 } },
  { ingredientId: RABBIT_FOOT_ID, inputKind: 'awkward', outputKind: 'jump_boost', outputName: 'Potion of Leaping', effect: { id: 'jump_boost', level: 1, duration: 180 } },
  { ingredientId: GOLDEN_APPLE_ID, inputKind: 'awkward', outputKind: 'absorption', outputName: 'Potion of Absorption', effect: { id: 'absorption', level: 1, duration: 120 } },
];

export const BrewingSystem = {
  isBottle(item: ItemStack | null): boolean {
    return item?.id === GLASS_BOTTLE_ID || item?.id === POTION_ID;
  },

  isPotion(item: ItemStack | null): boolean {
    return item?.id === POTION_ID;
  },

  getPotionKind(item: ItemStack): PotionKind {
    if (item.id === GLASS_BOTTLE_ID) return 'bottle';
    return item.potion?.kind ?? 'water';
  },

  createWaterPotion(): ItemStack {
    return { id: POTION_ID, count: 1, potion: { kind: 'water', name: 'Water Bottle' } };
  },

  /** A potion that can still be brewed/modified (has an effect, not awkward). */
  isBrewablePotion(item: ItemStack | null): boolean {
    if (!item || item.id !== POTION_ID || !item.potion?.effect) return false;
    const kind = item.potion.kind;
    return kind !== 'water' && kind !== 'awkward';
  },

  findRecipe(ingredient: ItemStack | null, bottles: Array<ItemStack | null>): BrewingRecipe | null {
    if (!ingredient) return null;
    return BREWING_RECIPES.find((recipe) =>
      recipe.ingredientId === ingredient.id &&
      bottles.some((bottle) => bottle && this.getPotionKind(bottle) === recipe.inputKind)
    ) ?? null;
  },

  /**
   * P3.4 — resolve the brewing action for an ingredient: a base recipe or a
   * potion modifier (redstone/glowstone/gunpowder/dragon's breath).
   */
  findBrewAction(ingredient: ItemStack | null, bottles: Array<ItemStack | null>): BrewAction | null {
    if (!ingredient) return null;
    const modifier = POTION_MODIFIERS.find((mod) =>
      mod.ingredientId === ingredient.id &&
      bottles.some((bottle) => bottle && mod.matches(bottle))
    );
    if (modifier) return { kind: 'modify', modifier };
    const recipe = this.findRecipe(ingredient, bottles);
    return recipe ? { kind: 'brew', recipe } : null;
  },

  brewBottle(bottle: ItemStack, recipe: BrewingRecipe): ItemStack {
    if (bottle.id === GLASS_BOTTLE_ID) return bottle;
    if (this.getPotionKind(bottle) !== recipe.inputKind) return bottle;
    return {
      id: POTION_ID,
      count: 1,
      potion: {
        kind: recipe.outputKind,
        name: recipe.outputName,
        effect: recipe.effect,
        variant: bottle.potion?.variant,
      },
    };
  },
};

/**
 * P3.4 — potion modifiers (Java 1.20.1):
 * redstone doubles duration, glowstone raises to level II (duration / 3),
 * gunpowder makes a splash potion, dragon's breath makes a lingering potion.
 */
const REDSTONE_ID = 331;
const GLOWSTONE_ID = 348;
const GUNPOWDER_ID = 289;
const DRAGON_BREATH_ID = 437;

export const POTION_MODIFIERS: PotionModifier[] = [
  {
    ingredientId: REDSTONE_ID,
    name: 'Extended',
    matches: (bottle) => BrewingSystem.isBrewablePotion(bottle) && (bottle.potion?.effect?.duration ?? 0) > 0,
    modify: (bottle) => ({
      ...bottle,
      potion: {
        ...bottle.potion!,
        effect: bottle.potion?.effect
          ? { ...bottle.potion.effect, duration: bottle.potion.effect.duration * 2 }
          : undefined,
        name: `Extended ${bottle.potion?.name ?? ''}`.trim(),
      },
    }),
  },
  {
    ingredientId: GLOWSTONE_ID,
    name: 'Strengthened',
    matches: (bottle) => BrewingSystem.isBrewablePotion(bottle) && (bottle.potion?.effect?.level ?? 0) < 2,
    modify: (bottle) => ({
      ...bottle,
      potion: {
        ...bottle.potion!,
        effect: bottle.potion?.effect
          ? {
            ...bottle.potion.effect,
            level: bottle.potion.effect.level + 1,
            duration: Math.max(1, Math.floor((bottle.potion.effect.duration ?? 0) / 3)),
          }
          : undefined,
        name: `Strong ${bottle.potion?.name ?? ''}`.trim(),
      },
    }),
  },
  {
    ingredientId: GUNPOWDER_ID,
    name: 'Splash',
    matches: (bottle) => BrewingSystem.isBrewablePotion(bottle) && bottle.potion?.variant !== 'lingering',
    modify: (bottle) => ({
      ...bottle,
      potion: {
        ...bottle.potion!,
        variant: 'splash',
        name: `Splash ${bottle.potion?.name ?? ''}`.trim(),
      },
    }),
  },
  {
    ingredientId: DRAGON_BREATH_ID,
    name: 'Lingering',
    matches: (bottle) => bottle.potion?.variant === 'splash' && !!bottle.potion.effect,
    modify: (bottle) => ({
      ...bottle,
      potion: {
        ...bottle.potion!,
        variant: 'lingering',
        name: `Lingering ${bottle.potion?.name ?? ''}`.replace(/^Splash\s+/, '').trim(),
      },
    }),
  },
];
