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

writeFileSync('src/server/ServerTeleportRules26_3.ts', `import {
  findChorusFruitDestination26_3,
  type BlockGetter26_3,
  type TeleportPoint26_3,
} from '../world/TeleportRules26_3';

export interface ChorusTeleportCorrection26_3 {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  teleportEffect: 'chorus_fruit';
  from: TeleportPoint26_3;
}

export interface ServerChorusTeleportPlan26_3 {
  from: TeleportPoint26_3;
  to: TeleportPoint26_3;
  correction: ChorusTeleportCorrection26_3;
}

export function planServerChorusTeleport26_3(
  from: TeleportPoint26_3,
  yaw: number,
  pitch: number,
  getBlock: BlockGetter26_3,
  random: () => number = Math.random,
  worldHeight = 256,
): ServerChorusTeleportPlan26_3 | null {
  const destination = findChorusFruitDestination26_3(from, getBlock, random, worldHeight);
  if (!destination) return null;
  return {
    from: { ...from },
    to: { ...destination },
    correction: {
      x: destination.x,
      y: destination.y,
      z: destination.z,
      yaw,
      pitch,
      teleportEffect: 'chorus_fruit',
      from: { ...from },
    },
  };
}
`);

patch('src/engine/Game.ts', source => once(
  source,
  `    if (foodDef.name === 'chorus_fruit') {\n      this.applyChorusFruitTeleport26_3();\n    }`,
  `    // Single-player owns its local teleport. Multiplayer waits for the\n    // authoritative server correction so clients cannot choose destinations.\n    if (foodDef.name === 'chorus_fruit' && !this.isMultiplayerNetworkConnected()) {\n      this.applyChorusFruitTeleport26_3();\n    }`,
  'Game multiplayer chorus authority guard',
));

patch('src/server/GameServer.ts', source => {
  let out = once(
    source,
    `import { getProjectileImpactBehavior } from './ServerProjectileRules';`,
    `import { getProjectileImpactBehavior } from './ServerProjectileRules';\nimport { planServerChorusTeleport26_3 } from './ServerTeleportRules26_3';`,
    'GameServer teleport rule import',
  );
  out = once(
    out,
    `      // P5.2: server-validated consumable use.\n      case PacketType.C2S_ITEM_CONSUME: {\n        const { slot, itemId } = packet.payload;\n        if (!Number.isInteger(slot) || slot < 0 || slot >= session.inventory.length) break;\n        const stack = session.inventory[slot];\n        if (validateConsume(stack, itemId)) {\n          const updated = consumeOne(stack!);\n          session.inventory[slot] = updated;\n          this.sendTo(session, PacketType.S2C_INVENTORY_SYNC, {\n            slots: session.inventory,\n            armor: session.armor,\n            offhand: session.offhand,\n          });\n        }\n        break;\n      }`,
    `      // P5.2 + Java 26.3: server-validated consumable use. Chorus Fruit\n      // destinations are server-owned and fan out one authoritative teleport.\n      case PacketType.C2S_ITEM_CONSUME: {\n        const { slot, itemId } = packet.payload;\n        if (!Number.isInteger(slot) || slot < 0 || slot >= session.inventory.length) break;\n        const stack = session.inventory[slot];\n        if (validateConsume(stack, itemId)) {\n          const itemDef = ItemRegistry.get(stack!.id);\n          const chorusPlan = itemDef?.name === 'chorus_fruit'\n            ? planServerChorusTeleport26_3(\n                { x: session.x, y: session.y, z: session.z },\n                session.yaw,\n                session.pitch,\n                (x, y, z) => this.getBlock(x, y, z, session.dimension),\n                Math.random,\n                WORLD_HEIGHT,\n              )\n            : null;\n\n          const updated = consumeOne(stack!);\n          session.inventory[slot] = updated;\n\n          if (chorusPlan) {\n            session.x = chorusPlan.to.x;\n            session.y = chorusPlan.to.y;\n            session.z = chorusPlan.to.z;\n            session.onGround = false;\n            this.sendTo(session, PacketType.S2C_POSITION_CORRECTION, chorusPlan.correction);\n            for (const other of this.players.values()) {\n              if (other.id === session.id || other.dimension !== session.dimension) continue;\n              this.sendTo(other, PacketType.S2C_PLAYER_MOVE, {\n                playerId: session.id,\n                x: session.x,\n                y: session.y,\n                z: session.z,\n                yaw: session.yaw,\n                pitch: session.pitch,\n                flying: session.flying,\n                onGround: session.onGround,\n                sprinting: session.sprinting,\n                teleportEffect: 'chorus_fruit',\n                from: chorusPlan.from,\n              });\n            }\n          }\n\n          this.sendTo(session, PacketType.S2C_INVENTORY_SYNC, {\n            slots: session.inventory,\n            armor: session.armor,\n            offhand: session.offhand,\n          });\n        }\n        break;\n      }`,
    'GameServer authoritative chorus consume',
  );
  return out;
});

