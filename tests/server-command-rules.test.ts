import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_GIVE_STACKS,
  applyGiveToInventory,
  canExecuteServerCommand,
  isValidWeatherArgument,
  normalizeCommandLabel,
  validateGiveCount,
} from '../src/server/ServerCommandRules';

test('server command labels are normalized without accepting ordinary chat', () => {
  assert.equal(normalizeCommandLabel('/time set day'), 'time');
  assert.equal(normalizeCommandLabel(' /GIVE 1 64 '), 'give');
  assert.equal(normalizeCommandLabel('hello'), '');
});

test('privileged world-mutating commands require server operator authority', () => {
  for (const command of ['/tp 0 64 0', '/setblock 0 64 0 1', '/give 1 64', '/time set day', '/weather rain']) {
    assert.equal(canExecuteServerCommand(command, false), false, command);
    assert.equal(canExecuteServerCommand(command, true), true, command);
  }
  assert.equal(canExecuteServerCommand('/unknown', true), false);
});

test('weather accepts only the three Java weather modes', () => {
  assert.equal(isValidWeatherArgument('clear'), true);
  assert.equal(isValidWeatherArgument('rain'), true);
  assert.equal(isValidWeatherArgument('thunder'), true);
  assert.equal(isValidWeatherArgument('snow'), false);
});

test('Java 26.3 give count defaults to one and accepts at most one hundred stacks', () => {
  assert.equal(MAX_GIVE_STACKS, 100);
  assert.equal(validateGiveCount(undefined, 64), 1);
  assert.equal(validateGiveCount(200, 64), 200);
  assert.equal(validateGiveCount(6400, 64), 6400);
  assert.equal(validateGiveCount(6401, 64), null);
  assert.equal(validateGiveCount(100, 1), 100);
  assert.equal(validateGiveCount(101, 1), null);
  assert.equal(validateGiveCount(0, 64), null);
  assert.equal(validateGiveCount(1.5, 64), null);
  assert.equal(validateGiveCount(Number.NaN, 64), null);
});

test('give fills compatible stacks then empty slots without merging component-bearing items', () => {
  const input: any[] = Array.from({ length: 4 }, () => null);
  input[0] = { id: 1, count: 60 };
  input[1] = { id: 1, count: 4, customName: 'Keep Separate' };
  const result = applyGiveToInventory(input, 1, 70, 64);
  assert.deepEqual(result.slots[0], { id: 1, count: 64 });
  assert.deepEqual(result.slots[1], { id: 1, count: 4, customName: 'Keep Separate' });
  assert.deepEqual(result.slots[2], { id: 1, count: 64 });
  assert.deepEqual(result.slots[3], { id: 1, count: 2 });
  assert.equal(result.remainder, 0);
  assert.deepEqual(input[0], { id: 1, count: 60 }, 'input inventory is not mutated');
});

test('give returns overflow once the player inventory is full', () => {
  const input = [{ id: 1, count: 64 }, { id: 1, count: 64 }];
  const result = applyGiveToInventory(input, 1, 130, 64);
  assert.equal(result.remainder, 130);
});
