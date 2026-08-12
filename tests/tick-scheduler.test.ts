import assert from 'node:assert/strict';
import test from 'node:test';
import { TickScheduler } from '../src/systems/TickScheduler';

test('advances at a deterministic 20 TPS fixed step', () => {
  const scheduler = new TickScheduler<'block'>(20);
  assert.equal(scheduler.advance(0.049).steps, 0);
  assert.equal(scheduler.advance(0.001).steps, 1);
  assert.equal(scheduler.getCurrentTick(), 1);
  assert.equal(scheduler.advance(0.1).steps, 2);
  assert.equal(scheduler.getCurrentTick(), 3);
});

test('deduplicates positional ticks and keeps the earliest deadline', () => {
  const scheduler = new TickScheduler<'fluid'>();
  const later = scheduler.schedule({ type: 'fluid', x: 1, y: 2, z: 3, delayTicks: 10 });
  const duplicate = scheduler.schedule({ type: 'fluid', x: 1, y: 2, z: 3, delayTicks: 20 });
  const earlier = scheduler.schedule({ type: 'fluid', x: 1, y: 2, z: 3, delayTicks: 4 });

  assert.equal(duplicate, later);
  assert.equal(earlier.dueTick, 4);
  assert.equal(scheduler.getPendingTicks().length, 1);
});

test('emits due ticks in deadline, priority, then insertion order', () => {
  const scheduler = new TickScheduler<'block'>();
  scheduler.schedule({ type: 'block', x: 0, y: 0, z: 0, delayTicks: 2, priority: 'low' });
  scheduler.schedule({ type: 'block', x: 1, y: 0, z: 0, delayTicks: 2, priority: 'highest' });
  scheduler.schedule({ type: 'block', x: 2, y: 0, z: 0, delayTicks: 1, priority: 'normal' });

  const result = scheduler.advance(0.1);
  assert.deepEqual(result.due.map((tick) => tick.x), [2, 1, 0]);
  assert.equal(result.currentTick, 2);
});

test('restores pending ticks without replaying expired entries', () => {
  const source = new TickScheduler<'block'>();
  source.schedule({ type: 'block', x: 4, y: 5, z: 6, delayTicks: 8, payload: undefined });
  const pending = source.getPendingTicks();

  const restored = new TickScheduler<'block'>();
  restored.restore(3, [
    ...pending,
    { ...pending[0], id: 'expired', dueTick: 2 },
  ]);
  assert.equal(restored.getCurrentTick(), 3);
  assert.equal(restored.getPendingTicks().length, 1);
  assert.equal(restored.advance(0.25).due.length, 1);
});

test('canonicalizes fractional coordinates before deduplication and restore', () => {
  const scheduler = new TickScheduler<'fluid'>();
  scheduler.schedule({ type: 'fluid', x: 1.9, y: 2.1, z: -0.1, dimension: 2, delayTicks: 5 });
  scheduler.schedule({ type: 'fluid', x: 1.1, y: 2.9, z: -0.9, dimension: 2, delayTicks: 8 });
  assert.equal(scheduler.getPendingTicks().length, 1);
  assert.equal(scheduler.getPendingTicks()[0].id, '2:1,2,-1:fluid');

  const restored = new TickScheduler<'fluid'>();
  restored.restore(0, [
    { ...scheduler.getPendingTicks()[0], id: 'later', dueTick: 8 },
    { ...scheduler.getPendingTicks()[0], id: 'earlier', dueTick: 4 },
  ]);
  assert.equal(restored.getPendingTicks()[0].id, '2:1,2,-1:fluid');
  assert.equal(restored.getPendingTicks()[0].dueTick, 4);
});
