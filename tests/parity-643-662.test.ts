import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { Mob } from '../src/entities/Mob';
import { MobSystem } from '../src/systems/MobSystem';
import { inferBlockBehaviorId, inferItemBehaviorId } from '../src/world/BehaviorIds';
import { isSupportedServerItemUseName } from '../src/server/ServerItemUseRules';
import { localizeItemDisplayName } from '../src/i18nItemNames';
import {
  LEAD_PULL_DISTANCE,
  LEAD_SNAP_DISTANCE,
  canPlaceHangingEntity,
  choosePaintingVariant,
  hangingEntityWorldPosition,
  hangingEntityYaw,
  hangingSupportPositionFromWorld,
  fenceLeashHolderId,
  isFenceBlockName,
  isLeashableMobType,
  mobLeashHolderId,
  parseFenceLeashHolderId,
  parseMobLeashHolderId,
  leashPullVector,
  nextItemFrameRotation,
  shouldBreakLeash,
} from '../src/entities/HangingEntityRules';

test('643: Item Frame, Painting, and Lead have dedicated behavior identities and localized names', () => {
  assert.equal(inferItemBehaviorId('item_frame'), 'minecraft:item_frame');
  assert.equal(inferItemBehaviorId('painting'), 'minecraft:painting');
  assert.equal(inferItemBehaviorId('lead'), 'minecraft:lead');
  assert.equal(localizeItemDisplayName('zh-CN', 'item_frame', 'Item Frame'), '物品展示框');
  assert.equal(localizeItemDisplayName('zh-CN', 'painting', 'Painting'), '画');
  assert.equal(localizeItemDisplayName('zh-CN', 'lead', 'Lead'), '拴绳');
});

test('644: Item Frames require solid support, empty attachment space, and may use any block face', () => {
  const support = { x: 4, y: 64, z: 7 };
  const solid = (x: number, y: number, z: number) => x === 4 && y === 64 && z === 7;
  assert.equal(canPlaceHangingEntity('item_frame', support, 'north', solid, () => false), true);
  assert.equal(canPlaceHangingEntity('item_frame', support, 'up', solid, () => false), true);
  assert.equal(canPlaceHangingEntity('item_frame', support, 'down', solid, () => false), true);
  assert.equal(canPlaceHangingEntity('item_frame', support, 'north', () => false, () => false), false);
  assert.equal(canPlaceHangingEntity('item_frame', support, 'north', solid, () => true), false);
});

test('645: Paintings attach only to vertical supported faces', () => {
  const support = { x: 0, y: 64, z: 0 };
  const solid = (x: number, y: number, z: number) => x === 0 && y === 64 && z === 0;
  assert.equal(canPlaceHangingEntity('painting', support, 'north', solid, () => false), true);
  assert.equal(canPlaceHangingEntity('painting', support, 'east', solid, () => false), true);
  assert.equal(canPlaceHangingEntity('painting', support, 'up', solid, () => false), false);
  assert.equal(canPlaceHangingEntity('painting', support, 'down', solid, () => false), false);
});

test('646: hanging positions sit just outside support and visible fronts face outward', () => {
  const support = { x: 10, y: 64, z: 20 };
  const north = hangingEntityWorldPosition(support, 'north');
  const south = hangingEntityWorldPosition(support, 'south');
  assert.equal(north.z, 20 - 0.03125);
  assert.equal(south.z, 21 + 0.03125);
  assert.equal(hangingEntityYaw('north'), Math.PI);
  assert.equal(hangingEntityYaw('south'), 0);
  assert.deepEqual(hangingSupportPositionFromWorld(north, 'north'), support);
  assert.deepEqual(hangingSupportPositionFromWorld(south, 'south'), support);
});

test('647: multiplayer hanging placement sends server intent before local spawn or inventory mutation', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = source.indexOf('private tryPlaceHangingEntity');
  const end = source.indexOf('private tryInteractItemFrame', start);
  const method = source.slice(start, end);
  const send = method.indexOf('this.sendServerBlockItemUse(stack, target)');
  const spawn = method.indexOf('this.mobs.spawnMob(type');
  const consume = method.indexOf('this.inventory.removeFromSlot');
  assert.ok(send >= 0 && spawn > send && consume > send);
});

