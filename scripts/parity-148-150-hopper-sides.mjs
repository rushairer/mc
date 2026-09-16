import { readFileSync, writeFileSync } from 'node:fs';

function read(path) { return readFileSync(path, 'utf8'); }
function write(path, content) { writeFileSync(path, content, 'utf8'); }
function replaceOnce(source, from, to, label) {
  const first = source.indexOf(from);
  if (first < 0) throw new Error(`missing patch target: ${label}`);
  if (source.indexOf(from, first + from.length) >= 0) throw new Error(`ambiguous patch target: ${label}`);
  return source.slice(0, first) + to + source.slice(first + from.length);
}

{
  const path = 'src/systems/BrewingSystem.ts';
  let s = read(path);
  s = replaceOnce(s,
`  isPotion(item: ItemStack | null): boolean {
    return item?.id === POTION_ID;
  },

  getPotionKind`,
`  isPotion(item: ItemStack | null): boolean {
    return item?.id === POTION_ID;
  },

  isBrewingIngredient(item: ItemStack | null): boolean {
    if (!item) return false;
    return BREWING_RECIPES.some((recipe) => recipe.ingredientId === item.id) ||
      POTION_MODIFIERS.some((modifier) => modifier.ingredientId === item.id);
  },

  getPotionKind`, 'brewing ingredient predicate');
  write(path, s);
}

