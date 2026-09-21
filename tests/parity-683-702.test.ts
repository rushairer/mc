import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ItemRegistry } from '../src/items/ItemRegistry';
import { getAttackCooldownSeconds, getAttackSpeed } from '../src/items/CombatAttributes';
import { getMeleeDurabilityCost } from '../src/systems/DurabilityRules';
import { localizeItemDisplayName } from '../src/i18nItemNames';
import {
  MACE_ATTACK_SPEED,
  MACE_DURABILITY,
  MACE_HEAVY_SMASH_THRESHOLD,
  MACE_SMASH_FALL_THRESHOLD,
  MACE_SMASH_KNOCKBACK_POWER,
  MACE_SMASH_KNOCKBACK_RADIUS,
  getMaceSmashBonus,
  getMaceSmashImpulse,
  getMaceSmashKnockbackStrength,
  isMaceSmash,
} from '../src/items/MaceRules';

test('683: Mace registry identity is a one-stack durable melee tool', () => {
  const mace = ItemRegistry.getByName('mace');
  assert.ok(mace);
  assert.equal(mace!.toolType, 'mace');
  assert.equal(mace!.category, 'tool');
  assert.equal(ItemRegistry.getMaxStackSize(mace!.id), 1);
});

test('684: Mace uses 500 durability', () => {
  const mace = ItemRegistry.getByName('mace');
  assert.ok(mace);
  assert.equal(MACE_DURABILITY, 500);
  assert.equal(mace!.durability, 500);
});

test('685: Mace uses the Java 0.6 attack speed and corresponding cooldown', () => {
  assert.equal(MACE_ATTACK_SPEED, 0.6);
  assert.equal(getAttackSpeed('mace'), 0.6);
  assert.ok(Math.abs(getAttackCooldownSeconds('mace') - (1 / 0.6)) < 1e-12);
});

test('686: Mace total held attack damage remains six in the project combat model', () => {
  const mace = ItemRegistry.getByName('mace');
  assert.ok(mace);
  assert.equal(mace!.damage, 6);
});

test('687: smash attacks require falling more than 1.5 blocks', () => {
  assert.equal(MACE_SMASH_FALL_THRESHOLD, 1.5);
  assert.equal(isMaceSmash(1.5), false);
  assert.equal(isMaceSmash(1.5001), true);
});

test('688: smash bonus follows the 4/2/1 segmented fall-distance curve', () => {
  assert.equal(getMaceSmashBonus(1.5), 0);
  assert.equal(getMaceSmashBonus(2), 8);
  assert.equal(getMaceSmashBonus(3), 12);
  assert.equal(getMaceSmashBonus(4), 14);
  assert.equal(getMaceSmashBonus(8), 22);
  assert.equal(getMaceSmashBonus(10), 24);
});

test('689: smash knockback uses the 3.5-block radius and heavy threshold', () => {
  assert.equal(MACE_SMASH_KNOCKBACK_RADIUS, 3.5);
  assert.equal(MACE_HEAVY_SMASH_THRESHOLD, 5);
  assert.equal(MACE_SMASH_KNOCKBACK_POWER, 0.7);
  assert.equal(getMaceSmashKnockbackStrength(4), 0.7);
  assert.equal(getMaceSmashKnockbackStrength(6), 1.4);
});

test('690: smash impulse excludes targets outside the radius', () => {
  const near = getMaceSmashImpulse({ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, 4);
  assert.ok(near.x > 0);
  assert.ok(near.y > 0);
  const far = getMaceSmashImpulse({ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }, 4);
  assert.deepEqual(far, { x: 0, y: 0, z: 0 });
});

test('691: successful Mace melee costs one durability point', () => {
  assert.equal(getMeleeDurabilityCost('mace'), 1);
});

test('692: Mace has explicit Simplified and Traditional Chinese names', () => {
  assert.equal(localizeItemDisplayName('zh-CN', 'mace', 'Mace'), '重锤');
  assert.equal(localizeItemDisplayName('zh-TW', 'mace', 'Mace'), '重錘');
});

test('693: held Mace uses recognizable shaft/head/cap geometry', () => {
  const source = readFileSync(new URL('../src/player/Player.ts', import.meta.url), 'utf8');
  assert.ok(source.includes("name === 'mace'"));
  assert.ok(source.includes("shaft.name = 'mace_shaft'"));
  assert.ok(source.includes("head.name = 'mace_head'"));
  assert.ok(source.includes("cap.name = 'mace_cap'"));
});

test('694: Mace smash sounds prefer canonical ground and heavy resource events', () => {
  const source = readFileSync(new URL('../src/systems/SoundSystem.ts', import.meta.url), 'utf8');
  const start = source.indexOf('playMaceSmash(');
  const end = source.indexOf('playWindChargeThrow()', start);
  const method = source.slice(start, end);
  assert.ok(method.includes("'item.mace.smash_ground_heavy'"));
  assert.ok(method.includes("'item.mace.smash_ground'"));
});

test('695: local gameplay tracks downward distance instead of ordinary grounded movement', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = source.indexOf('private updateMaceFallTracking');
  const end = source.indexOf('private applyLocalMaceSmash', start);
  const method = source.slice(start, end);
  assert.ok(method.includes('this.player.velocity.y < 0'));
  assert.ok(method.includes('this.maceFallStartY - this.player.position.y'));
  assert.ok(method.includes('this.player.onGround'));
});

