import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, content) { fs.writeFileSync(path, content); }
function replaceOnce(path, before, after) {
  const source = read(path);
  if (!source.includes(before)) throw new Error(`Anchor not found in ${path}: ${before.slice(0, 120)}`);
  const next = source.replace(before, after);
  if (next === source) throw new Error(`No change in ${path}`);
  write(path, next);
}

write('src/world/OpenableRules.ts', String.raw`import type { BlockMetadata } from '../types';

export type OpenableKind = 'door' | 'trapdoor' | 'fence_gate';

export function getOpenableKind(rawName: string): OpenableKind | undefined {
  const name = rawName.toLowerCase().replace(/^minecraft:/, '');
  if (name.includes('trapdoor')) return 'trapdoor';
  if (name.includes('fence_gate')) return 'fence_gate';
  if (name === 'door' || name === 'wooden_door' || name === 'iron_door' || name.endsWith('_door')) return 'door';
  return undefined;
}

export interface OpenableRedstoneState {
  changed: boolean;
  open: boolean;
  powered: boolean;
}

/**
 * Java openables only force their open state when the redstone-powered state
 * transitions. Re-evaluating an already-unpowered block must not erase a
 * player's manual open/closed choice.
 */
export function resolveOpenableRedstoneState(
  metadata: Pick<BlockMetadata, 'open' | 'powered'> | undefined,
  poweredNow: boolean,
): OpenableRedstoneState {
  const previousPowered = metadata?.powered ?? false;
  const currentOpen = metadata?.open ?? false;
  if (previousPowered === poweredNow) {
    return { changed: false, open: currentOpen, powered: previousPowered };
  }
  return { changed: true, open: poweredNow, powered: poweredNow };
}
`);

write('src/world/ContainerRules.ts', String.raw`import type { BlockDef } from '../types';

/**
 * Chest lids are blocked by an opaque full/solid block above them. Barrels do
 * not use this rule. Transparent solid blocks such as glass are intentionally
 * not treated as lid blockers.
 */
export function isChestObstructingBlock(block: BlockDef | undefined): boolean {
  return !!block && block.solid && !block.transparent;
}
`);

write('src/world/FurnaceRules.ts', String.raw`export type FurnaceKind = 'furnace' | 'smoker' | 'blast_furnace';

/** Smokers and blast furnaces process valid recipes at twice furnace speed. */
export function getFurnaceCookSpeed(kind: FurnaceKind | string | undefined): number {
  return kind === 'smoker' || kind === 'blast_furnace' ? 2 : 1;
}
`);

write('src/world/BedRules.ts', String.raw`export type BedDimension = 'overworld' | 'nether' | 'end';

export interface BedUseDecision {
  canSleep: boolean;
  setsSpawn: boolean;
  explodes: boolean;
}

/** Base Java bed dimension contract. */
export function resolveBedUse(dimension: BedDimension, isNight: boolean): BedUseDecision {
  if (dimension !== 'overworld') {
    return { canSleep: false, setsSpawn: false, explodes: true };
  }
  return { canSleep: isNight, setsSpawn: true, explodes: false };
}
`);

