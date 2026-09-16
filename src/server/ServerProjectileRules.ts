export type ServerProjectileKind =
  | 'arrow'
  | 'fireball'
  | 'shulker_bullet'
  | 'snowball'
  | 'egg'
  | 'ender_pearl'
  | 'potion'
  | 'trident';

export const ENDER_PEARL_SELF_DAMAGE = 5;

export interface ProjectileImpactBehavior {
  damagesHitEntity: boolean;
  teleportsOwner: boolean;
  resetsOwnerMomentum: boolean;
  ownerDamage: number;
}

/**
 * Ender Pearls are teleport projectiles, not ordinary damage projectiles.
 * Java 26.3 additionally resets the teleported player's momentum on impact.
 */
export function getProjectileImpactBehavior(type: ServerProjectileKind): ProjectileImpactBehavior {
  if (type === 'ender_pearl') {
    return {
      damagesHitEntity: false,
      teleportsOwner: true,
      resetsOwnerMomentum: true,
      ownerDamage: ENDER_PEARL_SELF_DAMAGE,
    };
  }

  return {
    damagesHitEntity: true,
    teleportsOwner: false,
    resetsOwnerMomentum: false,
    ownerDamage: 0,
  };
}