test('648: server owns hanging placement validation, spawn, consumption, and sound', () => {
  assert.equal(isSupportedServerItemUseName('item_frame', 'block'), true);
  assert.equal(isSupportedServerItemUseName('painting', 'block'), true);
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const start = source.indexOf("if (itemName === 'item_frame' || itemName === 'painting')");
  const end = source.indexOf("if (itemName === 'armor_stand')", start);
  const branch = source.slice(start, end);
  assert.ok(branch.includes('canPlaceHangingEntity('));
  assert.ok(branch.includes('hangingEntityWorldPosition('));
  assert.ok(branch.includes('choosePaintingVariant('));
  assert.ok(branch.includes('this.spawnMob('));
  assert.ok(branch.includes('this.consumeServerHeldItem(session, held)'));
});

test('649: Item Frame has visible frame geometry and renders exactly one displayed item', () => {
  const frame = new Mob('item_frame', 0.5, 64.5, 0);
  assert.ok(frame.mesh.getObjectByName('item_frame_back'));
  frame.setItemFrameItem({ id: 264, count: 37, customName: 'Gem' });
  assert.equal(frame.itemFrameItem?.count, 1);
  assert.equal(frame.itemFrameItem?.customName, 'Gem');
  assert.ok(frame.mesh.getObjectByName('item_frame_item'));
});

test('650: Item Frame insertion and rotation cover all eight Java display steps', () => {
  let rotation = 0;
  const seen = new Set<number>();
  for (let index = 0; index < 8; index++) {
    seen.add(rotation);
    rotation = nextItemFrameRotation(rotation);
  }
  assert.equal(seen.size, 8);
  assert.equal(rotation, 0);

  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = source.indexOf('private tryInteractItemFrame');
  const end = source.indexOf('private tryUseLeadOnMob', start);
  const method = source.slice(start, end);
  assert.ok(method.includes('target.setItemFrameItem(heldItem)'));
  assert.ok(method.includes('target.rotateItemFrame()'));
});

test('651: server Item Frame insertion consumes one canonical held item and rotation is authoritative', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const start = source.indexOf("if (mob.type === 'item_frame')");
  const end = source.indexOf("if (mob.type !== 'armor_stand')", start);
  const branch = source.slice(start, end);
  assert.ok(branch.includes('framed.count = 1'));
  assert.ok(branch.includes('consumeHeldStack(held)'));
  assert.ok(branch.includes('nextItemFrameRotation(mob.itemFrameRotation ?? 0)'));
  assert.ok(branch.includes('itemFrameItem: cloneItemStack(mob.itemFrameItem)'));
  assert.ok(branch.includes('itemFrameRotation: mob.itemFrameRotation ?? 0'));
});

test('652: survival attacks pop a framed item before destroying the Item Frame on client and server', () => {
  const client = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  assert.ok(client.includes("decorativeTarget?.def.type === 'item_frame'"));
  assert.ok(client.includes('decorativeTarget.setItemFrameItem(null)'));
  const server = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  assert.ok(server.includes("if (mob.type === 'item_frame' && mob.itemFrameItem)"));
  assert.ok(server.includes('mob.itemFrameItem = undefined'));
  assert.ok(server.includes('itemFrameItem: null'));
});

test('653: Painting variants are deterministic and represented by visible canvas geometry', () => {
  const pos = { x: 12, y: 70, z: -5 };
  assert.equal(choosePaintingVariant(12345, pos), choosePaintingVariant(12345, pos));
  const painting = new Mob('painting', 0.5, 64.5, 0);
  assert.ok(painting.mesh.getObjectByName('painting_frame'));
  assert.ok(painting.mesh.getObjectByName('painting_canvas'));
  painting.setPaintingVariant('plant');
  assert.equal(painting.paintingVariant, 'plant');
});

test('654: Painting face and variant survive MobSystem save/restore', () => {
  const system = new MobSystem(new THREE.Scene());
  system.doMobSpawning = false;
  const painting = system.spawnMob('painting', 1.5, 65.5, 2.96875)!;
  painting.setHangingFace('north');
  painting.setPaintingVariant('wasteland');
  const saved = system.serialize(0);

  const restored = new MobSystem(new THREE.Scene());
  restored.doMobSpawning = false;
  restored.restore(saved, 0);
  const copy = Array.from(restored.mobs.values())[0];
  assert.equal(copy.def.type, 'painting');
  assert.equal(copy.hangingFace, 'north');
  assert.equal(copy.paintingVariant, 'wasteland');
});

