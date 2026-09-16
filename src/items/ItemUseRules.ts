import type { ItemStack } from '../types';
import { ItemRegistry } from './ItemRegistry';

const BOWL_ID = 281;
const BUCKET_ID = 325;
const GLASS_BOTTLE_ID = 374;

const ALWAYS_EDIBLE_NAMES = new Set([
  'golden_apple',
  'enchanted_golden_apple',
  'chorus_fruit',
  'honey_bottle',
]);

const BOWL_REMAINDER_FOODS = new Set([
  'mushroom_stew',
  'beetroot_soup',
  'rabbit_stew',
  'suspicious_stew',
]);

export function isItemAlwaysEdible(stack: ItemStack): boolean {
  if (stack.alwaysEdible) return true;
  const name = ItemRegistry.get(stack.id)?.name;
  return !!name && ALWAYS_EDIBLE_NAMES.has(name);
}

export function canConsumeFoodItem(stack: ItemStack, hunger: number): boolean {
  if (!ItemRegistry.isFood(stack.id)) return false;
  return hunger < 20 || isItemAlwaysEdible(stack);
}

/** Java food use duration in seconds for the modeled inventory items. */
export function getItemUseDurationSeconds(item: number | ItemStack): number {
  const id = typeof item === 'number' ? item : item.id;
  const def = ItemRegistry.get(id);
  if (!def) return 0;
  if (def.name === 'dried_kelp') return 0.8;
  if (def.category === 'food') return 1.6;
  if (def.name === 'potion' || def.name === 'milk_bucket') return 1.6;
  return 0;
}

/** Default container returned after a successful consumable use. */
export function getDefaultUseRemainderItemId(itemId: number): number | undefined {
  const name = ItemRegistry.get(itemId)?.name;
  if (!name) return undefined;
  if (name === 'potion' || name === 'honey_bottle') return GLASS_BOTTLE_ID;
  if (name === 'milk_bucket') return BUCKET_ID;
  if (BOWL_REMAINDER_FOODS.has(name)) return BOWL_ID;
  return undefined;
}

/** Creative placement does not consume the selected stack. */
export function shouldConsumePlacedItem(gameMode: 'survival' | 'creative'): boolean {
  return gameMode !== 'creative';
}
