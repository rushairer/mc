import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BlockRegistry } from '../src/world/BlockRegistry';
import { inferBlockBehaviorId } from '../src/world/BehaviorIds';
import { ItemRegistry } from '../src/items/ItemRegistry';
import { findCraftingResult } from '../src/items/CraftingRecipes';
import { localizeItemDisplayName } from '../src/i18nItemNames';
import { VisualResolver } from '../src/visual/VisualResolver';
import { getFuelBurnTime } from '../src/items/SmeltingRecipes';
import {
  CHISELED_BOOKSHELF_SLOT_COUNT,
  chiseledBookshelfComparatorSignal,
  chiseledBookshelfOccupancyMask,
  craftChiseledBookshelf,
  createChiseledBookshelfMetadata,
  firstChiseledBookshelfExtractionSlot,
  firstChiseledBookshelfInsertionSlot,
  interactChiseledBookshelfSlot,
  isChiseledBookshelfBook,
  oppositeHorizontalFacing,
  resolveChiseledBookshelfSlot,
} from '../src/items/ChiseledBookshelfRules';
import {
  getHopperInsertionSlots,
  getHopperTargetSlotLimit,
} from '../src/systems/HopperSystem';

const block = (name: string) => {
  const def = BlockRegistry.getByName(name);
  assert.ok(def, name);
  return def;
};
const item = (name: string) => {
  const def = ItemRegistry.getByName(name);
  assert.ok(def, name);
  return def;
};

test('783: Chiseled Bookshelf is a placeable functional block with dedicated behavior', () => {
  const shelf = block('chiseled_bookshelf');
  assert.equal(inferBlockBehaviorId(shelf.name), 'minecraft:chiseled_bookshelf');
  const shelfItem = ItemRegistry.get(shelf.id);
  assert.ok(shelfItem);
  assert.equal(shelfItem!.placeBlockId, shelf.id);
  assert.equal(shelfItem!.maxStackSize, 64);
});

test('784: Java book families accepted by Chiseled Bookshelf preserve unsupported-item rejection', () => {
  for (const name of ['book', 'writable_book', 'written_book', 'enchanted_book', 'knowledge_book']) {
    const def = item(name);
    assert.equal(isChiseledBookshelfBook({ id: def.id, count: 1 }), true, name);
  }
  assert.equal(isChiseledBookshelfBook({ id: item('paper').id, count: 1 }), false);
});

test('785: six planks plus three wooden slabs craft one Chiseled Bookshelf', () => {
  const planks = ItemRegistry.get(5)!;
  const slab = ItemRegistry.get(126)!;
  assert.ok(planks && slab);
  const result = craftChiseledBookshelf([
    { id: planks.id, count: 1 }, { id: planks.id, count: 1 }, { id: planks.id, count: 1 },
    { id: slab.id, count: 1 }, { id: slab.id, count: 1 }, { id: slab.id, count: 1 },
    { id: planks.id, count: 1 }, { id: planks.id, count: 1 }, { id: planks.id, count: 1 },
  ]);
  assert.equal(result?.id, block('chiseled_bookshelf').id);
  assert.equal(result?.count, 1);
});

test('786: mixed modern wood recipe path is accepted while a stone slab is rejected', () => {
  const legacyPlanks = ItemRegistry.get(5)!;
  const sprucePlanks = block('spruce_planks');
  const spruceSlab = block('spruce_slab');
  const stoneSlab = ItemRegistry.get(44)!;
  const mixed = [
    legacyPlanks.id, sprucePlanks.id, legacyPlanks.id,
    spruceSlab.id, 126, spruceSlab.id,
    sprucePlanks.id, legacyPlanks.id, sprucePlanks.id,
  ];
  assert.equal(findCraftingResult(mixed)?.id, block('chiseled_bookshelf').id);
  const invalid = [...mixed];
  invalid[4] = stoneSlab.id;
  assert.notEqual(findCraftingResult(invalid)?.id, block('chiseled_bookshelf').id);
});

test('787: fresh Chiseled Bookshelf metadata owns six empty slots and faces opposite placement direction', () => {
  assert.equal(CHISELED_BOOKSHELF_SLOT_COUNT, 6);
  const meta = createChiseledBookshelfMetadata(oppositeHorizontalFacing('north'));
  assert.equal(meta.facing, 'south');
  assert.equal(meta.containerType, 'chiseled_bookshelf');
  assert.equal(meta.inventory?.length, 6);
  assert.deepEqual(meta.inventory, [null, null, null, null, null, null]);
  assert.equal(meta.chiseledBookshelfLastInteractedSlot, undefined);
});

