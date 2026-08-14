import assert from 'node:assert/strict';
import test from 'node:test';
import { RedstoneSystem } from '../src/systems/RedstoneSystem';

/** Drive a redstone system for `steps` fixed ticks. */
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

// ─── Repeater timing (P3.6) ───

test('repeater delays its output by the configured number of ticks', () => {
  const redstone = new RedstoneSystem();
  redstone.register(0, 64, 0, 'lever', 'north', { signal: 15, state: true });
  redstone.register(1, 64, 0, 'repeater', 'east', { delayTicks: 2, signal: 0, state: false });
  redstone.register(2, 64, 0, 'wire', 'up');

  const signals = run(redstone, 4);
  // After 4 ticks the output wire must be powered (delay 2 + propagation).
  assert.equal(signals.get('2,64,0') ?? 0, 14, 'output wire lit after the 2-tick delay');

  // With a 1-tick delay the output lights sooner.
  const fast = new RedstoneSystem();
  fast.register(0, 64, 0, 'lever', 'north', { signal: 15, state: true });
  fast.register(1, 64, 0, 'repeater', 'east', { delayTicks: 1, signal: 0, state: false });
  fast.register(2, 64, 0, 'wire', 'up');
  const fastSignals = run(fast, 2);
  assert.equal(fastSignals.get('2,64,0') ?? 0, 14, '1-tick delay lights within 2 ticks');
});

test('repeater output drops off after the delay when input is removed', () => {
  const redstone = new RedstoneSystem();
  redstone.register(0, 64, 0, 'lever', 'north', { signal: 15, state: true });
  redstone.register(1, 64, 0, 'repeater', 'east', { delayTicks: 1, signal: 0, state: false });
  redstone.register(2, 64, 0, 'wire', 'up');

  run(redstone, 2); // light the wire
  const lever = redstone.get(0, 64, 0);
  assert.ok(lever);
  lever.state = false;
  lever.signal = 0;
  const after = run(redstone, 3);
  assert.equal(after.get('2,64,0') ?? 15, 0, 'output wire turns off after input drops');
});

test('setRepeaterDelay clamps to 1-4 ticks', () => {
  const redstone = new RedstoneSystem();
  redstone.register(5, 64, 5, 'repeater', 'north');
  redstone.setRepeaterDelay(5, 64, 5, 3);
  redstone.setRepeaterDelay(5, 64, 5, 9);
  const comp = redstone.get(5, 64, 5);
  assert.ok(comp);
  assert.equal(comp.delayTicks, 4);
});

// ─── Button propagation (P3.1 fix) ───

test('a pressed button propagates through adjacent wire', () => {
  const redstone = new RedstoneSystem();
  redstone.register(0, 64, 0, 'button', 'north', { signal: 15, state: true });
  redstone.register(1, 64, 0, 'wire', 'up');
  const signals = run(redstone, 1);
  assert.equal(signals.get('1,64,0') ?? 0, 14, 'wire next to a pressed button gets signal');
});
