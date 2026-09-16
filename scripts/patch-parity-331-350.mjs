import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, content) { fs.writeFileSync(path, content); }
function replaceOnce(path, before, after) {
  const source = read(path);
  if (!source.includes(before)) throw new Error(`Anchor not found in ${path}: ${before.slice(0, 100)}`);
  const next = source.replace(before, after);
  if (next === source) throw new Error(`No change in ${path}`);
  write(path, next);
}

write('src/world/SignRules.ts', String.raw`const normalize = (name) => name.toLowerCase().replace(/^minecraft:/, '');

/** True for standing, wall, ceiling-hanging, and wall-hanging signs. */
export function isSignBlockName(name: string): boolean {
  const normalized = normalize(name);
  return normalized === 'sign' || normalized === 'standing_sign' || normalized === 'wall_sign' || normalized.endsWith('_sign');
}

export function isWallSignBlockName(name: string): boolean {
  const normalized = normalize(name);
  return normalized === 'wall_sign' || normalized.endsWith('_wall_sign') || normalized.endsWith('_wall_hanging_sign');
}

export function isHangingSignBlockName(name: string): boolean {
  return normalize(name).includes('hanging_sign');
}

/** Resolve the wall-mounted block variant for a sign item/block name. */
export function getWallSignVariantName(name: string): string | undefined {
  const normalized = normalize(name);
  if (isWallSignBlockName(normalized)) return undefined;
  if (normalized === 'standing_sign' || normalized === 'sign') return 'wall_sign';
  if (normalized.endsWith('_hanging_sign')) {
    return normalized.replace(/_hanging_sign$/, '_wall_hanging_sign');
  }
  if (normalized.endsWith('_sign')) {
    return normalized.replace(/_sign$/, '_wall_sign');
  }
  return undefined;
}
`);

replaceOnce('src/world/BehaviorIds.ts',
String.raw`const stripNamespace = (name: string) => name.replace(/^minecraft:/, '');`,
String.raw`import { isSignBlockName } from './SignRules';

const stripNamespace = (name: string) => name.replace(/^minecraft:/, '');`);

replaceOnce('src/world/BehaviorIds.ts',
String.raw`  if (name === 'note_block') return 'minecraft:note_block';
  if (name === 'bed' || (name.endsWith('_bed') && name !== 'bedrock')) return 'minecraft:bed';`,
String.raw`  if (name === 'note_block') return 'minecraft:note_block';
  if (isSignBlockName(name)) return 'minecraft:sign';
  if (name === 'bed' || (name.endsWith('_bed') && name !== 'bedrock')) return 'minecraft:bed';`);

replaceOnce('src/world/BlockState.ts',
String.raw`  } else if (
    normalized.includes('fence')
    || normalized.endsWith('_wall')
    || normalized.includes('pane')
    || normalized.includes('bars')
  ) {
    Object.assign(properties, {
      north: booleanProperty(),
      east: booleanProperty(),
      south: booleanProperty(),
      west: booleanProperty(),
      waterlogged: booleanProperty(),
    });`,
String.raw`  } else if (normalized.includes('fence_gate')) {
    Object.assign(properties, {
      facing: horizontalFacing,
      in_wall: booleanProperty(),
      open: booleanProperty(),
      powered: booleanProperty(),
    });
  } else if (
    normalized.includes('fence')
    || normalized.endsWith('_wall')
    || normalized.includes('pane')
    || normalized.includes('bars')
  ) {
    Object.assign(properties, {
      north: booleanProperty(),
      east: booleanProperty(),
      south: booleanProperty(),
      west: booleanProperty(),
      waterlogged: booleanProperty(),
    });`);

replaceOnce('src/world/BlockPlacement.ts',
String.raw`import { BlockRegistry } from './BlockRegistry';
import type { BlockInteractionContext, BlockPosition } from './BehaviorRegistry';`,
String.raw`import { BlockRegistry } from './BlockRegistry';
import { getWallSignVariantName, isHangingSignBlockName, isSignBlockName } from './SignRules';
import type { BlockInteractionContext, BlockPosition } from './BehaviorRegistry';`);

replaceOnce('src/world/BlockPlacement.ts',
String.raw`  let blockId = request.placeBlockId;
  if (blockId === undefined || blockId <= 0) return { ok: false, reason: 'not_placeable' };

  if (blockId === 63 || blockId === 176) {
    if (face === 'down') return { ok: false, reason: 'unsupported_face' };
    if (face !== 'up') blockId = blockId === 63 ? 68 : 177;
  }
`,
String.raw`  let blockId = request.placeBlockId;
  if (blockId === undefined || blockId <= 0) return { ok: false, reason: 'not_placeable' };

  const requestedBlock = BlockRegistry.get(blockId);
  const requestedName = requestedBlock?.name ?? request.item.name;
  if (isSignBlockName(requestedName)) {
    const hanging = isHangingSignBlockName(requestedName);
    if ((!hanging && face === 'down') || (hanging && face === 'up')) {
      return { ok: false, reason: 'unsupported_face' };
    }
    if (face !== 'up' && face !== 'down') {
      const wallVariant = getWallSignVariantName(requestedName);
      const wallBlock = wallVariant ? BlockRegistry.getByName(wallVariant) : undefined;
      if (wallBlock) blockId = wallBlock.id;
    }
  }

  if (blockId === 63 || blockId === 176) {
    if (face === 'down') return { ok: false, reason: 'unsupported_face' };
    if (face !== 'up') blockId = blockId === 63 ? 68 : 177;
  }
`);

