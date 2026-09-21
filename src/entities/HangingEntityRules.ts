import type { BlockFacing, ItemStack } from '../types';
import type { BlockPosition } from '../world/BehaviorRegistry';
import type { MobType } from './Mob';

export type HangingEntityType = 'item_frame' | 'glow_item_frame' | 'painting';

export const PAINTING_VARIANTS = {
  alban: { width: 1, height: 1, survival: true, color: 0xc4a56d },
  aztec: { width: 1, height: 1, survival: true, color: 0x466b7a },
  aztec2: { width: 1, height: 1, survival: true, color: 0x6f4a7e },
  bomb: { width: 1, height: 1, survival: true, color: 0x8b3f35 },
  kebab: { width: 1, height: 1, survival: true, color: 0xb45f3a },
  meditative: { width: 1, height: 1, survival: true, color: 0x8a7658 },
  plant: { width: 1, height: 1, survival: true, color: 0x547a45 },
  wasteland: { width: 1, height: 1, survival: true, color: 0x9b835e },

  graham: { width: 1, height: 2, survival: true, color: 0x9c784f },
  prairie_ride: { width: 1, height: 2, survival: true, color: 0x6e8757 },
  wanderer: { width: 1, height: 2, survival: true, color: 0x596a7d },

  courbet: { width: 2, height: 1, survival: true, color: 0xb3976a },
  creebet: { width: 2, height: 1, survival: true, color: 0x54755c },
  pool: { width: 2, height: 1, survival: true, color: 0x487f9d },
  sea: { width: 2, height: 1, survival: true, color: 0x47758a },
  sunset: { width: 2, height: 1, survival: true, color: 0xc66f45 },

  baroque: { width: 2, height: 2, survival: true, color: 0x815d42 },
  bust: { width: 2, height: 2, survival: true, color: 0x8f7c65 },
  humble: { width: 2, height: 2, survival: true, color: 0xa2825f },
  match: { width: 2, height: 2, survival: true, color: 0x8b6448 },
  skull_and_roses: { width: 2, height: 2, survival: true, color: 0x77494a },
  stage: { width: 2, height: 2, survival: true, color: 0x61576e },
  void: { width: 2, height: 2, survival: true, color: 0x3c3d50 },
  wither: { width: 2, height: 2, survival: true, color: 0x464646 },

  backyard: { width: 3, height: 4, survival: true, color: 0x617c52 },
  pond: { width: 3, height: 4, survival: true, color: 0x4e8175 },

  bouquet: { width: 3, height: 3, survival: true, color: 0xa67578 },
  cavebird: { width: 3, height: 3, survival: true, color: 0x655b4c },
  cotan: { width: 3, height: 3, survival: true, color: 0x5d6978 },
  endboss: { width: 3, height: 3, survival: true, color: 0x5c4c73 },
  fern: { width: 3, height: 3, survival: true, color: 0x526d4d },
  owlemons: { width: 3, height: 3, survival: true, color: 0x75664d },
  sunflowers: { width: 3, height: 3, survival: true, color: 0xb99242 },
  tides: { width: 3, height: 3, survival: true, color: 0x426f86 },

  changing: { width: 4, height: 2, survival: true, color: 0x795e50 },
  fighters: { width: 4, height: 2, survival: true, color: 0x72534c },
  finding: { width: 4, height: 2, survival: true, color: 0x536d69 },
  lowmist: { width: 4, height: 2, survival: true, color: 0x66717a },
  passage: { width: 4, height: 2, survival: true, color: 0x735e4b },

  donkey_kong: { width: 4, height: 3, survival: true, color: 0x80533e },
  skeleton: { width: 4, height: 3, survival: true, color: 0x6b665d },

  burning_skull: { width: 4, height: 4, survival: true, color: 0x7d4434 },
  orb: { width: 4, height: 4, survival: true, color: 0x4e557b },
  pigscene: { width: 4, height: 4, survival: true, color: 0x8b665a },
  pointer: { width: 4, height: 4, survival: true, color: 0x685243 },
  unpacked: { width: 4, height: 4, survival: true, color: 0x74684e },

  earth: { width: 2, height: 2, survival: false, color: 0x71644a },
  fire: { width: 2, height: 2, survival: false, color: 0xb45435 },
  water: { width: 2, height: 2, survival: false, color: 0x416b8a },
  wind: { width: 2, height: 2, survival: false, color: 0x87949a },
} as const;

