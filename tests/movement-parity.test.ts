import assert from 'node:assert/strict';
import test from 'node:test';
import {
  JUMP_VELOCITY,
  SNEAK_SPEED_MULTIPLIER,
  SPRINT_SPEED,
  TICK_RATE,
  WALK_SPEED,
} from '../src/constants';
import { Player } from '../src/player/Player';

const emptyChunks = {
  getBlock: () => 0,
  isSolidBlock: () => false,
} as any;

function movementInput(overrides: Partial<Parameters<Player['update']>[1]> = {}): Parameters<Player['update']>[1] {
  return {
    dx: 0,
    dy: 0,
    forward: false,
    back: false,
    left: false,
    right: false,
    jump: false,
    sprint: false,
    sneak: false,
    fly: false,
    ...overrides,
  };
}

test('walking and sprinting speeds match Java steady-state values', () => {
  assert.equal(WALK_SPEED, 4.317);
  assert.equal(SPRINT_SPEED, 5.612);
  assert.ok(Math.abs(SPRINT_SPEED / WALK_SPEED - 1.3) < 0.001);
});

test('new players start with Java food saturation level 5', () => {
  const player = new Player(0, 64, 0);
  assert.equal(player.hunger, 20);
  assert.equal(player.saturation, 5);
});

test('sprint requires more than six food points', () => {
  const player = new Player(0, 64, 0);
  player.hunger = 6;
  player.update(0.05, movementInput({ forward: true, sprint: true }), emptyChunks);
  assert.ok(Math.abs(player.velocity.z + WALK_SPEED) < 1e-9);

  player.hunger = 7;
  player.update(0.05, movementInput({ forward: true, sprint: true }), emptyChunks);
  assert.ok(Math.abs(player.velocity.z + SPRINT_SPEED) < 1e-9);
});

test('sprint key does not turn pure strafe or backward motion into sprinting', () => {
  const strafe = new Player(0, 64, 0);
  strafe.update(0.05, movementInput({ right: true, sprint: true }), emptyChunks);
  assert.ok(Math.abs(strafe.velocity.x - WALK_SPEED) < 1e-9);

  const backward = new Player(0, 64, 0);
  backward.update(0.05, movementInput({ back: true, sprint: true }), emptyChunks);
  assert.ok(Math.abs(backward.velocity.z - WALK_SPEED) < 1e-9);
});

test('sneaking remains thirty percent of walking speed', () => {
  assert.equal(SNEAK_SPEED_MULTIPLIER, 0.3);
  assert.ok(Math.abs(WALK_SPEED * SNEAK_SPEED_MULTIPLIER - 1.2951) < 1e-9);
});

test('jump impulse corresponds to 0.42 blocks per game tick', () => {
  assert.equal(TICK_RATE, 20);
  assert.ok(Math.abs(JUMP_VELOCITY / TICK_RATE - 0.42) < 1e-12);
});
