import type { BlockFacing, ItemStack } from '../types';
import type { BlockPosition } from '../world/BehaviorRegistry';
import type { MobType } from './Mob';

export type HangingEntityType = 'item_frame' | 'painting';
export type PaintingVariant =
  | 'kebab'
  | 'aztec'
  | 'alban'
  | 'aztec2'
  | 'bomb'
  | 'plant'
  | 'wasteland';

export const ITEM_FRAME_ITEM_ID = 389;
export const PAINTING_ITEM_ID = 321;
export const LEAD_ITEM_ID = 420;
export const LEAD_PULL_DISTANCE = 6;
export const LEAD_SNAP_DISTANCE = 12;

const PAINTING_VARIANTS_1X1: readonly PaintingVariant[] = [
  'kebab',
  'aztec',
  'alban',
  'aztec2',
  'bomb',
  'plant',
  'wasteland',
];

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
  switch (face) {
    case 'north': return 0;
    case 'south': return Math.PI;
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

export function isPaintingVariant(value: unknown): value is PaintingVariant {
  return typeof value === 'string' && (PAINTING_VARIANTS_1X1 as readonly string[]).includes(value);
}

export function choosePaintingVariant(seed: number, position: BlockPosition): PaintingVariant {
  let hash = (seed | 0) ^ Math.imul(position.x | 0, 73428767) ^ Math.imul(position.y | 0, 912931) ^ Math.imul(position.z | 0, 438289);
  hash ^= hash >>> 16;
  const index = Math.abs(hash) % PAINTING_VARIANTS_1X1.length;
  return PAINTING_VARIANTS_1X1[index];
}

export function nextItemFrameRotation(rotation: number): number {
  const normalized = Number.isFinite(rotation) ? Math.trunc(rotation) : 0;
  return ((normalized + 1) % 8 + 8) % 8;
}

export function itemFrameDisplayStack(stack: ItemStack | null | undefined): ItemStack | null {
  if (!stack) return null;
  return { ...stack, count: 1 };
}

export function isLeashableMobType(type: MobType): boolean {
  return LEASHABLE_MOBS.has(type);
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
