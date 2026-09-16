import type { BlockFacing, BlockMetadata } from '../types';

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
    const lines = getSignTextForSide(next, side);
    const alreadyGlowing = side === 'front' ? next.signGlowingFront : next.signGlowingBack;
    if (alreadyGlowing || lines.every(line => line.length === 0)) {
      return { handled: true, opensEditor: true, consumeItem: false, metadata: next };
    }
    return {
      handled: true,
      opensEditor: false,
      consumeItem: true,
      metadata: side === 'front' ? { ...next, signGlowingFront: true } : { ...next, signGlowingBack: true },
    };
  }
  if (itemName === 'ink_sac') {
    const alreadyPlain = side === 'front' ? !next.signGlowingFront : !next.signGlowingBack;
    if (alreadyPlain) return { handled: true, opensEditor: true, consumeItem: false, metadata: next };
    return {
      handled: true,
      opensEditor: false,
      consumeItem: true,
      metadata: side === 'front' ? { ...next, signGlowingFront: false } : { ...next, signGlowingBack: false },
    };
  }
  return { handled: true, opensEditor: true, consumeItem: false, metadata: next };
}
