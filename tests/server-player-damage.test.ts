import assert from 'node:assert/strict';
import test from 'node:test';
import {
  damageDurableStack,
  damageServerArmorForHit,
  getServerArmorSnapshot,
  mitigateServerPlayerDamage,
  resolveServerShieldBlock,
} from '../src/server/ServerPlayerDamage';

test('server totals full diamond armor as twenty defense and eight toughness', () => {
  const armor = [310, 311, 312, 313].map((id) => ({ id, count: 1 }));
  const snapshot = getServerArmorSnapshot(armor);
  assert.equal(snapshot.armorPoints, 20);
  assert.equal(snapshot.toughness, 8);
});

test('server sums protection enchantments across every equipped armor piece', () => {
  const armor = [310, 311, 312, 313].map((id) => ({
    id,
    count: 1,
    enchantments: [{ id: 'protection' as const, level: 4 }],
  }));
  const snapshot = getServerArmorSnapshot(armor);
  assert.equal(snapshot.protectionLevels.protection, 16);
});

test('server mitigation applies armor toughness and enchantment protection', () => {
  const plain = [310, 311, 312, 313].map((id) => ({ id, count: 1 }));
  const protected = plain.map((stack) => ({
    ...stack,
    enchantments: [{ id: 'protection' as const, level: 4 }],
  }));
  const raw = 10;
  const plainDamage = mitigateServerPlayerDamage(raw, 'mob', plain);
  const protectedDamage = mitigateServerPlayerDamage(raw, 'mob', protected);
  assert.ok(plainDamage < raw);
  assert.ok(protectedDamage < plainDamage);
});

test('server armor durability loss affects every armor piece for an armor-blockable hit', () => {
  const armor = [310, 311, 312, 313].map((id) => ({ id, count: 1, durability: 100 }));
  const next = damageServerArmorForHit(armor, 8, 'mob', () => 0);
  for (const stack of next) assert.equal(stack?.durability, 98);
});

test('damage sources that bypass base armor do not consume armor durability', () => {
  const armor = [310, 311, 312, 313].map((id) => ({ id, count: 1, durability: 100 }));
  const next = damageServerArmorForHit(armor, 8, 'fall', () => 0);
  for (const stack of next) assert.equal(stack?.durability, 100);
});

test('Unbreaking is evaluated per durability point on server-owned stacks', () => {
  const stack = {
    id: 276,
    count: 1,
    durability: 100,
    enchantments: [{ id: 'unbreaking' as const, level: 3 }],
  };
  assert.equal(damageDurableStack(stack, 1, 'tool', () => 0.24)?.durability, 99);
  assert.equal(damageDurableStack(stack, 1, 'tool', () => 0.26)?.durability, 100);
});

test('shield is inactive during its five-tick startup delay', () => {
  const result = resolveServerShieldBlock(
    6,
    'mob',
    { isBlocking: true, usingSeconds: 0.20, disabledSeconds: 0, x: 0, z: 0, yaw: 0 },
    0,
    -2,
    false,
  );
  assert.equal(result.blocked, false);
});

test('shield blocks a front hit after startup but not a hit from behind', () => {
  const state = { isBlocking: true, usingSeconds: 0.25, disabledSeconds: 0, x: 0, z: 0, yaw: 0 };
  assert.equal(resolveServerShieldBlock(6, 'mob', state, 0, -2, false).blocked, true);
  assert.equal(resolveServerShieldBlock(6, 'mob', state, 0, 2, false).blocked, false);
});

test('blocked damage drives shield durability and Java 1.20.1 axe disable', () => {
  const state = { isBlocking: true, usingSeconds: 0.25, disabledSeconds: 0, x: 0, z: 0, yaw: 0 };
  const ordinary = resolveServerShieldBlock(2.9, 'mob', state, 0, -2, false);
  assert.deepEqual(ordinary, { blocked: true, durabilityDamage: 0, disableSeconds: 0 });

  const axe = resolveServerShieldBlock(6.2, 'mob', state, 0, -2, true);
  assert.deepEqual(axe, { blocked: true, durabilityDamage: 7, disableSeconds: 5 });
});

test('disabled shield cannot block until its cooldown expires', () => {
  const result = resolveServerShieldBlock(
    6,
    'projectile',
    { isBlocking: true, usingSeconds: 1, disabledSeconds: 0.1, x: 0, z: 0, yaw: 0 },
    0,
    -2,
    false,
  );
  assert.equal(result.blocked, false);
});
