import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { applyShelfMushroomBounce26_3 } from '../src/world/WildernessBoundGameplay26_3';
import {
  CUSHION_SOUNDS_26_3,
  POPLAR_LEAVES_SOUNDS_26_3,
  RED_SHRUB_SOUNDS_26_3,
  SHELF_MUSHROOM_SOUNDS_26_3,
  STRAW_BED_SOUNDS_26_3,
  fallingLeafParticle26_3,
  levelUpVillagerTrades26_3,
  shouldPrioritizeShieldUse26_3,
  shouldRunRandomMovement26_3,
} from '../src/world/WildernessBoundChanges26_3';
import { RANDOM_MOVEMENT_PLAYER_RANGE_26_3 } from '../src/systems/MobSystem';

test('239: random movement only runs while a player is nearby', () => {
  assert.equal(shouldRunRandomMovement26_3(true), true);
  assert.equal(shouldRunRandomMovement26_3(false), false);
});

test('240: live MobSystem passes a bounded player-nearby activation signal into Mob AI', () => {
  assert.equal(RANDOM_MOVEMENT_PLAYER_RANGE_26_3, 32);
  const mobSource = readFileSync('src/entities/Mob.ts', 'utf8');
  const systemSource = readFileSync('src/systems/MobSystem.ts', 'utf8');
  assert.match(mobSource, /shouldRunRandomMovement26_3\(randomMovementPlayerNearby\)/);
  assert.match(systemSource, /RANDOM_MOVEMENT_PLAYER_RANGE_26_3/);
});

test('241: offhand shield takes priority over a main-hand hoe', () => {
  assert.equal(shouldPrioritizeShieldUse26_3('diamond_hoe', 'shield'), true);
  assert.equal(shouldPrioritizeShieldUse26_3('shield', 'diamond_hoe'), true);
});

test('242: offhand shield takes priority over a main-hand shovel', () => {
  assert.equal(shouldPrioritizeShieldUse26_3('netherite_shovel', 'shield'), true);
  assert.equal(shouldPrioritizeShieldUse26_3('shield', 'netherite_shovel'), true);
});

test('243: shield priority does not swallow unrelated item use', () => {
  assert.equal(shouldPrioritizeShieldUse26_3('diamond_sword', 'shield'), false);
  assert.equal(shouldPrioritizeShieldUse26_3('diamond_hoe', 'totem_of_undying'), false);
});

test('244: Spruce Leaves no longer emit falling leaf particles in 26.3', () => {
  assert.equal(fallingLeafParticle26_3('spruce_leaves'), null);
});

test('245: all three Poplar leaf colors expose distinct falling leaf particles', () => {
  assert.equal(fallingLeafParticle26_3('red_poplar_leaves'), 'minecraft:red_poplar_leaves');
  assert.equal(fallingLeafParticle26_3('orange_poplar_leaves'), 'minecraft:orange_poplar_leaves');
  assert.equal(fallingLeafParticle26_3('yellow_poplar_leaves'), 'minecraft:yellow_poplar_leaves');
});

test('246: Poplar Leaves sound family contains ambient, fall and hit events', () => {
  assert.ok(POPLAR_LEAVES_SOUNDS_26_3.includes('block.poplar_leaves.ambient'));
  assert.ok(POPLAR_LEAVES_SOUNDS_26_3.includes('block.poplar_leaves.fall'));
  assert.ok(POPLAR_LEAVES_SOUNDS_26_3.includes('block.poplar_leaves.hit'));
});

test('247: Shelf Mushroom bounce uses the dedicated 26.3 bounce sound', () => {
  assert.ok(SHELF_MUSHROOM_SOUNDS_26_3.includes('block.shelf_mushroom.bounce'));
  assert.equal(applyShelfMushroomBounce26_3(-8, false).soundEvent, 'block.shelf_mushroom.bounce');
});

test('248: Straw Bed and Red Shrub expose their dedicated 26.3 sound sets', () => {
  assert.ok(STRAW_BED_SOUNDS_26_3.includes('block.straw_bed.break_leave'));
  assert.ok(RED_SHRUB_SOUNDS_26_3.includes('block.red_shrub.place'));
});

test('249: Cushion interaction sounds include sit and get-up lifecycle events', () => {
  assert.ok(CUSHION_SOUNDS_26_3.includes('entity.cushion.sit'));
  assert.ok(CUSHION_SOUNDS_26_3.includes('entity.cushion.get_up'));
});

test('250: villager level-up offers request a live open-screen refresh exactly once per level advance', () => {
  const initial = { level: 2, revision: 7 };
  const advanced = levelUpVillagerTrades26_3(initial, 3);
  assert.deepEqual(advanced.state, { level: 3, revision: 8 });
  assert.equal(advanced.refreshOpenTradingUi, true);
  const unchanged = levelUpVillagerTrades26_3(advanced.state, 3);
  assert.deepEqual(unchanged.state, { level: 3, revision: 8 });
  assert.equal(unchanged.refreshOpenTradingUi, false);
});
