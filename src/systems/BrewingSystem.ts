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

export const BREWING_RECIPES: BrewingRecipe[] = [
  { ingredientId: NETHER_WART_ID, inputKind: 'water', outputKind: 'awkward', outputName: 'Awkward Potion' },
  { ingredientId: GHAST_TEAR_ID, inputKind: 'awkward', outputKind: 'regeneration', outputName: 'Potion of Regeneration', effect: { id: 'regeneration', level: 1, duration: 45 } },
  { ingredientId: SUGAR_ID, inputKind: 'awkward', outputKind: 'speed', outputName: 'Potion of Swiftness', effect: { id: 'speed', level: 1, duration: 180 } },
  { ingredientId: SPIDER_EYE_ID, inputKind: 'awkward', outputKind: 'poison', outputName: 'Potion of Poison', effect: { id: 'poison', level: 1, duration: 45 } },
  { ingredientId: BLAZE_POWDER_ID, inputKind: 'awkward', outputKind: 'healing', outputName: 'Potion of Healing', effect: { id: 'healing', level: 1, duration: 0 } },
  { ingredientId: MAGMA_CREAM_ID, inputKind: 'awkward', outputKind: 'fire_resistance', outputName: 'Potion of Fire Resistance', effect: { id: 'fire_resistance', level: 1, duration: 180 } },
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