export type PaintingVariant = keyof typeof PAINTING_VARIANTS;

export const ITEM_FRAME_ITEM_ID = 389;
export const GLOW_ITEM_FRAME_ITEM_ID = 20311;
export const PAINTING_ITEM_ID = 321;
export const LEAD_ITEM_ID = 420;
export const LEAD_PULL_DISTANCE = 6;
export const LEAD_SNAP_DISTANCE = 12;

const SURVIVAL_PAINTING_VARIANTS = (Object.keys(PAINTING_VARIANTS) as PaintingVariant[])
  .filter((variant) => PAINTING_VARIANTS[variant].survival);

const LEASHABLE_MOBS = new Set<MobType>([
  'cow',
  'pig',
  'sheep',
  'chicken',
  'wolf',
  'cat',
  'horse',
  'iron_golem',
]);

export function isItemFrameType(type: MobType | HangingEntityType): type is 'item_frame' | 'glow_item_frame' {
  return type === 'item_frame' || type === 'glow_item_frame';
}

export function isDecorativeMobType(type: MobType): boolean {
  return type === 'armor_stand' || isItemFrameType(type) || type === 'painting';
}

export function itemFrameDropItemId(type: 'item_frame' | 'glow_item_frame'): number {
  return type === 'glow_item_frame' ? GLOW_ITEM_FRAME_ITEM_ID : ITEM_FRAME_ITEM_ID;
}

export function isVerticalHangingFace(face: BlockFacing | undefined): face is 'north' | 'south' | 'east' | 'west' {
  return face === 'north' || face === 'south' || face === 'east' || face === 'west';
}

export function hangingEntityPosition(
  support: BlockPosition,
  face: BlockFacing,
): BlockPosition {
  switch (face) {
    case 'north': return { x: support.x, y: support.y, z: support.z - 1 };
    case 'south': return { x: support.x, y: support.y, z: support.z + 1 };
    case 'east': return { x: support.x + 1, y: support.y, z: support.z };
    case 'west': return { x: support.x - 1, y: support.y, z: support.z };
    case 'up': return { x: support.x, y: support.y + 1, z: support.z };
    case 'down': return { x: support.x, y: support.y - 1, z: support.z };
  }
}

export function hangingSupportPositionFromWorld(
  position: { x: number; y: number; z: number },
  face: BlockFacing,
): BlockPosition {
  const fx = Math.floor(position.x);
  const fy = Math.floor(position.y);
  const fz = Math.floor(position.z);
  switch (face) {
    case 'north': return { x: fx, y: fy, z: fz + 1 };
    case 'south': return { x: fx, y: fy, z: fz - 1 };
    case 'east': return { x: fx - 1, y: fy, z: fz };
    case 'west': return { x: fx + 1, y: fy, z: fz };
    case 'up': return { x: fx, y: fy - 1, z: fz };
    case 'down': return { x: fx, y: fy + 1, z: fz };
  }
}

export function hangingEntityWorldPosition(
  support: BlockPosition,
  face: BlockFacing,
): { x: number; y: number; z: number } {
  const inset = 0.03125;
  switch (face) {
    case 'north': return { x: support.x + 0.5, y: support.y + 0.5, z: support.z - inset };
    case 'south': return { x: support.x + 0.5, y: support.y + 0.5, z: support.z + 1 + inset };
    case 'east': return { x: support.x + 1 + inset, y: support.y + 0.5, z: support.z + 0.5 };
    case 'west': return { x: support.x - inset, y: support.y + 0.5, z: support.z + 0.5 };
    case 'up': return { x: support.x + 0.5, y: support.y + 1 + inset, z: support.z + 0.5 };
    case 'down': return { x: support.x + 0.5, y: support.y - inset, z: support.z + 0.5 };
  }
}

export function hangingEntityYaw(face: BlockFacing): number {
  // Hanging meshes are authored with their visible front facing local +Z.
  // Rotate that front toward the clicked face's outward normal.
  switch (face) {
    case 'north': return Math.PI;
    case 'south': return 0;
    case 'east': return Math.PI / 2;
    case 'west': return -Math.PI / 2;
    case 'up':
    case 'down':
      return 0;
  }
}

