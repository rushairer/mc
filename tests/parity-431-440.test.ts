import test from 'node:test';
import assert from 'node:assert/strict';
import { ItemRegistry } from '../src/items/ItemRegistry';
import { VisualResolver } from '../src/visual/VisualResolver';
import { localizeItemDisplayName } from '../src/i18nItemNames';
import { inferItemBehaviorId } from '../src/world/BehaviorIds';
import { CUSHION_ITEMS, EXPLORER_MAP_NAMES, WILDERNESS_BOUND_ALL_ITEMS, WILDERNESS_BOUND_VERSION } from '../src/world/WildernessBound26_3';
import { registerWildernessBound26_3 } from '../src/world/registerWildernessBound26_3';

registerWildernessBound26_3();
const item = (name: string) => { const def = ItemRegistry.getByName(name); assert.ok(def, name); return def; };

test('431: Java parity target is Wilderness Bound 26.3', () => assert.equal(WILDERNESS_BOUND_VERSION, '26.3'));
test('432: every Cushion variant has canonical identity and a user-facing name', () => {
  assert.equal(CUSHION_ITEMS.length, 16);
  for (const def of CUSHION_ITEMS) { assert.equal(def.officialId, 'minecraft:' + def.name); assert.ok(def.displayName?.endsWith(' Cushion'), def.name); }
});
test('433: all sixteen Cushions keep distinct item-sprite icon identities', () => {
  const icons = CUSHION_ITEMS.map(def => VisualResolver.getItemIconKey(def.id));
  assert.equal(new Set(icons).size, 16); assert.ok(icons.every(icon => icon.startsWith('item:')));
});
test('434: Poplar boat variants resolve through item sprites instead of block icons', () => {
  assert.equal(VisualResolver.getItemIconKey(item('poplar_boat').id), 'item:poplar_boat');
  assert.equal(VisualResolver.getItemIconKey(item('poplar_chest_boat').id), 'item:poplar_chest_boat');
});
test('435: Cushion behavior can be inferred even when a data pack omits behaviorId', () => {
  assert.equal(inferItemBehaviorId('blue_cushion'), 'minecraft:cushion');
  assert.equal(inferItemBehaviorId('minecraft:red_cushion'), 'minecraft:cushion');
});
test('436: Simplified Chinese knows the core Wilderness Bound item names', () => {
  assert.equal(localizeItemDisplayName('zh-CN', 'poplar_log', 'Poplar Log'), '杨木原木');
  assert.equal(localizeItemDisplayName('zh-CN', 'shelf_mushroom', 'Shelf Mushroom'), '层孔菇');
  assert.equal(localizeItemDisplayName('zh-CN', 'red_shrub', 'Red Shrub'), '红灌木');
  assert.equal(localizeItemDisplayName('zh-CN', 'straw_bed', 'Straw Bed'), '稻草床');
});
test('437: color Cushion names localize compositionally', () => {
  assert.equal(localizeItemDisplayName('zh-CN', 'white_cushion', 'White Cushion'), '白色坐垫');
  assert.equal(localizeItemDisplayName('zh-TW', 'blue_cushion', 'Blue Cushion'), '藍色坐墊');
});
test('438: Poplar family names localize without leaking the English material name', () => {
  assert.equal(localizeItemDisplayName('zh-CN', 'poplar_boat', 'Poplar Boat'), '杨木船');
  assert.equal(localizeItemDisplayName('zh-TW', 'poplar_boat', 'Poplar Boat'), '楊木船');
});
test('439: all 26.3 Explorer Maps retain distinct item icon identities', () => {
  const icons = EXPLORER_MAP_NAMES.map(name => VisualResolver.getItemIconKey(item(name).id));
  assert.equal(new Set(icons).size, EXPLORER_MAP_NAMES.length); assert.ok(icons.every(icon => icon.startsWith('item:')));
});
test('440: every core 26.3 item resolves to a known presentation icon', () => {
  for (const def of WILDERNESS_BOUND_ALL_ITEMS) assert.notEqual(VisualResolver.getItemIconKey(def.id), 'item:unknown', def.name);
});
