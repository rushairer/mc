import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SHIELD_BLOCK_DELAY_SECONDS,
  SHIELD_DISABLE_SECONDS,
  SHIELD_MOVEMENT_MULTIPLIER,
  getAxeShieldDisableSeconds,
  getBlockedShieldDurabilityDamage,
  isShieldBlockActive,
  shieldCanBlockDamage,
  shieldFacesSource,
} from '../src/systems/ShieldRules';

test('shield becomes effective only after five game ticks', () => {
  assert.equal(SHIELD_BLOCK_DELAY_SECONDS, 0.25);
  assert.equal(isShieldBlockActive(0.249, 0), false);
  assert.equal(isShieldBlockActive(0.25, 0), true);
});

test('disabled shields cannot block until the generic cooldown expires', () => {
  assert.equal(SHIELD_DISABLE_SECONDS, 5);
  assert.equal(isShieldBlockActive(1, 0.01), false);
  assert.equal(isShieldBlockActive(1, 0), true);
});

test('blocking movement uses the Java sneaking pace multiplier', () => {
  assert.equal(SHIELD_MOVEMENT_MULTIPLIER, 0.3);
});

test('shield blocks melee projectiles and explosions but not bypassing damage kinds', () => {
  assert.equal(shieldCanBlockDamage('mob'), true);
  assert.equal(shieldCanBlockDamage('projectile'), true);
  assert.equal(shieldCanBlockDamage('explosion'), true);
  assert.equal(shieldCanBlockDamage('fall'), false);
  assert.equal(shieldCanBlockDamage('drown'), false);
  assert.equal(shieldCanBlockDamage('starve'), false);
  assert.equal(shieldCanBlockDamage('wither'), false);
  assert.equal(shieldCanBlockDamage('magic'), false);
  assert.equal(shieldCanBlockDamage('fire'), false);
  assert.equal(shieldCanBlockDamage('lava'), false);
  assert.equal(shieldCanBlockDamage('generic'), false);
});

test('shield only covers the horizontal hemisphere in front of the player', () => {
  assert.equal(shieldFacesSource(0, -1, 0, 1), true);
  assert.equal(shieldFacesSource(0, -1, 0, -1), false);
  assert.equal(shieldFacesSource(0, -1, 1, 0), false);
});

test('shield durability follows the blocked-damage threshold and ceil rule', () => {
  assert.equal(getBlockedShieldDurabilityDamage(2.99), 0);
  assert.equal(getBlockedShieldDurabilityDamage(3), 3);
  assert.equal(getBlockedShieldDurabilityDamage(5.2), 6);
});

test('Java 26.3 axes no longer disable shields', () => {
  assert.equal(getAxeShieldDisableSeconds(false), 0);
  assert.equal(getAxeShieldDisableSeconds(true), 0);
});
