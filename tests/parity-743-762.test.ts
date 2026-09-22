import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ItemRegistry } from '../src/items/ItemRegistry';
import { inferItemBehaviorId } from '../src/world/BehaviorIds';
import { cloneItemStack } from '../src/items/ItemStackRules';
import { findCraftingResult } from '../src/items/CraftingRecipes';
import { localizeItemDisplayName } from '../src/i18nItemNames';
import {
  BUNDLE_CAPACITY,
  BUNDLE_NESTED_BASE_WEIGHT,
  BUNDLE_TOOLTIP_MAX_VISIBLE_TYPES,
  bundleCanAccept,
  bundleFullnessFraction,
  bundleRemainingCapacity,
  bundleUnitWeight,
  bundleUsedCapacity,
  insertIntoBundle,
  isBundleItemName,
  isBundleStack,
  isShulkerBoxStack,
  removeOneFromBundle,
  visibleBundleContents,
} from '../src/items/BundleRules';
import { parseServerBundleAction } from '../src/server/BundleActionRules';
import { PacketType } from '../src/server/NetworkProtocol';

const bundleId = () => ItemRegistry.getByName('bundle')!.id;

test('743: all 17 canonical Bundle variants are registered and share the Bundle behavior', () => {
  const bundles = ItemRegistry.all().filter((item) => isBundleItemName(item.name));
  assert.equal(bundles.length, 17);
  assert.equal(inferItemBehaviorId('bundle'), 'minecraft:bundle');
  assert.equal(inferItemBehaviorId('red_bundle'), 'minecraft:bundle');
  for (const bundle of bundles) {
    assert.equal(bundle.maxStackSize, 1);
    assert.equal(bundle.behaviorId, 'minecraft:bundle');
  }
});

test('744: Bundle contents survive deep ItemStack cloning without aliasing nested components', () => {
  const original = {
    id: bundleId(),
    count: 1,
    bundleContents: [
      { id: 340, count: 1, book: { title: 'Notes', pages: ['one', 'two'] } },
      { id: 264, count: 3 },
    ],
  };
  const cloned = cloneItemStack(original)!;
  assert.deepEqual(cloned, original);
  assert.notEqual(cloned.bundleContents, original.bundleContents);
  assert.notEqual(cloned.bundleContents?.[0], original.bundleContents[0]);
  assert.notEqual(cloned.bundleContents?.[0].book, original.bundleContents[0].book);
});

test('745: ordinary 64-stack items consume one Bundle capacity unit each', () => {
  const bundle = { id: bundleId(), count: 1 };
  const stone = ItemRegistry.getByName('stone') ?? ItemRegistry.get(1);
  assert.ok(stone);
  assert.equal(BUNDLE_CAPACITY, 64);
  assert.equal(bundleUnitWeight({ id: stone!.id, count: 1 }), 1);
  const inserted = insertIntoBundle(bundle, { id: stone!.id, count: 64 });
  assert.equal(inserted.insertedCount, 64);
  assert.equal(bundleUsedCapacity(inserted.bundle), 64);
  assert.equal(bundleRemainingCapacity(inserted.bundle), 0);
  assert.equal(bundleFullnessFraction(inserted.bundle), 1);
});

test('746: 16-stack items weigh four and unstackable items weigh sixty-four', () => {
  const snowball = ItemRegistry.getByName('snowball');
  const ironSword = ItemRegistry.getByName('iron_sword');
  assert.ok(snowball && ironSword);
  assert.equal(ItemRegistry.getMaxStackSize(snowball!.id), 16);
  assert.equal(bundleUnitWeight({ id: snowball!.id, count: 1 }), 4);
  assert.equal(bundleUnitWeight({ id: ironSword!.id, count: 1 }), 64);
  const bundle = { id: bundleId(), count: 1 };
  assert.equal(insertIntoBundle(bundle, { id: snowball!.id, count: 20 }).insertedCount, 16);
});

test('747: nested Bundles add their four-unit storage weight plus current contents', () => {
  assert.equal(BUNDLE_NESTED_BASE_WEIGHT, 4);
  const diamond = ItemRegistry.getByName('diamond')!;
  const inner = insertIntoBundle(
    { id: bundleId(), count: 1 },
    { id: diamond.id, count: 5 },
  ).bundle;
  assert.equal(bundleUsedCapacity(inner), 5);
  assert.equal(bundleUnitWeight(inner), 9);
  const outer = insertIntoBundle({ id: bundleId(), count: 1 }, inner);
  assert.equal(outer.insertedCount, 1);
  assert.equal(bundleUsedCapacity(outer.bundle), 9);
});

test('748: Shulker Boxes are explicitly excluded from Bundle storage', () => {
  const shulker = ItemRegistry.getByName('white_shulker_box');
  assert.ok(shulker);
  const stack = { id: shulker!.id, count: 1 };
  assert.equal(isShulkerBoxStack(stack), true);
  assert.equal(bundleCanAccept({ id: bundleId(), count: 1 }, stack), false);
  assert.equal(insertIntoBundle({ id: bundleId(), count: 1 }, stack).insertedCount, 0);
});

