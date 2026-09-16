import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getArmorDurabilityDamage,
  getDurabilityUseChance,
  getMeleeDurabilityCost,
  getMendingRepairCapacity,
  getMendingXpCost,
  getShieldDurabilityDamage,
} from '../src/systems/DurabilityRules';

test('armor durability loss uses one point per four raw damage with a one-point floor', () => {
  assert.equal(getArmorDurabilityDamage(0), 0);
  assert.equal(getArmorDurabilityDamage(1), 1);
  assert.equal(getArmorDurabilityDamage(3.9), 1);
  assert.equal(getArmorDurabilityDamage(4), 1);
  assert.equal(getArmorDurabilityDamage(8), 2);
  assert.equal(getArmorDurabilityDamage(13.9), 3);
});

test('shield durability is only consumed by blocked hits of at least three damage', () => {
  assert.equal(getShieldDurabilityDamage(2.99), 0);
  assert.equal(getShieldDurabilityDamage(3), 3);
  assert.equal(getShieldDurabilityDamage(3.01), 4);
  assert.equal(getShieldDurabilityDamage(8), 8);
});

test('tool Unbreaking consumes durability with probability one over level plus one', () => {
  assert.equal(getDurabilityUseChance(0, 'tool'), 1);
  assert.equal(getDurabilityUseChance(1, 'tool'), 0.5);
  assert.ok(Math.abs(getDurabilityUseChance(2, 'tool') - 1 / 3) < 1e-12);
  assert.equal(getDurabilityUseChance(3, 'tool'), 0.25);
});

test('armor Unbreaking keeps the Java sixty-percent durability-use floor', () => {
  assert.equal(getDurabilityUseChance(0, 'armor'), 1);
  assert.equal(getDurabilityUseChance(1, 'armor'), 0.8);
  assert.ok(Math.abs(getDurabilityUseChance(2, 'armor') - 11 / 15) < 1e-12);
  assert.equal(getDurabilityUseChance(3, 'armor'), 0.7);
});

test('melee durability cost is one for swords and two for ordinary tools', () => {
  assert.equal(getMeleeDurabilityCost('sword'), 1);
  assert.equal(getMeleeDurabilityCost('axe'), 2);
  assert.equal(getMeleeDurabilityCost('pickaxe'), 2);
  assert.equal(getMeleeDurabilityCost('shovel'), 2);
  assert.equal(getMeleeDurabilityCost('hoe'), 2);
  assert.equal(getMeleeDurabilityCost('bow'), 0);
});

test('Mending converts one XP into two durability and charges only whole repaired pairs', () => {
  assert.equal(getMendingRepairCapacity(0), 0);
  assert.equal(getMendingRepairCapacity(1), 2);
  assert.equal(getMendingRepairCapacity(7), 14);
  assert.equal(getMendingXpCost(1), 0);
  assert.equal(getMendingXpCost(2), 1);
  assert.equal(getMendingXpCost(7), 3);
});
