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

test('a full donor stack can top up a compatible partial dropped stack', () => {
  const system = new DroppedItemSystem(new THREE.Scene(), () => null) as any;
  const receiver = system.spawnItem(1, 60, new THREE.Vector3(0, 64, 0));
  const donor = system.spawnItem(1, 64, new THREE.Vector3(0.2, 64, 0));

  system.mergeItems();

  assert.equal(receiver.count, 64);
  assert.equal(donor.count, 60);
  assert.equal(system.items.size, 2);
  system.dispose();
});

test('item merge search expands horizontally but not vertically', () => {
  const horizontal = new DroppedItemSystem(new THREE.Scene(), () => null) as any;
  const horizontalA = horizontal.spawnItem(1, 1, new THREE.Vector3(0, 64, 0));
  horizontal.spawnItem(1, 1, new THREE.Vector3(0.7, 64, 0));
  horizontal.mergeItems();
  assert.equal(horizontalA.count, 2, '0.7-block horizontal separation remains mergeable');
  assert.equal(horizontal.items.size, 1);
  horizontal.dispose();

  const vertical = new DroppedItemSystem(new THREE.Scene(), () => null) as any;
  vertical.spawnItem(1, 1, new THREE.Vector3(0, 64, 0));
  vertical.spawnItem(1, 1, new THREE.Vector3(0, 64.3, 0));
  vertical.mergeItems();
  assert.equal(vertical.items.size, 2, '0.3-block vertical separation is outside the uninflated item AABB');
  vertical.dispose();
});
