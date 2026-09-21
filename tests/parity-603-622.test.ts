import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import {
  canApplySaddle,
  canControlMountedMob,
  canMountMob,
  getNameTagLabel,
} from '../src/entities/MobItemInteractionRules';
import {
  createIdleServerMobRideInput,
  parseServerMobRideInput,
  parseServerMobRideInteraction,
} from '../src/server/ServerMobRideRules';
import { isSupportedServerItemUseName } from '../src/server/ServerItemUseRules';
import { MobSystem } from '../src/systems/MobSystem';
import { localizeItemDisplayName } from '../src/i18nItemNames';

test('603: Horse saddle eligibility requires an adult tamed unsaddled horse', () => {
  assert.equal(canApplySaddle('horse', false, true, false), true);
  assert.equal(canApplySaddle('horse', false, false, false), false);
  assert.equal(canApplySaddle('horse', true, true, false), false);
  assert.equal(canApplySaddle('horse', false, true, true), false);
});

test('604: adult Pigs accept one Saddle without a taming requirement', () => {
  assert.equal(canApplySaddle('pig', false, false, false), true);
  assert.equal(canApplySaddle('pig', true, false, false), false);
  assert.equal(canApplySaddle('pig', false, false, true), false);
});

test('605: Horse steering requires both taming and a Saddle', () => {
  assert.equal(canControlMountedMob('horse', true, true), true);
  assert.equal(canControlMountedMob('horse', false, true), false);
  assert.equal(canControlMountedMob('horse', true, false), false);
  assert.equal(canMountMob('horse', false, false), true);
});

test('606: Pig steering requires a Saddle plus Carrot on a Stick', () => {
  assert.equal(canControlMountedMob('pig', false, true, 'carrot_on_a_stick'), true);
  assert.equal(canControlMountedMob('pig', false, true, 'carrot'), false);
  assert.equal(canControlMountedMob('pig', false, false, 'carrot_on_a_stick'), false);
  assert.equal(canMountMob('pig', false, false), true);
});

test('607: Name Tag labels require a real custom name and are bounded', () => {
  assert.equal(getNameTagLabel({ id: 421, count: 1 }), null);
  assert.equal(getNameTagLabel({ id: 421, count: 1, customName: '  Dinnerbone  ' }), 'Dinnerbone');
  assert.equal(getNameTagLabel({ id: 421, count: 1, customName: 'x'.repeat(80) })?.length, 50);
});

test('608: server entity item routing explicitly accepts Shears, Saddle and Name Tag', () => {
  assert.equal(isSupportedServerItemUseName('shears', 'entity'), true);
  assert.equal(isSupportedServerItemUseName('saddle', 'entity'), true);
  assert.equal(isSupportedServerItemUseName('name_tag', 'entity'), true);
  assert.equal(isSupportedServerItemUseName('stone', 'entity'), false);
});

test('609: multiplayer Name Tag use sends server intent before local rename or consumption', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = source.indexOf("const nameTagLabel = heldItemName === 'name_tag'");
  const end = source.indexOf("heldItemName === 'saddle'", start);
  const branch = source.slice(start, end);
  assert.ok(branch.indexOf('this.sendServerEntityItemUse') >= 0);
  assert.ok(branch.indexOf('this.sendServerEntityItemUse') < branch.indexOf('target.customName = nameTagLabel'));
  assert.ok(branch.indexOf('this.sendServerEntityItemUse') < branch.indexOf('this.consumeInteractionItem()'));
});

test('610: multiplayer Saddle use sends server intent before local saddle mutation or consumption', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = source.indexOf("heldItemName === 'saddle'");
  const end = source.indexOf("target.def.type === 'sheep'", start);
  const branch = source.slice(start, end);
  assert.ok(branch.indexOf('this.sendServerEntityItemUse') >= 0);
  assert.ok(branch.indexOf('this.sendServerEntityItemUse') < branch.indexOf('target.isSaddled = true'));
  assert.ok(branch.indexOf('this.sendServerEntityItemUse') < branch.indexOf('this.consumeInteractionItem()'));
});

test('611: Horse and Pig mounting use an explicit server-authoritative mob interaction packet', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = source.indexOf("target.def.type === 'horse' || target.def.type === 'pig'");
  const end = source.indexOf('return { handled: false }', start);
  const branch = source.slice(start, end);
  assert.ok(branch.includes('PacketType.C2S_MOB_INTERACT'));
  assert.ok(branch.includes("action: 'mount'"));
});

test('612: mounted mob steering is gated and multiplayer sends only input intent', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = source.indexOf('// Riding Horse / Pig controls');
  const end = source.indexOf('if (this.riddenVehicle)', start);
  const block = source.slice(start, end);
  assert.ok(block.includes('canControlMountedMob('));
  assert.ok(block.includes('PacketType.C2S_MOB_INPUT'));
  assert.ok(block.includes("action: 'dismount'"));
  assert.ok(block.includes('this.isMultiplayerNetworkConnected()'));
});

test('613: server mob ride parsers reject bad identity/action and normalize input booleans', () => {
  assert.deepEqual(parseServerMobRideInteraction({ mobId: 9, action: 'mount' }), { mobId: 9, action: 'mount' });
  assert.equal(parseServerMobRideInteraction({ mobId: -1, action: 'mount' }), null);
  assert.equal(parseServerMobRideInteraction({ mobId: 9, action: 'teleport' }), null);
  assert.deepEqual(parseServerMobRideInput({ mobId: 9, forward: true, jump: 1 }), {
    mobId: 9, forward: true, back: false, left: false, right: false, jump: false,
  });
  assert.deepEqual(createIdleServerMobRideInput(4), {
    mobId: 4, forward: false, back: false, left: false, right: false, jump: false,
  });
});

