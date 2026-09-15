import assert from 'node:assert/strict';
import test from 'node:test';
import { GameRuleSystem } from '../src/systems/GameRuleSystem';

 test('Java survival gamerules have vanilla defaults', () => {
  const rules = new GameRuleSystem();
  assert.equal(rules.getRule('fallDamage'), true);
  assert.equal(rules.getRule('fireDamage'), true);
  assert.equal(rules.getRule('drowningDamage'), true);
  assert.equal(rules.getRule('naturalRegeneration'), true);
  assert.equal(rules.getRule('keepInventory'), false);
});

test('older saves inherit newly tracked gamerule defaults', () => {
  const rules = new GameRuleSystem({
    difficulty: 'normal',
    rules: { keepInventory: true },
  });
  assert.equal(rules.getRule('keepInventory'), true);
  assert.equal(rules.getRule('drowningDamage'), true);
  assert.equal(rules.getRule('naturalRegeneration'), true);
});

test('gamerules round-trip without dropping survival damage switches', () => {
  const rules = new GameRuleSystem();
  rules.setRule('drowningDamage', false);
  rules.setRule('naturalRegeneration', false);

  const restored = new GameRuleSystem();
  restored.fromJSON(rules.toJSON());
  assert.equal(restored.getRule('drowningDamage'), false);
  assert.equal(restored.getRule('naturalRegeneration'), false);
});
