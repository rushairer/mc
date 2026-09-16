import assert from 'node:assert/strict';
import test from 'node:test';
import {
  JAVA_ELYTRA_MOVE_TOO_FAST_THRESHOLD_SQ,
  JAVA_MOVE_TOO_FAST_THRESHOLD_SQ,
  JAVA_WORLD_HORIZONTAL_LIMIT,
  isDescendingAirborne,
  isMoveTooFast,
  isSurvivalFlightSpoof,
  movementDistanceSquared,
  parseServerMoveIntent,
  snapshotMovement,
} from '../src/server/ServerMovementRules';

test('movement parser rejects non-finite and out-of-world coordinates', () => {
  const valid = parseServerMoveIntent({ x: 1, y: 64, z: 2, yaw: 720, pitch: -45, onGround: true });
  assert.ok(valid);
  assert.equal(parseServerMoveIntent({ x: Infinity, y: 64, z: 2, yaw: 0, pitch: 0 }), null);
  assert.equal(parseServerMoveIntent({ x: JAVA_WORLD_HORIZONTAL_LIMIT + 1, y: 64, z: 2, yaw: 0, pitch: 0 }), null);
  assert.equal(parseServerMoveIntent({ x: 1, y: 64, z: -(JAVA_WORLD_HORIZONTAL_LIMIT + 1), yaw: 0, pitch: 0 }), null);
});

test('movement parser normalizes boolean movement flags without trusting truthy strings', () => {
  const parsed = parseServerMoveIntent({
    x: 0, y: 64, z: 0, yaw: 0, pitch: 0,
    flying: 'true', onGround: true, sprinting: 1,
  });
  assert.deepEqual(parsed, {
    x: 0, y: 64, z: 0, yaw: 0, pitch: 0,
    flying: false, onGround: true, sprinting: false,
  });
});

test('distance squared is computed from authoritative previous coordinates', () => {
  assert.equal(movementDistanceSquared({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 }), 25);
});

test('Java gross movement guard uses 100 squared-distance excess', () => {
  assert.equal(JAVA_MOVE_TOO_FAST_THRESHOLD_SQ, 100);
  const previous = { x: 0, y: 64, z: 0 };
  assert.equal(isMoveTooFast(previous, { x: 10, y: 64, z: 0 }), false, 'exact threshold is accepted');
  assert.equal(isMoveTooFast(previous, { x: 10.01, y: 64, z: 0 }), true);
  assert.equal(isMoveTooFast(previous, { x: 10.01, y: 64, z: 0 }, 1), false, 'expected velocity is subtracted');
});

test('fall-flying gross movement guard uses the Java 300 threshold', () => {
  assert.equal(JAVA_ELYTRA_MOVE_TOO_FAST_THRESHOLD_SQ, 300);
  const previous = { x: 0, y: 80, z: 0 };
  assert.equal(isMoveTooFast(previous, { x: 17, y: 80, z: 0 }, 0, true), false);
  assert.equal(isMoveTooFast(previous, { x: 18, y: 80, z: 0 }, 0, true), true);
});

test('survival cannot enable flight by setting a packet flag', () => {
  const move = parseServerMoveIntent({ x: 0, y: 64, z: 0, yaw: 0, pitch: 0, flying: true })!;
  assert.equal(isSurvivalFlightSpoof(move, false), true);
  assert.equal(isSurvivalFlightSpoof(move, true), false);
});

test('critical movement prerequisite requires airborne downward movement', () => {
  const previous = { x: 0, y: 65, z: 0, onGround: false, sprinting: false };
  assert.equal(isDescendingAirborne(previous, parseServerMoveIntent({ x: 0, y: 64.9, z: 0, yaw: 0, pitch: 0, onGround: false })!), true);
  assert.equal(isDescendingAirborne(previous, parseServerMoveIntent({ x: 0, y: 65.1, z: 0, yaw: 0, pitch: 0, onGround: false })!), false);
  assert.equal(isDescendingAirborne(previous, parseServerMoveIntent({ x: 0, y: 64.9, z: 0, yaw: 0, pitch: 0, onGround: true })!), false);
});

test('accepted intents can be snapshotted for the next server movement packet', () => {
  const intent = parseServerMoveIntent({ x: 4, y: 70, z: -2, yaw: 0, pitch: 0, onGround: false, sprinting: true })!;
  assert.deepEqual(snapshotMovement(intent), { x: 4, y: 70, z: -2, onGround: false, sprinting: true });
});
