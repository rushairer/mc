import { BlockRegistry } from './BlockRegistry';
import { ItemRegistry } from '../items/ItemRegistry';
import { addCraftingRecipes } from '../items/CraftingRecipes';
import { STONECUTTING_RECIPES } from '../items/StonecuttingRecipes';
import type { DataPackItem } from '../systems/DataPackTypes';
import {
  CONCRETE_SHAPE_BLOCKS,
  DYE_COLORS,
  WILDERNESS_BOUND_ALL_ITEMS,
  WILDERNESS_BOUND_BLOCKS,
  buildWildernessBoundRecipes,
} from './WildernessBound26_3';
import {
  WILDERNESS_BOUND_SUPPLEMENT_BLOCKS,
  WILDERNESS_BOUND_SUPPLEMENT_ITEMS,
} from './WildernessBound26_3Supplement';

let registered = false;

function legacyColoredRuntimeId(baseId: number, color: typeof DYE_COLORS[number]): number {
  const metadata = DYE_COLORS.indexOf(color);
  return (metadata << 10) | baseId;
}

function resolveLegacyColoredBlock(name: string): number | undefined {
  for (const family of ['wool', 'concrete'] as const) {
    const suffix = `_${family}`;
    if (!name.endsWith(suffix)) continue;
    const color = name.slice(0, -suffix.length) as typeof DYE_COLORS[number];
    if (!DYE_COLORS.includes(color)) return undefined;
    const base = ItemRegistry.getByName(family);
    if (!base) return undefined;
    return legacyColoredRuntimeId(base.baseId, color);
  }
  return undefined;
}

function registerLegacyColoredAliases(): void {
  const aliases: DataPackItem[] = [];
  for (const color of DYE_COLORS) {
    for (const family of ['wool', 'concrete'] as const) {
      const base = ItemRegistry.getByName(family);
      if (!base) continue;
      const id = legacyColoredRuntimeId(base.baseId, color);
      const name = `${color}_${family}`;
      aliases.push({
        id,
        officialId: `minecraft:${name}`,
        baseId: base.baseId,
        metadata: DYE_COLORS.indexOf(color),
        name,
        displayName: name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        maxStackSize: 64,
        category: 'block',
        placeBlockId: id,
        behaviorId: 'minecraft:block_item',
      });
    }
  }
  ItemRegistry.registerDataPackItems(aliases);
}

/**
 * Installs the Minecraft Java 26.3 Wilderness Bound content bridge into the
 * built-in registries. The operation is idempotent so browser/server entry
 * points and tests can safely call it independently.
 */
export function registerWildernessBound26_3(): void {
  if (registered) return;
  registered = true;

  BlockRegistry.registerDataPackBlocks([
    ...WILDERNESS_BOUND_BLOCKS,
    ...WILDERNESS_BOUND_SUPPLEMENT_BLOCKS,
  ]);
  registerLegacyColoredAliases();
  ItemRegistry.registerDataPackItems([
    ...WILDERNESS_BOUND_ALL_ITEMS,
    ...WILDERNESS_BOUND_SUPPLEMENT_ITEMS,
  ]);

  const resolveId = (name: string) =>
    ItemRegistry.getByName(name)?.id
    ?? BlockRegistry.getByName(name)?.id
    ?? resolveLegacyColoredBlock(name);
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
