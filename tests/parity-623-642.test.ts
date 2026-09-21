import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { ItemRegistry } from '../src/items/ItemRegistry';
import { Mob } from '../src/entities/Mob';
import {
  ARMOR_STAND_HEIGHT,
  ARMOR_STAND_WIDTH,
  armorStandSlotIndex,
  canPlaceArmorStandAt,
  snapArmorStandYaw,
} from '../src/entities/ArmorStandRules';
import { inferItemBehaviorId } from '../src/world/BehaviorIds';
import { isSupportedServerItemUseName } from '../src/server/ServerItemUseRules';
import { parseServerMobRideInteraction } from '../src/server/ServerMobRideRules';

test('623: Armor Stand item has a dedicated behavior identity', () => {
  assert.equal(inferItemBehaviorId('armor_stand'), 'minecraft:armor_stand');
  assert.equal(ItemRegistry.getByName('armor_stand')?.behaviorId, 'minecraft:armor_stand');
});

test('624: Armor Stand uses the Java-sized normal collision dimensions', () => {
  assert.equal(ARMOR_STAND_WIDTH, 0.5);
  assert.equal(ARMOR_STAND_HEIGHT, 1.975);
  const stand = new Mob('armor_stand', 0, 64, 0);
  assert.equal(stand.width, 0.5);
  assert.equal(stand.height, 1.975);
});

test('625: Armor Stand placement yaw snaps to eight orientations', () => {
  const step = Math.PI / 4;
  assert.equal(snapArmorStandYaw(0.1), 0);
  assert.equal(snapArmorStandYaw(step * 0.8), step);
  assert.equal(snapArmorStandYaw(step * 1.7), step * 2);
  assert.equal(snapArmorStandYaw(-step * 0.8), -step);
});

test('626: Armor Stand placement requires support, two-block air space, and no entity overlap', () => {
  const p = { x: 4, y: 65, z: 4 };
  const solidOnlyBelow = (x: number, y: number, z: number) => x === 4 && y === 64 && z === 4;
  assert.equal(canPlaceArmorStandAt(p, 'up', solidOnlyBelow, () => false), true);
  assert.equal(canPlaceArmorStandAt(p, 'down', solidOnlyBelow, () => false), false);
  assert.equal(canPlaceArmorStandAt(p, 'up', () => false, () => false), false);
  assert.equal(canPlaceArmorStandAt(p, 'up', (x, y, z) => solidOnlyBelow(x, y, z) || y === 66, () => false), false);
  assert.equal(canPlaceArmorStandAt(p, 'up', solidOnlyBelow, () => true), false);
});

test('627: multiplayer Armor Stand placement sends block-use intent before local spawn or consumption', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = source.indexOf('private tryPlaceArmorStand');
  const end = source.indexOf('private tryInteractArmorStand', start);
  const method = source.slice(start, end);
  const send = method.indexOf('this.sendServerBlockItemUse(stack, target)');
  const spawn = method.indexOf("this.mobs.spawnMob('armor_stand'");
  const consume = method.indexOf('this.inventory.removeFromSlot');
  assert.ok(send >= 0 && spawn > send && consume > send);
});

test('628: server Armor Stand placement owns space validation, yaw, spawn, and inventory consumption', () => {
  assert.equal(isSupportedServerItemUseName('armor_stand', 'block'), true);
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const start = source.indexOf("if (itemName === 'armor_stand')");
  const end = source.indexOf('const spawnEggMobType', start);
  const branch = source.slice(start, end);
  assert.ok(branch.includes('canPlaceArmorStandAt('));
  assert.ok(branch.includes('snapArmorStandYaw(session.yaw)'));
  assert.ok(branch.includes("this.spawnMob(\n        'armor_stand'"));
  assert.ok(branch.includes('this.consumeServerHeldItem(session, held)'));
});

test('629: Armor Stand is static and does not enter ordinary mob wandering AI', () => {
  const mobSource = readFileSync(new URL('../src/entities/Mob.ts', import.meta.url), 'utf8');
  assert.ok(mobSource.includes("this.def.type === 'armor_stand'"));
  assert.ok(mobSource.includes("this.aiState = 'idle'"));
  const server = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const tickStart = server.indexOf('private tickMobs');
  const start = server.indexOf("if (mob.type === 'armor_stand')", tickStart);
  assert.ok(start > tickStart);
  assert.ok(server.slice(start, start + 700).includes("mob.aiState = 'idle'"));
});

