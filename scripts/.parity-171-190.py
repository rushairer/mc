from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, content: str) -> None:
    Path(path).write_text(content)


def replace_once(path: str, old: str, new: str) -> None:
    source = read(path)
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one patch target in {path}, found {count}: {old[:120]!r}")
    write(path, source.replace(old, new, 1))


def replace_count(path: str, old: str, new: str, expected: int) -> None:
    source = read(path)
    count = source.count(old)
    if count != expected:
        raise RuntimeError(f"Expected {expected} patch targets in {path}, found {count}: {old[:120]!r}")
    write(path, source.replace(old, new))


def replace_between(path: str, start: str, end: str, replacement: str) -> None:
    source = read(path)
    start_index = source.find(start)
    if start_index < 0:
        raise RuntimeError(f"Missing start marker in {path}: {start!r}")
    end_index = source.find(end, start_index)
    if end_index < 0:
        raise RuntimeError(f"Missing end marker in {path}: {end!r}")
    write(path, source[:start_index] + replacement + source[end_index:])


item_entity_rules = r'''import { ItemRegistry } from './ItemRegistry';
import { cloneItemStack, itemStacksCanMerge } from './ItemStackRules';
import type { ItemStack } from '../types';

export const ITEM_ENTITY_DESPAWN_SECONDS = 300;
export const ITEM_ENTITY_DEFAULT_PICKUP_DELAY_SECONDS = 0.5;
export const ITEM_ENTITY_MERGE_INTERVAL_SECONDS = 0.5;

const PLAYER_HALF_WIDTH = 0.3;
const PLAYER_HEIGHT = 1.8;
const PICKUP_EXPAND_XZ = 1.0;
const PICKUP_EXPAND_Y = 0.5;
const ITEM_ENTITY_WIDTH = 0.25;
const ITEM_ENTITY_HEIGHT = 0.25;
const MERGE_EXPAND_XZ = 0.5;

export interface PositionLike {
  x: number;
  y: number;
  z: number;
}

export interface InsertItemStackResult {
  inserted: number;
  remaining: ItemStack | null;
}

/** Java playerTouch uses the player's collision box inflated by 1.0 X/Z and 0.5 Y. */
export function isWithinItemPickupBounds(item: PositionLike, playerBase: PositionLike): boolean {
  const dx = Math.abs(item.x - playerBase.x);
  const dy = item.y - playerBase.y;
  const dz = Math.abs(item.z - playerBase.z);
  return dx <= PLAYER_HALF_WIDTH + PICKUP_EXPAND_XZ
    && dz <= PLAYER_HALF_WIDTH + PICKUP_EXPAND_XZ
    && dy >= -PICKUP_EXPAND_Y
    && dy <= PLAYER_HEIGHT + PICKUP_EXPAND_Y;
}

/** ItemEntity merge search inflates its 0.25-wide AABB by 0.5 only in X/Z. */
export function canItemEntityPositionsMerge(a: PositionLike, b: PositionLike): boolean {
  return Math.abs(a.x - b.x) <= ITEM_ENTITY_WIDTH + MERGE_EXPAND_XZ
    && Math.abs(a.y - b.y) <= ITEM_ENTITY_HEIGHT
    && Math.abs(a.z - b.z) <= ITEM_ENTITY_WIDTH + MERGE_EXPAND_XZ;
}

/**
 * Insert a complete modeled ItemStack into ordinary player inventory slots.
 * Existing slots merge only when all stack components match. The incoming stack
 * is never mutated; a deep-cloned remainder is returned when capacity is partial.
 */
export function insertItemStackIntoSlots(
  slots: (ItemStack | null)[],
  incoming: ItemStack,
): InsertItemStackResult {
  const working = cloneItemStack(incoming);
  if (!working || working.count <= 0) return { inserted: 0, remaining: null };

  const requested = working.count;
  const maxStack = ItemRegistry.getMaxStackSize(working.id);

  for (let i = 0; i < slots.length && working.count > 0; i++) {
    const slot = slots[i];
    if (!slot || !itemStacksCanMerge(slot, working) || slot.count >= maxStack) continue;
    const moved = Math.min(working.count, maxStack - slot.count);
    slot.count += moved;
    working.count -= moved;
  }

  for (let i = 0; i < slots.length && working.count > 0; i++) {
    if (slots[i]) continue;
    const moved = Math.min(working.count, maxStack);
    const placed = cloneItemStack(working)!;
    placed.count = moved;
    slots[i] = placed;
    working.count -= moved;
  }

  return {
    inserted: requested - working.count,
    remaining: working.count > 0 ? working : null,
  };
}

/** Transfer as much as possible from donor into receiver without changing stack identity. */
export function mergeItemEntityStacks(receiver: ItemStack, donor: ItemStack): number {
  if (!itemStacksCanMerge(receiver, donor)) return 0;
  const maxStack = ItemRegistry.getMaxStackSize(receiver.id);
  if (receiver.count >= maxStack || donor.count <= 0) return 0;
  const moved = Math.min(donor.count, maxStack - receiver.count);
  receiver.count += moved;
  donor.count -= moved;
  return moved;
}
'''
write('src/items/ItemEntityRules.ts', item_entity_rules)


