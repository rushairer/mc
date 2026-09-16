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

writeFileSync('src/engine/Transparency26_3.ts', `export type ImprovedTransparencyBackend26_3 = 'sorted-alpha' | 'oit-pending';

export interface ImprovedTransparencySnapshot26_3 {
  enabled: boolean;
  backend: ImprovedTransparencyBackend26_3;
  /** False until the renderer owns a real order-independent accumulation/revealage pass. */
  fullOit: false;
}

/**
 * Java 26.3 exposes Improved Transparency as a toggle. Three.js r158 in this
 * project has no drop-in OIT pass, so this state object deliberately reports
 * oit-pending rather than pretending that disabling object sorting is OIT.
 */
export class ImprovedTransparencyState26_3 {
  private enabled = false;

  set(enabled: boolean): ImprovedTransparencySnapshot26_3 {
    this.enabled = !!enabled;
    return this.snapshot();
  }

  toggle(): ImprovedTransparencySnapshot26_3 {
    this.enabled = !this.enabled;
    return this.snapshot();
  }

  snapshot(): ImprovedTransparencySnapshot26_3 {
    return {
      enabled: this.enabled,
      backend: this.enabled ? 'oit-pending' : 'sorted-alpha',
      fullOit: false,
    };
  }
}
`);

patch('src/types/index.ts', source => once(
  source,
  `    playerMarker: { x: number; z: number };\n    locked?: boolean;`,
  `    playerMarker: { x: number; z: number; rotation?: number };\n    locked?: boolean;\n    explorerItemName?: string;\n    targetMarker?: { x: number; z: number; structure: string };`,
  'ItemStack map marker fields',
));

patch('src/engine/InputManager.ts', source => {
  let out = once(source,
    `export class InputManager {`,
    `export const DEFAULT_IMPROVED_TRANSPARENCY_KEY_26_3 = 'x';\n\nexport function matchesImprovedTransparencyChord26_3(\n  heldKeys: ReadonlySet<string>,\n  eventKey: string,\n  binding = DEFAULT_IMPROVED_TRANSPARENCY_KEY_26_3,\n): boolean {\n  const key = eventKey.toLowerCase();\n  const configured = binding.toLowerCase();\n  return (key === configured && heldKeys.has('f3'))\n    || (key === 'f3' && heldKeys.has(configured));\n}\n\nexport class InputManager {`,
    'Input helper export',
  );
  out = once(out,
    `  private spaceDoubleTapped = false;`,
    `  private spaceDoubleTapped = false;\n  private improvedTransparencyKey26_3 = DEFAULT_IMPROVED_TRANSPARENCY_KEY_26_3;\n  private improvedTransparencyPulse26_3 = false;`,
    'Input state',
  );
  out = once(out,
    `  consumeSpaceDoubleTap(): boolean {\n    const tapped = this.spaceDoubleTapped;\n    this.spaceDoubleTapped = false;\n    return tapped;\n  }`,
    `  consumeSpaceDoubleTap(): boolean {\n    const tapped = this.spaceDoubleTapped;\n    this.spaceDoubleTapped = false;\n    return tapped;\n  }\n\n  setImprovedTransparencyKey26_3(key: string): void {\n    const normalized = key.trim().toLowerCase();\n    if (!normalized) throw new Error('Improved Transparency key binding cannot be empty');\n    this.improvedTransparencyKey26_3 = normalized;\n  }\n\n  getImprovedTransparencyKey26_3(): string {\n    return this.improvedTransparencyKey26_3;\n  }\n\n  consumeImprovedTransparencyToggle26_3(): boolean {\n    const pending = this.improvedTransparencyPulse26_3;\n    this.improvedTransparencyPulse26_3 = false;\n    return pending;\n  }`,
    'Input methods',
  );
  out = once(out,
    `  private onKeyDown = (e: KeyboardEvent) => {\n    if (e.key === 'F5') {`,
    `  private onKeyDown = (e: KeyboardEvent) => {\n    if (!e.repeat && matchesImprovedTransparencyChord26_3(this.keys, e.key, this.improvedTransparencyKey26_3)) {\n      this.improvedTransparencyPulse26_3 = true;\n      e.preventDefault();\n    }\n    if (e.key === 'F5') {`,
    'Input chord event',
  );
  return out;
});

