import assert from 'node:assert/strict';
import test from 'node:test';
import { ENDER_PEARL_SELF_DAMAGE, getProjectileImpactBehavior } from '../src/server/ServerProjectileRules';

test('Java 26.3 ender pearl impact teleports owner and resets momentum', () => {
  assert.equal(ENDER_PEARL_SELF_DAMAGE, 5);
  assert.deepEqual(getProjectileImpactBehavior('ender_pearl'), {
    damagesHitEntity: false,
    teleportsOwner: true,
    resetsOwnerMomentum: true,
    ownerDamage: 5,
  });
});

test('ordinary projectiles remain entity-damaging without teleport semantics', () => {
  for (const type of ['arrow', 'fireball', 'shulker_bullet', 'snowball', 'egg', 'potion', 'trident'] as const) {
    assert.deepEqual(getProjectileImpactBehavior(type), {
      damagesHitEntity: true,
      teleportsOwner: false,
      resetsOwnerMomentum: false,
      ownerDamage: 0,
    });
  }
});