patch('src/server/NetworkClient.ts', source => {
  let out = once(
    source,
    `      case PacketType.S2C_PLAYER_MOVE: {\n        const { playerId, x, y, z, yaw, pitch } = packet.payload;\n        const player = this.otherPlayers.get(playerId);\n        if (player) {\n          player.targetPos.set(x, y, z);\n          player.targetYaw = yaw;\n          player.targetPitch = pitch;\n        }\n        break;\n      }`,
    `      case PacketType.S2C_PLAYER_MOVE: {\n        const { playerId, x, y, z, yaw, pitch, teleportEffect, from } = packet.payload;\n        const player = this.otherPlayers.get(playerId);\n        if (player) {\n          player.targetPos.set(x, y, z);\n          player.targetYaw = yaw;\n          player.targetPitch = pitch;\n          if (teleportEffect === 'chorus_fruit' && from && [from.x, from.y, from.z, x, y, z].every(Number.isFinite)) {\n            this.game.particles.spawnTeleportTrail26_3(\n              new THREE.Vector3(from.x, from.y + 0.9, from.z),\n              new THREE.Vector3(x, y + 0.9, z),\n              24,\n            );\n            this.game.sound.playNamedEvent26_3('item.chorus_fruit.teleport');\n          }\n        }\n        break;\n      }`,
    'NetworkClient remote chorus effect',
  );
  out = once(
    out,
    `      case PacketType.S2C_POSITION_CORRECTION: {\n        const { x, y, z, yaw, pitch } = packet.payload;\n        this.game.player.position.set(x, y, z);\n        this.game.player.velocity.set(0, 0, 0);\n        if (Number.isFinite(yaw)) this.game.player.yaw = yaw;\n        if (Number.isFinite(pitch)) this.game.player.pitch = pitch;\n        break;\n      }`,
    `      case PacketType.S2C_POSITION_CORRECTION: {\n        const { x, y, z, yaw, pitch, teleportEffect, from } = packet.payload;\n        const previousPosition = this.game.player.position.clone();\n        this.game.player.position.set(x, y, z);\n        this.game.player.velocity.set(0, 0, 0);\n        if (Number.isFinite(yaw)) this.game.player.yaw = yaw;\n        if (Number.isFinite(pitch)) this.game.player.pitch = pitch;\n        if (teleportEffect === 'chorus_fruit' && [x, y, z].every(Number.isFinite)) {\n          const trailFrom = from && [from.x, from.y, from.z].every(Number.isFinite)\n            ? new THREE.Vector3(from.x, from.y, from.z)\n            : previousPosition;\n          this.game.particles.spawnTeleportTrail26_3(\n            trailFrom.clone().add(new THREE.Vector3(0, this.game.player.eyeHeight * 0.5, 0)),\n            new THREE.Vector3(x, y, z).add(new THREE.Vector3(0, this.game.player.eyeHeight * 0.5, 0)),\n            24,\n          );\n          this.game.sound.playNamedEvent26_3('item.chorus_fruit.teleport');\n        }\n        break;\n      }`,
    'NetworkClient local chorus correction',
  );
  return out;
});

