import assert from 'node:assert/strict';
import test from 'node:test';
import { getDamageShake, getVignetteOpacity, normalizeDamageFlash } from '../src/systems/FeelRules';

test('damage flash normalizes to 0..1 over the flash duration', () => {
  assert.equal(normalizeDamageFlash(0.3), 1);
  assert.equal(normalizeDamageFlash(0.15), 0.5);
  assert.equal(normalizeDamageFlash(0), 0);
  assert.equal(normalizeDamageFlash(-1), 0);
  assert.equal(normalizeDamageFlash(10), 1, 'clamped at 1');
});

test('camera shake grows with the flash and caps', () => {
  assert.equal(getDamageShake(0), 0);
  assert.ok(getDamageShake(0.3) > getDamageShake(0.1), 'stronger flash shakes more');
  assert.equal(getDamageShake(10), 0.05, 'capped');
});

test('vignette opacity follows the flash', () => {
  assert.equal(getVignetteOpacity(1), 0.75);
  assert.equal(getVignetteOpacity(0.5), 0.375);
  assert.equal(getVignetteOpacity(2), 0.85, 'capped at 0.85');
});