test('788: south-facing front resolves upper 1-3 and lower 4-6 from exact hit points', () => {
  const pos = { x: 10, y: 64, z: 20 };
  assert.equal(resolveChiseledBookshelfSlot(pos, 'south', 'south', { x: 10.1, y: 64.8, z: 21 }), 0);
  assert.equal(resolveChiseledBookshelfSlot(pos, 'south', 'south', { x: 10.5, y: 64.8, z: 21 }), 1);
  assert.equal(resolveChiseledBookshelfSlot(pos, 'south', 'south', { x: 10.9, y: 64.8, z: 21 }), 2);
  assert.equal(resolveChiseledBookshelfSlot(pos, 'south', 'south', { x: 10.1, y: 64.2, z: 21 }), 3);
  assert.equal(resolveChiseledBookshelfSlot(pos, 'south', 'south', { x: 10.5, y: 64.2, z: 21 }), 4);
  assert.equal(resolveChiseledBookshelfSlot(pos, 'south', 'south', { x: 10.9, y: 64.2, z: 21 }), 5);
});

test('789: slot mapping rotates with facing and rejects non-front faces or forged outside hits', () => {
  const pos = { x: 0, y: 10, z: 0 };
  assert.equal(resolveChiseledBookshelfSlot(pos, 'north', 'north', { x: 0.9, y: 10.8, z: 0 }), 0);
  assert.equal(resolveChiseledBookshelfSlot(pos, 'west', 'west', { x: 0, y: 10.8, z: 0.1 }), 0);
  assert.equal(resolveChiseledBookshelfSlot(pos, 'east', 'east', { x: 1, y: 10.8, z: 0.9 }), 0);
  assert.equal(resolveChiseledBookshelfSlot(pos, 'south', 'north', { x: 0.1, y: 10.8, z: 1 }), null);
  assert.equal(resolveChiseledBookshelfSlot(pos, 'south', 'south', { x: 4, y: 10.8, z: 1 }), null);
});

test('790: targeted insertion consumes exactly one book and preserves full book components', () => {
  const written = item('written_book');
  const held = {
    id: written.id,
    count: 3,
    customName: 'Archive',
    book: { title: 'Field Notes', author: 'Alex', pages: ['one', 'two'], signed: true },
  };
  const result = interactChiseledBookshelfSlot(createChiseledBookshelfMetadata('south'), 4, held, false);
  assert.equal(result.changed, true);
  assert.equal(result.slot, 4);
  assert.equal(result.metadata.inventory?.[4]?.count, 1);
  assert.equal(result.metadata.inventory?.[4]?.book?.pages[1], 'two');
  assert.equal(result.metadata.inventory?.[4]?.customName, 'Archive');
  assert.equal(result.held?.count, 2);
  assert.equal(result.metadata.chiseledBookshelfLastInteractedSlot, 4);
});

test('791: occupied slot removes its book even while another book is held', () => {
  const stored = {
    id: item('enchanted_book').id,
    count: 1,
    customName: 'Silk Archive',
    enchantments: [{ id: 'silk_touch' as const, level: 1 }],
  };
  const meta = createChiseledBookshelfMetadata('south', [stored, null, null, null, null, null]);
  const held = { id: item('book').id, count: 7 };
  const result = interactChiseledBookshelfSlot(meta, 0, held, false);
  assert.equal(result.changed, true);
  assert.equal(result.metadata.inventory?.[0], null);
  assert.equal(result.removed?.customName, 'Silk Archive');
  assert.equal(result.removed?.enchantments?.[0]?.id, 'silk_touch');
  assert.equal(result.held?.count, 7);
  assert.equal(result.metadata.chiseledBookshelfLastInteractedSlot, 0);
});

test('792: empty slot ignores non-books and invalid slots without mutating last-interaction memory', () => {
  const meta = createChiseledBookshelfMetadata('south');
  const paper = { id: item('paper').id, count: 5 };
  const invalidItem = interactChiseledBookshelfSlot(meta, 2, paper, false);
  assert.equal(invalidItem.changed, false);
  assert.equal(invalidItem.metadata.chiseledBookshelfLastInteractedSlot, undefined);
  const invalidSlot = interactChiseledBookshelfSlot(meta, 99, { id: item('book').id, count: 1 }, false);
  assert.equal(invalidSlot.changed, false);
  assert.equal(invalidSlot.metadata.inventory?.every((entry) => entry === null), true);
});

