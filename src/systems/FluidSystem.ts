import { BlockRegistry } from '../world/BlockRegistry';
import type { BlockMetadata } from '../types';

interface Coord {
  x: number;
  y: number;
  z: number;
}

export class FluidSystem {
  private queue: Coord[] = [];
  private queuedKeys: Set<string> = new Set();
  private tickTimer = 0;
  private tickInterval = 0.25; // seconds between fluid ticks

  /** Called when a water/lava block is placed or updated. */
  addSource(x: number, y: number, z: number, type?: number) {
    this.enqueue(x, y, z);
    // Also enqueue neighbors to update immediately
    this.enqueue(x - 1, y, z);
    this.enqueue(x + 1, y, z);
    this.enqueue(x, y - 1, z);
    this.enqueue(x, y + 1, z);
    this.enqueue(x, y, z - 1);
    this.enqueue(x, y, z + 1);
  }

  private enqueue(x: number, y: number, z: number) {
    const key = `${x},${y},${z}`;
    if (!this.queuedKeys.has(key)) {
      this.queue.push({ x, y, z });
      this.queuedKeys.add(key);
    }
  }

  update(
    dt: number,
    getBlock: (x: number, y: number, z: number) => number,
    getBlockMeta: (x: number, y: number, z: number) => BlockMetadata | undefined,
    setBlock: (x: number, y: number, z: number, id: number) => void,
    setBlockMeta: (x: number, y: number, z: number, meta: BlockMetadata | null, markDirty?: boolean) => void
  ) {
    this.tickTimer += dt;
    if (this.tickTimer < this.tickInterval) return;
    this.tickTimer = 0;

    const maxProcess = Math.min(this.queue.length, 250);
    if (maxProcess === 0) return;

    // Pop coordinate batch
    const batch = this.queue.splice(0, maxProcess);
    for (const coord of batch) {
      const key = `${coord.x},${coord.y},${coord.z}`;
      this.queuedKeys.delete(key);
    }

    const nextQueue: Coord[] = [];
    const nextQueuedKeys: Set<string> = new Set();

    const enqueueNext = (nx: number, ny: number, nz: number) => {
      const key = `${nx},${ny},${nz}`;
      if (!this.queuedKeys.has(key) && !nextQueuedKeys.has(key)) {
        nextQueue.push({ x: nx, y: ny, z: nz });
        nextQueuedKeys.add(key);
      }
    };

    for (const { x, y, z } of batch) {
      const block = getBlock(x, y, z);
      const baseId = block & 0x3FF;

      const isWater = baseId === 8 || baseId === 9;
      const isLava = baseId === 10 || baseId === 11;
      const isAir = baseId === 0;

      // We only simulate fluids and air cells that fluids can flow into
      if (!isWater && !isLava && !isAir) continue;

      let fluidType: 'water' | 'lava' | null = null;
      let curL = 0; // 0 to 8
      let isSource = false;

      if (isWater) {
        fluidType = 'water';
        isSource = baseId === 9;
        const meta = getBlockMeta(x, y, z);
        curL = isSource ? 8 : (meta?.fluidLevel ?? 7);
      } else if (isLava) {
        fluidType = 'lava';
        isSource = baseId === 11;
        const meta = getBlockMeta(x, y, z);
        curL = isSource ? 8 : (meta?.fluidLevel ?? 4);
      }

      // Check fluid-fluid interaction first
      if (fluidType) {
        const reacted = this.handleFluidInteraction(x, y, z, fluidType, getBlock, setBlock);
        if (reacted) {
          // Block was transformed to solid (e.g. cobblestone/obsidian)
          enqueueNext(x, y - 1, z);
          enqueueNext(x, y + 1, z);
          enqueueNext(x - 1, y, z);
          enqueueNext(x + 1, y, z);
          enqueueNext(x, y, z - 1);
          enqueueNext(x, y, z + 1);
          continue;
        }
      }

      if (isSource) {
        // Source blocks are stable, just try to spread to neighbors
        this.spreadFromSource(x, y, z, fluidType!, getBlock, enqueueNext);
        continue;
      }

      // Flowing fluid or air block: calculate target state
      const result = this.calculateTargetLevel(x, y, z, getBlock, getBlockMeta);
      const tgtL = result.level;
      const tgtType = result.type;

      if (tgtL !== curL || (tgtL > 0 && tgtType !== fluidType)) {
        if (tgtL === 0) {
          // Dry up
          setBlock(x, y, z, 0);
          setBlockMeta(x, y, z, null);
        } else {
          // Flowing fluid update
          const flowId = tgtType === 'water' ? 8 : 10;
          const sourceId = tgtType === 'water' ? 9 : 11;
          const finalId = (tgtL === 8) ? sourceId : flowId;

          setBlock(x, y, z, finalId);
          setBlockMeta(x, y, z, { fluidLevel: tgtL }, true);
        }

        // Notify neighbors of state change
        enqueueNext(x, y - 1, z);
        enqueueNext(x, y + 1, z);
        enqueueNext(x - 1, y, z);
        enqueueNext(x + 1, y, z);
        enqueueNext(x, y, z - 1);
        enqueueNext(x, y, z + 1);
      } else if (tgtL > 0) {
        // State remains same, try to spread further
        this.spreadFromFlowing(x, y, z, tgtType, tgtL, getBlock, enqueueNext);
      }
    }

    // Re-enqueue for subsequent meta-ticks
    for (const coord of nextQueue) {
      this.enqueue(coord.x, coord.y, coord.z);
    }
  }