test('749: Bundle insertion merges compatible items, moves the touched type to the front, and respects capacity', () => {
  const diamond = ItemRegistry.getByName('diamond')!;
  const emerald = ItemRegistry.getByName('emerald')!;
  let bundle = insertIntoBundle({ id: bundleId(), count: 1 }, { id: diamond.id, count: 10 }).bundle;
  bundle = insertIntoBundle(bundle, { id: emerald.id, count: 5 }).bundle;
  bundle = insertIntoBundle(bundle, { id: diamond.id, count: 7 }).bundle;
  assert.equal(bundle.bundleContents?.[0].id, diamond.id);
  assert.equal(bundle.bundleContents?.[0].count, 17);
  assert.equal(bundleUsedCapacity(bundle), 22);
});

test('750: selecting a Bundle entry removes exactly one item and keeps its modeled components', () => {
  const written = ItemRegistry.getByName('written_book') ?? ItemRegistry.getByName('writable_book');
  const diamond = ItemRegistry.getByName('diamond')!;
  assert.ok(written);
  const bundle = {
    id: bundleId(),
    count: 1,
    bundleContents: [
      { id: diamond.id, count: 4 },
      { id: written!.id, count: 1, book: { title: 'Archive', pages: ['kept'] } },
    ],
  };
  const removed = removeOneFromBundle(bundle, 1);
  assert.equal(removed.removed?.id, written!.id);
  assert.equal(removed.removed?.count, 1);
  assert.equal(removed.removed?.book?.title, 'Archive');
  assert.equal(removed.bundle.bundleContents?.length, 1);
});

test('751: Bundle crafting uses one String above one Leather and all sixteen dyed variants have recipes', () => {
  const result = findCraftingResult([
    287, 0, 0,
    334, 0, 0,
    0, 0, 0,
  ]);
  assert.equal(result?.id, bundleId());

  const recipes = JSON.parse(readFileSync(new URL('../src/items/data/recipes.json', import.meta.url), 'utf8'));
  const colored = ItemRegistry.all().filter((item) => item.name.endsWith('_bundle'));
  assert.equal(colored.length, 16);
  for (const item of colored) assert.ok(Array.isArray(recipes[String(item.id)]) && recipes[String(item.id)].length > 0);
});

test('752: Bundle names localize naturally for the base and colored variants', () => {
  assert.equal(localizeItemDisplayName('zh-CN', 'bundle', 'Bundle'), '收纳袋');
  assert.equal(localizeItemDisplayName('zh-CN', 'red_bundle', 'Red Bundle'), '红色收纳袋');
  assert.equal(localizeItemDisplayName('zh-TW', 'blue_bundle', 'Blue Bundle'), '藍色收納袋');
});

test('753: Inventory left-click routes a cursor item into a Bundle through shared rules', () => {
  const source = readFileSync(new URL('../src/ui/InventoryUI.tsx', import.meta.url), 'utf8');
  const start = source.indexOf('if (heldItem && slotItem && isBundleStack(slotItem))');
  const end = source.indexOf('if (heldItem && slotItem && heldItem.id === slotItem.id)', start);
  const branch = source.slice(start, end);
  assert.ok(branch.includes('insertIntoBundle(slotItem, heldItem)'));
  assert.ok(branch.includes("'insert_from_slot'"));
  assert.ok(branch.includes('heldOriginSlot'));
});

test('754: Inventory right-click removes the selected Bundle item and wheel changes selection', () => {
  const source = readFileSync(new URL('../src/ui/InventoryUI.tsx', import.meta.url), 'utf8');
  const context = source.slice(
    source.indexOf('const handleBundleContextMenu'),
    source.indexOf('const handleBundleWheel'),
  );
  assert.ok(context.includes('removeOneFromBundle'));
  assert.ok(context.includes("'extract_to_inventory'"));
  const wheel = source.slice(
    source.indexOf('const handleBundleWheel'),
    source.indexOf('const handleArmorSlotClick'),
  );
  assert.ok(wheel.includes('visibleBundleContents'));
  assert.ok(wheel.includes('e.deltaY'));
});

test('755: Bundle tooltip exposes up to twelve visible types and a used/64 fullness indicator', () => {
  assert.equal(BUNDLE_TOOLTIP_MAX_VISIBLE_TYPES, 12);
  const diamond = ItemRegistry.getByName('diamond')!;
  const bundle = {
    id: bundleId(),
    count: 1,
    bundleContents: Array.from({ length: 15 }, (_, i) => ({ id: diamond.id, count: 1, customName: String(i) })),
  };
  assert.equal(visibleBundleContents(bundle).length, 12);
  const source = readFileSync(new URL('../src/ui/InventoryUI.tsx', import.meta.url), 'utf8');
  assert.ok(source.includes('bundleUsedCapacity(hoveredSlot.item)'));
  assert.ok(source.includes('BUNDLE_CAPACITY'));
  assert.ok(source.includes('bundleFullnessFraction(hoveredSlot.item)'));
});