writeFileSync('tests/parity-301-310.test.ts', `import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  planServerChorusTeleport26_3,
} from '../src/server/ServerTeleportRules26_3';

const STONE = 1;
const BEDROCK = 7;

test('301: server Chorus Fruit planner produces an authoritative correction on safe ground', () => {
  const getBlock = (_x: number, y: number, _z: number) => y === 63 ? STONE : 0;
  const plan = planServerChorusTeleport26_3({ x: 0.5, y: 64, z: 0.5 }, 1.25, -0.2, getBlock, () => 0.5, 256);
  assert.ok(plan);
  assert.deepEqual(plan?.from, { x: 0.5, y: 64, z: 0.5 });
  assert.deepEqual(plan?.to, { x: 0.5, y: 64.001, z: 0.5 });
});

test('302: server Chorus Fruit planner refuses a Bedrock-only destination', () => {
  const getBlock = (_x: number, y: number, _z: number) => y === 63 ? BEDROCK : 0;
  assert.equal(planServerChorusTeleport26_3({ x: 0.5, y: 64, z: 0.5 }, 0, 0, getBlock, () => 0.5, 256), null);
});

test('303: authoritative correction preserves view angles and carries the Chorus effect origin', () => {
  const getBlock = (_x: number, y: number, _z: number) => y === 63 ? STONE : 0;
  const plan = planServerChorusTeleport26_3({ x: 2.5, y: 64, z: -1.5 }, 0.75, 0.1, getBlock, () => 0.5, 256)!;
  assert.equal(plan.correction.teleportEffect, 'chorus_fruit');
  assert.equal(plan.correction.yaw, 0.75);
  assert.equal(plan.correction.pitch, 0.1);
  assert.deepEqual(plan.correction.from, plan.from);
});

const gameSource = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
const serverSource = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
const clientSource = readFileSync(new URL('../src/server/NetworkClient.ts', import.meta.url), 'utf8');

test('304: multiplayer Chorus Fruit waits for the server instead of teleporting locally', () => {
  assert.ok(gameSource.includes("foodDef.name === 'chorus_fruit' && !this.isMultiplayerNetworkConnected()"));
});

test('305: server consume validates the held stack before planning a Chorus teleport', () => {
  const validateIndex = serverSource.indexOf('if (validateConsume(stack, itemId))');
  const planIndex = serverSource.indexOf('planServerChorusTeleport26_3(');
  assert.ok(validateIndex >= 0 && planIndex > validateIndex);
});

test('306: server owns the local-player correction and resets the session ground state', () => {
  assert.ok(serverSource.includes('session.onGround = false;'));
  assert.ok(serverSource.includes('PacketType.S2C_POSITION_CORRECTION, chorusPlan.correction'));
});

test('307: server Chorus teleports only notify peers in the same dimension', () => {
  assert.ok(serverSource.includes('other.dimension !== session.dimension'));
  assert.ok(serverSource.includes("teleportEffect: 'chorus_fruit'"));
  assert.ok(serverSource.includes('from: chorusPlan.from'));
});

test('308: local correction renders a directional Chorus trail and named sound', () => {
  assert.ok(clientSource.includes("teleportEffect === 'chorus_fruit'"));
  assert.ok(clientSource.includes('spawnTeleportTrail26_3('));
  assert.ok(clientSource.includes("playNamedEvent26_3('item.chorus_fruit.teleport')"));
});

test('309: remote-player movement also renders the same Chorus teleport effect', () => {
  const moveStart = clientSource.indexOf('case PacketType.S2C_PLAYER_MOVE');
  const correctionStart = clientSource.indexOf('case PacketType.S2C_POSITION_CORRECTION');
  const moveBlock = clientSource.slice(moveStart, correctionStart);
  assert.ok(moveBlock.includes("teleportEffect === 'chorus_fruit'"));
  assert.ok(moveBlock.includes('spawnTeleportTrail26_3('));
});

test('310: authoritative position correction zeroes client momentum after Chorus teleport', () => {
  const correctionStart = clientSource.indexOf('case PacketType.S2C_POSITION_CORRECTION');
  const velocityStart = clientSource.indexOf('case PacketType.S2C_PLAYER_VELOCITY');
  const correctionBlock = clientSource.slice(correctionStart, velocityStart);
  assert.ok(correctionBlock.includes('this.game.player.velocity.set(0, 0, 0)'));
});
`);

console.log('Applied parity 301-310 authoritative multiplayer Chorus teleport.');
