import type { BlockFacing, ItemStack } from '../types';
import {
  cloneItemStack,
  getItemStackMaxSize,
  itemStacksCanMerge,
} from './ItemStackRules';
import { isShulkerBoxStack } from './ShulkerBoxRules';
import { EnchantSystem } from '../systems/EnchantSystem';
import { getDurabilityUseChance } from '../systems/DurabilityRules';

export type DispenserLikeKind = 'dispenser' | 'dropper';

export interface DispenserActivationResult {
  action: 'empty' | 'insert' | 'eject';
  sourceSlots: (ItemStack | null)[];
  targetSlots?: (ItemStack | null)[];
  stack?: ItemStack;
  sourceSlot?: number;
}

/** Vanilla-style uniform choice among non-empty slots. */
export function selectDispenserSlot(
  slots: readonly (ItemStack | null)[],
  random: () => number = Math.random,
): number {
  const candidates: number[] = [];
  for (let i = 0; i < slots.length; i++) {
    if (slots[i] && slots[i]!.count > 0) candidates.push(i);
  }
  if (candidates.length === 0) return -1;
  const roll = Math.min(0.999999999999, Math.max(0, random()));
  return candidates[Math.floor(roll * candidates.length)];
}

export function dispenserFacingOffset(facing: BlockFacing | undefined): { x: number; y: number; z: number } {
  switch (facing) {
    case 'up': return { x: 0, y: 1, z: 0 };
    case 'down': return { x: 0, y: -1, z: 0 };
    case 'south': return { x: 0, y: 0, z: 1 };
    case 'east': return { x: 1, y: 0, z: 0 };
    case 'west': return { x: -1, y: 0, z: 0 };
    case 'north':
    default: return { x: 0, y: 0, z: -1 };
  }
}

function oneItem(stack: ItemStack): ItemStack {
  const result = cloneItemStack(stack)!;
  result.count = 1;
  return result;
}

/**
 * Try inserting exactly one item into an adjacent container. This is the
 * Dropper-only transfer path; Dispensers never use it.
 */
export function insertOneFromDropper(
  targetSlots: readonly (ItemStack | null)[],
  stack: ItemStack,
  targetContainerType?: string,
): { slots: (ItemStack | null)[]; inserted: boolean } {
  const next = targetSlots.map((slot) => cloneItemStack(slot));
  if (targetContainerType === 'shulker_box' && isShulkerBoxStack(stack)) {
    return { slots: next, inserted: false };
  }

  for (let i = 0; i < next.length; i++) {
    const target = next[i];
    if (!target || !itemStacksCanMerge(target, stack)) continue;
    const max = getItemStackMaxSize(target);
    if (target.count >= max) continue;
    next[i] = { ...target, count: target.count + 1 };
    return { slots: next, inserted: true };
  }

  for (let i = 0; i < next.length; i++) {
    if (next[i]) continue;
    next[i] = oneItem(stack);
    return { slots: next, inserted: true };
  }

  return { slots: next, inserted: false };
}

/**
 * One redstone activation consumes at most one item. Droppers prefer inserting
 * into the container directly in front; otherwise both blocks emit one item.
 *
 * Special Dispenser item behaviors (arrows, buckets, TNT, armor...) can layer
 * on top of the 'eject' action without changing slot-selection semantics.
 */
export function activateDispenserLike(
  kind: DispenserLikeKind,
  sourceSlots: readonly (ItemStack | null)[],
  options: {
    targetSlots?: readonly (ItemStack | null)[];
    targetContainerType?: string;
    random?: () => number;
    sourceSlot?: number;
  } = {},
): DispenserActivationResult {
  const source = sourceSlots.map((slot) => cloneItemStack(slot));
  const sourceSlot = options.sourceSlot ?? selectDispenserSlot(source, options.random ?? Math.random);
  if (sourceSlot < 0) return { action: 'empty', sourceSlots: source };

  const selected = source[sourceSlot]!;
  const emitted = oneItem(selected);

  if (kind === 'dropper' && options.targetSlots) {
    const inserted = insertOneFromDropper(options.targetSlots, emitted, options.targetContainerType);
    if (inserted.inserted) {
      selected.count -= 1;
      source[sourceSlot] = selected.count > 0 ? selected : null;
      return {
        action: 'insert',
        sourceSlots: source,
        targetSlots: inserted.slots,
        stack: emitted,
        sourceSlot,
      };
    }
  }

  selected.count -= 1;
  source[sourceSlot] = selected.count > 0 ? selected : null;
  return {
    action: 'eject',
    sourceSlots: source,
    targetSlots: options.targetSlots?.map((slot) => cloneItemStack(slot)),
    stack: emitted,
    sourceSlot,
  };
}

