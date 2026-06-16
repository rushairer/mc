import type { ItemStack } from '../types';
import { ItemRegistry } from '../items/ItemRegistry';

export const INVENTORY_SIZE = 36;  // 0-8 = hotbar, 9-35 = main
export const HOTBAR_SIZE = 9;
export const ARMOR_SLOTS = 4;

export class Inventory {
  /** Main inventory (36 slots): 0-8 = hotbar, 9-35 = main */
  slots: (ItemStack | null)[] = new Array(INVENTORY_SIZE).fill(null);
  /** Armor: helmet, chestplate, leggings, boots */
  armor: (ItemStack | null)[] = new Array(ARMOR_SLOTS).fill(null);

  /** Add item to inventory. Returns leftover count that didn't fit. */
  addItem(id: number, count: number = 1): number {
    const maxStack = ItemRegistry.getMaxStackSize(id);
    let remaining = count;

    // First pass: try to stack on existing slots
    for (let i = 0; i < INVENTORY_SIZE && remaining > 0; i++) {
      const slot = this.slots[i];
      if (slot && slot.id === id && slot.count < maxStack) {
        const canAdd = Math.min(remaining, maxStack - slot.count);
        slot.count += canAdd;
        remaining -= canAdd;
      }
    }

    // Second pass: fill empty slots
    for (let i = 0; i < INVENTORY_SIZE && remaining > 0; i++) {
      if (!this.slots[i]) {
        const toAdd = Math.min(remaining, maxStack);
        this.slots[i] = { id, count: toAdd };
        if (ItemRegistry.isTool(id)) {
          const def = ItemRegistry.get(id);
          this.slots[i]!.durability = def?.durability ?? 100;
        }
        remaining -= toAdd;
      }
    }

    return remaining;
  }

  /** Remove one item from a specific slot. */
  removeFromSlot(slotIndex: number, count: number = 1): void {
    const slot = this.slots[slotIndex];
    if (!slot) return;
    slot.count -= count;
    if (slot.count <= 0) {
      this.slots[slotIndex] = null;
    }
  }

  /** Get item in a specific slot. */
  getSlot(slotIndex: number): ItemStack | null {
    return this.slots[slotIndex];
  }

  /** Set a slot directly. */
  setSlot(slotIndex: number, item: ItemStack | null): void {
    this.slots[slotIndex] = item;
  }

  /** Swap two slots. */
  swapSlots(a: number, b: number): void {
    const tmp = this.slots[a];
    this.slots[a] = this.slots[b];
    this.slots[b] = tmp;
  }

  /** Get the selected hotbar slot item. */
  getSelected(selectedSlot: number): ItemStack | null {
    return this.slots[selectedSlot];
  }

  /** Check if player has a tool in the selected slot. */
  getSelectedTool(selectedSlot: number): ItemStack | null {
    const item = this.slots[selectedSlot];
    if (!item) return null;
    if (ItemRegistry.isTool(item.id)) return item;
    return null;
  }

  /** Damage a tool in the given slot by 1. Remove if broken. */
  damageTool(slotIndex: number): boolean {
    const slot = this.slots[slotIndex];
    if (!slot) return false;

    if (ItemRegistry.isTool(slot.id)) {
      const def = ItemRegistry.get(slot.id);
      if (slot.durability === undefined) {
        slot.durability = def?.durability ?? 100;
      }

      slot.durability -= 1;
      if (slot.durability <= 0) {
        this.slots[slotIndex] = null; // tool broke!
        return true;
      }
    }
    return false;
  }

  /** Serialize for save. */
  toJSON(): (ItemStack | null)[] {
    return this.slots;
  }

  /** Deserialize from save. */
  fromJSON(data: (ItemStack | null)[]): void {
    for (let i = 0; i < INVENTORY_SIZE && i < data.length; i++) {
      this.slots[i] = data[i];
    }
  }

  /** Count total of an item in inventory. */
  countItem(id: number): number {
    let total = 0;
    for (const slot of this.slots) {
      if (slot && slot.id === id) total += slot.count;
    }
    return total;
  }

  /** Remove items from inventory. Returns true if successful. */
  removeItem(id: number, count: number = 1): boolean {
    if (this.countItem(id) < count) return false;

    let remaining = count;
    for (let i = 0; i < INVENTORY_SIZE && remaining > 0; i++) {
      const slot = this.slots[i];
      if (slot && slot.id === id) {
        const take = Math.min(remaining, slot.count);
        slot.count -= take;
        remaining -= take;
        if (slot.count <= 0) this.slots[i] = null;
      }
    }
    return true;
  }

  /** Pick up item from slot (returns the stack and empties the slot). */
  pickupSlot(slotIndex: number): ItemStack | null {
    const item = this.slots[slotIndex];
    this.slots[slotIndex] = null;
    return item;
  }

  /** Split stack: take half of a slot's items. */
  splitSlot(slotIndex: number): ItemStack | null {
    const slot = this.slots[slotIndex];
    if (!slot || slot.count <= 1) return null;
    const half = Math.ceil(slot.count / 2);
    slot.count -= half;
    return { id: slot.id, count: half };
  }
}