test('793: comparator memory is slot-based, starts at zero, and persists after removal', () => {
  let meta = createChiseledBookshelfMetadata('south');
  assert.equal(chiseledBookshelfComparatorSignal(meta), 0);
  const inserted = interactChiseledBookshelfSlot(meta, 5, { id: item('book').id, count: 1 }, false);
  meta = inserted.metadata;
  assert.equal(chiseledBookshelfComparatorSignal(meta), 6);
  const removed = interactChiseledBookshelfSlot(meta, 5, null, false);
  assert.equal(chiseledBookshelfComparatorSignal(removed.metadata), 6);
  assert.equal(chiseledBookshelfOccupancyMask(removed.metadata), 0);
});

test('794: raycasting exposes exact hitPoint and block interaction context propagates it', () => {
  const player = readFileSync(new URL('../src/player/Player.ts', import.meta.url), 'utf8');
  assert.ok(player.includes('hitPoint: pos.clone()'));
  const game = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  assert.ok(game.includes('const { blockPos, faceNormal, hitPoint } = this.targetBlock'));
  assert.ok(game.includes('hitPoint: { x: hitPoint.x, y: hitPoint.y, z: hitPoint.z }'));
});

test('795: local Chiseled Bookshelf interaction derives target slot and sends hit coordinates in multiplayer', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  assert.ok(source.includes("id: 'minecraft:chiseled_bookshelf'"));
  const start = source.indexOf('private tryInteractChiseledBookshelf');
  const end = source.indexOf('private tryInsertDecoratedPot', start);
  const method = source.slice(start, end);
  assert.ok(method.includes('resolveChiseledBookshelfSlot('));
  assert.ok(method.includes('hitX: target.hitPoint?.x'));
  assert.ok(method.includes('interactChiseledBookshelfSlot('));
  assert.ok(method.includes('this.inventory.addStack(result.removed)'));
});

test('796: server recomputes shelf slot from facing and hit point instead of accepting a client slot number', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const start = source.indexOf("if (blockName === 'chiseled_bookshelf')");
  const end = source.indexOf("if (blockName === 'decorated_pot')", start);
  const method = source.slice(start, end);
  assert.ok(method.includes('resolveChiseledBookshelfSlot('));
  assert.ok(method.includes('hitX'));
  assert.ok(method.includes('hitY'));
  assert.ok(method.includes('hitZ'));
  assert.equal(method.includes('packet.payload.slot'), false);
  assert.ok(method.includes('insertItemStackIntoSlots(nextInventory, result.removed)'));
});

test('797: placement faces the Chiseled Bookshelf opposite the player on both client and server', () => {
  assert.equal(oppositeHorizontalFacing('north'), 'south');
  assert.equal(oppositeHorizontalFacing('east'), 'west');
  const game = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  assert.ok(game.includes("if (name === 'chiseled_bookshelf')"));
  assert.ok(game.includes('oppositeHorizontalFacing(this.getPlayerHorizontalFacing())'));
  const server = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  assert.ok(server.includes("block?.name === 'chiseled_bookshelf'"));
  assert.ok(server.includes('createChiseledBookshelfMetadata(oppositeHorizontalFacing(playerFacing))'));
});

