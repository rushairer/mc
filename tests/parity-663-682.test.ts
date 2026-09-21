import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inferItemBehaviorId } from '../src/world/BehaviorIds';
import { localizeItemDisplayName } from '../src/i18nItemNames';
import { cloneItemStack } from '../src/items/ItemStackRules';
import {
  GOAT_HORN_COOLDOWN_SECONDS,
  GOAT_HORN_INSTRUMENTS,
  SPYGLASS_ZOOM_MULTIPLIER,
  goatHornSoundIndex,
  normalizeGoatHornInstrument,
  spyglassFov,
} from '../src/items/SpecialItemUseRules';

test('663: Spyglass and Goat Horn have dedicated item behaviors and canonical localized names', () => {
  assert.equal(inferItemBehaviorId('spyglass'), 'minecraft:spyglass');
  assert.equal(inferItemBehaviorId('goat_horn'), 'minecraft:goat_horn');
  assert.equal(localizeItemDisplayName('zh-CN', 'spyglass', 'Spyglass'), '望远镜');
  assert.equal(localizeItemDisplayName('zh-CN', 'goat_horn', 'Goat Horn'), '山羊角');
  assert.equal(localizeItemDisplayName('zh-TW', 'spyglass', 'Spyglass'), '望遠鏡');
});

test('664: Spyglass applies Java-style one-tenth FOV zoom and restores the original FOV', () => {
  assert.equal(SPYGLASS_ZOOM_MULTIPLIER, 0.1);
  assert.equal(spyglassFov(70, true), 7);
  assert.equal(spyglassFov(70, false), 70);
  assert.equal(spyglassFov(Number.NaN, true), 7);
});

test('665: Spyglass is wired into continuous-use lifecycle rather than one-shot placement', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = source.indexOf("this.behaviors.registerItem('spyglass'");
  const end = source.indexOf("this.behaviors.registerItem('goat_horn'", start);
  const branch = source.slice(start, end);
  assert.ok(branch.includes("id: 'minecraft:spyglass'"));
  assert.ok(branch.includes('startUse:'));
  assert.ok(branch.includes('continueUse:'));
  assert.ok(branch.includes('stopUse:'));
  assert.ok(branch.includes('this.setSpyglassActive(true)'));
  assert.ok(branch.includes('this.setSpyglassActive(false)'));
});

test('666: cancelling, releasing, blocking, or switching continuous use flows through stopItemUse', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  assert.ok(source.includes("this.stopActiveItemUse('cancelled')"));
  assert.ok(source.includes("? 'released'"));
  assert.ok(source.includes("? 'blocked'"));
  assert.ok(source.includes(": 'switched'"));
  assert.ok(source.includes('this.behaviors.stopItemUse(context'));
});

test('667: Spyglass toggles camera projection and restores 70 degree baseline', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = source.indexOf('private setSpyglassActive');
  const end = source.indexOf('private stopActiveItemUse', start);
  const method = source.slice(start, end);
  assert.ok(method.includes('spyglassFov(70, active)'));
  assert.ok(method.includes('this.renderer.camera.fov = nextFov'));
  assert.ok(method.includes('this.renderer.camera.updateProjectionMatrix()'));
});

test('668: canonical item visuals include recognizable Spyglass and Goat Horn geometry', () => {
  const source = readFileSync(new URL('../src/player/Player.ts', import.meta.url), 'utf8');
  assert.ok(source.includes("name === 'spyglass'"));
  assert.ok(source.includes("body.name = 'spyglass_body'"));
  assert.ok(source.includes("lens.name = 'spyglass_lens'"));
  assert.ok(source.includes("name === 'goat_horn'"));
  assert.ok(source.includes("curve.name = 'goat_horn_curve'"));
});

test('669: Goat Horn exposes all eight canonical instrument variants in stable order', () => {
  assert.deepEqual([...GOAT_HORN_INSTRUMENTS], [
    'ponder', 'sing', 'seek', 'feel', 'admire', 'call', 'yearn', 'dream',
  ]);
  assert.equal(normalizeGoatHornInstrument('dream'), 'dream');
  assert.equal(normalizeGoatHornInstrument('unknown'), 'ponder');
  assert.equal(goatHornSoundIndex('ponder'), 0);
  assert.equal(goatHornSoundIndex('dream'), 7);
});

test('670: Goat Horn uses a dedicated seven-second cooldown rather than global placement cooldown', () => {
  assert.equal(GOAT_HORN_COOLDOWN_SECONDS, 7);
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  assert.ok(source.includes('private goatHornCooldown = 0'));
  assert.ok(source.includes('this.goatHornCooldown = Math.max(0, this.goatHornCooldown - dt)'));
  assert.ok(source.includes('this.goatHornCooldown = GOAT_HORN_COOLDOWN_SECONDS'));
});

test('671: Goat Horn sound prefers canonical resource events and has a no-pack fallback', () => {
  const source = readFileSync(new URL('../src/systems/SoundSystem.ts', import.meta.url), 'utf8');
  const start = source.indexOf('playGoatHorn(');
  const end = source.indexOf('playXP()', start);
  const method = source.slice(start, end);
  assert.ok(method.includes('item.goat_horn.sound.'));
  assert.ok(method.includes('item.goat_horn.play'));
  assert.ok(method.includes("this.synthToneCall(ctx, 'sawtooth'"));
});

