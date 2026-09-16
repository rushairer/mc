export type PlayerDamageKind =
  | 'mob'
  | 'projectile'
  | 'fall'
  | 'drown'
  | 'starve'
  | 'wither'
  | 'magic'
  | 'fire'
  | 'lava'
  | 'explosion'
  | 'generic';

export interface ProtectionLevelTotals {
  protection?: number;
  fireProtection?: number;
  blastProtection?: number;
  projectileProtection?: number;
  featherFalling?: number;
}

/** Damage kinds in this project that Java's base armor value can mitigate. */
export function baseArmorApplies(kind: PlayerDamageKind): boolean {
  switch (kind) {
    case 'mob':
    case 'projectile':
    case 'fire':
    case 'lava':
    case 'explosion':
      return true;
    default:
      return false;
  }
}

/**
 * Java Edition armor/toughness formula.
 * Armor reduction is damage-dependent and is capped at 80%.
 */
export function applyArmorReduction(
  damage: number,
  armorPoints: number,
  armorToughness: number,
): number {
  const d = Math.max(0, damage);
  if (d === 0) return 0;
  const armor = Math.max(0, armorPoints);
  const toughness = Math.max(0, Math.min(20, armorToughness));
  const effectiveArmor = Math.min(
    20,
    Math.max(armor / 5, armor - d / (2 + toughness / 4)),
  );
  return d * (1 - effectiveArmor / 25);
}

/**
 * Java 1.20.1 enchantment protection factor for the project's damage kinds.
 * Protection contributes 1 EPF/level, specialized protections 2 EPF/level,
 * and Feather Falling 3 EPF/level. Total effective EPF is capped at 20.
 */
export function getProtectionEpf(
  kind: PlayerDamageKind,
  levels: ProtectionLevelTotals,
): number {
  // Starvation bypasses effects/enchantment damage reduction in Java.
  if (kind === 'starve') return 0;

  let epf = Math.max(0, levels.protection ?? 0);
  if (kind === 'fire' || kind === 'lava') {
    epf += 2 * Math.max(0, levels.fireProtection ?? 0);
  }
  if (kind === 'explosion') {
    epf += 2 * Math.max(0, levels.blastProtection ?? 0);
  }
  if (kind === 'projectile') {
    epf += 2 * Math.max(0, levels.projectileProtection ?? 0);
  }
  if (kind === 'fall') {
    epf += 3 * Math.max(0, levels.featherFalling ?? 0);
  }
  return Math.min(20, epf);
}

/** Each EPF point removes 4% of the remaining damage, up to 80%. */
export function applyEnchantmentProtection(damage: number, epf: number): number {
  const d = Math.max(0, damage);
  const effectiveEpf = Math.max(0, Math.min(20, epf));
  return d * (1 - effectiveEpf / 25);
}

export function applyDamageProtection(
  damage: number,
  kind: PlayerDamageKind,
  armorPoints: number,
  armorToughness: number,
  levels: ProtectionLevelTotals,
): number {
  const afterArmor = baseArmorApplies(kind)
    ? applyArmorReduction(damage, armorPoints, armorToughness)
    : Math.max(0, damage);
  return applyEnchantmentProtection(afterArmor, getProtectionEpf(kind, levels));
}
