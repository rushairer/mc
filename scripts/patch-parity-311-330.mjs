import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, content) { fs.writeFileSync(path, content); }
function replaceOnce(path, before, after) {
  const source = read(path);
  if (!source.includes(before)) throw new Error('Missing patch anchor in ' + path + ': ' + before.slice(0, 100));
  write(path, source.replace(before, after));
}
function appendOnce(path, marker, content) {
  const source = read(path);
  if (source.includes(marker)) return;
  write(path, source.trimEnd() + '\n\n' + content.trim() + '\n');
}

write('src/items/InventoryTransferRules.ts', String.raw`import type { ItemStack } from '../types';
import { cloneItemStack, getItemStackMaxSize, itemStacksCanMerge } from './ItemStackRules';

export interface StackTransferResult {
  moved: number;
  sourceRemaining: number;
}

function validDestinationIndices(slots: (ItemStack | null)[], indices: number[], sourceIndex: number): number[] {
  return indices.filter((index) => Number.isInteger(index) && index >= 0 && index < slots.length && index !== sourceIndex);
}

/** Move one source stack into a destination range, merging before opening empty slots. */
export function moveStackToIndices(
  slots: (ItemStack | null)[],
  sourceIndex: number,
  destinationIndices: number[],
): StackTransferResult {
  if (!Number.isInteger(sourceIndex) || sourceIndex < 0 || sourceIndex >= slots.length) {
    return { moved: 0, sourceRemaining: 0 };
  }
  const source = slots[sourceIndex];
  if (!source || source.count <= 0) return { moved: 0, sourceRemaining: 0 };

  const destinations = validDestinationIndices(slots, destinationIndices, sourceIndex);
  const originalCount = source.count;
  const maxStack = getItemStackMaxSize(source);

  for (const index of destinations) {
    if (source.count <= 0) break;
    const target = slots[index];
    if (!target || !itemStacksCanMerge(target, source)) continue;
    const targetMax = getItemStackMaxSize(target);
    if (target.count >= targetMax) continue;
    const moved = Math.min(source.count, targetMax - target.count);
    target.count += moved;
    source.count -= moved;
  }

  for (const index of destinations) {
    if (source.count <= 0) break;
    if (slots[index]) continue;
    const moved = Math.min(source.count, maxStack);
    const placed = cloneItemStack(source)!;
    placed.count = moved;
    slots[index] = placed;
    source.count -= moved;
  }

  if (source.count <= 0) slots[sourceIndex] = null;
  return { moved: originalCount - Math.max(0, source.count), sourceRemaining: Math.max(0, source.count) };
}

/** Java player inventory quick-move: hotbar <-> main inventory. */
export function quickMovePlayerInventory(slots: (ItemStack | null)[], sourceIndex: number): number {
  if (sourceIndex < 0 || sourceIndex >= 36) return 0;
  const destinationIndices = sourceIndex < 9
    ? Array.from({ length: 27 }, (_, i) => i + 9)
    : Array.from({ length: 9 }, (_, i) => i);
  return moveStackToIndices(slots, sourceIndex, destinationIndices).moved;
}

export interface RightClickStackResult {
  slot: ItemStack | null;
  cursor: ItemStack | null;
  moved: number;
}

/** Place one item from the cursor into an empty or compatible slot. */
export function placeOneFromCursor(
  slot: ItemStack | null,
  cursor: ItemStack | null,
): RightClickStackResult {
  const nextSlot = cloneItemStack(slot);
  const nextCursor = cloneItemStack(cursor);
  if (!nextCursor || nextCursor.count <= 0) return { slot: nextSlot, cursor: null, moved: 0 };

  if (!nextSlot) {
    const placed = cloneItemStack(nextCursor)!;
    placed.count = 1;
    nextCursor.count -= 1;
    return { slot: placed, cursor: nextCursor.count > 0 ? nextCursor : null, moved: 1 };
  }

  if (!itemStacksCanMerge(nextSlot, nextCursor)) {
    return { slot: nextSlot, cursor: nextCursor, moved: 0 };
  }
  const maxStack = getItemStackMaxSize(nextSlot);
  if (nextSlot.count >= maxStack) return { slot: nextSlot, cursor: nextCursor, moved: 0 };
  nextSlot.count += 1;
  nextCursor.count -= 1;
  return { slot: nextSlot, cursor: nextCursor.count > 0 ? nextCursor : null, moved: 1 };
}
`);