export type DispenserProjectileKind =
  | 'arrow'
  | 'snowball'
  | 'egg'
  | 'experience_bottle'
  | 'potion'
  | 'firework_rocket'
  | 'fireball'
  | 'wind_charge';

export type DispenserEquipmentSlot = 'helmet' | 'chestplate' | 'leggings' | 'boots';

export type DispenserSpecialAction =
  | { kind: 'projectile'; projectile: DispenserProjectileKind; potionVariant?: 'splash' | 'lingering' }
  | { kind: 'prime_tnt' }
  | { kind: 'ignite' }
  | { kind: 'place_fluid'; blockName: 'water' | 'lava' | 'powder_snow' }
  | { kind: 'collect_fluid' }
  | { kind: 'spawn_egg' }
  | { kind: 'armor_stand' }
  | { kind: 'boat'; chest: boolean }
  | { kind: 'minecart' }
  | { kind: 'shulker_box' }
  | { kind: 'bone_meal' }
  | { kind: 'shears' }
  | { kind: 'glass_bottle' }
  | { kind: 'equip'; slot: DispenserEquipmentSlot; noFallback: boolean };

export function getDispenserSpecialAction(itemName: string | null | undefined): DispenserSpecialAction | null {
  switch (itemName) {
    case 'arrow':
    case 'spectral_arrow':
    case 'tipped_arrow':
      return { kind: 'projectile', projectile: 'arrow' };
    case 'snowball':
      return { kind: 'projectile', projectile: 'snowball' };
    case 'egg':
      return { kind: 'projectile', projectile: 'egg' };
    case 'experience_bottle':
      return { kind: 'projectile', projectile: 'experience_bottle' };
    case 'splash_potion':
      return { kind: 'projectile', projectile: 'potion', potionVariant: 'splash' };
    case 'lingering_potion':
      return { kind: 'projectile', projectile: 'potion', potionVariant: 'lingering' };
    case 'firework_rocket':
    case 'fireworks':
      return { kind: 'projectile', projectile: 'firework_rocket' };
    case 'fire_charge':
      return { kind: 'projectile', projectile: 'fireball' };
    case 'wind_charge':
      return { kind: 'projectile', projectile: 'wind_charge' };
    case 'tnt':
      return { kind: 'prime_tnt' };
    case 'flint_and_steel':
      return { kind: 'ignite' };
    case 'water_bucket':
      return { kind: 'place_fluid', blockName: 'water' };
    case 'lava_bucket':
      return { kind: 'place_fluid', blockName: 'lava' };
    case 'powder_snow_bucket':
      return { kind: 'place_fluid', blockName: 'powder_snow' };
    case 'bucket':
      return { kind: 'collect_fluid' };
    case 'armor_stand':
      return { kind: 'armor_stand' };
    case 'bone_meal':
      return { kind: 'bone_meal' };
    case 'shears':
      return { kind: 'shears' };
    case 'glass_bottle':
      return { kind: 'glass_bottle' };
    default: {
      if (itemName?.endsWith('_spawn_egg')) return { kind: 'spawn_egg' };
      if (itemName === 'boat' || (itemName?.endsWith('_boat') && !itemName.endsWith('_chest_boat'))) {
        return { kind: 'boat', chest: false };
      }
      if (itemName?.endsWith('_chest_boat')) return { kind: 'boat', chest: true };
      if (itemName === 'minecart' || itemName?.endsWith('_minecart')) return { kind: 'minecart' };
      if (itemName === 'shulker_box' || itemName?.endsWith('_shulker_box')) return { kind: 'shulker_box' };

      const slot = dispenserEquipmentSlot(itemName);
      if (slot) {
        const noFallback = isDispenserHeadItemName(itemName);
        return { kind: 'equip', slot, noFallback };
      }
      return null;
    }
  }
}

