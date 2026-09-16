import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BOW_FULL_CHARGE_SECONDS,
  BOW_MIN_RELEASE_SECONDS,
  CROSSBOW_BASE_CHARGE_SECONDS,
  canReleaseBow,
  getBowPower,
  getCrossbowChargeSeconds,
} from '../src/systems/RangedRules';

test('bow reaches full power after twenty game ticks', () => {
  assert.equal(BOW_FULL_CHARGE_SECONDS, 1);
  assert.equal(getBowPower(0), 0);
  assert.equal(getBowPower(1), 1);
  assert.equal(getBowPower(2), 1);
});

test('bow power follows the Java quadratic draw curve', () => {
  const expected = (0.5 * 0.5 + 0.5 * 2) / 3;
  assert.ok(Math.abs(getBowPower(0.5) - expected) < 1e-12);
});

test('bow ignores releases before three game ticks', () => {
  assert.equal(BOW_MIN_RELEASE_SECONDS, 0.15);
  assert.equal(canReleaseBow(0.149), false);
  assert.equal(canReleaseBow(0.15), true);
});

test('crossbow base load time is twenty-five game ticks', () => {
  assert.equal(CROSSBOW_BASE_CHARGE_SECONDS, 1.25);
  assert.equal(getCrossbowChargeSeconds(0), 1.25);
});

test('Quick Charge removes five game ticks per level', () => {
  assert.equal(getCrossbowChargeSeconds(1), 1);
  assert.equal(getCrossbowChargeSeconds(2), 0.75);
  assert.equal(getCrossbowChargeSeconds(3), 0.5);
});