export function canPlaceHangingEntity(
  type: HangingEntityType,
  support: BlockPosition,
  face: BlockFacing | undefined,
  isSolidBlock: (x: number, y: number, z: number) => boolean,
  isOccupied: (x: number, y: number, z: number) => boolean,
): boolean {
  if (!face) return false;
  if (type === 'painting' && !isVerticalHangingFace(face)) return false;
  if (!isSolidBlock(support.x, support.y, support.z)) return false;

  const target = hangingEntityPosition(support, face);
  if (target.y < 0) return false;
  if (isSolidBlock(target.x, target.y, target.z)) return false;
  if (isOccupied(target.x + 0.5, target.y + 0.5, target.z + 0.5)) return false;
  return true;
}

export function paintingVariantSize(variant: PaintingVariant): { width: number; height: number } {
  const data = PAINTING_VARIANTS[variant];
  return { width: data.width, height: data.height };
}

export function isSurvivalPaintingVariant(variant: PaintingVariant): boolean {
  return PAINTING_VARIANTS[variant].survival;
}

export function isPaintingVariant(value: unknown): value is PaintingVariant {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PAINTING_VARIANTS, value);
}

export function paintingSupportFootprint(
  anchor: BlockPosition,
  face: 'north' | 'south' | 'east' | 'west',
  width: number,
  height: number,
): BlockPosition[] {
  const result: BlockPosition[] = [];
  for (let v = 0; v < height; v++) {
    for (let u = 0; u < width; u++) {
      if (face === 'north' || face === 'south') {
        result.push({ x: anchor.x + u, y: anchor.y + v, z: anchor.z });
      } else {
        result.push({ x: anchor.x, y: anchor.y + v, z: anchor.z + u });
      }
    }
  }
  return result;
}

export function canPlacePaintingVariant(
  variant: PaintingVariant,
  support: BlockPosition,
  face: BlockFacing | undefined,
  isSolidBlock: (x: number, y: number, z: number) => boolean,
  isOccupied: (x: number, y: number, z: number) => boolean,
): boolean {
  if (!isVerticalHangingFace(face)) return false;
  const { width, height } = paintingVariantSize(variant);
  const backing = paintingSupportFootprint(support, face, width, height);
  return backing.every((block) => {
    if (!isSolidBlock(block.x, block.y, block.z)) return false;
    const target = hangingEntityPosition(block, face);
    return target.y >= 0
      && !isSolidBlock(target.x, target.y, target.z)
      && !isOccupied(target.x + 0.5, target.y + 0.5, target.z + 0.5);
  });
}

