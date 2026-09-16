import type { ItemStack } from '../types';

export interface ServerXpState {
  level: number;
  current: number;
  progress: number;
}

/** Java player-death XP: seven points per level, capped at one hundred. */
export function getDeathXpDrop(level: number, keepInventory = false): number {
  if (keepInventory || !Number.isFinite(level)) return 0;
  return Math.min(100, Math.max(0, Math.floor(level)) * 7);
}

export function resetXpAfterDeath(state: ServerXpState, keepInventory = false): ServerXpState {
  if (keepInventory) return { ...state };
  return { level: 0, current: 0, progress: 0 };
}

/** Curse of Vanishing items disappear instead of entering the death-drop list. */
export function shouldDropStackOnDeath(stack: ItemStack | null | undefined, keepInventory = false): boolean {
  if (!stack || keepInventory) return false;
  return !(stack.enchantments ?? []).some((enchantment) => String(enchantment.id) === 'vanishing_curse');
}

export function cloneDeathDrop(stack: ItemStack): ItemStack {
  return {
    ...stack,
    enchantments: stack.enchantments?.map((enchantment) => ({ ...enchantment })),
  };
}
