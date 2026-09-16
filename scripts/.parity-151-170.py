from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one patch target in {path}, found {count}: {old[:100]!r}")
    p.write_text(text.replace(old, new, 1))


Path('src/items/ItemStackRules.ts').write_text("""import type { ItemStack } from '../types';

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
""")

replace_once(
    'src/systems/SurvivalSystem.ts',
    """        const featherReduction = getEnchantLevel('feather_falling');
        const reduced = Math.max(0, fallDist - 3) * (1 - Math.min(0.8, featherReduction * 0.12));
        const fallDamage = Math.ceil(reduced - TIMER_EPSILON);""",
    """        // Produce raw rounded fall damage here. Protection and Feather Falling
        // are applied exactly once later by the shared damage pipeline.
        const fallDamage = Math.ceil(Math.max(0, fallDist - 3) - TIMER_EPSILON);""",
)

replace_once(
    'src/server/ContainerRules.ts',
    "import { ItemRegistry } from '../items/ItemRegistry';",
    "import { ItemRegistry } from '../items/ItemRegistry';\nimport { cloneItemStack, itemStacksCanMerge } from '../items/ItemStackRules';",
)
replace_once(
    'src/server/ContainerRules.ts',
    """function cloneStack(stack: ItemStack | null): ItemStack | null {
  if (!stack) return null;
  const clone: ItemStack = { ...stack };
  if (stack.enchantments) {
    clone.enchantments = stack.enchantments.map((enchantment) => ({ ...enchantment }));
  }
  return clone;
}

function stackIdentity(stack: ItemStack): string {
  const { count: _count, ...identity } = stack;
  return JSON.stringify(identity);
}

export function canStacksMerge(a: ItemStack | null | undefined, b: ItemStack | null | undefined): boolean {
  if (!a || !b || a.id !== b.id) return false;
  return stackIdentity(a) === stackIdentity(b);
}""",
    """const cloneStack = cloneItemStack;
export const canStacksMerge = itemStacksCanMerge;""",
)

replace_once(
    'src/player/Inventory.ts',
    "import { ItemRegistry } from '../items/ItemRegistry';",
    "import { ItemRegistry } from '../items/ItemRegistry';\nimport { cloneItemStack, itemStacksCanMerge } from '../items/ItemStackRules';",
)
replace_once(
    'src/player/Inventory.ts',
    "      if (slot && slot.id === id && slot.count < maxStack) {",
    "      if (slot && itemStacksCanMerge(slot, { id, count: 1 }) && slot.count < maxStack) {",
)
replace_once(
    'src/player/Inventory.ts',
    """    const sameKind = (a: ItemStack, b: ItemStack) =>
      a.id === b.id &&
      a.customName === b.customName &&
      JSON.stringify(a.enchantments ?? []) === JSON.stringify(b.enchantments ?? []) &&
      JSON.stringify(a.potion ?? null) === JSON.stringify(b.potion ?? null);

""",
    "",
)
replace_once(
    'src/player/Inventory.ts',
    "      if (slot && sameKind(slot, stack) && slot.count < maxStack) {",
    "      if (slot && itemStacksCanMerge(slot, stack) && slot.count < maxStack) {",
)
replace_once(
    'src/player/Inventory.ts',
    """        this.slots[i] = { ...stack, count: toAdd };
        remaining -= toAdd;""",
    """        const placed = cloneItemStack(stack)!;
        placed.count = toAdd;
        this.slots[i] = placed;
        remaining -= toAdd;""",
)
replace_once(
    'src/player/Inventory.ts',
    "    return remaining > 0 ? { ...stack, count: remaining } : null;",
    """    if (remaining <= 0) return null;
    const leftover = cloneItemStack(stack)!;
    leftover.count = remaining;
    return leftover;""",
)
replace_once(
    'src/player/Inventory.ts',
    "    return { id: slot.id, count: half };",
    """    const split = cloneItemStack(slot)!;
    split.count = half;
    return split;""",
)

replace_once(
    'src/systems/HopperSystem.ts',
    "import { ItemRegistry } from '../items/ItemRegistry';",
    "import { ItemRegistry } from '../items/ItemRegistry';\nimport { cloneItemStack, itemStacksCanMerge } from '../items/ItemStackRules';",
)
replace_once(
    'src/systems/HopperSystem.ts',
    "      if (slot && slot.id === stack.id && slot.count < maxForSlot) {",
    "      if (slot && itemStacksCanMerge(slot, stack) && slot.count < maxForSlot) {",
)
replace_once(
    'src/systems/HopperSystem.ts',
    """        inventory[idx] = { ...stack, count: addCount };
        remaining -= addCount;""",
    """        const placed = cloneItemStack(stack)!;
        placed.count = addCount;
        inventory[idx] = placed;
        remaining -= addCount;""",
)