  private handleFluidInteraction(
    x: number, y: number, z: number,
    type: 'water' | 'lava',
    getBlock: (x: number, y: number, z: number) => number,
    setBlock: (x: number, y: number, z: number, id: number) => void
  ): boolean {
    const dirs = [[0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
    for (const [dx, dy, dz] of dirs) {
      const neighbor = getBlock(x + dx, y + dy, z + dz);
      const neighBase = neighbor & 0x3FF;

      if (type === 'water') {
        if (neighBase === 10 || neighBase === 11) {
          // Water + Lava source = Obsidian (49)
          // Water + Flowing Lava = Cobblestone (4)
          const isSource = neighBase === 11;
          setBlock(x + dx, y + dy, z + dz, isSource ? 49 : 4);
        }
      } else {
        if (neighBase === 8 || neighBase === 9) {
          // Lava + Water source/flowing = Stone (1) if flowing from above, otherwise Cobblestone (4)
          const isTop = dy === -1; // water neighbor is below lava
          setBlock(x, y, z, isTop ? 1 : 4);
          return true; // we are transformed, stop processing
        }
      }
    }
    return false;
  }

  private calculateTargetLevel(
    x: number, y: number, z: number,
    getBlock: (x: number, y: number, z: number) => number,
    getBlockMeta: (x: number, y: number, z: number) => BlockMetadata | undefined
  ): { level: number; type: 'water' | 'lava' } {
    // 1. Flow down from above first
    const aboveId = getBlock(x, y + 1, z) & 0x3FF;
    if (aboveId === 8 || aboveId === 9) {
      return { level: 8, type: 'water' };
    }
    if (aboveId === 10 || aboveId === 11) {
      return { level: 8, type: 'lava' };
    }

    // 2. Flow horizontally from neighbors
    let maxWaterL = 0;
    let maxLavaL = 0;
    let sourceWaterCount = 0;

    const dirs = [[-1, 0, 0], [1, 0, 0], [0, 0, -1], [0, 0, 1]];
    for (const [dx, , dz] of dirs) {
      const id = getBlock(x + dx, y, z + dz);
      const baseId = id & 0x3FF;
      const meta = getBlockMeta(x + dx, y, z + dz);

      if (baseId === 8 || baseId === 9) {
        const lvl = baseId === 9 ? 8 : (meta?.fluidLevel ?? 1);
        if (lvl > maxWaterL) maxWaterL = lvl;
        if (lvl === 8) sourceWaterCount++;
      } else if (baseId === 10 || baseId === 11) {
        const lvl = baseId === 11 ? 8 : (meta?.fluidLevel ?? 1);
        if (lvl > maxLavaL) maxLavaL = lvl;
      }
    }

    let waterTgt = Math.max(0, maxWaterL - 1);
    let lavaTgt = Math.max(0, maxLavaL - 2); // Lava flows shorter (4 blocks max) in Overworld

    // 3. Infinite water source rule (only for water)
    if (sourceWaterCount >= 2) {
      const belowId = getBlock(x, y - 1, z) & 0x3FF;
      const belowSolid = BlockRegistry.isSolid(getBlock(x, y - 1, z));
      const belowWater = belowId === 8 || belowId === 9;
      if (belowSolid || belowWater) {
        waterTgt = 8;
      }
    }

    if (waterTgt >= lavaTgt && waterTgt > 0) {
      return { level: waterTgt, type: 'water' };
    } else if (lavaTgt > 0) {
      return { level: lavaTgt, type: 'lava' };
    }

    return { level: 0, type: 'water' };
  }

  private spreadFromSource(
    x: number, y: number, z: number,
    type: 'water' | 'lava',
    getBlock: (x: number, y: number, z: number) => number,
    enqueueNext: (nx: number, ny: number, nz: number) => void
  ) {
    // Flow down
    const belowId = getBlock(x, y - 1, z) & 0x3FF;
    if (belowId === 0 || BlockRegistry.isFluid(belowId)) {
      enqueueNext(x, y - 1, z);
    }

    // Flow horizontally
    const dirs = [[-1, 0, 0], [1, 0, 0], [0, 0, -1], [0, 0, 1]];
    for (const [dx, , dz] of dirs) {
      const id = getBlock(x + dx, y, z + dz) & 0x3FF;
      if (id === 0 || BlockRegistry.isFluid(id)) {
        enqueueNext(x + dx, y, z + dz);
      }
    }
  }

  private spreadFromFlowing(
    x: number, y: number, z: number,
    type: 'water' | 'lava',
    level: number,
    getBlock: (x: number, y: number, z: number) => number,
    enqueueNext: (nx: number, ny: number, nz: number) => void
  ) {
    // Flow down
    const belowId = getBlock(x, y - 1, z) & 0x3FF;
    if (belowId === 0 || BlockRegistry.isFluid(belowId)) {
      enqueueNext(x, y - 1, z);
      return;
    }

    // Flow horizontally
    const step = type === 'water' ? 1 : 2;
    if (level > step) {
      const dirs = [[-1, 0, 0], [1, 0, 0], [0, 0, -1], [0, 0, 1]];
      for (const [dx, , dz] of dirs) {
        const id = getBlock(x + dx, y, z + dz) & 0x3FF;
        if (id === 0 || BlockRegistry.isFluid(id)) {
          enqueueNext(x + dx, y, z + dz);
        }
      }
    }
  }

  clear() {
    this.queue = [];
    this.queuedKeys.clear();
  }
}
