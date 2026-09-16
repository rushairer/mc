import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HURT_COOLDOWN_TOTAL_SECONDS,
  HURT_INVULNERABILITY_SECONDS,
  createHurtCooldownState,
  resolveHurtDamage,
  tickHurtCooldown,
} from '../src/systems/HurtCooldown';

test('a full hit starts the Java twenty-tick hurt timer', () => {
  const result = resolveHurtDamage(createHurtCooldownState(), 6);
  assert.equal(result.appliedDamage, 6);
  assert.equal(result.accepted, true);
  assert.equal(result.next.remainingSeconds, 1);
  assert.equal(HURT_COOLDOWN_TOTAL_SECONDS, 1);
  assert.equal(HURT_INVULNERABILITY_SECONDS, 0.5);
});

test('equal or weaker hits are ignored during the protected ten ticks', () => {
  const first = resolveHurtDamage(createHurtCooldownState(), 6);
  const state = tickHurtCooldown(first.next, 0.1);
  assert.equal(resolveHurtDamage(state, 6).appliedDamage, 0);
  assert.equal(resolveHurtDamage(state, 4).appliedDamage, 0);
});

test('stronger hits during protected ticks apply only the excess damage', () => {
  const first = resolveHurtDamage(createHurtCooldownState(), 4);
  const state = tickHurtCooldown(first.next, 0.1);
  const second = resolveHurtDamage(state, 7);
  assert.equal(second.appliedDamage, 3);
  assert.equal(second.next.lastDamage, 7);
  assert.equal(second.next.remainingSeconds, state.remainingSeconds);
});

test('once the protected half expires the next hit lands in full and resets the timer', () => {
  const first = resolveHurtDamage(createHurtCooldownState(), 5);
  const state = tickHurtCooldown(first.next, 0.5);
  const second = resolveHurtDamage(state, 3);
  assert.equal(second.appliedDamage, 3);
  assert.equal(second.next.remainingSeconds, 1);
  assert.equal(second.next.lastDamage, 3);
});

test('cooldown state decays to a clean idle state', () => {
  const first = resolveHurtDamage(createHurtCooldownState(), 5);
  const state = tickHurtCooldown(first.next, 1);
  assert.deepEqual(state, createHurtCooldownState());
});
