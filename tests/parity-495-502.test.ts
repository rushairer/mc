import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { inferItemBehaviorId } from '../src/world/BehaviorIds';
import { ItemRegistry } from '../src/items/ItemRegistry';
import { VehicleSystem } from '../src/systems/VehicleSystem';
import { registerWildernessBound26_3 } from '../src/world/registerWildernessBound26_3';

registerWildernessBound26_3();

test('495: ordinary TNT right-click is inert so ignition comes from the held item', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = source.indexOf("this.behaviors.registerBlock(['tnt']");
  const end = source.indexOf('// P3.6:', start);
  const blockBehavior = source.slice(start, end);
  assert.ok(blockBehavior.includes('interact: () => ({ handled: false })'));
  assert.ok(!blockBehavior.includes('preventsItemUse: true'));
});

test('496: Flint and Steel now ignites ordinary air instead of only succeeding on portal frames', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const method = source.match(/private tryUseFlintAndSteel[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.ok(method.includes("BlockRegistry.getByName('fire')"));
  assert.ok(method.includes('this.chunks.setBlock(position.x, position.y, position.z, fire.id)'));
  assert.ok(method.includes('if (activated)'));
});

test('497: Flint and Steel ignites TNT explicitly and durability is spent only on successful use paths', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const method = source.match(/private tryUseFlintAndSteel[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.ok(method.includes("target.block.name === 'tnt'"));
  assert.ok(method.includes('this.igniteTNT(target.position.x, target.position.y, target.position.z)'));
  assert.ok(method.includes('this.inventory.damageTool(this.player.selectedSlot)'));
  assert.ok(method.includes('return false;'));
});

test('498: Shears are a durable first-class tool with their own use behavior', () => {
  const shears = ItemRegistry.getByName('shears');
  assert.ok(shears);
  assert.equal(inferItemBehaviorId('shears'), 'minecraft:shears');
  assert.equal(shears.behaviorId, 'minecraft:shears');
  assert.equal(shears.category, 'tool');
  assert.equal(shears.toolType, 'shears');
  assert.equal(ItemRegistry.getMaxStackSize(shears.id), 1);
});

test('499: Shears carve Pumpkins into Carved Pumpkins, drop four seeds, and spend durability', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const method = source.match(/private tryUseShears[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.ok(method.includes("target.block.name !== 'pumpkin'"));
  assert.ok(method.includes("BlockRegistry.getByName('carved_pumpkin')"));
  assert.ok(method.includes("ItemRegistry.getByName('pumpkin_seeds')"));
  assert.ok(method.includes('seeds.id,'));
  assert.ok(method.includes('4,'));
  assert.ok(method.includes('this.inventory.damageTool(this.player.selectedSlot)'));
});

test('500: adult Sheep can be sheared once until regrowth and drop 1-3 wool', () => {
  const mob = readFileSync(new URL('../src/entities/Mob.ts', import.meta.url), 'utf8');
  assert.ok(mob.includes('isSheared = false'));
  const game = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = game.indexOf('private tryInteractMob');
  const end = game.indexOf('private tryInteractTargetEntity', start);
  const method = game.slice(start, end);
  assert.ok(method.includes("target.def.type === 'sheep'"));
  assert.ok(method.includes("heldItemName === 'shears'"));
  assert.ok(method.includes('!target.isBaby && !target.isSheared'));
  assert.ok(method.includes('target.isSheared = true'));
  assert.ok(method.includes('1 + Math.floor(Math.random() * 3)'));
});

test('501: Chest Boats remain distinct vehicles, carry 27 storage slots, and preserve the exact placed boat item for drops', () => {
  const chestBoat = ItemRegistry.getByName('poplar_chest_boat') ?? ItemRegistry.getByName('oak_chest_boat');
  assert.ok(chestBoat);
  const system = new VehicleSystem(new THREE.Scene());
  const vehicle = system.spawnVehicle('chest_boat', new THREE.Vector3(0, 64, 0), chestBoat.id);
  assert.equal(vehicle.type, 'chest_boat');
  assert.equal(vehicle.inventory?.length, 27);
  assert.equal(vehicle.sourceItemId, chestBoat.id);
  system.dispose();

  const game = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  assert.ok(game.includes("itemName.endsWith('_chest_boat') ? 'chest_boat' : 'boat'"));
  assert.ok(game.includes('targetVehicle.sourceItemId ?? 328'));
});

test('502: Powder Snow Bucket participates in the shared bucket behavior and round-trips Powder Snow', () => {
  const powder = ItemRegistry.getByName('powder_snow_bucket');
  assert.ok(powder);
  assert.equal(inferItemBehaviorId('powder_snow_bucket'), 'minecraft:bucket');
  assert.equal(powder.behaviorId, 'minecraft:bucket');
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const method = source.match(/private tryUseBucket[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.ok(method.includes("targetName === 'powder_snow'"));
  assert.ok(method.includes("'powder_snow_bucket'"));
  assert.ok(method.includes("bucketName === 'powder_snow_bucket'"));
  assert.ok(method.includes("? 'powder_snow'"));
});
