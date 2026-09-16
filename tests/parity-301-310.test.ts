import assert from 'node:assert/strict';
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
