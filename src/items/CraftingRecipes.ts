/**
 * Crafting recipes.
 *
 * Pattern is a flat array of 9 item IDs for a 3×3 grid.
 * Use 0 for empty slots.
 * Shapeless recipes have pattern=null (any arrangement works).
 */

export interface CraftingRecipe {
  pattern: (number | null)[];   // 9 elements for 3×3, null = wildcard
  result: { id: number; count: number };
  shapeless?: boolean;
}

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  // ─── Planks from any log ───
  { pattern: [6, 0, 0, 0, 0, 0, 0, 0, 0], result: { id: 5, count: 4 }, shapeless: true },
  { pattern: [null, 0, 0, 0, 0, 0, 0, 0, 0], result: { id: 5, count: 4 }, shapeless: true },

  // ─── Sticks ───
  { pattern: [5, 0, 0, 5, 0, 0, 0, 0, 0], result: { id: 100, count: 4 } },

  // ─── Crafting Table ───
  { pattern: [5, 5, 0, 5, 5, 0, 0, 0, 0], result: { id: 24, count: 1 } },

  // ─── Furnace ───
  { pattern: [4, 4, 4, 4, 0, 4, 4, 4, 4], result: { id: 25, count: 1 } },

  // ─── Torches ───
  { pattern: [101, 0, 0, 100, 0, 0, 0, 0, 0], result: { id: 30, count: 4 } },

  // ─── Chest ───
  { pattern: [5, 5, 5, 5, 0, 5, 5, 5, 5], result: { id: 36, count: 1 } },

  // ─── Wooden Tools ───
  { pattern: [5, 5, 0, 0, 100, 0, 0, 100, 0], result: { id: 122, count: 1 } }, // pickaxe
  { pattern: [5, 0, 0, 100, 0, 0, 100, 0, 0], result: { id: 123, count: 1 } }, // axe
  { pattern: [0, 5, 0, 0, 100, 0, 0, 100, 0], result: { id: 123, count: 1 } }, // axe mirrored
  { pattern: [0, 5, 0, 0, 100, 0, 0, 100, 0], result: { id: 121, count: 1 } }, // shovel
  { pattern: [5, 0, 0, 5, 0, 0, 100, 0, 0], result: { id: 120, count: 1 } }, // sword

  // ─── Stone Tools ───
  { pattern: [4, 4, 0, 0, 100, 0, 0, 100, 0], result: { id: 132, count: 1 } },
  { pattern: [4, 0, 0, 100, 0, 0, 100, 0, 0], result: { id: 133, count: 1 } },
  { pattern: [0, 4, 0, 0, 100, 0, 0, 100, 0], result: { id: 133, count: 1 } },
  { pattern: [0, 4, 0, 0, 100, 0, 0, 100, 0], result: { id: 131, count: 1 } },
  { pattern: [4, 0, 0, 4, 0, 0, 100, 0, 0], result: { id: 130, count: 1 } },

  // ─── Iron Tools ───
  { pattern: [102, 102, 0, 0, 100, 0, 0, 100, 0], result: { id: 142, count: 1 } },
  { pattern: [102, 0, 0, 100, 0, 0, 100, 0, 0], result: { id: 143, count: 1 } },
  { pattern: [0, 102, 0, 0, 100, 0, 0, 100, 0], result: { id: 143, count: 1 } },
  { pattern: [0, 102, 0, 0, 100, 0, 0, 100, 0], result: { id: 141, count: 1 } },
  { pattern: [102, 0, 0, 102, 0, 0, 100, 0, 0], result: { id: 140, count: 1 } },

  // ─── Diamond Tools ───
  { pattern: [104, 104, 0, 0, 100, 0, 0, 100, 0], result: { id: 152, count: 1 } },
  { pattern: [104, 0, 0, 100, 0, 0, 100, 0, 0], result: { id: 153, count: 1 } },
  { pattern: [0, 104, 0, 0, 100, 0, 0, 100, 0], result: { id: 153, count: 1 } },
  { pattern: [0, 104, 0, 0, 100, 0, 0, 100, 0], result: { id: 151, count: 1 } },
  { pattern: [104, 0, 0, 104, 0, 0, 100, 0, 0], result: { id: 150, count: 1 } },

  // ─── Golden Tools ───
  { pattern: [103, 103, 0, 0, 100, 0, 0, 100, 0], result: { id: 162, count: 1 } },
  { pattern: [103, 0, 0, 100, 0, 0, 100, 0, 0], result: { id: 163, count: 1 } },
  { pattern: [0, 103, 0, 0, 100, 0, 0, 100, 0], result: { id: 163, count: 1 } },
  { pattern: [0, 103, 0, 0, 100, 0, 0, 100, 0], result: { id: 161, count: 1 } },
  { pattern: [103, 0, 0, 103, 0, 0, 100, 0, 0], result: { id: 160, count: 1 } },

  // ─── Iron Armor ───
  { pattern: [102, 102, 102, 102, 0, 102, 0, 0, 0], result: { id: 180, count: 1 } },
  { pattern: [102, 0, 102, 102, 102, 102, 102, 102, 102], result: { id: 181, count: 1 } },
  { pattern: [102, 102, 102, 102, 0, 102, 102, 0, 102], result: { id: 182, count: 1 } },
  { pattern: [0, 0, 0, 102, 0, 102, 102, 0, 102], result: { id: 183, count: 1 } },

  // ─── Diamond Armor ───
  { pattern: [104, 104, 104, 104, 0, 104, 0, 0, 0], result: { id: 184, count: 1 } },
  { pattern: [104, 0, 104, 104, 104, 104, 104, 104, 104], result: { id: 185, count: 1 } },
  { pattern: [104, 104, 104, 104, 0, 104, 104, 0, 104], result: { id: 186, count: 1 } },
  { pattern: [0, 0, 0, 104, 0, 104, 104, 0, 104], result: { id: 187, count: 1 } },

  // ─── Bucket ───
  { pattern: [102, 0, 102, 0, 102, 0, 0, 0, 0], result: { id: 178, count: 1 } },

  // ─── Bread ───
  { pattern: [176, 176, 176, 0, 0, 0, 0, 0, 0], result: { id: 171, count: 1 } },

  // ─── Paper ───
  { pattern: [176, 176, 176, 0, 0, 0, 0, 0, 0], result: { id: 109, count: 3 } },

  // ─── Book ───
  { pattern: [109, 109, 109, 0, 107, 0, 0, 0, 0], result: { id: 110, count: 1 } },

  // ─── Block compression ───
  { pattern: [102, 102, 102, 102, 102, 102, 102, 102, 102], result: { id: 18, count: 1 } },  // iron block
  { pattern: [103, 103, 103, 103, 103, 103, 103, 103, 103], result: { id: 17, count: 1 } },  // gold block
  { pattern: [104, 104, 104, 104, 104, 104, 104, 104, 104], result: { id: 23, count: 1 } },  // diamond block

  // ─── Block → Ingots (reverse) ───
  { pattern: [18, 0, 0, 0, 0, 0, 0, 0, 0], result: { id: 102, count: 9 }, shapeless: true },
  { pattern: [17, 0, 0, 0, 0, 0, 0, 0, 0], result: { id: 103, count: 9 }, shapeless: true },
  { pattern: [23, 0, 0, 0, 0, 0, 0, 0, 0], result: { id: 104, count: 9 }, shapeless: true },
];

