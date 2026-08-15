import assert from 'node:assert/strict';
import test from 'node:test';
import { getBowReleaseParams, parseItemAction } from '../src/server/ItemActionRules';

// ─── Item action parsing (P5.1) ───

test('parseItemAction accepts valid throw/bow_release intents', () => {
  assert.deepEqual(parseItemAction({ action: 'throw', itemId: 332 }), { action: 'throw', itemId: 332, power: undefined, damageBonus: undefined });
  assert.deepEqual(parseItemAction({ action: 'bow_release', itemId: 261, power: 0.8, damageBonus: 0.5 }), {
    action: 'bow_release', itemId: 261, power: 0.8, damageBonus: 0.5,
  });
});

test('parseItemAction rejects malformed payloads', () => {
  assert.equal(parseItemAction(null), null);
  assert.equal(parseItemAction({}), null);
  assert.equal(parseItemAction({ action: 'fly', itemId: 1 }), null, 'unknown action');
  assert.equal(parseItemAction({ action: 'throw', itemId: 0 }), null, 'invalid item id');
  assert.equal(parseItemAction({ action: 'throw', itemId: -5 }), null);
});

test('power is clamped to 0..1', () => {
  const over = parseItemAction({ action: 'bow_release', itemId: 261, power: 5 });
  assert.equal(over?.power, 1);
  const under = parseItemAction({ action: 'bow_release', itemId: 261, power: -1 });
  assert.equal(under?.power, 0);
});

// ─── Bow release params (P5.1) ───

test('arrow damage and speed scale with charge power', () => {
  const full = getBowReleaseParams(1);
  assert.equal(full.damage, 6);
  assert.equal(full.speed, 32);
  const low = getBowReleaseParams(0.5);
  assert.ok(low.damage < full.damage && low.speed < full.speed);
  const clamped = getBowReleaseParams(2);
  assert.equal(clamped.damage, 6, 'clamped to full power');
});

test('damage bonus stacks onto the base arrow damage', () => {
  const enchanted = getBowReleaseParams(1, 1);
  assert.equal(enchanted.damage, 7);
});
