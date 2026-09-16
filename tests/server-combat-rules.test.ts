import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CHARGED_ATTACK_THRESHOLD,
  CREATIVE_ENTITY_REACH,
  SURVIVAL_ENTITY_REACH,
  applyKnockbackResistance,
  getAttackStrength,
  getEntityInteractionReach,
  getNetheriteKnockbackResistance,
  getServerKnockbackPlan,
  getServerMeleeDamage,
  getServerMeleeProfile,
  isEntityAttackInReach,
  isServerCriticalHit,
  parseEntityAttackIntent,
  roundAttackCooldownTicks,
} from '../src/server/ServerCombatRules';

test('server accepts only explicit attack entity intents', () => {
  assert.deepEqual(parseEntityAttackIntent({ type: 'attack', entityId: 42 }), { entityId: 42 });
  assert.deepEqual(parseEntityAttackIntent({ type: 'attack', entityId: 'player_abc' }), { entityId: 'player_abc' });
  assert.equal(parseEntityAttackIntent({ type: 'interact', entityId: 42 }), null);
  assert.equal(parseEntityAttackIntent({ type: 'attack', entityId: -1 }), null);
  assert.equal(parseEntityAttackIntent({ type: 'attack', entityId: '' }), null);
  assert.equal(parseEntityAttackIntent(null), null);
});

test('survival and creative entity reach use Java distances', () => {
  assert.equal(SURVIVAL_ENTITY_REACH, 3);
  assert.equal(CREATIVE_ENTITY_REACH, 5);
  assert.equal(getEntityInteractionReach('survival'), 3);
  assert.equal(getEntityInteractionReach('creative'), 5);
});

test('server reach check rejects survival hits beyond three blocks', () => {
  const attacker = { x: 0, y: 64, z: 0 };
  assert.equal(isEntityAttackInReach(attacker, { x: 0, y: 64.72, z: -3 }, 'survival'), true);
  assert.equal(isEntityAttackInReach(attacker, { x: 0, y: 64.72, z: -3.01 }, 'survival'), false);
  assert.equal(isEntityAttackInReach(attacker, { x: 0, y: 64.72, z: -4.5 }, 'creative'), true);
});

test('server derives stone sword and axe damage from the held item registry', () => {
  const sword = getServerMeleeProfile({ id: 272, count: 1 });
  const axe = getServerMeleeProfile({ id: 275, count: 1 });
  assert.equal(sword.baseAttributeDamage, 5);
  assert.equal(axe.baseAttributeDamage, 9);
  assert.equal(sword.isSword, true);
  assert.equal(sword.isAxe, false);
  assert.equal(axe.isAxe, true);
});

test('server derives Sharpness and Knockback from the held stack rather than packet data', () => {
  const profile = getServerMeleeProfile({
    id: 272,
    count: 1,
    enchantments: [
      { id: 'sharpness', level: 3 },
      { id: 'knockback', level: 2 },
    ],
  });
  assert.equal(profile.enchantmentDamage, 2);
  assert.equal(profile.knockbackLevel, 2);
});

test('Java whole-tick cooldown rounding keeps exact halves down', () => {
  assert.equal(roundAttackCooldownTicks(12.5), 12);
  assert.equal(roundAttackCooldownTicks(16.666), 17);
  assert.equal(roundAttackCooldownTicks(20), 20);
  assert.equal(roundAttackCooldownTicks(25), 25);
});

test('weapon attack speed controls integer server cooldown ticks', () => {
  const sword = getServerMeleeProfile({ id: 272, count: 1 });
  const axe = getServerMeleeProfile({ id: 275, count: 1 });
  assert.equal(sword.cooldownTicks, 12);
  assert.equal(axe.cooldownTicks, 25);
});

test('attack strength uses the Java half-tick bias', () => {
  assert.equal(getAttackStrength(null, 100, 12), 1);
  assert.ok(Math.abs(getAttackStrength(100, 100, 12) - (0.5 / 12)) < 1e-12);
  assert.ok(Math.abs(getAttackStrength(100, 110, 12) - (10.5 / 12)) < 1e-12);
  assert.equal(getAttackStrength(100, 112, 12), 1);
});

test('first hit is fully charged and immediate spam follows the cooldown damage curve', () => {
  const sword = { id: 272, count: 1 };
  assert.equal(getServerMeleeDamage(sword, null, 100), 5);
  const spam = getServerMeleeDamage(sword, 100, 100);
  assert.ok(spam > 1 && spam < 1.02);
  assert.equal(getServerMeleeDamage(sword, 100, 112), 5);
});

test('server criticals require charged descending non-sprinting airborne state', () => {
  assert.equal(CHARGED_ATTACK_THRESHOLD, 0.9);
  const base = { descending: true, onGround: false, sprinting: false };
  assert.equal(isServerCriticalHit(0.9, base), true);
  assert.equal(isServerCriticalHit(0.899, base), false);
  assert.equal(isServerCriticalHit(1, { ...base, descending: false }), false);
  assert.equal(isServerCriticalHit(1, { ...base, onGround: true }), false);
  assert.equal(isServerCriticalHit(1, { ...base, sprinting: true }), false);
  assert.equal(isServerCriticalHit(1, { ...base, inWater: true }), false);
  assert.equal(isServerCriticalHit(1, { ...base, climbing: true }), false);
  assert.equal(isServerCriticalHit(1, { ...base, riding: true }), false);
  assert.equal(isServerCriticalHit(1, { ...base, blinded: true }), false);
});

test('Java critical multiplies base attack damage but not Sharpness bonus', () => {
  const sword = {
    id: 272,
    count: 1,
    enchantments: [{ id: 'sharpness' as const, level: 3 }],
  };
  assert.equal(getServerMeleeDamage(sword, null, 100, false), 7);
  assert.equal(getServerMeleeDamage(sword, null, 100, true), 9.5);
});

test('sprint knockback adds one level only for charged attacks', () => {
  const sword = { id: 272, count: 1 };
  assert.deepEqual(getServerKnockbackPlan(sword, 0.89, true), { strength: 0, sprintKnockback: false });
  assert.deepEqual(getServerKnockbackPlan(sword, 0.9, true), { strength: 1, sprintKnockback: true });
  assert.deepEqual(
    getServerKnockbackPlan({ id: 272, count: 1, enchantments: [{ id: 'knockback', level: 2 }] }, 1, true),
    { strength: 3, sprintKnockback: true },
  );
});

test('knockback resistance scales strength multiplicatively', () => {
  assert.equal(applyKnockbackResistance(2, 0), 2);
  assert.equal(applyKnockbackResistance(2, 0.4), 1.2);
  assert.equal(applyKnockbackResistance(2, 1), 0);
});

test('each netherite armor piece contributes ten percent knockback resistance', () => {
  assert.equal(getNetheriteKnockbackResistance([{ id: 20177, count: 1 }]), 0.1);
  assert.equal(getNetheriteKnockbackResistance([]), 0);
});

test('server profile carries Java melee durability cost', () => {
  assert.equal(getServerMeleeProfile({ id: 272, count: 1 }).durabilityCost, 1);
  assert.equal(getServerMeleeProfile({ id: 275, count: 1 }).durabilityCost, 2);
  assert.equal(getServerMeleeProfile({ id: 261, count: 1 }).durabilityCost, 0);
});
