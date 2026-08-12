import { WORLD_HEIGHT } from '../constants';
import { BlockRegistry } from '../world/BlockRegistry';
import type { BlockMetadata } from '../types';

export interface FluidTickPosition {
  x: number;
  y: number;
  z: number;
}

export interface FluidTickAccess {
  getBlock(x: number, y: number, z: number): number;
  getBlockMeta(x: number, y: number, z: number): BlockMetadata | undefined;
  setBlock(x: number, y: number, z: number, id: number): void;
  setBlockMeta(x: number, y: number, z: number, meta: BlockMetadata | null, markDirty?: boolean): void;
}

export interface FluidTickResult {
  changed: boolean;
  next: FluidTickPosition[];
  delayTicks: number;
}

/** Stateless fluid rules. Pending work lives in the shared world TickScheduler. */
export class FluidSystem {
  processTick(x: number, y: number, z: number, access: FluidTickAccess): FluidTickResult {
    if (y < 0 || y >= WORLD_HEIGHT) return { changed: false, next: [], delayTicks: 5 };

    const next = new Map<string, FluidTickPosition>();
    const enqueueNext = (nx: number, ny: number, nz: number) => {
      if (ny < 0 || ny >= WORLD_HEIGHT) return;
      const position = { x: Math.floor(nx), y: Math.floor(ny), z: Math.floor(nz) };
      next.set(`${position.x},${position.y},${position.z}`, position);
    };
    let changed = false;
    const setBlock = (sx: number, sy: number, sz: number, id: number) => {
      if (access.getBlock(sx, sy, sz) === id) return;
      access.setBlock(sx, sy, sz, id);
      changed = true;
    };

    const block = access.getBlock(x, y, z);
    const baseId = block & 0x3FF;
    const isWater = baseId === 8 || baseId === 9;
    const isLava = baseId === 10 || baseId === 11;
    const isAir = baseId === 0;
    if (!isWater && !isLava && !isAir) return { changed: false, next: [], delayTicks: 5 };

    let fluidType: 'water' | 'lava' | null = null;
    let currentLevel = 0;
    let isSource = false;

    if (isWater) {
      fluidType = 'water';
      isSource = baseId === 9;
      currentLevel = isSource ? 8 : (access.getBlockMeta(x, y, z)?.fluidLevel ?? 7);
    } else if (isLava) {
      fluidType = 'lava';
      isSource = baseId === 11;
      currentLevel = isSource ? 8 : (access.getBlockMeta(x, y, z)?.fluidLevel ?? 4);
    }

    if (fluidType) {
      const reacted = this.handleFluidInteraction(x, y, z, fluidType, access.getBlock, setBlock);
      if (reacted) {
        this.enqueueNeighbors(x, y, z, enqueueNext);
        return {
          changed,
          next: Array.from(next.values()),
          delayTicks: fluidType === 'lava' ? 10 : 5,
        };
      }
    }

    if (isSource) {
      this.spreadFromSource(x, y, z, access.getBlock, enqueueNext);
      return {
        changed,
        next: Array.from(next.values()),
        delayTicks: fluidType === 'lava' ? 10 : 5,
      };
    }

    const target = this.calculateTargetLevel(x, y, z, access.getBlock, access.getBlockMeta);
    if (target.level !== currentLevel || (target.level > 0 && target.type !== fluidType)) {
      if (target.level === 0) {
        setBlock(x, y, z, 0);
        access.setBlockMeta(x, y, z, null);
      } else {
        const flowId = target.type === 'water' ? 8 : 10;
        const sourceId = target.type === 'water' ? 9 : 11;
        setBlock(x, y, z, target.level === 8 ? sourceId : flowId);
        access.setBlockMeta(x, y, z, { fluidLevel: target.level }, true);
      }
      this.enqueueNeighbors(x, y, z, enqueueNext);
    } else if (target.level > 0) {
      this.spreadFromFlowing(x, y, z, target.type, target.level, access.getBlock, enqueueNext);
    }

    return {
      changed,
      next: Array.from(next.values()),
      delayTicks: target.type === 'lava' ? 10 : 5,
    };
  }

