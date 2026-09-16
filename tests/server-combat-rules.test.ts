import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CREATIVE_ENTITY_REACH,
  SURVIVAL_ENTITY_REACH,
  getAttackStrength,
  getEntityInteractionReach,
  getServerMeleeDamage,
  getServerMeleeProfile,
  isEntityAttackInReach,
  parseEntityAttackIntent,
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
  assert.equal(sword.isAxe, false);
  assert.equal(axe.isAxe, true);
});

test('server derives Sharpness bonus from the held stack rather than packet data', () => {
  const profile = getServerMeleeProfile({
    id: 272,
    count: 1,
    enchantments: [{ id: 'sharpness', level: 3 }],
  });
  assert.equal(profile.enchantmentDamage, 2);
});

test('weapon attack speed controls server cooldown ticks', () => {
  const sword = getServerMeleeProfile({ id: 272, count: 1 });
  const axe = getServerMeleeProfile({ id: 275, count: 1 });
  assert.equal(sword.cooldownTicks, 12.5);
  assert.equal(axe.cooldownTicks, 25);
});

test('first server hit is fully charged and immediate spam uses the Java cooldown curve', () => {
  const sword = { id: 272, count: 1 };
  assert.equal(getAttackStrength(null, 100, 12.5), 1);
  assert.equal(getAttackStrength(100, 100, 12.5), 0);
  assert.equal(getServerMeleeDamage(sword, null, 100), 5);
  assert.equal(getServerMeleeDamage(sword, 100, 100), 1);
  assert.equal(getServerMeleeDamage(sword, 100, 113), 5);
});

test('server profile carries Java melee durability cost', () => {
  assert.equal(getServerMeleeProfile({ id: 272, count: 1 }).durabilityCost, 1);
  assert.equal(getServerMeleeProfile({ id: 275, count: 1 }).durabilityCost, 2);
  assert.equal(getServerMeleeProfile({ id: 261, count: 1 }).durabilityCost, 0);
});