test('614: server owns mob mount/dismount state and validates reach plus rideable type', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const start = source.indexOf('case PacketType.C2S_MOB_INTERACT');
  const end = source.indexOf('case PacketType.C2S_MOB_INPUT', start);
  const handler = source.slice(start, end);
  assert.ok(handler.includes('isEntityAttackInReach(session, mob.position, session.gameMode)'));
  assert.ok(handler.includes('canMountMob(mob.type'));
  assert.ok(handler.includes('session.ridingMobId = mob.id'));
  assert.ok(handler.includes('PacketType.S2C_MOB_RIDER'));
});

test('615: server Horse mount performs deterministic taming and synchronizes the result', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const start = source.indexOf('case PacketType.C2S_MOB_INTERACT');
  const end = source.indexOf('case PacketType.C2S_MOB_INPUT', start);
  const handler = source.slice(start, end);
  assert.ok(handler.includes('shouldTameEntity(this.seed, this.gameTick, mob.id, 0, 0.2)'));
  assert.ok(handler.includes('isTamed: mob.isTamed'));
  assert.ok(handler.includes('PacketType.S2C_MOB_STATE'));
});

test('616: server rider input is owner-validated and steering rechecks Saddle/control requirements', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const inputStart = source.indexOf('case PacketType.C2S_MOB_INPUT');
  const inputEnd = source.indexOf('case PacketType.C2S_INTERACT_ENTITY', inputStart);
  const inputHandler = source.slice(inputStart, inputEnd);
  assert.ok(inputHandler.includes('mob.riderId !== session.id'));
  assert.ok(inputHandler.includes('session.ridingMobId !== mob.id'));
  const tickStart = source.indexOf('// Rider input is applied after normal passive AI');
  const tickEnd = source.indexOf('// Creeper Explosion ticking', tickStart);
  const tick = source.slice(tickStart, tickEnd);
  assert.ok(tick.includes('canControlMountedMob('));
  assert.ok(tick.includes("mob.type === 'horse' && input.jump"));
});

test('617: server Saddle and Name Tag actions own consumption and broadcast canonical mob state', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const start = source.indexOf('private handleServerEntityItemUse');
  const end = source.indexOf('\n  private ', start + 'private handleServerEntityItemUse'.length);
  const handler = source.slice(start, end);
  assert.ok(handler.includes("itemName === 'name_tag'"));
  assert.ok(handler.includes("itemName === 'saddle'"));
  assert.ok(handler.includes('this.consumeServerHeldItem(session, held)'));
  assert.ok(handler.includes('customName'));
  assert.ok(handler.includes('isSaddled: true'));
});

test('618: NetworkClient applies Saddle, tame state and custom names from canonical mob state', () => {
  const source = readFileSync(new URL('../src/server/NetworkClient.ts', import.meta.url), 'utf8');
  assert.ok(source.includes('if (isTamed !== undefined) mob.isTamed = !!isTamed'));
  assert.ok(source.includes('if (isSaddled !== undefined) mob.isSaddled = !!isSaddled'));
  assert.ok(source.includes('mob.customName ='));
});

test('619: NetworkClient applies authoritative rider changes instead of inventing local rider state', () => {
  const source = readFileSync(new URL('../src/server/NetworkClient.ts', import.meta.url), 'utf8');
  assert.ok(source.includes('case PacketType.S2C_MOB_RIDER'));
  assert.ok(source.includes('this.game.applyServerMobRider(mobId, riderId ?? null)'));
  const game = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  assert.ok(game.includes('applyServerMobRider(mobId: number, riderId: string | null)'));
});

test('620: MobSystem save/restore round-trips Saddle and Name Tag state', () => {
  const system = new MobSystem(new THREE.Scene());
  system.doMobSpawning = false;
  const horse = system.spawnMob('horse', 0, 64, 0);
  assert.ok(horse);
  horse.isTamed = true;
  horse.isSaddled = true;
  horse.customName = 'Agro';
  const saved = system.serialize(0);
  const restored = new MobSystem(new THREE.Scene());
  restored.doMobSpawning = false;
  restored.restore(saved, 0);
  const next = Array.from(restored.mobs.values())[0];
  assert.equal(next.isSaddled, true);
  assert.equal(next.customName, 'Agro');
});

test('621: save recovery sanitizes custom mob names and preserves Saddle state explicitly', () => {
  const source = readFileSync(new URL('../src/systems/SaveSystem.ts', import.meta.url), 'utf8');
  assert.ok(source.includes('isSaddled: !!mob.isSaddled'));
  assert.ok(source.includes("mob.customName.trim().slice(0, 50)"));
});

test('622: core ridden-mob items use stable localized names and visible presentation hooks', () => {
  assert.equal(localizeItemDisplayName('zh-CN', 'name_tag', 'Name Tag'), '命名牌');
  assert.equal(localizeItemDisplayName('zh-CN', 'carrot_on_a_stick', 'Carrot on a Stick'), '胡萝卜钓竿');
  assert.equal(localizeItemDisplayName('zh-CN', 'armor_stand', 'Armor Stand'), '盔甲架');
  const source = readFileSync(new URL('../src/entities/Mob.ts', import.meta.url), 'utf8');
  assert.ok(source.includes("group.name = 'saddle'"));
  assert.ok(source.includes("sprite.name = 'custom_name'"));
});
