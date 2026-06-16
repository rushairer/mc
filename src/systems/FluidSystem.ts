import * as THREE from 'three';
import { CHUNK_SIZE, WORLD_HEIGHT } from '../constants';

interface FluidUpdate {
  x: number;
  y: number;
  z: number;
  level: number; // 1-7 for water, 1-4 for lava
  type: number;  // 13=water, 14=lava
}

const MAX_UPDATES_PER_TICK = 20;

export class FluidSystem {
  private queue: FluidUpdate[] = [];
  private processed: Set<string> = new Set();
  private tickTimer = 0;
  private tickInterval = 0.4; // seconds between fluid ticks

  update(
    dt: number,
    getBlock: (x: number, y: number, z: number) => number,
    setBlock: (x: number, y: number, z: number, id: number) => void
  ) {
    this.tickTimer += dt;
    if (this.tickTimer < this.tickInterval) return;
    this.tickTimer = 0;

    // Process fluid updates
    let count = 0;
    const nextQueue: FluidUpdate[] = [];

    while (this.queue.length > 0 && count < MAX_UPDATES_PER_TICK) {
      const upd = this.queue.shift()!;
      const key = `${upd.x},${upd.y},${upd.z}`;
      if (this.processed.has(key)) continue;
      this.processed.add(key);
      count++;

      // Water (id 13) spreads
      if (upd.type === 13) {
        this.processWater(upd, getBlock, setBlock, nextQueue);
      }
      // Lava (id 14) spreads slower
      if (upd.type === 14) {
        this.processLava(upd, getBlock, setBlock, nextQueue);
      }
    }

    this.queue.push(...nextQueue);
    if (this.queue.length === 0) {
      this.processed.clear();
    }
  }

  /** Called when a water/lava block is placed. */
  addSource(x: number, y: number, z: number, type: number) {
    this.queue.push({ x, y, z, level: 7, type });
  }

  private processWater(
    upd: FluidUpdate,
    getBlock: (x: number, y: number, z: number) => number,
    setBlock: (x: number, y: number, z: number, id: number) => void,
    nextQueue: FluidUpdate[]
  ) {
    const dirs = [
      [0, -1, 0], // down (priority)
      [-1, 0, 0], [1, 0, 0], [0, 0, -1], [0, 0, 1], // horizontal
    ];

    // Flow down first
    if (getBlock(upd.x, upd.y - 1, upd.z) === 0) {
      setBlock(upd.x, upd.y - 1, upd.z, 13);
      nextQueue.push({ x: upd.x, y: upd.y - 1, z: upd.z, level: 7, type: 13 });
      return;
    }

    // Flow horizontally with decreasing level
    if (upd.level > 0) {
      for (const [dx, , dz] of [[-1, 0, 0], [1, 0, 0], [0, 0, -1], [0, 0, 1]] as [number, number, number][]) {
        const nx = upd.x + dx;
        const nz = upd.z + dz;
        const neighbor = getBlock(nx, upd.y, nz);

        if (neighbor === 0) {
          setBlock(nx, upd.y, nz, 13);
          nextQueue.push({ x: nx, y: upd.y, z: nz, level: upd.level - 1, type: 13 });
        }
      }
    }
  }

  private processLava(
    upd: FluidUpdate,
    getBlock: (x: number, y: number, z: number) => number,
    setBlock: (x: number, y: number, z: number, id: number) => void,
    nextQueue: FluidUpdate[]
  ) {
    // Lava flows slower and shorter distance
    if (getBlock(upd.x, upd.y - 1, upd.z) === 0) {
      setBlock(upd.x, upd.y - 1, upd.z, 14);
      nextQueue.push({ x: upd.x, y: upd.y - 1, z: upd.z, level: 4, type: 14 });
      return;
    }

    if (upd.level > 0) {
      for (const [dx, , dz] of [[-1, 0, 0], [1, 0, 0], [0, 0, -1], [0, 0, 1]] as [number, number, number][]) {
        const nx = upd.x + dx;
        const nz = upd.z + dz;
        const neighbor = getBlock(nx, upd.y, nz);

        if (neighbor === 0) {
          setBlock(nx, upd.y, nz, 14);
          nextQueue.push({ x: nx, y: upd.y, z: nz, level: upd.level - 1, type: 14 });
        }

        // Water + Lava = Cobblestone
        if (neighbor === 13 && upd.type === 14) {
          setBlock(nx, upd.y, nz, 4); // cobblestone
        }
        // Lava + Water = Obsidian (if source)
        if (neighbor === 14 && upd.type === 13) {
          // Simplified: just cobblestone
          setBlock(upd.x, upd.y, upd.z, 4);
        }
      }
    }
  }

  clear() {
    this.queue = [];
    this.processed.clear();
  }
}