/**
 * Check if grid contents match a recipe.
 * grid: array of 9 item IDs (0 = empty).
 * Returns recipe result or null.
 */
export function findCraftingResult(grid: number[]): { id: number; count: number } | null {
  for (const recipe of CRAFTING_RECIPES) {
    if (recipe.shapeless) {
      if (matchShapeless(grid, recipe.pattern)) {
        return recipe.result;
      }
    } else {
      if (matchShaped(grid, recipe.pattern)) {
        return recipe.result;
      }
    }
  }
  return null;
}

function matchShapeless(grid: number[], pattern: (number | null)[]): boolean {
  const gridItems = grid.filter(id => id > 0).sort();
  const patItems = pattern.filter(id => id !== null && id > 0).sort();

  if (gridItems.length !== patItems.length) return false;

  for (let i = 0; i < gridItems.length; i++) {
    if (patItems[i] !== null && gridItems[i] !== patItems[i]) return false;
  }
  return true;
}

function matchShaped(grid: number[], pattern: (number | null)[]): boolean {
  // Try all possible offsets within the grid
  for (let rowOff = 0; rowOff <= 1; rowOff++) {
    for (let colOff = 0; colOff <= 1; colOff++) {
      let match = true;
      for (let pr = 0; pr < 3; pr++) {
        for (let pc = 0; pc < 3; pc++) {
          const pIdx = pr * 3 + pc;
          const gIdx = (pr + rowOff) * 3 + (pc + colOff);
          const patVal = pattern[pIdx];
          const gridVal = gIdx < 9 ? grid[gIdx] : 0;

          if (patVal === null) continue; // wildcard
          if (patVal === 0 && gridVal !== 0) { match = false; break; }
          if (patVal !== 0 && gridVal !== patVal) { match = false; break; }
        }
        if (!match) break;
      }
      if (match) return true;
    }
  }
  return false;
}
