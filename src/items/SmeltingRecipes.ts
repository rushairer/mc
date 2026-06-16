export interface SmeltingRecipe {
  input: number;
  output: number;
  outputCount: number;
  xp: number;
  cookTime: number; // seconds
}

export const SMELTING_RECIPES: SmeltingRecipe[] = [
  // Ores → Ingots
  { input: 11, output: 102, outputCount: 1, xp: 0.7, cookTime: 10 },  // iron_ore → iron_ingot
  { input: 10, output: 103, outputCount: 1, xp: 1.0, cookTime: 10 },  // gold_ore → gold_ingot
  { input: 12, output: 101, outputCount: 1, xp: 0.1, cookTime: 10 },  // coal_ore → coal
  { input: 22, output: 104, outputCount: 1, xp: 1.0, cookTime: 10 },  // diamond_ore → diamond

  // Raw food → Cooked food
  { input: 173, output: 172, outputCount: 1, xp: 0.35, cookTime: 10 }, // raw_beef → steak
  { input: 174, output: 175, outputCount: 1, xp: 0.35, cookTime: 10 }, // raw_porkchop → cooked

  // Sand → Glass
  { input: 8, output: 26, outputCount: 1, xp: 0.1, cookTime: 10 },    // sand → glass
  { input: 15, output: 26, outputCount: 1, xp: 0.1, cookTime: 10 },   // sandstone → glass

  // Cobblestone → Stone
  { input: 4, output: 1, outputCount: 1, xp: 0.1, cookTime: 10 },     // cobblestone → stone

  // Clay → Brick
  { input: 29, output: 19, outputCount: 1, xp: 0.3, cookTime: 10 },   // clay → bricks

  // Wood → Charcoal
  { input: 6, output: 101, outputCount: 1, xp: 0.15, cookTime: 10 },  // oak_log → charcoal(coal)
];

export function findSmeltingResult(inputId: number): SmeltingRecipe | null {
  return SMELTING_RECIPES.find(r => r.input === inputId) ?? null;
}
