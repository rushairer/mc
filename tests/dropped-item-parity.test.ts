import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { DroppedItem } from '../src/entities/DroppedItem';
import { DroppedItemSystem } from '../src/systems/DroppedItemSystem';

const noCollision = () => false;

test('dropped items use the vanilla default 10-tick pickup delay', () => {
  const item = new DroppedItem(1, 1, 0, 64, 0, new THREE.Vector3(), undefined, () => null);
  assert.equal(item.pickupDelay, 0.5);
  item.update(0.25, noCollision);
  assert.equal(item.pickupDelay, 0.25);
  item.update(0.25, noCollision);
  assert.equal(item.pickupDelay, 0);
  item.dispose();
});

test('air drag is tick based rather than render-frame based', () => {
  const oneStep = new DroppedItem(1, 1, 0, 64, 0, new THREE.Vector3(10, 0, 0), 0, () => null);
  const twoSteps = new DroppedItem(1, 1, 0, 64, 0, new THREE.Vector3(10, 0, 0), 0, () => null);

  oneStep.update(1 / 20, noCollision);
  twoSteps.update(1 / 40, noCollision);
  twoSteps.update(1 / 40, noCollision);

  assert.ok(Math.abs(oneStep.velocity.x - twoSteps.velocity.x) < 1e-9);
  oneStep.dispose();
  twoSteps.dispose();
});

test('pickup uses the expanded player collision box instead of a 2.5-block magnet', () => {
  const system = new DroppedItemSystem(new THREE.Scene(), () => null) as any;
  const player = new THREE.Vector3(0, 64, 0);

  assert.equal(system.isWithinVanillaPickupBounds(new THREE.Vector3(1.29, 65, 0), player), true);
  assert.equal(system.isWithinVanillaPickupBounds(new THREE.Vector3(1.31, 65, 0), player), false);
  assert.equal(system.isWithinVanillaPickupBounds(new THREE.Vector3(0, 66.31, 0), player), false);
});
