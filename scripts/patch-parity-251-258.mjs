import { readFileSync, writeFileSync } from 'node:fs';

function patch(path, transform) {
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error(`patch produced no change: ${path}`);
  writeFileSync(path, after);
}
function once(source, from, to, label) {
  const i = source.indexOf(from);
  if (i < 0) throw new Error(`missing anchor: ${label}`);
  if (source.indexOf(from, i + from.length) >= 0) throw new Error(`ambiguous anchor: ${label}`);
  return source.slice(0, i) + to + source.slice(i + from.length);
}

writeFileSync('src/world/SuspiciousStew26_3.ts', `import type { PotionEffectData, PotionEffectId } from '../systems/PotionEffect';

export interface SuspiciousStewEffect26_3 extends PotionEffectData {
  sourceFlower: string;
}

const EFFECTS: Record<string, { id: PotionEffectId; duration: number }> = {
  allium: { id: 'fire_resistance', duration: 3 },
  azure_bluet: { id: 'blindness', duration: 11 },
  open_eyeblossom: { id: 'blindness', duration: 11 },
  blue_orchid: { id: 'saturation', duration: 0.35 },
  dandelion: { id: 'saturation', duration: 0.35 },
  yellow_flower: { id: 'saturation', duration: 0.35 },
  golden_dandelion: { id: 'saturation', duration: 0.35 },
  closed_eyeblossom: { id: 'nausea', duration: 7 },
  cornflower: { id: 'jump_boost', duration: 5 },
  lily_of_the_valley: { id: 'poison', duration: 11 },
  oxeye_daisy: { id: 'regeneration', duration: 7 },
  poppy: { id: 'night_vision', duration: 5 },
  red_flower: { id: 'night_vision', duration: 5 },
  torchflower: { id: 'night_vision', duration: 5 },
  red_tulip: { id: 'weakness', duration: 7 },
  orange_tulip: { id: 'weakness', duration: 7 },
  white_tulip: { id: 'weakness', duration: 7 },
  pink_tulip: { id: 'weakness', duration: 7 },
  wither_rose: { id: 'wither', duration: 7 },
};

export function getSuspiciousStewEffect26_3(flowerName: string): SuspiciousStewEffect26_3 | null {
  const effect = EFFECTS[flowerName];
  return effect ? { ...effect, level: 1, sourceFlower: flowerName } : null;
}

/** Saturation stew applies seven Java game ticks of +1 food/+2 saturation. */
export function applySaturationStew26_3(hunger: number, saturation: number): { hunger: number; saturation: number } {
  const nextHunger = Math.min(20, hunger + 7);
  return { hunger: nextHunger, saturation: Math.min(nextHunger, saturation + 14) };
}
`);

patch('src/systems/PotionEffect.ts', source => once(
  source,
  `  | 'water_breathing' | 'absorption' | 'resistance';`,
  `  | 'water_breathing' | 'absorption' | 'resistance'\n  | 'blindness' | 'night_vision' | 'nausea' | 'saturation';`,
  'PotionEffectId additions',
).replace(
  `  resistance: { name: 'Resistance' },`,
  `  resistance: { name: 'Resistance' },\n  blindness: { name: 'Blindness' },\n  night_vision: { name: 'Night Vision' },\n  nausea: { name: 'Nausea' },\n  saturation: { name: 'Saturation' },`,
));

patch('src/types/index.ts', source => once(
  source,
  `  patterns?: Array<{ pattern: string; color: string }>;`,
  `  patterns?: Array<{ pattern: string; color: string }>;\n  /** Food-delivered status components, notably Suspicious Stew. */\n  foodEffects?: PotionEffectData[];\n  /** Foods such as Suspicious Stew can be consumed at full hunger. */\n  alwaysEdible?: boolean;\n  /** Container returned after consumption (e.g. bowl from stew). */\n  containerItemId?: number;`,
  'ItemStack food components',
));

patch('src/items/ItemStackRules.ts', source => once(
  source,
  `  if (stack.patterns) clone.patterns = stack.patterns.map((pattern) => ({ ...pattern }));\n  return clone;`,
  `  if (stack.patterns) clone.patterns = stack.patterns.map((pattern) => ({ ...pattern }));\n  if (stack.foodEffects) clone.foodEffects = stack.foodEffects.map((effect) => ({ ...effect }));\n  return clone;`,
  'clone foodEffects',
));

