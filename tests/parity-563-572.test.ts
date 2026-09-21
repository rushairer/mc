import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inferItemBehaviorId } from '../src/world/BehaviorIds';
import { getThrowableProjectileType, isValidItemActionForHeldStack } from '../src/server/ItemActionRules';
import { isMinecartItemName, isSupportedServerItemUseName } from '../src/server/ServerItemUseRules';

test('563: Minecart item identity is recognized by both behavior and server item-use routing', () => {
  assert.equal(inferItemBehaviorId('minecart'), 'minecraft:minecart');
  assert.equal(isMinecartItemName('minecart'), true);
  assert.equal(isMinecartItemName('chest_minecart'), true);
  assert.equal(isMinecartItemName('oak_boat'), false);
  assert.equal(isSupportedServerItemUseName('minecart', 'block'), true);
});

test('564: multiplayer Minecart placement sends server item-use before local entity creation or item removal', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const method = source.match(/private tryPlaceMinecart[\s\S]*?\n  \}/)?.[0] ?? '';
  const send = method.indexOf('this.sendServerBlockItemUse(stack, target)');
  const spawn = method.indexOf("this.vehicles.spawnVehicle('minecart'");
  const consume = method.indexOf('this.inventory.removeFromSlot');
  assert.ok(send >= 0 && spawn > send && consume > send);
});

test('565: server accepts Minecart placement only when the authoritative target block is a rail', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const start = source.indexOf('if (isMinecartItemName(itemName))');
  const end = source.indexOf('const vehicleType = vehicleTypeForBoatItemName', start);
  const handler = source.slice(start, end);
  assert.ok(handler.includes('BlockRegistry.isRail(targetBlockId)'));
  assert.ok(handler.includes("type: 'minecart'"));
});

test('566: server Minecart spawn preserves source item identity and consumes through server inventory authority', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const start = source.indexOf('if (isMinecartItemName(itemName))');
  const end = source.indexOf('const vehicleType = vehicleTypeForBoatItemName', start);
  const handler = source.slice(start, end);
  assert.ok(handler.includes('sourceItemId: held.id'));
  assert.ok(handler.includes('PacketType.S2C_VEHICLE_SPAWN'));
  assert.ok(handler.includes('this.consumeServerHeldItem(session, held)'));
});

test('567: server Minecart physics follows rail axis, powered acceleration, and rail speed limits', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const start = source.indexOf('private tickServerMinecartPhysics');
  const end = source.indexOf('private tickServerVehicles', start);
  const method = source.slice(start, end);
  assert.ok(method.includes('BlockRegistry.isRail(block)'));
  assert.ok(method.includes('const powered = baseBlockId === 27'));
  assert.ok(method.includes('const speedLimit = powered ? 10 : 6'));
  assert.ok(method.includes('vehicle.input.forward'));
});

test('568: server vehicle tick uses Minecart-specific physics but keeps common rider and update synchronization', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const start = source.indexOf('private tickServerVehicles');
  const end = source.indexOf('private tickPrimedTnt', start);
  const method = source.slice(start, end);
  assert.ok(method.includes("vehicle.type === 'minecart'"));
  assert.ok(method.includes('this.tickServerMinecartPhysics(vehicle, dt)'));
  assert.ok(method.includes("vehicle.type === 'minecart' ? 0.35 : 0.55"));
  assert.ok(method.includes('PacketType.S2C_VEHICLE_UPDATE'));
});

test('569: Minecart destruction and late join reuse the same exact-source authoritative Vehicle contract', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  assert.ok(source.includes("{ id: vehicle.sourceItemId, count: 1 }"));
  assert.ok(source.includes('type: vehicle.type'));
  assert.ok(source.includes('riderId: vehicle.riderId ?? null'));
});

test('569b: NetworkClient accepts authoritative Minecart spawns instead of filtering them out', () => {
  const source = readFileSync(new URL('../src/server/NetworkClient.ts', import.meta.url), 'utf8');
  const start = source.indexOf('case PacketType.S2C_VEHICLE_SPAWN');
  const end = source.indexOf('case PacketType.S2C_VEHICLE_UPDATE', start);
  const handler = source.slice(start, end);
  assert.ok(handler.includes("type !== 'minecart'"));
  assert.ok(handler.includes('this.game.vehicles.spawnVehicle('));
});

test('570: Firework Rocket is a validated server throwable action', () => {
  const firework = getThrowableProjectileType(401);
  const modern = getThrowableProjectileType(20006);
  assert.ok(firework === 'firework_rocket' || modern === 'firework_rocket');
  const source = readFileSync(new URL('../src/server/ItemActionRules.ts', import.meta.url), 'utf8');
  assert.ok(source.includes("return 'firework_rocket'"));
});

test('571: multiplayer projectile sends no longer optimistically consume Trident, throwable, Potion, or Firework inventory', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const throwMethod = source.match(/private tryThrowHeldProjectile[\s\S]*?\n  \}/)?.[0] ?? '';
  const networkSegments = throwMethod.split('this.sendItemAction').slice(1).map((segment) => segment.split('return true;')[0]);
  assert.ok(networkSegments.length >= 3);
  for (const segment of networkSegments) {
    assert.equal(segment.includes('removeFromSlot'), false);
  }
  const potion = source.match(/private throwPotion[\s\S]*?\n  \}/)?.[0] ?? '';
  const potionNetwork = potion.slice(potion.indexOf('this.sendItemAction'), potion.indexOf('return;', potion.indexOf('this.sendItemAction')));
  assert.equal(potionNetwork.includes('removeItem'), false);
});

test('572: creative server item actions do not require/consume Bow ammo or damage/consume thrown items', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const start = source.indexOf('case PacketType.C2S_ITEM_ACTION');
  const end = source.indexOf('case PacketType.C2S_PLAYER_STATE', start);
  const handler = source.slice(start, end);
  assert.ok(handler.includes("if (session.gameMode !== 'creative')"));
  assert.ok(handler.includes("type === 'firework_rocket' ? 18 : 15"));
  assert.ok(handler.includes("type === 'firework_rocket' ? 5 : 1"));
});