dropped_item = r'''import * as THREE from 'three';
import type { ItemStack } from '../types';
import { cloneItemStack } from '../items/ItemStackRules';
import { ITEM_ENTITY_DEFAULT_PICKUP_DELAY_SECONDS } from '../items/ItemEntityRules';

const TICKS_PER_SECOND = 20;
const AIR_DRAG_PER_TICK = 0.98;
const GROUND_DRAG_PER_TICK = 0.588;

export class DroppedItem {
  static nextId = 1;
  id: number;
  stack: ItemStack;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  mesh: THREE.Object3D;
  age = 0;
  pickupDelay: number;
  onGround = false;

  get itemId(): number {
    return this.stack.id;
  }

  get count(): number {
    return this.stack.count;
  }

  set count(value: number) {
    this.stack.count = value;
  }

  constructor(
    itemId: number,
    count: number,
    x: number,
    y: number,
    z: number,
    velocity: THREE.Vector3 = new THREE.Vector3(0, 0, 0),
    pickupDelay = ITEM_ENTITY_DEFAULT_PICKUP_DELAY_SECONDS,
    createMesh: (itemId: number) => THREE.Object3D | null,
    stack?: ItemStack,
  ) {
    this.id = DroppedItem.nextId++;
    this.stack = cloneItemStack(stack ?? { id: itemId, count })!;
    this.position = new THREE.Vector3(x, y, z);
    this.velocity = velocity.clone();
    this.pickupDelay = pickupDelay;

    this.mesh = new THREE.Group();

    const innerMesh = createMesh(this.stack.id);
    if (innerMesh) {
      innerMesh.scale.set(0.4, 0.4, 0.4);
      innerMesh.position.set(0, 0.1, 0);
      this.mesh.add(innerMesh);
    } else {
      const geo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
      const mat = new THREE.MeshLambertMaterial({ color: 0x888888 });
      const placeholder = new THREE.Mesh(geo, mat);
      placeholder.position.set(0, 0.1, 0);
      this.mesh.add(placeholder);
    }

    this.mesh.position.copy(this.position);
  }

  setStack(stack: ItemStack) {
    this.stack = cloneItemStack(stack)!;
  }

  update(
    dt: number,
    isSolidBlock: (x: number, y: number, z: number) => boolean
  ) {
    this.age += dt;
    if (this.pickupDelay > 0) {
      this.pickupDelay = Math.max(0, this.pickupDelay - dt);
    }

    if (!this.onGround) {
      // Vanilla item gravity is 0.04 blocks/tick^2 = 16 blocks/s^2.
      this.velocity.y -= 16 * dt;
    }

    // Vanilla drag is tick-based. Exponentiating by elapsed ticks keeps the
    // simulation stable across 30/60/120 FPS instead of applying drag per frame.
    const dragPerTick = this.onGround ? GROUND_DRAG_PER_TICK : AIR_DRAG_PER_TICK;
    const drag = Math.pow(dragPerTick, dt * TICKS_PER_SECOND);
    this.velocity.x *= drag;
    this.velocity.z *= drag;

    const prevY = this.position.y;
    this.onGround = false;

    this.position.x += this.velocity.x * dt;
    if (this.checkCollision(this.position.x, this.position.y, this.position.z, isSolidBlock)) {
      this.position.x -= this.velocity.x * dt;
      this.velocity.x = 0;
    }

    this.position.y += this.velocity.y * dt;
    if (this.checkCollision(this.position.x, this.position.y, this.position.z, isSolidBlock)) {
      if (this.velocity.y < 0) {
        this.position.y = Math.floor(prevY) + 0.001;
        this.onGround = true;
      } else {
        this.position.y = prevY;
      }
      this.velocity.y = 0;
    }

    this.position.z += this.velocity.z * dt;
    if (this.checkCollision(this.position.x, this.position.y, this.position.z, isSolidBlock)) {
      this.position.z -= this.velocity.z * dt;
      this.velocity.z = 0;
    }

    if (this.position.y < 0) {
      this.position.y = 0;
      this.velocity.y = 0;
      this.onGround = true;
    }

    const floatOffset = Math.sin(this.age * 3.5) * 0.04;
    this.mesh.position.copy(this.position);
    this.mesh.position.y += floatOffset;

    this.mesh.rotation.y += 1.5 * dt;
  }

  private checkCollision(
    x: number,
    y: number,
    z: number,
    isSolidBlock: (x: number, y: number, z: number) => boolean
  ): boolean {
    const radius = 0.15;
    const height = 0.25;
    const points = [
      new THREE.Vector3(x, y, z),
      new THREE.Vector3(x - radius, y, z - radius),
      new THREE.Vector3(x + radius, y, z - radius),
      new THREE.Vector3(x - radius, y, z + radius),
      new THREE.Vector3(x + radius, y, z + radius),
      new THREE.Vector3(x, y + height, z),
      new THREE.Vector3(x - radius, y + height, z - radius),
      new THREE.Vector3(x + radius, y + height, z - radius),
      new THREE.Vector3(x - radius, y + height, z + radius),
      new THREE.Vector3(x + radius, y + height, z + radius),
    ];

    for (const pt of points) {
      if (isSolidBlock(Math.floor(pt.x), Math.floor(pt.y), Math.floor(pt.z))) {
        return true;
      }
    }
    return false;
  }

  dispose() {
    this.mesh.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
  }
}
'''
write('src/entities/DroppedItem.ts', dropped_item)


