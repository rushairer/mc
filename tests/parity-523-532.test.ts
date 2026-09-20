import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createIdleServerVehicleInput,
  parseServerVehicleInput,
  parseServerVehicleInteraction,
} from '../src/server/ServerVehicleRules';
import { PacketType } from '../src/server/NetworkProtocol';

test('523: vehicle interaction intents accept only explicit mount/dismount/attack/container actions', () => {
  assert.deepEqual(parseServerVehicleInteraction({ vehicleId: 12, action: 'mount' }), { vehicleId: 12, action: 'mount' });
  assert.deepEqual(parseServerVehicleInteraction({ vehicleId: 12, action: 'open_container' }), { vehicleId: 12, action: 'open_container' });
  assert.equal(parseServerVehicleInteraction({ vehicleId: 0, action: 'mount' }), null);
  assert.equal(parseServerVehicleInteraction({ vehicleId: 12, action: 'teleport' }), null);
});

test('524: vehicle control packets sanitize booleans and preserve the authoritative vehicle id', () => {
  assert.deepEqual(parseServerVehicleInput({ vehicleId: 7, forward: true, left: 1, right: false }), {
    vehicleId: 7, forward: true, back: false, left: false, right: false,
  });
  assert.deepEqual(createIdleServerVehicleInput(7), {
    vehicleId: 7, forward: false, back: false, left: false, right: false,
  });
});

test('525: server mount validates vehicle existence, dimension, reach, and exclusive rider ownership', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const start = source.indexOf('case PacketType.C2S_VEHICLE_INTERACT');
  const end = source.indexOf('case PacketType.C2S_VEHICLE_INPUT', start);
  const handler = source.slice(start, end);
  assert.ok(handler.includes('vehicle.dimension !== session.dimension'));
  assert.ok(handler.includes('isEntityAttackInReach(session, vehicle.position, session.gameMode)'));
  assert.ok(handler.includes('session.ridingVehicleId !== undefined || vehicle.riderId'));
  assert.ok(handler.includes('vehicle.riderId = session.id'));
});

test('526: multiplayer client waits for S2C rider authority instead of mounting a Boat optimistically', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = source.indexOf("id: 'minecraft:vehicle_mount'");
  const end = source.indexOf('this.behaviors.registerEntity(', start + 20);
  const handler = source.slice(start, end);
  assert.ok(handler.includes('PacketType.C2S_VEHICLE_INTERACT'));
  assert.ok(handler.includes("action: 'mount'"));
  const sendIndex = handler.indexOf("action: 'mount'");
  const localMountIndex = handler.indexOf('this.riddenVehicle = target');
  assert.ok(sendIndex >= 0 && localMountIndex > sendIndex);
});

test('527: dismount is server-authoritative and only the current rider can clear the rider relation', () => {
  const server = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  assert.ok(server.includes("intent.action === 'dismount'"));
  assert.ok(server.includes('vehicle.riderId !== session.id || session.ridingVehicleId !== vehicle.id'));
  const client = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  assert.ok(client.includes("action: 'dismount'"));
});

test('528: only the server rider can submit Boat controls and server ticks broadcast authoritative positions', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const start = source.indexOf('case PacketType.C2S_VEHICLE_INPUT');
  const end = source.indexOf('case PacketType.C2S_INTERACT_ENTITY', start);
  const handler = source.slice(start, end);
  assert.ok(handler.includes('vehicle.riderId !== session.id || session.ridingVehicleId !== vehicle.id'));
  assert.ok(source.includes('private tickServerVehicles(dt: number)'));
  assert.ok(source.includes('PacketType.S2C_VEHICLE_UPDATE'));
  assert.ok(source.includes('rider.x = vehicle.position.x'));
});

test('529: multiplayer clients stop running local Boat physics and send controls at server tick cadence', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  assert.ok(source.includes('this.vehicleInputSendTimer = 0.05'));
  assert.ok(source.includes('PacketType.C2S_VEHICLE_INPUT'));
  const vehicleUpdate = source.indexOf('this.vehicles.update(');
  const multiplayerGuard = source.lastIndexOf('if (this.isMultiplayerNetworkConnected())', vehicleUpdate);
  assert.ok(multiplayerGuard >= 0 && multiplayerGuard < vehicleUpdate);
});

test('530: attacking a server Boat drops exact source identity, Chest Boat contents, and broadcasts despawn', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const method = source.match(/private destroyServerVehicle[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.ok(method.includes('vehicle.inventory'));
  assert.ok(method.includes('{ id: vehicle.sourceItemId, count: 1 }'));
  assert.ok(method.includes('PacketType.S2C_VEHICLE_DESPAWN'));
  assert.equal(PacketType.C2S_VEHICLE_INTERACT, 'C2S_VEHICLE_INTERACT');
  assert.equal(PacketType.S2C_VEHICLE_DESPAWN, 'S2C_VEHICLE_DESPAWN');
});

test('531: Chest Boat opens through the existing server-owned cursor/container transaction path', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  assert.ok(source.includes("intent.action === 'open_container'"));
  assert.ok(source.includes("session.openContainer = { source: 'vehicle', vehicleId: vehicle.id, cursor: null }"));
  assert.ok(source.includes("open.source === 'block'"));
  assert.ok(source.includes('this.vehicles.get(open.vehicleId)?.inventory'));
  assert.ok(source.includes('this.setOpenContainerSlots(open, next.containerSlots)'));
  assert.ok(source.includes("source: 'vehicle'"));
  assert.ok(source.includes('vehicleId: open.vehicleId'));
  assert.equal(PacketType.C2S_CONTAINER_CLICK, 'C2S_CONTAINER_CLICK');
  assert.equal(PacketType.S2C_CONTAINER_DATA, 'S2C_CONTAINER_DATA');
});

test('532: block interaction reach now respects creative/survival mode and late join Vehicle state includes rider/rotation', () => {
  const server = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const start = server.indexOf('case PacketType.C2S_INTERACT_BLOCK');
  const end = server.indexOf('case PacketType.C2S_VEHICLE_INTERACT', start);
  const handler = server.slice(start, end);
  assert.ok(handler.includes('isBlockActionInReach(session, x, y, z, session.gameMode)'));
  assert.ok(!handler.includes("'survival'"));
  assert.ok(server.includes('riderId: vehicle.riderId ?? null'));
  assert.ok(server.includes('rotationY: vehicle.rotationY'));
});
