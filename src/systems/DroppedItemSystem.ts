import * as THREE from 'three';
import { DroppedItem } from '../entities/DroppedItem';
import { Inventory } from '../player/Inventory';
import type { ItemStack } from '../types';
import {
  ITEM_ENTITY_DEFAULT_PICKUP_DELAY_SECONDS,
  ITEM_ENTITY_DESPAWN_SECONDS,
  ITEM_ENTITY_MERGE_INTERVAL_SECONDS,
  canItemEntityPositionsMerge,
  insertItemStackIntoSlots,
  isWithinItemPickupBounds,
  mergeItemEntityStacks,
} from '../items/ItemEntityRules';

export class DroppedItemSystem {
  items: Map<number, DroppedItem> = new Map();
  private scene: THREE.Scene;
  private createHeldItemMesh: (itemId: number) => THREE.Object3D | null;
  private mergeTimer = 0;

  constructor(
    scene: THREE.Scene,
    createHeldItemMesh: (itemId: number) => THREE.Object3D | null
  ) {
    this.scene = scene;
    this.createHeldItemMesh = createHeldItemMesh;
  }

  spawnStack(
    stack: ItemStack,
    position: THREE.Vector3,
    velocity?: THREE.Vector3,
    pickupDelay = ITEM_ENTITY_DEFAULT_PICKUP_DELAY_SECONDS,
  ): DroppedItem {
    const item = new DroppedItem(
      stack.id,
      stack.count,
      position.x,
      position.y,
      position.z,
      velocity,
      pickupDelay,
      this.createHeldItemMesh,
      stack,
    );
    this.items.set(item.id, item);
    item.mesh.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    this.scene.add(item.mesh);
    return item;
  }

  spawnItem(
    itemId: number,
    count: number,
    position: THREE.Vector3,
    velocity?: THREE.Vector3,
    pickupDelay = ITEM_ENTITY_DEFAULT_PICKUP_DELAY_SECONDS
  ): DroppedItem {
    return this.spawnStack({ id: itemId, count }, position, velocity, pickupDelay);
  }

  update(
    dt: number,
    playerPos: THREE.Vector3,
    isSolidBlock: (x: number, y: number, z: number) => boolean,
    inventory: Inventory,
    playPickupSound: () => void,
    onInventoryChange: () => void,
    allowLocalInteractions = true,
  ) {
    for (const [id, item] of this.items) {
      item.update(dt, isSolidBlock);

      if (item.age >= ITEM_ENTITY_DESPAWN_SECONDS) {
        this.removeItem(id);
        continue;
      }

      if (
        allowLocalInteractions
        && item.pickupDelay <= 0
        && isWithinItemPickupBounds(item.position, playerPos)
      ) {
        const result = insertItemStackIntoSlots(inventory.slots, item.stack);
        if (result.inserted > 0) {
          playPickupSound();
          onInventoryChange();

          if (!result.remaining) {
            this.removeItem(id);
          } else {
            item.setStack(result.remaining);
          }
        }
      }
    }

    // Multiplayer clients render server-owned item entities but must not merge
    // or pick them up locally. The authoritative server sends stack/despawn updates.
    if (!allowLocalInteractions) {
      this.mergeTimer = 0;
      return;
    }

    this.mergeTimer += dt;
    if (this.mergeTimer >= ITEM_ENTITY_MERGE_INTERVAL_SECONDS) {
      this.mergeTimer -= ITEM_ENTITY_MERGE_INTERVAL_SECONDS;
      this.mergeItems();
    }
  }

  /** Compatibility seam for existing parity probes; shared behavior lives in ItemEntityRules. */
  private isWithinVanillaPickupBounds(itemPos: THREE.Vector3, playerPos: THREE.Vector3): boolean {
    return isWithinItemPickupBounds(itemPos, playerPos);
  }

  private mergeItems() {
    const list = Array.from(this.items.values());
    for (let i = 0; i < list.length; i++) {
      const receiver = list[i];
      if (!this.items.has(receiver.id)) continue;

      for (let j = i + 1; j < list.length; j++) {
        const donor = list[j];
        if (!this.items.has(donor.id)) continue;
        if (!canItemEntityPositionsMerge(receiver.position, donor.position)) continue;

        const transferred = mergeItemEntityStacks(receiver.stack, donor.stack);
        if (transferred <= 0) continue;
        receiver.pickupDelay = Math.max(receiver.pickupDelay, donor.pickupDelay);
        receiver.age = Math.min(receiver.age, donor.age);

        if (donor.count <= 0) this.removeItem(donor.id);
      }
    }
  }

  removeItem(id: number) {
    const item = this.items.get(id);
    if (item) {
      this.scene.remove(item.mesh);
      item.dispose();
      this.items.delete(id);
    }
  }

  dispose() {
    for (const item of this.items.values()) {
      this.scene.remove(item.mesh);
      item.dispose();
    }
    this.items.clear();
  }
}
