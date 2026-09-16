import type { ItemStack } from '../types';
import { ItemRegistry } from '../items/ItemRegistry';
import { cloneItemStack, getItemStackMaxSize, itemStacksCanMerge } from '../items/ItemStackRules';
import { quickMovePlayerInventory } from '../items/InventoryTransferRules';
import { EnchantSystem } from '../systems/EnchantSystem';
import { getArmorToughness } from '../items/ArmorAttributes';
import {
  getArmorDurabilityDamage,
  getMendingRepairCapacity,
  getMendingXpCost,
} from '../systems/DurabilityRules';

export const INVENTORY_SIZE = 36;  // 0-8 = hotbar, 9-35 = main
export const HOTBAR_SIZE = 9;
export const ARMOR_SLOTS = 4;

export class Inventory {
  /** Main inventory (36 slots): 0-8 = hotbar, 9-35 = main */
  slots: (ItemStack | null)[] = new Array(INVENTORY_SIZE).fill(null);
  /** Armor: helmet, chestplate, leggings, boots */
  armor: (ItemStack | null)[] = new Array(ARMOR_SLOTS).fill(null);
  /** Offhand slot for shields, maps, torches, and other secondary items. */
  offhand: ItemStack | null = null;

  /** Add item to inventory. Returns leftover count that didn't fit. */
  addItem(id: number, count: number = 1): number {
    const maxStack = ItemRegistry.getMaxStackSize(id);
    let remaining = count;

    // First pass: try to stack on existing slots
    for (let i = 0; i < INVENTORY_SIZE && remaining > 0; i++) {
      const slot = this.slots[i];
      if (slot && itemStacksCanMerge(slot, { id, count: 1 }) && slot.count < maxStack) {
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

  /** Add a full stack while preserving metadata such as enchantments or potion effects. */
  addStack(stack: ItemStack): ItemStack | null {
    const maxStack = getItemStackMaxSize(stack);
    let remaining = stack.count;
    for (let i = 0; i < INVENTORY_SIZE && remaining > 0; i++) {
      const slot = this.slots[i];
      if (slot && itemStacksCanMerge(slot, stack) && slot.count < maxStack) {
        const canAdd = Math.min(remaining, maxStack - slot.count);
        slot.count += canAdd;
        remaining -= canAdd;
      }
    }

    for (let i = 0; i < INVENTORY_SIZE && remaining > 0; i++) {
      if (!this.slots[i]) {
        const toAdd = Math.min(remaining, maxStack);
        const placed = cloneItemStack(stack)!;
        placed.count = toAdd;
        this.slots[i] = placed;
        remaining -= toAdd;
      }
    }

    if (remaining <= 0) return null;
    const leftover = cloneItemStack(stack)!;
    leftover.count = remaining;
    return leftover;
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

  /** Get equipped armor slot. */
  getArmorSlot(slotIndex: number): ItemStack | null {
    if (!this.armor || !Array.isArray(this.armor)) {
      this.armor = new Array(ARMOR_SLOTS).fill(null);
    }
    return this.armor[slotIndex] ?? null;
  }

  /** Set equipped armor slot. */
  setArmorSlot(slotIndex: number, item: ItemStack | null): void {
    if (!this.armor || !Array.isArray(this.armor)) {
      this.armor = new Array(ARMOR_SLOTS).fill(null);
    }
    this.armor[slotIndex] = item;
  }

  /** Get the offhand slot item. */
  getOffhand(): ItemStack | null {
    return this.offhand;
  }

  /** Set the offhand slot directly. */
  setOffhand(item: ItemStack | null): void {
    this.offhand = item;
  }

  /** Swap selected hotbar item with the offhand slot. */
  swapSelectedWithOffhand(selectedSlot: number): void {
    const selected = this.getSlot(selectedSlot);
    this.setSlot(selectedSlot, this.offhand);
    this.offhand = selected;
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

  /** Damage a tool by the requested durability cost, applying Unbreaking per point. */
  damageTool(slotIndex: number, amount: number = 1): boolean {
    const slot = this.slots[slotIndex];
    if (!slot || !ItemRegistry.isTool(slot.id)) return false;

    const def = ItemRegistry.get(slot.id);
    if (slot.durability === undefined) {
      slot.durability = def?.durability ?? 100;
    }

    const cost = Math.max(0, Math.floor(amount));
    for (let i = 0; i < cost; i++) {
      if (!EnchantSystem.shouldUseDurability(slot)) continue;
      slot.durability -= 1;
      if (slot.durability <= 0) {
        this.slots[slotIndex] = null;
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
    if (!data || !Array.isArray(data)) return;
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
    const split = cloneItemStack(slot)!;
    split.count = half;
    return split;
  }

  /** Quick-move between hotbar and main inventory. Returns number of moved items. */
  quickMove(slotIndex: number): number {
    return quickMovePlayerInventory(this.slots, slotIndex);
  }

  /** Get total armor defense value. */
  getTotalArmorDefense(): number {
    if (!this.armor || !Array.isArray(this.armor)) {
      this.armor = new Array(ARMOR_SLOTS).fill(null);
    }
    let total = 0;
    for (let i = 0; i < ARMOR_SLOTS; i++) {
      const item = this.armor[i];
      if (item) {
        const def = ItemRegistry.get(item.id);
        if (def && def.armorDefense !== undefined) {
          total += def.armorDefense;
        }
      }
    }
    return total;
  }

  /** Get total Java armor toughness from equipped pieces. */
  getTotalArmorToughness(): number {
    if (!this.armor || !Array.isArray(this.armor)) {
      this.armor = new Array(ARMOR_SLOTS).fill(null);
    }
    let total = 0;
    for (const item of this.armor) {
      if (!item) continue;
      total += getArmorToughness(ItemRegistry.get(item.id)?.name);
    }
    return total;
  }

  /**
   * Damage every equipped armor item from the same raw hit. Java computes the
   * durability cost from pre-mitigation damage and applies Unbreaking to each
   * durability point independently for every worn piece.
   */
  damageArmor(rawDamage: number): void {
    if (!this.armor || !Array.isArray(this.armor)) {
      this.armor = new Array(ARMOR_SLOTS).fill(null);
    }
    const durabilityCost = getArmorDurabilityDamage(rawDamage);
    if (durabilityCost <= 0) return;

    for (let armorIndex = 0; armorIndex < ARMOR_SLOTS; armorIndex++) {
      const armorItem = this.armor[armorIndex];
      if (!armorItem) continue;

      const def = ItemRegistry.get(armorItem.id);
      if (armorItem.durability === undefined) {
        armorItem.durability = def?.durability ?? 100;
      }

      for (let point = 0; point < durabilityCost; point++) {
        if (!EnchantSystem.shouldUseDurability(armorItem)) continue;
        armorItem.durability -= 1;
        if (armorItem.durability <= 0) {
          this.armor[armorIndex] = null;
          break;
        }
      }
    }
  }

  /**
   * Route one collected XP orb through Java-style Mending eligibility: selected
   * main-hand item, offhand, or equipped armor. Returns XP left for the player.
   */
  repairWithMendingXP(
    selectedSlot: number,
    xpAmount: number,
    random: () => number = Math.random,
  ): number {
    const xp = Math.max(0, Math.floor(xpAmount));
    if (xp <= 0) return 0;

    const candidates: ItemStack[] = [];
    const selected = this.getSelected(selectedSlot);
    const equipped = [selected, this.offhand, ...this.armor];
    for (const item of equipped) {
      if (!item || EnchantSystem.getLevel(item, 'mending') <= 0) continue;
      const maxDurability = ItemRegistry.get(item.id)?.durability;
      if (!maxDurability || item.durability === undefined || item.durability >= maxDurability) continue;
      candidates.push(item);
    }

    if (candidates.length === 0) return xp;
    const rawIndex = Math.floor(random() * candidates.length);
    const chosen = candidates[Math.min(candidates.length - 1, Math.max(0, rawIndex))];
    const maxDurability = ItemRegistry.get(chosen.id)?.durability;
    if (!maxDurability || chosen.durability === undefined) return xp;

    const missing = Math.max(0, maxDurability - chosen.durability);
    const repaired = Math.min(missing, getMendingRepairCapacity(xp));
    chosen.durability += repaired;
    return Math.max(0, xp - getMendingXpCost(repaired));
  }
}