export function consumeDispenserSlot(
  slots: readonly (ItemStack | null)[],
  sourceSlot: number,
): (ItemStack | null)[] {
  const next = slots.map((slot) => cloneItemStack(slot));
  const selected = next[sourceSlot];
  if (!selected) return next;
  selected.count -= 1;
  next[sourceSlot] = selected.count > 0 ? selected : null;
  return next;
}

export function replaceOneDispenserItem(
  slots: readonly (ItemStack | null)[],
  sourceSlot: number,
  replacement: ItemStack,
): { slots: (ItemStack | null)[]; overflow: ItemStack | null } {
  const next = consumeDispenserSlot(slots, sourceSlot);
  if (!next[sourceSlot]) {
    next[sourceSlot] = cloneItemStack(replacement);
    return { slots: next, overflow: null };
  }

  const inserted = insertOneFromDropper(next, replacement);
  return {
    slots: inserted.slots,
    overflow: inserted.inserted ? null : cloneItemStack(replacement),
  };
}

export function damageDispenserTool(
  slots: readonly (ItemStack | null)[],
  sourceSlot: number,
  maxDurability: number,
  random: () => number = Math.random,
): (ItemStack | null)[] {
  const next = slots.map((slot) => cloneItemStack(slot));
  const selected = next[sourceSlot];
  if (!selected) return next;
  const useChance = getDurabilityUseChance(EnchantSystem.getLevel(selected, 'unbreaking'), 'tool');
  if (random() >= useChance) return next;
  const remaining = (selected.durability ?? maxDurability) - 1;
  next[sourceSlot] = remaining > 0 ? { ...selected, durability: remaining } : null;
  return next;
}

export function collectableFluidBucketName(blockName: string | null | undefined): 'water_bucket' | 'lava_bucket' | 'powder_snow_bucket' | null {
  if (blockName === 'water') return 'water_bucket';
  if (blockName === 'lava') return 'lava_bucket';
  if (blockName === 'powder_snow') return 'powder_snow_bucket';
  return null;
}

export function isDispenserFluidPlacementReplaceable(blockName: string | null | undefined): boolean {
  return blockName === undefined
    || blockName === 'air'
    || blockName === 'water'
    || blockName === 'lava'
    || blockName === 'tall_grass'
    || blockName === 'grass'
    || blockName === 'dandelion'
    || blockName === 'poppy';
}

export function isDispenserHeadItemName(itemName: string | null | undefined): boolean {
  if (!itemName) return false;
  return itemName === 'carved_pumpkin'
    || itemName === 'skull'
    || itemName === 'head'
    || itemName.endsWith('_head')
    || itemName.endsWith('_skull');
}

export function dispenserEquipmentSlot(itemName: string | null | undefined): DispenserEquipmentSlot | null {
  if (!itemName) return null;
  if (itemName.endsWith('_helmet') || isDispenserHeadItemName(itemName)) return 'helmet';
  if (itemName.endsWith('_chestplate') || itemName === 'elytra') return 'chestplate';
  if (itemName.endsWith('_leggings')) return 'leggings';
  if (itemName.endsWith('_boots')) return 'boots';
  return null;
}

export function dispenserEquipmentSlotIndex(slot: DispenserEquipmentSlot): number {
  switch (slot) {
    case 'helmet': return 0;
    case 'chestplate': return 1;
    case 'leggings': return 2;
    case 'boots': return 3;
  }
}

export function canDispenserPlaceBoat(
  targetIsWater: boolean,
  targetIsAir: boolean,
  belowIsWater: boolean,
): boolean {
  return targetIsWater || (targetIsAir && belowIsWater);
}
