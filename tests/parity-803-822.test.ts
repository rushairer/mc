import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BlockRegistry } from '../src/world/BlockRegistry';
import { inferBlockBehaviorId } from '../src/world/BehaviorIds';
import { ItemRegistry } from '../src/items/ItemRegistry';
import { cloneItemStack } from '../src/items/ItemStackRules';
import {
  SHULKER_BOX_SLOT_COUNT,
  canStoreInShulkerBox,
  createShulkerBoxDropStack,
  createShulkerBoxMetadata,
  isShulkerBoxName,
  isShulkerBoxStack,
  normalizeShulkerBoxContents,
  shulkerBoxOpeningOffset,
} from '../src/items/ShulkerBoxRules';
import { applyServerContainerClick, createContainerSlots } from '../src/server/ContainerRules';
import { getHopperInsertionSlots } from '../src/systems/HopperSystem';
import { localizeItemDisplayName } from '../src/i18nItemNames';

const item = (name: string) => {
  const def = ItemRegistry.getByName(name);
  assert.ok(def, name);
  return def;
};
const block = (name: string) => {
  const def = BlockRegistry.getByName(name);
  assert.ok(def, name);
  return def;
};

test('803: all Java Shulker Box color identities plus uncolored box are recognized', () => {
  const colors = ['white','orange','magenta','light_blue','yellow','lime','pink','gray','light_gray','cyan','purple','blue','brown','green','red','black'];
  assert.equal(isShulkerBoxName('shulker_box'), true);
  for (const color of colors) assert.equal(isShulkerBoxName(`${color}_shulker_box`), true, color);
});

test('804: uncolored Shulker Box is a one-stack placeable modern block item', () => {
  const def = item('shulker_box');
  assert.equal(def.maxStackSize, 1);
  assert.equal(def.placeBlockId, block('shulker_box').id);
});

test('805: light gray Shulker Box uses the canonical modern identity', () => {
  const def = item('light_gray_shulker_box');
  assert.equal(def.officialId, 'minecraft:light_gray_shulker_box');
  assert.equal(def.placeBlockId, block('light_gray_shulker_box').id);
  assert.equal(ItemRegistry.getByName('silver_shulker_box'), undefined);
});

test('806: every colored Shulker Box item maps to its matching placed block', () => {
  const colors = ['white','orange','magenta','light_blue','yellow','lime','pink','gray','light_gray','cyan','purple','blue','brown','green','red','black'];
  for (const color of colors) {
    const name = `${color}_shulker_box`;
    assert.equal(item(name).placeBlockId, block(name).id, name);
  }
});

test('807: fresh Shulker Box metadata owns exactly 27 slots and preserves facing', () => {
  const meta = createShulkerBoxMetadata(null, 'north');
  assert.equal(SHULKER_BOX_SLOT_COUNT, 27);
  assert.equal(meta.containerType, 'shulker_box');
  assert.equal(meta.facing, 'north');
  assert.equal(meta.inventory?.length, 27);
  assert.equal(meta.inventory?.every(slot => slot === null), true);
});

test('808: placed Shulker Box restores carried contents with full stack components', () => {
  const stored = { id: item('written_book').id, count: 1, customName: 'Archive', book: { pages: ['a', 'b'], signed: true } };
  const box = { id: item('purple_shulker_box').id, count: 1, shulkerBoxContents: [stored] };
  const meta = createShulkerBoxMetadata(box, 'up');
  assert.equal(meta.inventory?.[0]?.customName, 'Archive');
  assert.equal(meta.inventory?.[0]?.book?.pages[1], 'b');
  assert.notEqual(meta.inventory?.[0], stored);
});

test('809: breaking a filled Shulker Box returns one box carrying its 27-slot inventory', () => {
  const paper = { id: item('paper').id, count: 12 };
  const meta = createShulkerBoxMetadata(null, 'up');
  meta.inventory![7] = paper;
  const drop = createShulkerBoxDropStack(block('purple_shulker_box').id, meta);
  assert.equal(drop.count, 1);
  assert.equal(isShulkerBoxStack(drop), true);
  assert.equal(drop.shulkerBoxContents?.length, 27);
  assert.equal(drop.shulkerBoxContents?.[7]?.count, 12);
});

test('810: empty Shulker Box drops omit the dynamic contents component', () => {
  const drop = createShulkerBoxDropStack(block('white_shulker_box').id, createShulkerBoxMetadata());
  assert.equal(drop.shulkerBoxContents, undefined);
});

test('811: ItemStack cloning deep-clones Shulker Box contents', () => {
  const original = { id: item('white_shulker_box').id, count: 1, shulkerBoxContents: [{ id: item('paper').id, count: 2 }] };
  const copy = cloneItemStack(original)!;
  copy.shulkerBoxContents![0]!.count = 1;
  assert.equal(original.shulkerBoxContents[0]!.count, 2);
});

