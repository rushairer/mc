export interface SmeltingRecipe {
  input: number;
  output: number;
  outputCount: number;
  xp: number;
  cookTime: number; // seconds
}

export const SMELTING_RECIPES: SmeltingRecipe[] = [
  // ─── Ores → Ingots / Materials ───
  { input: 15, output: 265, outputCount: 1, xp: 0.7, cookTime: 10 },  // iron_ore (15) → iron_ingot (265)
  { input: 14, output: 266, outputCount: 1, xp: 1.0, cookTime: 10 },  // gold_ore (14) → gold_ingot (266)
  { input: 16, output: 263, outputCount: 1, xp: 0.1, cookTime: 10 },  // coal_ore (16) → coal (263)
  { input: 56, output: 264, outputCount: 1, xp: 1.0, cookTime: 10 },  // diamond_ore (56) → diamond (264)

  // ─── Raw Ores (Items) → Ingots ───
  { input: 20229, output: 265, outputCount: 1, xp: 0.7, cookTime: 10 }, // raw_iron (20229) → iron_ingot (265)
  { input: 20228, output: 266, outputCount: 1, xp: 1.0, cookTime: 10 }, // raw_gold (20228) → gold_ingot (266)
  { input: 20227, output: 20059, outputCount: 1, xp: 0.7, cookTime: 10 }, // raw_copper (20227) → copper_ingot (20059)

  // ─── Raw Food → Cooked Food ───
  { input: 363, output: 364, outputCount: 1, xp: 0.35, cookTime: 10 }, // raw_beef (363) → steak (364)
  { input: 319, output: 320, outputCount: 1, xp: 0.35, cookTime: 10 }, // raw_porkchop (319) → cooked_porkchop (320)
  { input: 365, output: 366, outputCount: 1, xp: 0.35, cookTime: 10 }, // raw_chicken (365) → cooked_chicken (366)
  { input: 423, output: 424, outputCount: 1, xp: 0.35, cookTime: 10 }, // raw_mutton (423) → cooked_mutton (424)
  { input: 20236, output: 20051, outputCount: 1, xp: 0.35, cookTime: 10 }, // salmon (20236) → cooked_salmon (20051)
  { input: 20048, output: 350, outputCount: 1, xp: 0.35, cookTime: 10 },  // cod (20048) → cooked_fish (350)
  { input: 392, output: 393, outputCount: 1, xp: 0.35, cookTime: 10 },  // potato (392) → baked_potato (393)
  { input: 30411, output: 20083, outputCount: 1, xp: 0.1, cookTime: 10 }, // kelp (30411) → dried_kelp (20083)

  // ─── Blocks → Blocks / Items ───
  { input: 12, output: 20, outputCount: 1, xp: 0.1, cookTime: 10 },    // sand (12) → glass (20)
  { input: 24, output: 20, outputCount: 1, xp: 0.1, cookTime: 10 },    // sandstone (24) → glass (20)
  { input: 4, output: 1, outputCount: 1, xp: 0.1, cookTime: 10 },     // cobblestone (4) → stone (1)
  { input: 1, output: 30772, outputCount: 1, xp: 0.1, cookTime: 10 },  // stone (1) → smooth_stone (30772)
  { input: 82, output: 45, outputCount: 1, xp: 0.3, cookTime: 10 },   // clay block (82) → bricks block (45)
  { input: 87, output: 112, outputCount: 1, xp: 0.1, cookTime: 10 },  // netherrack (87) → nether_brick (112)

  // ─── Logs → Charcoal ───
  { input: 17, output: (1 << 10) | 263, outputCount: 1, xp: 0.15, cookTime: 10 }, // log (17) → charcoal (1287)
  { input: 162, output: (1 << 10) | 263, outputCount: 1, xp: 0.15, cookTime: 10 }, // log2 (162) → charcoal (1287)
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

export function isSmeltingFuel(itemId: number): boolean {
  const baseId = itemId & 0x3FF;

  // Coal, charcoal
  if (baseId === 263) return true;
  // Planks
  if (baseId === 5) return true;
  // Logs / Wood
  if (baseId === 17 || baseId === 162) return true;
  // Block of coal
  if (baseId === 173) return true;
  // Stick
  if (baseId === 280) return true;
  // Lava bucket
  if (baseId === 327) return true;
  // Chest, Crafting Table
  if (baseId === 54 || baseId === 58) return true;
  // Sapling
  if (baseId === 6) return true;
  // Wooden tools (sword, shovel, pickaxe, axe, hoe)
  if (baseId === 268 || baseId === 269 || baseId === 270 || baseId === 271 || baseId === 290) return true;
  // Bow, fishing rod
  if (baseId === 261 || baseId === 346) return true;

  return false;
}

export function getFuelBurnTime(itemId: number): number {
  const baseId = itemId & 0x3FF;
  if (baseId === 327) return 1000; // lava bucket
  if (baseId === 173) return 800;  // coal block
  if (baseId === 263) return 80;   // coal/charcoal
  if (baseId === 17 || baseId === 162 || baseId === 5 || baseId === 54 || baseId === 58) return 15; // logs, planks, chest, crafting table
  if (baseId === 268 || baseId === 269 || baseId === 270 || baseId === 271 || baseId === 290 || baseId === 261 || baseId === 346) return 10; // wooden tools/weapons
  if (baseId === 280 || baseId === 6) return 5; // stick, sapling
  return 0;
}

