import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import type { ItemStack } from '../src/types';
import { cloneItemStack } from '../src/items/ItemStackRules';
import { matchesImprovedTransparencyChord26_3 } from '../src/engine/InputManager';
import { ImprovedTransparencyState26_3 } from '../src/engine/Transparency26_3';
import { ParticleSystem } from '../src/systems/ParticleSystem';
import { SoundSystem } from '../src/systems/SoundSystem';
import { fallingLeafParticle26_3 } from '../src/world/WildernessBoundChanges26_3';

test('259: ItemStack map components retain Java 26.3 facing and explorer markers', () => {
  const stack: ItemStack = { id: 358, count: 1, map: { id: 2, centerX: 0, centerZ: 0, scale: 2, dimension: 0, pixels: [], playerMarker: { x: 64, z: 64, rotation: 270 }, explorerItemName: 'abandoned_camp_map', targetMarker: { x: 70, z: 80, structure: 'abandoned_camp' } } };
  const copy = cloneItemStack(stack)!;
  assert.equal(copy.map?.playerMarker.rotation, 270);
  assert.equal(copy.map?.explorerItemName, 'abandoned_camp_map');
  assert.deepEqual(copy.map?.targetMarker, stack.map?.targetMarker);
});

test('260: open map state refreshes position and facing from the live player', () => {
  const source = readFileSync('src/engine/Game.ts', 'utf8');
  assert.match(source, /this\.maps\.updatePlayerMarker/);
  assert.match(source, /THREE\.MathUtils\.radToDeg\(this\.player\.yaw\)/);
});

test('261: default F3+X chord triggers from either keydown order', () => {
  assert.equal(matchesImprovedTransparencyChord26_3(new Set(['f3']), 'x'), true);
  assert.equal(matchesImprovedTransparencyChord26_3(new Set(['x']), 'F3'), true);
  assert.equal(matchesImprovedTransparencyChord26_3(new Set(), 'x'), false);
});

test('262: Improved Transparency chord supports a re-bound physical key', () => {
  assert.equal(matchesImprovedTransparencyChord26_3(new Set(['f3']), 'v', 'v'), true);
  assert.equal(matchesImprovedTransparencyChord26_3(new Set(['f3']), 'x', 'v'), false);
});

test('263: transparency state defaults to sorted alpha and toggles explicitly', () => {
  const state = new ImprovedTransparencyState26_3();
  assert.deepEqual(state.snapshot(), { enabled: false, backend: 'sorted-alpha', fullOit: false });
  assert.deepEqual(state.toggle(), { enabled: true, backend: 'oit-pending', fullOit: false });
});

test('264: Game routes the debug chord into the renderer toggle', () => {
  const source = readFileSync('src/engine/Game.ts', 'utf8');
  assert.match(source, /consumeImprovedTransparencyToggle26_3\(\)/);
  assert.match(source, /toggleImprovedTransparency26_3\(\)/);
});

test('265: Poplar falling leaves spawn as real scene particles', () => {
  const scene = new THREE.Scene();
  const particles = new ParticleSystem(scene);
  assert.equal(particles.spawnFallingLeaf(1, 2, 3, 0xc84b3f), true);
  assert.equal(scene.children.length, 1);
  particles.update(0.05);
  assert.ok(scene.children[0].position.y < 2);
});

test('266: Spruce remains excluded while all three Poplar leaf colors have particle ids', () => {
  assert.equal(fallingLeafParticle26_3('spruce_leaves'), null);
  for (const color of ['red', 'orange', 'yellow']) assert.equal(fallingLeafParticle26_3(`${color}_poplar_leaves`), `minecraft:${color}_poplar_leaves`);
});

test('267: live ambient scanner creates Poplar leaf sources and leaf particles', () => {
  const source = readFileSync('src/engine/Game.ts', 'utf8');
  assert.match(source, /type: 'poplar_leaves'/);
  assert.match(source, /spawnFallingLeaf/);
});

test('268: SoundSystem exposes exact-name 26.3 resource-pack sound routing', () => {
  assert.equal(typeof SoundSystem.prototype.playNamedEvent26_3, 'function');
  const source = readFileSync('src/systems/SoundSystem.ts', 'utf8');
  assert.match(source, /playFirstResourceSound\(\[eventName\]\)/);
});

test('269: Poplar ambient runtime requests the official leaves ambient event', () => {
  const source = readFileSync('src/engine/Game.ts', 'utf8');
  assert.match(source, /block\.poplar_leaves\.ambient/);
});

test('270: Improved Transparency remains explicitly partial until a real OIT pass exists', () => {
  const state = new ImprovedTransparencyState26_3();
  assert.equal(state.set(true).fullOit, false);
  const manifest = JSON.parse(readFileSync('docs/parity-manifest.json', 'utf8'));
  assert.equal(manifest.axes.visualModels.state, 'partial');
});
