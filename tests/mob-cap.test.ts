import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { MobSystem } from '../src/systems/MobSystem';
import { MAX_RESTORED_MOBS_PER_DIMENSION } from '../src/systems/SaveSystem';

test('runtime spawning cannot grow beyond the temporary safety cap', () => {
  const scene = new THREE.Scene();
  const mobs = new MobSystem(scene);
  for (let index = 0; index < 200; index++) {
    mobs.spawnMob(index % 2 === 0 ? 'pillager' : 'vex', index, 70, index);
  }

  assert.equal(mobs.mobs.size, MAX_RESTORED_MOBS_PER_DIMENSION);
  assert.equal(scene.children.length, MAX_RESTORED_MOBS_PER_DIMENSION);
  mobs.dispose();
  assert.equal(scene.children.length, 0);
});

test('repeated restore cycles do not duplicate saved entities', () => {
  const scene = new THREE.Scene();
  const mobs = new MobSystem(scene);
  const saved = Array.from({ length: 80 }, (_, index) => ({
    type: 'cow' as const,
    x: index,
    y: 70,
    z: index,
    health: 10,
    dimension: 0,
  }));

  mobs.restore(saved, 0);
  const firstCount = mobs.mobs.size;
  mobs.restore(saved, 0);

  assert.equal(firstCount, MAX_RESTORED_MOBS_PER_DIMENSION);
  assert.equal(mobs.mobs.size, firstCount);
  assert.equal(scene.children.length, firstCount);
  mobs.dispose();
});