test('696: local Mace damage adds smash bonus and suppresses normal critical multiplication', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  assert.ok(source.includes('const maceSmashActive = isHoldingMace && isMaceSmash(this.maceFallDistance)'));
  assert.ok(source.includes('critical: maceSmashActive ? false : isCriticalMelee'));
  assert.ok(source.includes('getMaceSmashBonus(this.maceFallDistance)'));
});

test('697: successful local smash cancels accumulated fall and vertical motion', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = source.indexOf('private applyLocalMaceSmash');
  const end = source.indexOf('private applyWindChargeBurst', start);
  const method = source.slice(start, end);
  assert.ok(method.includes('this.player.velocity.y = 0'));
  assert.ok(method.includes('this.survival.resetFall()'));
  assert.ok(method.includes('this.maceFallDistance = 0'));
});

test('698: local smash knocks nearby mobs but excludes the directly struck mob', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = source.indexOf('private applyLocalMaceSmash');
  const end = source.indexOf('private applyWindChargeBurst', start);
  const method = source.slice(start, end);
  assert.ok(method.includes('mob.id === struckMobId'));
  assert.ok(method.includes('getMaceSmashImpulse'));
  assert.ok(method.includes('mob.velocity.add'));
});

test('699: multiplayer server tracks authoritative fall distance from accepted movement', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  assert.ok(source.includes('maceFallStartY: number | null'));
  assert.ok(source.includes('maceFallDistance: number'));
  assert.ok(source.includes('session.maceFallStartY - intent.y'));
  assert.ok(source.includes('session.maceFallDistance = Math.max'));
});

test('700: multiplayer server owns Mace smash damage and fall reset', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  assert.ok(source.includes('getMaceSmashBonus(maceSmashDistance)'));
  const start = source.indexOf('private resolveServerMaceSmash');
  const end = source.indexOf('private resolveWindChargeBurst', start);
  const method = source.slice(start, end);
  assert.ok(method.includes('attacker.maceFallDistance = 0'));
  assert.ok(method.includes('PacketType.S2C_PLAYER_VELOCITY'));
});

test('701: multiplayer smash knockback synchronizes nearby players, mobs, and sounds', () => {
  const server = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const start = server.indexOf('private resolveServerMaceSmash');
  const end = server.indexOf('private resolveWindChargeBurst', start);
  const method = server.slice(start, end);
  assert.ok(method.includes('getMaceSmashImpulse'));
  assert.ok(method.includes('mob.velocity.add'));
  assert.ok(method.includes("'mace_smash_heavy'"));
  const client = readFileSync(new URL('../src/server/NetworkClient.ts', import.meta.url), 'utf8');
  assert.ok(client.includes("'mace_smash'"));
  assert.ok(client.includes("'mace_smash_heavy'"));
});

test('702: local and server hit paths both spend Mace durability only on accepted hits', () => {
  const client = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const hit = client.indexOf('if (mobHit.hit)');
  const damage = client.indexOf('this.inventory.damageTool(this.player.selectedSlot, 1)', hit);
  assert.ok(hit >= 0 && damage > hit);
  const server = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const handler = server.slice(
    server.indexOf('case PacketType.C2S_INTERACT_ENTITY'),
    server.indexOf('case PacketType.C2S_ITEM_USE'),
  );
  assert.ok(handler.includes('this.damageHeldMeleeItem(session, profile.durabilityCost)'));
});