dropped_item_system = r'''import * as THREE from 'three';
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
'''
write('src/systems/DroppedItemSystem.ts', dropped_item_system)

# Hopper suction must carry the entire stack identity into the destination.
replace_once(
    'src/systems/HopperSystem.ts',
    "        const addedCount = this.pushItem(hopperInventory, { id: item.itemId, count: item.count });",
    "        const droppedStack = item.stack ?? { id: item.itemId, count: item.count };\n        const addedCount = this.pushItem(hopperInventory, droppedStack);",
)

# Add a stack-update packet so partial pickup/merge count changes stay authoritative.
replace_once(
    'src/server/NetworkProtocol.ts',
    "  S2C_DROPPED_ITEM_MOVE = 'S2C_DROPPED_ITEM_MOVE',\n  S2C_DROPPED_ITEM_DESPAWN = 'S2C_DROPPED_ITEM_DESPAWN',",
    "  S2C_DROPPED_ITEM_MOVE = 'S2C_DROPPED_ITEM_MOVE',\n  S2C_DROPPED_ITEM_UPDATE = 'S2C_DROPPED_ITEM_UPDATE',\n  S2C_DROPPED_ITEM_DESPAWN = 'S2C_DROPPED_ITEM_DESPAWN',",
)

# Network client: spawn and reconcile full stacks instead of reducing them to id/count.
old_spawn = r'''      case PacketType.S2C_DROPPED_ITEM_SPAWN: {
        const { id, itemId, count, x, y, z } = packet.payload;
        this.game.droppedItems.spawnItem(itemId, count, new THREE.Vector3(x, y, z), new THREE.Vector3(0, 0, 0));
        // Find newest spawned item in DroppedItemSystem and sync its server ID
        const list = Array.from(this.game.droppedItems.items.values());
        if (list.length > 0) {
          const newest = list[list.length - 1] as any;
          this.game.droppedItems.items.delete(newest.id);
          newest.id = id;
          this.game.droppedItems.items.set(id, newest);
        }
        break;
      }
'''
new_spawn = r'''      case PacketType.S2C_DROPPED_ITEM_SPAWN: {
        const { id, stack, itemId, count, x, y, z, pickupDelay, age } = packet.payload;
        const authoritativeStack = stack ?? { id: itemId, count };
        const spawned = this.game.droppedItems.spawnStack(
          authoritativeStack,
          new THREE.Vector3(x, y, z),
          new THREE.Vector3(0, 0, 0),
          Number.isFinite(pickupDelay) ? pickupDelay : 0.5,
        );
        this.game.droppedItems.items.delete(spawned.id);
        spawned.id = id;
        if (Number.isFinite(age)) spawned.age = age;
        this.game.droppedItems.items.set(id, spawned);
        break;
      }

      case PacketType.S2C_DROPPED_ITEM_UPDATE: {
        const { id, stack, itemId, count, pickupDelay, age } = packet.payload;
        const item = this.game.droppedItems.items.get(id);
        if (item) {
          item.setStack(stack ?? { id: itemId ?? item.itemId, count: count ?? item.count });
          if (Number.isFinite(pickupDelay)) item.pickupDelay = pickupDelay;
          if (Number.isFinite(age)) item.age = age;
        }
        break;
      }
'''
replace_once('src/server/NetworkClient.ts', old_spawn, new_spawn)