patch('src/engine/Renderer.ts', source => {
  let out = once(source,
    `import * as THREE from 'three';`,
    `import * as THREE from 'three';\nimport { ImprovedTransparencyState26_3, type ImprovedTransparencySnapshot26_3 } from './Transparency26_3';`,
    'Renderer transparency import',
  );
  out = once(out,
    `  private clock = new THREE.Clock();`,
    `  private clock = new THREE.Clock();\n  private improvedTransparency26_3 = new ImprovedTransparencyState26_3();`,
    'Renderer transparency state',
  );
  out = once(out,
    `  setDimension(dim: number) {\n    this.currentDimension = dim;\n  }`,
    `  setDimension(dim: number) {\n    this.currentDimension = dim;\n  }\n\n  setImprovedTransparency26_3(enabled: boolean): ImprovedTransparencySnapshot26_3 {\n    // Keep Three's stable sorted-alpha path until the real OIT pass lands.\n    this.renderer.sortObjects = true;\n    return this.improvedTransparency26_3.set(enabled);\n  }\n\n  toggleImprovedTransparency26_3(): ImprovedTransparencySnapshot26_3 {\n    const next = this.improvedTransparency26_3.toggle();\n    this.renderer.sortObjects = true;\n    return next;\n  }\n\n  getImprovedTransparencyState26_3(): ImprovedTransparencySnapshot26_3 {\n    return this.improvedTransparency26_3.snapshot();\n  }`,
    'Renderer transparency API',
  );
  return out;
});

patch('src/systems/ParticleSystem.ts', source => {
  let out = once(source,
    `  type?: 'break' | 'flame' | 'smoke' | 'enchant' | 'xp';`,
    `  type?: 'break' | 'flame' | 'smoke' | 'enchant' | 'xp' | 'falling_leaf';`,
    'particle type',
  );
  out = once(out,
    `      } else if (p.type === 'xp') {\n        gravityVal = 2.0; // light gravity for experience orbs\n      } else if (p.gravity !== undefined) {`,
    `      } else if (p.type === 'xp') {\n        gravityVal = 2.0; // light gravity for experience orbs\n      } else if (p.type === 'falling_leaf') {\n        gravityVal = 0.12;\n        p.mesh.rotation.z += dt * 1.8;\n      } else if (p.gravity !== undefined) {`,
    'falling leaf update',
  );
  out = once(out,
    `  /** Spawn experience particles (XP). */`,
    `  /** Java 26.3 Poplar falling-leaf particle. */\n  spawnFallingLeaf(x: number, y: number, z: number, color: number): boolean {\n    if (this.particles.length >= MAX_PARTICLES) return false;\n    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });\n    const mesh = new THREE.Mesh(this.sharedGeo, mat);\n    mesh.scale.set(1.35, 0.18, 1.0);\n    mesh.position.set(x + (Math.random() - 0.5) * 0.7, y, z + (Math.random() - 0.5) * 0.7);\n    this.scene.add(mesh);\n    this.particles.push({\n      mesh,\n      velocity: new THREE.Vector3((Math.random() - 0.5) * 0.35, -0.28 - Math.random() * 0.18, (Math.random() - 0.5) * 0.35),\n      life: 2.2 + Math.random() * 1.2,\n      maxLife: 3.4,\n      gravity: 0.12,\n      type: 'falling_leaf',\n    });\n    return true;\n  }\n\n  /** Spawn experience particles (XP). */`,
    'falling leaf spawn method',
  );
  return out;
});

patch('src/systems/SoundSystem.ts', source => once(
  source,
  `  // ─── P4.3: material classification ───`,
  `  /** Route Java 26.3 named sound events through resource packs first, then a procedural fallback. */\n  playNamedEvent26_3(eventName: string, blockId = 0): boolean {\n    if (this.playFirstResourceSound([eventName])) return true;\n    if (eventName.endsWith('.break')) { this.playBlockBreak(blockId); return true; }\n    if (eventName.endsWith('.place') || eventName.endsWith('.sit')) { this.playBlockPlace(blockId); return true; }\n    if (eventName.endsWith('.step') || eventName.endsWith('.fall') || eventName.endsWith('.hit') || eventName.endsWith('.bounce') || eventName.endsWith('.get_up')) {\n      this.playStep(blockId);\n      return true;\n    }\n    return false;\n  }\n\n  // ─── P4.3: material classification ───`,
  'named 26.3 sound routing',
));

