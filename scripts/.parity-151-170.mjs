import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(path, from, to) {
  const source = readFileSync(path, 'utf8');
  const first = source.indexOf(from);
  if (first < 0) throw new Error(`Missing patch target in ${path}: ${from.slice(0, 100)}`);
  if (source.indexOf(from, first + from.length) >= 0) throw new Error(`Ambiguous patch target in ${path}: ${from.slice(0, 100)}`);
  writeFileSync(path, source.slice(0, first) + to + source.slice(first + from.length));
}

const itemStackRules = `import type { ItemStack } from '../types';

/** Deep-clone every structured field currently carried by the project ItemStack. */
export function cloneItemStack(stack: ItemStack | null | undefined): ItemStack | null {
  if (!stack) return null;
  const clone: ItemStack = { ...stack };
  if (stack.enchantments) clone.enchantments = stack.enchantments.map((entry) => ({ ...entry }));
  if (stack.potion) {
    clone.potion = {
      ...stack.potion,
      effect: stack.potion.effect ? { ...stack.potion.effect } : undefined,
    };
  }
  if (stack.map) {
    clone.map = {
      ...stack.map,
      pixels: [...stack.map.pixels],
      playerMarker: { ...stack.map.playerMarker },
    };
  }
  if (stack.book) clone.book = { ...stack.book, pages: [...stack.book.pages] };
  if (stack.patterns) clone.patterns = stack.patterns.map((pattern) => ({ ...pattern }));
  return clone;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) sorted[key] = canonicalize(record[key]);
  return sorted;
}

/** Stack identity excludes count but includes every other modeled component. */
export function itemStackIdentity(stack: ItemStack): string {
  const { count: _count, ...identity } = stack;
  return JSON.stringify(canonicalize(identity));
}

/** Java-style stack merging requires the same item and the same stack components. */
export function itemStacksCanMerge(
  a: ItemStack | null | undefined,
  b: ItemStack | null | undefined,
): boolean {
  if (!a || !b || a.id !== b.id) return false;
  return itemStackIdentity(a) === itemStackIdentity(b);
}
`;
writeFileSync('src/items/ItemStackRules.ts', itemStackRules);

replaceOnce(
  'src/systems/SurvivalSystem.ts',
  `        const featherReduction = getEnchantLevel('feather_falling');\n        const reduced = Math.max(0, fallDist - 3) * (1 - Math.min(0.8, featherReduction * 0.12));\n        const fallDamage = Math.ceil(reduced - TIMER_EPSILON);`,
  `        // calculateFallDamage produces raw rounded fall damage. Protection and\n        // Feather Falling are applied once later by the common damage pipeline.\n        const fallDamage = Math.ceil(Math.max(0, fallDist - 3) - TIMER_EPSILON);`,
);

replaceOnce(
  'src/server/ContainerRules.ts',
  `import { ItemRegistry } from '../items/ItemRegistry';`,
  `import { ItemRegistry } from '../items/ItemRegistry';\nimport { cloneItemStack, itemStacksCanMerge } from '../items/ItemStackRules';`,
);
replaceOnce(
  'src/server/ContainerRules.ts',
  `function cloneStack(stack: ItemStack | null): ItemStack | null {\n  if (!stack) return null;\n  const clone: ItemStack = { ...stack };\n  if (stack.enchantments) {\n    clone.enchantments = stack.enchantments.map((enchantment) => ({ ...enchantment }));\n  }\n  return clone;\n}\n\nfunction stackIdentity(stack: ItemStack): string {\n  const { count: _count, ...identity } = stack;\n  return JSON.stringify(identity);\n}\n\nexport function canStacksMerge(a: ItemStack | null | undefined, b: ItemStack | null | undefined): boolean {\n  if (!a || !b || a.id !== b.id) return false;\n  return stackIdentity(a) === stackIdentity(b);\n}`,
  `const cloneStack = cloneItemStack;\nexport const canStacksMerge = itemStacksCanMerge;`,
);

