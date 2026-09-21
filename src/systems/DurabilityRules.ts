export type DurabilityItemKind = 'tool' | 'armor';

/**
 * Java 1.20.1 armor durability cost. Each equipped armor piece that is affected
 * by the damage source loses max(1, floor(rawDamage / 4)) durability.
 */
export function getArmorDurabilityDamage(rawDamage: number): number {
  if (!Number.isFinite(rawDamage) || rawDamage <= 0) return 0;
  return Math.max(1, Math.floor(rawDamage / 4));
}

/**
 * Java shield durability loss for a successful block. Hits below 3 damage do
 * not damage the shield; hits of 3 or more lose ceil(blockedDamage).
 */
export function getShieldDurabilityDamage(blockedDamage: number): number {
  if (!Number.isFinite(blockedDamage) || blockedDamage < 3) return 0;
  return Math.ceil(blockedDamage);
}

/**
 * Chance that a durability point is actually consumed by Unbreaking.
 * Armor uses Java's distinct 60% floor; tools use 1 / (level + 1).
 */
export function getDurabilityUseChance(level: number, kind: DurabilityItemKind): number {
  const normalizedLevel = Math.max(0, Math.floor(level));
  if (normalizedLevel === 0) return 1;
  if (kind === 'armor') {
    return 0.6 + 0.4 / (normalizedLevel + 1);
  }
  return 1 / (normalizedLevel + 1);
}

/** Java melee durability use: swords cost one point; ordinary tools cost two. */
export function getMeleeDurabilityCost(toolType?: string): number {
  if (toolType === 'sword' || toolType === 'mace') return 1;
  if (toolType === 'axe' || toolType === 'pickaxe' || toolType === 'shovel' || toolType === 'hoe') {
    return 2;
  }
  return 0;
}

/** Mending converts one XP point into two durability points. */
export function getMendingRepairCapacity(xp: number): number {
  if (!Number.isFinite(xp) || xp <= 0) return 0;
  return Math.max(0, Math.floor(xp)) * 2;
}

/** XP consumed to repair a given number of durability points. */
export function getMendingXpCost(repairedDurability: number): number {
  if (!Number.isFinite(repairedDurability) || repairedDurability <= 0) return 0;
  return Math.floor(repairedDurability / 2);
}
