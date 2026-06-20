import * as THREE from 'three';
import { CHUNK_SIZE, WORLD_HEIGHT } from '../constants';
import type { BlockMetadata } from '../types';

interface FluidUpdate {
  x: number;
  y: number;
  z: number;
  level: number; // 1-7 for water, 1-4 for lava
  type: number;  // 8/9 = water, 10/11 = lava
}

const MAX_UPDATES_PER_TICK = 20;

export class FluidSystem {
  private queue: FluidUpdate[] = [];
  private tickTimer = 0;
  private tickInterval = 0.4; // seconds between fluid ticks

  update(
    dt: number,
    getBlock: (x: number, y: number, z: number) => number,
    setBlock: (x: number, y: number, z: number, id: number) => void,
    setBlockMeta: (x: number, y: number, z: number, meta: BlockMetadata | null, markDirty?: boolean) => void
  ) {
    this.tickTimer += dt;
    if (this.tickTimer < this.tickInterval) return;
    this.tickTimer = 0;

    // Process fluid updates
    let count = 0;
    const nextQueue: FluidUpdate[] = [];
    const processedThisTick: Set<string> = new Set();

    while (this.queue.length > 0 && count < MAX_UPDATES_PER_TICK) {
      const upd = this.queue.shift()!;
      const key = `${upd.x},${upd.y},${upd.z}`;
      if (processedThisTick.has(key)) continue;
      processedThisTick.add(key);
      count++;

      const baseType = upd.type & 0x3FF;

      // Water (id 8/9) spreads
      if (baseType === 8 || baseType === 9) {
        this.processWater(upd, getBlock, setBlock, setBlockMeta, nextQueue);
      }
      // Lava (id 10/11) spreads slower
      if (baseType === 10 || baseType === 11) {
        this.processLava(upd, getBlock, setBlock, setBlockMeta, nextQueue);
      }
    }

    this.queue.push(...nextQueue);
  }

  /** Called when a water/lava block is placed. */
  addSource(x: number, y: number, z: number, type: number) {
    this.queue.push({ x, y, z, level: 7, type });
  }

  /** Place a fluid block and persist its level to metadata. */
  private placeFluid(
    x: number, y: number, z: number,
    id: number, level: number,
    setBlock: (x: number, y: number, z: number, id: number) => void,
    setBlockMeta: (x: number, y: number, z: number, meta: BlockMetadata | null, markDirty?: boolean) => void
  ) {
    setBlock(x, y, z, id);
    // fluidLevel: level 7→8 (source full height), level 6→7, …, level 1→2
    // flow-down uses level 7 → fluidLevel 8
    setBlockMeta(x, y, z, { fluidLevel: level + 1 }, true);
  }

  private processWater(
    upd: FluidUpdate,
    getBlock: (x: number, y: number, z: number) => number,
    setBlock: (x: number, y: number, z: number, id: number) => void,
    setBlockMeta: (x: number, y: number, z: number, meta: BlockMetadata | null, markDirty?: boolean) => void,
    nextQueue: FluidUpdate[]
  ) {
    // Flow down first
    if (getBlock(upd.x, upd.y - 1, upd.z) === 0) {
      this.placeFluid(upd.x, upd.y - 1, upd.z, 8, 7, setBlock, setBlockMeta);
      nextQueue.push({ x: upd.x, y: upd.y - 1, z: upd.z, level: 7, type: 8 });
      return;
    }

    // Flow horizontally with decreasing level
    if (upd.level > 0) {
      for (const [dx, , dz] of [[-1, 0, 0], [1, 0, 0], [0, 0, -1], [0, 0, 1]] as [number, number, number][]) {
        const nx = upd.x + dx;
        const nz = upd.z + dz;
        const neighbor = getBlock(nx, upd.y, nz);

        if (neighbor === 0) {
          this.placeFluid(nx, upd.y, nz, 8, upd.level - 1, setBlock, setBlockMeta);
          nextQueue.push({ x: nx, y: upd.y, z: nz, level: upd.level - 1, type: 8 });
        }
      }
    }
  }

  private processLava(
    upd: FluidUpdate,
    getBlock: (x: number, y: number, z: number) => number,
    setBlock: (x: number, y: number, z: number, id: number) => void,
    setBlockMeta: (x: number, y: number, z: number, meta: BlockMetadata | null, markDirty?: boolean) => void,
    nextQueue: FluidUpdate[]
  ) {
    // Flow down first
    if (getBlock(upd.x, upd.y - 1, upd.z) === 0) {
      this.placeFluid(upd.x, upd.y - 1, upd.z, 10, 4, setBlock, setBlockMeta);
      nextQueue.push({ x: upd.x, y: upd.y - 1, z: upd.z, level: 4, type: 10 });
      return;
    }

    if (upd.level > 0) {
      for (const [dx, , dz] of [[-1, 0, 0], [1, 0, 0], [0, 0, -1], [0, 0, 1]] as [number, number, number][]) {
        const nx = upd.x + dx;
        const nz = upd.z + dz;
        const neighbor = getBlock(nx, upd.y, nz);

        if (neighbor === 0) {
          this.placeFluid(nx, upd.y, nz, 10, upd.level - 1, setBlock, setBlockMeta);
          nextQueue.push({ x: nx, y: upd.y, z: nz, level: upd.level - 1, type: 10 });
        }

        // Water + Lava = Cobblestone (base ID 4)
        const neighBase = neighbor & 0x3FF;
        const updBase = upd.type & 0x3FF;
        if ((neighBase === 8 || neighBase === 9) && (updBase === 10 || updBase === 11)) {
          setBlock(nx, upd.y, nz, 4); // cobblestone
        }
        // Lava + Water = Cobblestone/Obsidian
        if ((neighBase === 10 || neighBase === 11) && (updBase === 8 || updBase === 9)) {
          setBlock(upd.x, upd.y, upd.z, 4);
        }
      }
    }
  }

  clear() {
    this.queue = [];
  }
}