# Multiplayer renders server-owned item entities but never locally picks up or merges them.
old_game_update = r'''      // Update dropped items
      this.droppedItems.update(
        dt,
        this.player.position,
        (x, y, z) => this.chunks.isSolidBlock(x, y, z),
        this.inventory,
        () => this.sound.playPickup(),
        () => this.notifyState()
      );
'''
new_game_update = r'''      // Update dropped items. Multiplayer item pickup/merge is server authoritative.
      this.droppedItems.update(
        dt,
        this.player.position,
        (x, y, z) => this.chunks.isSolidBlock(x, y, z),
        this.inventory,
        () => this.sound.playPickup(),
        () => this.notifyState(),
        !this.isMultiplayerNetworkConnected(),
      );
'''
replace_once('src/engine/Game.ts', old_game_update, new_game_update)

# GameServer imports shared ItemEntity and stack ownership rules.
replace_once(
    'src/server/GameServer.ts',
    "import { ItemRegistry } from '../items/ItemRegistry';",
    "import { ItemRegistry } from '../items/ItemRegistry';\nimport { cloneItemStack } from '../items/ItemStackRules';\nimport {\n  ITEM_ENTITY_DEFAULT_PICKUP_DELAY_SECONDS,\n  ITEM_ENTITY_DESPAWN_SECONDS,\n  ITEM_ENTITY_MERGE_INTERVAL_SECONDS,\n  canItemEntityPositionsMerge,\n  insertItemStackIntoSlots,\n  isWithinItemPickupBounds,\n  mergeItemEntityStacks,\n} from '../items/ItemEntityRules';",
)

old_server_item = r'''interface ServerDroppedItem {
  id: number;
  itemId: number;
  count: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  age: number;
  dimension: number;
}
'''
new_server_item = r'''interface ServerDroppedItem {
  id: number;
  stack: ItemStack;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  age: number;
  pickupDelay: number;
  dimension: number;
}
'''
replace_once('src/server/GameServer.ts', old_server_item, new_server_item)
replace_once(
    'src/server/GameServer.ts',
    "  private droppedItems: Map<number, ServerDroppedItem> = new Map();\n  private projectiles: Map<number, ServerProjectile> = new Map();",
    "  private droppedItems: Map<number, ServerDroppedItem> = new Map();\n  private droppedItemMergeTimer = 0;\n  private projectiles: Map<number, ServerProjectile> = new Map();",
)

old_initial_items = r'''    // Send active dropped items
    for (const item of this.droppedItems.values()) {
      if (item.dimension === session.dimension) {
        this.sendTo(session, PacketType.S2C_DROPPED_ITEM_SPAWN, {
          id: item.id,
          itemId: item.itemId,
          count: item.count,
          x: item.position.x,
          y: item.position.y,
          z: item.position.z
        });
      }
    }
'''
new_initial_items = r'''    // Send active dropped items with their complete stack identity.
    for (const item of this.droppedItems.values()) {
      if (item.dimension === session.dimension) {
        this.sendTo(session, PacketType.S2C_DROPPED_ITEM_SPAWN, {
          id: item.id,
          stack: cloneItemStack(item.stack),
          itemId: item.stack.id,
          count: item.stack.count,
          x: item.position.x,
          y: item.position.y,
          z: item.position.z,
          pickupDelay: item.pickupDelay,
          age: item.age,
          dimension: item.dimension,
        });
      }
    }
'''
replace_once('src/server/GameServer.ts', old_initial_items, new_initial_items)

# A cursor that cannot return to inventory must retain its full metadata when dropped.
replace_once(
    'src/server/GameServer.ts',
    "      this.spawnDroppedItem(next.cursor.id, next.cursor.count, player.x, player.y + 0.5, player.z, player.dimension);",
    "      this.spawnDroppedStack(next.cursor, player.x, player.y + 0.5, player.z, player.dimension);",
)

