export interface MeleeDamageInput {
  /** Attack damage attribute, including Strength/Weakness attribute modifiers. */
  baseAttributeDamage: number;
  /** Extra enchantment damage such as Sharpness/Smite. */
  enchantmentDamage: number;
  /** Attack-strength scale in [0, 1]. */
  cooldownProgress: number;
  critical: boolean;
}

export function clampAttackStrength(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.max(0, Math.min(1, progress));
}

/** Java melee base-damage cooldown curve: 20% + 80% * p^2. */
export function getBaseDamageCooldownScale(progress: number): number {
  const p = clampAttackStrength(progress);
  return 0.2 + 0.8 * p * p;
}

/** Java enchantment bonus damage scales linearly with attack strength. */
export function getEnchantmentDamageCooldownScale(progress: number): number {
  return clampAttackStrength(progress);
}

/** Charged-hit gates in Java use a strict > 0.9 comparison. */
export function isChargedMeleeAttack(progress: number): boolean {
  return clampAttackStrength(progress) > 0.9;
}

/**
 * Java Edition 1.20.1 melee damage composition.
 * Critical hits multiply the cooldown-adjusted base attribute damage only;
 * enchantment bonus damage is added afterward using the linear cooldown scale.
 */
export function calculateMeleeDamage(input: MeleeDamageInput): number {
  const p = clampAttackStrength(input.cooldownProgress);
  const base = Math.max(0, input.baseAttributeDamage)
    * getBaseDamageCooldownScale(p)
    * (input.critical ? 1.5 : 1);
  const enchantment = Math.max(0, input.enchantmentDamage)
    * getEnchantmentDamageCooldownScale(p);
  return base + enchantment;
}

/**
 * Secondary sweep targets take exactly 1 damage without Sweeping Edge.
 * Sweeping Edge transfers level/(level+1) of the attack damage in addition.
 */
export function getSweepDamage(attackDamage: number, sweepingEdgeLevel = 0): number {
  const level = Math.max(0, sweepingEdgeLevel);
  return 1 + Math.max(0, attackDamage) * (level / (level + 1));
}