write('src/world/SignRules.ts', String.raw`import type { BlockFacing, BlockMetadata } from '../types';

const normalize = (name: string) => name.toLowerCase().replace(/^minecraft:/, '');
const emptySignLines = () => ['', '', '', ''];
const normalizeLines = (lines: readonly string[] | undefined) =>
  Array.from({ length: 4 }, (_, index) => lines?.[index] ?? '');

export type SignSide = 'front' | 'back';

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

/** 26.3-compatible sign defaults: two independent sides and op features off. */
export function createDefaultSignMetadata(base: BlockMetadata = {}): BlockMetadata {
  return {
    ...base,
    signText: normalizeLines(base.signTextFront ?? base.signText),
    signTextFront: normalizeLines(base.signTextFront ?? base.signText),
    signTextBack: normalizeLines(base.signTextBack),
    signColorFront: base.signColorFront ?? 'black',
    signColorBack: base.signColorBack ?? 'black',
    signGlowingFront: base.signGlowingFront ?? false,
    signGlowingBack: base.signGlowingBack ?? false,
    signWaxed: base.signWaxed ?? false,
    signAllowOpFeatures: base.signAllowOpFeatures ?? false,
  };
}

export function getSignTextForSide(metadata: BlockMetadata | undefined, side: SignSide): string[] {
  if (!metadata) return emptySignLines();
  return normalizeLines(side === 'front' ? (metadata.signTextFront ?? metadata.signText) : metadata.signTextBack);
}

export function setSignTextForSide(metadata: BlockMetadata | undefined, side: SignSide, lines: readonly string[]): BlockMetadata {
  const next = createDefaultSignMetadata(metadata);
  const normalized = normalizeLines(lines);
  if (side === 'front') {
    return { ...next, signText: normalized, signTextFront: normalized };
  }
  return { ...next, signTextBack: normalized };
}

function facingVector(facing: BlockFacing | undefined): { x: number; z: number } {
  switch (facing) {
    case 'south': return { x: 0, z: 1 };
    case 'east': return { x: 1, z: 0 };
    case 'west': return { x: -1, z: 0 };
    case 'north':
    default: return { x: 0, z: -1 };
  }
}

/** Resolve which physical sign side the player is looking at. */
export function getSignSideForPlayer(
  blockName: string,
  metadata: BlockMetadata | undefined,
  blockX: number,
  blockZ: number,
  playerX: number,
  playerZ: number,
): SignSide {
  let front: { x: number; z: number };
  if (isWallSignBlockName(blockName)) {
    front = facingVector(metadata?.facing);
  } else {
    const rotation = ((metadata?.rotation ?? 0) % 16 + 16) % 16;
    const angle = rotation * Math.PI * 2 / 16;
    front = { x: -Math.sin(angle), z: Math.cos(angle) };
  }
  const dx = playerX - (blockX + 0.5);
  const dz = playerZ - (blockZ + 0.5);
  return dx * front.x + dz * front.z >= 0 ? 'front' : 'back';
}

export interface SignInteractionResult {
  handled: boolean;
  opensEditor: boolean;
  consumeItem: boolean;
  metadata: BlockMetadata;
}

/** Apply side-specific dye/glow/wax interactions before falling back to editing. */
export function applySignInteraction(
  metadata: BlockMetadata | undefined,
  heldItemName: string | undefined,
  side: SignSide,
): SignInteractionResult {
  const next = createDefaultSignMetadata(metadata);
  const itemName = heldItemName ? normalize(heldItemName) : undefined;

  if (next.signWaxed) {
    return { handled: true, opensEditor: false, consumeItem: false, metadata: next };
  }
  if (itemName === 'honeycomb') {
    return { handled: true, opensEditor: false, consumeItem: true, metadata: { ...next, signWaxed: true } };
  }
  if (itemName?.endsWith('_dye')) {
    const color = itemName.slice(0, -'_dye'.length);
    return {
      handled: true,
      opensEditor: false,
      consumeItem: true,
      metadata: side === 'front' ? { ...next, signColorFront: color } : { ...next, signColorBack: color },
    };
  }
  if (itemName === 'glow_ink_sac') {
    return {
      handled: true,
      opensEditor: false,
      consumeItem: true,
      metadata: side === 'front' ? { ...next, signGlowingFront: true } : { ...next, signGlowingBack: true },
    };
  }
  if (itemName === 'ink_sac') {
    return {
      handled: true,
      opensEditor: false,
      consumeItem: true,
      metadata: side === 'front' ? { ...next, signGlowingFront: false } : { ...next, signGlowingBack: false },
    };
  }
  return { handled: true, opensEditor: true, consumeItem: false, metadata: next };
}
`);

replaceOnce('src/types/index.ts',
String.raw`  signText?: string[];
  rotation?: number;`,
String.raw`  /** Legacy alias for front-side text. */
  signText?: string[];
  signTextFront?: string[];
  signTextBack?: string[];
  signColorFront?: string;
  signColorBack?: string;
  signGlowingFront?: boolean;
  signGlowingBack?: boolean;
  signWaxed?: boolean;
  /** Java 26.3 signs default this data-component capability to false. */
  signAllowOpFeatures?: boolean;
  rotation?: number;`);

