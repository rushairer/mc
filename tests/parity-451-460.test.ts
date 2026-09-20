import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ItemRegistry } from '../src/items/ItemRegistry';
import { VisualResolver } from '../src/visual/VisualResolver';
import { isValidItemStack } from '../src/items/ItemStackRules';
import { registerWildernessBound26_3 } from '../src/world/registerWildernessBound26_3';

registerWildernessBound26_3();
const item = (name: string) => { const def = ItemRegistry.getByName(name); assert.ok(def, name); return def; };

test('451: Java 26.3 Cushions stack to sixteen', () => {
  assert.equal(ItemRegistry.getMaxStackSize(item('red_cushion').id), 16);
  assert.equal(ItemRegistry.getMaxStackSize(item('white_cushion').id), 16);
});
test('452: Java 26.3 Straw Beds stack to sixteen', () => assert.equal(ItemRegistry.getMaxStackSize(item('straw_bed').id), 16));
test('453: inventory validation rejects seventeenth Cushion and Straw Bed items', () => {
  assert.equal(isValidItemStack({ id: item('red_cushion').id, count: 16 }), true);
  assert.equal(isValidItemStack({ id: item('red_cushion').id, count: 17 }), false);
  assert.equal(isValidItemStack({ id: item('straw_bed').id, count: 16 }), true);
  assert.equal(isValidItemStack({ id: item('straw_bed').id, count: 17 }), false);
});
test('454: Straw Bed uses a dedicated inventory sprite rather than a cube icon', () => {
  assert.equal(VisualResolver.getItemIconKey(item('straw_bed').id), 'item:straw_bed');
  assert.equal(VisualResolver.getItemVisualKind(item('straw_bed').id), 'sprite');
});
test('455: Poplar door and sign family use item sprites in inventory', () => {
  for (const name of ['poplar_door', 'poplar_sign', 'poplar_hanging_sign']) {
    assert.equal(VisualResolver.getItemIconKey(item(name).id), 'item:' + name);
    assert.equal(VisualResolver.getItemVisualKind(item(name).id), 'sprite');
  }
});
test('456: Dappled Forest non-cubic plants use item sprites in inventory', () => {
  for (const name of ['poplar_sapling', 'shelf_mushroom', 'red_shrub']) {
    assert.equal(VisualResolver.getItemIconKey(item(name).id), 'item:' + name);
    assert.equal(VisualResolver.getItemVisualKind(item(name).id), 'sprite');
  }
});
test('457: modern Poplar cubes preserve Poplar material identity instead of falling back to Oak', () => {
  assert.equal(VisualResolver.getItemIconKey(item('poplar_log').id), 'icon:block:poplar_log');
  assert.equal(VisualResolver.getItemIconKey(item('poplar_planks').id), 'icon:block:poplar_planks');
});
test('458: Cushion runtime removes seats when their supporting block is destroyed', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  assert.ok(source.includes('this.cushionSeats26_3.breakUnsupported(this.cushionSupportKey26_3(position))'));
  assert.ok(source.includes('this.breakCushionsSupportedBy26_3({ x, y, z }, spawnDrop)'));
});
test('459: unsupported Cushion cleanup removes render resources and restores a survival drop', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  assert.ok(source.includes('this.renderer.scene.remove(mesh)'));
  assert.ok(source.includes('mesh.geometry.dispose()'));
  assert.ok(source.includes('ItemRegistry.getByName'));
  assert.ok(source.includes('_cushion'));
  assert.ok(source.includes("spawnDrop && this.gameMode !== 'creative'"));
});
test('460: the item atlas contains dedicated silhouettes for latest non-cubic 26.3 items', () => {
  const source = readFileSync(new URL('../src/engine/TextureAtlas.ts', import.meta.url), 'utf8');
  assert.ok(source.includes("name.includes('bed')"));
  assert.ok(source.includes("name.includes('hanging_sign')"));
  assert.ok(source.includes("name.includes('sapling') || name.includes('shrub')"));
  assert.ok(source.includes("name.includes('mushroom')"));
});