write('src/items/ItemUseRules.ts', String.raw`import type { ItemStack } from '../types';
import { ItemRegistry } from './ItemRegistry';

const BOWL_ID = 281;
const BUCKET_ID = 325;
const GLASS_BOTTLE_ID = 374;

const ALWAYS_EDIBLE_NAMES = new Set([
  'golden_apple',
  'enchanted_golden_apple',
  'chorus_fruit',
  'honey_bottle',
]);

const BOWL_REMAINDER_FOODS = new Set([
  'mushroom_stew',
  'beetroot_soup',
  'rabbit_stew',
  'suspicious_stew',
]);

export function isItemAlwaysEdible(stack: ItemStack): boolean {
  if (stack.alwaysEdible) return true;
  const name = ItemRegistry.get(stack.id)?.name;
  return !!name && ALWAYS_EDIBLE_NAMES.has(name);
}

export function canConsumeFoodItem(stack: ItemStack, hunger: number): boolean {
  if (!ItemRegistry.isFood(stack.id)) return false;
  return hunger < 20 || isItemAlwaysEdible(stack);
}

/** Java food use duration in seconds for the modeled inventory items. */
export function getItemUseDurationSeconds(item: number | ItemStack): number {
  const id = typeof item === 'number' ? item : item.id;
  const def = ItemRegistry.get(id);
  if (!def) return 0;
  if (def.name === 'dried_kelp') return 0.8;
  if (def.category === 'food') return 1.6;
  if (def.name === 'potion' || def.name === 'milk_bucket') return 1.6;
  return 0;
}

/** Default container returned after a successful consumable use. */
export function getDefaultUseRemainderItemId(itemId: number): number | undefined {
  const name = ItemRegistry.get(itemId)?.name;
  if (!name) return undefined;
  if (name === 'potion' || name === 'honey_bottle') return GLASS_BOTTLE_ID;
  if (name === 'milk_bucket') return BUCKET_ID;
  if (BOWL_REMAINDER_FOODS.has(name)) return BOWL_ID;
  return undefined;
}

/** Creative placement does not consume the selected stack. */
export function shouldConsumePlacedItem(gameMode: 'survival' | 'creative'): boolean {
  return gameMode !== 'creative';
}
`);

replaceOnce(
  'src/items/ItemStackRules.ts',
  "import type { ItemStack } from '../types';",
  "import type { ItemStack } from '../types';\nimport { ItemRegistry } from './ItemRegistry';",
);
appendOnce('src/items/ItemStackRules.ts', 'export function getItemStackMaxSize', String.raw`
/** Effective Java stack size, clamped and forced to one for damageable items. */
export function getItemStackMaxSize(stack: Pick<ItemStack, 'id' | 'durability'>): number {
  const def = ItemRegistry.get(stack.id);
  if (stack.durability !== undefined || def?.durability !== undefined) return 1;
  return Math.max(1, Math.min(64, ItemRegistry.getMaxStackSize(stack.id)));
}

export function isValidItemStack(stack: ItemStack | null | undefined): boolean {
  if (!stack) return false;
  return Number.isInteger(stack.id)
    && stack.id > 0
    && Number.isInteger(stack.count)
    && stack.count > 0
    && stack.count <= getItemStackMaxSize(stack);
}
`);

replaceOnce(
  'src/items/ItemRegistry.ts',
  `  getMaxStackSize(id: number): number {\n    const item = this.get(id);\n    return item?.maxStackSize ?? 64;\n  },`,
  `  getMaxStackSize(id: number): number {\n    const item = this.get(id);\n    if (!item) return 64;\n    if (item.durability !== undefined) return 1;\n    return Math.max(1, Math.min(64, item.maxStackSize || 64));\n  },`,
);

replaceOnce(
  'src/player/Inventory.ts',
  "import { cloneItemStack, itemStacksCanMerge } from '../items/ItemStackRules';",
  "import { cloneItemStack, getItemStackMaxSize, itemStacksCanMerge } from '../items/ItemStackRules';\nimport { quickMovePlayerInventory } from '../items/InventoryTransferRules';",
);
replaceOnce(
  'src/player/Inventory.ts',
  `    const maxStack = ItemRegistry.getMaxStackSize(stack.id);\n    let remaining = stack.count;`,
  `    const maxStack = getItemStackMaxSize(stack);\n    let remaining = stack.count;`,
);
replaceOnce(
  'src/player/Inventory.ts',
  `  /** Get total armor defense value. */`,
  `  /** Quick-move between hotbar and main inventory. Returns number of moved items. */\n  quickMove(slotIndex: number): number {\n    return quickMovePlayerInventory(this.slots, slotIndex);\n  }\n\n  /** Get total armor defense value. */`,
);

