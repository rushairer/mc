import assert from 'node:assert/strict';
import test from 'node:test';
import { clampPlayerState, consumeOne, validateConsume } from '../src/server/PlayerStateRules';

// ─── Player state clamping (P5.2) ───

test('clampPlayerState bounds health/hunger/oxygen', () => {
  assert.deepEqual(clampPlayerState({ health: 12, hunger: 9, oxygen: 7 }), { health: 12, hunger: 9, oxygen: 7 });
  assert.deepEqual(clampPlayerState({ health: 99, hunger: -4, oxygen: 50 }), { health: 20, hunger: 0, oxygen: 15 });
  assert.deepEqual(clampPlayerState({}), { health: 20, hunger: 20, oxygen: 15 }, 'missing fields fall back');
  assert.deepEqual(clampPlayerState({ health: NaN, hunger: undefined, oxygen: Infinity } as any), { health: 20, hunger: 20, oxygen: 15 });
});

// ─── Consumable validation (P5.2) ───

test('validateConsume requires the exact item with positive count', () => {
  assert.equal(validateConsume({ id: 297, count: 3 }, 297), true);
  assert.equal(validateConsume({ id: 297, count: 1 }, 297), true);
  assert.equal(validateConsume({ id: 297, count: 0 }, 297), false, 'empty stack');
  assert.equal(validateConsume({ id: 297, count: 3 }, 298), false, 'wrong item');
  assert.equal(validateConsume(null, 297), false);
  assert.equal(validateConsume(undefined, 297), false);
});

test('consumeOne decrements and empties at zero', () => {
  assert.deepEqual(consumeOne({ id: 297, count: 3 }), { id: 297, count: 2 });
  assert.equal(consumeOne({ id: 297, count: 1 }), null);
});
