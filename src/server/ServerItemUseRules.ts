import type { ItemStack } from '../types';
import { ItemRegistry } from '../items/ItemRegistry';
import { isServerSignStylingItemName } from './ServerSignRules';
import { isSpawnEggItemName } from '../world/SpawnEggRules';

export type ServerItemUseFace = 'north' | 'south' | 'east' | 'west' | 'up' | 'down';

export interface ServerBlockItemUseIntent {
  kind: 'block';
  itemId: number;
  x: number;
  y: number;
  z: number;
  face: ServerItemUseFace;
}

export interface ServerEntityItemUseIntent {
  kind: 'entity';
  itemId: number;
  entityId: number;
}

export type ServerItemUseIntent = ServerBlockItemUseIntent | ServerEntityItemUseIntent;

const validFace = (value: unknown): value is ServerItemUseFace =>
  value === 'north' || value === 'south' || value === 'east' || value === 'west' || value === 'up' || value === 'down';

const validCoordinate = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value);

export function parseServerItemUseIntent(payload: unknown): ServerItemUseIntent | null {
  if (!payload || typeof payload !== 'object') return null;
  const raw = payload as Record<string, unknown>;
  const itemId = Number(raw.itemId);
  if (!Number.isInteger(itemId) || itemId <= 0) return null;

  if (raw.kind === 'block') {
    if (!validCoordinate(raw.x) || !validCoordinate(raw.y) || !validCoordinate(raw.z) || !validFace(raw.face)) return null;
    return { kind: 'block', itemId, x: raw.x, y: raw.y, z: raw.z, face: raw.face };
  }

  if (raw.kind === 'entity') {
    const entityId = Number(raw.entityId);
    if (!Number.isInteger(entityId) || entityId < 0) return null;
    return { kind: 'entity', itemId, entityId };
  }

  return null;
}

export function isSupportedServerItemUseName(name: string, kind: ServerItemUseIntent['kind']): boolean {
  if (kind === 'entity') return name === 'shears' || name === 'saddle' || name === 'name_tag' || name === 'lead';
  return name === 'bucket'
    || name === 'water_bucket'
    || name === 'lava_bucket'
    || name === 'powder_snow_bucket'
    || name === 'flint_and_steel'
    || name === 'shears'
    || name === 'boat'
    || name.endsWith('_boat')
    || name.includes('minecart')
    || name === 'armor_stand'
    || name === 'item_frame'
    || name === 'painting'
    || isSpawnEggItemName(name)
    || isServerSignStylingItemName(name)
    || serverItemOnBlockKind(name) !== null;
}

export function isValidServerItemUseForHeldStack(
  intent: ServerItemUseIntent,
  held: ItemStack | null | undefined,
): boolean {
  if (!held || held.count <= 0 || held.id !== intent.itemId) return false;
  const name = ItemRegistry.get(held.id)?.name;
  return !!name && isSupportedServerItemUseName(name, intent.kind);
}

export function adjacentBlockPosition(
  x: number,
  y: number,
  z: number,
  face: ServerItemUseFace,
): { x: number; y: number; z: number } {
  switch (face) {
    case 'east': return { x: x + 1, y, z };
    case 'west': return { x: x - 1, y, z };
    case 'up': return { x, y: y + 1, z };
    case 'down': return { x, y: y - 1, z };
    case 'south': return { x, y, z: z + 1 };
    case 'north':
    default: return { x, y, z: z - 1 };
  }
}

export function bucketFillItemName(targetBlockName: string): 'water_bucket' | 'lava_bucket' | 'powder_snow_bucket' | null {
  if (targetBlockName === 'water') return 'water_bucket';
  if (targetBlockName === 'lava') return 'lava_bucket';
  if (targetBlockName === 'powder_snow') return 'powder_snow_bucket';
  return null;
}

export function bucketPlacedBlockName(bucketName: string): 'water' | 'lava' | 'powder_snow' | null {
  if (bucketName === 'water_bucket') return 'water';
  if (bucketName === 'lava_bucket') return 'lava';
  if (bucketName === 'powder_snow_bucket') return 'powder_snow';
  return null;
}

export function vehicleTypeForBoatItemName(name: string): 'boat' | 'chest_boat' | null {
  if (name === 'boat' || (name.endsWith('_boat') && !name.endsWith('_chest_boat'))) return 'boat';
  if (name.endsWith('_chest_boat')) return 'chest_boat';
  return null;
}

export function isMinecartItemName(name: string): boolean {
  return name === 'minecart' || name.endsWith('_minecart');
}

export type ServerItemOnBlockKind = 'axe' | 'shovel' | 'hoe' | 'bone_meal' | 'fire_charge' | 'ender_eye';

export function serverItemOnBlockKind(name: string): ServerItemOnBlockKind | null {
  if (name === 'bone_meal') return 'bone_meal';
  if (name === 'fire_charge') return 'fire_charge';
  if (name === 'ender_eye') return 'ender_eye';
  if (name.endsWith('_shovel')) return 'shovel';
  if (name.endsWith('_axe')) return 'axe';
  if (name.endsWith('_hoe')) return 'hoe';
  return null;
}

export interface HeldReplacementResult {
  held: ItemStack | null;
  remainder: ItemStack | null;
}

export function replaceOneHeldItem(
  held: ItemStack,
  replacementItemId: number,
  creative: boolean,
): HeldReplacementResult {
  if (creative) return { held: { ...held }, remainder: null };
  if (held.count <= 1) return { held: { id: replacementItemId, count: 1 }, remainder: null };
  return {
    held: { ...held, count: held.count - 1 },
    remainder: { id: replacementItemId, count: 1 },
  };
}

export const SERVER_TNT_FUSE_SECONDS = 4;
