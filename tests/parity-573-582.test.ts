import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseItemAction, isValidItemActionForHeldStack } from '../src/server/ItemActionRules';
import { findEnderEyeTarget, shouldEnderEyeShatter } from '../src/server/EnderEyeRules';
import {
  getServerFishingWaitSeconds,
  parseServerFishingAction,
  rollServerFishingLoot,
  rollServerFishingXp,
  SERVER_FISHING_HOOKED_SECONDS,
} from '../src/server/ServerFishingRules';
import { PacketType } from '../src/server/NetworkProtocol';

test('573: Ender Eye locating throw is an explicit validated server item action', () => {
  const req = parseItemAction({ action: 'ender_eye_throw', itemId: 381, dirX: 1, dirY: 0, dirZ: 0 });
  assert.ok(req);
  assert.equal(req?.action, 'ender_eye_throw');
  assert.equal(isValidItemActionForHeldStack(req!, { id: 381, count: 1 }), true);
  assert.equal(isValidItemActionForHeldStack(req!, { id: 368, count: 1 }), false);
});

test('574: Ender Eye target selection is deterministic for seed and position', () => {
  assert.deepEqual(findEnderEyeTarget(12345, 0, 0), findEnderEyeTarget(12345, 0, 0));
  assert.notDeepEqual(findEnderEyeTarget(12345, 0, 0), findEnderEyeTarget(54321, 0, 0));
});

test('575: multiplayer Ender Eye sends intent before local projectile spawn or inventory consumption', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const method = source.match(/private throwEnderEye\(\)[\s\S]*?\n  \}/)?.[0] ?? '';
  const send = method.indexOf("action: 'ender_eye_throw'");
  const localSpawn = method.indexOf('this.projectiles.shootEnderEye');
  const localConsume = method.indexOf('this.inventory.removeFromSlot');
  assert.ok(send >= 0 && localSpawn > send && localConsume > send);
});

test('576: server Ender Eye is Overworld-only, server-spawned, and consumed only outside Creative', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const start = source.indexOf("request.action === 'ender_eye_throw'");
  const end = source.indexOf('const type = getThrowableProjectileType', start);
  const handler = source.slice(start, end);
  assert.ok(handler.includes('session.dimension !== 0'));
  assert.ok(handler.includes("this.spawnProjectile(session, 'eye_of_ender'"));
  assert.ok(handler.includes("session.gameMode !== 'creative'"));
});

test('577: server Eye lifecycle uses the Java 20-percent shatter rule and client can render the authoritative projectile', () => {
  let shattered = 0;
  for (let id = 1; id <= 100; id++) {
    if (shouldEnderEyeShatter(99, id, 100, 100)) shattered++;
  }
  assert.ok(shattered > 0 && shattered < 50);
  const projectile = readFileSync(new URL('../src/systems/ProjectileSystem.ts', import.meta.url), 'utf8');
  assert.ok(projectile.includes("type === 'eye_of_ender'"));
  assert.ok(projectile.includes('this.createEnderEyeMesh()'));
});

test('578: fishing has an explicit cast/reel protocol with normalized direction', () => {
  assert.equal(PacketType.C2S_FISHING_ACTION, 'C2S_FISHING_ACTION');
  assert.equal(PacketType.S2C_FISHING_STATE, 'S2C_FISHING_STATE');
  const cast = parseServerFishingAction({ action: 'cast', itemId: 346, dirX: 3, dirY: 0, dirZ: 4 });
  assert.ok(cast);
  assert.equal(Math.round((cast!.direction.x ** 2 + cast!.direction.z ** 2) * 1000) / 1000, 1);
  assert.equal(parseServerFishingAction({ action: 'hack', itemId: 346, dirX: 1, dirY: 0, dirZ: 0 }), null);
});

test('579: multiplayer Fishing Rod sends only cast/reel intent and leaves local bobber simulation disabled', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const use = source.match(/private tryUseFishingRod[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.ok(use.includes('PacketType.C2S_FISHING_ACTION'));
  assert.ok(use.includes("this.fishingBobber ? 'reel' : 'cast'"));
  const update = source.match(/private updateFishingBobber[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.ok(update.includes('this.isMultiplayerNetworkConnected()'));
});

test('580: server Fishing cast validates the actual Fishing Rod and creates bobber state without spending durability', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const start = source.indexOf('case PacketType.C2S_FISHING_ACTION');
  const end = source.indexOf('case PacketType.C2S_PLAYER_STATE', start);
  const handler = source.slice(start, end);
  assert.ok(handler.includes("heldName !== 'fishing_rod'"));
  assert.ok(handler.includes("phase: 'flying'"));
  const castStart = handler.indexOf("if (request.action === 'cast')");
  const reelStart = handler.indexOf('if (!existing) break', castStart);
  const castBranch = handler.slice(castStart, reelStart);
  assert.equal(castBranch.includes('this.damageServerHeldTool(session, held)'), false);
  assert.ok(handler.includes('this.sendFishingState(session, state)'));
});

test('581: server controls fishing water landing, 5-30 second wait, and two-second hooked window', () => {
  assert.equal(getServerFishingWaitSeconds(() => 0), 5);
  assert.ok(getServerFishingWaitSeconds(() => 0.999) < 30);
  assert.equal(SERVER_FISHING_HOOKED_SECONDS, 2);
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const start = source.indexOf('private tickServerFishing');
  const end = source.indexOf('private tickPrimedTnt', start);
  const tick = source.slice(start, end);
  assert.ok(tick.includes('BlockRegistry.isWater(block)'));
  assert.ok(tick.includes("state.phase = 'hooked'"));
});

test('582: successful server reel rolls weighted fish and XP, drops loot, syncs XP, then clears the bobber', () => {
  assert.equal(rollServerFishingLoot(() => 0), 349);
  assert.equal(rollServerFishingXp(() => 0), 1);
  assert.equal(rollServerFishingXp(() => 0.999), 6);
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const start = source.indexOf('case PacketType.C2S_FISHING_ACTION');
  const end = source.indexOf('case PacketType.C2S_PLAYER_STATE', start);
  const handler = source.slice(start, end);
  assert.ok(handler.includes("existing.phase === 'hooked'"));
  assert.ok(handler.includes('rollServerFishingLoot(Math.random)'));
  assert.ok(handler.includes('this.addServerXp(session, rollServerFishingXp(Math.random))'));
  assert.ok(handler.includes('this.damageServerHeldTool(session, held)'));
  assert.ok(handler.includes("existing.phase === 'waiting' && !Number.isFinite(existing.waitSeconds)"));
  assert.ok(handler.includes('this.fishingStates.delete(session.id)'));
  assert.ok(handler.includes('this.sendFishingState(session, null)'));
});