replaceOnce(
  'src/engine/Game.ts',
  "import { ItemRegistry } from '../items/ItemRegistry';",
  "import { ItemRegistry } from '../items/ItemRegistry';\nimport { canConsumeFoodItem, getDefaultUseRemainderItemId, getItemUseDurationSeconds, shouldConsumePlacedItem } from '../items/ItemUseRules';",
);
replaceOnce(
  'src/engine/Game.ts',
  `  private canConsumeFood(stack: ItemStack): boolean {\n    if (!ItemRegistry.isFood(stack.id)) return false;\n    const isGoldenApple = (stack.id & 0x3FF) === 322;\n    return this.player.hunger < 20 || isGoldenApple || stack.id === HONEY_BOTTLE_ID || !!stack.alwaysEdible;\n  }`,
  `  private canConsumeFood(stack: ItemStack): boolean {\n    return canConsumeFoodItem(stack, this.player.hunger);\n  }`,
);
replaceOnce(
  'src/engine/Game.ts',
  `    if (this.eatingTimer < 1.6) return { handled: true };\n\n    this.player.hunger`,
  `    if (this.eatingTimer < getItemUseDurationSeconds(stack)) return { handled: true };\n\n    this.player.hunger`,
);
replaceOnce(
  'src/engine/Game.ts',
  `      if (stack.containerItemId !== undefined) {\n        const containerItemId = stack.containerItemId;`,
  `      const containerItemId = stack.containerItemId ?? getDefaultUseRemainderItemId(stack.id);\n      if (containerItemId !== undefined) {`,
);
replaceOnce(
  'src/engine/Game.ts',
  `    if (this.gameMode !== 'creative') {\n      this.inventory.removeFromSlot(this.player.selectedSlot);\n    }\n    return true;`,
  `    if (shouldConsumePlacedItem(this.gameMode)) {\n      this.inventory.removeFromSlot(this.player.selectedSlot);\n    }\n    return true;`,
);

