import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { Inventory } from '../src/player/Inventory';
import { cloneItemStack, itemStacksCanMerge } from '../src/items/ItemStackRules';
import { HopperSystem } from '../src/systems/HopperSystem';
import { SurvivalSystem } from '../src/systems/SurvivalSystem';
import { applyDamageProtection } from '../src/systems/DamageRules';
import { FluidSystem, getFluidSlopeFindDistance, type FluidTickAccess } from '../src/systems/FluidSystem';
import type { BlockMetadata, ItemStack } from '../src/types';

test('151-154: fall damage stays raw until the shared protection pipeline', () => {
  const system = new SurvivalSystem();
  const player: any = {
    position: new THREE.Vector3(0, 64, 0),
    eyePosition: new THREE.Vector3(0, 65.62, 0),
    velocity: new THREE.Vector3(0, -1, 0),
    onGround: false,
    speedMultiplier: 1,
    health: 20,
    hunger: 20,
    saturation: 5,
    oxygen: 15,
    flying: false,
  };
  const hits: Array<[number, string]> = [];
  const rules = { getRule: () => true };
  const enchant = (id: string) => id === 'feather_falling' ? 4 : 0;
  system.update(0.05, player, 'survival', () => 0, (amount, kind) => hits.push([amount, kind]), 'normal', rules, () => false, enchant);
  player.position.y = 56;
  player.eyePosition.y = 57.62;
  player.velocity.y = 0;
  player.onGround = true;
  system.update(0.05, player, 'survival', () => 0, (amount, kind) => hits.push([amount, kind]), 'normal', rules, () => false, enchant);
  assert.deepEqual(hits, [[5, 'fall']], '8-block fall yields raw ceil(8 - 3) damage even with Feather Falling');
  assert.ok(Math.abs(applyDamageProtection(5, 'fall', 20, 8, { featherFalling: 4 }) - 2.6) < 1e-12);
});

test('155-157: stack identity is structural and count-independent', () => {
  const a = {
    id: 5,
    count: 1,
    potion: { kind: 'speed', name: 'Speed', effect: { id: 'speed', level: 1, duration: 180 } },
  } as ItemStack;
  const b = {
    count: 32,
    id: 5,
    potion: { effect: { duration: 180, level: 1, id: 'speed' }, name: 'Speed', kind: 'speed' },
  } as ItemStack;
  assert.equal(itemStacksCanMerge(a, b), true);
  assert.equal(itemStacksCanMerge(a, { ...b, customName: 'Named' }), false);
  assert.equal(itemStacksCanMerge({ id: 5, count: 1, durability: 3 }, { id: 5, count: 1, durability: 2 }), false);
});

test('156 and 166: stack cloning owns every nested modeled component', () => {
  const original: ItemStack = {
    id: 5,
    count: 2,
    enchantments: [{ id: 'sharpness', level: 2 }],
    potion: { kind: 'speed', name: 'Speed', effect: { id: 'speed', level: 1, duration: 180 } },
    map: { id: 7, centerX: 0, centerZ: 0, scale: 0, dimension: 0, pixels: ['a'], playerMarker: { x: 1, z: 2 } },
    book: { pages: ['one'] },
    patterns: [{ pattern: 'stripe', color: 'red' }],
  };
  const cloned = cloneItemStack(original)!;
  cloned.enchantments![0].level = 3;
  cloned.potion!.effect!.duration = 1;
  cloned.map!.pixels[0] = 'b';
  cloned.map!.playerMarker.x = 9;
  cloned.book!.pages[0] = 'two';
  cloned.patterns![0].color = 'blue';
  assert.equal(original.enchantments![0].level, 2);
  assert.equal(original.potion!.effect!.duration, 180);
  assert.equal(original.map!.pixels[0], 'a');
  assert.equal(original.map!.playerMarker.x, 1);
  assert.equal(original.book!.pages[0], 'one');
  assert.equal(original.patterns![0].color, 'red');
});

test('158-160: inventory keeps component-bearing stacks distinct and split preserves metadata', () => {
  const inventory = new Inventory();
  inventory.slots[0] = { id: 5, count: 10, customName: 'Keep Separate' };
  assert.equal(inventory.addItem(5, 1), 0);
  assert.equal(inventory.slots[0]!.count, 10);
  assert.deepEqual(inventory.slots[1], { id: 5, count: 1 });

  const stack: ItemStack = { id: 5, count: 4, customName: 'Named', enchantments: [{ id: 'sharpness', level: 1 }] };
  inventory.slots[2] = { ...cloneItemStack(stack)!, count: 10 };
  assert.equal(inventory.addStack(stack), null);
  assert.equal(inventory.slots[2]!.count, 14);
  const split = inventory.splitSlot(2)!;
  assert.equal(split.customName, 'Named');
  assert.deepEqual(split.enchantments, stack.enchantments);
  assert.notEqual(split.enchantments, inventory.slots[2]!.enchantments);
});

test('161-165: hopper stack transfer respects full item component identity', () => {
  const hopper = Object.create(HopperSystem.prototype) as any;
  const inventory: Array<ItemStack | null> = [
    { id: 5, count: 10, customName: 'A' },
    null,
  ];
  const moved = hopper.pushItem(inventory, { id: 5, count: 1, customName: 'B' });
  assert.equal(moved, 1);
  assert.deepEqual(inventory[0], { id: 5, count: 10, customName: 'A' });
  assert.deepEqual(inventory[1], { id: 5, count: 1, customName: 'B' });
});

test('167-168: fluid slope search radius matches Java 1.20.1 dimensions', () => {
  assert.equal(getFluidSlopeFindDistance('water', 0), 4);
  assert.equal(getFluidSlopeFindDistance('water', 1), 4);
  assert.equal(getFluidSlopeFindDistance('lava', 0), 2);
  assert.equal(getFluidSlopeFindDistance('lava', 2), 2);
  assert.equal(getFluidSlopeFindDistance('lava', 1), 4);
});

function createFluidWorld(initial: Array<[number, number, number, number, BlockMetadata?]>, dimension = 0) {
  const blocks = new Map<string, number>();
  const metadata = new Map<string, BlockMetadata>();
  const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
  for (const [x, y, z, id, meta] of initial) {
    blocks.set(key(x, y, z), id);
    if (meta) metadata.set(key(x, y, z), meta);
  }
  const access: FluidTickAccess = {
    dimension,
    getBlock: (x, y, z) => blocks.get(key(x, y, z)) ?? 0,
    getBlockMeta: (x, y, z) => metadata.get(key(x, y, z)),
    setBlock: (x, y, z, id) => blocks.set(key(x, y, z), id),
    setBlockMeta: (x, y, z, meta) => { if (meta) metadata.set(key(x, y, z), meta); else metadata.delete(key(x, y, z)); },
  };
  return { access };
}

test('169-170: source flow chooses the horizontal direction with the nearest downward opening', () => {
  const initial: Array<[number, number, number, number]> = [[0, 10, 0, 9]];
  for (let x = -5; x <= 5; x++) {
    for (let z = -5; z <= 5; z++) {
      if (x === 2 && z === 0) continue;
      initial.push([x, 9, z, 1]);
    }
  }
  const world = createFluidWorld(initial);
  const result = new FluidSystem().processTick(0, 10, 0, world.access);
  const horizontal = result.next
    .filter((pos) => pos.y === 10)
    .map((pos) => `${pos.x},${pos.z}`)
    .sort();
  assert.deepEqual(horizontal, ['1,0']);
});
