import assert from 'node:assert/strict';
import test from 'node:test';
import { XorShiftRandom, coordinateRandom } from '../src/engine/DeterministicRandom';

test('seeded random sources replay the same sequence', () => {
  const first = new XorShiftRandom(12345);
  const second = new XorShiftRandom(12345);
  assert.deepEqual(
    Array.from({ length: 20 }, () => first.next()),
    Array.from({ length: 20 }, () => second.next()),
  );
});

test('forks are stable and isolated by salt', () => {
  const root = new XorShiftRandom(99);
  const forkA = root.fork(7);
  const forkB = root.fork(7);
  const forkC = root.fork(8);
  assert.equal(forkA.next(), forkB.next());
  assert.notEqual(forkA.next(), forkC.next());
});

test('coordinate samples are call-order independent', () => {
  const sample = coordinateRandom(42, -18, 70, 2048);
  coordinateRandom(42, 1, 2, 3);
  assert.equal(coordinateRandom(42, -18, 70, 2048), sample);
  assert.ok(sample >= 0 && sample <= 1);
});

test('nextInt validates its bounds', () => {
  const random = new XorShiftRandom(1);
  assert.throws(() => random.nextInt(0), /positive integer/);
  assert.ok(random.nextInt(4) >= 0 && random.nextInt(4) < 4);
});