# Death drops for inventory, armor and offhand must retain full stack components.
replace_count(
    'src/server/GameServer.ts',
    "          this.spawnDroppedItem(stack.id, stack.count, player.x, player.y, player.z, player.dimension);",
    "          this.spawnDroppedStack(stack, player.x, player.y, player.z, player.dimension);",
    2,
)
replace_once(
    'src/server/GameServer.ts',
    "        this.spawnDroppedItem(player.offhand.id, player.offhand.count, player.x, player.y, player.z, player.dimension);",
    "        this.spawnDroppedStack(player.offhand, player.x, player.y, player.z, player.dimension);",
)

# Replace server item spawning with a full-stack canonical path while keeping legacy id/count callers.
server_spawn = r'''  spawnDroppedStack(
    stack: ItemStack,
    x: number,
    y: number,
    z: number,
    dimension: number,
    pickupDelay = ITEM_ENTITY_DEFAULT_PICKUP_DELAY_SECONDS,
  ): ServerDroppedItem {
    const ownedStack = cloneItemStack(stack)!;
    const maxStack = ItemRegistry.getMaxStackSize(ownedStack.id);
    ownedStack.count = Math.max(1, Math.min(maxStack, Math.floor(ownedStack.count)));

    const id = this.nextEntityId++;
    const item: ServerDroppedItem = {
      id,
      stack: ownedStack,
      position: new THREE.Vector3(x, y, z),
      velocity: new THREE.Vector3((Math.random() - 0.5) * 2, 3, (Math.random() - 0.5) * 2),
      age: 0,
      pickupDelay: Math.max(0, pickupDelay),
      dimension,
    };

    this.droppedItems.set(id, item);
    this.broadcastDimension(dimension, PacketType.S2C_DROPPED_ITEM_SPAWN, {
      id,
      stack: cloneItemStack(item.stack),
      itemId: item.stack.id,
      count: item.stack.count,
      x, y, z,
      pickupDelay: item.pickupDelay,
      age: item.age,
      dimension,
    });
    return item;
  }

  spawnDroppedItem(
    itemId: number,
    count: number,
    x: number,
    y: number,
    z: number,
    dimension: number,
    pickupDelay = ITEM_ENTITY_DEFAULT_PICKUP_DELAY_SECONDS,
  ): ServerDroppedItem {
    return this.spawnDroppedStack({ id: itemId, count }, x, y, z, dimension, pickupDelay);
  }
'''
replace_between(
    'src/server/GameServer.ts',
    '  spawnDroppedItem(itemId: number, count: number, x: number, y: number, z: number, dimension: number): ServerDroppedItem {',
    '\n\n  // --- Main Tick (20Hz) ---',
    server_spawn,
)

