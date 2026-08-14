import type { ItemStack, PotionKind } from '../types';
import type { PotionEffectData } from './PotionEffect';

export interface BrewingRecipe {
  ingredientId: number;
  inputKind: PotionKind;
  outputKind: PotionKind;
  outputName: string;
  effect?: PotionEffectData;
}

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

  findRecipe(ingredient: ItemStack | null, bottles: Array<ItemStack | null>): BrewingRecipe | null {
    if (!ingredient) return null;
    return BREWING_RECIPES.find((recipe) =>
      recipe.ingredientId === ingredient.id &&
      bottles.some((bottle) => bottle && this.getPotionKind(bottle) === recipe.inputKind)
    ) ?? null;
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
      },
    };
  },
};