test('672: Goat Horn instrument component survives canonical ItemStack cloning', () => {
  const cloned = cloneItemStack({ id: 20110, count: 1, goatHornInstrument: 'yearn' });
  assert.equal(cloned?.goatHornInstrument, 'yearn');
});


test('673: Wind Charge has a dedicated behavior and canonical Chinese item name', () => {
  assert.equal(inferItemBehaviorId('wind_charge'), 'minecraft:wind_charge');
  assert.equal(localizeItemDisplayName('zh-CN', 'wind_charge', 'Wind Charge'), '风弹');
  assert.equal(localizeItemDisplayName('zh-TW', 'wind_charge', 'Wind Charge'), '風彈');
});

test('674: Wind Charge rules match the player-thrown Java gameplay contract', async () => {
  const rules = await import('../src/items/WindChargeRules');
  assert.equal(rules.WIND_CHARGE_COOLDOWN_SECONDS, 0.5);
  assert.equal(rules.WIND_CHARGE_SPEED, 30);
  assert.equal(rules.WIND_CHARGE_DIRECT_DAMAGE, 1);
  assert.equal(rules.WIND_CHARGE_BURST_RADIUS, 2.4);
});

test('675: Wind Charge projectile is gravity-free and has a dedicated visual', () => {
  const source = readFileSync(new URL('../src/systems/ProjectileSystem.ts', import.meta.url), 'utf8');
  assert.ok(source.includes("'wind_charge'"));
  assert.ok(source.includes('shootWindCharge('));
  const gravityBranch = source.match(/if \(proj\.type === 'arrow'[\s\S]*?\) \{\n\s*proj\.velocity\.y \+= ARROW_GRAVITY \* dt;/)?.[0] ?? '';
  assert.equal(gravityBranch.includes("wind_charge"), false);
  assert.ok(source.includes("core.name = 'wind_charge_core'"));
});

test('676: Wind Charge uses an item-scoped half-second cooldown on the client', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  assert.ok(source.includes('private windChargeCooldown = 0'));
  assert.ok(source.includes('this.windChargeCooldown = WIND_CHARGE_COOLDOWN_SECONDS'));
  assert.ok(source.includes("this.behaviors.registerItem('wind_charge'"));
  assert.ok(source.includes('cooldown: 0.05'));
});

test('677: Wind Charge is a server-authorized throwable and consumes only after accepted use', async () => {
  const rules = await import('../src/server/ItemActionRules');
  const item = (await import('../src/items/ItemRegistry')).ItemRegistry.getByName('wind_charge');
  assert.ok(item);
  assert.equal(rules.getThrowableProjectileType(item!.id), 'wind_charge');
  assert.equal(rules.isValidItemActionForHeldStack({
    action: 'throw',
    itemId: item!.id,
    direction: { x: 0, y: 0, z: -1 },
  }, { id: item!.id, count: 1 }), true);
});

test('678: multiplayer server independently enforces Wind Charge cooldown and no-gravity flight', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  assert.ok(source.includes('windChargeCooldownSeconds: number'));
  assert.ok(source.includes('session.windChargeCooldownSeconds = WIND_CHARGE_COOLDOWN_SECONDS'));
  assert.ok(source.includes("proj.type !== 'wind_charge'"));
  assert.ok(source.includes('WIND_CHARGE_SPEED'));
});

test('679: Wind Charge burst affects both players and mobs without block destruction', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const start = source.indexOf('private resolveWindChargeBurst');
  const end = source.indexOf('private tickProjectiles', start);
  const method = source.slice(start, end);
  assert.ok(method.includes('S2C_PLAYER_VELOCITY'));
  assert.ok(method.includes('mob.velocity.add'));
  assert.equal(method.includes('setBlock('), false);
});

test('680: local Wind Charge burst can propel its owner and nearby mobs', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = source.indexOf('private applyWindChargeBurst');
  const end = source.indexOf('private handleFireworkExplosion', start);
  const method = source.slice(start, end);
  assert.ok(method.includes('this.player.velocity.add'));
  assert.ok(method.includes('mob.velocity.add'));
});

test('681: Wind Charge throw/burst prefer canonical sound events', () => {
  const source = readFileSync(new URL('../src/systems/SoundSystem.ts', import.meta.url), 'utf8');
  assert.ok(source.includes("'entity.wind_charge.throw'"));
  assert.ok(source.includes("'entity.generic.wind_burst'"));
  const network = readFileSync(new URL('../src/server/NetworkClient.ts', import.meta.url), 'utf8');
  assert.ok(network.includes("'wind_charge_throw'"));
  assert.ok(network.includes("'wind_burst'"));
});

test('682: Wind Charge has a recognizable held/inventory visual instead of the generic material tile', () => {
  const source = readFileSync(new URL('../src/player/Player.ts', import.meta.url), 'utf8');
  assert.ok(source.includes("name === 'wind_charge'"));
  assert.ok(source.includes("core.name = 'wind_charge_item_core'"));
  assert.ok(source.includes("ring.name = 'wind_charge_item_ring'"));
});
