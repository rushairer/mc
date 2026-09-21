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
