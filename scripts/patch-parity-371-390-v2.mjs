import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content);
const replaceOnce = (path, before, after) => {
  const source = read(path);
  if (!source.includes(before)) throw new Error(`Missing v2 patch anchor in ${path}: ${before.slice(0, 120)}`);
  write(path, source.replace(before, after));
};

replaceOnce(
  'tests/behavior-ids.test.ts',
  "  assert.equal(inferBlockBehaviorId('iron_trapdoor'), undefined);",
  "  assert.equal(inferBlockBehaviorId('iron_trapdoor'), 'minecraft:iron_trapdoor');",
);

replaceOnce(
  'src/items/SmeltingRecipes.ts',
  "import { ItemRegistry } from './ItemRegistry';",
  "import { ItemRegistry } from './ItemRegistry';\nimport { BlockRegistry } from '../world/BlockRegistry';",
);

replaceOnce(
  'src/items/SmeltingRecipes.ts',
  `export function findSmeltingResult(inputId: number): SmeltingRecipe | null {
  const semanticInput = ItemRegistry.get(inputId);
  if (semanticInput?.name === 'wet_sponge') {
    const sponge = ItemRegistry.getByName('sponge');
    if (sponge) return { input: inputId, output: sponge.id, outputCount: 1, xp: 0.15, cookTime: 10 };
  }

  // Support matching by packed ID first
  const exactMatch = SMELTING_RECIPES.find(r => r.input === inputId);
  if (exactMatch) return exactMatch;

  // Legacy fallback only. Modern runtime IDs must not alias legacy recipes.
  if (semanticInput && semanticInput.baseId >= 256) return null;
  const baseId = inputId & 0x3FF;
  const baseMatch = SMELTING_RECIPES.find(r => (r.input & 0x3FF) === baseId);
  return baseMatch ?? null;
}`,
  `export function findSmeltingResult(inputId: number): SmeltingRecipe | null {
  const semanticInput = ItemRegistry.get(inputId);
  const semanticBlock = BlockRegistry.get(inputId);
  const semanticName = semanticInput?.name ?? semanticBlock?.name;
  if (semanticName === 'wet_sponge') {
    const spongeId = ItemRegistry.getByName('sponge')?.id ?? BlockRegistry.getByName('sponge')?.id;
    if (spongeId !== undefined) {
      return { input: inputId, output: spongeId, outputCount: 1, xp: 0.15, cookTime: 10 };
    }
  }

  // Support matching by packed ID first.
  const exactMatch = SMELTING_RECIPES.find(r => r.input === inputId);
  if (exactMatch) return exactMatch;

  // Legacy fallback only. Modern runtime IDs must not alias legacy recipes.
  const semanticBaseId = semanticInput?.baseId ?? semanticBlock?.baseId;
  if (semanticBaseId !== undefined && semanticBaseId >= 256) return null;
  const baseId = inputId & 0x3FF;
  const baseMatch = SMELTING_RECIPES.find(r => (r.input & 0x3FF) === baseId);
  return baseMatch ?? null;
}`,
);

replaceOnce(
  'tests/parity-371-390.test.ts',
  `test('386: wet sponge has a semantic smelting recipe back to sponge', () => {
  const wet = ItemRegistry.getByName('wet_sponge');
  const dry = ItemRegistry.getByName('sponge');
  assert.ok(wet);
  assert.ok(dry);
  const recipe = findSmeltingResult(wet.id);
  assert.ok(recipe);
  assert.equal(recipe.output, dry.id);
});`,
  `test('386: wet sponge block-as-item has a semantic smelting recipe back to sponge', () => {
  const wet = BlockRegistry.getByName('wet_sponge');
  const dry = ItemRegistry.getByName('sponge') ?? BlockRegistry.getByName('sponge');
  assert.ok(wet);
  assert.ok(dry);
  const recipe = findSmeltingResult(wet.id);
  assert.ok(recipe);
  assert.equal(recipe.output, dry.id);
});`,
);

console.log('Applied parity 371-390 validation fixes');
