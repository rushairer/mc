import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canExecuteServerCommand,
  clampGiveCount,
  isValidWeatherArgument,
  normalizeCommandLabel,
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

test('give count must be positive integral and is capped by item stack size', () => {
  assert.equal(clampGiveCount(64, 64), 64);
  assert.equal(clampGiveCount(200, 64), 64);
  assert.equal(clampGiveCount(2, 1), 1);
  assert.equal(clampGiveCount(0, 64), null);
  assert.equal(clampGiveCount(1.5, 64), null);
  assert.equal(clampGiveCount(Number.NaN, 64), null);
});
