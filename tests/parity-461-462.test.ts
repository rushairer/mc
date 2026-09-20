import test from 'node:test';
import assert from 'node:assert/strict';
import { ItemRegistry } from '../src/items/ItemRegistry';
import { VisualResolver } from '../src/visual/VisualResolver';
import { localizeItemDisplayName } from '../src/i18nItemNames';
import { registerWildernessBound26_3 } from '../src/world/registerWildernessBound26_3';

registerWildernessBound26_3();

test('461: registered high-ID non-block items cannot alias legacy block IDs', () => {
  const boat = ItemRegistry.getByName('poplar_boat');
  assert.ok(boat);
  assert.equal(ItemRegistry.getPlaceBlockId(boat.id), undefined);
  assert.equal(VisualResolver.getItemIconKey(boat.id), 'item:poplar_boat');
});

test('462: Poplar boat names localize without leaking English tokens', () => {
  assert.equal(localizeItemDisplayName('zh-CN', 'poplar_boat', 'Poplar Boat'), '杨木船');
  assert.equal(localizeItemDisplayName('zh-TW', 'poplar_boat', 'Poplar Boat'), '楊木船');
});
