import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getAttackCooldownSeconds,
  getAttackSpeed,
  getMeleeAttackDamage,
} from '../src/items/CombatAttributes';
import {
  calculateMeleeDamage,
  getBaseDamageCooldownScale,
  getEnchantmentDamageCooldownScale,
  getSweepDamage,
  isChargedMeleeAttack,
} from '../src/systems/CombatRules';

const close = (actual: number, expected: number, epsilon = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);

test('generic items use Java attack speed 4 and a quarter-second cooldown', () => {
  assert.equal(getAttackSpeed(), 4);
  close(getAttackCooldownSeconds(), 0.25);
});

test('swords use attack speed 1.6 and 0.625 second cooldown', () => {
  assert.equal(getAttackSpeed('sword', 'diamond'), 1.6);
  close(getAttackCooldownSeconds('sword', 'diamond'), 0.625);
});

test('pickaxes use attack speed 1.2 while shovels use 1.0', () => {
  assert.equal(getAttackSpeed('pickaxe', 'diamond'), 1.2);
  assert.equal(getAttackSpeed('shovel', 'diamond'), 1.0);
  close(getAttackCooldownSeconds('pickaxe', 'diamond'), 1 / 1.2);
  close(getAttackCooldownSeconds('shovel', 'diamond'), 1);
});

test('axe attack speed varies by material like Java 1.20.1', () => {
  assert.deepEqual(
    ['wood', 'gold', 'stone', 'iron', 'diamond', 'netherite'].map((material) =>
      getAttackSpeed('axe', material as any)),
    [0.8, 1.0, 0.8, 0.9, 1.0, 1.0],
  );
});

test('hoe attack speed varies from 1 through 4 by material', () => {
  assert.deepEqual(
    ['wood', 'gold', 'stone', 'iron', 'diamond', 'netherite'].map((material) =>
      getAttackSpeed('hoe', material as any)),
    [1, 1, 2, 3, 4, 4],
  );
});

test('sword attack damage matches Java material progression', () => {
  assert.deepEqual(
    ['wood', 'gold', 'stone', 'iron', 'diamond', 'netherite'].map((material) =>
      getMeleeAttackDamage('sword', material as any)),
    [4, 4, 5, 6, 7, 8],
  );
});

test('axes use Java high single-hit damage by material', () => {
  assert.deepEqual(
    ['wood', 'gold', 'stone', 'iron', 'diamond', 'netherite'].map((material) =>
      getMeleeAttackDamage('axe', material as any)),
    [7, 7, 9, 9, 9, 10],
  );
});

test('pickaxe and shovel attack damage include the player base damage', () => {
  assert.equal(getMeleeAttackDamage('pickaxe', 'wood'), 2);
  assert.equal(getMeleeAttackDamage('pickaxe', 'netherite'), 6);
  assert.equal(getMeleeAttackDamage('shovel', 'wood'), 2.5);
  assert.equal(getMeleeAttackDamage('shovel', 'netherite'), 6.5);
});

test('hoes deal base one attack damage despite their material', () => {
  assert.equal(getMeleeAttackDamage('hoe', 'wood'), 1);
  assert.equal(getMeleeAttackDamage('hoe', 'netherite'), 1);
});

test('base melee cooldown follows 0.2 + 0.8 p squared', () => {
  close(getBaseDamageCooldownScale(0), 0.2);
  close(getBaseDamageCooldownScale(0.5), 0.4);
  close(getBaseDamageCooldownScale(1), 1);
});

test('enchantment melee bonus scales linearly with attack strength', () => {
  close(getEnchantmentDamageCooldownScale(0), 0);
  close(getEnchantmentDamageCooldownScale(0.5), 0.5);
  close(getEnchantmentDamageCooldownScale(1), 1);
});

test('charged melee threshold is strictly greater than ninety percent', () => {
  assert.equal(isChargedMeleeAttack(0.9), false);
  assert.equal(isChargedMeleeAttack(0.900001), true);
});

test('critical hits multiply base damage but not enchantment bonus', () => {
  const damage = calculateMeleeDamage({
    baseAttributeDamage: 13,
    enchantmentDamage: 3,
    cooldownProgress: 0.94,
    critical: true,
  });
  close(damage, 20.50416, 1e-5);
});

test('sweep side hits deal exactly one damage without Sweeping Edge', () => {
  assert.equal(getSweepDamage(4, 0), 1);
  assert.equal(getSweepDamage(20, 0), 1);
});

test('Sweeping Edge transfer formula is ready for later enchantment coverage', () => {
  close(getSweepDamage(8, 1), 5);
  close(getSweepDamage(8, 2), 1 + 16 / 3);
  close(getSweepDamage(8, 3), 7);
});
