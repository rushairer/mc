import test from 'node:test';
import assert from 'node:assert/strict';
import { ItemRegistry } from '../src/items/ItemRegistry';
import { BlockRegistry } from '../src/world/BlockRegistry';
import { VisualResolver } from '../src/visual/VisualResolver';
import { resolveItemPresentationIdentity, getItemTranslationKey } from '../src/items/ItemPresentation';
import { planBlockPlacement } from '../src/world/BlockPlacement';
import { BehaviorRegistry } from '../src/world/BehaviorRegistry';
import { registerWildernessBound26_3 } from '../src/world/registerWildernessBound26_3';
import { CUSHION_ITEMS, WILDERNESS_BOUND_ITEMS, useStrawBed } from '../src/world/WildernessBound26_3';
import { CushionSeatSystem26_3 } from '../src/world/WildernessBoundGameplay26_3';

registerWildernessBound26_3();
const item = (name: string) => { const def = ItemRegistry.getByName(name); assert.ok(def, name); return def; };
const target = (blockId: number, face: 'up' | 'north' = 'up') => ({ position: { x: 10, y: 64, z: 10 }, face, blockId, block: BlockRegistry.get(blockId)!, heldItem: null });
const world = {
  getBlock: ({ y }: { x: number; y: number; z: number }) => y <= 64 ? 1 : 0,
  getBlockMetadata: () => undefined,
};

test('291: modern Poplar block items resolve presentation as blocks', () => {
  const identity = resolveItemPresentationIdentity(item('poplar_log').id);
  assert.equal(identity.kind, 'block'); assert.equal(identity.registryName, 'poplar_log');
});
test('292: Straw Bed uses a block translation key despite modern runtime ID', () => assert.equal(getItemTranslationKey(item('straw_bed').id), 'block_straw_bed'));
test('293: Cushion remains an item presentation', () => assert.equal(resolveItemPresentationIdentity(item('red_cushion').id).kind, 'item'));
test('294: Poplar block item icon uses block icon pipeline', () => assert.match(VisualResolver.getItemIconKey(item('poplar_log').id), /^icon:block:/));
test('295: Cushion has item sprite key', () => assert.equal(VisualResolver.getItemIconKey(item('red_cushion').id), 'item:red_cushion'));
test('296: explorer maps reuse filled-map icon', () => assert.equal(VisualResolver.getItemIconKey(item('ocean_monument_map').id), 'item:filled_map'));
test('297: Straw Bed dispatches through block_item placement', () => assert.equal(item('straw_bed').behaviorId, 'minecraft:block_item'));
test('298: every 26.3 direct block item uses generic placement', () => { for (const def of WILDERNESS_BOUND_ITEMS) assert.equal(ItemRegistry.get(def.id)?.behaviorId, 'minecraft:block_item', def.name); });
test('299: Straw Bed resolves exact modern placeBlockId', () => { const def = item('straw_bed'); assert.equal(ItemRegistry.getPlaceBlockId(def.id), def.id); });
test('300: Cushions are not block-placeable', () => assert.equal(ItemRegistry.getPlaceBlockId(item('red_cushion').id), undefined));
test('301: Straw Bed placement plans as bed', () => { const def = item('straw_bed'); const d = planBlockPlacement({ item: def, target: target(1), placeBlockId: def.placeBlockId, playerOccupiedCells: [] }, world); assert.equal(d.ok, true); if (d.ok) assert.equal(d.plan.kind, 'bed'); });
test('302: Poplar Planks placement plans as simple block', () => { const def = item('poplar_planks'); const d = planBlockPlacement({ item: def, target: target(1), placeBlockId: def.placeBlockId, playerOccupiedCells: [] }, world); assert.equal(d.ok, true); if (d.ok) assert.equal(d.plan.kind, 'simple'); });
test('303: wool slabs enter slab placement semantics', () => { const def = item('red_wool_slab'); const d = planBlockPlacement({ item: def, target: target(1), placeBlockId: def.placeBlockId, playerOccupiedCells: [] }, world); assert.equal(d.ok, true); if (d.ok) assert.equal(d.plan.kind, 'slab'); });
test('304: high runtime IDs avoid legacy low-bit support collisions', () => { BlockRegistry.registerDataPackBlocks([{ id: 60019, name: 'runtime_test_block', textureKey: 'stone', baseId: 60019 }]); ItemRegistry.registerDataPackItems([{ id: 60019, name: 'runtime_test_block', displayName: 'Runtime Test Block', category: 'block', placeBlockId: 60019 }]); const def = item('runtime_test_block'); const d = planBlockPlacement({ item: def, target: target(1), placeBlockId: 60019, playerOccupiedCells: [] }, world); assert.equal(d.ok, true); });
test('305: Straw Bed sleeps in Overworld without setting spawn', () => assert.deepEqual(useStrawBed('overworld'), { canSleep: true, setsSpawn: false, destroyAfterUse: true }));
test('306: Straw Bed is destroyed but cannot sleep in Nether', () => { const r = useStrawBed('nether'); assert.equal(r.canSleep, false); assert.equal(r.destroyAfterUse, true); assert.equal(r.setsSpawn, false); });
test('307: Cushion placement accepts supported flat top', () => { const seats = new CushionSeatSystem26_3(); assert.ok(seats.place({ hitX: 3.2, hitZ: 4.8, supportTopY: 65, flatSurface: true, supportingBlock: true, color: 'blue' }, '3,64,4')); });
test('308: Cushion placement rejects unsupported surfaces', () => { const seats = new CushionSeatSystem26_3(); assert.equal(seats.place({ hitX: 0, hitZ: 0, supportTopY: 1, flatSurface: false, supportingBlock: true, color: 'red' }, 'x'), null); });
test('309: Cushion rejects duplicate placement position', () => { const seats = new CushionSeatSystem26_3(); const req = { hitX: 1.2, hitZ: 2.2, supportTopY: 70, flatSurface: true, supportingBlock: true, color: 'white' as const }; assert.ok(seats.place(req, 'support')); assert.equal(seats.place(req, 'support'), null); });
test('310: behavior registry dispatches Straw Bed through block_item', () => { const behaviors = new BehaviorRegistry(); behaviors.registerItem('block_item', { id: 'minecraft:block_item', use: () => ({ handled: true }) }); const def = item('straw_bed'); assert.equal(behaviors.useItem({ item: def, stack: { id: def.id, count: 1 } })?.handled, true); });

assert.equal(CUSHION_ITEMS.length, 16);
