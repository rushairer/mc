import assert from 'node:assert/strict';
import test from 'node:test';
import { RedstoneSystem } from '../src/systems/RedstoneSystem';

test('redstone advances on the shared 20 TPS boundary', () => {
  const redstone = new RedstoneSystem();
  redstone.register(0, 64, 0, 'lever');
  redstone.register(1, 64, 0, 'wire');
  redstone.toggleLever(0, 64, 0);

  const update = (dt: number, fixedSteps?: number) => redstone.update(
    dt,
    () => 0,
    () => {},
    undefined,
    undefined,
    0.25,
    undefined,
    [],
    fixedSteps,
  );

  update(0.049);
  assert.equal(redstone.get(1, 64, 0)?.signal, 0);
  update(0.001);
  assert.equal(redstone.get(1, 64, 0)?.signal, 14);

  redstone.toggleLever(0, 64, 0);
  update(0, 1);
  assert.equal(redstone.get(1, 64, 0)?.signal, 0);
  redstone.dispose();
});

test('redstone processes every supplied catch-up tick instead of only resetting state', () => {
  const redstone = new RedstoneSystem();
  redstone.register(1, 64, 0, 'observer', 'west');
  redstone.observeBlockChange(0, 64, 0);

  redstone.update(0, () => 0, () => {}, undefined, undefined, 0.25, undefined, [], 2);

  assert.equal(redstone.get(1, 64, 0)?.signal, 0);
  assert.equal(redstone.get(1, 64, 0)?.state, false);
  redstone.dispose();
});