replace_once(
    'src/systems/FluidSystem.ts',
    "type FluidType = 'water' | 'lava';",
    """export type FluidType = 'water' | 'lava';

/** Java 1.20.1 horizontal drop-search radius. */
export function getFluidSlopeFindDistance(type: FluidType, dimension?: number): number {
  if (type === 'water') return 4;
  return dimension === 1 ? 4 : 2;
}""",
)
replace_once(
    'src/systems/FluidSystem.ts',
    "      this.spreadFromSource(x, y, z, access.getBlock, enqueueNext);",
    "      this.spreadFromSource(x, y, z, fluidType!, access.getBlock, enqueueNext, access.dimension);",
)
replace_once(
    'src/systems/FluidSystem.ts',
    """  private spreadFromSource(
    x: number,
    y: number,
    z: number,
    getBlock: (x: number, y: number, z: number) => number,
    enqueueNext: (x: number, y: number, z: number) => void,
  ) {
    const belowId = getBlock(x, y - 1, z) & 0x3FF;
    if (belowId === 0 || BlockRegistry.isFluid(belowId)) enqueueNext(x, y - 1, z);
    for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const id = getBlock(x + dx, y, z + dz) & 0x3FF;
      if (id === 0 || BlockRegistry.isFluid(id)) enqueueNext(x + dx, y, z + dz);
    }
  }""",
    """  private isFlowPassable(
    getBlock: (x: number, y: number, z: number) => number,
    x: number,
    y: number,
    z: number,
  ): boolean {
    const id = getBlock(x, y, z) & 0x3FF;
    return id === 0 || BlockRegistry.isFluid(id);
  }

  private findSlopeDistance(
    startX: number,
    y: number,
    startZ: number,
    originX: number,
    originZ: number,
    getBlock: (x: number, y: number, z: number) => number,
    maxDistance: number,
  ): number {
    const queue: Array<{ x: number; z: number; distance: number }> = [{ x: startX, z: startZ, distance: 0 }];
    const visited = new Set<string>([`${originX},${originZ}`, `${startX},${startZ}`]);
    const directions: Array<[number, number]> = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const [dx, dz] of directions) {
        const nx = current.x + dx;
        const nz = current.z + dz;
        const distance = current.distance + 1;
        if (distance > maxDistance) continue;
        const key = `${nx},${nz}`;
        if (visited.has(key) || !this.isFlowPassable(getBlock, nx, y, nz)) continue;
        visited.add(key);
        if (this.isFlowPassable(getBlock, nx, y - 1, nz)) return distance;
        queue.push({ x: nx, z: nz, distance });
      }
    }
    return Number.POSITIVE_INFINITY;
  }

  private getBestHorizontalDirections(
    x: number,
    y: number,
    z: number,
    type: FluidType,
    getBlock: (x: number, y: number, z: number) => number,
    dimension?: number,
  ): Array<[number, number]> {
    const directions: Array<[number, number]> = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const candidates = directions.filter(([dx, dz]) => this.isFlowPassable(getBlock, x + dx, y, z + dz));
    if (candidates.length <= 1) return candidates;

    const maxDistance = getFluidSlopeFindDistance(type, dimension);
    let bestDistance = Number.POSITIVE_INFINITY;
    const scored = candidates.map(([dx, dz]) => {
      const nx = x + dx;
      const nz = z + dz;
      const distance = this.isFlowPassable(getBlock, nx, y - 1, nz)
        ? 0
        : this.findSlopeDistance(nx, y, nz, x, z, getBlock, maxDistance);
      bestDistance = Math.min(bestDistance, distance);
      return { direction: [dx, dz] as [number, number], distance };
    });

    return scored.filter((entry) => entry.distance === bestDistance).map((entry) => entry.direction);
  }

  private spreadFromSource(
    x: number,
    y: number,
    z: number,
    type: FluidType,
    getBlock: (x: number, y: number, z: number) => number,
    enqueueNext: (x: number, y: number, z: number) => void,
    dimension?: number,
  ) {
    if (this.isFlowPassable(getBlock, x, y - 1, z)) enqueueNext(x, y - 1, z);
    for (const [dx, dz] of this.getBestHorizontalDirections(x, y, z, type, getBlock, dimension)) {
      enqueueNext(x + dx, y, z + dz);
    }
  }""",
)
replace_once(
    'src/systems/FluidSystem.ts',
    """    for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const id = getBlock(x + dx, y, z + dz) & 0x3FF;
      if (id === 0 || BlockRegistry.isFluid(id)) enqueueNext(x + dx, y, z + dz);
    }""",
    """    for (const [dx, dz] of this.getBestHorizontalDirections(x, y, z, type, getBlock, dimension)) {
      enqueueNext(x + dx, y, z + dz);
    }""",
)

Path('tests/parity-151-170.test.ts').write_text("""import assert from 'node:assert/strict';
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
""")

print('Parity 151-170 production and regression patches staged.')
