import assert from 'node:assert/strict';
import test from 'node:test';
import { ItemRegistry } from '../src/items/ItemRegistry';
import { BlockRegistry } from '../src/world/BlockRegistry';
import { inferBlockBehaviorId, inferItemBehaviorId } from '../src/world/BehaviorIds';

test('infers stable behavior ids for interactive block families', () => {
  assert.equal(inferBlockBehaviorId('minecraft:blast_furnace'), 'minecraft:furnace');
  assert.equal(inferBlockBehaviorId('chipped_anvil'), 'minecraft:anvil');
  assert.equal(inferBlockBehaviorId('red_bed'), 'minecraft:bed');
  assert.equal(inferBlockBehaviorId('bedrock'), undefined);
  assert.equal(inferBlockBehaviorId('oak_door'), 'minecraft:door');
  assert.equal(inferBlockBehaviorId('iron_door'), undefined);
  assert.equal(inferBlockBehaviorId('oak_trapdoor'), 'minecraft:trapdoor');
  assert.equal(inferBlockBehaviorId('iron_trapdoor'), undefined);
});

test('infers stable behavior ids for readable and active-use items', () => {
  assert.equal(inferItemBehaviorId('minecraft:filled_map'), 'minecraft:readable');
  assert.equal(inferItemBehaviorId('bow'), 'minecraft:bow');
  assert.equal(inferItemBehaviorId('crossbow'), 'minecraft:crossbow');
  assert.equal(inferItemBehaviorId('shield'), 'minecraft:shield');
  assert.equal(inferItemBehaviorId('potion'), 'minecraft:potion');
  assert.equal(inferItemBehaviorId('water_bucket'), 'minecraft:bucket');
  assert.equal(inferItemBehaviorId('oak_boat'), 'minecraft:boat');
  assert.equal(inferItemBehaviorId('chest_minecart'), 'minecraft:minecart');
  assert.equal(inferItemBehaviorId('diamond_hoe'), 'minecraft:hoe');
  assert.equal(inferItemBehaviorId('fishing_rod'), 'minecraft:fishing_rod');
  assert.equal(inferItemBehaviorId('ender_pearl'), 'minecraft:throwable');
  assert.equal(inferItemBehaviorId('ender_eye'), 'minecraft:ender_eye');
  assert.equal(inferItemBehaviorId('stone'), undefined);
});

test('vanilla registry definitions expose inferred behavior references', () => {
  assert.equal(BlockRegistry.getByName('smoker')?.behaviorId, 'minecraft:furnace');
  assert.equal(BlockRegistry.getByName('barrel')?.behaviorId, 'minecraft:storage');
  assert.equal(BlockRegistry.getByName('iron_door')?.behaviorId, undefined);
  assert.equal(ItemRegistry.getByName('filled_map')?.behaviorId, 'minecraft:readable');
  assert.equal(ItemRegistry.getByName('trident')?.behaviorId, 'minecraft:throwable');
  assert.equal(ItemRegistry.getByName('crossbow')?.behaviorId, 'minecraft:crossbow');
  assert.equal(ItemRegistry.getByName('bread')?.behaviorId, 'minecraft:food');
});
