import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getBlockSoundMaterial,
  getMobIdleInterval,
  getMobSoundFamily,
  shouldMobIdle,
} from '../src/systems/SoundRules';

// ─── Block material classification (P4.3) ───

test('blocks classify into the right sound material', () => {
  assert.equal(getBlockSoundMaterial('stone'), 'stone');
  assert.equal(getBlockSoundMaterial('diamond_ore'), 'stone');
  assert.equal(getBlockSoundMaterial('oak_planks'), 'wood');
  assert.equal(getBlockSoundMaterial('oak_log'), 'wood');
  assert.equal(getBlockSoundMaterial('chest'), 'wood');
  assert.equal(getBlockSoundMaterial('dirt'), 'grass');
  assert.equal(getBlockSoundMaterial('grass'), 'grass');
  assert.equal(getBlockSoundMaterial('sand'), 'sand');
  assert.equal(getBlockSoundMaterial('gravel'), 'sand');
  assert.equal(getBlockSoundMaterial('iron_block'), 'metal');
  assert.equal(getBlockSoundMaterial('anvil'), 'metal');
  assert.equal(getBlockSoundMaterial('glass'), 'glass');
  assert.equal(getBlockSoundMaterial('water'), 'generic');
});

// ─── Mob sound families (P4.3) ───

test('mobs classify into sound families', () => {
  assert.equal(getMobSoundFamily('zombie'), 'zombie');
  assert.equal(getMobSoundFamily('wither_skeleton'), 'zombie');
  assert.equal(getMobSoundFamily('cow'), 'animal');
  assert.equal(getMobSoundFamily('wolf'), 'animal');
  assert.equal(getMobSoundFamily('enderman'), 'ender');
  assert.equal(getMobSoundFamily('wither'), 'boss');
  assert.equal(getMobSoundFamily('creeper'), 'creeper');
  assert.equal(getMobSoundFamily('iron_golem'), 'golem');
});

test('idle sounds only play for audible families', () => {
  assert.equal(shouldMobIdle('animal'), true);
  assert.equal(shouldMobIdle('villager'), true);
  assert.equal(shouldMobIdle('zombie'), true);
  assert.equal(shouldMobIdle('creeper'), true);
  assert.equal(shouldMobIdle('boss'), false);
  assert.equal(shouldMobIdle('golem'), false);
});

test('idle intervals stay sparse (5-15s)', () => {
  for (let i = 0; i < 20; i++) {
    const interval = getMobIdleInterval(() => Math.random());
    assert.ok(interval >= 5 && interval <= 15, `interval ${interval}`);
  }
});
