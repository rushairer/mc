import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyArmorReduction,
  applyDamageProtection,
  applyEnchantmentProtection,
  baseArmorApplies,
  getProtectionEpf,
} from '../src/systems/DamageRules';

const close = (actual: number, expected: number, epsilon = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);

test('armor reduction is damage dependent rather than a flat four percent per point', () => {
  close(applyArmorReduction(10, 20, 0), 4);
  close(applyArmorReduction(20, 20, 0), 12);
});

test('diamond toughness preserves more armor against large hits', () => {
  close(applyArmorReduction(20, 20, 8), 8);
});

test('netherite toughness preserves still more armor against large hits', () => {
  close(applyArmorReduction(20, 20, 12), 7.2);
});

test('very large hits still retain the Java minimum armor contribution', () => {
  close(applyArmorReduction(100, 20, 0), 84);
});

test('fall drowning magic wither starvation and generic bypass base armor', () => {
  for (const kind of ['fall', 'drown', 'magic', 'wither', 'starve', 'generic'] as const) {
    assert.equal(baseArmorApplies(kind), false, kind);
  }
});

test('melee projectile fire lava and explosion damage can use base armor', () => {
  for (const kind of ['mob', 'projectile', 'fire', 'lava', 'explosion'] as const) {
    assert.equal(baseArmorApplies(kind), true, kind);
  }
});

test('Protection contributes one EPF per level for ordinary damage', () => {
  assert.equal(getProtectionEpf('mob', { protection: 16 }), 16);
  close(applyEnchantmentProtection(10, 16), 3.6);
});

test('specialized protections contribute two EPF per level', () => {
  assert.equal(getProtectionEpf('fire', { fireProtection: 4 }), 8);
  assert.equal(getProtectionEpf('lava', { fireProtection: 4 }), 8);
  assert.equal(getProtectionEpf('explosion', { blastProtection: 4 }), 8);
  assert.equal(getProtectionEpf('projectile', { projectileProtection: 4 }), 8);
});

test('Feather Falling contributes three EPF per level to fall damage', () => {
  assert.equal(getProtectionEpf('fall', { featherFalling: 4 }), 12);
});

test('all applicable armor enchantment EPF is capped at twenty', () => {
  assert.equal(getProtectionEpf('projectile', {
    protection: 16,
    projectileProtection: 16,
  }), 20);
  close(applyEnchantmentProtection(10, 20), 2);
});

test('starvation bypasses enchantment reduction', () => {
  assert.equal(getProtectionEpf('starve', {
    protection: 16,
    fireProtection: 16,
    blastProtection: 16,
    projectileProtection: 16,
    featherFalling: 16,
  }), 0);
});

test('fall damage bypasses armor but still receives Protection and Feather Falling', () => {
  const damage = applyDamageProtection(10, 'fall', 20, 12, {
    protection: 4,
    featherFalling: 4,
  });
  // 4 EPF Protection + 12 EPF Feather Falling = 16 EPF => 64% reduction.
  close(damage, 3.6);
});

test('damage mitigation has no artificial one-point floor', () => {
  close(applyEnchantmentProtection(0.5, 20), 0.1);
});