test('655: Item Frame face, displayed stack components, and rotation survive save/restore', () => {
  const system = new MobSystem(new THREE.Scene());
  system.doMobSpawning = false;
  const frame = system.spawnMob('item_frame', 4.5, 66.5, 7.96875)!;
  frame.setHangingFace('north');
  frame.setItemFrameState({ id: 264, count: 1, customName: 'Treasure' }, 5);
  const saved = system.serialize(0);

  const restored = new MobSystem(new THREE.Scene());
  restored.doMobSpawning = false;
  restored.restore(saved, 0);
  const copy = Array.from(restored.mobs.values())[0];
  assert.equal(copy.def.type, 'item_frame');
  assert.equal(copy.hangingFace, 'north');
  assert.equal(copy.itemFrameRotation, 5);
  assert.equal(copy.itemFrameItem?.id, 264);
  assert.equal(copy.itemFrameItem?.customName, 'Treasure');
});

test('656: multiplayer spawn and state paths apply hanging entity and Item Frame state', () => {
  const source = readFileSync(new URL('../src/server/NetworkClient.ts', import.meta.url), 'utf8');
  const spawnStart = source.indexOf('case PacketType.S2C_MOB_SPAWN');
  const moveStart = source.indexOf('case PacketType.S2C_MOB_MOVE', spawnStart);
  const spawn = source.slice(spawnStart, moveStart);
  assert.ok(spawn.includes('hangingFace'));
  assert.ok(spawn.includes('mob.setHangingFace(hangingFace)'));
  assert.ok(spawn.includes('mob.setItemFrameState(itemFrameItem ?? null, itemFrameRotation ?? 0)'));
  assert.ok(spawn.includes('mob.setPaintingVariant(paintingVariant)'));

  const stateStart = source.indexOf('case PacketType.S2C_MOB_STATE');
  const riderStart = source.indexOf('case PacketType.S2C_MOB_RIDER', stateStart);
  const state = source.slice(stateStart, riderStart);
  assert.ok(state.includes('itemFrameItem'));
  assert.ok(state.includes('mob.setItemFrameState('));
});

test('657: Lead is a dedicated behavior and only supported mob families can be leashed', () => {
  assert.equal(inferItemBehaviorId('lead'), 'minecraft:lead');
  assert.equal(isSupportedServerItemUseName('lead', 'entity'), true);
  assert.equal(isLeashableMobType('cow'), true);
  assert.equal(isLeashableMobType('horse'), true);
  assert.equal(isLeashableMobType('iron_golem'), true);
  assert.equal(isLeashableMobType('zombie'), false);
  assert.equal(isLeashableMobType('item_frame'), false);
  assert.equal(inferBlockBehaviorId('oak_fence'), 'minecraft:fence');
  assert.equal(isFenceBlockName('oak_fence'), true);
  assert.equal(isFenceBlockName('oak_fence_gate'), false);

  const recipes = JSON.parse(readFileSync(new URL('../src/items/data/recipes.json', import.meta.url), 'utf8'));
  const leadShape = recipes['420'][0].inShape.flat().filter((id: number | null) => id !== null);
  assert.deepEqual(leadShape, [287, 287, 287, 287, 287]);
  assert.equal(leadShape.includes(341), false);
});

test('658: Lead attachment is server authoritative in multiplayer and consumes survival inventory there', () => {
  const client = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = client.indexOf('private tryUseLeadOnMob');
  const end = client.indexOf('private tryDetachLeadFromMob', start);
  const method = client.slice(start, end);
  assert.ok(method.includes('this.sendServerEntityItemUse(heldItem, target.id)'));
  assert.ok(method.indexOf('this.sendServerEntityItemUse') < method.indexOf("target.leashHolderId = 'local-player'"));

  const server = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const serverStart = server.indexOf("if (itemName === 'lead')");
  const serverEnd = server.indexOf("if (itemName === 'name_tag')", serverStart);
  const branch = server.slice(serverStart, serverEnd);
  assert.ok(branch.includes('mob.leashHolderId = session.id'));
  assert.ok(branch.includes('this.consumeServerHeldItem(session, held)'));
  assert.ok(branch.includes('leashHolderId: session.id'));
  assert.ok(branch.includes('heldByOtherPlayer'));
  assert.ok(branch.includes('parseMobLeashHolderId(mob.leashHolderId)'));
});

test('659: Lead has six blocks of slack and applies a bounded pull beyond that distance', () => {
  assert.equal(LEAD_PULL_DISTANCE, 6);
  const holder = { x: 0, y: 0, z: 0 };
  assert.deepEqual(leashPullVector(holder, { x: 6, y: 0, z: 0 }), { x: 0, y: 0, z: 0 });
  const pulled = leashPullVector(holder, { x: 9, y: 0, z: 0 });
  assert.ok(pulled.x < 0);
  assert.equal(pulled.y, 0);
  assert.equal(pulled.z, 0);
  assert.ok(Math.abs(pulled.x) <= 6);
});