# Replace the server item tick with authoritative delay, partial pickup, stack merge and dimension-scoped sync.
server_tick_items = r'''  private broadcastDroppedItemUpdate(item: ServerDroppedItem) {
    this.broadcastDimension(item.dimension, PacketType.S2C_DROPPED_ITEM_UPDATE, {
      id: item.id,
      stack: cloneItemStack(item.stack),
      itemId: item.stack.id,
      count: item.stack.count,
      pickupDelay: item.pickupDelay,
      age: item.age,
    });
  }

  private despawnDroppedItem(item: ServerDroppedItem) {
    this.droppedItems.delete(item.id);
    this.broadcastDimension(item.dimension, PacketType.S2C_DROPPED_ITEM_DESPAWN, { id: item.id });
  }

  private mergeServerDroppedItems() {
    const list = Array.from(this.droppedItems.values());
    for (let i = 0; i < list.length; i++) {
      const receiver = list[i];
      if (!this.droppedItems.has(receiver.id)) continue;

      for (let j = i + 1; j < list.length; j++) {
        const donor = list[j];
        if (!this.droppedItems.has(donor.id) || donor.dimension !== receiver.dimension) continue;
        if (!canItemEntityPositionsMerge(receiver.position, donor.position)) continue;

        const transferred = mergeItemEntityStacks(receiver.stack, donor.stack);
        if (transferred <= 0) continue;
        receiver.pickupDelay = Math.max(receiver.pickupDelay, donor.pickupDelay);
        receiver.age = Math.min(receiver.age, donor.age);
        this.broadcastDroppedItemUpdate(receiver);

        if (donor.stack.count <= 0) {
          this.despawnDroppedItem(donor);
        } else {
          this.broadcastDroppedItemUpdate(donor);
        }
      }
    }
  }

  private tickDroppedItems(dt: number) {
    for (const item of Array.from(this.droppedItems.values())) {
      item.age += dt;
      item.pickupDelay = Math.max(0, item.pickupDelay - dt);
      if (item.age >= ITEM_ENTITY_DESPAWN_SECONDS) {
        this.despawnDroppedItem(item);
        continue;
      }

      // Server-authoritative item physics. Keep the same Java gravity constant
      // used by the client presentation path.
      item.velocity.y -= 16 * dt;
      item.position.addScaledVector(item.velocity, dt);

      const ix = Math.floor(item.position.x);
      const iy = Math.floor(item.position.y);
      const iz = Math.floor(item.position.z);
      const isSolidBelow = this.isSolidBlock(ix, iy, iz, item.dimension);
      if (isSolidBelow) {
        item.position.y = iy + 1.05;
        item.velocity.set(0, 0, 0);
      }

      this.broadcastDimension(item.dimension, PacketType.S2C_DROPPED_ITEM_MOVE, {
        id: item.id,
        x: item.position.x,
        y: item.position.y,
        z: item.position.z,
      });

      if (item.pickupDelay > 0) continue;

      for (const player of this.players.values()) {
        if (player.dimension !== item.dimension) continue;
        if (!isWithinItemPickupBounds(item.position, { x: player.x, y: player.y, z: player.z })) continue;

        const result = insertItemStackIntoSlots(player.inventory, item.stack);
        if (result.inserted <= 0) continue;

        if (result.remaining) {
          item.stack = result.remaining;
          this.broadcastDroppedItemUpdate(item);
        } else {
          this.despawnDroppedItem(item);
        }

        this.broadcastDimension(item.dimension, PacketType.S2C_SOUND, {
          type: 'pickup', x: player.x, y: player.y, z: player.z,
        });
        this.syncPlayerInventory(player);
        break;
      }
    }

    this.droppedItemMergeTimer += dt;
    if (this.droppedItemMergeTimer >= ITEM_ENTITY_MERGE_INTERVAL_SECONDS) {
      this.droppedItemMergeTimer -= ITEM_ENTITY_MERGE_INTERVAL_SECONDS;
      this.mergeServerDroppedItems();
    }
  }
'''
replace_between(
    'src/server/GameServer.ts',
    '  private tickDroppedItems(dt: number) {',
    '\n\n  /** P5.1 — create a server-authoritative projectile and broadcast it. */',
    server_tick_items,
)


