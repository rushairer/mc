import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BlockRegistry } from '../src/world/BlockRegistry';
import { ItemRegistry } from '../src/items/ItemRegistry';
import { inferBlockBehaviorId } from '../src/world/BehaviorIds';
import { canPlaceChestFromNeighborDegrees } from '../src/world/ContainerRules';
import { canAcceptFurnaceOutput, getWetSpongeFuelRemainder } from '../src/world/FurnaceRules';
import { canHandToggleOpenable, resolveFenceGateManualToggle } from '../src/world/OpenableRules';
import { getBedHeadPosition, isMonsterWithinBedSleepRange, resolveBedUse } from '../src/world/BedRules';
import { applySignInteraction, setSignTextForSide } from '../src/world/SignRules';
import { findSmeltingResult, getFuelBurnTime, isSmeltingFuel } from '../src/items/SmeltingRecipes';
import { getHopperInsertionSlots } from '../src/systems/HopperSystem';
import { registerWildernessBound26_3 } from '../src/world/registerWildernessBound26_3';

registerWildernessBound26_3();
const gameSource = () => readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
const item = (name: string) => {
  const def = ItemRegistry.getByName(name);
  assert.ok(def, name);
  return def;
};

test('371: iron trapdoor is a redstone-only behavior instead of falling through item use', () => {
  assert.equal(inferBlockBehaviorId('iron_trapdoor'), 'minecraft:iron_trapdoor');
  assert.equal(canHandToggleOpenable('iron_trapdoor'), false);
  assert.ok(gameSource().includes("id: 'minecraft:iron_trapdoor'"));
});

test('372: wooden and Poplar trapdoors remain hand-operable', () => {
  assert.equal(inferBlockBehaviorId('oak_trapdoor'), 'minecraft:trapdoor');
  assert.equal(inferBlockBehaviorId('poplar_trapdoor'), 'minecraft:trapdoor');
  assert.equal(canHandToggleOpenable('poplar_trapdoor'), true);
});

test('373: opening a fence gate from its back flips facing to the player', () => {
  assert.deepEqual(resolveFenceGateManualToggle({ open: false, facing: 'north' }, 'south'), { open: true, facing: 'south' });
  assert.ok(gameSource().includes('resolveFenceGateManualToggle(meta, this.getPlayerHorizontalFacing())'));
});

test('374: closing a fence gate preserves its current facing', () => {
  assert.deepEqual(resolveFenceGateManualToggle({ open: true, facing: 'east' }, 'west'), { open: false, facing: 'east' });
});

test('375: an isolated chest may connect to one unpaired adjacent chest', () => {
  assert.equal(canPlaceChestFromNeighborDegrees([]), true);
  assert.equal(canPlaceChestFromNeighborDegrees([0]), true);
  assert.ok(gameSource().includes('this.canPlaceChestAt(x, y, z)'));
});

test('376: a chest cannot connect to a neighbor that is already paired', () => {
  assert.equal(canPlaceChestFromNeighborDegrees([1]), false);
});

test('377: a chest cannot create a triple/corner chest between two neighbors', () => {
  assert.equal(canPlaceChestFromNeighborDegrees([0, 0]), false);
  assert.equal(canPlaceChestFromNeighborDegrees([1, 0]), false);
});

test('378: furnace output rejects a result that would exceed the item stack limit', () => {
  assert.equal(canAcceptFurnaceOutput({ id: 1, count: 63 }, 1, 2, 64), false);
  assert.equal(canAcceptFurnaceOutput({ id: 2, count: 1 }, 1, 1, 64), false);
});

test('379: furnace output may fill a matching stack exactly to its max', () => {
  assert.equal(canAcceptFurnaceOutput({ id: 1, count: 63 }, 1, 1, 64), true);
  assert.ok(gameSource().includes('ItemRegistry.getMaxStackSize(recipeOutputId)'));
});

test('380: Poplar logs are semantic furnace fuel despite modern runtime IDs', () => {
  assert.equal(getFuelBurnTime(item('poplar_log').id), 15);
  assert.equal(isSmeltingFuel(item('poplar_log').id), true);
});