test('630: Armor Stand armor-slot mapping is stable and explicit', () => {
  assert.equal(armorStandSlotIndex('helmet'), 0);
  assert.equal(armorStandSlotIndex('chestplate'), 1);
  assert.equal(armorStandSlotIndex('leggings'), 2);
  assert.equal(armorStandSlotIndex('boots'), 3);
});

test('631: Armor Stand equipment is cloned and produces visible armor geometry', () => {
  const helmet = ItemRegistry.getByName('iron_helmet');
  assert.ok(helmet);
  const stand = new Mob('armor_stand', 0, 64, 0);
  const input = { id: helmet.id, count: 1, customName: 'Original' };
  stand.setArmorStandEquipment(0, input);
  input.customName = 'Mutated';
  assert.equal(stand.getArmorStandEquipment(0)?.customName, 'Original');
  assert.ok(stand.mesh.getObjectByName('armor_helmet'));
});

test('632: local Armor Stand interaction swaps armor and supports empty-hand removal', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = source.indexOf('private tryInteractArmorStand');
  const end = source.indexOf('private tryPlaceBoat', start);
  const method = source.slice(start, end);
  assert.ok(method.includes("def?.category !== 'armor'"));
  assert.ok(method.includes('armorStandSlotIndex(def.armorSlot)'));
  assert.ok(method.includes('target.setArmorStandEquipment(slotIndex, equipped)'));
  assert.ok(method.includes('firstEquippedArmorStandSlot(target.armorStandEquipment)'));
  assert.ok(method.includes('target.setArmorStandEquipment(slotIndex, null)'));
});

test('633: multiplayer Armor Stand equipment uses generic entity intent while Name Tag still falls through', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = source.indexOf('private tryInteractArmorStand');
  const end = source.indexOf('private tryPlaceBoat', start);
  const method = source.slice(start, end);
  assert.ok(method.includes("if (heldItem && !isArmorItem) return { handled: false }"));
  assert.ok(method.includes("PacketType.C2S_MOB_INTERACT, { mobId: target.id, action: 'interact' }"));
});

test('634: generic server mob interaction parses Armor Stand interact without weakening mount actions', () => {
  assert.deepEqual(parseServerMobRideInteraction({ mobId: 5, action: 'interact' }), { mobId: 5, action: 'interact' });
  assert.equal(parseServerMobRideInteraction({ mobId: 5, action: 'equip_everything' }), null);
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const start = source.indexOf("if (intent.action === 'interact')");
  const mountGate = source.indexOf('if (!canMountMob(', start);
  assert.ok(start >= 0 && mountGate > start);
  assert.ok(source.slice(start, mountGate).includes("mob.type !== 'armor_stand'"));
});

test('635: server Armor Stand equipment exchange uses canonical selected-slot inventory and synchronizes it', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const start = source.indexOf("if (intent.action === 'interact')");
  const end = source.indexOf('if (!canMountMob(', start);
  const branch = source.slice(start, end);
  assert.ok(branch.includes('session.inventory[session.selectedSlot]'));
  assert.ok(branch.includes("heldDef?.category !== 'armor'"));
  assert.ok(branch.includes('cloneItemStack(equipment[slotIndex])'));
  assert.ok(branch.includes('this.syncPlayerInventory(session)'));
  assert.ok(branch.includes('armorStandEquipment: equipment.map'));
});

test('636: network spawn and state updates both carry authoritative Armor Stand equipment', () => {
  const source = readFileSync(new URL('../src/server/NetworkClient.ts', import.meta.url), 'utf8');
  const spawnStart = source.indexOf('case PacketType.S2C_MOB_SPAWN');
  const moveStart = source.indexOf('case PacketType.S2C_MOB_MOVE', spawnStart);
  const spawn = source.slice(spawnStart, moveStart);
  assert.ok(spawn.includes('armorStandEquipment'));
  assert.ok(spawn.includes('mob.setArmorStandEquipmentSnapshot(armorStandEquipment)'));
  const stateStart = source.indexOf('case PacketType.S2C_MOB_STATE');
  const riderStart = source.indexOf('case PacketType.S2C_MOB_RIDER', stateStart);
  const state = source.slice(stateStart, riderStart);
  assert.ok(state.includes('armorStandEquipment'));
  assert.ok(state.includes('mob.setArmorStandEquipmentSnapshot(armorStandEquipment)'));
});

