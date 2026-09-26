import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ItemRegistry } from '../src/items/ItemRegistry';
import {
  canDispenserPlaceBoat,
  dispenserEquipmentSlot,
  dispenserEquipmentSlotIndex,
  getDispenserSpecialAction,
} from '../src/items/DispenserRules';

const item = (name: string) => {
  const def = ItemRegistry.getByName(name);
  assert.ok(def, name);
  return def;
};

test('883: Spawn Egg items are classified for entity spawning', () => {
  assert.deepEqual(getDispenserSpecialAction('zombie_spawn_egg'), { kind: 'spawn_egg' });
  assert.deepEqual(getDispenserSpecialAction('sheep_spawn_egg'), { kind: 'spawn_egg' });
});

test('884: Dispenser Spawn Egg execution uses the existing spawn-egg mob mapping and consumes one item', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = source.indexOf("if (special.kind === 'spawn_egg')");
  assert.ok(start >= 0);
  const branch = source.slice(start, start + 650);
  assert.ok(branch.includes('spawnEggMobTypeForItemName(itemName)'));
  assert.ok(branch.includes('this.mobs.spawnMob(mobType, tx + 0.5, ty, tz + 0.5)'));
  assert.ok(branch.includes('consumeDispenserSlot(meta.inventory, sourceSlot)'));
});

test('885: Armor Stand has a first-class Dispenser placement action', () => {
  assert.deepEqual(getDispenserSpecialAction('armor_stand'), { kind: 'armor_stand' });
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = source.indexOf("if (special.kind === 'armor_stand')");
  const branch = source.slice(start, start + 500);
  assert.ok(branch.includes("this.mobs.spawnMob('armor_stand', tx + 0.5, ty, tz + 0.5)"));
  assert.ok(branch.includes('consumeDispenserSlot(meta.inventory, sourceSlot)'));
});

test('886: ordinary and chest boat identities remain distinguishable', () => {
  assert.deepEqual(getDispenserSpecialAction('oak_boat'), { kind: 'boat', chest: false });
  assert.deepEqual(getDispenserSpecialAction('boat'), { kind: 'boat', chest: false });
  assert.deepEqual(getDispenserSpecialAction('oak_chest_boat'), { kind: 'boat', chest: true });
});

test('887: boats place only into water or air immediately above water', () => {
  assert.equal(canDispenserPlaceBoat(true, false, false), true);
  assert.equal(canDispenserPlaceBoat(false, true, true), true);
  assert.equal(canDispenserPlaceBoat(false, true, false), false);
  assert.equal(canDispenserPlaceBoat(false, false, true), false);
});

test('888: Dispenser boat placement creates the matching vehicle type and preserves exact source item identity', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = source.indexOf("if (special.kind === 'boat')");
  const branch = source.slice(start, start + 1000);
  assert.ok(branch.includes("special.chest ? 'chest_boat' : 'boat'"));
  assert.ok(branch.includes('this.vehicles.spawnVehicle('));
  assert.ok(branch.includes('selected.id'));
});

test('889: all modeled Minecart item variants share the rail-placement Dispenser action', () => {
  for (const name of ['minecart', 'chest_minecart', 'furnace_minecart', 'tnt_minecart', 'hopper_minecart', 'command_block_minecart']) {
    assert.deepEqual(getDispenserSpecialAction(name), { kind: 'minecart' });
  }
});

test('890: Minecart special placement requires an actual rail and otherwise falls back to ordinary ejection', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = source.indexOf("if (special.kind === 'minecart')");
  const branch = source.slice(start, start + 700);
  assert.ok(branch.includes('if (!BlockRegistry.isRail(targetId)) return false'));
  assert.ok(branch.includes("this.vehicles.spawnVehicle("));
  assert.ok(branch.includes("'minecart'"));
});

test('891: all 17 Shulker Box identities use block placement behavior', () => {
  const names = [
    'shulker_box', 'white_shulker_box', 'orange_shulker_box', 'magenta_shulker_box',
    'light_blue_shulker_box', 'yellow_shulker_box', 'lime_shulker_box', 'pink_shulker_box',
    'gray_shulker_box', 'light_gray_shulker_box', 'cyan_shulker_box', 'purple_shulker_box',
    'blue_shulker_box', 'brown_shulker_box', 'green_shulker_box', 'red_shulker_box',
    'black_shulker_box',
  ];
  for (const name of names) assert.deepEqual(getDispenserSpecialAction(name), { kind: 'shulker_box' });
});

test('892: dispensed Shulker Boxes preserve item contents and inherit the machine facing', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = source.indexOf("if (special.kind === 'shulker_box')");
  const branch = source.slice(start, start + 1250);
  assert.ok(branch.includes('ItemRegistry.getPlaceBlockId(selected.id)'));
  assert.ok(branch.includes("createShulkerBoxMetadata(selected, meta.facing ?? 'up')"));
  assert.ok(branch.includes('consumeDispenserSlot(meta.inventory, sourceSlot)'));
});

test('893: Bone Meal is a non-ejecting special action', () => {
  assert.deepEqual(getDispenserSpecialAction('bone_meal'), { kind: 'bone_meal' });
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = source.indexOf("if (special.kind === 'bone_meal')");
  const branch = source.slice(start, start + 2200);
  assert.ok(branch.includes('// Bone Meal remains in the Dispenser when the target cannot grow.'));
  assert.ok(branch.includes('return true'));
});