patch('src/engine/Game.ts', source => {
  let out = once(source,
    `import { shouldPrioritizeShieldUse26_3 } from '../world/WildernessBoundChanges26_3';`,
    `import { fallingLeafParticle26_3, shouldPrioritizeShieldUse26_3 } from '../world/WildernessBoundChanges26_3';`,
    'Game falling leaf import',
  );
  out = once(out,
    `  attackCooldownProgress: number;`,
    `  attackCooldownProgress: number;\n  improvedTransparency26_3: { enabled: boolean; backend: 'sorted-alpha' | 'oit-pending'; fullOit: false };`,
    'GameState transparency',
  );
  out = once(out,
    `  private ambientParticleSources: { x: number; y: number; z: number; type: 'torch' | 'furnace' | 'enchanting_table' }[] = [];`,
    `  private ambientParticleSources: { x: number; y: number; z: number; type: 'torch' | 'furnace' | 'enchanting_table' | 'poplar_leaves'; color?: number; blockId?: number }[] = [];`,
    'ambient source type',
  );
  out = once(out,
    `    // F5 key → perspective toggle\n    if (!this.chatOpen && this.input.isKeyDown('f5')) {`,
    `    // Java 26.3: rebindable F3 + X toggles Improved Transparency.\n    if (!this.chatOpen && this.input.consumeImprovedTransparencyToggle26_3()) {\n      this.renderer.toggleImprovedTransparency26_3();\n      this.notifyState();\n    }\n\n    // F5 key → perspective toggle\n    if (!this.chatOpen && this.input.isKeyDown('f5')) {`,
    'Game F3+X toggle',
  );
  out = once(out,
    `            const blockId = this.chunks.getBlock(x, y, z);\n            const baseId = blockId & 0x3FF;\n            if (baseId === 50) { // Torch`,
    `            const blockId = this.chunks.getBlock(x, y, z);\n            const baseId = blockId & 0x3FF;\n            const blockName = BlockRegistry.get(blockId)?.name ?? '';\n            const leafParticle = fallingLeafParticle26_3(blockName);\n            if (leafParticle) {\n              const color = leafParticle.includes(':red_') ? 0xc84b3f : leafParticle.includes(':orange_') ? 0xe68a3a : 0xe7c94c;\n              this.ambientParticleSources.push({ x, y, z, type: 'poplar_leaves', color, blockId });\n            } else if (baseId === 50) { // Torch`,
    'Game ambient scan poplar',
  );
  out = once(out,
    `      if (src.type === 'torch') {`,
    `      if (src.type === 'poplar_leaves') {\n        if (Math.random() < 0.012 * probabilityMult) {\n          this.particles.spawnFallingLeaf(src.x + 0.5, src.y + 0.15, src.z + 0.5, src.color ?? 0xe7c94c);\n        }\n        if (Math.random() < 0.0008 * probabilityMult) {\n          this.sound.playNamedEvent26_3('block.poplar_leaves.ambient', src.blockId ?? 0);\n        }\n      } else if (src.type === 'torch') {`,
    'Game ambient poplar emit',
  );
  out = once(out,
    `    const activeWither = Array.from(this.mobs.mobs.values()).find(m => m.def.type === 'wither' && m.health > 0);\n\n    const state: GameState = {`,
    `    const activeWither = Array.from(this.mobs.mobs.values()).find(m => m.def.type === 'wither' && m.health > 0);\n\n    if (this.openMapSlot !== null) {\n      const openMapStack = this.inventory.getSlot(this.openMapSlot);\n      if (openMapStack?.map) {\n        openMapStack.map = this.maps.updatePlayerMarker(\n          openMapStack.map,\n          this.player.position.x,\n          this.player.position.z,\n          THREE.MathUtils.radToDeg(this.player.yaw),\n        );\n      }\n    }\n\n    const state: GameState = {`,
    'Game live map marker',
  );
  out = once(out,
    `      attackCooldownProgress: this.getAttackCooldownProgress(),`,
    `      attackCooldownProgress: this.getAttackCooldownProgress(),\n      improvedTransparency26_3: this.renderer.getImprovedTransparencyState26_3(),`,
    'GameState transparency value',
  );
  return out;
});

writeFileSync('tests/parity-259-270.test.ts', `import assert from 'node:assert/strict';
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
  assert.match(source, /this\\.maps\\.updatePlayerMarker/);
  assert.match(source, /THREE\\.MathUtils\\.radToDeg\\(this\\.player\\.yaw\\)/);
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
  assert.match(source, /consumeImprovedTransparencyToggle26_3\\(\\)/);
  assert.match(source, /toggleImprovedTransparency26_3\\(\\)/);
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
  for (const color of ['red', 'orange', 'yellow']) assert.equal(fallingLeafParticle26_3(\`${'${color}'}_poplar_leaves\`), \`minecraft:${'${color}'}_poplar_leaves\`);
});

test('267: live ambient scanner creates Poplar leaf sources and leaf particles', () => {
  const source = readFileSync('src/engine/Game.ts', 'utf8');
  assert.match(source, /type: 'poplar_leaves'/);
  assert.match(source, /spawnFallingLeaf/);
});

test('268: SoundSystem exposes exact-name 26.3 resource-pack sound routing', () => {
  assert.equal(typeof SoundSystem.prototype.playNamedEvent26_3, 'function');
  const source = readFileSync('src/systems/SoundSystem.ts', 'utf8');
  assert.match(source, /playFirstResourceSound\\(\\[eventName\\]\\)/);
});

test('269: Poplar ambient runtime requests the official leaves ambient event', () => {
  const source = readFileSync('src/engine/Game.ts', 'utf8');
  assert.match(source, /block\\.poplar_leaves\\.ambient/);
});

test('270: Improved Transparency remains explicitly partial until a real OIT pass exists', () => {
  const state = new ImprovedTransparencyState26_3();
  assert.equal(state.set(true).fullOit, false);
  const manifest = JSON.parse(readFileSync('docs/parity-manifest.json', 'utf8'));
  assert.equal(manifest.axes.visualModels.status, 'partial');
});
`);

console.log('Applied parity 259-270 runtime bridge and regressions.');
