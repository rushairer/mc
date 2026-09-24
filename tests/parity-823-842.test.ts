import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ItemRegistry } from '../src/items/ItemRegistry';
import { BlockRegistry } from '../src/world/BlockRegistry';
import { inferBlockBehaviorId } from '../src/world/BehaviorIds';
import { findCraftingResult, findCraftingResultFromStacks } from '../src/items/CraftingRecipes';
import {
  craftShulkerBox,
  shulkerBoxDyeColor,
} from '../src/items/ShulkerBoxRules';
import { migrateAndValidateSave, SAVE_SCHEMA_VERSION } from '../src/systems/SaveSystem';
import type { ItemStack } from '../src/types';

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

test('823: component-aware crafting keeps the legacy numeric-grid API compatible', () => {
  const shell = item('shulker_shell').id;
  const chest = item('chest').id;
  const grid = [shell, 0, 0, chest, 0, 0, shell, 0, 0];
  assert.equal(findCraftingResult(grid)?.id, item('shulker_box').id);
});

test('824: two Shulker Shells around a chest craft one undyed Shulker Box', () => {
  const shell = { id: item('shulker_shell').id, count: 1 };
  const chest = { id: item('chest').id, count: 1 };
  const result = craftShulkerBox([shell, null, null, chest, null, null, shell, null, null]);
  assert.equal(result?.id, item('shulker_box').id);
  assert.equal(result?.count, 1);
});

test('825: Shulker Box base recipe is shaped and rejects horizontal shell-chest-shell', () => {
  const shell = { id: item('shulker_shell').id, count: 1 };
  const chest = { id: item('chest').id, count: 1 };
  assert.equal(craftShulkerBox([shell, chest, shell, null, null, null, null, null, null]), null);
});

test('826: modern dye items resolve to canonical Shulker Box colors', () => {
  assert.equal(shulkerBoxDyeColor({ id: item('red_dye').id, count: 1 }), 'red');
  assert.equal(shulkerBoxDyeColor({ id: item('light_blue_dye').id, count: 1 }), 'light_blue');
  assert.equal(shulkerBoxDyeColor({ id: item('black_dye').id, count: 1 }), 'black');
});

test('827: legacy dye aliases also resolve to modern Shulker Box colors', () => {
  assert.equal(shulkerBoxDyeColor({ id: item('rose_red').id, count: 1 }), 'red');
  assert.equal(shulkerBoxDyeColor({ id: item('dandelion_yellow').id, count: 1 }), 'yellow');
  assert.equal(shulkerBoxDyeColor({ id: item('ink_sac').id, count: 1 }), 'black');
});

test('828: dyeing a filled Shulker Box preserves its complete 27-slot contents', () => {
  const source: ItemStack = {
    id: item('white_shulker_box').id,
    count: 1,
    shulkerBoxContents: new Array(27).fill(null),
  };
  source.shulkerBoxContents![12] = { id: item('written_book').id, count: 1, customName: 'Archive', book: { pages: ['one', 'two'], signed: true } };
  const result = findCraftingResultFromStacks([
    source, { id: item('blue_dye').id, count: 1 }, null,
    null, null, null,
    null, null, null,
  ]);
  assert.equal(result?.id, item('blue_shulker_box').id);
  assert.equal(result?.shulkerBoxContents?.length, 27);
  assert.equal(result?.shulkerBoxContents?.[12]?.customName, 'Archive');
  assert.equal(result?.shulkerBoxContents?.[12]?.book?.pages[1], 'two');
});

test('829: dyeing preserves Shulker Box item components such as custom name', () => {
  const source: ItemStack = { id: item('purple_shulker_box').id, count: 1, customName: 'Travel Kit' };
  const result = craftShulkerBox([source, { id: item('orange_dye').id, count: 1 }]);
  assert.equal(result?.id, item('orange_shulker_box').id);
  assert.equal(result?.customName, 'Travel Kit');
});

test('830: player 2x2 crafting grid stores ItemStacks instead of lossy item ids', () => {
  const source = readFileSync(new URL('../src/ui/InventoryUI.tsx', import.meta.url), 'utf8');
  assert.ok(source.includes("useState<(ItemStack | null)[]>(new Array(4).fill(null))"));
  assert.ok(source.includes('findCraftingResultFromStacks(grid3x3)'));
  assert.ok(source.includes('const placed = cloneItemStack(heldItem)!'));
});

test('831: crafting-table 3x3 grid also preserves full ItemStack components', () => {
  const source = readFileSync(new URL('../src/ui/CraftingTableUI.tsx', import.meta.url), 'utf8');
  assert.ok(source.includes("useState<(ItemStack | null)[]>(new Array(9).fill(null))"));
  assert.ok(source.includes('findCraftingResultFromStacks(craftingGrid)'));
  assert.ok(source.includes('const placed = cloneItemStack(heldItem)!'));
});

