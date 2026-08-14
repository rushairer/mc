import assert from 'node:assert/strict';
import test from 'node:test';
import type { RawRecipe } from '../src/items/CraftingRecipes';
import { ItemRegistry } from '../src/items/ItemRegistry';
import {
  filterRecipeEntries,
  fitsGridSize,
  getAllRecipeBookEntries,
  getRecipeCategory,
  planGridFill,
  type GridFillPlan,
} from '../src/items/RecipeBook';

const stickRecipe: RawRecipe = { inShape: [[5], [5]], result: { id: 280, count: 4 } };
const shapeless: RawRecipe = { ingredients: [1, 1], result: { id: 999, count: 1 } };
const chestRecipe: RawRecipe = {
  inShape: [[5, 5, 5], [5, null, 5], [5, 5, 5]],
  result: { id: 54, count: 1 },
};

function inventoryWith(entries: Array<[number, { id: number; count: number }]>): {
  slotItem: (slot: number) => number | null;
  slotCount: (slot: number) => number;
} {
  const slots = new Map(entries);
  return {
    slotItem: (slot) => slots.get(slot)?.id ?? null,
    slotCount: (slot) => slots.get(slot)?.count ?? 0,
  };
}

function planToString(plan: GridFillPlan | null): string {
  if (!plan) return 'null';
  return JSON.stringify({ grid: plan.grid, moves: plan.moves });
}

// ─── Recipe listing & categories ───

test('recipe book lists all data-driven recipes with categories', () => {
  const entries = getAllRecipeBookEntries();
  assert.ok(entries.length >= 300, `expected 300+ recipes, got ${entries.length}`);
  for (const entry of entries) {
    assert.ok(entry.resultId > 0);
    assert.ok(entry.resultCount >= 1);
    assert.ok(['building', 'tools', 'combat', 'food', 'redstone', 'materials', 'misc'].includes(entry.category));
  }
  // Deduplication: no identical (result, shape) pairs.
  const keys = new Set(entries.map((e) => `${e.resultId}:${e.resultCount}:${JSON.stringify(e.recipe.inShape ?? e.recipe.ingredients)}`));
  assert.equal(keys.size, entries.length);
});

test('derives vanilla-style categories from the result item', () => {
  const planks = ItemRegistry.getByName('planks');
  const stonePick = ItemRegistry.getByName('stone_pickaxe');
  const sword = ItemRegistry.getByName('diamond_sword');
  const bread = ItemRegistry.getByName('bread');
  const redstone = ItemRegistry.getByName('redstone');
  assert.ok(planks && stonePick && sword && bread && redstone);
  assert.equal(getRecipeCategory(planks.id), 'building');
  assert.equal(getRecipeCategory(stonePick.id), 'tools');
  assert.equal(getRecipeCategory(sword.id), 'combat');
  assert.equal(getRecipeCategory(bread.id), 'food');
  assert.equal(getRecipeCategory(redstone.id), 'redstone');
});

// ─── Search & category filtering ───

test('filters recipes by query and category', () => {
  const entries = getAllRecipeBookEntries();
  const nameOf = (id: number) => ItemRegistry.get(id)?.displayName ?? '';

  const swords = filterRecipeEntries(entries, { query: 'sword', category: 'all', nameOf });
  assert.ok(swords.length >= 1);
  assert.ok(swords.every((e) => nameOf(e.resultId).toLowerCase().includes('sword')));

  const building = filterRecipeEntries(entries, { query: '', category: 'building', nameOf });
  assert.ok(building.length >= 1);
  assert.ok(building.every((e) => e.category === 'building'));

  const empty = filterRecipeEntries(entries, { query: 'zzzznomatch', category: 'all', nameOf });
  assert.equal(empty.length, 0);
});

// ─── Grid size fitting ───

test('fitsGridSize checks shaped and shapeless bounds', () => {
  assert.equal(fitsGridSize(stickRecipe, 2), true);
  assert.equal(fitsGridSize(stickRecipe, 3), true);
  assert.equal(fitsGridSize(chestRecipe, 2), false);
  assert.equal(fitsGridSize(chestRecipe, 3), true);
  assert.equal(fitsGridSize(shapeless, 2), true);
  const nine = { ingredients: [1, 1, 1, 1, 1, 1, 1, 1, 1], result: { id: 1, count: 1 } };
  assert.equal(fitsGridSize(nine, 2), false);
  assert.equal(fitsGridSize(nine, 3), true);
});

// ─── Grid fill planning ───

test('plans a shaped 2x2 fill from the inventory', () => {
  const inv = inventoryWith([[0, { id: 5, count: 1 }], [1, { id: 5, count: 1 }]]); // two planks
  const plan = planGridFill(stickRecipe, 2, inv.slotItem, inv.slotCount);
  assert.ok(plan);
  assert.deepEqual(plan!.grid, [5, 0, 5, 0]);
  assert.deepEqual(plan!.moves, [{ fromSlot: 0, itemId: 5, count: 1 }, { fromSlot: 1, itemId: 5, count: 1 }]);
});

test('aggregates multiple cells from one stack', () => {
  const inv = inventoryWith([[3, { id: 5, count: 4 }]]); // one stack of 4 planks
  const plan = planGridFill(stickRecipe, 2, inv.slotItem, inv.slotCount);
  assert.ok(plan);
  assert.equal(planToString(plan), JSON.stringify({ grid: [5, 0, 5, 0], moves: [{ fromSlot: 3, itemId: 5, count: 2 }] }));
});

test('plans shapeless fills in cell order', () => {
  const inv = inventoryWith([[0, { id: 1, count: 1 }], [1, { id: 1, count: 1 }]]);
  const plan = planGridFill(shapeless, 2, inv.slotItem, inv.slotCount);
  assert.ok(plan);
  assert.deepEqual(plan!.grid, [1, 1, 0, 0]);
});

test('returns null when the inventory cannot supply every ingredient', () => {
  const onePlank = inventoryWith([[0, { id: 5, count: 1 }]]);
  assert.equal(planGridFill(stickRecipe, 2, onePlank.slotItem, onePlank.slotCount), null);
  const empty = inventoryWith([]);
  assert.equal(planGridFill(chestRecipe, 3, empty.slotItem, empty.slotCount), null);
});

test('a 3x3 shaped recipe fills its top-left shape in a 3x3 grid', () => {
  const inv = inventoryWith([
    [0, { id: 5, count: 1 }], [1, { id: 5, count: 1 }], [2, { id: 5, count: 1 }],
    [3, { id: 5, count: 1 }], [4, { id: 5, count: 1 }], [5, { id: 5, count: 1 }],
    [6, { id: 5, count: 1 }], [7, { id: 5, count: 1 }],
  ]);
  const plan = planGridFill(chestRecipe, 3, inv.slotItem, inv.slotCount);
  assert.ok(plan);
  assert.deepEqual(plan!.grid, [5, 5, 5, 5, 0, 5, 5, 5, 5]);
});
