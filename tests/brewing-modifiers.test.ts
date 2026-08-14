import assert from 'node:assert/strict';
import test from 'node:test';
import { BREWING_RECIPES, BrewingSystem, POTION_MODIFIERS } from '../src/systems/BrewingSystem';
import type { ItemStack } from '../src/types';

function potion(kind: string, name: string, effect?: { id: string; level: number; duration: number }, variant?: 'normal' | 'splash' | 'lingering'): ItemStack {
  return {
    id: 373,
    count: 1,
    potion: {
      kind: kind as any,
      name,
      effect: effect as any,
      variant,
    },
  };
}

const strength = () => potion('strength', 'Potion of Strength', { id: 'strength', level: 1, duration: 180 });
const healing = () => potion('healing', 'Potion of Healing', { id: 'healing', level: 1, duration: 0 });

// ─── Modifier recipes (P3.4) ───

test('redstone dust extends potion duration', () => {
  const modifier = POTION_MODIFIERS.find((m) => m.ingredientId === 331);
  assert.ok(modifier);
  assert.ok(modifier!.matches(strength()));
  const extended = modifier!.modify(strength());
  assert.equal(extended.potion?.effect?.duration, 360);
  assert.ok(extended.potion?.name?.includes('Extended'));
  // Instant potions (duration 0) cannot be extended.
  assert.ok(!modifier!.matches(healing()));
});

test('glowstone dust strengthens to level II with reduced duration', () => {
  const modifier = POTION_MODIFIERS.find((m) => m.ingredientId === 348);
  assert.ok(modifier);
  assert.ok(modifier!.matches(strength()));
  const strong = modifier!.modify(strength());
  assert.equal(strong.potion?.effect?.level, 2);
  assert.equal(strong.potion?.effect?.duration, 60);
  // Level II potions cannot be strengthened further.
  assert.ok(!modifier!.matches(strong));
});

test('gunpowder makes a splash potion', () => {
  const modifier = POTION_MODIFIERS.find((m) => m.ingredientId === 289);
  assert.ok(modifier);
  assert.ok(modifier!.matches(strength()));
  const splash = modifier!.modify(strength());
  assert.equal(splash.potion?.variant, 'splash');
  // Lingering potions cannot be re-splashed.
  const lingering = potion('strength', 'Lingering Potion of Strength', { id: 'strength', level: 1, duration: 180 }, 'lingering');
  assert.ok(!modifier!.matches(lingering));
});

test("dragon's breath turns splash into lingering", () => {
  const modifier = POTION_MODIFIERS.find((m) => m.ingredientId === 437);
  assert.ok(modifier);
  const splash = potion('strength', 'Splash Potion of Strength', { id: 'strength', level: 1, duration: 180 }, 'splash');
  assert.ok(modifier!.matches(splash));
  const lingering = modifier!.modify(splash);
  assert.equal(lingering.potion?.variant, 'lingering');
  assert.ok(!modifier!.matches(strength()), 'normal potions are not lingering-able');
});

// ─── Brew action resolution (P3.4) ───

test('findBrewAction resolves modifiers before base recipes', () => {
  const bottles = [strength()];
  const redstoneAction = BrewingSystem.findBrewAction({ id: 331, count: 1 }, bottles);
  assert.ok(redstoneAction && redstoneAction.kind === 'modify');

  const awkward = potion('awkward', 'Awkward Potion');
  const blazeAction = BrewingSystem.findBrewAction({ id: 377, count: 1 }, [awkward]);
  assert.ok(blazeAction && blazeAction.kind === 'brew');
  assert.equal(blazeAction.kind === 'brew' ? blazeAction.recipe.outputKind : '', 'strength');
});

test('base recipes still produce normal potions', () => {
  const awkward = potion('awkward', 'Awkward Potion');
  const recipe = BrewingSystem.findRecipe({ id: 377, count: 1 }, [awkward]);
  assert.ok(recipe);
  const brewed = BrewingSystem.brewBottle(awkward, recipe!);
  assert.equal(brewed.potion?.kind, 'strength');
  assert.equal(brewed.potion?.variant, undefined, 'base brews are normal potions');
});

test('brewBottle preserves a splash variant through base brewing', () => {
  const splashAwkward = potion('awkward', 'Splash Awkward Potion', undefined, 'splash');
  const recipe = BrewingSystem.findRecipe({ id: 377, count: 1 }, [splashAwkward]);
  assert.ok(recipe);
  const brewed = BrewingSystem.brewBottle(splashAwkward, recipe!);
  assert.equal(brewed.potion?.variant, 'splash');
});

test('modifier chain gunpowder -> dragon breath -> brew stays coherent', () => {
  const gunpowder = POTION_MODIFIERS.find((m) => m.ingredientId === 289)!;
  const breath = POTION_MODIFIERS.find((m) => m.ingredientId === 437)!;
  const splash = gunpowder.modify(strength());
  const lingering = breath.modify(splash);
  assert.equal(lingering.potion?.variant, 'lingering');
  assert.equal(lingering.potion?.effect?.level, 1);
  assert.equal(lingering.potion?.effect?.duration, 180);
});

test('all new base-effect recipes remain brewable', () => {
  const brews: Array<[number, string, string]> = [
    [370, 'awkward', 'regeneration'],
    [353, 'awkward', 'speed'],
    [375, 'awkward', 'poison'],
    [377, 'awkward', 'strength'],
    [378, 'awkward', 'fire_resistance'],
    [376, 'awkward', 'hunger'],
    [376, 'speed', 'slowness'],
    [20218, 'awkward', 'water_breathing'],
    [414, 'awkward', 'jump_boost'],
    [322, 'awkward', 'absorption'],
    [382, 'awkward', 'healing'],
  ];
  for (const [ingredient, inputKind, outputKind] of brews) {
    const recipe = BREWING_RECIPES.find((r) =>
      r.ingredientId === ingredient && r.inputKind === inputKind && r.outputKind === outputKind);
    assert.ok(recipe, `recipe ${ingredient} ${inputKind} -> ${outputKind}`);
  }
});