test('660: Lead snaps beyond twelve blocks, supports active detach, and transfers to fence anchors', () => {
  assert.equal(LEAD_SNAP_DISTANCE, 12);
  assert.equal(shouldBreakLeash(12), false);
  assert.equal(shouldBreakLeash(12.001), true);
  const fenceId = fenceLeashHolderId(0, { x: 4, y: 64, z: 7 });
  assert.deepEqual(parseFenceLeashHolderId(fenceId), {
    dimension: 0,
    position: { x: 4, y: 64, z: 7 },
  });

  const client = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  assert.ok(client.includes('private tryDetachLeadFromMob'));
  assert.ok(client.includes('private tryTieLeashedMobsToFence'));
  assert.ok(client.includes("heldName === 'shears' && fenceLeashed.length > 0"));
  assert.ok(client.includes("!this.input.isKeyDown('shift')"));
  assert.ok(client.includes('if (shouldBreakLeash(distance))'));
  assert.ok(client.includes('this.droppedItems.spawnItem(\n              420,'));
  const server = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  assert.ok(server.includes('if (shouldBreakLeash(distance))'));
  assert.ok(server.includes('fenceLeashHolderId(session.dimension, { x, y, z })'));
  assert.ok(server.includes("heldName === 'shears' && fenceLeashed.length > 0"));
  assert.ok(server.includes('!session.sneaking'));
  assert.ok(server.includes("intent.action === 'transfer_leashes'"));
  assert.ok(server.includes('leashHolderId: null'));
});

test('661: Lead ownership syncs, renders, and mob-to-mob holders survive save id remapping', () => {
  const network = readFileSync(new URL('../src/server/NetworkClient.ts', import.meta.url), 'utf8');
  assert.ok(network.includes('leashHolderId'));
  assert.ok(network.includes("mob.leashHolderId = typeof leashHolderId === 'string'"));
  const game = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  assert.ok(game.includes('private leashLines = new Map<number, THREE.Line>()'));
  assert.ok(game.includes("line.name = 'mob_leash'"));
  assert.ok(game.includes('parseFenceLeashHolderId(mob.leashHolderId)'));
  assert.ok(game.includes('parseMobLeashHolderId(mob.leashHolderId)'));
  assert.ok(game.includes('line.geometry.setFromPoints([holder, center])'));

  const source = new MobSystem(new THREE.Scene());
  source.doMobSpawning = false;
  const holder = source.spawnMob('cow', 0, 64, 0)!;
  const child = source.spawnMob('pig', 2, 64, 0)!;
  child.leashHolderId = mobLeashHolderId(holder.id);
  assert.equal(parseMobLeashHolderId(child.leashHolderId), holder.id);
  const saved = source.serialize(0);

  const restored = new MobSystem(new THREE.Scene());
  restored.doMobSpawning = false;
  restored.restore(saved, 0);
  const restoredHolder = Array.from(restored.mobs.values()).find((mob) => mob.def.type === 'cow')!;
  const restoredChild = Array.from(restored.mobs.values()).find((mob) => mob.def.type === 'pig')!;
  assert.equal(restoredChild.leashHolderId, mobLeashHolderId(restoredHolder.id));
});

test('662: hanging entities have support lifecycle, separate persistence capacity, and no natural-mob budget cost', () => {
  const game = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  assert.ok(game.includes('private breakUnsupportedHangingEntities()'));
  assert.ok(game.includes('hangingSupportPositionFromWorld('));

  const save = readFileSync(new URL('../src/systems/SaveSystem.ts', import.meta.url), 'utf8');
  assert.ok(save.includes('MAX_RESTORED_DECORATIVE_ENTITIES_PER_DIMENSION = 512'));
  assert.ok(save.includes('entityId?: number'));
  assert.ok(save.includes("mob.type === 'armor_stand' || mob.type === 'item_frame' || mob.type === 'painting'"));

  const mobs = readFileSync(new URL('../src/systems/MobSystem.ts', import.meta.url), 'utf8');
  assert.ok(mobs.includes("mob.def.type !== 'item_frame'"));
  assert.ok(mobs.includes("mob.def.type !== 'painting'"));
  assert.ok(mobs.includes('idMap.set(Number(saved.entityId), mob.id)'));
  assert.ok(mobs.includes('mobLeashHolderId(newHolderId)'));

  const server = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  assert.ok(server.includes("mob.type !== 'item_frame' && mob.type !== 'painting'"));
  assert.ok(server.includes('hangingSupportPositionFromWorld('));
});
