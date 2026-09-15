import assert from 'node:assert/strict';
import test from 'node:test';
import { getArmorToughness } from '../src/items/ArmorAttributes';

test('diamond armor contributes two toughness per equipped piece', () => {
  for (const slot of ['helmet', 'chestplate', 'leggings', 'boots']) {
    assert.equal(getArmorToughness(`diamond_${slot}`), 2);
  }
});

test('netherite armor contributes three toughness per equipped piece', () => {
  for (const slot of ['helmet', 'chestplate', 'leggings', 'boots']) {
    assert.equal(getArmorToughness(`netherite_${slot}`), 3);
  }
});

test('other vanilla armor materials contribute zero toughness', () => {
  for (const name of [
    'leather_chestplate', 'chainmail_chestplate', 'iron_chestplate',
    'golden_chestplate', 'turtle_helmet',
  ]) {
    assert.equal(getArmorToughness(name), 0, name);
  }
});
