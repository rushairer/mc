import * as THREE from 'three';
import { DroppedItem } from '../entities/DroppedItem';
import { Inventory } from '../player/Inventory';
import { ItemRegistry } from '../items/ItemRegistry';

const PLAYER_HALF_WIDTH = 0.3;
const PLAYER_HEIGHT = 1.8;
const PICKUP_EXPAND_XZ = 1.0;
const PICKUP_EXPAND_Y = 0.5;
const MERGE_RADIUS = 0.5;

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
    pickupDelay = 0.5
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
    item.mesh.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
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
    for (const [id, item] of this.items) {
      item.update(dt, isSolidBlock);

      if (item.age >= 300) {
        this.removeItem(id);
        continue;
      }

      if (item.pickupDelay <= 0 && this.isWithinVanillaPickupBounds(item.position, playerPos)) {
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

    // Vanilla item entities periodically look for nearby compatible stacks.
    this.mergeTimer += dt;
    if (this.mergeTimer >= 0.5) {
      this.mergeTimer -= 0.5;
      this.mergeItems();
    }
  }

  private isWithinVanillaPickupBounds(itemPos: THREE.Vector3, playerPos: THREE.Vector3): boolean {
    const dx = Math.abs(itemPos.x - playerPos.x);
    const dy = itemPos.y - playerPos.y;
    const dz = Math.abs(itemPos.z - playerPos.z);

    return dx <= PLAYER_HALF_WIDTH + PICKUP_EXPAND_XZ
      && dz <= PLAYER_HALF_WIDTH + PICKUP_EXPAND_XZ
      && dy >= -PICKUP_EXPAND_Y
      && dy <= PLAYER_HEIGHT + PICKUP_EXPAND_Y;
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

        const closeEnough = Math.abs(a.position.x - b.position.x) <= MERGE_RADIUS
          && Math.abs(a.position.y - b.position.y) <= MERGE_RADIUS
          && Math.abs(a.position.z - b.position.z) <= MERGE_RADIUS;
        if (!closeEnough) continue;

        const transfer = Math.min(b.count, maxStack - a.count);
        a.count += transfer;
        b.count -= transfer;
        a.pickupDelay = Math.max(a.pickupDelay, b.pickupDelay);
        a.age = Math.min(a.age, b.age);

        if (b.count <= 0) {
          this.removeItem(b.id);
        }
        if (a.count >= maxStack) break;
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