{
  const path = 'src/systems/HopperSystem.ts';
  let s = read(path);
  s = replaceOnce(s,
`import { ItemRegistry } from '../items/ItemRegistry';
import type { ItemStack, BlockFacing, BlockMetadata } from '../types';`,
`import { ItemRegistry } from '../items/ItemRegistry';
import { isSmeltingFuel } from '../items/SmeltingRecipes';
import { BrewingSystem } from './BrewingSystem';
import type { ItemStack, BlockFacing, BlockMetadata } from '../types';`, 'hopper sided imports');

  s = replaceOnce(s,
`const HOPPER_TRANSFER_COOLDOWN = 0.4; // 8 game ticks at 20 TPS
const TIMER_EPSILON = 1e-9;

export class HopperSystem {`,
`const HOPPER_TRANSFER_COOLDOWN = 0.4; // 8 game ticks at 20 TPS
const TIMER_EPSILON = 1e-9;
const BLAZE_POWDER_ID = 377;
const GLASS_BOTTLE_ID = 374;
const EMPTY_BUCKET_ID = 325;

function isFurnaceContainer(containerType: string): boolean {
  return containerType === 'furnace' || containerType === 'smoker' || containerType === 'blast_furnace';
}

/** Slots visible to a hopper inserting through the target face. */
export function getHopperInsertionSlots(
  containerType: string,
  face: 'top' | 'side',
  item: ItemStack,
): number[] | undefined {
  if (isFurnaceContainer(containerType)) {
    if (face === 'top') return [0];
    return isSmeltingFuel(item.id) ? [1] : [];
  }
  if (containerType === 'brewing_stand') {
    if (face === 'top') return BrewingSystem.isBrewingIngredient(item) ? [3] : [];
    if (item.id === BLAZE_POWDER_ID) return [4];
    return BrewingSystem.isBottle(item) ? [0, 1, 2] : [];
  }
  return undefined;
}

/** Slots visible from the bottom face to a hopper pulling from a container above. */
export function getHopperExtractionSlots(containerType: string, inventoryLength: number): number[] {
  if (isFurnaceContainer(containerType)) return [2, 1];
  if (containerType === 'brewing_stand') return [0, 1, 2, 3];
  return Array.from({ length: inventoryLength }, (_, i) => i);
}

export function canHopperExtractSlot(containerType: string, slotIndex: number, item: ItemStack): boolean {
  if (isFurnaceContainer(containerType)) {
    return slotIndex === 2 || (slotIndex === 1 && (item.id & 0x3FF) === EMPTY_BUCKET_ID);
  }
  if (containerType === 'brewing_stand') {
    return slotIndex >= 0 && slotIndex <= 2 || (slotIndex === 3 && item.id === GLASS_BOTTLE_ID);
  }
  return true;
}

export function getHopperTargetSlotLimit(containerType: string, slotIndex: number, itemId: number): number {
  if (containerType === 'brewing_stand' && slotIndex >= 0 && slotIndex <= 2) return 1;
  return ItemRegistry.getMaxStackSize(itemId);
}

export class HopperSystem {`, 'sided inventory rules');

  s = replaceOnce(s,
`          const allowedSlots = this.getPushAllowedSlots(facing, targetMeta.containerType, item.id);
          const pushedCount = this.pushItem(targetMeta.inventory, { ...item, count: 1 }, allowedSlots);`,
`          const allowedSlots = this.getPushAllowedSlots(facing, targetMeta.containerType, item);
          const pushedCount = this.pushItem(
            targetMeta.inventory,
            { ...item, count: 1 },
            allowedSlots,
            (slotIndex) => getHopperTargetSlotLimit(targetMeta.containerType!, slotIndex, item.id),
          );`, 'sided push application');

  s = replaceOnce(s,
`      const allowedSlots = this.getPullAllowedSlots(aboveMeta.containerType);
      for (const slotIdx of allowedSlots) {
        if (slotIdx >= aboveMeta.inventory.length) continue;
        const item = aboveMeta.inventory[slotIdx];
        if (item && item.count > 0) {`,
`      const allowedSlots = this.getPullAllowedSlots(aboveMeta.containerType, aboveMeta.inventory.length);
      for (const slotIdx of allowedSlots) {
        if (slotIdx >= aboveMeta.inventory.length) continue;
        const item = aboveMeta.inventory[slotIdx];
        if (item && item.count > 0 && canHopperExtractSlot(aboveMeta.containerType, slotIdx, item)) {`, 'sided pull application');

  const oldRules = `  private getPushAllowedSlots(facing: BlockFacing, containerType: string, itemId: number): number[] | undefined {
    if (containerType === 'furnace') {
      if (facing === 'down') {
        return [0];
      }
      return [1];
    }
    if (containerType === 'brewing_stand') {
      if (facing === 'down') {
        return [3];
      }
      if (itemId === 377) {
        return [4];
      }
      return [0, 1, 2];
    }
    return undefined;
  }

  private getPullAllowedSlots(containerType: string): number[] {
    if (containerType === 'furnace') {
      return [2];
    }
    if (containerType === 'brewing_stand') {
      return [0, 1, 2];
    }
    return Array.from({ length: 27 }, (_, i) => i);
  }

  private pushItem(inventory: (ItemStack | null)[], stack: ItemStack, allowedSlots?: number[]): number {
    const maxStack = ItemRegistry.getMaxStackSize(stack.id);`;
  const newRules = `  private getPushAllowedSlots(facing: BlockFacing, containerType: string, item: ItemStack): number[] | undefined {
    // A hopper can only point down or horizontally. Down enters the top face;
    // every horizontal facing enters a side face.
    return getHopperInsertionSlots(containerType, facing === 'down' ? 'top' : 'side', item);
  }

  private getPullAllowedSlots(containerType: string, inventoryLength: number): number[] {
    // Pulling from a container directly above always accesses its bottom face.
    return getHopperExtractionSlots(containerType, inventoryLength);
  }

  private pushItem(
    inventory: (ItemStack | null)[],
    stack: ItemStack,
    allowedSlots?: number[],
    slotLimit?: (slotIndex: number) => number,
  ): number {
    const maxStack = ItemRegistry.getMaxStackSize(stack.id);`;
  s = replaceOnce(s, oldRules, newRules, 'replace simplified sided rules');

  s = replaceOnce(s,
`      const slot = inventory[idx];
      if (slot && slot.id === stack.id && slot.count < maxStack) {
        const addCount = Math.min(remaining, maxStack - slot.count);`,
`      const slot = inventory[idx];
      const maxForSlot = Math.min(maxStack, slotLimit?.(idx) ?? maxStack);
      if (slot && slot.id === stack.id && slot.count < maxForSlot) {
        const addCount = Math.min(remaining, maxForSlot - slot.count);`, 'per-slot merge capacity');

  s = replaceOnce(s,
`      const slot = inventory[idx];
      if (!slot) {
        const addCount = Math.min(remaining, maxStack);`,
`      const slot = inventory[idx];
      if (!slot) {
        const maxForSlot = Math.min(maxStack, slotLimit?.(idx) ?? maxStack);
        const addCount = Math.min(remaining, maxForSlot);`, 'per-slot empty capacity');

  write(path, s);
}