test('798: Hopper automation accepts only books, caps shelf slots at one, and uses first available slots', () => {
  const book = { id: item('book').id, count: 1 };
  const paper = { id: item('paper').id, count: 1 };
  assert.deepEqual(getHopperInsertionSlots('chiseled_bookshelf', 'top', book), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(getHopperInsertionSlots('chiseled_bookshelf', 'side', paper), []);
  assert.equal(getHopperTargetSlotLimit('chiseled_bookshelf', 4, book.id), 1);

  const meta = createChiseledBookshelfMetadata('south', [book, null, null, null, null, null]);
  assert.equal(firstChiseledBookshelfInsertionSlot(meta, book), 1);
  assert.equal(firstChiseledBookshelfExtractionSlot(meta), 0);
});

test('799: automated shelf transfers update last-slot memory and notify Observer-compatible block changes', () => {
  const source = readFileSync(new URL('../src/systems/HopperSystem.ts', import.meta.url), 'utf8');
  assert.ok(source.includes("targetMeta.containerType === 'chiseled_bookshelf'"));
  assert.ok(source.includes('targetMeta.chiseledBookshelfLastInteractedSlot = bookshelfInsertionSlot'));
  assert.ok(source.includes("aboveMeta.containerType === 'chiseled_bookshelf'"));
  assert.ok(source.includes('aboveMeta.chiseledBookshelfLastInteractedSlot = slotIdx'));
  assert.ok(source.includes('this.onBlockChange(targetPos.x, targetPos.y, targetPos.z)'));
  const game = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  assert.ok(game.includes('(x, y, z) => this.redstone.observeBlockChange(x, y, z)'));
});

test('800: Redstone comparator reads Chiseled Bookshelf last-interacted slot instead of inventory fullness', () => {
  const source = readFileSync(new URL('../src/systems/RedstoneSystem.ts', import.meta.url), 'utf8');
  const start = source.indexOf('private getContainerSignal');
  const end = source.indexOf('private getFacingDirection', start);
  const method = source.slice(start, end);
  const shelf = method.indexOf("meta.containerType === 'chiseled_bookshelf'");
  const generic = method.indexOf('let sumCounts = 0');
  assert.ok(shelf >= 0 && shelf < generic);
  assert.ok(method.includes('slot + 1'));
});

test('801: breaking drops stored books but returns the shelf block itself only through Silk Touch', () => {
  const game = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const destroyStart = game.indexOf('private destroyBlockAt');
  const destroyEnd = game.indexOf('private restoreRedstoneFromLoadedChunks', destroyStart);
  const local = game.slice(destroyStart, destroyEnd);
  assert.ok(local.includes("def?.name === 'chiseled_bookshelf'"));
  assert.ok(local.includes('if (dropEnchants?.silkTouch)'));
  assert.ok(local.includes('this.droppedItems.spawnStack(slot, dropPos, velocity, 0.5)'));

  const server = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const breakStart = server.indexOf('case PacketType.C2S_BLOCK_BREAK');
  const breakEnd = server.indexOf('case PacketType.C2S_BLOCK_PLACE', breakStart);
  const authoritative = server.slice(breakStart, breakEnd);
  assert.ok(authoritative.includes("blockDef?.name === 'chiseled_bookshelf'"));
  assert.ok(authoritative.includes("EnchantSystem.getLevel(tool, 'silk_touch') > 0"));
  assert.ok(authoritative.includes('this.spawnDroppedStack(stack'));
});

test('802: Chiseled Bookshelf has correct visuals, names, physical stats, and 1.5-item fuel value', () => {
  const shelf = block('chiseled_bookshelf');
  assert.equal(shelf.hardness, 1.5);
  const rawBlocks = JSON.parse(readFileSync(new URL('../src/items/data/blocks.json', import.meta.url), 'utf8'));
  const raw = rawBlocks.find((entry: any) => entry.name === 'chiseled_bookshelf');
  assert.equal(raw?.resistance, 1.5);
  assert.equal(localizeItemDisplayName('zh-CN', 'chiseled_bookshelf', 'Chiseled Bookshelf'), '雕纹书架');
  assert.equal(localizeItemDisplayName('zh-TW', 'chiseled_bookshelf', 'Chiseled Bookshelf'), '雕紋書櫃');
  assert.equal(getFuelBurnTime(shelf.id), 15);

  const meta = createChiseledBookshelfMetadata('south', [null, null, null, null, null, { id: item('book').id, count: 1 }]);
  assert.equal(VisualResolver.getBlockFaceTexture(shelf.id, 4, meta), 'block:chiseled_bookshelf_front_32');
  assert.equal(VisualResolver.getBlockFaceTexture(shelf.id, 5, meta), 'block:chiseled_bookshelf_back');
  const atlas = readFileSync(new URL('../src/engine/TextureAtlas.ts', import.meta.url), 'utf8');
  assert.ok(atlas.includes('for (let mask = 0; mask < 64; mask++)'));
  assert.ok(atlas.includes('chiseled_bookshelf_front_'));

  const network = readFileSync(new URL('../src/server/NetworkClient.ts', import.meta.url), 'utf8');
  assert.ok(network.includes('metadata !== undefined'));
  assert.ok(network.includes('metadata ?? null, true'));
});
