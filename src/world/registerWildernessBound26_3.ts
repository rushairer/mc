import { BlockRegistry } from './BlockRegistry';
import { ItemRegistry } from '../items/ItemRegistry';
import { addCraftingRecipes } from '../items/CraftingRecipes';
import { STONECUTTING_RECIPES } from '../items/StonecuttingRecipes';
import {
  CONCRETE_SHAPE_BLOCKS,
  DYE_COLORS,
  WILDERNESS_BOUND_ALL_ITEMS,
  WILDERNESS_BOUND_BLOCKS,
  buildWildernessBoundRecipes,
} from './WildernessBound26_3';

let registered = false;

/**
 * Installs the Minecraft Java 26.3 Wilderness Bound content bridge into the
 * built-in registries. The operation is idempotent so browser/server entry
 * points and tests can safely call it independently.
 */
export function registerWildernessBound26_3(): void {
  if (registered) return;
  registered = true;

  BlockRegistry.registerDataPackBlocks(WILDERNESS_BOUND_BLOCKS);
  ItemRegistry.registerDataPackItems(WILDERNESS_BOUND_ALL_ITEMS);

  const resolveId = (name: string) =>
    ItemRegistry.getByName(name)?.id ?? BlockRegistry.getByName(name)?.id;
  addCraftingRecipes(buildWildernessBoundRecipes(resolveId));

  for (const color of DYE_COLORS) {
    const shapes = CONCRETE_SHAPE_BLOCKS.get(color)!;
    const entries = [
      { input: `${color}_concrete`, output: shapes.slab.name, count: 2 },
      { input: `${color}_concrete`, output: shapes.stairs.name, count: 1 },
    ];
    for (const entry of entries) {
      if (!STONECUTTING_RECIPES.some(recipe => recipe.input === entry.input && recipe.output === entry.output)) {
        STONECUTTING_RECIPES.push(entry);
      }
    }
  }
}

export function isWildernessBound26_3Registered(): boolean {
  return registered;
}
