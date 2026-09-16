import assert from 'node:assert/strict';
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