test('832: closing either crafting surface returns component-bearing stacks with addStack', () => {
  const inventoryUi = readFileSync(new URL('../src/ui/InventoryUI.tsx', import.meta.url), 'utf8');
  const tableUi = readFileSync(new URL('../src/ui/CraftingTableUI.tsx', import.meta.url), 'utf8');
  assert.ok(inventoryUi.includes('if (stack) inventory.addStack(stack)'));
  assert.ok(tableUi.includes('if (stack) inventory.addStack(stack)'));
  assert.equal(tableUi.includes('inventory.addItem(heldItem.id, heldItem.count)'), false);
});

test('833: Ender Chest has a dedicated interactive block behavior', () => {
  assert.equal(inferBlockBehaviorId('ender_chest'), 'minecraft:ender_chest');
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  assert.ok(source.includes("id: 'minecraft:ender_chest'"));
});

test('834: the existing vanilla Ender Chest recipe is eight obsidian around one Eye of Ender', () => {
  const obsidian = item('obsidian').id;
  const eye = item('ender_eye').id;
  const result = findCraftingResult([
    obsidian, obsidian, obsidian,
    obsidian, eye, obsidian,
    obsidian, obsidian, obsidian,
  ]);
  assert.equal(result?.id, item('ender_chest').id);
});

test('835: singleplayer Ender Chest storage is one player-owned 27-slot inventory shared across positions', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  assert.ok(source.includes('private enderChestInventory: (ItemStack | null)[] = new Array(27).fill(null)'));
  assert.ok(source.includes("if (openDef?.name === 'ender_chest') return this.enderChestInventory"));
});

test('836: save validation preserves and pads personal Ender Chest inventory to 27 slots', () => {
  const saved = migrateAndValidateSave({
    schemaVersion: SAVE_SCHEMA_VERSION,
    enderChestInventory: [{ id: item('paper').id, count: 3 }],
    timestamp: 1,
  });
  assert.equal(saved.enderChestInventory?.length, 27);
  assert.equal(saved.enderChestInventory?.[0]?.count, 3);
  assert.equal(saved.enderChestInventory?.[26], null);
});

test('837: local save/load and placement preserve Ender Chest semantics without block-owned inventory', () => {
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  assert.ok(source.includes('enderChestInventory: this.enderChestInventory.map((slot) => cloneItemStack(slot))'));
  assert.ok(source.includes('this.enderChestInventory = (data.enderChestInventory ?? []).slice(0, 27)'));
  assert.ok(source.includes("if (name === 'ender_chest')"));
  assert.ok(source.includes('facing: oppositeHorizontalFacing(this.getPlayerHorizontalFacing())'));
});

test('838: multiplayer gives every player an independent 27-slot Ender Chest inventory', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  assert.ok(source.includes('enderChestInventory: (ItemStack | null)[];'));
  assert.ok(source.includes('enderChestInventory: Array(27).fill(null)'));
  assert.ok(source.includes("if (open.kind === 'ender_chest') return player.enderChestInventory"));
});

test('839: server detects Ender Chest before generic chest matching and never stores it by coordinates', () => {
  const source = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  assert.ok(source.includes("name === 'ender_chest'"));
  assert.ok(source.includes("kind !== 'ender_chest' && !this.containerData.has(key)"));
  assert.ok(source.includes("if (open.kind === 'ender_chest') {"));
});

test('840: Ender Chest placement faces opposite the player on client and server and stays non-automatable', () => {
  const game = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const server = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  assert.ok(game.includes('facing: oppositeHorizontalFacing(this.getPlayerHorizontalFacing())'));
  assert.ok(server.includes("block?.name === 'ender_chest'"));
  assert.ok(server.includes('metadata = { facing: oppositeHorizontalFacing(playerFacing) }'));
  const enderPlacement = game.slice(game.indexOf("if (name === 'ender_chest')"), game.indexOf("if (name === 'chest')", game.indexOf("if (name === 'ender_chest')")));
  assert.equal(enderPlacement.includes('containerType'), false);
});

test('841: blocked lids and Java Silk Touch / eight-obsidian break behavior are enforced locally and on server', () => {
  const game = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const server = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  assert.ok(game.includes("block?.name === 'chest' || block?.name === 'ender_chest'"));
  assert.ok(server.includes("kind === 'ender_chest' && this.isSolidBlock(x, y + 1, z, session.dimension)"));
  assert.ok(game.includes("else if (def?.name === 'ender_chest')"));
  assert.ok(game.includes('this.droppedItems.spawnItem(49, 8'));
  assert.ok(server.includes("silkTouch ? { id: blockDef.id, count: 1 } : { id: 49, count: 8 }"));
});

test('842: Ender Chest has localized UI identity and a dedicated recognizable inventory icon', () => {
  const i18n = readFileSync(new URL('../src/i18n.tsx', import.meta.url), 'utf8');
  const chestUi = readFileSync(new URL('../src/ui/ChestUI.tsx', import.meta.url), 'utf8');
  const atlas = readFileSync(new URL('../src/engine/TextureAtlas.ts', import.meta.url), 'utf8');
  assert.ok(i18n.includes("enderChest: 'Ender Chest'"));
  assert.ok(i18n.includes("enderChest: '末影箱'"));
  assert.ok(i18n.includes("enderChest: '終界箱'"));
  assert.ok(chestUi.includes("| 'enderChest'"));
  assert.ok(atlas.includes("b.name === 'ender_chest'"));
});
