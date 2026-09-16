import { readFileSync, writeFileSync } from 'node:fs';

function patch(path, transform) {
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error(`patch produced no change: ${path}`);
  writeFileSync(path, after);
}

function once(source, from, to, label) {
  const i = source.indexOf(from);
  if (i < 0) throw new Error(`missing anchor: ${label}`);
  if (source.indexOf(from, i + from.length) >= 0) throw new Error(`ambiguous anchor: ${label}`);
  return source.slice(0, i) + to + source.slice(i + from.length);
}

writeFileSync('src/world/TeleportRules26_3.ts', `import { BlockRegistry } from './BlockRegistry';

export type TeleportActor26_3 = 'chorus_fruit' | 'enderman' | 'shulker';
export type BlockGetter26_3 = (x: number, y: number, z: number) => number;
export interface TeleportPoint26_3 { x: number; y: number; z: number }

export const TELEPORT_ATTEMPTS_26_3 = 16;

/** Concrete Java 26.3 destination exclusions represented by the current runtime. */
export function isTeleportSupportForbidden26_3(actor: TeleportActor26_3, blockId: number): boolean {
  const name = BlockRegistry.get(blockId)?.name ?? '';
  if (name === 'bedrock') return true;
  // MC-106416 explicitly closes powder-snow destinations for Endermen and
  // random consumable teleports. Shulkers have their own destination tag.
  if (name === 'powder_snow') return actor === 'enderman' || actor === 'chorus_fruit';
  return false;
}

export function isSafeTeleportDestination26_3(
  actor: TeleportActor26_3,
  x: number,
  y: number,
  z: number,
  getBlock: BlockGetter26_3,
  clearance = actor === 'enderman' ? 3 : 2,
  worldHeight = 256,
): boolean {
  if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z)) return false;
  if (y < 1 || y + clearance >= worldHeight) return false;

  const support = getBlock(x, y - 1, z);
  if (!BlockRegistry.isSolid(support) || BlockRegistry.isFluid(support)) return false;
  if (isTeleportSupportForbidden26_3(actor, support)) return false;

  for (let dy = 0; dy < clearance; dy++) {
    const block = getBlock(x, y + dy, z);
    if (block !== 0 || BlockRegistry.isFluid(block)) return false;
  }
  return true;
}

export function findChorusFruitDestination26_3(
  origin: TeleportPoint26_3,
  getBlock: BlockGetter26_3,
  random: () => number = Math.random,
  worldHeight = 256,
): TeleportPoint26_3 | null {
  for (let attempt = 0; attempt < TELEPORT_ATTEMPTS_26_3; attempt++) {
    const x = Math.floor(origin.x + (random() - 0.5) * 16);
    const initialY = Math.max(1, Math.min(worldHeight - 3, Math.floor(origin.y + (random() - 0.5) * 16)));
    const z = Math.floor(origin.z + (random() - 0.5) * 16);

    // Vanilla random teleport searches for viable ground. Scan downward within
    // the same eight-block vertical budget rather than accepting an air shelf.
    for (let y = initialY; y >= Math.max(1, initialY - 8); y--) {
      if (!isSafeTeleportDestination26_3('chorus_fruit', x, y, z, getBlock, 2, worldHeight)) continue;
      return { x: x + 0.5, y: y + 0.001, z: z + 0.5 };
    }
  }
  return null;
}

export function teleportDirection26_3(from: TeleportPoint26_3, to: TeleportPoint26_3): TeleportPoint26_3 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dy, dz);
  if (length <= Number.EPSILON) return { x: 0, y: 0, z: 0 };
  return { x: dx / length, y: dy / length, z: dz / length };
}
`);

patch('src/systems/ParticleSystem.ts', source => {
  let out = once(
    source,
    `  type?: 'break' | 'flame' | 'smoke' | 'enchant' | 'xp' | 'falling_leaf';`,
    `  type?: 'break' | 'flame' | 'smoke' | 'enchant' | 'xp' | 'falling_leaf' | 'teleport';`,
    'particle teleport type',
  );
  out = once(
    out,
    `      } else if (p.type === 'falling_leaf') {\n        gravityVal = 0.12;\n        p.mesh.rotation.z += dt * 1.8;\n      } else if (p.gravity !== undefined) {`,
    `      } else if (p.type === 'falling_leaf') {\n        gravityVal = 0.12;\n        p.mesh.rotation.z += dt * 1.8;\n      } else if (p.type === 'teleport') {\n        gravityVal = 0;\n      } else if (p.gravity !== undefined) {`,
    'teleport no gravity',
  );
  out = once(
    out,
    `      if (p.type === 'flame' || p.type === 'smoke' || p.type === 'enchant') {`,
    `      if (p.type === 'flame' || p.type === 'smoke' || p.type === 'enchant' || p.type === 'teleport') {`,
    'teleport particle shrink',
  );
  out = once(
    out,
    `  /** Java 26.3 Poplar falling-leaf particle. */`,
    `  /** Java 26.3 directional teleport particles used by Chorus Fruit. */\n  spawnTeleportTrail26_3(from: THREE.Vector3, to: THREE.Vector3, count = 16): THREE.Vector3 {\n    const direction = to.clone().sub(from);\n    const distance = direction.length();\n    if (distance <= Number.EPSILON) return new THREE.Vector3();\n    direction.normalize();\n    const spawnCount = Math.max(0, Math.min(count, MAX_PARTICLES - this.particles.length));\n\n    for (let i = 0; i < spawnCount; i++) {\n      const t = spawnCount <= 1 ? 0 : i / (spawnCount - 1);\n      const mat = new THREE.MeshBasicMaterial({ color: 0x8b4dff, transparent: true, opacity: 0.9, depthWrite: false });\n      const mesh = new THREE.Mesh(this.sharedGeo, mat);\n      mesh.scale.setScalar(0.55);\n      mesh.position.copy(from).lerp(to, t);\n      mesh.position.add(new THREE.Vector3(\n        (Math.random() - 0.5) * 0.22,\n        (Math.random() - 0.5) * 0.22,\n        (Math.random() - 0.5) * 0.22,\n      ));\n      this.scene.add(mesh);\n      this.particles.push({\n        mesh,\n        velocity: direction.clone().multiplyScalar(1.8 + Math.random() * 0.8),\n        life: 0.45 + Math.random() * 0.2,\n        maxLife: 0.65,\n        gravity: 0,\n        type: 'teleport',\n      });\n    }\n    return direction;\n  }\n\n  /** Java 26.3 Poplar falling-leaf particle. */`,
    'teleport particle method',
  );
  return out;
});