tests = r'''import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { DroppedItem } from '../src/entities/DroppedItem';
import { DroppedItemSystem } from '../src/systems/DroppedItemSystem';
import { HopperSystem } from '../src/systems/HopperSystem';
import { Inventory } from '../src/player/Inventory';
import { GameServer } from '../src/server/GameServer';
import { NetworkClient } from '../src/server/NetworkClient';
import { PacketType } from '../src/server/NetworkProtocol';
import {
  canItemEntityPositionsMerge,
  insertItemStackIntoSlots,
  isWithinItemPickupBounds,
  mergeItemEntityStacks,
} from '../src/items/ItemEntityRules';
import type { ItemStack } from '../src/types';

const noCollision = () => false;

function namedStack(count = 1): ItemStack {
  return {
    id: 1,
    count,
    customName: 'Parity Stone',
    enchantments: [{ id: 'unbreaking', level: 1 }],
  };
}

test('171-172: dropped entities own a deep-cloned full ItemStack while keeping id/count compatibility', () => {
  const source = namedStack(3);
  const item = new DroppedItem(1, 3, 0, 64, 0, new THREE.Vector3(), 0, () => null, source);
  source.customName = 'mutated';
  source.enchantments![0].level = 3;
  assert.equal(item.itemId, 1);
  assert.equal(item.count, 3);
  assert.equal(item.stack.customName, 'Parity Stone');
  assert.equal(item.stack.enchantments?.[0].level, 1);
  item.count = 2;
  assert.equal(item.stack.count, 2);
  item.dispose();
});

test('173-174: DroppedItemSystem spawnStack preserves components and legacy spawnItem still works', () => {
  const system = new DroppedItemSystem(new THREE.Scene(), () => null);
  const rich = system.spawnStack(namedStack(2), new THREE.Vector3(0, 64, 0), undefined, 0);
  const plain = system.spawnItem(2, 4, new THREE.Vector3(4, 64, 0), undefined, 0);
  assert.equal(rich.stack.customName, 'Parity Stone');
  assert.equal(rich.count, 2);
  assert.deepEqual(plain.stack, { id: 2, count: 4 });
  system.dispose();
});

test('175-176: local pickup preserves metadata and supports partial capacity', () => {
  const system = new DroppedItemSystem(new THREE.Scene(), () => null);
  const inventory = new Inventory();
  inventory.slots[0] = namedStack(63);
  for (let i = 1; i < inventory.slots.length; i++) inventory.slots[i] = { id: 2, count: 64 };
  const dropped = system.spawnStack(namedStack(2), new THREE.Vector3(0, 64, 0), undefined, 0);
  let changes = 0;
  system.update(0, new THREE.Vector3(0, 64, 0), noCollision, inventory, () => {}, () => changes++);
  assert.equal(inventory.slots[0]?.count, 64);
  assert.equal(inventory.slots[0]?.customName, 'Parity Stone');
  assert.equal(dropped.count, 1);
  assert.equal(dropped.stack.customName, 'Parity Stone');
  assert.equal(changes, 1);
  system.dispose();
});

test('177: dropped-item merging requires full stack identity, not just item id', () => {
  const system = new DroppedItemSystem(new THREE.Scene(), () => null) as any;
  const a = system.spawnStack(namedStack(1), new THREE.Vector3(0, 64, 0), undefined, 0);
  const different = namedStack(1);
  different.customName = 'Different Stone';
  system.spawnStack(different, new THREE.Vector3(0.2, 64, 0), undefined, 0);
  system.mergeItems();
  assert.equal(system.items.size, 2);
  assert.equal(a.count, 1);
  system.dispose();
});

test('178: hopper suction preserves dropped stack components', () => {
  const dropped = new DroppedItemSystem(new THREE.Scene(), () => null);
  dropped.spawnStack(namedStack(2), new THREE.Vector3(0.5, 65, 0.5), undefined, 10);
  const chunks: any = { chunks: new Map(), getBlockMeta: () => undefined, setBlockMeta: () => {} };
  const hopper = new HopperSystem(chunks, dropped, () => {}) as any;
  const inventory = new Array(5).fill(null);
  assert.equal(hopper.pullFromDroppedItems(0, 64, 0, inventory), true);
  assert.equal(inventory[0]?.count, 2);
  assert.equal(inventory[0]?.customName, 'Parity Stone');
  assert.equal(inventory[0]?.enchantments?.[0].id, 'unbreaking');
  dropped.dispose();
});

test('179-181: shared slot insertion is metadata-aware, max-stack-aware, and non-mutating', () => {
  const slots: (ItemStack | null)[] = [namedStack(63), { id: 2, count: 64 }];
  const incoming = namedStack(2);
  const result = insertItemStackIntoSlots(slots, incoming);
  assert.equal(result.inserted, 1);
  assert.equal(slots[0]?.count, 64);
  assert.equal(result.remaining?.count, 1);
  assert.equal(result.remaining?.customName, 'Parity Stone');
  assert.equal(incoming.count, 2);
});

test('182-183: pickup bounds use the expanded player AABB rather than a spherical magnet', () => {
  const player = { x: 0, y: 64, z: 0 };
  assert.equal(isWithinItemPickupBounds({ x: 1.29, y: 65, z: 0 }, player), true);
  assert.equal(isWithinItemPickupBounds({ x: 1.31, y: 65, z: 0 }, player), false);
  assert.equal(isWithinItemPickupBounds({ x: 0, y: 66.31, z: 0 }, player), false);
});

test('184: multiplayer clients do not locally pick up or merge server-owned item entities', () => {
  const system = new DroppedItemSystem(new THREE.Scene(), () => null);
  const inventory = new Inventory();
  system.spawnStack({ id: 1, count: 1 }, new THREE.Vector3(0, 64, 0), undefined, 0);
  system.spawnStack({ id: 1, count: 1 }, new THREE.Vector3(0.2, 64, 0), undefined, 0);
  system.update(0.5, new THREE.Vector3(0, 64, 0), noCollision, inventory, () => {}, () => {}, false);
  assert.equal(inventory.countItem(1), 0);
  assert.equal(system.items.size, 2);
  system.dispose();
});

test('185: item-entity merge geometry remains horizontal-only inflation', () => {
  assert.equal(canItemEntityPositionsMerge({ x: 0, y: 64, z: 0 }, { x: 0.7, y: 64, z: 0 }), true);
  assert.equal(canItemEntityPositionsMerge({ x: 0, y: 64, z: 0 }, { x: 0, y: 64.3, z: 0 }), false);
});

test('186: merge transfer preserves stack identity and leaves a donor remainder at max stack', () => {
  const receiver = namedStack(63);
  const donor = namedStack(2);
  assert.equal(mergeItemEntityStacks(receiver, donor), 1);
  assert.equal(receiver.count, 64);
  assert.equal(donor.count, 1);
  assert.equal(receiver.customName, 'Parity Stone');
});

test('187: server spawn owns the stack and legacy spawn delegates to a plain stack', () => {
  const server = new GameServer(42, true) as any;
  const original = namedStack(2);
  const rich = server.spawnDroppedStack(original, 0, 64, 0, 0, 0);
  original.customName = 'mutated';
  const plain = server.spawnDroppedItem(2, 3, 4, 64, 0, 0, 0);
  assert.equal(rich.stack.customName, 'Parity Stone');
  assert.equal(rich.pickupDelay, 0);
  assert.deepEqual(plain.stack, { id: 2, count: 3 });
});

test('188: server merge is dimension- and metadata-aware and preserves age/delay rules', () => {
  const server = new GameServer(42, true) as any;
  const a = server.spawnDroppedStack(namedStack(60), 0, 64, 0, 0, 0.1);
  const b = server.spawnDroppedStack(namedStack(8), 0.2, 64, 0, 0, 0.4);
  const different = namedStack(1);
  different.customName = 'Different Stone';
  server.spawnDroppedStack(different, 0.1, 64, 0.1, 0, 0);
  server.spawnDroppedStack(namedStack(1), 0.1, 64, 0.1, 1, 0);
  a.age = 10;
  b.age = 5;
  server.mergeServerDroppedItems();
  assert.equal(a.stack.count, 64);
  assert.equal(b.stack.count, 4);
  assert.equal(a.pickupDelay, 0.4);
  assert.equal(a.age, 5);
  assert.equal(server.droppedItems.size, 4);
});

test('189: NetworkClient spawns and updates the authoritative full dropped stack', () => {
  const dropped = new DroppedItemSystem(new THREE.Scene(), () => null);
  const client = new NetworkClient({ droppedItems: dropped } as any) as any;
  client.handlePacket({
    type: PacketType.S2C_DROPPED_ITEM_SPAWN,
    payload: { id: 77, stack: namedStack(2), x: 1, y: 64, z: 2, pickupDelay: 0.25, age: 3 },
  });
  const item = dropped.items.get(77)!;
  assert.equal(item.stack.customName, 'Parity Stone');
  assert.equal(item.pickupDelay, 0.25);
  assert.equal(item.age, 3);

  const updated = namedStack(1);
  updated.customName = 'Updated Stone';
  client.handlePacket({ type: PacketType.S2C_DROPPED_ITEM_UPDATE, payload: { id: 77, stack: updated } });
  assert.equal(item.count, 1);
  assert.equal(item.stack.customName, 'Updated Stone');
  dropped.dispose();
});

test('190: integration contracts keep death/container drops and packet movement server-authoritative', () => {
  const serverSource = readFileSync(new URL('../src/server/GameServer.ts', import.meta.url), 'utf8');
  const gameSource = readFileSync(new URL('../src/engine/Game.ts', import.meta.url), 'utf8');
  assert.ok(serverSource.includes('this.spawnDroppedStack(next.cursor'));
  assert.equal((serverSource.match(/this\.spawnDroppedStack\(stack, player\.x, player\.y, player\.z, player\.dimension\)/g) ?? []).length, 2);
  assert.ok(serverSource.includes('this.spawnDroppedStack(player.offhand'));
  assert.ok(serverSource.includes('broadcastDimension(item.dimension, PacketType.S2C_DROPPED_ITEM_MOVE'));
  assert.ok(serverSource.includes('PacketType.S2C_DROPPED_ITEM_UPDATE'));
  assert.ok(gameSource.includes('!this.isMultiplayerNetworkConnected()'));
});
'''
write('tests/parity-171-190.test.ts', tests)

print('Parity 171-190 item entity patches staged.')