patch('src/items/CraftingRecipes.ts', source => {
  let out = once(source, `import rawRecipes from './data/recipes.json';`, `import rawRecipes from './data/recipes.json';\nimport type { ItemStack } from '../types';`, 'Crafting ItemStack import');
  out = once(out,
    `    metadata?: number;\n  };`,
    `    metadata?: number;\n    components?: Omit<ItemStack, 'id' | 'count'>;\n  };`,
    'recipe result components',
  );
  out = once(out,
    `export function findCraftingResult(grid: number[]): { id: number; count: number } | null {`,
    `export function findCraftingResult(grid: number[]): ItemStack | null {`,
    'craft result type',
  );
  out = out.replaceAll(
    `return { id: packedResultId, count: recipe.result.count };`,
    `return { id: packedResultId, count: recipe.result.count, ...(recipe.result.components ?? {}) };`,
  );
  return out;
});

patch('src/world/WildernessBoundChanges26_3.ts', source => {
  let out = once(source,
    `import { EXPLORER_MAP_NAMES } from './WildernessBound26_3';`,
    `import { EXPLORER_MAP_NAMES } from './WildernessBound26_3';\nimport { getSuspiciousStewEffect26_3 } from './SuspiciousStew26_3';`,
    'stew effect import',
  );
  out = out.replace(
    ` * still controls the effect; this project's recipe result does not yet carry\n * the flower-derived stew effect component, so this bridge models ingredient\n * acceptance while preserving the dedicated Suspicious Stew output item.`,
    ` * still controls the effect. The output ItemStack carries that effect so two\n * stews crafted with different flowers retain distinct stack identity.`,
  );
  out = once(out,
    `    entries.push({\n      ingredients: [bowl, anyMushroom, anyMushroom, flower],\n      result: { id: suspiciousStew, count: 1 },\n    });`,
    `    const sourceFlower = aliases.find(alias => resolveId(alias) === flower) ?? aliases[0];\n    const foodEffect = getSuspiciousStewEffect26_3(sourceFlower);\n    entries.push({\n      ingredients: [bowl, anyMushroom, anyMushroom, flower],\n      result: {\n        id: suspiciousStew,\n        count: 1,\n        components: {\n          alwaysEdible: true,\n          containerItemId: bowl,\n          foodEffects: foodEffect ? [foodEffect] : [],\n        },\n      },\n    });`,
    'stew output components',
  );
  return out;
});

for (const path of ['src/ui/CraftingTableUI.tsx', 'src/ui/InventoryUI.tsx']) {
  patch(path, source => {
    let out = once(source,
      `const [craftResult, setCraftResult] = useState<{ id: number; count: number } | null>(null);`,
      `const [craftResult, setCraftResult] = useState<ItemStack | null>(null);`,
      `${path} craft result type`,
    );
    out = once(out,
      `inventory.addItem(craftResult.id, craftResult.count);`,
      `inventory.addStack(craftResult);`,
      `${path} preserve components`,
    );
    return out;
  });
}

patch('src/engine/Game.ts', source => {
  let out = once(source,
    `import { shouldPrioritizeShieldUse26_3 } from '../world/WildernessBoundChanges26_3';`,
    `import { shouldPrioritizeShieldUse26_3 } from '../world/WildernessBoundChanges26_3';\nimport { applySaturationStew26_3 } from '../world/SuspiciousStew26_3';`,
    'Game stew import',
  );
  out = once(out,
    `    return this.player.hunger < 20 || isGoldenApple || stack.id === HONEY_BOTTLE_ID;`,
    `    return this.player.hunger < 20 || isGoldenApple || stack.id === HONEY_BOTTLE_ID || !!stack.alwaysEdible;`,
    'always edible',
  );
  out = once(out,
    `    this.player.saturation = Math.min(\n      this.player.hunger,\n      this.player.saturation + (foodDef.saturationRestore ?? 0),\n    );`,
    `    this.player.saturation = Math.min(\n      this.player.hunger,\n      this.player.saturation + (foodDef.saturationRestore ?? 0),\n    );\n    for (const effect of stack.foodEffects ?? []) {\n      if (effect.id === 'saturation') {\n        const saturated = applySaturationStew26_3(this.player.hunger, this.player.saturation);\n        this.player.hunger = saturated.hunger;\n        this.player.saturation = saturated.saturation;\n      } else {\n        this.potionEffects.apply(effect, (amount) => {\n          this.player.health = Math.min(20, this.player.health + amount);\n        });\n      }\n    }`,
    'food effects application',
  );
  out = once(out,
    `    } else if (this.gameMode !== 'creative') {\n      if (stack.id === HONEY_BOTTLE_ID) {`,
    `    } else if (this.gameMode !== 'creative') {\n      if (stack.containerItemId !== undefined) {\n        const containerItemId = stack.containerItemId;\n        if (stack.count <= 1) {\n          this.inventory.setSlot(this.player.selectedSlot, { id: containerItemId, count: 1 });\n        } else {\n          this.inventory.removeFromSlot(this.player.selectedSlot);\n          this.inventory.addItem(containerItemId, 1);\n        }\n      } else if (stack.id === HONEY_BOTTLE_ID) {`,
    'food container return',
  );
  return out;
});

