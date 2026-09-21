import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inferItemBehaviorId } from '../src/world/BehaviorIds';
import { isSpawnEggItemName, spawnEggMobTypeForItemName } from '../src/world/SpawnEggRules';
import { getThrowableProjectileType, isValidItemActionForHeldStack } from '../src/server/ItemActionRules';
import { isSupportedServerItemUseName } from '../src/server/ServerItemUseRules';
import { EXPERIENCE_BOTTLE_XP_RANGE, rollXp } from '../src/world/XpRules';

test('583: spawn eggs and experience bottles have explicit item behavior routing', () => {
  assert.equal(inferItemBehaviorId('zombie_spawn_egg'), 'minecraft:spawn_egg');
  assert.equal(inferItemBehaviorId('minecraft:cow_spawn_egg'), 'minecraft:spawn_egg');
  assert.equal(inferItemBehaviorId('experience_bottle'), 'minecraft:throwable');
});

test('584: spawn egg rules resolve implemented mobs without pretending unsupported mobs exist', () => {
  assert.equal(isSpawnEggItemName('minecraft:zombie_spawn_egg'), true);
  assert.equal(spawnEggMobTypeForItemName('zombie_spawn_egg'), 'zombie');
  assert.equal(spawnEggMobTypeForItemName('zombified_piglin_spawn_egg'), 'zombie_pigman');
  assert.equal(spawnEggMobTypeForItemName('allay_spawn_egg'), null);
});

test('585: spawn eggs are accepted by server item-use routing', () => {
  assert.equal(isSupportedServerItemUseName('zombie_spawn_egg', 'block'), true);
  assert.equal(isSupportedServerItemUseName('zombie_spawn_egg', 'entity'), false);
});

test('586: multiplayer spawn egg use sends server intent before local mob creation or inventory consumption', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const method = source.match(/private tryUseSpawnEgg[\s\S]*?\n  \}/)?.[0] ?? '';
  const send = method.indexOf('this.sendServerBlockItemUse(stack, target)');
  const spawn = method.indexOf('this.mobs.spawnMob');
  const consume = method.indexOf('this.inventory.removeFromSlot');
  assert.ok(send >= 0 && spawn > send && consume > send);
});

test('587: server spawn egg use resolves the egg to a supported mob and owns consumption', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const start = source.indexOf('const spawnEggMobType = spawnEggMobTypeForItemName(itemName)');
  const end = source.indexOf("if (itemName === 'bucket')", start);
  const handler = source.slice(start, end);
  assert.ok(handler.includes('this.spawnMob(spawnEggMobType'));
  assert.ok(handler.includes('this.consumeServerHeldItem(session, held)'));
  assert.ok(handler.includes('this.isSolidBlock('));
});

test('588: experience bottle is a validated server throwable only for the actual held stack', () => {
  assert.equal(getThrowableProjectileType(384), 'experience_bottle');
  const req = {
    action: 'throw' as const,
    itemId: 384,
    direction: { x: 0, y: 0, z: -1 },
  };
  assert.equal(isValidItemActionForHeldStack(req, { id: 384, count: 1 }), true);
  assert.equal(isValidItemActionForHeldStack(req, { id: 344, count: 1 }), false);
});

test('589: experience bottle XP follows the vanilla 3-11 inclusive range', () => {
  assert.deepEqual(EXPERIENCE_BOTTLE_XP_RANGE, { min: 3, max: 11 });
  assert.equal(rollXp(EXPERIENCE_BOTTLE_XP_RANGE, () => 0), 3);
  assert.equal(rollXp(EXPERIENCE_BOTTLE_XP_RANGE, () => 0.999), 11);
});

test('590: multiplayer experience bottle throw sends intent before local projectile or consumption', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const method = source.match(/private tryThrowHeldProjectile[\s\S]*?\n  \}/)?.[0] ?? '';
  const branch = method.slice(method.indexOf("name === 'experience_bottle'"), method.indexOf("if (heldItemId === FIREWORK_ROCKET_ID"));
  const send = branch.indexOf('this.sendItemAction');
  const spawn = branch.indexOf('this.projectiles.shootExperienceBottle');
  const consume = branch.indexOf('this.inventory.removeFromSlot');
  assert.ok(send >= 0 && spawn > send && consume > send);
});

test('591: server experience bottle impact awards authoritative XP and never projectile damage', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const start = source.indexOf('private resolveExperienceBottleImpact');
  const end = source.indexOf('private resolveEnderPearlImpact', start);
  const method = source.slice(start, end);
  assert.ok(method.includes('this.addServerXp(owner, rollXp(EXPERIENCE_BOTTLE_XP_RANGE, Math.random))'));
  assert.ok(method.includes('S2C_PROJECTILE_DESPAWN'));
  const actionStart = source.indexOf('case PacketType.C2S_ITEM_ACTION');
  const actionEnd = source.indexOf('case PacketType.C2S_FISHING_ACTION', actionStart);
  assert.ok(source.slice(actionStart, actionEnd).includes("type === 'experience_bottle' ? 0"));
});

test('592: projectile simulation renders, arcs, and resolves experience bottles through impact callbacks', () => {
  const source = readFileSync(new URL('../src/systems/ProjectileSystem.ts', import.meta.url), 'utf8');
  assert.ok(source.includes("type: 'experience_bottle'"));
  assert.ok(source.includes("this.createPotionMesh('#7fd34e')"));
  assert.ok(source.includes("proj.type === 'experience_bottle'"));
  assert.ok(source.includes("proj.type !== 'experience_bottle'"));
});