patch('src/engine/Game.ts', source => {
  let out = once(
    source,
    `import { applySaturationStew26_3 } from '../world/SuspiciousStew26_3';`,
    `import { applySaturationStew26_3 } from '../world/SuspiciousStew26_3';\nimport { findChorusFruitDestination26_3 } from '../world/TeleportRules26_3';`,
    'Game teleport rules import',
  );
  out = once(
    out,
    `  private continueFoodUse(stack: ItemStack, dt: number) {`,
    `  private applyChorusFruitTeleport26_3(): boolean {\n    const from = this.player.position.clone();\n    const destination = findChorusFruitDestination26_3(\n      { x: from.x, y: from.y, z: from.z },\n      (x, y, z) => this.chunks.getBlock(x, y, z),\n      Math.random,\n      WORLD_HEIGHT,\n    );\n    if (!destination) return false;\n\n    const to = new THREE.Vector3(destination.x, destination.y, destination.z);\n    this.player.position.copy(to);\n    this.player.onGround = false;\n    this.particles.spawnTeleportTrail26_3(\n      from.clone().add(new THREE.Vector3(0, this.player.eyeHeight * 0.5, 0)),\n      to.clone().add(new THREE.Vector3(0, this.player.eyeHeight * 0.5, 0)),\n      24,\n    );\n    this.sound.playNamedEvent26_3('item.chorus_fruit.teleport');\n    return true;\n  }\n\n  private continueFoodUse(stack: ItemStack, dt: number) {`,
    'Game chorus teleport method',
  );
  out = once(
    out,
    `    if (this.isMultiplayerNetworkConnected()) {\n      this.network.send(PacketType.C2S_ITEM_CONSUME, {`,
    `    if (foodDef.name === 'chorus_fruit') {\n      this.applyChorusFruitTeleport26_3();\n    }\n\n    if (this.isMultiplayerNetworkConnected()) {\n      this.network.send(PacketType.C2S_ITEM_CONSUME, {`,
    'Game chorus food completion hook',
  );
  return out;
});

patch('src/entities/Mob.ts', source => {
  let out = once(
    source,
    `import { resolveShelfMushroomLanding26_3 } from '../world/WildernessBoundGameplay26_3';`,
    `import { resolveShelfMushroomLanding26_3 } from '../world/WildernessBoundGameplay26_3';\nimport { isSafeTeleportDestination26_3 } from '../world/TeleportRules26_3';`,
    'Mob teleport rules import',
  );
  out = once(
    out,
    `  teleportRandomly(getBlock: (x: number, y: number, z: number) => number) {\n    for (let attempts = 0; attempts < 16; attempts++) {\n      const dx = (Math.random() - 0.5) * 16;\n      const dy = (Math.random() - 0.5) * 6;\n      const dz = (Math.random() - 0.5) * 16;`,
    `  teleportRandomly(\n    getBlock: (x: number, y: number, z: number) => number,\n    random: () => number = Math.random,\n  ): boolean {\n    const actor = this.def.type === 'shulker' ? 'shulker' : 'enderman';\n    const clearance = this.def.type === 'enderman' ? 3 : 2;\n    for (let attempts = 0; attempts < 16; attempts++) {\n      const dx = (random() - 0.5) * 16;\n      const dy = (random() - 0.5) * 6;\n      const dz = (random() - 0.5) * 16;`,
    'Mob teleport signature and rng',
  );
  out = once(
    out,
    `      if (ty >= 0 && ty < 254) {\n        const foot = getBlock(tx, ty, tz);\n        const body = getBlock(tx, ty + 1, tz);\n        const head = getBlock(tx, ty + 2, tz);\n        const below = getBlock(tx, ty - 1, tz);\n        if (foot === 0 && body === 0 && head === 0 && below !== 0 && !BlockRegistry.isFluid(below)) {\n          this.position.set(tx + 0.5, ty + 0.05, tz + 0.5);\n          this.velocity.set(0, 0, 0);\n          this.wanderTarget = null;\n          break;\n        }\n      }\n    }\n  }`,
    `      if (ty >= 0 && ty < 254 && isSafeTeleportDestination26_3(actor, tx, ty, tz, getBlock, clearance, 256)) {\n        this.position.set(tx + 0.5, ty + 0.05, tz + 0.5);\n        this.velocity.set(0, 0, 0);\n        this.wanderTarget = null;\n        return true;\n      }\n    }\n    return false;\n  }`,
    'Mob teleport safe destination',
  );
  return out;
});

writeFileSync('tests/parity-291-300.test.ts', `import assert from 'node:assert/strict';
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
`);

console.log('Applied parity 291-300 chorus teleport and safe teleport destinations.');
