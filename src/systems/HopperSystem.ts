import * as THREE from 'three';
import { CHUNK_SIZE, WORLD_HEIGHT } from '../constants';
import { ChunkManager } from '../world/ChunkManager';
import { DroppedItemSystem } from './DroppedItemSystem';
import { BlockRegistry } from '../world/BlockRegistry';
import { ItemRegistry } from '../items/ItemRegistry';
import { cloneItemStack, itemStacksCanMerge } from '../items/ItemStackRules';
import { isSmeltingFuel } from '../items/SmeltingRecipes';
import { BrewingSystem } from './BrewingSystem';
import type { ItemStack, BlockFacing, BlockMetadata } from '../types';

const HOPPER_TRANSFER_COOLDOWN = 0.4; // 8 game ticks at 20 TPS
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

export class HopperSystem {
  private chunks: ChunkManager;
  private droppedItems: DroppedItemSystem;
  private onStateChange: () => void;

  constructor(chunks: ChunkManager, droppedItems: DroppedItemSystem, onStateChange: () => void) {
    this.chunks = chunks;
    this.droppedItems = droppedItems;
    this.onStateChange = onStateChange;
  }

  update(dt: number) {
    let anyTransfer = false;

    for (const chunk of this.chunks.chunks.values()) {
      for (const [index, metadata] of chunk.metadata.entries()) {
        const blockId = chunk.data[index];
        const def = BlockRegistry.get(blockId);
        if (!def || def.name !== 'hopper') continue;

        // Decrement the 8-game-tick transfer cooldown. When the remaining
        // cooldown reaches zero exactly on this update, vanilla permits a new
        // transfer immediately instead of idling for one extra render frame.
        let cooldown = metadata.transferCooldown ?? 0;
        if (cooldown > 0) {
          cooldown = Math.max(0, cooldown - dt);
          metadata.transferCooldown = cooldown;
          if (cooldown > TIMER_EPSILON) continue;
        }

        // If redstone powered, hopper is locked
        if (metadata.powered === true) {
          continue;
        }

        const localX = index % CHUNK_SIZE;
        const localZ = Math.floor(index / CHUNK_SIZE) % CHUNK_SIZE;
        const localY = Math.floor(index / (CHUNK_SIZE * CHUNK_SIZE));
        const worldX = chunk.cx * CHUNK_SIZE + localX;
        const worldY = localY;
        const worldZ = chunk.cz * CHUNK_SIZE + localZ;

        // Ensure inventory exists
        if (!metadata.inventory) {
          metadata.inventory = new Array(5).fill(null);
        }

        // Try transfer
        const transferred = this.tickHopper(worldX, worldY, worldZ, metadata);
        if (transferred) {
          metadata.transferCooldown = HOPPER_TRANSFER_COOLDOWN;
          anyTransfer = true;
        }
      }
    }

    if (anyTransfer) {
      this.onStateChange();
    }
  }

