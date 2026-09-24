import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BlockRegistry } from '../src/world/BlockRegistry';
import { getButtonPressTicks } from '../src/world/ButtonRules';
import { isChestObstructingBlock } from '../src/world/ContainerRules';
import { getFurnaceCookSpeed } from '../src/world/FurnaceRules';
import { getOpenableKind, resolveOpenableRedstoneState } from '../src/world/OpenableRules';
import {
  applySignInteraction,
  createDefaultSignMetadata,
  getSignSideForPlayer,
  getSignTextForSide,
  setSignTextForSide,
} from '../src/world/SignRules';
import { resolveBedUse } from '../src/world/BedRules';

const gameSource = () => readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');

test('351: wooden and modern doors share the door openable family', () => {
  assert.equal(getOpenableKind('wooden_door'), 'door');
  assert.equal(getOpenableKind('poplar_door'), 'door');
});

test('352: trapdoors are resolved before the generic door suffix', () => {
  assert.equal(getOpenableKind('poplar_trapdoor'), 'trapdoor');
});

test('353: fence gates have their own openable family', () => {
  assert.equal(getOpenableKind('poplar_fence_gate'), 'fence_gate');
});

test('354: an unpowered redstone refresh preserves a manually opened block', () => {
  assert.deepEqual(resolveOpenableRedstoneState({ open: true, powered: false }, false), {
    changed: false, open: true, powered: false,
  });
});

test('355: a rising redstone edge opens an openable and records power', () => {
  assert.deepEqual(resolveOpenableRedstoneState({ open: false, powered: false }, true), {
    changed: true, open: true, powered: true,
  });
});

test('356: a falling redstone edge closes an openable', () => {
  assert.deepEqual(resolveOpenableRedstoneState({ open: true, powered: true }, false), {
    changed: true, open: false, powered: false,
  });
});

test('357: newly placed door, trapdoor and fence-gate metadata starts explicitly unpowered', () => {
  const source = gameSource();
  assert.ok(source.includes("doorHalf: 'lower',\n      hinge,\n      open: false,\n      powered: false"));
  assert.ok(source.includes('facing: hingeFacing,\n        open: false,\n        powered: false'));
  assert.ok(source.includes('facing: gateFacing,\n        open: false,\n        powered: false'));
});

test('358: lever and button changes immediately re-evaluate neighboring openables', () => {
  const source = gameSource();
  assert.ok(source.includes('this.applyRedstoneToNeighbors(position.x, position.y, position.z);'));
  assert.ok(source.includes("this.applyRedstoneToNeighbors(x, y, z);\n    this.scheduleWorldTick('block_event'"));
});

test('359: button timing matches Java game-tick durations', () => {
  assert.equal(getButtonPressTicks('oak_button'), 30);
  assert.equal(getButtonPressTicks('poplar_button'), 30);
  assert.equal(getButtonPressTicks('stone_button'), 20);
  assert.equal(getButtonPressTicks('polished_blackstone_button'), 20);
});

test('360: newly created 26.3 sign metadata has independent sides and op features disabled', () => {
  const meta = createDefaultSignMetadata();
  assert.deepEqual(meta.signTextFront, ['', '', '', '']);
  assert.deepEqual(meta.signTextBack, ['', '', '', '']);
  assert.equal(meta.signAllowOpFeatures, false);
  assert.equal(meta.signWaxed, false);
});

test('361: sign front and back text stay independent while front keeps the legacy alias', () => {
  const front = setSignTextForSide(undefined, 'front', ['front']);
  const both = setSignTextForSide(front, 'back', ['back']);
  assert.equal(getSignTextForSide(both, 'front')[0], 'front');
  assert.equal(getSignTextForSide(both, 'back')[0], 'back');
  assert.equal(both.signText?.[0], 'front');
});

test('362: wall-sign side selection follows the block facing', () => {
  assert.equal(getSignSideForPlayer('poplar_wall_sign', { facing: 'north' }, 0, 0, 0.5, -2), 'front');
  assert.equal(getSignSideForPlayer('poplar_wall_sign', { facing: 'north' }, 0, 0, 0.5, 2), 'back');
});

test('363: dye changes only the interacted sign side', () => {
  const result = applySignInteraction(undefined, 'red_dye', 'back');
  assert.equal(result.metadata.signColorFront, 'black');
  assert.equal(result.metadata.signColorBack, 'red');
  assert.equal(result.consumeItem, true);
  assert.equal(result.opensEditor, false);
});

test('364: glow ink applies glow to only the interacted side', () => {
  const sign = setSignTextForSide(undefined, 'front', ['hello']);
  const result = applySignInteraction(sign, 'glow_ink_sac', 'front');
  assert.equal(result.metadata.signGlowingFront, true);
  assert.equal(result.metadata.signGlowingBack, false);
});

test('365: ink sac removes glow from only the interacted side', () => {
  const initial = createDefaultSignMetadata({ signGlowingFront: true, signGlowingBack: true });
  const result = applySignInteraction(initial, 'ink_sac', 'back');
  assert.equal(result.metadata.signGlowingFront, true);
  assert.equal(result.metadata.signGlowingBack, false);
});

test('366: honeycomb waxes a sign and consumes one item', () => {
  const result = applySignInteraction(undefined, 'honeycomb', 'front');
  assert.equal(result.metadata.signWaxed, true);
  assert.equal(result.consumeItem, true);
  assert.equal(result.opensEditor, false);
});

test('367: waxed signs reject both editing and further styling', () => {
  const result = applySignInteraction({ signWaxed: true }, 'blue_dye', 'front');
  assert.equal(result.handled, true);
  assert.equal(result.opensEditor, false);
  assert.equal(result.consumeItem, false);
  assert.equal(result.metadata.signColorFront, 'black');
});

test('368: chest obstruction distinguishes opaque solids from transparent solids', () => {
  assert.equal(isChestObstructingBlock(BlockRegistry.getByName('stone')), true);
  assert.equal(isChestObstructingBlock(BlockRegistry.getByName('glass')), false);
  const source = gameSource();
  assert.ok(source.includes("if (block?.name === 'chest' || block?.name === 'ender_chest')"));
  assert.ok(source.includes('this.isChestBlockedAt(partners.leftPos.x'));
});

test('369: smoker and blast furnace share the Java 2x processing speed contract', () => {
  assert.equal(getFurnaceCookSpeed('furnace'), 1);
  assert.equal(getFurnaceCookSpeed('smoker'), 2);
  assert.equal(getFurnaceCookSpeed('blast_furnace'), 2);
  assert.ok(gameSource().includes('const speed = getFurnaceCookSpeed(meta.containerType);'));
});

test('370: regular beds sleep in the Overworld and explode in Nether/End', () => {
  assert.deepEqual(resolveBedUse('overworld', true), { canSleep: true, setsSpawn: true, explodes: false, blockedByMonsters: false });
  assert.deepEqual(resolveBedUse('overworld', false), { canSleep: false, setsSpawn: true, explodes: false, blockedByMonsters: false });
  assert.deepEqual(resolveBedUse('nether', true), { canSleep: false, setsSpawn: false, explodes: true, blockedByMonsters: false });
  assert.deepEqual(resolveBedUse('end', true), { canSleep: false, setsSpawn: false, explodes: true, blockedByMonsters: false });
  const source = gameSource();
  assert.ok(source.includes("this.isNight() || this.weather.getCurrentWeather() === 'thunder'"));
  assert.ok(source.includes('this.createExplosion(head.x + 0.5, head.y + 0.5, head.z + 0.5, 5);'));
});