test('812: Shulker Boxes cannot store any other Shulker Box', () => {
  assert.equal(canStoreInShulkerBox({ id: item('white_shulker_box').id, count: 1 }), false);
  assert.equal(canStoreInShulkerBox({ id: item('paper').id, count: 1 }), true);
});

test('813: server creates a 27-slot Shulker Box container', () => {
  assert.equal(createContainerSlots('shulker_box').length, 27);
});

test('814: server left-click rejects putting a Shulker Box inside a Shulker Box', () => {
  const nested = { id: item('white_shulker_box').id, count: 1 };
  const next = applyServerContainerClick({
    containerSlots: createContainerSlots('shulker_box'),
    playerSlots: new Array(36).fill(null),
    cursor: nested,
    containerKind: 'shulker_box',
  }, { area: 'container', slotIndex: 0, button: 'left' })!;
  assert.equal(next.containerSlots[0], null);
  assert.equal(next.cursor?.id, nested.id);
});

test('815: server right-click rejects Shulker Box nesting', () => {
  const nested = { id: item('red_shulker_box').id, count: 1 };
  const next = applyServerContainerClick({
    containerSlots: createContainerSlots('shulker_box'),
    playerSlots: new Array(36).fill(null),
    cursor: nested,
    containerKind: 'shulker_box',
  }, { area: 'container', slotIndex: 4, button: 'right' })!;
  assert.equal(next.containerSlots[4], null);
  assert.equal(next.cursor?.id, nested.id);
});

test('816: shift-click cannot route a player Shulker Box into an open Shulker Box', () => {
  const nested = { id: item('blue_shulker_box').id, count: 1 };
  const player = new Array(36).fill(null);
  player[9] = nested;
  const next = applyServerContainerClick({
    containerSlots: createContainerSlots('shulker_box'),
    playerSlots: player,
    cursor: null,
    containerKind: 'shulker_box',
  }, { area: 'player', slotIndex: 9, shift: true })!;
  assert.equal(next.containerSlots.every(slot => slot === null), true);
  assert.equal(next.playerSlots[9]?.id, nested.id);
});

test('817: ordinary stacks still move into Shulker Boxes normally', () => {
  const paper = { id: item('paper').id, count: 8 };
  const next = applyServerContainerClick({
    containerSlots: createContainerSlots('shulker_box'),
    playerSlots: new Array(36).fill(null),
    cursor: paper,
    containerKind: 'shulker_box',
  }, { area: 'container', slotIndex: 0 })!;
  assert.equal(next.containerSlots[0]?.count, 8);
  assert.equal(next.cursor, null);
});

test('818: Hopper automation also refuses Shulker Box nesting', () => {
  const nested = { id: item('cyan_shulker_box').id, count: 1 };
  assert.deepEqual(getHopperInsertionSlots('shulker_box', 'top', nested), []);
  assert.equal(getHopperInsertionSlots('shulker_box', 'side', { id: item('paper').id, count: 1 }), undefined);
});

test('819: Shulker Box opening clearance follows its placed facing', () => {
  assert.deepEqual(shulkerBoxOpeningOffset('up'), { x: 0, y: 1, z: 0 });
  assert.deepEqual(shulkerBoxOpeningOffset('north'), { x: 0, y: 0, z: -1 });
  assert.deepEqual(shulkerBoxOpeningOffset('east'), { x: 1, y: 0, z: 0 });
});

test('820: Shulker Boxes have dedicated block behavior and local open-place-break wiring', () => {
  assert.equal(inferBlockBehaviorId('purple_shulker_box'), 'minecraft:shulker_box');
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  assert.ok(source.includes("id: 'minecraft:shulker_box'"));
  assert.ok(source.includes('createShulkerBoxMetadata(placedStack, facing)'));
  assert.ok(source.includes('createShulkerBoxDropStack(blockId, meta)'));
  assert.ok(source.includes('shulkerBoxOpeningOffset(meta?.facing)'));
});

test('821: server owns Shulker Box contents through open-click-place-break cycles', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  assert.ok(source.includes("kind: 'chest' | 'hopper' | 'shulker_box'"));
  assert.ok(source.includes("containerKind: open.source === 'block' ? open.kind : undefined"));
  assert.ok(source.includes('createShulkerBoxMetadata(held, plan.facing)'));
  assert.ok(source.includes('createShulkerBoxDropStack(blockId'));
  assert.ok(source.includes('this.containerData.delete(key)'));
});

test('822: Shulker Box names and fallback inventory icon are localized and recognizable', () => {
  assert.equal(localizeItemDisplayName('zh-CN', 'shulker_box', 'Shulker Box'), '潜影盒');
  assert.equal(localizeItemDisplayName('zh-TW', 'shulker_box', 'Shulker Box'), '界伏盒');
  const atlas = readFileSync(new URL('../src/engine/TextureAtlas.ts', import.meta.url), 'utf8');
  assert.ok(atlas.includes("name === 'shulker_box' || name.endsWith('_shulker_box')"));
});