test('756: Bundle has recognizable inventory and held fallback visuals for every color', () => {
  const atlas = readFileSync(new URL('../src/engine/TextureAtlas.ts', import.meta.url), 'utf8');
  assert.ok(atlas.includes("name === 'bundle' || name.endsWith('_bundle')"));
  assert.ok(atlas.includes("const cloth = dyeColors[dye] ?? '#9a7448'"));
  const player = readFileSync(new URL('../src/player/Player.ts', import.meta.url), 'utf8');
  assert.ok(player.includes("body.name = 'bundle_body'"));
  assert.ok(player.includes("tie.name = 'bundle_tie'"));
});

test('757: Bundle insert, remove and drop actions prefer dedicated resource sounds', () => {
  const source = readFileSync(new URL('../src/systems/SoundSystem.ts', import.meta.url), 'utf8');
  assert.ok(source.includes("'item.bundle.insert'"));
  assert.ok(source.includes("'item.bundle.remove_one'"));
  assert.ok(source.includes("'item.bundle.drop_contents'"));
  const network = readFileSync(new URL('../src/server/NetworkClient.ts', import.meta.url), 'utf8');
  assert.ok(network.includes("'bundle_insert'"));
  assert.ok(network.includes("'bundle_remove'"));
  assert.ok(network.includes("'bundle_drop'"));
});

test('758: held Bundle right-click removes one top item, preserves its components, and drops the full stack locally', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const start = source.indexOf('private tryEmptyBundleInHand');
  const end = source.indexOf('private tryThrowWindCharge', start);
  const method = source.slice(start, end);
  assert.ok(method.includes('removeOneFromBundle(stack, 0)'));
  assert.ok(method.includes('this.droppedItems.spawnStack(result.removed'));
  assert.ok(method.includes("action: 'drop_one'"));
  assert.ok(method.includes('this.inventory.setSlot(this.player.selectedSlot, result.bundle)'));
});

test('759: Bundle network intents validate slots, selected indices, and action kind', () => {
  assert.deepEqual(parseServerBundleAction({ action: 'drop_one', bundleSlot: 2, selectedIndex: 0 }), {
    action: 'drop_one', bundleSlot: 2, selectedIndex: 0,
  });
  assert.deepEqual(parseServerBundleAction({ action: 'insert_from_slot', bundleSlot: 2, sourceSlot: 5 }), {
    action: 'insert_from_slot', bundleSlot: 2, sourceSlot: 5,
  });
  assert.equal(parseServerBundleAction({ action: 'insert_from_slot', bundleSlot: 2, sourceSlot: 2 }), null);
  assert.equal(parseServerBundleAction({ action: 'drop_one', bundleSlot: 36, selectedIndex: 0 }), null);
  assert.equal(parseServerBundleAction({ action: 'bogus', bundleSlot: 2, selectedIndex: 0 }), null);
  assert.equal(PacketType.C2S_BUNDLE_ACTION, 'C2S_BUNDLE_ACTION');
});

test('760: server Bundle insert/remove/drop transactions derive state from authoritative inventory', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const start = source.indexOf('case PacketType.C2S_BUNDLE_ACTION');
  const end = source.indexOf('case PacketType.C2S_BRUSH_ACTION', start);
  const handler = source.slice(start, end);
  assert.ok(handler.includes('session.inventory[intent.bundleSlot]'));
  assert.ok(handler.includes('insertIntoBundle(bundle, source)'));
  assert.ok(handler.includes('removeOneFromBundle(bundle, intent.selectedIndex)'));
  assert.ok(handler.includes('this.syncPlayerInventory(session)'));
  assert.ok(handler.includes('intent.bundleSlot !== session.selectedSlot'));
});

test('761: multiplayer Bundle extraction is transactional and cannot lose an item into a full inventory', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const start = source.indexOf('case PacketType.C2S_BUNDLE_ACTION');
  const end = source.indexOf('case PacketType.C2S_BRUSH_ACTION', start);
  const handler = source.slice(start, end);
  assert.ok(handler.includes('const nextInventory = session.inventory.map((entry) => cloneItemStack(entry))'));
  assert.ok(handler.includes('insertItemStackIntoSlots(nextInventory, result.removed)'));
  assert.ok(handler.includes('if (inserted.inserted === result.removed.count && !inserted.remaining)'));
  assert.ok(handler.includes('session.inventory = nextInventory'));
});

test('762: Inventory UI return/drop paths preserve complete ItemStack components instead of flattening id/count', () => {
  const ui = readFileSync(new URL('../src/ui/InventoryUI.tsx', import.meta.url), 'utf8');
  const closeStart = ui.indexOf('const handleClose = useCallback');
  const closeEnd = ui.indexOf('// Close on E or Escape key', closeStart);
  assert.ok(ui.slice(closeStart, closeEnd).includes('inventory.addStack(heldItem)'));
  assert.ok(ui.includes('if (onDropStack) onDropStack({ ...heldItem, count: dropCount })'));
  const game = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const dropStart = game.indexOf('dropStackFromUI');
  const dropEnd = game.indexOf('dropItemFromUI', dropStart);
  assert.ok(game.slice(dropStart, dropEnd).includes('this.droppedItems.spawnStack(stack'));
});