replaceOnce(
  'src/player/Inventory.ts',
  `import { ItemRegistry } from '../items/ItemRegistry';`,
  `import { ItemRegistry } from '../items/ItemRegistry';\nimport { cloneItemStack, itemStacksCanMerge } from '../items/ItemStackRules';`,
);
replaceOnce(
  'src/player/Inventory.ts',
  `      if (slot && slot.id === id && slot.count < maxStack) {`,
  `      if (slot && itemStacksCanMerge(slot, { id, count: 1 }) && slot.count < maxStack) {`,
);
replaceOnce(
  'src/player/Inventory.ts',
  `    const sameKind = (a: ItemStack, b: ItemStack) =>\n      a.id === b.id &&\n      a.customName === b.customName &&\n      JSON.stringify(a.enchantments ?? []) === JSON.stringify(b.enchantments ?? []) &&\n      JSON.stringify(a.potion ?? null) === JSON.stringify(b.potion ?? null);\n\n`,
  ``,
);
replaceOnce(
  'src/player/Inventory.ts',
  `      if (slot && sameKind(slot, stack) && slot.count < maxStack) {`,
  `      if (slot && itemStacksCanMerge(slot, stack) && slot.count < maxStack) {`,
);
replaceOnce(
  'src/player/Inventory.ts',
  `        this.slots[i] = { ...stack, count: toAdd };\n        remaining -= toAdd;`,
  `        const placed = cloneItemStack(stack)!;\n        placed.count = toAdd;\n        this.slots[i] = placed;\n        remaining -= toAdd;`,
);
replaceOnce(
  'src/player/Inventory.ts',
  `    return remaining > 0 ? { ...stack, count: remaining } : null;`,
  `    if (remaining <= 0) return null;\n    const leftover = cloneItemStack(stack)!;\n    leftover.count = remaining;\n    return leftover;`,
);
replaceOnce(
  'src/player/Inventory.ts',
  `    return { id: slot.id, count: half };`,
  `    const split = cloneItemStack(slot)!;\n    split.count = half;\n    return split;`,
);

replaceOnce(
  'src/systems/HopperSystem.ts',
  `import { ItemRegistry } from '../items/ItemRegistry';`,
  `import { ItemRegistry } from '../items/ItemRegistry';\nimport { cloneItemStack, itemStacksCanMerge } from '../items/ItemStackRules';`,
);
replaceOnce(
  'src/systems/HopperSystem.ts',
  `      if (slot && slot.id === stack.id && slot.count < maxForSlot) {`,
  `      if (slot && itemStacksCanMerge(slot, stack) && slot.count < maxForSlot) {`,
);
replaceOnce(
  'src/systems/HopperSystem.ts',
  `        inventory[idx] = { ...stack, count: addCount };\n        remaining -= addCount;`,
  `        const placed = cloneItemStack(stack)!;\n        placed.count = addCount;\n        inventory[idx] = placed;\n        remaining -= addCount;`,
);