test('637: Armor Stand spawn orientation is immediately reflected by the client mesh', () => {
  const source = readFileSync(new URL('../src/server/NetworkClient.ts', import.meta.url), 'utf8');
  const start = source.indexOf('case PacketType.S2C_MOB_SPAWN');
  const end = source.indexOf('case PacketType.S2C_MOB_MOVE', start);
  const spawn = source.slice(start, end);
  assert.ok(spawn.includes('mob.yaw = Number.isFinite(yaw) ? yaw : 0'));
  assert.ok(spawn.includes('mob.mesh.rotation.y = mob.yaw'));
});

test('638: MobSystem save/restore round-trips Armor Stand orientation and equipment', () => {
  const source = readFileSync(new URL('../src/systems/MobSystem.ts', import.meta.url), 'utf8');
  assert.ok(source.includes("mob.def.type === 'armor_stand'"));
  assert.ok(source.includes('armorStandEquipment:'));
  assert.ok(source.includes('mob.yaw = Number.isFinite(saved.yaw)'));
  assert.ok(source.includes('mob.setArmorStandEquipmentSnapshot(saved.armorStandEquipment ?? [])'));
});

test('639: save recovery accepts Armor Stand entities and sanitizes their equipment snapshot', () => {
  const source = readFileSync(new URL('../src/systems/SaveSystem.ts', import.meta.url), 'utf8');
  assert.ok(source.includes("'guardian', 'vex', 'armor_stand'"));
  assert.ok(source.includes("mob.type === 'armor_stand' && Array.isArray(mob.armorStandEquipment)"));
  assert.ok(source.includes('candidate.count <= 0'));
  assert.ok(source.includes('count: 1'));
});

test('640: Armor Stand break drops equipped stacks and the stand item is never Looting-multiplied', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = source.indexOf('private handleMobDeath');
  const end = source.indexOf('private handleDragonProjectileHits', start);
  const method = source.slice(start, end);
  assert.ok(method.includes("mob.def.type === 'armor_stand' && this.gameMode !== 'creative'"));
  assert.ok(method.includes('this.droppedItems.spawnStack('));
  assert.ok(method.includes('const decorative ='));
  assert.ok(method.includes('const rolls = decorative ? 1 : 1 + lootingLevel'));
  assert.ok(method.includes("decorative && this.gameMode === 'creative'"));
});

test('641: server Armor Stand death returns equipped stacks and its base item with zero XP', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const start = source.indexOf('private handleMobDeath');
  const end = source.indexOf('/** P5.3', start);
  const method = source.slice(start, end);
  assert.ok(method.includes("mob.type === 'armor_stand'"));
  assert.ok(method.includes('for (const stack of mob.armorStandEquipment ?? [])'));
  assert.ok(method.includes('this.spawnDroppedStack('));
  const mobSource = readFileSync(new URL('../src/entities/Mob.ts', import.meta.url), 'utf8');
  assert.ok(mobSource.includes("armor_stand: { type: 'armor_stand', health: 2"));
  assert.ok(mobSource.includes('xpDrop: 0'));
  assert.ok(mobSource.includes('drops: [{ id: 416, count: 1, chance: 1.0 }]'));
});

test('642: placed Armor Stands do not consume natural mob-spawning capacity on client or server', () => {
  const mobSystem = readFileSync(new URL('../src/systems/MobSystem.ts', import.meta.url), 'utf8');
  assert.ok(mobSystem.includes("mob.def.type !== 'armor_stand'"));
  assert.ok(mobSystem.includes("const decorative = type === 'armor_stand'"));
  assert.ok(mobSystem.includes('ordinaryMobCount >= MAX_RESTORED_MOBS_PER_DIMENSION'));
  const server = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  assert.ok(server.includes("mob.type !== 'armor_stand'"));
});
