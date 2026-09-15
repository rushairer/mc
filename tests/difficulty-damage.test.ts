import assert from 'node:assert/strict';
import test from 'node:test';
import { GameRuleSystem } from '../src/systems/GameRuleSystem';

test('Easy hostile damage uses min(damage / 2 + 1, damage)', () => {
  const rules = new GameRuleSystem();
  rules.setDifficulty('easy');

  assert.equal(rules.adjustDamageForDifficulty(1, true), 1);
  assert.equal(rules.adjustDamageForDifficulty(2, true), 2);
  assert.equal(rules.adjustDamageForDifficulty(4, true), 3);
  assert.equal(rules.adjustDamageForDifficulty(7, true), 4.5);
});

test('Hard hostile damage preserves the exact 1.5 multiplier', () => {
  const rules = new GameRuleSystem();
  rules.setDifficulty('hard');

  assert.equal(rules.adjustDamageForDifficulty(1, true), 1.5);
  assert.equal(rules.adjustDamageForDifficulty(3, true), 4.5);
  assert.equal(rules.adjustDamageForDifficulty(7, true), 10.5);
});

test('Peaceful removes hostile damage while Normal and non-hostile damage stay unchanged', () => {
  const rules = new GameRuleSystem();

  rules.setDifficulty('peaceful');
  assert.equal(rules.adjustDamageForDifficulty(6, true), 0);
  assert.equal(rules.adjustDamageForDifficulty(6, false), 6);

  rules.setDifficulty('normal');
  assert.equal(rules.adjustDamageForDifficulty(6, true), 6);
  assert.equal(rules.adjustDamageForDifficulty(2.5, true), 2.5);

  rules.setDifficulty('hard');
  assert.equal(rules.adjustDamageForDifficulty(6, false), 6);
});
