import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BREEDING_XP_RANGE,
  FISHING_XP_RANGE,
  getBlockXpRange,
  rollBlockXp,
  rollXp,
} from '../src/world/XpRules';

test('block XP rules match Java 1.20.1 ore values', () => {
  assert.deepEqual(getBlockXpRange('coal_ore'), { min: 0, max: 2 });
  assert.deepEqual(getBlockXpRange('deepslate_coal_ore'), { min: 0, max: 2 });
  assert.deepEqual(getBlockXpRange('diamond_ore'), { min: 3, max: 7 });
  assert.deepEqual(getBlockXpRange('emerald_ore'), { min: 3, max: 7 });
  assert.deepEqual(getBlockXpRange('lapis_ore'), { min: 2, max: 5 });
  assert.deepEqual(getBlockXpRange('redstone_ore'), { min: 1, max: 5 });
  assert.deepEqual(getBlockXpRange('nether_quartz_ore'), { min: 2, max: 5 });
  assert.deepEqual(getBlockXpRange('nether_gold_ore'), { min: 0, max: 1 });
  assert.equal(getBlockXpRange('stone'), undefined);
});

test('rollBlockXp stays within the configured range', () => {
  const rng = () => 0.5;
  const coal = rollBlockXp('coal_ore', rng);
  const diamond = rollBlockXp('diamond_ore', rng);
  assert.ok(coal >= 0 && coal <= 2, `coal xp ${coal}`);
  assert.ok(diamond >= 3 && diamond <= 7, `diamond xp ${diamond}`);
  assert.equal(rollBlockXp('stone', rng), 0);
});

test('rollXp is inclusive and boundary deterministic', () => {
  assert.equal(rollXp({ min: 1, max: 6 }, () => 0.0), 1);
  assert.equal(rollXp({ min: 1, max: 6 }, () => 0.999), 6);
  assert.equal(rollXp({ min: 1, max: 6 }, () => 0.5), 4);
  assert.equal(rollXp({ min: 3, max: 7 }, () => 0.0), 3);
  assert.equal(rollXp({ min: 3, max: 7 }, () => 0.999), 7);
});

test('fishing and breeding XP ranges are data-driven', () => {
  assert.deepEqual(FISHING_XP_RANGE, { min: 1, max: 6 });
  assert.deepEqual(BREEDING_XP_RANGE, { min: 1, max: 7 });
});
