import type { ItemStack } from '../types';

/**
 * P5.3 — Server container rules (pure, testable).
 * The server owns container contents; clients only send open/click intents.
 */

export const CONTAINER_SIZES: Record<string, number> = {
  chest: 27,
  barrel: 27,
  hopper: 5,
};

export function containerKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

/** Initialize a container's slot array for the given block name. */
export function createContainerSlots(name: string): (ItemStack | null)[] {
  const size = CONTAINER_SIZES[name] ?? 27;
  return new Array(size).fill(null);
}

/** Validate a container click: slot in range and held item well-formed. */
export function validateContainerClick(
  slotIndex: number,
  slots: (ItemStack | null)[],
  heldItem: ItemStack | null,
): boolean {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= slots.length) return false;
  if (heldItem === null) return true; // pickup only
  return Number.isInteger(heldItem.id) && heldItem.id > 0 && heldItem.count > 0;
}

/** Validate a full container upload: correct size, well-formed stacks. */
export function validateContainerSlots(slots: unknown, size: number): slots is (ItemStack | null)[] {
  if (!Array.isArray(slots) || slots.length !== size) return false;
  return slots.every((slot) => {
    if (slot === null) return true;
    if (typeof slot !== 'object' || slot === null) return false;
    const item = slot as ItemStack;
    return Number.isInteger(item.id) && item.id > 0 && item.count > 0 && item.count <= 64;
  });
}

/** Apply a click: place/swap the held item into the slot; returns the new slot. */
export function applyContainerClick(
  slots: (ItemStack | null)[],
  slotIndex: number,
  heldItem: ItemStack | null,
): (ItemStack | null)[] {
  const next = slots.map((slot) => (slot ? { ...slot } : null));
  const previous = next[slotIndex];
  // Same-id stacking up to 64.
  if (heldItem && previous && previous.id === heldItem.id && previous.count + heldItem.count <= 64) {
    next[slotIndex] = { ...previous, count: previous.count + heldItem.count };
    return next;
  }
  next[slotIndex] = heldItem ? { ...heldItem } : null;
  return next;
}
