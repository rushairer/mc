import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { Mob } from '../src/entities/Mob';
import { ItemRegistry } from '../src/items/ItemRegistry';
import { ParticleSystem } from '../src/systems/ParticleSystem';
import {
  findChorusFruitDestination26_3,
  isSafeTeleportDestination26_3,
  isTeleportSupportForbidden26_3,
  teleportDirection26_3,
} from '../src/world/TeleportRules26_3';

const BEDROCK = 7;
const STONE = 1;
const POWDER_SNOW = ItemRegistry.getByName('powder_snow')?.placeBlockId ?? ItemRegistry.getByName('powder_snow')?.id ?? -1;

test('291: Bedrock is forbidden teleport support for Endermen, Shulkers, and Chorus Fruit', () => {
  assert.equal(isTeleportSupportForbidden26_3('enderman', BEDROCK), true);
  assert.equal(isTeleportSupportForbidden26_3('shulker', BEDROCK), true);
  assert.equal(isTeleportSupportForbidden26_3('chorus_fruit', BEDROCK), true);
});

test('292: powder snow is rejected for Enderman and random consumable teleports', () => {
  if (POWDER_SNOW < 0) return;
  assert.equal(isTeleportSupportForbidden26_3('enderman', POWDER_SNOW), true);
  assert.equal(isTeleportSupportForbidden26_3('chorus_fruit', POWDER_SNOW), true);
});

test('293: ordinary solid ground with clear headroom remains a valid teleport destination', () => {
  const getBlock = (_x: number, y: number, _z: number) => y === 63 ? STONE : 0;
  assert.equal(isSafeTeleportDestination26_3('chorus_fruit', 0, 64, 0, getBlock), true);
  assert.equal(isSafeTeleportDestination26_3('enderman', 0, 64, 0, getBlock), true);
});

test('294: Chorus Fruit planner finds a safe destination inside its bounded random-search budget', () => {
  const getBlock = (_x: number, y: number, _z: number) => y === 63 ? STONE : 0;
  const destination = findChorusFruitDestination26_3({ x: 0.5, y: 64, z: 0.5 }, getBlock, () => 0.5, 256);
  assert.deepEqual(destination, { x: 0.5, y: 64.001, z: 0.5 });
});

test('295: Chorus Fruit planner refuses a Bedrock-only landing column', () => {
  const getBlock = (_x: number, y: number, _z: number) => y === 63 ? BEDROCK : 0;
  assert.equal(findChorusFruitDestination26_3({ x: 0.5, y: 64, z: 0.5 }, getBlock, () => 0.5, 256), null);
});

test('296: teleport particle direction is normalized from source toward destination', () => {
  const direction = teleportDirection26_3({ x: 1, y: 2, z: 3 }, { x: 4, y: 6, z: 3 });
  assert.ok(Math.abs(direction.x - 0.6) < 1e-9);
  assert.ok(Math.abs(direction.y - 0.8) < 1e-9);
  assert.equal(direction.z, 0);
});

test('297: ParticleSystem creates real directional teleport particles in the scene', () => {
  const scene = new THREE.Scene();
  const particles = new ParticleSystem(scene);
  const direction = particles.spawnTeleportTrail26_3(new THREE.Vector3(0, 1, 0), new THREE.Vector3(4, 1, 0), 6);
  assert.equal(scene.children.length, 6);
  assert.ok(direction.x > 0.999);
  assert.ok(Math.abs(direction.y) < 1e-9);
  particles.dispose();
  assert.equal(scene.children.length, 0);
});

test('298: Enderman runtime teleport rejects Bedrock support', () => {
  const mob = new Mob('enderman', 0.5, 64, 0.5);
  const before = mob.position.clone();
  const getBlock = (_x: number, y: number, _z: number) => y === 63 ? BEDROCK : 0;
  assert.equal(mob.teleportRandomly(getBlock, () => 0.5), false);
  assert.ok(mob.position.distanceTo(before) < 1e-9);
  mob.dispose();
});

test('299: Enderman runtime teleport still accepts safe ordinary ground', () => {
  const mob = new Mob('enderman', 0.5, 64, 0.5);
  const values = [0.75, 0.5, 0.5];
  let index = 0;
  const random = () => values[index++ % values.length];
  const getBlock = (_x: number, y: number, _z: number) => y === 63 ? STONE : 0;
  assert.equal(mob.teleportRandomly(getBlock, random), true);
  assert.ok(mob.position.x > 4);
  mob.dispose();
});

test('300: Chorus Fruit remains food and the live Game consumption path invokes 26.3 teleport visuals', () => {
  const chorus = ItemRegistry.getByName('chorus_fruit');
  assert.ok(chorus);
  assert.equal(chorus?.behaviorId, 'minecraft:food');
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  assert.ok(source.includes("foodDef.name === 'chorus_fruit'"));
  assert.ok(source.includes('applyChorusFruitTeleport26_3()'));
  assert.ok(source.includes('spawnTeleportTrail26_3'));
});