function paintingHash(seed: number, position: BlockPosition): number {
  let hash = (seed | 0)
    ^ Math.imul(position.x | 0, 73428767)
    ^ Math.imul(position.y | 0, 912931)
    ^ Math.imul(position.z | 0, 438289);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

export function choosePaintingVariant(seed: number, position: BlockPosition): PaintingVariant {
  const index = paintingHash(seed, position) % SURVIVAL_PAINTING_VARIANTS.length;
  return SURVIVAL_PAINTING_VARIANTS[index];
}

export function chooseFittingPaintingVariant(
  seed: number,
  support: BlockPosition,
  face: BlockFacing | undefined,
  isSolidBlock: (x: number, y: number, z: number) => boolean,
  isOccupied: (x: number, y: number, z: number) => boolean,
): PaintingVariant | null {
  if (!isVerticalHangingFace(face)) return null;
  const fitting = SURVIVAL_PAINTING_VARIANTS.filter((variant) =>
    canPlacePaintingVariant(variant, support, face, isSolidBlock, isOccupied),
  );
  if (fitting.length === 0) return null;

  const largestArea = Math.max(...fitting.map((variant) => {
    const { width, height } = PAINTING_VARIANTS[variant];
    return width * height;
  }));
  const largest = fitting.filter((variant) => {
    const { width, height } = PAINTING_VARIANTS[variant];
    return width * height === largestArea;
  });
  return largest[paintingHash(seed, support) % largest.length];
}

export function paintingWorldPosition(
  support: BlockPosition,
  face: 'north' | 'south' | 'east' | 'west',
  variant: PaintingVariant,
): { x: number; y: number; z: number } {
  const { width, height } = PAINTING_VARIANTS[variant];
  const inset = 0.03125;
  const y = support.y + height / 2;
  if (face === 'north') return { x: support.x + width / 2, y, z: support.z - inset };
  if (face === 'south') return { x: support.x + width / 2, y, z: support.z + 1 + inset };
  if (face === 'east') return { x: support.x + 1 + inset, y, z: support.z + width / 2 };
  return { x: support.x - inset, y, z: support.z + width / 2 };
}

export function paintingBackingStillValid(
  position: { x: number; y: number; z: number },
  face: BlockFacing,
  variant: PaintingVariant,
  isSolidBlock: (x: number, y: number, z: number) => boolean,
): boolean {
  if (!isVerticalHangingFace(face)) return false;
  const { width, height } = PAINTING_VARIANTS[variant];
  let anchor: BlockPosition;
  if (face === 'north') {
    anchor = { x: Math.floor(position.x - width / 2), y: Math.floor(position.y - height / 2), z: Math.floor(position.z) + 1 };
  } else if (face === 'south') {
    anchor = { x: Math.floor(position.x - width / 2), y: Math.floor(position.y - height / 2), z: Math.floor(position.z) - 1 };
  } else if (face === 'east') {
    anchor = { x: Math.floor(position.x) - 1, y: Math.floor(position.y - height / 2), z: Math.floor(position.z - width / 2) };
  } else {
    anchor = { x: Math.floor(position.x) + 1, y: Math.floor(position.y - height / 2), z: Math.floor(position.z - width / 2) };
  }
  return paintingSupportFootprint(anchor, face, width, height)
    .every((block) => isSolidBlock(block.x, block.y, block.z));
}

export function nextItemFrameRotation(rotation: number): number {
  const normalized = Number.isFinite(rotation) ? Math.trunc(rotation) : 0;
  return ((normalized + 1) % 8 + 8) % 8;
}

export function itemFrameComparatorSignal(stack: ItemStack | null | undefined, rotation: number): number {
  if (!stack) return 0;
  return nextItemFrameRotation(rotation - 1) + 1;
}

export function itemFrameDisplayStack(stack: ItemStack | null | undefined): ItemStack | null {
  if (!stack) return null;
  return { ...stack, count: 1 };
}

export function isLeashableMobType(type: MobType): boolean {
  return LEASHABLE_MOBS.has(type);
}

export function isFenceBlockName(rawName: string | undefined): boolean {
  if (!rawName) return false;
  const name = rawName.replace(/^minecraft:/, '');
  return name === 'fence' || name.endsWith('_fence');
}

export function fenceLeashHolderId(
  dimension: number,
  position: BlockPosition,
): string {
  return `fence:${dimension}:${position.x}:${position.y}:${position.z}`;
}

export function mobLeashHolderId(mobId: number): string {
  return `mob:${Math.trunc(mobId)}`;
}

export function parseMobLeashHolderId(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^mob:(\d+)$/.exec(value);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isInteger(id) && id >= 0 ? id : null;
}

export function parseFenceLeashHolderId(value: string | null | undefined): {
  dimension: number;
  position: BlockPosition;
} | null {
  if (!value) return null;
  const match = /^fence:(-?\d+):(-?\d+):(-?\d+):(-?\d+)$/.exec(value);
  if (!match) return null;
  const dimension = Number(match[1]);
  const x = Number(match[2]);
  const y = Number(match[3]);
  const z = Number(match[4]);
  if (![dimension, x, y, z].every(Number.isInteger)) return null;
  return { dimension, position: { x, y, z } };
}

export function leashDistance(
  holder: { x: number; y: number; z: number },
  mob: { x: number; y: number; z: number },
): number {
  return Math.hypot(holder.x - mob.x, holder.y - mob.y, holder.z - mob.z);
}

export function shouldBreakLeash(distance: number): boolean {
  return !Number.isFinite(distance) || distance > LEAD_SNAP_DISTANCE;
}

export function leashPullVector(
  holder: { x: number; y: number; z: number },
  mob: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  const dx = holder.x - mob.x;
  const dy = holder.y - mob.y;
  const dz = holder.z - mob.z;
  const distance = Math.hypot(dx, dy, dz);
  if (!Number.isFinite(distance) || distance <= LEAD_PULL_DISTANCE || distance <= 1e-6) {
    return { x: 0, y: 0, z: 0 };
  }
  const excess = Math.min(1, (distance - LEAD_PULL_DISTANCE) / (LEAD_SNAP_DISTANCE - LEAD_PULL_DISTANCE));
  const force = 6 * excess;
  return {
    x: dx / distance * force,
    y: dy / distance * Math.min(force, 3),
    z: dz / distance * force,
  };
}