{
  const path = 'tests/hopper-parity.test.ts';
  let s = read(path);
  s = replaceOnce(s,
`import { HopperSystem } from '../src/systems/HopperSystem';`,
`import {
  HopperSystem,
  canHopperExtractSlot,
  getHopperExtractionSlots,
  getHopperInsertionSlots,
  getHopperTargetSlotLimit,
} from '../src/systems/HopperSystem';`, 'hopper rule test imports');

  s += `

test('furnace hopper faces expose Java input fuel and output slots', () => {
  assert.deepEqual(getHopperInsertionSlots('furnace', 'top', { id: 4, count: 1 }), [0]);
  assert.deepEqual(getHopperInsertionSlots('smoker', 'side', { id: 263, count: 1 }), [1]);
  assert.deepEqual(getHopperInsertionSlots('blast_furnace', 'side', { id: 4, count: 1 }), []);
  assert.deepEqual(getHopperExtractionSlots('furnace', 3), [2, 1]);
  assert.equal(canHopperExtractSlot('furnace', 2, { id: 265, count: 1 }), true);
  assert.equal(canHopperExtractSlot('furnace', 1, { id: 325, count: 1 }), true);
  assert.equal(canHopperExtractSlot('furnace', 1, { id: 263, count: 1 }), false);
});

test('brewing stand top accepts ingredients while side accepts fuel or bottles', () => {
  assert.deepEqual(getHopperInsertionSlots('brewing_stand', 'top', { id: 372, count: 1 }), [3]);
  assert.deepEqual(getHopperInsertionSlots('brewing_stand', 'top', { id: 373, count: 1 }), []);
  assert.deepEqual(getHopperInsertionSlots('brewing_stand', 'side', { id: 377, count: 1 }), [4]);
  assert.deepEqual(getHopperInsertionSlots('brewing_stand', 'side', { id: 373, count: 1 }), [0, 1, 2]);
  assert.deepEqual(getHopperInsertionSlots('brewing_stand', 'side', { id: 374, count: 1 }), [0, 1, 2]);
  assert.deepEqual(getHopperInsertionSlots('brewing_stand', 'side', { id: 353, count: 1 }), []);
});

test('brewing stand bottom exposes bottles plus the ingredient remainder edge case', () => {
  assert.deepEqual(getHopperExtractionSlots('brewing_stand', 5), [0, 1, 2, 3]);
  assert.equal(canHopperExtractSlot('brewing_stand', 0, { id: 373, count: 1 }), true);
  assert.equal(canHopperExtractSlot('brewing_stand', 3, { id: 374, count: 1 }), true);
  assert.equal(canHopperExtractSlot('brewing_stand', 3, { id: 372, count: 1 }), false);
  assert.equal(canHopperExtractSlot('brewing_stand', 4, { id: 377, count: 1 }), false);
});

test('brewing bottle slots are single-item slots and generic containers expose their full size', () => {
  assert.equal(getHopperTargetSlotLimit('brewing_stand', 0, 374), 1);
  assert.deepEqual(getHopperExtractionSlots('chest', 54), Array.from({ length: 54 }, (_, i) => i));
});
`;
  write(path, s);
}

console.log('Java sided hopper rules applied');
