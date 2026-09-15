import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { XPSystem } from '../src/systems/XPSystem';

test('experience totals split into Java orb size buckets', () => {
  const system = new XPSystem(new THREE.Scene()) as any;
  system.spawnXP(1000, new THREE.Vector3());
  const values = Array.from(system.orbs.values()).map((orb: any) => orb.value);
  assert.deepEqual(values, [617, 307, 73, 3]);
  system.dispose();
});

test('large experience totals use the 2477 top bucket', () => {
  const system = new XPSystem(new THREE.Scene()) as any;
  system.spawnXP(5000, new THREE.Vector3());
  const values = Array.from(system.orbs.values()).map((orb: any) => orb.value);
  assert.deepEqual(values, [2477, 2477, 37, 7, 1, 1]);
  system.dispose();
});

test('player pickup cooldown prevents collecting multiple touching orbs in one tick', () => {
  const system = new XPSystem(new THREE.Scene()) as any;
  system.spawnXP(3, new THREE.Vector3(0, 0.9, 0));
  system.spawnXP(3, new THREE.Vector3(0, 0.9, 0));

  for (const orb of system.orbs.values() as Iterable<any>) {
    orb.position.set(0, 0.9, 0);
    orb.velocity.set(0, 0, 0);
  }

  let pickups = 0;
  system.update(0, new THREE.Vector3(0, 0, 0), () => false, () => pickups++, () => {});
  assert.equal(pickups, 1);
  assert.equal(system.orbs.size, 1);

  system.update(0.05, new THREE.Vector3(0, 0, 0), () => false, () => pickups++, () => {});
  assert.equal(pickups, 1);
  system.update(0.05, new THREE.Vector3(0, 0, 0), () => false, () => pickups++, () => {});
  assert.equal(pickups, 2);
  assert.equal(system.orbs.size, 0);
  system.dispose();
});

test('level thresholds match Java experience progression', () => {
  const system = new XPSystem(new THREE.Scene()) as any;
  assert.equal(system.getXPForNextLevel(0), 7);
  assert.equal(system.getXPForNextLevel(14), 35);
  assert.equal(system.getXPForNextLevel(15), 37);
  assert.equal(system.getXPForNextLevel(29), 107);
  assert.equal(system.getXPForNextLevel(30), 112);
  assert.equal(system.getXPForNextLevel(31), 121);
  system.dispose();
});