replaceOnce('src/engine/Game.ts',
String.raw`import { getButtonPressTicks } from '../world/ButtonRules';
import { isSignBlockName, isWallSignBlockName } from '../world/SignRules';`,
String.raw`import { getButtonPressTicks } from '../world/ButtonRules';
import {
  applySignInteraction,
  createDefaultSignMetadata,
  getSignSideForPlayer,
  getSignTextForSide,
  isSignBlockName,
  isWallSignBlockName,
  setSignTextForSide,
  type SignSide,
} from '../world/SignRules';
import { resolveOpenableRedstoneState } from '../world/OpenableRules';
import { isChestObstructingBlock } from '../world/ContainerRules';
import { getFurnaceCookSpeed } from '../world/FurnaceRules';
import { resolveBedUse } from '../world/BedRules';`);

replaceOnce('src/engine/Game.ts',
String.raw`  editingSignPos: THREE.Vector3 | null = null;
  editingBookSlot: number | null = null;`,
String.raw`  editingSignPos: THREE.Vector3 | null = null;
  private editingSignSide: SignSide = 'front';
  editingBookSlot: number | null = null;`);

replaceOnce('src/engine/Game.ts',
String.raw`    this.behaviors.registerBlock([], {
      id: 'minecraft:sign',
      preventsItemUse: true,
      interact: ({ position }) => {
        this.editingSignPos = new THREE.Vector3(position.x, position.y, position.z);
        this.openUI = 'sign_edit';
        document.exitPointerLock();
        this.notifyState();
        return { handled: true, cooldown: 0.25 };
      },
    });`,
String.raw`    this.behaviors.registerBlock([], {
      id: 'minecraft:sign',
      preventsItemUse: true,
      interact: ({ position, heldItem }) => {
        const block = BlockRegistry.get(this.chunks.getBlock(position.x, position.y, position.z));
        if (!block) return { handled: false };
        const currentMeta = this.chunks.getBlockMeta(position.x, position.y, position.z);
        const side = getSignSideForPlayer(
          block.name,
          currentMeta,
          position.x,
          position.z,
          this.player.position.x,
          this.player.position.z,
        );
        const heldItemName = heldItem ? ItemRegistry.get(heldItem.id)?.name : undefined;
        const result = applySignInteraction(currentMeta, heldItemName, side);
        this.chunks.setBlockMeta(position.x, position.y, position.z, result.metadata, true);
        if (result.consumeItem && heldItem && this.gameMode !== 'creative') {
          this.inventory.removeFromSlot(this.player.selectedSlot, 1);
        }
        if (result.opensEditor) {
          this.editingSignPos = new THREE.Vector3(position.x, position.y, position.z);
          this.editingSignSide = side;
          this.openUI = 'sign_edit';
          document.exitPointerLock();
        }
        this.notifyState();
        return { handled: result.handled, cooldown: 0.25 };
      },
    });`);

replaceOnce('src/engine/Game.ts',
String.raw`        this.updateRedstoneMetadata(position.x, position.y, position.z, {
          powered,
          signal: powered ? 15 : 0,
        });
        this.sound.playLever();`,
String.raw`        this.updateRedstoneMetadata(position.x, position.y, position.z, {
          powered,
          signal: powered ? 15 : 0,
        });
        this.applyRedstoneToNeighbors(position.x, position.y, position.z);
        this.sound.playLever();`);

replaceOnce('src/engine/Game.ts',
String.raw`  getEditingSignText(): string[] {
    if (!this.editingSignPos) return ['', '', '', ''];
    const pos = this.editingSignPos;
    const lines = this.chunks.getBlockMeta(pos.x, pos.y, pos.z)?.signText ?? [];
    return Array.from({ length: 4 }, (_, index) => lines[index] ?? '');
  }

  saveSignText(lines: string[]) {
    if (this.editingSignPos) {
      const pos = this.editingSignPos;
      const currentMeta = this.chunks.getBlockMeta(pos.x, pos.y, pos.z) || {};
      this.chunks.setBlockMeta(pos.x, pos.y, pos.z, { ...currentMeta, signText: lines }, true);
      this.editingSignPos = null;
    }`,
String.raw`  getEditingSignText(): string[] {
    if (!this.editingSignPos) return ['', '', '', ''];
    const pos = this.editingSignPos;
    return getSignTextForSide(this.chunks.getBlockMeta(pos.x, pos.y, pos.z), this.editingSignSide);
  }

  saveSignText(lines: string[]) {
    if (this.editingSignPos) {
      const pos = this.editingSignPos;
      const currentMeta = this.chunks.getBlockMeta(pos.x, pos.y, pos.z);
      this.chunks.setBlockMeta(
        pos.x,
        pos.y,
        pos.z,
        setSignTextForSide(currentMeta, this.editingSignSide, lines),
        true,
      );
      this.editingSignPos = null;
      this.editingSignSide = 'front';
    }`);

