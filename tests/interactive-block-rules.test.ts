import assert from 'node:assert/strict';
import test from 'node:test';
import { inferBlockBehaviorId } from '../src/world/BehaviorIds';
import { getButtonPressTicks, isButtonName, isFenceGateName } from '../src/world/ButtonRules';
import { RedstoneSystem } from '../src/systems/RedstoneSystem';
import { BlockRegistry } from '../src/world/BlockRegistry';

// ─── Button rules (P3.1) ───

test('buttons follow Java 1.20.1 press durations', () => {
  assert.equal(getButtonPressTicks('oak_button'), 10, 'wooden buttons 0.5s');
  assert.equal(getButtonPressTicks('warped_button'), 10);
  assert.equal(getButtonPressTicks('stone_button'), 30, 'stone buttons 1.5s');
  assert.equal(getButtonPressTicks('polished_blackstone_button'), 30);
});

test('button and fence gate name predicates', () => {
  assert.equal(isButtonName('stone_button'), true);
  assert.equal(isButtonName('oak_fence_gate'), false);
  assert.equal(isFenceGateName('oak_fence_gate'), true);
  assert.equal(isFenceGateName('fence_gate'), true);
  assert.equal(isFenceGateName('stone_button'), false);
});

// ─── Behavior inference (P3.1) ───

test('behavior ids route buttons, fence gates and iron doors', () => {
  assert.equal(inferBlockBehaviorId('stone_button'), 'minecraft:button');
  assert.equal(inferBlockBehaviorId('oak_button'), 'minecraft:button');
  assert.equal(inferBlockBehaviorId('polished_blackstone_button'), 'minecraft:button');
  assert.equal(inferBlockBehaviorId('oak_fence_gate'), 'minecraft:fence_gate');
  assert.equal(inferBlockBehaviorId('fence_gate'), 'minecraft:fence_gate');
  assert.equal(inferBlockBehaviorId('iron_door'), 'minecraft:iron_door');
  assert.equal(inferBlockBehaviorId('oak_door'), 'minecraft:door');
  assert.equal(inferBlockBehaviorId('oak_trapdoor'), 'minecraft:trapdoor');
});

test('registered button and fence gate blocks resolve behavior ids', () => {
  const stoneButton = BlockRegistry.getByName('stone_button');
  const oakGate = BlockRegistry.getByName('oak_fence_gate') ?? BlockRegistry.getByName('fence_gate');
  const ironDoor = BlockRegistry.getByName('iron_door');
  assert.ok(stoneButton && oakGate && ironDoor);
  assert.equal(stoneButton.behaviorId, 'minecraft:button');
  assert.equal(oakGate.behaviorId, 'minecraft:fence_gate');
  assert.equal(ironDoor.behaviorId, 'minecraft:iron_door');
});

// ─── Redstone position power (P3.1) ───

test('isPositionPowered detects adjacent emitting components', () => {
  const redstone = new RedstoneSystem();
  redstone.register(1, 64, 1, 'lever', 'north', { signal: 15, state: true });
  redstone.register(10, 64, 10, 'button', 'north', { signal: 0, state: false });

  assert.equal(redstone.isPositionPowered(1, 64, 1), true, 'self powered');
  assert.equal(redstone.isPositionPowered(2, 64, 1), true, 'x+ neighbor powered');
  assert.equal(redstone.isPositionPowered(1, 64, 2), true, 'z+ neighbor powered');
  assert.equal(redstone.isPositionPowered(1, 65, 1), true, 'y+ neighbor powered');
  assert.equal(redstone.isPositionPowered(10, 64, 10), false, 'unpowered button not powered');
  assert.equal(redstone.isPositionPowered(99, 99, 99), false, 'empty area not powered');
});