write('tests/parity-311-330.test.ts', String.raw`import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ItemRegistry } from '../src/items/ItemRegistry';
import { VisualResolver } from '../src/visual/VisualResolver';
import { Inventory } from '../src/player/Inventory';
import { getItemStackMaxSize, isValidItemStack } from '../src/items/ItemStackRules';
import { placeOneFromCursor, quickMovePlayerInventory } from '../src/items/InventoryTransferRules';
import {
  canConsumeFoodItem,
  getDefaultUseRemainderItemId,
  getItemUseDurationSeconds,
  isItemAlwaysEdible,
  shouldConsumePlacedItem,
} from '../src/items/ItemUseRules';

const item = (name: string) => {
  const def = ItemRegistry.getByName(name);
  assert.ok(def, name);
  return def;
};

test('311: every registered item has canonical identity and display name', () => {
  for (const def of ItemRegistry.all()) {
    assert.ok(def.officialId.startsWith('minecraft:'), def.name);
    assert.ok(def.name.length > 0, String(def.id));
    assert.ok(def.displayName.length > 0, def.name);
  }
});

test('312: every registered item resolves a non-unknown inventory icon key', () => {
  for (const def of ItemRegistry.all()) {
    assert.notEqual(VisualResolver.getItemIconKey(def.id), 'item:unknown', def.name);
  }
});

test('313: direct block-category items resolve through the block icon pipeline', () => {
  for (const def of ItemRegistry.all().filter((entry) => entry.category === 'block')) {
    assert.match(VisualResolver.getItemIconKey(def.id), /^icon:block:/, def.name);
  }
});

test('314: registry stack sizes are always inside Java item-stack bounds', () => {
  for (const def of ItemRegistry.all()) {
    const max = ItemRegistry.getMaxStackSize(def.id);
    assert.ok(max >= 1 && max <= 64, def.name + ':' + max);
  }
});

test('315: every damageable item is non-stackable', () => {
  for (const def of ItemRegistry.all().filter((entry) => entry.durability !== undefined)) {
    assert.equal(ItemRegistry.getMaxStackSize(def.id), 1, def.name);
  }
});

test('316: Ender Pearls retain the Java stack limit of 16', () => {
  assert.equal(ItemRegistry.getMaxStackSize(item('ender_pearl').id), 16);
});

test('317: Snowballs retain the Java stack limit of 16', () => {
  assert.equal(ItemRegistry.getMaxStackSize(item('snowball').id), 16);
});

test('318: adding multiple damageable tools splits them into one-per-slot stacks', () => {
  const inventory = new Inventory();
  const pickaxe = item('diamond_pickaxe');
  assert.equal(inventory.addStack({ id: pickaxe.id, count: 2, durability: pickaxe.durability }), null);
  assert.equal(inventory.getSlot(0)?.count, 1);
  assert.equal(inventory.getSlot(1)?.count, 1);
});

test('319: splitSlot preserves stack components while splitting counts', () => {
  const inventory = new Inventory();
  const book = item('book');
  inventory.setSlot(0, { id: book.id, count: 5, enchantments: [{ id: 'unbreaking', level: 1 }] });
  const split = inventory.splitSlot(0);
  assert.equal(split?.count, 3);
  assert.equal(inventory.getSlot(0)?.count, 2);
  assert.deepEqual(split?.enchantments, [{ id: 'unbreaking', level: 1 }]);
});

test('320: quick move transfers a hotbar stack into the main inventory', () => {
  const inventory = new Inventory();
  const stone = item('stone');
  inventory.setSlot(0, { id: stone.id, count: 10 });
  assert.equal(inventory.quickMove(0), 10);
  assert.equal(inventory.getSlot(0), null);
  assert.equal(inventory.getSlot(9)?.count, 10);
});

test('321: quick move transfers a main-inventory stack into the hotbar', () => {
  const inventory = new Inventory();
  const stone = item('stone');
  inventory.setSlot(9, { id: stone.id, count: 10 });
  assert.equal(inventory.quickMove(9), 10);
  assert.equal(inventory.getSlot(9), null);
  assert.equal(inventory.getSlot(0)?.count, 10);
});

test('322: quick move merges compatible stacks before occupying empty slots', () => {
  const slots = new Array(36).fill(null);
  const stone = item('stone');
  slots[0] = { id: stone.id, count: 10 };
  slots[9] = { id: stone.id, count: 60 };
  assert.equal(quickMovePlayerInventory(slots, 0), 10);
  assert.equal(slots[9]?.count, 64);
  assert.equal(slots[10]?.count, 6);
});

test('323: quick move respects per-item stack limits', () => {
  const slots = new Array(36).fill(null);
  const pearl = item('ender_pearl');
  slots[0] = { id: pearl.id, count: 16 };
  slots[9] = { id: pearl.id, count: 15 };
  assert.equal(quickMovePlayerInventory(slots, 0), 16);
  assert.equal(slots[9]?.count, 16);
  assert.equal(slots[10]?.count, 15);
});

test('324: quick move is a no-op when every destination slot is full', () => {
  const slots = new Array(36).fill(null);
  const stone = item('stone');
  slots[0] = { id: stone.id, count: 3 };
  for (let i = 9; i < 36; i++) slots[i] = { id: stone.id, count: 64 };
  assert.equal(quickMovePlayerInventory(slots, 0), 0);
  assert.equal(slots[0]?.count, 3);
});

test('325: right-click placement moves exactly one cursor item into an empty slot', () => {
  const stone = item('stone');
  const result = placeOneFromCursor(null, { id: stone.id, count: 4 });
  assert.equal(result.slot?.count, 1);
  assert.equal(result.cursor?.count, 3);
  assert.equal(result.moved, 1);
});

test('326: right-click placement merges one item and refuses an already-full stack', () => {
  const pearl = item('ender_pearl');
  const merged = placeOneFromCursor({ id: pearl.id, count: 15 }, { id: pearl.id, count: 2 });
  assert.equal(merged.slot?.count, 16);
  assert.equal(merged.cursor?.count, 1);
  const full = placeOneFromCursor({ id: pearl.id, count: 16 }, { id: pearl.id, count: 1 });
  assert.equal(full.moved, 0);
});

test('327: food use duration models fast Dried Kelp and ordinary 1.6 second food', () => {
  assert.equal(getItemUseDurationSeconds(item('dried_kelp').id), 0.8);
  assert.equal(getItemUseDurationSeconds(item('bread').id), 1.6);
});

test('328: full-hunger food use allows Java always-edible items only', () => {
  const golden = { id: item('golden_apple').id, count: 1 };
  const bread = { id: item('bread').id, count: 1 };
  assert.equal(isItemAlwaysEdible(golden), true);
  assert.equal(canConsumeFoodItem(golden, 20), true);
  assert.equal(canConsumeFoodItem(bread, 20), false);
});

test('329: consumable defaults return their Java container item', () => {
  assert.equal(getDefaultUseRemainderItemId(item('potion').id), item('glass_bottle').id);
  assert.equal(getDefaultUseRemainderItemId(item('milk_bucket').id), item('bucket').id);
  assert.equal(getDefaultUseRemainderItemId(item('mushroom_stew').id), item('bowl').id);
});

test('330: placement consumption and live Game use paths are wired to the shared rules', () => {
  assert.equal(shouldConsumePlacedItem('survival'), true);
  assert.equal(shouldConsumePlacedItem('creative'), false);
  assert.equal(getItemStackMaxSize({ id: item('diamond_pickaxe').id }), 1);
  assert.equal(isValidItemStack({ id: item('ender_pearl').id, count: 16 }), true);
  assert.equal(isValidItemStack({ id: item('ender_pearl').id, count: 17 }), false);
  const source = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  assert.ok(source.includes('canConsumeFoodItem(stack, this.player.hunger)'));
  assert.ok(source.includes('getItemUseDurationSeconds(stack)'));
  assert.ok(source.includes('getDefaultUseRemainderItemId(stack.id)'));
  assert.ok(source.includes('shouldConsumePlacedItem(this.gameMode)'));
});
`);

console.log('Applied parity 311-330 item fundamentals phase 2.');