  private tickHopper(x: number, y: number, z: number, meta: BlockMetadata): boolean {
    if (!meta.inventory) return false;

    // 1. PUSH: Try to push an item from hopper to target container in facing direction
    const facing = meta.facing ?? 'down';
    const targetPos = this.getFacingPosition(x, y, z, facing);
    const targetMeta = this.chunks.getBlockMeta(targetPos.x, targetPos.y, targetPos.z);
    
    if (targetMeta && targetMeta.containerType && targetMeta.inventory) {
      // Find first item in hopper to push
      for (let i = 0; i < meta.inventory.length; i++) {
        const item = meta.inventory[i];
        if (item && item.count > 0) {
          // Determine allowed slots in target container
          const allowedSlots = this.getPushAllowedSlots(facing, targetMeta.containerType, item);
          const pushedCount = this.pushItem(
            targetMeta.inventory,
            { ...item, count: 1 },
            allowedSlots,
            (slotIndex) => getHopperTargetSlotLimit(targetMeta.containerType!, slotIndex, item.id),
          );
          if (pushedCount > 0) {
            item.count -= pushedCount;
            if (item.count <= 0) {
              meta.inventory[i] = null;
            }
            this.chunks.setBlockMeta(targetPos.x, targetPos.y, targetPos.z, targetMeta, false);
            this.chunks.setBlockMeta(x, y, z, meta, false);
            return true;
          }
        }
      }
    }

    // 2. PULL: Try to pull an item into hopper
    // A: From container above
    const abovePos = new THREE.Vector3(x, y + 1, z);
    const aboveMeta = this.chunks.getBlockMeta(abovePos.x, abovePos.y, abovePos.z);
    if (aboveMeta && aboveMeta.containerType && aboveMeta.inventory) {
      const allowedSlots = this.getPullAllowedSlots(aboveMeta.containerType, aboveMeta.inventory.length);
      for (const slotIdx of allowedSlots) {
        if (slotIdx >= aboveMeta.inventory.length) continue;
        const item = aboveMeta.inventory[slotIdx];
        if (item && item.count > 0 && canHopperExtractSlot(aboveMeta.containerType, slotIdx, item)) {
          const addedCount = this.pushItem(meta.inventory, { ...item, count: 1 });
          if (addedCount > 0) {
            item.count -= addedCount;
            if (item.count <= 0) {
              aboveMeta.inventory[slotIdx] = null;
            }
            this.chunks.setBlockMeta(abovePos.x, abovePos.y, abovePos.z, aboveMeta, false);
            this.chunks.setBlockMeta(x, y, z, meta, false);
            return true;
          }
        }
      }
    }

    // B: From dropped items above hopper
    const pulledItem = this.pullFromDroppedItems(x, y, z, meta.inventory);
    if (pulledItem) {
      this.chunks.setBlockMeta(x, y, z, meta, false);
      return true;
    }

    return false;
  }

  private getFacingPosition(x: number, y: number, z: number, facing: BlockFacing): THREE.Vector3 {
    switch (facing) {
      case 'down': return new THREE.Vector3(x, y - 1, z);
      case 'north': return new THREE.Vector3(x, y, z - 1);
      case 'south': return new THREE.Vector3(x, y, z + 1);
      case 'east': return new THREE.Vector3(x + 1, y, z);
      case 'west': return new THREE.Vector3(x - 1, y, z);
      default: return new THREE.Vector3(x, y - 1, z);
    }
  }

  private getPushAllowedSlots(facing: BlockFacing, containerType: string, item: ItemStack): number[] | undefined {
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
    const maxStack = ItemRegistry.getMaxStackSize(stack.id);
    let remaining = stack.count;
    const slotsToSearch = allowedSlots ?? Array.from({ length: inventory.length }, (_, i) => i);

    for (const idx of slotsToSearch) {
      if (idx >= inventory.length) continue;
      const slot = inventory[idx];
      const maxForSlot = Math.min(maxStack, slotLimit?.(idx) ?? maxStack);
      if (slot && itemStacksCanMerge(slot, stack) && slot.count < maxForSlot) {
        const addCount = Math.min(remaining, maxForSlot - slot.count);
        slot.count += addCount;
        remaining -= addCount;
        if (remaining <= 0) return stack.count;
      }
    }

    for (const idx of slotsToSearch) {
      if (idx >= inventory.length) continue;
      const slot = inventory[idx];
      if (!slot) {
        const maxForSlot = Math.min(maxStack, slotLimit?.(idx) ?? maxStack);
        const addCount = Math.min(remaining, maxForSlot);
        const placed = cloneItemStack(stack)!;
        placed.count = addCount;
        inventory[idx] = placed;
        remaining -= addCount;
        if (remaining <= 0) return stack.count;
      }
    }

    return stack.count - remaining;
  }

  private pullFromDroppedItems(hx: number, hy: number, hz: number, hopperInventory: (ItemStack | null)[]): boolean {
    for (const [id, item] of this.droppedItems.items) {
      const px = item.position.x;
      const py = item.position.y;
      const pz = item.position.z;

      if (
        px >= hx - 0.2 && px <= hx + 1.2 &&
        py >= hy + 0.8 && py <= hy + 1.8 &&
        pz >= hz - 0.2 && pz <= hz + 1.2
      ) {
        // Hopper suction is independent from the player's pickupDelay and can
        // absorb as much of one item entity stack as its five slots can accept.
        const addedCount = this.pushItem(hopperInventory, { id: item.itemId, count: item.count });
        if (addedCount > 0) {
          item.count -= addedCount;
          if (item.count <= 0) {
            this.droppedItems.removeItem(id);
          }
          return true;
        }
      }
    }
    return false;
  }
}
