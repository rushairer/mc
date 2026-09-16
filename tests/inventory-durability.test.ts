import assert from 'node:assert/strict';
import test from 'node:test';
import { Inventory } from '../src/player/Inventory';
import { ItemRegistry } from '../src/items/ItemRegistry';
import { EnchantSystem } from '../src/systems/EnchantSystem';

function requireItem(name: string) {
  const item = ItemRegistry.getByName(name);
  assert.ok(item, `missing registry item: ${name}`);
  return item;
}

test('one armor-blockable hit damages every equipped armor piece', () => {
  const inventory = new Inventory();
  const names = ['diamond_helmet', 'diamond_chestplate', 'diamond_leggings', 'diamond_boots'];
  names.forEach((name, index) => {
    const def = requireItem(name);
    inventory.setArmorSlot(index, { id: def.id, count: 1, durability: 100 });
  });

  inventory.damageArmor(8);

  for (let i = 0; i < 4; i++) {
    assert.equal(inventory.getArmorSlot(i)?.durability, 98);
  }
});

test('armor breaks independently when a hit exhausts its durability', () => {
  const inventory = new Inventory();
  const helmet = requireItem('iron_helmet');
  const chest = requireItem('iron_chestplate');
  inventory.setArmorSlot(0, { id: helmet.id, count: 1, durability: 1 });
  inventory.setArmorSlot(1, { id: chest.id, count: 1, durability: 3 });

  inventory.damageArmor(4);

  assert.equal(inventory.getArmorSlot(0), null);
  assert.equal(inventory.getArmorSlot(1)?.durability, 2);
});

test('armor Unbreaking uses its armor-specific probability', () => {
  const helmet = requireItem('diamond_helmet');
  const stack = {
    id: helmet.id,
    count: 1,
    durability: helmet.durability,
    enchantments: [{ id: 'unbreaking' as const, level: 1 }],
  };

  assert.equal(EnchantSystem.shouldUseDurability(stack, () => 0.79), true);
  assert.equal(EnchantSystem.shouldUseDurability(stack, () => 0.8), false);
});

test('Mending repairs a damaged selected item at two durability per XP', () => {
  const inventory = new Inventory();
  const pickaxe = requireItem('diamond_pickaxe');
  assert.ok(pickaxe.durability);
  inventory.setSlot(0, {
    id: pickaxe.id,
    count: 1,
    durability: pickaxe.durability - 10,
    enchantments: [{ id: 'mending', level: 1 }],
  });

  const remaining = inventory.repairWithMendingXP(0, 3, () => 0);

  assert.equal(remaining, 0);
  assert.equal(inventory.getSlot(0)?.durability, pickaxe.durability - 4);
});

test('XP bypasses fully repaired Mending gear and remains player XP', () => {
  const inventory = new Inventory();
  const sword = requireItem('diamond_sword');
  assert.ok(sword.durability);
  inventory.setSlot(0, {
    id: sword.id,
    count: 1,
    durability: sword.durability,
    enchantments: [{ id: 'mending', level: 1 }],
  });

  assert.equal(inventory.repairWithMendingXP(0, 7, () => 0), 7);
});