replaceOnce(
  'src/systems/FluidSystem.ts',
  `type FluidType = 'water' | 'lava';`,
  `export type FluidType = 'water' | 'lava';\n\n/** Java 1.20.1 horizontal drop-search radius. */\nexport function getFluidSlopeFindDistance(type: FluidType, dimension?: number): number {\n  if (type === 'water') return 4;\n  return dimension === 1 ? 4 : 2;\n}`,
);
replaceOnce(
  'src/systems/FluidSystem.ts',
  `      this.spreadFromSource(x, y, z, access.getBlock, enqueueNext);`,
  `      this.spreadFromSource(x, y, z, fluidType!, access.getBlock, enqueueNext, access.dimension);`,
);
const oldSourceMethod = `  private spreadFromSource(\n    x: number,\n    y: number,\n    z: number,\n    getBlock: (x: number, y: number, z: number) => number,\n    enqueueNext: (x: number, y: number, z: number) => void,\n  ) {\n    const belowId = getBlock(x, y - 1, z) & 0x3FF;\n    if (belowId === 0 || BlockRegistry.isFluid(belowId)) enqueueNext(x, y - 1, z);\n    for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {\n      const id = getBlock(x + dx, y, z + dz) & 0x3FF;\n      if (id === 0 || BlockRegistry.isFluid(id)) enqueueNext(x + dx, y, z + dz);\n    }\n  }`;
const newSourceMethod = `  private isFlowPassable(\n    getBlock: (x: number, y: number, z: number) => number,\n    x: number,\n    y: number,\n    z: number,\n  ): boolean {\n    const id = getBlock(x, y, z) & 0x3FF;\n    return id === 0 || BlockRegistry.isFluid(id);\n  }\n\n  private findSlopeDistance(\n    startX: number,\n    y: number,\n    startZ: number,\n    originX: number,\n    originZ: number,\n    getBlock: (x: number, y: number, z: number) => number,\n    maxDistance: number,\n  ): number {\n    const queue: Array<{ x: number; z: number; distance: number }> = [{ x: startX, z: startZ, distance: 0 }];\n    const visited = new Set<string>([\\`${'${originX},${originZ}'}\\`, \\`${'${startX},${startZ}'}\\`]);\n    const directions: Array<[number, number]> = [[-1, 0], [1, 0], [0, -1], [0, 1]];\n\n    while (queue.length > 0) {\n      const current = queue.shift()!;\n      for (const [dx, dz] of directions) {\n        const nx = current.x + dx;\n        const nz = current.z + dz;\n        const distance = current.distance + 1;\n        if (distance > maxDistance) continue;\n        const key = \\`${'${nx},${nz}'}\\`;\n        if (visited.has(key) || !this.isFlowPassable(getBlock, nx, y, nz)) continue;\n        visited.add(key);\n        if (this.isFlowPassable(getBlock, nx, y - 1, nz)) return distance;\n        queue.push({ x: nx, z: nz, distance });\n      }\n    }\n    return Number.POSITIVE_INFINITY;\n  }\n\n  private getBestHorizontalDirections(\n    x: number,\n    y: number,\n    z: number,\n    type: FluidType,\n    getBlock: (x: number, y: number, z: number) => number,\n    dimension?: number,\n  ): Array<[number, number]> {\n    const directions: Array<[number, number]> = [[-1, 0], [1, 0], [0, -1], [0, 1]];\n    const candidates = directions.filter(([dx, dz]) => this.isFlowPassable(getBlock, x + dx, y, z + dz));\n    if (candidates.length <= 1) return candidates;\n\n    const maxDistance = getFluidSlopeFindDistance(type, dimension);\n    let bestDistance = Number.POSITIVE_INFINITY;\n    const scored = candidates.map(([dx, dz]) => {\n      const nx = x + dx;\n      const nz = z + dz;\n      const distance = this.isFlowPassable(getBlock, nx, y - 1, nz)\n        ? 0\n        : this.findSlopeDistance(nx, y, nz, x, z, getBlock, maxDistance);\n      bestDistance = Math.min(bestDistance, distance);\n      return { direction: [dx, dz] as [number, number], distance };\n    });\n\n    return scored.filter((entry) => entry.distance === bestDistance).map((entry) => entry.direction);\n  }\n\n  private spreadFromSource(\n    x: number,\n    y: number,\n    z: number,\n    type: FluidType,\n    getBlock: (x: number, y: number, z: number) => number,\n    enqueueNext: (x: number, y: number, z: number) => void,\n    dimension?: number,\n  ) {\n    if (this.isFlowPassable(getBlock, x, y - 1, z)) enqueueNext(x, y - 1, z);\n    for (const [dx, dz] of this.getBestHorizontalDirections(x, y, z, type, getBlock, dimension)) {\n      enqueueNext(x + dx, y, z + dz);\n    }\n  }`;
replaceOnce('src/systems/FluidSystem.ts', oldSourceMethod, newSourceMethod);
replaceOnce(
  'src/systems/FluidSystem.ts',
  `    for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {\n      const id = getBlock(x + dx, y, z + dz) & 0x3FF;\n      if (id === 0 || BlockRegistry.isFluid(id)) enqueueNext(x + dx, y, z + dz);\n    }`,
  `    for (const [dx, dz] of this.getBestHorizontalDirections(x, y, z, type, getBlock, dimension)) {\n      enqueueNext(x + dx, y, z + dz);\n    }`,
);

const tests = `import assert from 'node:assert/strict';
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
  const position = new THREE.Vector3(0, 64, 0);
  const player: any = {
    position,
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
  assert.equal(applyDamageProtection(5, 'fall', 20, 8, { featherFalling: 4 }), 2.6);
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

test('158-160: inventory never merges plain items into component-bearing stacks and split preserves metadata', () => {
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
  const key = (x: number, y: number, z: number) => \\`${'${x},${y},${z}'}\\`;
  for (const [x, y, z, id, meta] of initial) {
    blocks.set(key(x, y, z), id);
    if (meta) metadata.set(key(x, y, z), meta);
  }
  const access: FluidTickAccess = {
    dimension,
    getBlock: (x, y, z) => blocks.get(key(x, y, z)) ?? 0,
    getBlockMeta: (x, y, z) => metadata.get(key(x, y, z)),
    setBlock: (x, y, z, id) => blocks.set(key(x, y, z), id),
    setBlockMeta: (x, y, z, meta) => meta ? metadata.set(key(x, y, z), meta) : metadata.delete(key(x, y, z)),
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
    .map((pos) => \\`${'${pos.x},${pos.z}'}\\`)
    .sort();
  assert.deepEqual(horizontal, ['1,0']);
});
`;
writeFileSync('tests/parity-151-170.test.ts', tests);

console.log('Parity 151-170 production and regression patches staged.');