  private enqueueNeighbors(
    x: number,
    y: number,
    z: number,
    enqueue: (x: number, y: number, z: number) => void,
  ) {
    enqueue(x, y - 1, z);
    enqueue(x, y + 1, z);
    enqueue(x - 1, y, z);
    enqueue(x + 1, y, z);
    enqueue(x, y, z - 1);
    enqueue(x, y, z + 1);
  }

  private handleFluidInteraction(
    x: number,
    y: number,
    z: number,
    type: 'water' | 'lava',
    getBlock: (x: number, y: number, z: number) => number,
    setBlock: (x: number, y: number, z: number, id: number) => void,
  ): boolean {
    const directions = [[0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
    for (const [dx, dy, dz] of directions) {
      const neighborBaseId = getBlock(x + dx, y + dy, z + dz) & 0x3FF;
      if (type === 'water' && (neighborBaseId === 10 || neighborBaseId === 11)) {
        setBlock(x + dx, y + dy, z + dz, neighborBaseId === 11 ? 49 : 4);
      } else if (type === 'lava' && (neighborBaseId === 8 || neighborBaseId === 9)) {
        setBlock(x, y, z, dy === -1 ? 1 : 4);
        return true;
      }
    }
    return false;
  }

  private calculateTargetLevel(
    x: number,
    y: number,
    z: number,
    getBlock: (x: number, y: number, z: number) => number,
    getBlockMeta: (x: number, y: number, z: number) => BlockMetadata | undefined,
  ): { level: number; type: 'water' | 'lava' } {
    const aboveId = getBlock(x, y + 1, z) & 0x3FF;
    if (aboveId === 8 || aboveId === 9) return { level: 8, type: 'water' };
    if (aboveId === 10 || aboveId === 11) return { level: 8, type: 'lava' };

    let maxWaterLevel = 0;
    let maxLavaLevel = 0;
    let sourceWaterCount = 0;
    const directions = [[-1, 0, 0], [1, 0, 0], [0, 0, -1], [0, 0, 1]];
    for (const [dx, , dz] of directions) {
      const id = getBlock(x + dx, y, z + dz);
      const baseId = id & 0x3FF;
      const metadata = getBlockMeta(x + dx, y, z + dz);
      if (baseId === 8 || baseId === 9) {
        const level = baseId === 9 ? 8 : (metadata?.fluidLevel ?? 1);
        maxWaterLevel = Math.max(maxWaterLevel, level);
        if (level === 8) sourceWaterCount++;
      } else if (baseId === 10 || baseId === 11) {
        const level = baseId === 11 ? 8 : (metadata?.fluidLevel ?? 1);
        maxLavaLevel = Math.max(maxLavaLevel, level);
      }
    }

    let waterTarget = Math.max(0, maxWaterLevel - 1);
    const lavaTarget = Math.max(0, maxLavaLevel - 2);
    if (sourceWaterCount >= 2) {
      const belowId = getBlock(x, y - 1, z) & 0x3FF;
      if (BlockRegistry.isSolid(getBlock(x, y - 1, z)) || belowId === 8 || belowId === 9) {
        waterTarget = 8;
      }
    }

    if (waterTarget >= lavaTarget && waterTarget > 0) return { level: waterTarget, type: 'water' };
    if (lavaTarget > 0) return { level: lavaTarget, type: 'lava' };
    return { level: 0, type: 'water' };
  }

  private spreadFromSource(
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
  }

  private spreadFromFlowing(
    x: number,
    y: number,
    z: number,
    type: 'water' | 'lava',
    level: number,
    getBlock: (x: number, y: number, z: number) => number,
    enqueueNext: (x: number, y: number, z: number) => void,
  ) {
    const belowId = getBlock(x, y - 1, z) & 0x3FF;
    if (belowId === 0 || BlockRegistry.isFluid(belowId)) {
      enqueueNext(x, y - 1, z);
      return;
    }
    const step = type === 'water' ? 1 : 2;
    if (level <= step) return;
    for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const id = getBlock(x + dx, y, z + dz) & 0x3FF;
      if (id === 0 || BlockRegistry.isFluid(id)) enqueueNext(x + dx, y, z + dz);
    }
  }
}