test('381: Poplar planks are semantic furnace fuel', () => {
  assert.equal(getFuelBurnTime(item('poplar_planks').id), 15);
});

test('382: Poplar trapdoors use the wooden 1.5-item burn time', () => {
  assert.equal(getFuelBurnTime(item('poplar_trapdoor').id), 15);
});

test('383: Poplar signs distinguish normal and hanging-sign burn times', () => {
  assert.equal(getFuelBurnTime(item('poplar_sign').id), 10);
  assert.equal(getFuelBurnTime(item('poplar_hanging_sign').id), 40);
});

test('384: Poplar saplings and buttons use the half-item burn time', () => {
  assert.equal(getFuelBurnTime(item('poplar_sapling').id), 5);
  assert.equal(getFuelBurnTime(item('poplar_button').id), 5);
});

test('385: hopper side insertion recognizes modern Poplar fuel for a furnace', () => {
  const planks = { id: item('poplar_planks').id, count: 1 };
  assert.deepEqual(getHopperInsertionSlots('furnace', 'side', planks), [1]);
});

test('386: wet sponge block-as-item has a semantic smelting recipe back to sponge', () => {
  const wet = BlockRegistry.getByName('wet_sponge');
  const dry = ItemRegistry.getByName('sponge') ?? BlockRegistry.getByName('sponge');
  assert.ok(wet);
  assert.ok(dry);
  const recipe = findSmeltingResult(wet.id);
  assert.ok(recipe);
  assert.equal(recipe.output, dry.id);
});

test('387: wet sponge turns an empty fuel-slot bucket into a water bucket', () => {
  assert.deepEqual(getWetSpongeFuelRemainder('wet_sponge', { id: 325, count: 1 }), { id: 326, count: 1 });
  assert.equal(getWetSpongeFuelRemainder('wet_sponge', { id: 263, count: 1 }), undefined);
  assert.ok(gameSource().includes("getWetSpongeFuelRemainder(ItemRegistry.get(input.id)?.name ?? BlockRegistry.get(input.id)?.name, meta.inventory[1])"));
});

test('388: a daytime thunderstorm satisfies the bed sleep-time contract', () => {
  assert.deepEqual(resolveBedUse('overworld', true, false), {
    canSleep: true, setsSpawn: true, explodes: false, blockedByMonsters: false,
  });
  assert.ok(gameSource().includes("this.isNight() || this.weather.getCurrentWeather() === 'thunder'"));
  assert.ok(gameSource().includes("this.weather.setWeatherType('clear')"));
});

test('389: bed safety uses the Java 8x5 monster box and explosions resolve to the head', () => {
  const head = getBedHeadPosition({ x: 10, y: 64, z: 10 }, { facing: 'east', bedPart: 'foot' });
  assert.deepEqual(head, { x: 11, y: 64, z: 10 });
  assert.equal(isMonsterWithinBedSleepRange(head, { x: 19, y: 69, z: 18 }), true);
  assert.equal(isMonsterWithinBedSleepRange(head, { x: 20, y: 69, z: 18 }), false);
  assert.equal(resolveBedUse('overworld', true, true).blockedByMonsters, true);
  assert.equal(resolveBedUse('overworld', true, true).canSleep, false);
  assert.ok(gameSource().includes('this.createExplosion(head.x + 0.5, head.y + 0.5, head.z + 0.5, 5)'));
});

test('390: glow ink on an empty sign side is a no-op and is not consumed', () => {
  const empty = applySignInteraction(undefined, 'glow_ink_sac', 'front');
  assert.equal(empty.consumeItem, false);
  assert.equal(empty.metadata.signGlowingFront, false);
  assert.equal(empty.opensEditor, true);

  const text = setSignTextForSide(undefined, 'front', ['hello']);
  const glowing = applySignInteraction(text, 'glow_ink_sac', 'front');
  assert.equal(glowing.consumeItem, true);
  assert.equal(glowing.metadata.signGlowingFront, true);
});