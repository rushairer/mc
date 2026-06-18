import * as THREE from 'three';
import { CHUNK_SIZE, WORLD_HEIGHT } from '../constants';
import { ChunkManager } from '../world/ChunkManager';
import { DroppedItemSystem } from './DroppedItemSystem';
import { BlockRegistry } from '../world/BlockRegistry';
import { ItemRegistry } from '../items/ItemRegistry';
import type { ItemStack, BlockFacing, BlockMetadata } from '../types';

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

        // Dec cooldown
        let cooldown = metadata.transferCooldown ?? 0;
        if (cooldown > 0) {
          metadata.transferCooldown = cooldown - dt;
          continue;
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
          metadata.transferCooldown = 0.4; // 8 game ticks (0.4 seconds)
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
          const allowedSlots = this.getPushAllowedSlots(facing, targetMeta.containerType, item.id);
          const pushedCount = this.pushItem(targetMeta.inventory, { ...item, count: 1 }, allowedSlots);
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
      const allowedSlots = this.getPullAllowedSlots(aboveMeta.containerType);
      for (const slotIdx of allowedSlots) {
        if (slotIdx >= aboveMeta.inventory.length) continue;
        const item = aboveMeta.inventory[slotIdx];
        if (item && item.count > 0) {
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

  private getPushAllowedSlots(facing: BlockFacing, containerType: string, itemId: number): number[] | undefined {
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
    const maxStack = ItemRegistry.getMaxStackSize(stack.id);
    let remaining = stack.count;
    const slotsToSearch = allowedSlots ?? Array.from({ length: inventory.length }, (_, i) => i);

    for (const idx of slotsToSearch) {
      if (idx >= inventory.length) continue;
      const slot = inventory[idx];
      if (slot && slot.id === stack.id && slot.count < maxStack) {
        const addCount = Math.min(remaining, maxStack - slot.count);
        slot.count += addCount;
        remaining -= addCount;
        if (remaining <= 0) return stack.count;
      }
    }

    for (const idx of slotsToSearch) {
      if (idx >= inventory.length) continue;
      const slot = inventory[idx];
      if (!slot) {
        const addCount = Math.min(remaining, maxStack);
        inventory[idx] = { ...stack, count: addCount };
        remaining -= addCount;
        if (remaining <= 0) return stack.count;
      }
    }

    return stack.count - remaining;
  }

  private pullFromDroppedItems(hx: number, hy: number, hz: number, hopperInventory: (ItemStack | null)[]): boolean {
    for (const [id, item] of this.droppedItems.items) {
      if (item.pickupDelay > 0) continue;

      const px = item.position.x;
      const py = item.position.y;
      const pz = item.position.z;

      if (
        px >= hx - 0.2 && px <= hx + 1.2 &&
        py >= hy + 0.8 && py <= hy + 1.8 &&
        pz >= hz - 0.2 && pz <= hz + 1.2
      ) {
        const addedCount = this.pushItem(hopperInventory, { id: item.itemId, count: 1 });
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
