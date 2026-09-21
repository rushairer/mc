import type { BlockPosition } from '../world/BehaviorRegistry';
import type { ItemStack } from '../types';

export const ARMOR_STAND_ITEM_ID = 416;
export const ARMOR_STAND_HEIGHT = 1.975;
export const ARMOR_STAND_WIDTH = 0.5;

export type ArmorStandSlot = 'helmet' | 'chestplate' | 'leggings' | 'boots';

export function armorStandSlotIndex(slot: ArmorStandSlot): number {
  switch (slot) {
    case 'helmet': return 0;
    case 'chestplate': return 1;
    case 'leggings': return 2;
    case 'boots': return 3;
  }
}

export function snapArmorStandYaw(yaw: number): number {
  const step = Math.PI / 4;
  return Math.round(yaw / step) * step;
}

export function canPlaceArmorStandAt(
  position: BlockPosition,
  face: string,
  isSolidBlock: (x: number, y: number, z: number) => boolean,
  isOccupied: (x: number, y: number, z: number) => boolean,
): boolean {
  if (face === 'down') return false;
  if (position.y < 0) return false;
  if (isSolidBlock(position.x, position.y, position.z)) return false;
  if (isSolidBlock(position.x, position.y + 1, position.z)) return false;
  if (!isSolidBlock(position.x, position.y - 1, position.z)) return false;
  if (isOccupied(position.x + 0.5, position.y, position.z + 0.5)) return false;
  return true;
}

export function firstEquippedArmorStandSlot(equipment: readonly (ItemStack | null)[]): number {
  return equipment.findIndex(Boolean);
}