replaceOnce('src/engine/Game.ts',
String.raw`      if (plan.opensSignEditor) {
        this.editingSignPos = new THREE.Vector3(x, y, z);
        this.openUI = 'sign_edit';`,
String.raw`      if (plan.opensSignEditor) {
        this.editingSignPos = new THREE.Vector3(x, y, z);
        this.editingSignSide = 'front';
        this.openUI = 'sign_edit';`);

replaceOnce('src/engine/Game.ts',
String.raw`    this.chunks.setBlockMeta(x, y, z, {
      facing,
      doorHalf: 'lower',
      hinge,
      open: false,
    }, true);`,
String.raw`    this.chunks.setBlockMeta(x, y, z, {
      facing,
      doorHalf: 'lower',
      hinge,
      open: false,
      powered: false,
    }, true);`);

replaceOnce('src/engine/Game.ts',
String.raw`    this.chunks.setBlockMeta(x, y + 1, z, {
      facing,
      doorHalf: 'upper',
      hinge,
      open: false,
    }, true);`,
String.raw`    this.chunks.setBlockMeta(x, y + 1, z, {
      facing,
      doorHalf: 'upper',
      hinge,
      open: false,
      powered: false,
    }, true);`);

replaceOnce('src/engine/Game.ts',
String.raw`  private useBed(x: number, y: number, z: number) {
    this.bedSpawnPoint = new THREE.Vector3(x + 0.5, y + 1, z + 0.5);
    this.sound.playBlockPlace(35);
    this.advancements.checkSleep();

    if (this.isNight()) {
      this.gameTime = 0.0;
      this.addChatMessage('You are now sleeping. Morning has come.');
      this.notifyState();
    } else {
      this.addChatMessage('You can only sleep at night');
    }
  }`,
String.raw`  private useBed(x: number, y: number, z: number) {
    const dimension = this.chunks.currentDimension === Dimension.Overworld
      ? 'overworld'
      : this.chunks.currentDimension === Dimension.Nether
        ? 'nether'
        : 'end';
    const outcome = resolveBedUse(dimension, this.isNight());

    if (outcome.explodes) {
      this.createExplosion(x + 0.5, y + 0.5, z + 0.5, 5);
      return;
    }

    if (outcome.setsSpawn) {
      this.bedSpawnPoint = new THREE.Vector3(x + 0.5, y + 1, z + 0.5);
    }
    this.sound.playBlockPlace(35);

    if (outcome.canSleep) {
      this.advancements.checkSleep();
      this.gameTime = 0.0;
      this.addChatMessage('You are now sleeping. Morning has come.');
      this.notifyState();
    } else {
      this.addChatMessage('You can only sleep at night');
    }
  }`);

replaceOnce('src/engine/Game.ts',
String.raw`  private setDoorOpen(x: number, y: number, z: number, open: boolean) {
    const base = this.getDoorBase(x, y, z);`,
String.raw`  private setDoorOpen(x: number, y: number, z: number, open: boolean, powered?: boolean) {
    const base = this.getDoorBase(x, y, z);`);

replaceOnce('src/engine/Game.ts',
String.raw`    const facing = lowerMeta?.facing ?? upperMeta?.facing ?? 'north';
    const hinge = lowerMeta?.hinge ?? upperMeta?.hinge ?? 'left';
    const blockId = this.chunks.getBlock(base.x, base.y, base.z);`,
String.raw`    const facing = lowerMeta?.facing ?? upperMeta?.facing ?? 'north';
    const hinge = lowerMeta?.hinge ?? upperMeta?.hinge ?? 'left';
    const nextPowered = powered ?? lowerMeta?.powered ?? upperMeta?.powered ?? false;
    const blockId = this.chunks.getBlock(base.x, base.y, base.z);`);

