import rawRecipes from './data/recipes.json';

interface RawRecipeIngredient {
  id: number;
  metadata?: number;
}

type RawRecipeCell = number | RawRecipeIngredient | (number | RawRecipeIngredient)[] | null;

interface RawRecipe {
  inShape?: RawRecipeCell[][];
  ingredients?: RawRecipeCell[];
  result: {
    id: number;
    count: number;
    metadata?: number;
  };
}

const recipesData = rawRecipes as Record<string, RawRecipe[]>;

// Helper to check if a player item (packed ID) matches a recipe ingredient
function matchIngredient(playerItem: number, recipeItem: RawRecipeCell): boolean {
  if (recipeItem === null) {
    return playerItem === 0;
  }
  if (playerItem === 0) {
    return false; // recipe expects an item, but player slot is empty
  }

  // If choices array
  if (Array.isArray(recipeItem)) {
    return recipeItem.some(choice => matchSingleIngredient(playerItem, choice));
  }

  return matchSingleIngredient(playerItem, recipeItem);
}

function matchSingleIngredient(playerItem: number, choice: number | RawRecipeIngredient): boolean {
  const pBaseId = playerItem & 0x3FF;
  const pMeta = playerItem >> 10;

  if (typeof choice === 'number') {
    // If it's a number, match base ID or exact packed ID (if choice is somehow packed)
    return pBaseId === choice || playerItem === choice;
  } else {
    const cBaseId = choice.id;
    const cMeta = choice.metadata ?? 0;
    const packedChoiceId = (cMeta << 10) | cBaseId;

    // Try exact packed match first
    if (playerItem === packedChoiceId) return true;

    // Fallback: if choice specifies no metadata or metadata is 0, allow matching any metadata of the same base ID
    // E.g., any planks (base ID 5) can match planks ingredient in general recipes like stick or chest.
    if (cMeta === 0 || choice.metadata === undefined) {
      return pBaseId === cBaseId;
    }

    return false;
  }
}

// Bipartite matching / backtracking search for shapeless recipe matching
function matchShapelessIngredients(activeItems: number[], ingredients: RawRecipeCell[]): boolean {
  if (activeItems.length !== ingredients.length) return false;

  const visited = new Array(ingredients.length).fill(false);

  function backtrack(itemIdx: number): boolean {
    if (itemIdx === activeItems.length) return true;
    const playerItem = activeItems[itemIdx];

    for (let i = 0; i < ingredients.length; i++) {
      if (!visited[i]) {
        if (matchIngredient(playerItem, ingredients[i])) {
          visited[i] = true;
          if (backtrack(itemIdx + 1)) return true;
          visited[i] = false;
        }
      }
    }
    return false;
  }

  return backtrack(0);
}

export function findCraftingResult(grid: number[]): { id: number; count: number } | null {
  // grid is 9 elements flat representing a 3x3 crafting grid.
  // 0 = empty.

  // 1. Get bounds of active items in grid
  let minRow = 3, maxRow = -1, minCol = 3, maxCol = -1;
  let activeCount = 0;

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const idx = r * 3 + c;
      if (grid[idx] > 0) {
        if (r < minRow) minRow = r;
        if (r > maxRow) maxRow = r;
        if (c < minCol) minCol = c;
        if (c > maxCol) maxCol = c;
        activeCount++;
      }
    }
  }

  if (activeCount === 0) return null;

  const hPlayer = maxRow - minRow + 1;
  const wPlayer = maxCol - minCol + 1;

  // Build the player's trimmed 2D grid
  const playerGrid: number[][] = [];
  for (let r = 0; r < hPlayer; r++) {
    playerGrid.push([]);
    for (let c = 0; c < wPlayer; c++) {
      const gRow = minRow + r;
      const gCol = minCol + c;
      playerGrid[r].push(grid[gRow * 3 + gCol]);
    }
  }

  const activePlayerItems = grid.filter(id => id > 0);

  // 2. Iterate through all recipes in recipes.json
  for (const [resultIdStr, recipes] of Object.entries(recipesData)) {
    for (const recipe of recipes) {
      const packedResultId = ((recipe.result.metadata ?? 0) << 10) | recipe.result.id;

      // Check Shaped Recipe
      if (recipe.inShape) {
        const hRecipe = recipe.inShape.length;
        const wRecipe = recipe.inShape[0].length;

        if (hRecipe === hPlayer && wRecipe === wPlayer) {
          let match = true;
          for (let r = 0; r < hPlayer; r++) {
            for (let c = 0; c < wPlayer; c++) {
              if (!matchIngredient(playerGrid[r][c], recipe.inShape[r][c])) {
                match = false;
                break;
              }
            }
            if (!match) break;
          }
          if (match) {
            return { id: packedResultId, count: recipe.result.count };
          }
        }
      }

      // Check Shapeless Recipe
      if (recipe.ingredients) {
        if (matchShapelessIngredients(activePlayerItems, recipe.ingredients)) {
          return { id: packedResultId, count: recipe.result.count };
        }
      }
    }
  }

  return null;
}
