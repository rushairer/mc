import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ItemRegistry } from '../src/items/ItemRegistry';
import { VisualResolver } from '../src/visual/VisualResolver';
import { Inventory } from '../src/player/Inventory';
import { getItemStackMaxSize, isValidItemStack } from '../src/items/ItemStackRules';
import { placeOneFromCursor, quickMovePlayerInventory } from '../src/items/InventoryTransferRules';
import {
  canConsumeFoodItem,
  getDefaultUseRemainderItemId,
  getItemUseDurationSeconds,
  isItemAlwaysEdible,
  shouldConsumePlacedItem,
} from '../src/items/ItemUseRules';

const item = (name: string) => {
  const def = ItemRegistry.getByName(name);
  assert.ok(def, name);
  return def;
};

test('311: every registered item has canonical identity and display name', () => {
  for (const def of ItemRegistry.all()) {
    assert.ok(def.officialId.startsWith('minecraft:'), def.name);
    assert.ok(def.name.length > 0, String(def.id));
    assert.ok(def.displayName.length > 0, def.name);
  }
});

test('312: every registered item resolves a non-unknown inventory icon key', () => {
  for (const def of ItemRegistry.all()) {
    assert.notEqual(VisualResolver.getItemIconKey(def.id), 'item:unknown', def.name);
  }
});

test('313: direct block-category items resolve through the block icon pipeline', () => {
  for (const def of ItemRegistry.all().filter((entry) => entry.category === 'block')) {
    assert.match(VisualResolver.getItemIconKey(def.id), /^icon:block:/, def.name);
  }
});

test('314: registry stack sizes are always inside Java item-stack bounds', () => {
  for (const def of ItemRegistry.all()) {
    const max = ItemRegistry.getMaxStackSize(def.id);
    assert.ok(max >= 1 && max <= 64, def.name + ':' + max);
  }
});

test('315: every damageable item is non-stackable', () => {
  for (const def of ItemRegistry.all().filter((entry) => entry.durability !== undefined)) {
    assert.equal(ItemRegistry.getMaxStackSize(def.id), 1, def.name);
  }
});

test('316: Ender Pearls retain the Java stack limit of 16', () => {
  assert.equal(ItemRegistry.getMaxStackSize(item('ender_pearl').id), 16);
});

test('317: Snowballs retain the Java stack limit of 16', () => {
  assert.equal(ItemRegistry.getMaxStackSize(item('snowball').id), 16);
});

test('318: adding multiple damageable tools splits them into one-per-slot stacks', () => {
  const inventory = new Inventory();
  const pickaxe = item('diamond_pickaxe');
  assert.equal(inventory.addStack({ id: pickaxe.id, count: 2, durability: pickaxe.durability }), null);
  assert.equal(inventory.getSlot(0)?.count, 1);
  assert.equal(inventory.getSlot(1)?.count, 1);
});

test('319: splitSlot preserves stack components while splitting counts', () => {
  const inventory = new Inventory();
  const book = item('book');
  inventory.setSlot(0, { id: book.id, count: 5, enchantments: [{ id: 'unbreaking', level: 1 }] });
  const split = inventory.splitSlot(0);
  assert.equal(split?.count, 3);
  assert.equal(inventory.getSlot(0)?.count, 2);
  assert.deepEqual(split?.enchantments, [{ id: 'unbreaking', level: 1 }]);
});

test('320: quick move transfers a hotbar stack into the main inventory', () => {
  const inventory = new Inventory();
  const stone = item('stone');
  inventory.setSlot(0, { id: stone.id, count: 10 });
  assert.equal(inventory.quickMove(0), 10);
  assert.equal(inventory.getSlot(0), null);
  assert.equal(inventory.getSlot(9)?.count, 10);
});

test('321: quick move transfers a main-inventory stack into the hotbar', () => {
  const inventory = new Inventory();
  const stone = item('stone');
  inventory.setSlot(9, { id: stone.id, count: 10 });
  assert.equal(inventory.quickMove(9), 10);
  assert.equal(inventory.getSlot(9), null);
  assert.equal(inventory.getSlot(0)?.count, 10);
});

