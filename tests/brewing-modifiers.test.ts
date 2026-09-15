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

test('redstone dust uses Java 1.20.1 potion-specific extended durations', () => {
  const modifier = POTION_MODIFIERS.find((m) => m.ingredientId === 331);
  assert.ok(modifier);
  const cases: Array<[ItemStack, number]> = [
    [strength(), 480],
    [potion('speed', 'Potion of Swiftness', { id: 'speed', level: 1, duration: 180 }), 480],
    [potion('regeneration', 'Potion of Regeneration', { id: 'regeneration', level: 1, duration: 45 }), 90],
    [potion('poison', 'Potion of Poison', { id: 'poison', level: 1, duration: 45 }), 90],
    [potion('fire_resistance', 'Potion of Fire Resistance', { id: 'fire_resistance', level: 1, duration: 180 }), 480],
    [potion('water_breathing', 'Potion of Water Breathing', { id: 'water_breathing', level: 1, duration: 180 }), 480],
    [potion('jump_boost', 'Potion of Leaping', { id: 'jump_boost', level: 1, duration: 180 }), 480],
    [potion('slowness', 'Potion of Slowness', { id: 'slowness', level: 1, duration: 90 }), 240],
  ];
  for (const [base, expectedDuration] of cases) {
    assert.ok(modifier!.matches(base));
    assert.equal(modifier!.modify(base).potion?.effect?.duration, expectedDuration);
  }
  assert.ok(!modifier!.matches(healing()), 'instant potions cannot be extended');
});

test('glowstone dust uses Java 1.20.1 strengthened durations', () => {
  const modifier = POTION_MODIFIERS.find((m) => m.ingredientId === 348);
  assert.ok(modifier);
  const cases: Array<[ItemStack, number, number]> = [
    [strength(), 2, 90],
    [potion('speed', 'Potion of Swiftness', { id: 'speed', level: 1, duration: 180 }), 2, 90],
    [potion('regeneration', 'Potion of Regeneration', { id: 'regeneration', level: 1, duration: 45 }), 2, 22],
    [potion('poison', 'Potion of Poison', { id: 'poison', level: 1, duration: 45 }), 2, 21],
    [healing(), 2, 0],
    [potion('jump_boost', 'Potion of Leaping', { id: 'jump_boost', level: 1, duration: 180 }), 2, 90],
    [potion('slowness', 'Potion of Slowness', { id: 'slowness', level: 1, duration: 90 }), 4, 20],
  ];
  for (const [base, expectedLevel, expectedDuration] of cases) {
    assert.ok(modifier!.matches(base));
    const strong = modifier!.modify(base);
    assert.equal(strong.potion?.effect?.level, expectedLevel);
    assert.equal(strong.potion?.effect?.duration, expectedDuration);
    assert.ok(!modifier!.matches(strong), 'already-strengthened potion cannot be strengthened again');
  }
});

test('glowstone rejects effects that have no stronger Java 1.20.1 potion', () => {
  const modifier = POTION_MODIFIERS.find((m) => m.ingredientId === 348)!;
  const fireResistance = potion('fire_resistance', 'Potion of Fire Resistance', { id: 'fire_resistance', level: 1, duration: 180 });
  const waterBreathing = potion('water_breathing', 'Potion of Water Breathing', { id: 'water_breathing', level: 1, duration: 180 });
  assert.equal(modifier.matches(fireResistance), false);
  assert.equal(modifier.matches(waterBreathing), false);
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

test('Java 1.20.1 base-effect recipes exclude non-brewable hunger and absorption potions', () => {
  const invalidKinds = new Set(['hunger', 'absorption']);
  assert.equal(BREWING_RECIPES.some((recipe) => invalidKinds.has(recipe.outputKind)), false);

  const brews: Array<[number, string, string]> = [
    [370, 'awkward', 'regeneration'],
    [353, 'awkward', 'speed'],
    [375, 'awkward', 'poison'],
    [377, 'awkward', 'strength'],
    [378, 'awkward', 'fire_resistance'],
    [376, 'speed', 'slowness'],
    [20218, 'awkward', 'water_breathing'],
    [414, 'awkward', 'jump_boost'],
    [382, 'awkward', 'healing'],
  ];
  for (const [ingredient, inputKind, outputKind] of brews) {
    const recipe = BREWING_RECIPES.find((r) =>
      r.ingredientId === ingredient && r.inputKind === inputKind && r.outputKind === outputKind);
    assert.ok(recipe, `recipe ${ingredient} ${inputKind} -> ${outputKind}`);
  }
});
