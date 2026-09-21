import type { ItemStack } from '../types';
import type { PlayerDamageKind } from '../systems/DamageRules';
import type { PotionEffectData } from '../systems/PotionEffect';

export type TotemHand = 'mainhand' | 'offhand';

export const TOTEM_OF_UNDYING_EFFECTS: readonly PotionEffectData[] = [
  { id: 'regeneration', level: 2, duration: 45 },
  { id: 'fire_resistance', level: 1, duration: 40 },
  { id: 'absorption', level: 2, duration: 5 },
] as const;

export function isTotemOfUndyingName(name: string | undefined): boolean {
  return name?.replace(/^minecraft:/, '').toLowerCase() === 'totem_of_undying';
}

/** Java checks the selected main hand before the offhand. */
export function findHeldTotemHand(
  mainhand: ItemStack | null | undefined,
  offhand: ItemStack | null | undefined,
  resolveName: (itemId: number) => string | undefined,
): TotemHand | null {
  if (mainhand && isTotemOfUndyingName(resolveName(mainhand.id))) return 'mainhand';
  if (offhand && isTotemOfUndyingName(resolveName(offhand.id))) return 'offhand';
  return null;
}

export function consumeTotemStack(stack: ItemStack | null | undefined): ItemStack | null {
  if (!stack) return null;
  const count = Math.max(0, Math.floor(stack.count) - 1);
  return count > 0 ? { ...stack, count } : null;
}

/**
 * The project's damage taxonomy has no /kill or void damage kind. Every modeled
 * ordinary damage source may therefore trigger a held Totem when it would be fatal.
 */
export function shouldActivateTotem(kind: PlayerDamageKind, resultingHealth: number): boolean {
  void kind;
  return resultingHealth <= 0;
}