replaceOnce('src/engine/Game.ts',
String.raw`      hinge,
      open,
    }, true);
    this.redstone.observeBlockChange(base.x, base.y, base.z);`,
String.raw`      hinge,
      open,
      powered: nextPowered,
    }, true);
    this.redstone.observeBlockChange(base.x, base.y, base.z);`);

replaceOnce('src/engine/Game.ts',
String.raw`        hinge,
        open,
      }, true);
      this.redstone.observeBlockChange(base.x, base.y + 1, base.z);`,
String.raw`        hinge,
        open,
        powered: nextPowered,
      }, true);
      this.redstone.observeBlockChange(base.x, base.y + 1, base.z);`);

replaceOnce('src/engine/Game.ts',
String.raw`    // Wooden buttons 10 ticks, stone-family buttons 30 ticks (Java 1.20.1).
    this.scheduleWorldTick('block_event', x, y, z, getButtonPressTicks(def.name), 'button_reset');`,
String.raw`    // Java: wooden buttons stay pressed 30 ticks; stone-family buttons 20 ticks.
    this.applyRedstoneToNeighbors(x, y, z);
    this.scheduleWorldTick('block_event', x, y, z, getButtonPressTicks(def.name), 'button_reset');`);

replaceOnce('src/engine/Game.ts',
String.raw`      this.chunks.setBlockMeta(x, y, z, { ...meta, powered: false, signal: 0 }, true);
      this.redstone.observeBlockChange(x, y, z);
    }
  }`,
String.raw`      this.chunks.setBlockMeta(x, y, z, { ...meta, powered: false, signal: 0 }, true);
      this.redstone.observeBlockChange(x, y, z);
      this.applyRedstoneToNeighbors(x, y, z);
    }
  }`);

replaceOnce('src/engine/Game.ts',
String.raw`    const meta = this.chunks.getBlockMeta(x, y, z);
    const currentOpen = meta?.open ?? false;

    let targetOpen: boolean | null = null;
    if (isGate || isTrapdoor) {
      targetOpen = powered;
    } else if (isDoor) {
      if (powered) targetOpen = true;
      else if (name === 'iron_door') targetOpen = false;
    }
    if (targetOpen === null || targetOpen === currentOpen) return;

    if (isDoor) {
      this.setDoorOpen(x, y, z, targetOpen);
    } else {
      this.chunks.setBlockMeta(x, y, z, { ...meta, open: targetOpen }, true);
      this.redstone.observeBlockChange(x, y, z);
    }`,
String.raw`    const meta = this.chunks.getBlockMeta(x, y, z);
    const decision = resolveOpenableRedstoneState(meta, powered);
    if (!decision.changed) return;

    if (isDoor) {
      this.setDoorOpen(x, y, z, decision.open, decision.powered);
    } else {
      this.chunks.setBlockMeta(x, y, z, {
        ...meta,
        open: decision.open,
        powered: decision.powered,
      }, true);
      this.redstone.observeBlockChange(x, y, z);
    }`);

replaceOnce('src/engine/Game.ts',
String.raw`      this.chunks.setBlockMeta(x, y, z, {
        facing: hingeFacing,
        open: false,
      }, true);`,
String.raw`      this.chunks.setBlockMeta(x, y, z, {
        facing: hingeFacing,
        open: false,
        powered: false,
      }, true);`);

replaceOnce('src/engine/Game.ts',
String.raw`      this.chunks.setBlockMeta(x, y, z, {
        facing: gateFacing,
        open: false,
      }, true);`,
String.raw`      this.chunks.setBlockMeta(x, y, z, {
        facing: gateFacing,
        open: false,
        powered: false,
      }, true);`);