patch('tests/parity-231-238.test.ts', source => once(
  source,
  `  assert.deepEqual(\n    findCraftingResult(craftingGrid(bowl, shelf, brown, flower)),\n    { id: suspicious, count: 1 },\n  );`,
  `  const result = findCraftingResult(craftingGrid(bowl, shelf, brown, flower));\n  assert.equal(result?.id, suspicious);\n  assert.equal(result?.count, 1);\n  assert.equal(result?.alwaysEdible, true);\n  assert.equal(result?.containerItemId, bowl);\n  assert.equal(result?.foodEffects?.[0]?.id, 'saturation');`,
  'old suspicious stew assertion',
));

writeFileSync('tests/parity-251-258.test.ts', `import assert from 'node:assert/strict';
import test from 'node:test';
import { findCraftingResult } from '../src/items/CraftingRecipes';
import { itemStacksCanMerge, cloneItemStack } from '../src/items/ItemStackRules';
import { ItemRegistry } from '../src/items/ItemRegistry';
import { registerWildernessBound26_3 } from '../src/world/registerWildernessBound26_3';
import { applySaturationStew26_3, getSuspiciousStewEffect26_3 } from '../src/world/SuspiciousStew26_3';

registerWildernessBound26_3();
const id = (name: string) => { const value = ItemRegistry.getByName(name)?.id; assert.ok(value !== undefined, name); return value; };
const grid = (...items: number[]) => [...items, ...new Array(9).fill(0)].slice(0, 9);

test('251: current Java stew data maps legacy Dandelion to Saturation', () => {
  assert.deepEqual(getSuspiciousStewEffect26_3('yellow_flower'), { id: 'saturation', duration: 0.35, level: 1, sourceFlower: 'yellow_flower' });
});

test('252: Poppy/Torchflower stew data produces Night Vision', () => {
  assert.equal(getSuspiciousStewEffect26_3('red_flower')?.id, 'night_vision');
  assert.equal(getSuspiciousStewEffect26_3('torchflower')?.duration, 5);
});

test('253: tulips share Weakness while Wither Rose keeps Wither', () => {
  assert.equal(getSuspiciousStewEffect26_3('red_tulip')?.id, 'weakness');
  assert.equal(getSuspiciousStewEffect26_3('pink_tulip')?.duration, 7);
  assert.equal(getSuspiciousStewEffect26_3('wither_rose')?.id, 'wither');
});

test('254: crafted Suspicious Stew carries its effect and returns a bowl', () => {
  const result = findCraftingResult(grid(id('bowl'), id('shelf_mushroom'), id('brown_mushroom'), id('yellow_flower')));
  assert.equal(result?.id, id('suspicious_stew'));
  assert.equal(result?.alwaysEdible, true);
  assert.equal(result?.containerItemId, id('bowl'));
  assert.equal(result?.foodEffects?.[0]?.id, 'saturation');
});

test('255: differently flavored Suspicious Stews cannot merge', () => {
  const saturation = { id: id('suspicious_stew'), count: 1, foodEffects: [getSuspiciousStewEffect26_3('yellow_flower')!], alwaysEdible: true };
  const nightVision = { id: id('suspicious_stew'), count: 1, foodEffects: [getSuspiciousStewEffect26_3('red_flower')!], alwaysEdible: true };
  assert.equal(itemStacksCanMerge(saturation, nightVision), false);
});

test('256: stew foodEffects are deep-cloned with the stack', () => {
  const original = { id: id('suspicious_stew'), count: 1, foodEffects: [getSuspiciousStewEffect26_3('red_tulip')!] };
  const copy = cloneItemStack(original)!;
  assert.notEqual(copy.foodEffects, original.foodEffects);
  assert.notEqual(copy.foodEffects?.[0], original.foodEffects[0]);
});

test('257: Saturation stew resolves seven Java ticks into hunger and saturation', () => {
  assert.deepEqual(applySaturationStew26_3(10, 2), { hunger: 17, saturation: 16 });
  assert.deepEqual(applySaturationStew26_3(19, 19), { hunger: 20, saturation: 20 });
});

test('258: crafting UIs insert full result stacks instead of stripping components', async () => {
  const { readFile } = await import('node:fs/promises');
  for (const path of ['src/ui/CraftingTableUI.tsx', 'src/ui/InventoryUI.tsx']) {
    const source = await readFile(path, 'utf8');
    assert.match(source, /useState<ItemStack \\| null>/);
    assert.match(source, /inventory\\.addStack\\(craftResult\\)/);
  }
});
`);

console.log('Applied parity 251-258 Suspicious Stew component runtime.');
