import assert from 'node:assert/strict';
import test from 'node:test';
import { findCraftingResult } from '../src/items/CraftingRecipes';
import { itemStacksCanMerge, cloneItemStack } from '../src/items/ItemStackRules';
import { ItemRegistry } from '../src/items/ItemRegistry';
import { registerWildernessBound26_3 } from '../src/world/registerWildernessBound26_3';
import { applySaturationStew26_3, getSuspiciousStewEffect26_3 } from '../src/world/SuspiciousStew26_3';

registerWildernessBound26_3();
const id = (name: string) => { const value = ItemRegistry.getByName(name)?.id; assert.ok(value !== undefined, name); return value; };
const grid = (...items: number[]) => [...items, ...new Array(9).fill(0)].slice(0, 9);

test('251: current Java stew data maps legacy Dandelion to Saturation', () => {
  assert.deepEqual(getSuspiciousStewEffect26_3('yellow_flower'), { id: 'saturation', duration: 0.35, level: 1, sourceFlower: 'yellow_flower' });
});

test('252: Poppy/Torchflower stew data produces Night Vision', () => {
  assert.equal(getSuspiciousStewEffect26_3('red_flower')?.id, 'night_vision');
  assert.equal(getSuspiciousStewEffect26_3('torchflower')?.duration, 5);
});

test('253: tulips share Weakness while Wither Rose keeps Wither', () => {
  assert.equal(getSuspiciousStewEffect26_3('red_tulip')?.id, 'weakness');
  assert.equal(getSuspiciousStewEffect26_3('pink_tulip')?.duration, 7);
  assert.equal(getSuspiciousStewEffect26_3('wither_rose')?.id, 'wither');
});

test('254: crafted Suspicious Stew carries its effect and returns a bowl', () => {
  const result = findCraftingResult(grid(id('bowl'), id('shelf_mushroom'), id('brown_mushroom'), id('yellow_flower')));
  assert.equal(result?.id, id('suspicious_stew'));
  assert.equal(result?.alwaysEdible, true);
  assert.equal(result?.containerItemId, id('bowl'));
  assert.equal(result?.foodEffects?.[0]?.id, 'saturation');
});

test('255: differently flavored Suspicious Stews cannot merge', () => {
  const saturation = { id: id('suspicious_stew'), count: 1, foodEffects: [getSuspiciousStewEffect26_3('yellow_flower')!], alwaysEdible: true };
  const nightVision = { id: id('suspicious_stew'), count: 1, foodEffects: [getSuspiciousStewEffect26_3('red_flower')!], alwaysEdible: true };
  assert.equal(itemStacksCanMerge(saturation, nightVision), false);
});

test('256: stew foodEffects are deep-cloned with the stack', () => {
  const original = { id: id('suspicious_stew'), count: 1, foodEffects: [getSuspiciousStewEffect26_3('red_tulip')!] };
  const copy = cloneItemStack(original)!;
  assert.notEqual(copy.foodEffects, original.foodEffects);
  assert.notEqual(copy.foodEffects?.[0], original.foodEffects[0]);
});

test('257: Saturation stew resolves seven Java ticks into hunger and saturation', () => {
  assert.deepEqual(applySaturationStew26_3(10, 2), { hunger: 17, saturation: 16 });
  assert.deepEqual(applySaturationStew26_3(19, 19), { hunger: 20, saturation: 20 });
});

test('258: crafting UIs insert full result stacks instead of stripping components', async () => {
  const { readFile } = await import('node:fs/promises');
  for (const path of ['src/ui/CraftingTableUI.tsx', 'src/ui/InventoryUI.tsx']) {
    const source = await readFile(path, 'utf8');
    assert.match(source, /useState<ItemStack \| null>/);
    assert.match(source, /inventory\.addStack\(craftResult\)/);
  }
});