replaceOnce('src/world/BlockPlacement.ts',
String.raw`      opensSignEditor: blockId === 63 || blockId === 68,`,
String.raw`      opensSignEditor: isSignBlockName(blockName),`);

replaceOnce('src/visual/VisualResolver.ts',
String.raw`    if (item.behaviorId === 'minecraft:readable' && item.name.endsWith('_map')) {
      return 'item:filled_map';
    }
    return ` + '`item:${item.name}`' + `;`,
String.raw`    return 'item:' + item.name;`);

replaceOnce('src/engine/TextureAtlas.ts',
String.raw`            } else if (name.includes('paper')) {
              ctx.fillStyle = '#F2F0D8';`,
String.raw`            } else if (name === 'filled_map' || name.endsWith('_map')) {
              // Java 26.3 explorer maps are distinct items with distinct icons.
              ctx.fillStyle = '#d8c58c';
              ctx.fillRect(x + 3, y + 2, 10, 12);
              ctx.fillStyle = '#efe2b2';
              ctx.fillRect(x + 4, y + 3, 8, 10);
              ctx.fillStyle = colors.hex;
              ctx.fillRect(x + 6, y + 5, 2, 2);
              ctx.fillRect(x + 9, y + 8, 2, 2);
              ctx.fillStyle = '#5f7540';
              ctx.fillRect(x + 5, y + 10, 4, 1);
            } else if (name.includes('paper')) {
              ctx.fillStyle = '#F2F0D8';`);

replaceOnce('src/engine/Game.ts',
String.raw`import { getButtonPressTicks } from '../world/ButtonRules';`,
String.raw`import { getButtonPressTicks } from '../world/ButtonRules';
import { isSignBlockName, isWallSignBlockName } from '../world/SignRules';`);

replaceOnce('src/engine/Game.ts',
String.raw`    this.behaviors.registerBlock([], {
      id: 'minecraft:straw_bed',
      preventsItemUse: true,
      interact: ({ position }) => {
        this.useStrawBed26_3(position.x, position.y, position.z);
        return { handled: true, cooldown: 0.25 };
      },
    });

    this.behaviors.registerItem(['map', 'filled_map', 'writable_book', 'written_book'], {`,
String.raw`    this.behaviors.registerBlock([], {
      id: 'minecraft:straw_bed',
      preventsItemUse: true,
      interact: ({ position }) => {
        this.useStrawBed26_3(position.x, position.y, position.z);
        return { handled: true, cooldown: 0.25 };
      },
    });
    this.behaviors.registerBlock([], {
      id: 'minecraft:sign',
      preventsItemUse: true,
      interact: ({ position }) => {
        this.editingSignPos = new THREE.Vector3(position.x, position.y, position.z);
        this.openUI = 'sign_edit';
        document.exitPointerLock();
        this.notifyState();
        return { handled: true, cooldown: 0.25 };
      },
    });

    this.behaviors.registerItem(['map', 'filled_map', 'writable_book', 'written_book'], {`);

replaceOnce('src/engine/Game.ts',
String.raw`    if (name === 'standing_sign' || name === 'standing_banner') {
      const rotation = Math.round(((this.player.yaw + Math.PI) * 16) / (2 * Math.PI)) % 16;
      this.chunks.setBlockMeta(x, y, z, { rotation }, true);
      return;
    }

    if (name === 'wall_sign' || name === 'wall_banner') {
      this.chunks.setBlockMeta(x, y, z, { facing }, true);
      return;
    }`,
String.raw`    if ((isSignBlockName(name) && !isWallSignBlockName(name)) || name === 'standing_banner') {
      const rotation = Math.round(((this.player.yaw + Math.PI) * 16) / (2 * Math.PI)) % 16;
      this.chunks.setBlockMeta(x, y, z, { rotation }, true);
      return;
    }

    if ((isSignBlockName(name) && isWallSignBlockName(name)) || name === 'wall_banner') {
      this.chunks.setBlockMeta(x, y, z, { facing }, true);
      return;
    }`);

replaceOnce('src/engine/Game.ts',
String.raw`  saveSignText(lines: string[]) {`,
String.raw`  getEditingSignText(): string[] {
    if (!this.editingSignPos) return ['', '', '', ''];
    const pos = this.editingSignPos;
    const lines = this.chunks.getBlockMeta(pos.x, pos.y, pos.z)?.signText ?? [];
    return Array.from({ length: 4 }, (_, index) => lines[index] ?? '');
  }

  saveSignText(lines: string[]) {`);

replaceOnce('src/App.tsx',
String.raw`        <SignEditUI
          onSave={(lines) => {
            gameRef.current?.saveSignText(lines);
          }}
        />`,
String.raw`        <SignEditUI
          initialLines={gameRef.current?.getEditingSignText() ?? ['', '', '', '']}
          onSave={(lines) => {
            gameRef.current?.saveSignText(lines);
          }}
        />`);

replaceOnce('tests/parity-291-310.test.ts',
String.raw`test('296: explorer maps reuse filled-map icon', () => assert.equal(VisualResolver.getItemIconKey(item('ocean_monument_map').id), 'item:filled_map'));`,
String.raw`test('296: explorer maps use their own Java 26.3 icon identity', () => assert.equal(VisualResolver.getItemIconKey(item('ocean_monument_map').id), 'item:ocean_monument_map'));`);

write('tests/parity-331-350.test.ts', String.raw`import test from 'node:test';
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
`);

console.log('Applied parity 331-350 patch');
