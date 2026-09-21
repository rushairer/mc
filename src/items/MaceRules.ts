export const MACE_DURABILITY = 500;
export const MACE_ATTACK_SPEED = 0.6;
export const MACE_BASE_ATTRIBUTE_DAMAGE = 6;
export const MACE_SMASH_FALL_THRESHOLD = 1.5;
export const MACE_HEAVY_SMASH_THRESHOLD = 5;
export const MACE_SMASH_KNOCKBACK_RADIUS = 3.5;
export const MACE_SMASH_KNOCKBACK_POWER = 0.7;

export interface MaceVector {
  x: number;
  y: number;
  z: number;
}

export function isMaceSmash(fallDistance: number): boolean {
  return Number.isFinite(fallDistance) && fallDistance > MACE_SMASH_FALL_THRESHOLD;
}

/** Java 1.21+ smash bonus: first 3 blocks ×4, next 5 ×2, remainder ×1. */
export function getMaceSmashBonus(fallDistance: number): number {
  const distance = Math.max(0, Number.isFinite(fallDistance) ? fallDistance : 0);
  if (!isMaceSmash(distance)) return 0;
  const first = Math.min(distance, 3) * 4;
  const second = Math.min(Math.max(distance - 3, 0), 5) * 2;
  const remaining = Math.max(distance - 8, 0);
  return first + second + remaining;
}

export function getMaceSmashKnockbackStrength(fallDistance: number): number {
  if (!isMaceSmash(fallDistance)) return 0;
  return MACE_SMASH_KNOCKBACK_POWER * (fallDistance > MACE_HEAVY_SMASH_THRESHOLD ? 2 : 1);
}

export function getMaceSmashImpulse(
  impact: MaceVector,
  target: MaceVector,
  fallDistance: number,
): MaceVector {
  const dx = target.x - impact.x;
  const dz = target.z - impact.z;
  const horizontalDistance = Math.hypot(dx, dz);
  if (horizontalDistance > MACE_SMASH_KNOCKBACK_RADIUS || !isMaceSmash(fallDistance)) {
    return { x: 0, y: 0, z: 0 };
  }
  const length = Math.max(horizontalDistance, 0.001);
  const falloff = 1 - Math.min(1, horizontalDistance / MACE_SMASH_KNOCKBACK_RADIUS);
  const strength = getMaceSmashKnockbackStrength(fallDistance) * (0.5 + falloff * 0.5);
  return {
    x: dx / length * strength,
    y: 0.18 + strength * 0.12,
    z: dz / length * strength,
  };
}
