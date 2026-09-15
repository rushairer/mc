import assert from 'node:assert/strict';
import test from 'node:test';
import { ItemRegistry } from '../src/items/ItemRegistry';
import { Inventory } from '../src/player/Inventory';

function equipSet(inventory: Inventory, material: 'diamond' | 'netherite') {
  const names = [
    `${material}_helmet`,
    `${material}_chestplate`,
    `${material}_leggings`,
    `${material}_boots`,
  ];
  names.forEach((name, index) => {
    const def = ItemRegistry.getByName(name);
    assert.ok(def, `${name} is registered`);
    inventory.setArmorSlot(index, { id: def.id, count: 1 });
  });
}

test('full diamond armor totals twenty defense and eight toughness', () => {
  const inventory = new Inventory();
  equipSet(inventory, 'diamond');
  assert.equal(inventory.getTotalArmorDefense(), 20);
  assert.equal(inventory.getTotalArmorToughness(), 8);
});

test('full netherite armor totals twenty defense and twelve toughness', () => {
  const inventory = new Inventory();
  equipSet(inventory, 'netherite');
  assert.equal(inventory.getTotalArmorDefense(), 20);
  assert.equal(inventory.getTotalArmorToughness(), 12);
});

test('unequipped armor contributes no toughness', () => {
  const inventory = new Inventory();
  assert.equal(inventory.getTotalArmorToughness(), 0);
});
