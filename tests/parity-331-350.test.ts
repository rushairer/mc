import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BlockRegistry } from '../src/world/BlockRegistry';
import { ItemRegistry } from '../src/items/ItemRegistry';
import { createBlockStateSchema } from '../src/world/BlockState';
import { inferBlockBehaviorId } from '../src/world/BehaviorIds';
import { getButtonPressTicks } from '../src/world/ButtonRules';
import { planBlockPlacement } from '../src/world/BlockPlacement';
import { getWallSignVariantName, isHangingSignBlockName, isSignBlockName, isWallSignBlockName } from '../src/world/SignRules';
import { VisualResolver } from '../src/visual/VisualResolver';
import { EXPLORER_MAP_NAMES } from '../src/world/WildernessBound26_3';
import { registerWildernessBound26_3 } from '../src/world/registerWildernessBound26_3';

registerWildernessBound26_3();

const item = (name: string) => {
  const def = ItemRegistry.getByName(name);
  assert.ok(def, name);
  return def;
};
const block = (name: string) => {
  const def = BlockRegistry.getByName(name);
  assert.ok(def, name);
  return def;
};
const world = {
  getBlock: () => 0,
  getBlockMetadata: () => undefined,
};
const target = (face: 'up' | 'down' | 'north') => ({
  position: { x: 10, y: 64, z: 10 },
  face,
  blockId: 1,
  block: BlockRegistry.get(1)!,
  heldItem: null,
});
const place = (name: string, face: 'up' | 'down' | 'north') => {
  const def = item(name);
  return planBlockPlacement({ item: def, target: target(face), placeBlockId: def.placeBlockId, playerOccupiedCells: [] }, world);
};

test('331: Ocean Monument Map exposes its own 26.3 icon key', () => {
  assert.equal(VisualResolver.getItemIconKey(item('ocean_monument_map').id), 'item:ocean_monument_map');
});
test('332: all sixteen 26.3 explorer maps have distinct icon identities', () => {
  const keys = EXPLORER_MAP_NAMES.map((name) => VisualResolver.getItemIconKey(item(name).id));
  assert.equal(new Set(keys).size, EXPLORER_MAP_NAMES.length);
});
test('333: explorer maps stay non-stackable readable items', () => {
  for (const name of EXPLORER_MAP_NAMES) {
    const def = item(name);
    assert.equal(def.maxStackSize, 1, name);
    assert.equal(def.behaviorId, 'minecraft:readable', name);
  }
});
test('334: atlas contains a dedicated explorer-map drawing branch', () => {
  const source = readFileSync(new URL('../src/engine/TextureAtlas.ts', import.meta.url), 'utf8');
  assert.ok(source.includes("name === 'filled_map' || name.endsWith('_map')"));
  assert.ok(source.includes('Java 26.3 explorer maps are distinct items with distinct icons'));
});
test('335: sign family predicate covers legacy standing and wall signs', () => {
  assert.equal(isSignBlockName('standing_sign'), true);
  assert.equal(isSignBlockName('wall_sign'), true);
  assert.equal(isWallSignBlockName('wall_sign'), true);
});
test('336: Poplar standing sign resolves its wall variant', () => {
  assert.equal(getWallSignVariantName('poplar_sign'), 'poplar_wall_sign');
});
test('337: Poplar hanging sign resolves its wall-hanging variant', () => {
  assert.equal(isHangingSignBlockName('poplar_hanging_sign'), true);
  assert.equal(getWallSignVariantName('poplar_hanging_sign'), 'poplar_wall_hanging_sign');
});
test('338: sign blocks route through a stable sign behavior id', () => {
  assert.equal(inferBlockBehaviorId('standing_sign'), 'minecraft:sign');
  assert.equal(inferBlockBehaviorId('wall_sign'), 'minecraft:sign');
});
test('339: Poplar sign variants all route through sign behavior', () => {
  for (const name of ['poplar_sign', 'poplar_wall_sign', 'poplar_hanging_sign', 'poplar_wall_hanging_sign']) {
    assert.equal(block(name).behaviorId, 'minecraft:sign', name);
  }
});
test('340: Poplar fence gate routes through fence-gate behavior', () => {
  assert.equal(block('poplar_fence_gate').behaviorId, 'minecraft:fence_gate');
});
test('341: Poplar door and trapdoor route through hand-interaction behaviors', () => {
  assert.equal(block('poplar_door').behaviorId, 'minecraft:door');
  assert.equal(block('poplar_trapdoor').behaviorId, 'minecraft:trapdoor');
});
test('342: Poplar button uses the wooden Java press duration', () => {
  assert.equal(block('poplar_button').behaviorId, 'minecraft:button');
  assert.equal(getButtonPressTicks('poplar_button'), 30);
});
test('343: fence gates expose gate state rather than fence connections', () => {
  const schema = createBlockStateSchema('oak_fence_gate');
  assert.ok(schema);
  assert.deepEqual(Object.keys(schema.properties).sort(), ['facing', 'in_wall', 'open', 'powered']);
});
test('344: Poplar fence gate gets the same state schema', () => {
  const schema = block('poplar_fence_gate').stateSchema;
  assert.ok(schema);
  assert.equal(schema.properties.open?.defaultValue, false);
  assert.equal(schema.properties.powered?.defaultValue, false);
  assert.equal(schema.properties.facing?.defaultValue, 'north');
});
test('345: top placement of Poplar Sign stays standing and opens editor', () => {
  const decision = place('poplar_sign', 'up');
  assert.equal(decision.ok, true);
  if (decision.ok) {
    assert.equal(decision.plan.blockId, block('poplar_sign').id);
    assert.equal(decision.plan.opensSignEditor, true);
  }
});
test('346: side placement of Poplar Sign resolves Poplar Wall Sign', () => {
  const decision = place('poplar_sign', 'north');
  assert.equal(decision.ok, true);
  if (decision.ok) {
    assert.equal(decision.plan.blockId, block('poplar_wall_sign').id);
    assert.equal(decision.plan.opensSignEditor, true);
  }
});
test('347: normal signs cannot be attached to the underside of a block', () => {
  const decision = place('poplar_sign', 'down');
  assert.deepEqual(decision, { ok: false, reason: 'unsupported_face' });
});
test('348: underside placement keeps the ceiling Poplar Hanging Sign variant', () => {
  const decision = place('poplar_hanging_sign', 'down');
  assert.equal(decision.ok, true);
  if (decision.ok) {
    assert.equal(decision.plan.blockId, block('poplar_hanging_sign').id);
    assert.equal(decision.plan.opensSignEditor, true);
  }
});
test('349: side placement resolves Poplar Wall Hanging Sign', () => {
  const decision = place('poplar_hanging_sign', 'north');
  assert.equal(decision.ok, true);
  if (decision.ok) {
    assert.equal(decision.plan.blockId, block('poplar_wall_hanging_sign').id);
    assert.equal(decision.plan.opensSignEditor, true);
  }
});
test('350: live Game wires sign interaction and existing text back into editor', () => {
  const game = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.ok(game.includes("id: 'minecraft:sign'"));
  assert.ok(game.includes('getEditingSignText(): string[]'));
  assert.ok(app.includes('initialLines={gameRef.current?.getEditingSignText()'));
});
