import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  getFurnaceCookSpeed,
  getFurnaceFuelBurnTime,
  getFurnaceFuelRemainder,
  getFurnaceQuickMoveTarget,
  isFurnaceRecipeAllowed,
} from '../src/world/FurnaceRules';
import { findSmeltingResult, getFuelBurnTime } from '../src/items/SmeltingRecipes';
import { registerWildernessBound26_3 } from '../src/world/registerWildernessBound26_3';

registerWildernessBound26_3();
const gameSource = () => readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
const furnaceUiSource = () => readFileSync(new URL('../src/ui/FurnaceUI.tsx', import.meta.url), 'utf8');
const recipe = (inputId: number) => {
  const found = findSmeltingResult(inputId);
  assert.ok(found, `recipe for ${inputId}`);
  return found;
};

test('391: regular furnace accepts modeled food recipes', () => {
  const r = recipe(363);
  assert.equal(isFurnaceRecipeAllowed('furnace', 363, r.output), true);
});

test('392: regular furnace accepts modeled ore recipes', () => {
  const r = recipe(15);
  assert.equal(isFurnaceRecipeAllowed('furnace', 15, r.output), true);
});

test('393: regular furnace accepts general material recipes', () => {
  const r = recipe(12);
  assert.equal(isFurnaceRecipeAllowed('furnace', 12, r.output), true);
});

test('394: smoker accepts raw beef cooking', () => {
  const r = recipe(363);
  assert.equal(isFurnaceRecipeAllowed('smoker', 363, r.output), true);
});

test('395: smoker accepts kelp drying', () => {
  const r = recipe(30411);
  assert.equal(isFurnaceRecipeAllowed('smoker', 30411, r.output), true);
});

test('396: smoker rejects iron ore', () => {
  const r = recipe(15);
  assert.equal(isFurnaceRecipeAllowed('smoker', 15, r.output), false);
});

test('397: smoker rejects sand-to-glass smelting', () => {
  const r = recipe(12);
  assert.equal(isFurnaceRecipeAllowed('smoker', 12, r.output), false);
});

test('398: blast furnace accepts iron ore', () => {
  const r = recipe(15);
  assert.equal(isFurnaceRecipeAllowed('blast_furnace', 15, r.output), true);
});

test('399: blast furnace accepts raw iron', () => {
  const r = recipe(20229);
  assert.equal(isFurnaceRecipeAllowed('blast_furnace', 20229, r.output), true);
});

test('400: blast furnace rejects food recipes', () => {
  const r = recipe(363);
  assert.equal(isFurnaceRecipeAllowed('blast_furnace', 363, r.output), false);
});

test('401: blast furnace rejects general sand smelting', () => {
  const r = recipe(12);
  assert.equal(isFurnaceRecipeAllowed('blast_furnace', 12, r.output), false);
});

test('402: specialist furnaces retain the Java two-times cook speed', () => {
  assert.equal(getFurnaceCookSpeed('furnace'), 1);
  assert.equal(getFurnaceCookSpeed('smoker'), 2);
  assert.equal(getFurnaceCookSpeed('blast_furnace'), 2);
});

test('403: regular furnace keeps the full fuel burn duration', () => {
  assert.equal(getFurnaceFuelBurnTime('furnace', 80), 80);
});

test('404: smoker consumes the same fuel in half the wall-clock burn duration', () => {
  assert.equal(getFurnaceFuelBurnTime('smoker', 80), 40);
});

test('405: blast furnace consumes the same fuel in half the wall-clock burn duration', () => {
  assert.equal(getFurnaceFuelBurnTime('blast_furnace', 80), 40);
  assert.equal(getFurnaceFuelBurnTime('blast_furnace', 0), 0);
});

test('406: lava bucket fuel returns an empty bucket semantically', () => {
  assert.deepEqual(getFurnaceFuelRemainder({ id: 327, count: 1 }), { id: 325, count: 1 });
  assert.equal(getFuelBurnTime(327), 1000);
});

test('407: ordinary coal fuel has no crafting remainder', () => {
  assert.equal(getFurnaceFuelRemainder({ id: 263, count: 1 }), undefined);
});

test('408: quick move gives smeltable input priority over fuel', () => {
  assert.equal(getFurnaceQuickMoveTarget('player_main', { canSmelt: true, isFuel: true }), 'input');
  assert.equal(getFurnaceQuickMoveTarget('container_output', { canSmelt: false, isFuel: false }), 'player_inventory');
});

test('409: quick move routes fuel and unrelated player items like Java', () => {
  assert.equal(getFurnaceQuickMoveTarget('player_main', { canSmelt: false, isFuel: true }), 'fuel');
  assert.equal(getFurnaceQuickMoveTarget('player_main', { canSmelt: false, isFuel: false }), 'hotbar');
  assert.equal(getFurnaceQuickMoveTarget('player_hotbar', { canSmelt: false, isFuel: false }), 'main');
});

test('410: Game runtime and Furnace UI consume the same centralized station rules', () => {
  const game = gameSource();
  const ui = furnaceUiSource();
  assert.ok(game.includes('isFurnaceRecipeAllowed('));
  assert.ok(game.includes('getFurnaceFuelBurnTime('));
  assert.ok(game.includes('getFurnaceFuelRemainder('));
  assert.ok(ui.includes('const availableRecipes = useMemo('));
  assert.ok(ui.includes('getFurnaceQuickMoveTarget('));
  assert.ok(ui.includes("'player_hotbar'"));
  assert.ok(ui.includes("'player_main'"));
  assert.ok(!ui.includes("itemDef.name.includes('ore')"));
});