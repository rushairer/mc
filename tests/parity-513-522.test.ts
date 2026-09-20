import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { ItemRegistry } from '../src/items/ItemRegistry';
import { MobSystem } from '../src/systems/MobSystem';
import { VehicleSystem } from '../src/systems/VehicleSystem';
import { vehicleTypeForBoatItemName } from '../src/server/ServerItemUseRules';
import { registerWildernessBound26_3 } from '../src/world/registerWildernessBound26_3';

registerWildernessBound26_3();

test('513: multiplayer Shears route block use to the server before local Pumpkin mutation', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const method = source.match(/private tryUseShears[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.ok(method.includes('this.sendServerBlockItemUse(held, target)'));
  assert.ok(method.indexOf('this.sendServerBlockItemUse(held, target)') < method.indexOf("target.block.name !== 'pumpkin'"));
});

test('514: server Shears carve Pumpkin, preserve player-facing metadata, drop four seeds, and spend durability', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const method = source.match(/private handleServerBlockItemUse[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.ok(method.includes("itemName === 'shears' && targetBlock.name === 'pumpkin'"));
  assert.ok(method.includes("BlockRegistry.getByName('carved_pumpkin')"));
  assert.ok(method.includes('horizontalFacingFromYaw(session.yaw)'));
  assert.ok(method.includes("ItemRegistry.getByName('pumpkin_seeds')"));
  assert.ok(method.includes('seeds.id, 4'));
  assert.ok(method.includes('this.damageServerHeldTool(session, held)'));
});

test('515: multiplayer Sheep shearing is server-authoritative and client does not flip isSheared optimistically', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = source.indexOf("target.def.type === 'sheep'");
  const end = source.indexOf("if (target.def.type === 'villager')", start);
  const branch = source.slice(start, end);
  assert.ok(branch.includes('this.sendServerEntityItemUse(heldItem, target.id)'));
  assert.ok(branch.indexOf('this.sendServerEntityItemUse') < branch.indexOf('target.isSheared = true'));
});

test('516: server Sheep shearing validates entity reach, adult/unshorn state, creates 1-3 wool, and damages Shears', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const method = source.match(/private handleServerEntityItemUse[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.ok(method.includes("mob.type !== 'sheep'"));
  assert.ok(method.includes('isEntityAttackInReach(session, mob.position, session.gameMode)'));
  assert.ok(method.includes('mob.isBaby || mob.isSheared'));
  assert.ok(method.includes('1 + Math.floor(Math.random() * 3)'));
  assert.ok(method.includes('this.damageServerHeldTool(session, held)'));
});

test('517: sheared Sheep state is carried by spawn/state packets and applied by NetworkClient', () => {
  const server = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  assert.ok(server.includes('isSheared: mob.isSheared'));
  assert.ok(server.includes('isSheared: true'));
  const client = readFileSync(new URL('../src/server/NetworkClient.ts', import.meta.url), 'utf8');
  assert.ok(client.includes('if (isSheared) mob.isSheared = true'));
  assert.ok(client.includes('if (isSheared !== undefined) mob.isSheared = !!isSheared'));
});

test('518: Sheep sheared state survives MobSystem save/restore', () => {
  const scene = new THREE.Scene();
  const system = new MobSystem(scene);
  const sheep = system.spawnMob('sheep', 0, 64, 0);
  assert.ok(sheep);
  sheep.isSheared = true;
  const saved = system.serialize(0);
  assert.equal(saved[0]?.isSheared, true);
  system.restore(saved, 0);
  assert.equal(Array.from(system.mobs.values())[0]?.isSheared, true);
  system.dispose();
});

test('519: Boat item identity resolves ordinary and Chest Boat vehicle types without conflation', () => {
  assert.equal(vehicleTypeForBoatItemName('boat'), 'boat');
  assert.equal(vehicleTypeForBoatItemName('oak_boat'), 'boat');
  assert.equal(vehicleTypeForBoatItemName('poplar_boat'), 'boat');
  assert.equal(vehicleTypeForBoatItemName('oak_chest_boat'), 'chest_boat');
  assert.equal(vehicleTypeForBoatItemName('poplar_chest_boat'), 'chest_boat');
  assert.equal(vehicleTypeForBoatItemName('minecart'), null);
});

test('520: server Boat use owns spawn identity, Chest Boat storage, and survival consumption', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const method = source.match(/private handleServerBlockItemUse[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.ok(method.includes('const vehicleType = vehicleTypeForBoatItemName(itemName)'));
  assert.ok(method.includes("inventory: vehicleType === 'chest_boat' ? createContainerSlots('chest') : null"));
  assert.ok(method.includes('sourceItemId: held.id'));
  assert.ok(method.includes('session.inventory[session.selectedSlot] = consumeHeldStack(held)'));
  assert.ok(method.includes('PacketType.S2C_VEHICLE_SPAWN'));
});

test('521: NetworkClient materializes server Boat/Chest Boat spawns with authoritative IDs and source items', () => {
  const source = readFileSync(new URL('../src/server/NetworkClient.ts', import.meta.url), 'utf8');
  assert.ok(source.includes('case PacketType.S2C_VEHICLE_SPAWN'));
  assert.ok(source.includes('this.game.vehicles.spawnVehicle('));
  assert.ok(source.includes('sourceItemId'));
  assert.ok(source.includes('vehicle.id = id'));
  assert.ok(source.includes('this.game.vehicles.vehicles.set(id, vehicle)'));
});

test('522: late joiners receive active server vehicles and multiplayer clients never spawn Boats optimistically', () => {
  const server = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  assert.ok(server.includes('for (const vehicle of this.vehicles.values())'));
  assert.ok(server.includes('this.sendTo(session, PacketType.S2C_VEHICLE_SPAWN'));
  const clientGame = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const method = clientGame.match(/private tryPlaceBoat[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.ok(method.includes('this.sendServerBlockItemUse(stack, target)'));
  assert.ok(method.indexOf('this.sendServerBlockItemUse(stack, target)') < method.indexOf('this.vehicles.spawnVehicle('));

  const poplarChestBoat = ItemRegistry.getByName('poplar_chest_boat');
  assert.ok(poplarChestBoat);
  const vehicles = new VehicleSystem(new THREE.Scene());
  const local = vehicles.spawnVehicle('chest_boat', new THREE.Vector3(0, 64, 0), poplarChestBoat.id);
  assert.equal(local.inventory?.length, 27);
  assert.equal(local.sourceItemId, poplarChestBoat.id);
  vehicles.dispose();
});
