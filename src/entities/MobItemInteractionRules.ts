import type { ItemStack } from '../types';
import type { MobType } from './Mob';

export function isSaddleItemName(name: string): boolean {
  return name.replace(/^minecraft:/, '') === 'saddle';
}

export function isNameTagItemName(name: string): boolean {
  return name.replace(/^minecraft:/, '') === 'name_tag';
}

export function canApplySaddle(
  mobType: MobType,
  isBaby: boolean,
  isTamed: boolean,
  isSaddled: boolean,
): boolean {
  if (isBaby || isSaddled) return false;
  if (mobType === 'horse') return isTamed;
  if (mobType === 'pig') return true;
  return false;
}

export function canMountMob(
  mobType: MobType,
  isBaby: boolean,
  isTamed: boolean,
): boolean {
  if (isBaby) return false;
  if (mobType === 'horse') return true;
  if (mobType === 'pig') return true;
  return false;
}

export function canControlMountedMob(
  mobType: MobType,
  isTamed: boolean,
  isSaddled: boolean,
  heldItemName?: string,
): boolean {
  if (!isSaddled) return false;
  if (mobType === 'horse') return isTamed;
  if (mobType === 'pig') return heldItemName === 'carrot_on_a_stick';
  return false;
}

export function getNameTagLabel(stack: ItemStack | null | undefined): string | null {
  const label = stack?.customName?.trim();
  if (!label) return null;
  return label.slice(0, 50);
}

export function canApplyNameTag(stack: ItemStack | null | undefined): boolean {
  return getNameTagLabel(stack) !== null;
}
