import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getBowReleaseParams,
  getServerBowPowerLevel,
  getThrowableProjectileType,
  isValidItemActionForHeldStack,
  parseItemAction,
} from '../src/server/ItemActionRules';

// ─── Item action parsing (P5.1) ───

test('parseItemAction accepts valid throw/bow_release intents and normalizes aim', () => {
  assert.deepEqual(parseItemAction({ action: 'throw', itemId: 332 }), {
    action: 'throw', itemId: 332, power: undefined, direction: { x: 0, y: 0, z: -1 },
  });
  const bow = parseItemAction({ action: 'bow_release', itemId: 261, power: 0.8, dirX: 3, dirY: 0, dirZ: 4 });
  assert.equal(bow?.action, 'bow_release');
  assert.equal(bow?.power, 0.8);
  assert.ok(Math.abs((bow?.direction.x ?? 0) - 0.6) < 1e-9);
  assert.ok(Math.abs((bow?.direction.z ?? 0) - 0.8) < 1e-9);
});

test('parseItemAction rejects malformed or non-finite payloads', () => {
  assert.equal(parseItemAction(null), null);
  assert.equal(parseItemAction({}), null);
  assert.equal(parseItemAction({ action: 'fly', itemId: 1 }), null, 'unknown action');
  assert.equal(parseItemAction({ action: 'throw', itemId: 0 }), null, 'invalid item id');
  assert.equal(parseItemAction({ action: 'throw', itemId: -5 }), null);
  assert.equal(parseItemAction({ action: 'bow_release', itemId: 261, power: Infinity }), null);
  assert.equal(parseItemAction({ action: 'throw', itemId: 332, dirX: 0, dirY: 0, dirZ: 0 }), null);
  assert.equal(parseItemAction({ action: 'throw', itemId: 332, dirX: NaN }), null);
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

test('Power damage is derived from the server-owned enchantment level', () => {
  assert.equal(getBowReleaseParams(1, 1).damage, 9);
  assert.equal(getBowReleaseParams(1, 5).damage, 15);
  assert.equal(getServerBowPowerLevel({
    id: 261,
    count: 1,
    enchantments: [{ id: 'power', level: 4 }],
  }), 4);
});

test('client damageBonus fields are ignored by the parser', () => {
  const parsed = parseItemAction({ action: 'bow_release', itemId: 261, power: 1, damageBonus: 999 });
  assert.ok(parsed);
  assert.equal('damageBonus' in (parsed as any), false);
});

test('throwable projectile type is derived from the actual item registry entry', () => {
  assert.equal(getThrowableProjectileType(332), 'snowball');
  assert.equal(getThrowableProjectileType(344), 'egg');
  assert.equal(getThrowableProjectileType(368), 'ender_pearl');
  assert.equal(getThrowableProjectileType(373), 'potion');
  assert.equal(getThrowableProjectileType(1), null);
});

test('server rejects spoofed item ids and action kinds that do not match held stack', () => {
  const bowRequest = parseItemAction({ action: 'bow_release', itemId: 261, power: 1 })!;
  assert.equal(isValidItemActionForHeldStack(bowRequest, { id: 261, count: 1 }), true);
  assert.equal(isValidItemActionForHeldStack(bowRequest, { id: 276, count: 1 }), false);

  const throwRequest = parseItemAction({ action: 'throw', itemId: 332 })!;
  assert.equal(isValidItemActionForHeldStack(throwRequest, { id: 332, count: 4 }), true);
  assert.equal(isValidItemActionForHeldStack(throwRequest, { id: 344, count: 4 }), false);
});
