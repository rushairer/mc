import assert from 'node:assert/strict';
import test from 'node:test';
import { EnchantSystem } from '../src/systems/EnchantSystem';
import { ItemRegistry } from '../src/items/ItemRegistry';

test('Quick Charge is a three-level crossbow enchantment', () => {
  const def = EnchantSystem.getDefinition('quick_charge');
  assert.equal(def.displayName, 'Quick Charge');
  assert.equal(def.maxLevel, 3);
});

test('Quick Charge is offered for crossbows but not bows', () => {
  const crossbow = ItemRegistry.getByName('crossbow');
  const bow = ItemRegistry.getByName('bow');
  assert.ok(crossbow);
  assert.ok(bow);

  assert.equal(
    EnchantSystem.getApplicableEnchantments({ id: crossbow.id, count: 1 }).includes('quick_charge'),
    true,
  );
  assert.equal(
    EnchantSystem.getApplicableEnchantments({ id: bow.id, count: 1 }).includes('quick_charge'),
    false,
  );
});

test('Mending remains treasure-only and is not rolled by the enchanting table', () => {
  const pickaxe = ItemRegistry.getByName('diamond_pickaxe');
  assert.ok(pickaxe);
  assert.equal(
    EnchantSystem.getApplicableEnchantments({ id: pickaxe.id, count: 1 }).includes('mending'),
    false,
  );
});
