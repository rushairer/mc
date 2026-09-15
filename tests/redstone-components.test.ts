import assert from 'node:assert/strict';
import test from 'node:test';
import { RedstoneSystem } from '../src/systems/RedstoneSystem';

/** Drive a redstone system for `steps` fixed game ticks. */
function run(redstone: RedstoneSystem, steps: number) {
  const signals = new Map<string, number>();
  redstone.update(
    0,
    () => 0,
    () => {},
    undefined,
    (comp) => {
      const key = `${comp.x},${comp.y},${comp.z}`;
      signals.set(key, comp.signal);
    },
    0.25,
    () => undefined,
    [],
    steps,
  );
  return signals;
}

// ─── Repeater timing (Java 1.20.1) ───

test('one repeater redstone tick equals two game ticks', () => {
  const redstone = new RedstoneSystem();
  redstone.register(0, 64, 0, 'lever', 'north', { signal: 15, state: true });
  redstone.register(1, 64, 0, 'repeater', 'east', { delayTicks: 1, signal: 0, state: false });
  redstone.register(2, 64, 0, 'wire', 'up');

  run(redstone, 1); // detect powered rear input and schedule the transition
  assert.equal(redstone.get(1, 64, 0)?.signal, 0);
  run(redstone, 1); // one game tick later
  assert.equal(redstone.get(1, 64, 0)?.signal, 0);
  const afterTwo = run(redstone, 1); // two game-tick intervals after detection
  assert.equal(redstone.get(1, 64, 0)?.signal, 15);
  assert.equal(afterTwo.get('2,64,0') ?? 0, 14);
});

test('two repeater redstone ticks equal four game ticks', () => {
  const redstone = new RedstoneSystem();
  redstone.register(0, 64, 0, 'lever', 'north', { signal: 15, state: true });
  redstone.register(1, 64, 0, 'repeater', 'east', { delayTicks: 2 });

  run(redstone, 1);
  run(redstone, 3);
  assert.equal(redstone.get(1, 64, 0)?.signal, 0);
  run(redstone, 1);
  assert.equal(redstone.get(1, 64, 0)?.signal, 15);
});

test('repeater absolute clock survives separate update calls', () => {
  const redstone = new RedstoneSystem();
  redstone.register(0, 64, 0, 'lever', 'north', { signal: 15, state: true });
  redstone.register(1, 64, 0, 'repeater', 'east', { delayTicks: 1 });

  run(redstone, 1);
  run(redstone, 1);
  run(redstone, 1);
  assert.equal(redstone.get(1, 64, 0)?.signal, 15);
});

test('repeater output drops off after the configured redstone delay', () => {
  const redstone = new RedstoneSystem();
  redstone.register(0, 64, 0, 'lever', 'north', { signal: 15, state: true });
  redstone.register(1, 64, 0, 'repeater', 'east', { delayTicks: 1, signal: 0, state: false });
  redstone.register(2, 64, 0, 'wire', 'up');

  run(redstone, 3);
  const lever = redstone.get(0, 64, 0);
  assert.ok(lever);
  lever.state = false;
  lever.signal = 0;
  run(redstone, 1); // detect falling edge
  run(redstone, 1);
  assert.equal(redstone.get(1, 64, 0)?.signal, 15);
  const after = run(redstone, 1);
  assert.equal(redstone.get(1, 64, 0)?.signal, 0);
  assert.equal(after.get('2,64,0') ?? 0, 0);
});

test('repeaters only accept power from their rear input', () => {
  const redstone = new RedstoneSystem();
  redstone.register(1, 64, -1, 'lever', 'north', { signal: 15, state: true }); // side input
  redstone.register(1, 64, 0, 'repeater', 'east', { delayTicks: 1 });
  run(redstone, 8);
  assert.equal(redstone.get(1, 64, 0)?.signal, 0);
});

test('powered side diode locks a repeater in its current state', () => {
  const redstone = new RedstoneSystem();
  redstone.register(0, 64, 0, 'lever', 'north', { signal: 15, state: true });
  redstone.register(1, 64, 0, 'repeater', 'east', { delayTicks: 1 });
  redstone.register(1, 64, -1, 'repeater', 'south', { signal: 15, state: true });

  run(redstone, 8);
  assert.equal(redstone.get(1, 64, 0)?.signal, 0, 'locked repeater keeps its old output');

  const lock = redstone.get(1, 64, -1);
  assert.ok(lock);
  lock.signal = 0;
  lock.state = false;
  run(redstone, 3);
  assert.equal(redstone.get(1, 64, 0)?.signal, 15, 'unlock permits the rear input transition');
});

test('unregister clears a pending repeater transition for that position', () => {
  const redstone = new RedstoneSystem();
  redstone.register(0, 64, 0, 'lever', 'north', { signal: 15, state: true });
  redstone.register(1, 64, 0, 'repeater', 'east', { delayTicks: 1 });
  run(redstone, 1);

  redstone.unregister(1, 64, 0);
  redstone.unregister(0, 64, 0);
  redstone.register(1, 64, 0, 'repeater', 'east', { delayTicks: 1 });
  run(redstone, 4);
  assert.equal(redstone.get(1, 64, 0)?.signal, 0);
});

test('setRepeaterDelay clamps the redstone-tick setting to 1-4', () => {
  const redstone = new RedstoneSystem();
  redstone.register(5, 64, 5, 'repeater', 'north');
  redstone.setRepeaterDelay(5, 64, 5, 3);
  redstone.setRepeaterDelay(5, 64, 5, 9);
  const comp = redstone.get(5, 64, 5);
  assert.ok(comp);
  assert.equal(comp.delayTicks, 4);
});

// ─── Button propagation ───

test('a pressed button propagates through adjacent wire', () => {
  const redstone = new RedstoneSystem();
  redstone.register(0, 64, 0, 'button', 'north', { signal: 15, state: true });
  redstone.register(1, 64, 0, 'wire', 'up');
  const signals = run(redstone, 1);
  assert.equal(signals.get('1,64,0') ?? 0, 14, 'wire next to a pressed button gets signal');
});