replaceOnce('src/engine/Game.ts',
String.raw`    if ((isSignBlockName(name) && !isWallSignBlockName(name)) || name === 'standing_banner') {
      const rotation = Math.round(((this.player.yaw + Math.PI) * 16) / (2 * Math.PI)) % 16;
      this.chunks.setBlockMeta(x, y, z, { rotation }, true);
      return;
    }

    if ((isSignBlockName(name) && isWallSignBlockName(name)) || name === 'wall_banner') {
      this.chunks.setBlockMeta(x, y, z, { facing }, true);
      return;
    }`,
String.raw`    if (isSignBlockName(name) && !isWallSignBlockName(name)) {
      const rotation = Math.round(((this.player.yaw + Math.PI) * 16) / (2 * Math.PI)) % 16;
      this.chunks.setBlockMeta(x, y, z, createDefaultSignMetadata({ rotation }), true);
      return;
    }

    if (isSignBlockName(name) && isWallSignBlockName(name)) {
      this.chunks.setBlockMeta(x, y, z, createDefaultSignMetadata({ facing }), true);
      return;
    }

    if (name === 'standing_banner') {
      const rotation = Math.round(((this.player.yaw + Math.PI) * 16) / (2 * Math.PI)) % 16;
      this.chunks.setBlockMeta(x, y, z, { rotation }, true);
      return;
    }

    if (name === 'wall_banner') {
      this.chunks.setBlockMeta(x, y, z, { facing }, true);
      return;
    }`);

replaceOnce('src/engine/Game.ts',
String.raw`  openChestUI(x: number, y: number, z: number) {
    const metadata = this.ensureChestMetadata(x, y, z);
    if (!metadata) return;`,
String.raw`  private isChestBlockedAt(x: number, y: number, z: number): boolean {
    const above = BlockRegistry.get(this.chunks.getBlock(x, y + 1, z));
    return isChestObstructingBlock(above);
  }

  openChestUI(x: number, y: number, z: number) {
    const block = BlockRegistry.get(this.chunks.getBlock(x, y, z));
    if (block?.name === 'chest') {
      const partners = this.getDoubleChestPartners(x, y, z);
      const blocked = partners
        ? this.isChestBlockedAt(partners.leftPos.x, partners.leftPos.y, partners.leftPos.z)
          || this.isChestBlockedAt(partners.rightPos.x, partners.rightPos.y, partners.rightPos.z)
        : this.isChestBlockedAt(x, y, z);
      if (blocked) return;
    }

    const metadata = this.ensureChestMetadata(x, y, z);
    if (!metadata) return;`);

replaceOnce('src/engine/Game.ts',
String.raw`      const speed = (meta.containerType === 'smoker' || meta.containerType === 'blast_furnace') ? 2 : 1;
      meta.cookTime += elapsed * speed;`,
String.raw`      const speed = getFurnaceCookSpeed(meta.containerType);
      meta.cookTime += elapsed * speed;`);

write('tests/parity-351-370.test.ts', String.raw`import test from 'node:test';
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
  const result = applySignInteraction(undefined, 'glow_ink_sac', 'front');
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
  assert.ok(source.includes("if (block?.name === 'chest')"));
  assert.ok(source.includes('this.isChestBlockedAt(partners.leftPos.x'));
});

test('369: smoker and blast furnace share the Java 2x processing speed contract', () => {
  assert.equal(getFurnaceCookSpeed('furnace'), 1);
  assert.equal(getFurnaceCookSpeed('smoker'), 2);
  assert.equal(getFurnaceCookSpeed('blast_furnace'), 2);
  assert.ok(gameSource().includes('const speed = getFurnaceCookSpeed(meta.containerType);'));
});

test('370: regular beds sleep in the Overworld and explode in Nether/End', () => {
  assert.deepEqual(resolveBedUse('overworld', true), { canSleep: true, setsSpawn: true, explodes: false });
  assert.deepEqual(resolveBedUse('overworld', false), { canSleep: false, setsSpawn: true, explodes: false });
  assert.deepEqual(resolveBedUse('nether', true), { canSleep: false, setsSpawn: false, explodes: true });
  assert.deepEqual(resolveBedUse('end', true), { canSleep: false, setsSpawn: false, explodes: true });
  const source = gameSource();
  assert.ok(source.includes('const outcome = resolveBedUse(dimension, this.isNight());'));
  assert.ok(source.includes('this.createExplosion(x + 0.5, y + 0.5, z + 0.5, 5);'));
});
`);
