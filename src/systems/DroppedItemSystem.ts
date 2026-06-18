import * as THREE from 'three';
import { DroppedItem } from '../entities/DroppedItem';
import { Inventory } from '../player/Inventory';
import { ItemRegistry } from '../items/ItemRegistry';

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

  spawnItem(
    itemId: number,
    count: number,
    position: THREE.Vector3,
    velocity?: THREE.Vector3,
    pickupDelay = 1.0
  ): DroppedItem {
    const item = new DroppedItem(
      itemId,
      count,
      position.x,
      position.y,
      position.z,
      velocity,
      pickupDelay,
      this.createHeldItemMesh
    );
    this.items.set(item.id, item);
    this.scene.add(item.mesh);
    return item;
  }

  update(
    dt: number,
    playerPos: THREE.Vector3,
    isSolidBlock: (x: number, y: number, z: number) => boolean,
    inventory: Inventory,
    playPickupSound: () => void,
    onInventoryChange: () => void
  ) {
    // 1. Update each item
    for (const [id, item] of this.items) {
      item.update(dt, isSolidBlock);

      // Despawn item if age exceeds 300s (5 minutes)
      if (item.age >= 300) {
        this.removeItem(id);
        continue;
      }

      // 2. Pickup check & Magnet effect
      if (item.pickupDelay <= 0) {
        // Distance to player feet/center (player is at playerPos)
        // Adjust for player height: player position is at feet
        const dist = item.position.distanceTo(playerPos);
        if (dist < 2.5) {
          // Magnet effect: pull towards player center/torso
          const targetPos = playerPos.clone().add(new THREE.Vector3(0, 0.8, 0));
          const pullDir = new THREE.Vector3().subVectors(targetPos, item.position).normalize();
          // The closer it is, the faster it is pulled
          const pullDist = item.position.distanceTo(targetPos);
          const speed = Math.max(3.0, (2.5 - pullDist) * 8.0);
          item.position.addScaledVector(pullDir, speed * dt);
          item.mesh.position.copy(item.position);

          // Touch distance for pickup
          if (pullDist < 0.75) {
            const remaining = inventory.addItem(item.itemId, item.count);
            if (remaining !== item.count) {
              playPickupSound();
              onInventoryChange();
              
              if (remaining <= 0) {
                this.removeItem(id);
              } else {
                item.count = remaining;
              }
            }
          }
        }
      }
    }

    // 3. Merging logic: run every 0.5 seconds to conserve CPU
    this.mergeTimer += dt;
    if (this.mergeTimer >= 0.5) {
      this.mergeTimer = 0;
      this.mergeItems();
    }
  }

  private mergeItems() {
    const list = Array.from(this.items.values());
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (!this.items.has(a.id)) continue;
      const maxStack = ItemRegistry.getMaxStackSize(a.itemId);
      if (a.count >= maxStack) continue;

      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (!this.items.has(b.id)) continue;
        if (a.itemId !== b.itemId) continue;
        if (b.count >= maxStack) continue;

        const dist = a.position.distanceTo(b.position);
        if (dist < 1.2) {
          // Merge b into a
          const transfer = Math.min(b.count, maxStack - a.count);
          a.count += transfer;
          b.count -= transfer;

          if (b.count <= 0) {
            this.removeItem(b.id);
          }
          if (a.count >= maxStack) break;
        }
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
