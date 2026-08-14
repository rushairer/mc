import type { ItemDef } from './ItemRegistry';
import { ItemRegistry } from './ItemRegistry';
import { listCraftingRecipes, matchesRecipeCell, type RawRecipe, type RawRecipeCell, type RecipeListItem } from './CraftingRecipes';

/**
 * P3.2 — Recipe book data layer.
 *
 * Pure, testable helpers for browsing crafting recipes (category + search
 * filtering) and planning an inventory-to-grid fill so the recipe book can
 * auto-place ingredients, matching Java 1.20.1 behavior.
 */

export type RecipeCategory = 'building' | 'tools' | 'combat' | 'food' | 'redstone' | 'materials' | 'misc';

export const RECIPE_CATEGORIES: RecipeCategory[] = ['building', 'tools', 'combat', 'food', 'redstone', 'materials'];

const REDSTONE_HINTS = [
  'redstone', 'repeater', 'comparator', 'piston', 'observer', 'dispenser',
  'dropper', 'hopper', 'rail', 'tnt', 'lamp', 'lever', 'button',
  'pressure_plate', 'tripwire', 'target', 'note_block', 'daylight', 'wire',
  'detector', 'sensor',
];

const COMBAT_TOOLS = ['sword', 'axe', 'bow', 'crossbow', 'trident', 'shield', 'mace'];

/** Vanilla-style recipe category derived from the result item. */
export function getRecipeCategory(resultId: number): RecipeCategory {
  const item = ItemRegistry.get(resultId);
  if (!item) return 'misc';
  if (item.category === 'food') return 'food';
  if (item.category === 'armor') return 'combat';
  if (item.category === 'tool') {
    return item.toolType && COMBAT_TOOLS.includes(item.toolType) ? 'combat' : 'tools';
  }
  const isRedstone = REDSTONE_HINTS.some((hint) => item.name.includes(hint));
  if (item.category === 'block') {
    return isRedstone ? 'redstone' : 'building';
  }
  if (item.category === 'material') {
    return isRedstone ? 'redstone' : 'materials';
  }
  return 'materials';
}

export interface RecipeBookEntry extends RecipeListItem {
  category: RecipeCategory;
}

/** All recipes with categories, deduplicated by result id + shape. */
export function getAllRecipeBookEntries(): RecipeBookEntry[] {
  const seen = new Set<string>();
  const out: RecipeBookEntry[] = [];
  for (const item of listCraftingRecipes()) {
    const category = getRecipeCategory(item.resultId);
    const shapeKey = JSON.stringify({
      inShape: item.recipe.inShape ?? null,
      ingredients: item.recipe.ingredients ?? null,
    });
    const key = `${item.resultId}:${item.resultCount}:${shapeKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...item, category });
  }
  return out;
}

export interface RecipeFilter {
  query: string;
  category: RecipeCategory | 'all';
  nameOf: (itemId: number) => string;
}

export function filterRecipeEntries(entries: RecipeBookEntry[], filter: RecipeFilter): RecipeBookEntry[] {
  const query = filter.query.trim().toLowerCase();
  return entries.filter((entry) => {
    if (filter.category !== 'all' && entry.category !== filter.category) return false;
    if (!query) return true;
    const item = ItemRegistry.get(entry.resultId);
    const names = [
      String(entry.resultId),
      item?.name ?? '',
      item?.displayName ?? '',
      filter.nameOf(entry.resultId),
    ];
    return names.some((value) => value.toLowerCase().includes(query));
  });
}

/** Whether a recipe fits a grid of the given size (2x2 or 3x3). */
export function fitsGridSize(recipe: RawRecipe, gridSize: 2 | 3): boolean {
  if (recipe.inShape) {
    const h = recipe.inShape.length;
    const w = recipe.inShape[0].length;
    return h <= gridSize && w <= gridSize;
  }
  return (recipe.ingredients?.length ?? 0) <= gridSize * gridSize;
}

export interface GridFillMove {
  fromSlot: number;
  itemId: number;
  count: number;
}

export interface GridFillPlan {
  /** Flat grid (gridSize*gridSize), 0 = empty. */
  grid: number[];
  moves: GridFillMove[];
}

/**
 * Plan filling a crafting grid from the inventory for a recipe. Returns null
 * when the inventory cannot supply every required ingredient. Shaped recipes
 * are placed top-left; shapeless recipes fill cells in order.
 */
export function planGridFill(
  recipe: RawRecipe,
  gridSize: 2 | 3,
  slotItem: (slot: number) => number | null,
  slotCount: (slot: number) => number,
): GridFillPlan | null {
  const cells = gridSize * gridSize;
  const grid = new Array<number>(cells).fill(0);
  const moves: GridFillMove[] = [];
  const remaining = new Map<number, number>(); // slot -> items left to take
  const totalSlots = 36; // inventory slot count (indices 0..35)

  const consume = (cell: RawRecipeCell, cellIndex: number): boolean => {
    for (let slot = 0; slot < totalSlots; slot++) {
      const stored = slotItem(slot);
      if (stored === null || stored === 0) continue;
      if (!matchesRecipeCell(stored, cell)) continue;
      const available = remaining.get(slot) ?? slotCount(slot);
      if (available <= 0) continue;
      remaining.set(slot, available - 1);
      grid[cellIndex] = stored;
      const existing = moves.find((m) => m.fromSlot === slot && m.itemId === stored);
      if (existing) existing.count += 1;
      else moves.push({ fromSlot: slot, itemId: stored, count: 1 });
      return true;
    }
    return false;
  };

  if (recipe.inShape) {
    const h = recipe.inShape.length;
    const w = recipe.inShape[0].length;
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const cell = recipe.inShape[r][c];
        if (cell === null) continue;
        const cellIndex = r * gridSize + c;
        if (!consume(cell, cellIndex)) return null;
      }
    }
  } else if (recipe.ingredients) {
    let cellIndex = 0;
    for (const ingredient of recipe.ingredients) {
      if (ingredient === null) continue;
      if (!consume(ingredient, cellIndex)) return null;
      cellIndex++;
    }
  } else {
    return null;
  }

  return { grid, moves };
}

/** Result item helper for tooltips. */
export function getRecipeResultItem(resultId: number): ItemDef | undefined {
  return ItemRegistry.get(resultId);
}
