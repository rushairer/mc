import assert from 'node:assert/strict';
import test from 'node:test';
import { ItemRegistry } from '../src/items/ItemRegistry';
import {
  EFFECT_DEFS,
  PotionEffectSystem,
  PotionEffects,
  UNDEAD_MOB_TYPES,
  type PotionEffectId,
} from '../src/systems/PotionEffect';
import { EnchantSystem, type EnchantmentId } from '../src/systems/EnchantSystem';
import { BREWING_RECIPES, BrewingSystem } from '../src/systems/BrewingSystem';
import type { ItemStack } from '../src/types';

// ─── Effect registry (P3.3) ───

test('effect registry covers the 1.20.1 core set', () => {
  const expected: PotionEffectId[] = [
    'healing', 'regeneration', 'speed', 'fire_resistance', 'poison',
    'wither', 'levitation', 'strength', 'weakness', 'slowness', 'hunger',
    'jump_boost', 'water_breathing', 'absorption', 'resistance',
  ];
  for (const id of expected) {
    assert.ok(EFFECT_DEFS[id], `effect ${id} registered`);
  }
  assert.equal(EFFECT_DEFS.healing.instant, true);
  assert.equal(EFFECT_DEFS.regeneration.tickInterval, 2.0);
  assert.equal(EFFECT_DEFS.wither.lethalDamage, true);
});

test('effect modifiers follow Java 1.20.1 values', () => {
  assert.equal(PotionEffects.getMeleeDamageModifier(1, 0), 3, 'Strength I +3');
  assert.equal(PotionEffects.getMeleeDamageModifier(2, 0), 6);
  assert.equal(PotionEffects.getMeleeDamageModifier(0, 1), -4, 'Weakness I -4');
  assert.equal(PotionEffects.getSpeedMultiplier(1, 0), 1.2);
  assert.equal(PotionEffects.getSpeedMultiplier(0, 1), 0.85);
  assert.equal(PotionEffects.getResistanceReduction(2), 0.4);
});

test('potion system applies, ticks and expires effects', () => {
  const system = new PotionEffectSystem();
  system.apply({ id: 'regeneration', level: 1, duration: 5 }, () => {});
  assert.equal(system.getLevel('regeneration'), 1);
  assert.equal(system.has('regeneration'), true);

  let healed = 0;
  let damaged = 0;
  // 2s tick interval: 4.1s → two ticks.
  system.update(2.1, (a) => { healed += a; }, (a) => { damaged += a; });
  system.update(2.0, (a) => { healed += a; }, (a) => { damaged += a; });
  assert.equal(healed, 2);
  assert.equal(damaged, 0);

  // 5s duration expires after the two updates (2.1 + 2.0 < 5 + one more).
  system.update(1.0, () => {}, () => {});
  assert.equal(system.has('regeneration'), false);
});

test('undead set drives Smite', () => {
  assert.ok(UNDEAD_MOB_TYPES.has('zombie'));
  assert.ok(UNDEAD_MOB_TYPES.has('skeleton'));
  assert.ok(UNDEAD_MOB_TYPES.has('wither'));
  assert.ok(!UNDEAD_MOB_TYPES.has('creeper'));
});

// ─── Enchantment registry (P3.3) ───

function stack(id: number): ItemStack {
  return { id, count: 1 };
}

test('enchantment registry exposes 20 enchantments with value functions', () => {
  const ids: EnchantmentId[] = [
    'sharpness', 'efficiency', 'protection', 'unbreaking', 'power', 'punch',
    'flame', 'fire_aspect', 'knockback', 'smite', 'looting', 'fortune',
    'silk_touch', 'feather_falling', 'thorns', 'projectile_protection',
    'blast_protection', 'fire_protection', 'respiration', 'depth_strider',
  ];
  for (const id of ids) {
    assert.ok(EnchantSystem.getDefinition(id), `enchantment ${id} registered`);
  }
  assert.equal(EnchantSystem.getPowerMultiplier(5), 2.25);
  assert.equal(EnchantSystem.getSmiteBonus(2), 5);
  assert.equal(EnchantSystem.getFireTicks(2), 8);
  assert.ok(Math.abs(EnchantSystem.getThornsChance(3) - 0.45) < 1e-9);
  assert.equal(EnchantSystem.getFeatherFallingReduction(4), 0.48);
});

test('enchantments apply to the right item categories', () => {
  const sword = ItemRegistry.getByName('diamond_sword');
  const bow = ItemRegistry.getByName('bow');
  const pickaxe = ItemRegistry.getByName('iron_pickaxe');
  const boots = ItemRegistry.getByName('iron_boots');
  assert.ok(sword && bow && pickaxe && boots);

  const swordEnch = new Set(EnchantSystem.getApplicableEnchantments(stack(sword.id)));
  assert.ok(swordEnch.has('sharpness'));
  assert.ok(swordEnch.has('smite'));
  assert.ok(swordEnch.has('fire_aspect'));
  assert.ok(swordEnch.has('knockback'));
  assert.ok(swordEnch.has('looting'));
  assert.ok(!swordEnch.has('power'));

  const bowEnch = new Set(EnchantSystem.getApplicableEnchantments(stack(bow.id)));
  assert.ok(bowEnch.has('power'));
  assert.ok(bowEnch.has('punch'));
  assert.ok(bowEnch.has('flame'));
  assert.ok(!bowEnch.has('sharpness'));

  const pickEnch = new Set(EnchantSystem.getApplicableEnchantments(stack(pickaxe.id)));
  assert.ok(pickEnch.has('fortune'));
  assert.ok(pickEnch.has('silk_touch'));
  assert.ok(pickEnch.has('efficiency'));

  const armorEnch = new Set(EnchantSystem.getApplicableEnchantments(stack(boots.id)));
  assert.ok(armorEnch.has('protection'));
  assert.ok(armorEnch.has('thorns'));
  assert.ok(armorEnch.has('feather_falling'));
  assert.ok(armorEnch.has('respiration'));
  assert.ok(armorEnch.has('depth_strider'));
});

test('getArmorLevel finds the highest enchantment across armor', () => {
  const armor = [
    { id: 298, count: 1, enchantments: [{ id: 'thorns' as const, level: 2 }] },
    { id: 302, count: 1, enchantments: [{ id: 'thorns' as const, level: 1 }] },
  ];
  assert.equal(EnchantSystem.getArmorLevel(armor, 'thorns'), 2);
  assert.equal(EnchantSystem.getArmorLevel(armor, 'protection'), 0);
});

// ─── Brewing integration (P3.3) ───

test('new effects are brewable through data-driven recipes', () => {
  const brews: Array<[number, string, string]> = [
    [377, 'awkward', 'strength'],
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

test('BrewingSystem round-trips a strength potion', () => {
  const bottle: ItemStack = { id: 373, count: 1, potion: { kind: 'awkward', name: 'Awkward Potion' } };
  const recipe = BrewingSystem.findRecipe({ id: 377, count: 1 }, [bottle]);
  assert.ok(recipe);
  const brewed = BrewingSystem.brewBottle(bottle, recipe!);
  assert.equal(brewed.potion?.kind, 'strength');
  assert.equal(brewed.potion?.effect?.id, 'strength');
  assert.equal(brewed.potion?.effect?.level, 1);
});
