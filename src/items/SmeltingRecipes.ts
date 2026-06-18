export interface SmeltingRecipe {
  input: number;
  output: number;
  outputCount: number;
  xp: number;
  cookTime: number; // seconds
}

export const SMELTING_RECIPES: SmeltingRecipe[] = [
  // Ores → Ingots / Materials
  { input: 15, output: 265, outputCount: 1, xp: 0.7, cookTime: 10 },  // iron_ore (15) → iron_ingot (265)
  { input: 14, output: 266, outputCount: 1, xp: 1.0, cookTime: 10 },  // gold_ore (14) → gold_ingot (266)
  { input: 16, output: 263, outputCount: 1, xp: 0.1, cookTime: 10 },  // coal_ore (16) → coal (263)
  { input: 56, output: 264, outputCount: 1, xp: 1.0, cookTime: 10 },  // diamond_ore (56) → diamond (264)

  // Raw food → Cooked food
  { input: 363, output: 364, outputCount: 1, xp: 0.35, cookTime: 10 }, // raw_beef (363) → steak (364)
  { input: 319, output: 320, outputCount: 1, xp: 0.35, cookTime: 10 }, // raw_porkchop (319) → cooked (320)

  // Sand / Sandstone → Glass (20)
  { input: 12, output: 20, outputCount: 1, xp: 0.1, cookTime: 10 },    // sand (12) → glass (20)
  { input: 24, output: 20, outputCount: 1, xp: 0.1, cookTime: 10 },    // sandstone (24) → glass (20)

  // Cobblestone → Stone
  { input: 4, output: 1, outputCount: 1, xp: 0.1, cookTime: 10 },     // cobblestone (4) → stone (1)

  // Clay → Bricks
  { input: 82, output: 45, outputCount: 1, xp: 0.3, cookTime: 10 },   // clay block (82) → bricks block (45)

  // Log → Charcoal (coal with metadata 1 = 1287)
  { input: 17, output: (1 << 10) | 263, outputCount: 1, xp: 0.15, cookTime: 10 }, // log (17) → charcoal (1287)
];

export function findSmeltingResult(inputId: number): SmeltingRecipe | null {
  // Support matching by packed ID first
  const exactMatch = SMELTING_RECIPES.find(r => r.input === inputId);
  if (exactMatch) return exactMatch;

  // Fallback: match by base ID
  const baseId = inputId & 0x3FF;
  const baseMatch = SMELTING_RECIPES.find(r => (r.input & 0x3FF) === baseId);
  return baseMatch ?? null;
}
