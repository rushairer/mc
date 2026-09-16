import type { PlayerDamageKind } from './DamageRules';
import { getShieldDurabilityDamage } from './DurabilityRules';

export const SHIELD_BLOCK_DELAY_SECONDS = 5 / 20;
export const SHIELD_DISABLE_SECONDS = 5;
export const SHIELD_MOVEMENT_MULTIPLIER = 0.3;

/** Project damage kinds that are blockable by a Java 1.20.1 shield. */
export function shieldCanBlockDamage(kind: PlayerDamageKind): boolean {
  switch (kind) {
    case 'mob':
    case 'projectile':
    case 'explosion':
      return true;
    default:
      return false;
  }
}

/**
 * Java 1.20.1 uses a horizontal hemisphere test. sourceToPlayer must point
 * from the damage source toward the player; a negative dot means the source is
 * in front of the player's facing direction.
 */
export function shieldFacesSource(
  facingX: number,
  facingZ: number,
  sourceToPlayerX: number,
  sourceToPlayerZ: number,
): boolean {
  const facingLength = Math.hypot(facingX, facingZ);
  const sourceLength = Math.hypot(sourceToPlayerX, sourceToPlayerZ);
  if (facingLength === 0 || sourceLength === 0) return false;
  const dot = (facingX / facingLength) * (sourceToPlayerX / sourceLength)
    + (facingZ / facingLength) * (sourceToPlayerZ / sourceLength);
  return dot < 0;
}

export function isShieldBlockActive(usingSeconds: number, disabledSeconds: number): boolean {
  return disabledSeconds <= 0 && usingSeconds >= SHIELD_BLOCK_DELAY_SECONDS;
}

export function getBlockedShieldDurabilityDamage(blockedDamage: number): number {
  return getShieldDurabilityDamage(blockedDamage);
}

/**
 * Java 1.20.1 has MC-197537: player axe hits disable an active shield for five
 * seconds regardless of sprint/efficiency/cooldown. Preserve actual 1.20.1.
 */
export function getAxeShieldDisableSeconds(isAxeHit: boolean): number {
  return isAxeHit ? SHIELD_DISABLE_SECONDS : 0;
}
