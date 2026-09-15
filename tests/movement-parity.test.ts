import assert from 'node:assert/strict';
import test from 'node:test';
import {
  JUMP_VELOCITY,
  SNEAK_SPEED_MULTIPLIER,
  SPRINT_SPEED,
  TICK_RATE,
  WALK_SPEED,
} from '../src/constants';

test('walking and sprinting speeds match Java steady-state values', () => {
  assert.equal(WALK_SPEED, 4.317);
  assert.equal(SPRINT_SPEED, 5.612);
  assert.ok(Math.abs(SPRINT_SPEED / WALK_SPEED - 1.3) < 0.001);
});

test('sneaking remains thirty percent of walking speed', () => {
  assert.equal(SNEAK_SPEED_MULTIPLIER, 0.3);
  assert.ok(Math.abs(WALK_SPEED * SNEAK_SPEED_MULTIPLIER - 1.2951) < 1e-9);
});

test('jump impulse corresponds to 0.42 blocks per game tick', () => {
  assert.equal(TICK_RATE, 20);
  assert.equal(JUMP_VELOCITY / TICK_RATE, 0.42);
});