test('894: Dispenser Bone Meal enlarges Shelf Mushrooms only once', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = source.indexOf("targetName === 'shelf_mushroom'", source.indexOf("if (special.kind === 'bone_meal')"));
  const branch = source.slice(start, start + 750);
  assert.ok(branch.includes("current?.shelfMushroomSize === 'large'"));
  assert.ok(branch.includes("shelfMushroomSize: 'large'"));
  assert.ok(branch.includes('consumeDispenserSlot(meta.inventory, sourceSlot)'));
});

test('895: Dispenser Bone Meal reuses Java 26.3 Red Shrub spread offsets and consumes only on successful growth', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = source.indexOf("targetName === 'red_shrub'", source.indexOf("if (special.kind === 'bone_meal')"));
  const branch = source.slice(start, start + 1450);
  assert.ok(branch.includes('rotateBoneMealSpreadOffsets26_3(start)'));
  assert.ok(branch.includes('BlockRegistry.isSolid(this.chunks.getBlock(nx, ty - 1, nz))'));
  assert.ok(branch.includes('consumeDispenserSlot(meta.inventory, sourceSlot)'));
});

test('896: Shears stay in the Dispenser when no shearable modeled target is present', () => {
  assert.deepEqual(getDispenserSpecialAction('shears'), { kind: 'shears' });
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = source.indexOf("if (special.kind === 'shears')");
  const branch = source.slice(start, start + 1200);
  assert.ok(branch.includes('if (!sheep) return true'));
});

test('897: adult unshorn Sheep in the facing block are sheared for 1-3 wool and Shears durability', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = source.indexOf("if (special.kind === 'shears')");
  const branch = source.slice(start, start + 1600);
  assert.ok(branch.includes("mob.def.type === 'sheep'"));
  assert.ok(branch.includes('!mob.isBaby'));
  assert.ok(branch.includes('!mob.isSheared'));
  assert.ok(branch.includes('sheep.isSheared = true'));
  assert.ok(branch.includes('1 + Math.floor(Math.random() * 3)'));
  assert.ok(branch.includes('damageDispenserTool(meta.inventory, sourceSlot, maxDurability)'));
});

test('898: Glass Bottle is special only when it can collect a stationary water source', () => {
  assert.deepEqual(getDispenserSpecialAction('glass_bottle'), { kind: 'glass_bottle' });
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = source.indexOf("if (special.kind === 'glass_bottle')");
  const branch = source.slice(start, start + 1050);
  assert.ok(branch.includes("BlockRegistry.get(targetId)?.name !== 'water'"));
  assert.ok(branch.includes("ItemRegistry.getByName('potion')"));
  assert.ok(branch.includes("potion: { kind: 'water', name: 'Water' }"));
});

test('899: Glass Bottle failure deliberately returns to ordinary item ejection', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = source.indexOf("if (special.kind === 'glass_bottle')");
  const branch = source.slice(start, start + 400);
  assert.ok(branch.includes("if (BlockRegistry.get(targetId)?.name !== 'water') return false"));
});

test('900: wearable items map to the same four armor slots used by player and Armor Stand inventories', () => {
  assert.equal(dispenserEquipmentSlot('iron_helmet'), 'helmet');
  assert.equal(dispenserEquipmentSlot('carved_pumpkin'), 'helmet');
  assert.equal(dispenserEquipmentSlot('wither_skeleton_skull'), 'helmet');
  assert.equal(dispenserEquipmentSlot('elytra'), 'chestplate');
  assert.equal(dispenserEquipmentSlot('diamond_chestplate'), 'chestplate');
  assert.equal(dispenserEquipmentSlot('netherite_leggings'), 'leggings');
  assert.equal(dispenserEquipmentSlot('golden_boots'), 'boots');
  assert.deepEqual(['helmet', 'chestplate', 'leggings', 'boots'].map((slot) => dispenserEquipmentSlotIndex(slot as any)), [0, 1, 2, 3]);
});

test('901: Dispenser equipment preserves ItemStack components and never overwrites an occupied player or Armor Stand slot', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = source.indexOf("if (special.kind === 'equip')");
  const branch = source.slice(start, start + 1900);
  assert.ok(branch.includes('const equipped = cloneItemStack(selected)!'));
  assert.ok(branch.includes('equipped.count = 1'));
  assert.ok(branch.includes('!this.inventory.getArmorSlot(slotIndex)'));
  assert.ok(branch.includes('!mob.getArmorStandEquipment(slotIndex)'));
  assert.ok(branch.includes('stand.setArmorStandEquipment(slotIndex, equipped)'));
});

test('902: armor/elytra fall back to ordinary ejection without a target, while heads and carved pumpkins remain in the Dispenser', () => {
  assert.deepEqual(getDispenserSpecialAction('diamond_chestplate'), { kind: 'equip', slot: 'chestplate', noFallback: false });
  assert.deepEqual(getDispenserSpecialAction('elytra'), { kind: 'equip', slot: 'chestplate', noFallback: false });
  assert.deepEqual(getDispenserSpecialAction('carved_pumpkin'), { kind: 'equip', slot: 'helmet', noFallback: true });
  assert.deepEqual(getDispenserSpecialAction('wither_skeleton_skull'), { kind: 'equip', slot: 'helmet', noFallback: true });
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = source.indexOf("if (special.kind === 'equip')");
  const branch = source.slice(start, start + 1900);
  assert.ok(branch.includes('return special.noFallback'));
});