test('322: quick move merges compatible stacks before occupying empty slots', () => {
  const slots = new Array(36).fill(null);
  const stone = item('stone');
  slots[0] = { id: stone.id, count: 10 };
  slots[9] = { id: stone.id, count: 60 };
  assert.equal(quickMovePlayerInventory(slots, 0), 10);
  assert.equal(slots[9]?.count, 64);
  assert.equal(slots[10]?.count, 6);
});

test('323: quick move respects per-item stack limits', () => {
  const slots = new Array(36).fill(null);
  const pearl = item('ender_pearl');
  slots[0] = { id: pearl.id, count: 16 };
  slots[9] = { id: pearl.id, count: 15 };
  assert.equal(quickMovePlayerInventory(slots, 0), 16);
  assert.equal(slots[9]?.count, 16);
  assert.equal(slots[10]?.count, 15);
});

test('324: quick move is a no-op when every destination slot is full', () => {
  const slots = new Array(36).fill(null);
  const stone = item('stone');
  slots[0] = { id: stone.id, count: 3 };
  for (let i = 9; i < 36; i++) slots[i] = { id: stone.id, count: 64 };
  assert.equal(quickMovePlayerInventory(slots, 0), 0);
  assert.equal(slots[0]?.count, 3);
});

test('325: right-click placement moves exactly one cursor item into an empty slot', () => {
  const stone = item('stone');
  const result = placeOneFromCursor(null, { id: stone.id, count: 4 });
  assert.equal(result.slot?.count, 1);
  assert.equal(result.cursor?.count, 3);
  assert.equal(result.moved, 1);
});

test('326: right-click placement merges one item and refuses an already-full stack', () => {
  const pearl = item('ender_pearl');
  const merged = placeOneFromCursor({ id: pearl.id, count: 15 }, { id: pearl.id, count: 2 });
  assert.equal(merged.slot?.count, 16);
  assert.equal(merged.cursor?.count, 1);
  const full = placeOneFromCursor({ id: pearl.id, count: 16 }, { id: pearl.id, count: 1 });
  assert.equal(full.moved, 0);
});

test('327: food use duration models fast Dried Kelp and ordinary 1.6 second food', () => {
  assert.equal(getItemUseDurationSeconds(item('dried_kelp').id), 0.8);
  assert.equal(getItemUseDurationSeconds(item('bread').id), 1.6);
});

test('328: full-hunger food use allows Java always-edible items only', () => {
  const golden = { id: item('golden_apple').id, count: 1 };
  const bread = { id: item('bread').id, count: 1 };
  assert.equal(isItemAlwaysEdible(golden), true);
  assert.equal(canConsumeFoodItem(golden, 20), true);
  assert.equal(canConsumeFoodItem(bread, 20), false);
});

test('329: consumable defaults return their Java container item', () => {
  assert.equal(getDefaultUseRemainderItemId(item('potion').id), item('glass_bottle').id);
  assert.equal(getDefaultUseRemainderItemId(item('milk_bucket').id), item('bucket').id);
  assert.equal(getDefaultUseRemainderItemId(item('mushroom_stew').id), item('bowl').id);
});

test('330: placement consumption and live Game use paths are wired to the shared rules', () => {
  assert.equal(shouldConsumePlacedItem('survival'), true);
  assert.equal(shouldConsumePlacedItem('creative'), false);
  assert.equal(getItemStackMaxSize({ id: item('diamond_pickaxe').id }), 1);
  assert.equal(isValidItemStack({ id: item('ender_pearl').id, count: 16 }), true);
  assert.equal(isValidItemStack({ id: item('ender_pearl').id, count: 17 }), false);
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  assert.ok(source.includes('canConsumeFoodItem(stack, this.player.hunger)'));
  assert.ok(source.includes('getItemUseDurationSeconds(stack)'));
  assert.ok(source.includes('getDefaultUseRemainderItemId(stack.id)'));
  assert.ok(source.includes('shouldConsumePlacedItem(this.gameMode)'));
});
