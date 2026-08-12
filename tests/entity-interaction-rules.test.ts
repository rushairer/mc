import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldTameEntity } from '../src/entities/EntityInteractionRules';

test('taming rolls replay for the same world tick and entity', () => {
  const first = shouldTameEntity(12345, 240, 17, 352);
  const replay = shouldTameEntity(12345, 240, 17, 352);
  assert.equal(replay, first);
});

test('taming chance boundaries are deterministic', () => {
  assert.equal(shouldTameEntity(1, 1, 1, 352, 0), false);
  assert.equal(shouldTameEntity(1, 1, 1, 352, 1), true);
});
