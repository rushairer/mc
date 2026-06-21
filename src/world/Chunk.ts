import * as THREE from 'three';
import { CHUNK_SIZE, WORLD_HEIGHT } from '../constants';
import { BlockRegistry } from './BlockRegistry';
import { VisualResolver } from '../visual/VisualResolver';
import type { BlockMetadata, ChunkMeshData, SerializedBlockMetadata } from '../types';
import { BiomeType } from './WorldGen';
// Biome Grass Colors
const BIOME_GRASS_COLORS: Record<number, [number, number, number]> = {
  [BiomeType.Plains]: [0.57, 0.76, 0.34],
  [BiomeType.Desert]: [0.75, 0.72, 0.33],
  [BiomeType.Mountains]: [0.54, 0.72, 0.42],
  [BiomeType.Forest]: [0.47, 0.75, 0.35],
  [BiomeType.Snow]: [0.50, 0.70, 0.59],
  [BiomeType.Ocean]: [0.42, 0.64, 0.38],
  [BiomeType.Swamp]: [0.41, 0.44, 0.22],
  [BiomeType.Jungle]: [0.35, 0.78, 0.24],
  [BiomeType.River]: [0.47, 0.76, 0.28],
  [BiomeType.MushroomIsland]: [0.33, 0.79, 0.24],
  [BiomeType.Badlands]: [0.56, 0.51, 0.30],
};

// Biome Leaves Colors
const BIOME_LEAVES_COLORS: Record<number, [number, number, number]> = {
  [BiomeType.Plains]: [0.47, 0.76, 0.28],
  [BiomeType.Desert]: [0.75, 0.72, 0.33],
  [BiomeType.Mountains]: [0.54, 0.72, 0.42],
  [BiomeType.Forest]: [0.47, 0.75, 0.35],
  [BiomeType.Snow]: [0.50, 0.70, 0.59],
  [BiomeType.Ocean]: [0.42, 0.64, 0.38],
  [BiomeType.Swamp]: [0.41, 0.44, 0.22],
  [BiomeType.Jungle]: [0.35, 0.78, 0.24],
  [BiomeType.River]: [0.47, 0.76, 0.28],
  [BiomeType.MushroomIsland]: [0.33, 0.79, 0.24],
  [BiomeType.Badlands]: [0.56, 0.51, 0.30],
};

function getBlockType(blockId: number): number {
  const baseId = blockId & 0x3FF;
  if (baseId === 8 || baseId === 9) return 1; // Water
  if (baseId === 10 || baseId === 11) return 2; // Lava
  if (baseId === 90 || baseId === 119) return 3; // Portal
  return 0; // Normal
}

export class Chunk {
  data: Uint16Array;
  metadata: Map<number, BlockMetadata> = new Map();
  skyLight: Uint8Array;
  blockLight: Uint8Array;
  mesh: THREE.Mesh | null = null;
  transparentMesh: THREE.Mesh | null = null;
  dirty = true;
  lightDirty = true;
  cx: number;
  cz: number;

  constructor(cx: number, cz: number) {
    this.cx = cx;
    this.cz = cz;
    this.data = new Uint16Array(CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT);
    this.skyLight = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT);
    this.blockLight = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT);
  }

  getIndex(x: number, y: number, z: number): number {
    return x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
  }

  getBlock(x: number, y: number, z: number): number {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= WORLD_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
      return 0;
    }
    return this.data[this.getIndex(x, y, z)];
  }

  setBlock(x: number, y: number, z: number, id: number) {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= WORLD_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
      return;
    }
    const index = this.getIndex(x, y, z);
    const previousId = this.data[index];
    this.data[index] = id;
    if (id === 0 || id !== previousId) {
      this.metadata.delete(index);
    }
    this.dirty = true;
  }

  getBlockMeta(x: number, y: number, z: number): BlockMetadata | undefined {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= WORLD_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
      return undefined;
    }
    return this.metadata.get(this.getIndex(x, y, z));
  }

  setBlockMeta(x: number, y: number, z: number, metadata: BlockMetadata | null, markDirty = false) {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= WORLD_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
      return;
    }
    const index = this.getIndex(x, y, z);
    if (metadata && Object.keys(metadata).length > 0) {
      this.metadata.set(index, { ...metadata });
    } else {
      this.metadata.delete(index);
    }
    if (markDirty) {
      this.dirty = true;
    }
  }

  serializeMetadata(): SerializedBlockMetadata[] {
    return Array.from(this.metadata.entries()).map(([index, metadata]) => ({
      index,
      metadata: { ...metadata },
    }));
  }

  restoreMetadata(serialized?: SerializedBlockMetadata[]) {
    this.metadata.clear();
    if (!serialized) return;

    const maxIndex = CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT;
    for (const entry of serialized) {
      if (!entry || entry.index < 0 || entry.index >= maxIndex || !entry.metadata) continue;
      if (this.data[entry.index] === 0) continue;
      this.metadata.set(entry.index, { ...entry.metadata });
    }
    this.dirty = true;
  }

  // ─── Light computation ───

  /**
   * Compute sky light for this chunk. Sky light (15) propagates straight down
   * from the top of the world through transparent blocks. Once it hits an
   * opaque block, BFS spreads laterally with -1 per step.
   */
  computeSkyLight(
    getNeighborBlock: (wx: number, wy: number, wz: number) => number
  ) {
    this.skyLight.fill(0);
    const propagated: Array<[number, number, number]> = [];

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
          const id = this.getBlock(x, y, z);
          if (!BlockRegistry.isTransparent(id)) break;
          this.skyLight[this.getIndex(x, y, z)] = 15;
          propagated.push([x, y, z]);
        }
      }
    }

    // BFS for sideways spread from all lit positions
    const dirs: [number, number, number][] = [
      [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0],
    ];
    let head = 0;
    while (head < propagated.length) {
      const [cx, cy, cz] = propagated[head++];
      const val = this.skyLight[this.getIndex(cx, cy, cz)];
      if (val <= 1) continue;
      for (const [dx, dy, dz] of dirs) {
        const nx = cx + dx;
        const ny = cy + dy;
        const nz = cz + dz;
        if (ny < 0 || ny >= WORLD_HEIGHT) continue;
        if (nx >= 0 && nx < CHUNK_SIZE && nz >= 0 && nz < CHUNK_SIZE) {
          const ni = this.getIndex(nx, ny, nz);
          if (!BlockRegistry.isTransparent(this.data[ni])) continue;
          if (this.skyLight[ni] < val - 1) {
            this.skyLight[ni] = val - 1;
            propagated.push([nx, ny, nz]);
          }
        }
      }
    }

    this.lightDirty = false;
  }

  /**
   * Compute block light from emissive blocks in this chunk.
   * BFS from all luminance>0 sources, -1 per step.
   * Returns positions that spilled to neighboring chunks so
   * ChunkManager can propagate them further.
   */
  computeBlockLight(): Array<[number, number, number, number]> {
    this.blockLight.fill(0);
    const seeds: Array<[number, number, number]> = [];

    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const id = this.getBlock(x, y, z);
          if (id === 0) continue;
          const lum = BlockRegistry.getLuminance(id);
          if (lum > 0) {
            this.blockLight[this.getIndex(x, y, z)] = lum;
            seeds.push([x, y, z]);
          }
        }
      }
    }

    this.floodFillBlockLight(seeds);
    return this.getLightBorderSpillover();
  }

  private floodFillBlockLight(seeds: Array<[number, number, number]>) {
    const dirs: [number, number, number][] = [
      [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0],
    ];
    let head = 0;
    while (head < seeds.length) {
      const [cx, cy, cz] = seeds[head++];
      const val = this.blockLight[this.getIndex(cx, cy, cz)];
      if (val <= 1) continue;
      for (const [dx, dy, dz] of dirs) {
        const nx = cx + dx;
        const ny = cy + dy;
        const nz = cz + dz;
        if (ny < 0 || ny >= WORLD_HEIGHT) continue;
        if (nx >= 0 && nx < CHUNK_SIZE && nz >= 0 && nz < CHUNK_SIZE) {
          const ni = this.getIndex(nx, ny, nz);
          if (!BlockRegistry.isTransparent(this.data[ni])) continue;
          if (this.blockLight[ni] < val - 1) {
            this.blockLight[ni] = val - 1;
            seeds.push([nx, ny, nz]);
          }
        }
      }
    }
  }

  /** Return border positions where block light spills into neighbors. */
  private getLightBorderSpillover(): Array<[number, number, number, number]> {
    const spillover: Array<[number, number, number, number]> = [];
    const wx0 = this.cx * CHUNK_SIZE;
    const wz0 = this.cz * CHUNK_SIZE;

    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let i = 0; i < CHUNK_SIZE; i++) {
        const blNegX = this.blockLight[this.getIndex(0, y, i)];
        if (blNegX > 1) spillover.push([wx0 - 1, y, wz0 + i, blNegX - 1]);

        const blPosX = this.blockLight[this.getIndex(CHUNK_SIZE - 1, y, i)];
        if (blPosX > 1) spillover.push([wx0 + CHUNK_SIZE, y, wz0 + i, blPosX - 1]);

        const blNegZ = this.blockLight[this.getIndex(i, y, 0)];
        if (blNegZ > 1) spillover.push([wx0 + i, y, wz0 - 1, blNegZ - 1]);

        const blPosZ = this.blockLight[this.getIndex(i, y, CHUNK_SIZE - 1)];
        if (blPosZ > 1) spillover.push([wx0 + i, y, wz0 + CHUNK_SIZE, blPosZ - 1]);
      }
    }
    return spillover;
  }

  /** Get combined light at local coords (max of sky + block light). */
  getLightAt(x: number, y: number, z: number): number {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= WORLD_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
      return 15;
    }
    const idx = this.getIndex(x, y, z);
    return Math.max(this.skyLight[idx], this.blockLight[idx]);
  }

  getSkyLightAt(x: number, y: number, z: number): number {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= WORLD_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
      return 15;
    }
    const idx = this.getIndex(x, y, z);
    return this.skyLight[idx];
  }

  getBlockLightAt(x: number, y: number, z: number): number {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= WORLD_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
      return 0;
    }
    const idx = this.getIndex(x, y, z);
    return this.blockLight[idx];
  }

  getAdjustedBrightness(skyLight: number, blockLight: number, timeOfDay: number): number {
    const sunAngle = timeOfDay * Math.PI * 2;
    const sunY = Math.sin(sunAngle);
    
    // Map negative sun angle (nighttime) to a sky light decrement (0 to 14)
    const decrement = sunY >= 0 ? 0 : Math.round(-sunY * 14);
    
    const adjustedSkyLight = Math.max(0, skyLight - decrement);
    const combinedLight = Math.max(adjustedSkyLight, blockLight);
    
    // Non-linear Minecraft light curve (cubic) to make dark levels drop off quickly
    return Math.pow(combinedLight / 15, 3.0);
  }

  /**
   * Build optimized mesh using greedy meshing.
   * getNeighborBlock: (wx, wy, wz) => blockId for cross-chunk lookups
   * getNeighborSkyLight: (wx, wy, wz) => sky light level 0-15
   * getNeighborBlockLight: (wx, wy, wz) => block light level 0-15
   * timeOfDay: 0..1 day cycle for sky light brightness modulation
   */
  buildMesh(
    atlas: { getUV(key: string): { u0: number; v0: number; u1: number; v1: number } },
    getNeighborBlock: (wx: number, wy: number, wz: number) => number,
    getNeighborSkyLight: (wx: number, wy: number, wz: number) => number,
    getNeighborBlockLight: (wx: number, wy: number, wz: number) => number,
    timeOfDay: number = 0.25,
    getBiome?: (wx: number, wz: number) => number
  ): { solidGeo: THREE.BufferGeometry; transparentGeo: THREE.BufferGeometry } {
    const solid: ChunkMeshData = { positions: [], normals: [], uvs: [], indices: [], colors: [], blockTypes: [] };
    const transparent: ChunkMeshData = { positions: [], normals: [], uvs: [], indices: [], colors: [], blockTypes: [] };

    const worldX = this.cx * CHUNK_SIZE;
    const worldZ = this.cz * CHUNK_SIZE;

    // For each block in chunk
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const id = this.getBlock(x, y, z);
          if (id === 0) continue;

          const biome = getBiome ? getBiome(worldX + x, worldZ + z) : 0;

          const def = BlockRegistry.get(id);
          if (!def) continue;

          const meta = this.getBlockMeta(x, y, z);

          const isTrans = def.transparent;
          const isTranslucent = BlockRegistry.isFluid(id) || (id & 0x3FF) === 79 || (id & 0x3FF) === 20;
          const target = isTranslucent ? transparent : solid;

          if (BlockRegistry.isTorch(id)) {
            const skyLight = this.getSkyLightAt(x, y, z);
            const blockLight = this.getBlockLightAt(x, y, z);
            const lightBrightness = this.getAdjustedBrightness(skyLight, blockLight, timeOfDay);
            this.addTorch(target, x, y, z, atlas, lightBrightness);
            continue;
          }

          if (def.name.endsWith('door') && !def.name.includes('trapdoor')) {
            const skyLight = this.getSkyLightAt(x, y, z);
            const blockLight = this.getBlockLightAt(x, y, z);
            const lightBrightness = this.getAdjustedBrightness(skyLight, blockLight, timeOfDay);
            this.addDoor(target, x, y, z, id, meta, atlas, lightBrightness);
            continue;
          }

          if (def.name.includes('trapdoor')) {
            const skyLight = this.getSkyLightAt(x, y, z);
            const blockLight = this.getBlockLightAt(x, y, z);
            const lightBrightness = this.getAdjustedBrightness(skyLight, blockLight, timeOfDay);
            this.addTrapdoor(target, x, y, z, id, meta, atlas, lightBrightness);
            continue;
          }

          // Slabs
          if (def.name.includes('slab') && !def.name.includes('double')) {
            const skyLight = this.getSkyLightAt(x, y, z);
            const blockLight = this.getBlockLightAt(x, y, z);
            const lightBrightness = this.getAdjustedBrightness(skyLight, blockLight, timeOfDay);
            const isTop = meta?.slabHalf === 'top';
            const bounds: CuboidBounds = isTop
              ? { minX: 0, maxX: 1, minY: 0.5, maxY: 1, minZ: 0, maxZ: 1 }
              : { minX: 0, maxX: 1, minY: 0, maxY: 0.5, minZ: 0, maxZ: 1 };
            this.addCuboid(target, x, y, z, id, atlas, bounds, {}, undefined, false, lightBrightness, biome);
            continue;
          }

          // Stairs
          if (def.name.includes('stairs')) {
            const skyLight = this.getSkyLightAt(x, y, z);
            const blockLight = this.getBlockLightAt(x, y, z);
            const lightBrightness = this.getAdjustedBrightness(skyLight, blockLight, timeOfDay);
            this.addStair(target, x, y, z, id, meta, atlas, lightBrightness);
            continue;
          }

          // Repeaters and Comparators
          if (def.name.includes('repeater') || def.name.includes('comparator')) {
            const skyLight = this.getSkyLightAt(x, y, z);
            const blockLight = this.getBlockLightAt(x, y, z);
            const lightBrightness = this.getAdjustedBrightness(skyLight, blockLight, timeOfDay);
            const bounds: CuboidBounds = {
              minX: 0, maxX: 1,
              minY: 0, maxY: 0.125,
              minZ: 0, maxZ: 1
            };
            this.addCuboid(target, x, y, z, id, atlas, bounds, {}, undefined, false, lightBrightness, biome, meta);
            continue;
          }

          // Bed Block
          if ((id & 0x3FF) === 26 || def.name === 'bed') {
            const skyLight = this.getSkyLightAt(x, y, z);
            const blockLight = this.getBlockLightAt(x, y, z);
            const lightBrightness = this.getAdjustedBrightness(skyLight, blockLight, timeOfDay);
            const bounds: CuboidBounds = {
              minX: 0, maxX: 1,
              minY: 0, maxY: 0.5625,
              minZ: 0, maxZ: 1
            };
            this.addCuboid(target, x, y, z, id, atlas, bounds, {}, undefined, false, lightBrightness, biome, meta);
            continue;
          }

          // Extended Piston Base
          if ((id & 0x3FF) === 33 || (id & 0x3FF) === 29 || def.name === 'piston' || def.name === 'sticky_piston') {
            const isExtended = meta?.extended === true;
            if (isExtended) {
              const skyLight = this.getSkyLightAt(x, y, z);
              const blockLight = this.getBlockLightAt(x, y, z);
              const lightBrightness = this.getAdjustedBrightness(skyLight, blockLight, timeOfDay);
              
              const facing = meta?.facing ?? 'north';
              let bounds: CuboidBounds;
              if (facing === 'up') bounds = { minX: 0, maxX: 1, minY: 0, maxY: 0.75, minZ: 0, maxZ: 1 };
              else if (facing === 'down') bounds = { minX: 0, maxX: 1, minY: 0.25, maxY: 1, minZ: 0, maxZ: 1 };
              else if (facing === 'north') bounds = { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0.25, maxZ: 1 };
              else if (facing === 'south') bounds = { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 0.75 };
              else if (facing === 'west') bounds = { minX: 0.25, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 1 };
              else bounds = { minX: 0, maxX: 0.75, minY: 0, maxY: 1, minZ: 0, maxZ: 1 }; // east
              
              this.addCuboid(target, x, y, z, id, atlas, bounds, {}, undefined, false, lightBrightness, biome, meta);
              continue;
            }
          }

          // Piston Head
          if ((id & 0x3FF) === 34 || def.name === 'piston_head') {
            const skyLight = this.getSkyLightAt(x, y, z);
            const blockLight = this.getBlockLightAt(x, y, z);
            const lightBrightness = this.getAdjustedBrightness(skyLight, blockLight, timeOfDay);
            
            const facing = meta?.facing ?? 'north';
            const isSticky = meta?.sticky === true;
            
            // 1. Plate bounds (4/16ths thick at the facing end)
            let plateBounds: CuboidBounds;
            if (facing === 'up') plateBounds = { minX: 0, maxX: 1, minY: 0.75, maxY: 1, minZ: 0, maxZ: 1 };
            else if (facing === 'down') plateBounds = { minX: 0, maxX: 1, minY: 0, maxY: 0.25, minZ: 0, maxZ: 1 };
            else if (facing === 'north') plateBounds = { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 0.25 };
            else if (facing === 'south') plateBounds = { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0.75, maxZ: 1 };
            else if (facing === 'west') plateBounds = { minX: 0, maxX: 0.25, minY: 0, maxY: 1, minZ: 0, maxZ: 1 };
            else plateBounds = { minX: 0.75, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 1 }; // east

            // 2. Shaft bounds (4/16ths thick, centered, spanning from base to plate)
            let shaftBounds: CuboidBounds;
            if (facing === 'up' || facing === 'down') {
              shaftBounds = { minX: 0.375, maxX: 0.625, minY: facing === 'up' ? 0 : 0.25, maxY: facing === 'up' ? 0.75 : 1, minZ: 0.375, maxZ: 0.625 };
            } else if (facing === 'north' || facing === 'south') {
              shaftBounds = { minX: 0.375, maxX: 0.625, minY: 0.375, maxY: 0.625, minZ: facing === 'north' ? 0.25 : 0, maxZ: facing === 'north' ? 1 : 0.75 };
            } else { // east or west
              shaftBounds = { minX: facing === 'west' ? 0.25 : 0, maxX: facing === 'west' ? 1 : 0.75, minY: 0.375, maxY: 0.625, minZ: 0.375, maxZ: 0.625 };
            }
            
            // Draw plate
            this.addCuboid(target, x, y, z, id, atlas, plateBounds, {}, undefined, false, lightBrightness, biome, meta);
            // Draw shaft
            this.addCuboid(target, x, y, z, id, atlas, shaftBounds, {}, undefined, false, lightBrightness, biome, meta);
            continue;
          }

          // Pressure plates
          if (def.name.includes('pressure_plate')) {
            const skyLight = this.getSkyLightAt(x, y, z);
            const blockLight = this.getBlockLightAt(x, y, z);
            const lightBrightness = this.getAdjustedBrightness(skyLight, blockLight, timeOfDay);
            const isPressed = (id >> 10) === 1;
            const height = isPressed ? 0.03 : 0.06;
            const bounds: CuboidBounds = {
              minX: 0.0625, maxX: 0.9375,
              minY: 0, maxY: height,
              minZ: 0.0625, maxZ: 0.9375
            };
            this.addCuboid(target, x, y, z, id, atlas, bounds, {}, undefined, false, lightBrightness, biome);
            continue;
          }

          // Tripwire (String)
          if (def.name === 'tripwire') {
            const skyLight = this.getSkyLightAt(x, y, z);
            const blockLight = this.getBlockLightAt(x, y, z);
            const lightBrightness = this.getAdjustedBrightness(skyLight, blockLight, timeOfDay);
            const bounds: CuboidBounds = {
              minX: 0.4, maxX: 0.6,
              minY: 0.05, maxY: 0.07,
              minZ: 0.4, maxZ: 0.6
            };
            this.addCuboid(target, x, y, z, id, atlas, bounds, {}, undefined, false, lightBrightness, biome);
            continue;
          }

          // Tripwire Hook
          if (def.name === 'tripwire_hook') {
            const skyLight = this.getSkyLightAt(x, y, z);
            const blockLight = this.getBlockLightAt(x, y, z);
            const lightBrightness = this.getAdjustedBrightness(skyLight, blockLight, timeOfDay);
            const meta = id >> 10;
            const facingIndex = meta & 3; // 0: south, 1: west, 2: north, 3: east
            
            let bounds: CuboidBounds;
            if (facingIndex === 0) { // south (attached to north wall)
              bounds = { minX: 0.375, maxX: 0.625, minY: 0.2, maxY: 0.7, minZ: 0, maxZ: 0.25 };
            } else if (facingIndex === 1) { // west (attached to east wall)
              bounds = { minX: 0.75, maxX: 1, minY: 0.2, maxY: 0.7, minZ: 0.375, maxZ: 0.625 };
            } else if (facingIndex === 2) { // north (attached to south wall)
              bounds = { minX: 0.375, maxX: 0.625, minY: 0.2, maxY: 0.7, minZ: 0.75, maxZ: 1 };
            } else { // east (attached to west wall)
              bounds = { minX: 0, maxX: 0.25, minY: 0.2, maxY: 0.7, minZ: 0.375, maxZ: 0.625 };
            }
            this.addCuboid(target, x, y, z, id, atlas, bounds, {}, undefined, false, lightBrightness, biome);
            continue;
          }

          // Fences & walls
          if (def.name.includes('fence') || def.name.includes('wall')) {
            const skyLight = this.getSkyLightAt(x, y, z);
            const blockLight = this.getBlockLightAt(x, y, z);
            const lightBrightness = this.getAdjustedBrightness(skyLight, blockLight, timeOfDay);
            this.addFence(target, x, y, z, id, meta, atlas, lightBrightness, getNeighborBlock, worldX, worldZ);
            continue;
          }

                  // Lily Pad
          if (def.name === 'waterlily') {
            const skyLight = this.getSkyLightAt(x, y, z);
            const blockLight = this.getBlockLightAt(x, y, z);
            const lightBrightness = this.getAdjustedBrightness(skyLight, blockLight, timeOfDay);
            const bounds = { minX: 0, maxX: 1, minY: 0, maxY: 0.015, minZ: 0, maxZ: 1 };
            this.addCuboid(target, x, y, z, id, atlas, bounds, {}, undefined, false, lightBrightness, biome);
            continue;
          }

          // Ladder
          if (def.name === 'ladder') {
            const skyLight = this.getSkyLightAt(x, y, z);
            const blockLight = this.getBlockLightAt(x, y, z);
            const lightBrightness = this.getAdjustedBrightness(skyLight, blockLight, timeOfDay);
            this.addLadder(target, x, y, z, id, meta, atlas, lightBrightness);
            continue;
          }

          // Vines
          if (def.name === 'vine') {
            const skyLight = this.getSkyLightAt(x, y, z);
            const blockLight = this.getBlockLightAt(x, y, z);
            const lightBrightness = this.getAdjustedBrightness(skyLight, blockLight, timeOfDay);
            
            let attached = false;
            if (BlockRegistry.isSolid(getNeighborBlock(worldX + x, y, worldZ + z - 1))) {
              this.addCuboid(target, x, y, z, id, atlas, { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 0.015 }, {}, undefined, false, lightBrightness, biome);
              attached = true;
            }
            if (BlockRegistry.isSolid(getNeighborBlock(worldX + x, y, worldZ + z + 1))) {
              this.addCuboid(target, x, y, z, id, atlas, { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0.985, maxZ: 1 }, {}, undefined, false, lightBrightness, biome);
              attached = true;
            }
            if (BlockRegistry.isSolid(getNeighborBlock(worldX + x - 1, y, worldZ + z))) {
              this.addCuboid(target, x, y, z, id, atlas, { minX: 0, maxX: 0.015, minY: 0, maxY: 1, minZ: 0, maxZ: 1 }, {}, undefined, false, lightBrightness, biome);
              attached = true;
            }
            if (BlockRegistry.isSolid(getNeighborBlock(worldX + x + 1, y, worldZ + z))) {
              this.addCuboid(target, x, y, z, id, atlas, { minX: 0.985, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 1 }, {}, undefined, false, lightBrightness, biome);
              attached = true;
            }
            if (!attached) {
              this.addPlant(target, x, y, z, id, atlas, lightBrightness, biome);
            }
            continue;
          }

          // Rails
          if (BlockRegistry.isRail(id)) {
            const skyLight = this.getSkyLightAt(x, y, z);
            const blockLight = this.getBlockLightAt(x, y, z);
            const lightBrightness = this.getAdjustedBrightness(skyLight, blockLight, timeOfDay);
            const bounds: CuboidBounds = {
              minX: 0, maxX: 1,
              minY: 0, maxY: 0.05,
              minZ: 0, maxZ: 1
            };
            this.addCuboid(target, x, y, z, id, atlas, bounds, {}, undefined, false, lightBrightness, biome);
            continue;
          }

          // Signs
          if ((id & 0x3FF) === 63 || (id & 0x3FF) === 68) {
            const skyLight = this.getSkyLightAt(x, y, z);
            const blockLight = this.getBlockLightAt(x, y, z);
            const lightBrightness = this.getAdjustedBrightness(skyLight, blockLight, timeOfDay);
            this.addSign(target, x, y, z, id, meta, atlas, lightBrightness);
            continue;
          }

          // Banners
          if ((id & 0x3FF) === 176 || (id & 0x3FF) === 177) {
            const skyLight = this.getSkyLightAt(x, y, z);
            const blockLight = this.getBlockLightAt(x, y, z);
            const lightBrightness = this.getAdjustedBrightness(skyLight, blockLight, timeOfDay);
            this.addBanner(target, x, y, z, id, meta, atlas, lightBrightness);
            continue;
          }

          // Flowers & plants - cross-shaped rendering for transparent non-solid blocks.
          // Fluids are also transparent/non-solid, but they must render as culled voxel
          // surfaces; treating water as a plant fills oceans with crossed internal planes.
          if (def.transparent && !def.solid && !BlockRegistry.isFluid(id)) {
            const skyLight = this.getSkyLightAt(x, y, z);
            const blockLight = this.getBlockLightAt(x, y, z);
            const lightBrightness = this.getAdjustedBrightness(skyLight, blockLight, timeOfDay);
            this.addPlant(target, x, y, z, id, atlas, lightBrightness, biome);
            continue;
          }

          // Check 6 faces
          // Compute fluid level for rendering: still water defaults to 8 (full height)
          const fluidLevel = BlockRegistry.isFluid(id)
            ? (meta?.fluidLevel ?? ((id & 0x3FF) === 9 || (id & 0x3FF) === 11 ? 8 : 7))
            : 0;
          for (let face = 0; face < 6; face++) {
            const [dx, dy, dz] = FACE_DIRS[face];
            const nx = x + dx;
            const ny = y + dy;
            const nz = z + dz;

            // Get neighbor block (cross-chunk aware)
            let neighborId: number;
            if (nx < 0 || nx >= CHUNK_SIZE || nz < 0 || nz >= CHUNK_SIZE) {
              neighborId = getNeighborBlock(worldX + nx, ny, worldZ + nz);
            } else if (ny < 0 || ny >= WORLD_HEIGHT) {
              neighborId = 0;
            } else {
              neighborId = this.getBlock(nx, ny, nz);
            }

            // Voxel Face Culling (Minecraft Rules)
            if (neighborId !== 0) {
              const neighborIsTrans = BlockRegistry.isTransparent(neighborId);
              if (!neighborIsTrans) {
                // Neighbor is opaque: always cull the face
                continue;
              } else {
                // Neighbor is transparent:
                // If both blocks are the same transparent family, cull the internal face.
                const bothWater = BlockRegistry.isWater(id) && BlockRegistry.isWater(neighborId);
                const bothLava = BlockRegistry.isLava(id) && BlockRegistry.isLava(neighborId);
                if (isTrans && (neighborId === id || bothWater || bothLava)) {
                  continue;
                }
              }
            }
            let depth = 0;
            const isNeighWater = (neighborId & 0x3FF) === 8 || (neighborId & 0x3FF) === 9;
            if (isNeighWater) {
              let wy = ny;
              const wx = worldX + nx;
              const wz = worldZ + nz;
              const isLocal = (nx >= 0 && nx < CHUNK_SIZE && nz >= 0 && nz < CHUNK_SIZE);

              if (isLocal) {
                while (wy < WORLD_HEIGHT - 1 && wy - ny < 32) {
                  const checkBlock = this.getBlock(nx, wy + 1, nz);
                  if ((checkBlock & 0x3FF) === 8 || (checkBlock & 0x3FF) === 9) {
                    wy++;
                  } else {
                    break;
                  }
                }
              } else {
                while (wy < WORLD_HEIGHT - 1 && wy - ny < 32) {
                  const checkBlock = getNeighborBlock(wx, wy + 1, wz);
                  if ((checkBlock & 0x3FF) === 8 || (checkBlock & 0x3FF) === 9) {
                    wy++;
                  } else {
                    break;
                  }
                }
              }
              depth = wy - y;
              if (depth < 0) depth = 0;
            }

            // Get light at the neighbor (face-adjacent) position
            let faceSkyLight: number;
            let faceBlockLight: number;
            if (nx < 0 || nx >= CHUNK_SIZE || nz < 0 || nz >= CHUNK_SIZE) {
              faceSkyLight = getNeighborSkyLight(worldX + nx, ny, worldZ + nz);
              faceBlockLight = getNeighborBlockLight(worldX + nx, ny, worldZ + nz);
            } else if (ny < 0 || ny >= WORLD_HEIGHT) {
              faceSkyLight = ny >= WORLD_HEIGHT ? 15 : 0;
              faceBlockLight = 0;
            } else {
              faceSkyLight = this.getSkyLightAt(nx, ny, nz);
              faceBlockLight = this.getBlockLightAt(nx, ny, nz);
            }

            const lightBrightness = this.getAdjustedBrightness(faceSkyLight, faceBlockLight, timeOfDay);
            this.addFace(target, x, y, z, face, id, atlas, depth, lightBrightness, fluidLevel, getNeighborBlock, biome, meta);
          }
        }
      }
    }

    const solidGeo = this.createGeometry(solid);
    const transparentGeo = this.createGeometry(transparent);
    this.dirty = false;
    return { solidGeo, transparentGeo };
  }

  private addFace(
    data: ChunkMeshData,
    x: number, y: number, z: number,
    face: number,
    blockId: number,
    atlas: { getUV(key: string): { u0: number; v0: number; u1: number; v1: number } },
    waterDepth: number = 0,
    lightBrightness: number = 1.0,
    fluidLevel: number = 8,
    getNeighborBlock?: (wx: number, wy: number, wz: number) => number,
    biome: number = 0,
    meta?: BlockMetadata
  ) {
    const texKey = VisualResolver.getBlockFaceTexture(blockId, face, meta);
    const uv = atlas.getUV(texKey);

    const verts = FACE_QUADS[face];
    const baseIdx = data.positions.length / 3;
    const isFluid = BlockRegistry.isFluid(blockId);
    // Full/source and falling fluids occupy the whole voxel; lower levels taper only horizontal flow.
    const surfaceY = fluidLevel >= 8 ? 1 : (fluidLevel - 1) / 8;

    const worldX = this.cx * CHUNK_SIZE + x;
    const worldZ = this.cz * CHUNK_SIZE + z;
    const worldY = y;

    // Compute brightness from lightBrightness + face direction shading
    let baseBrightness = lightBrightness * FACE_BRIGHTNESS[face];
    // Clamp minimum so nothing is completely black
    baseBrightness = Math.max(0.0, Math.min(1.0, baseBrightness));

    if (waterDepth > 0 && !BlockRegistry.isWater(blockId)) {
      const tint = Math.max(0.12, Math.pow(0.82, waterDepth));
      baseBrightness *= tint;
    }

    const def = BlockRegistry.get(blockId);
    const isHighAltitude = y >= 105 && (biome === BiomeType.Mountains || biome === BiomeType.Snow);

    let biomeTint: [number, number, number] | null = null;
    if (def) {
      const name = def.name;
      if (name === 'grass' && face === 0) {
        if (isHighAltitude) {
          biomeTint = [0.95, 0.97, 0.98]; // Snow overlay
        } else {
          biomeTint = BIOME_GRASS_COLORS[biome] || [1.0, 1.0, 1.0];
        }
      } else if (name.includes('leaves')) {
        if (isHighAltitude) {
          biomeTint = [0.85, 0.92, 0.90]; // Snowy leaves
        } else if (!name.includes('spruce') && !name.includes('birch')) {
          biomeTint = BIOME_LEAVES_COLORS[biome] || [1.0, 1.0, 1.0];
        }
      } else if (name === 'vine') {
        if (isHighAltitude) {
          biomeTint = [0.85, 0.92, 0.90];
        } else {
          biomeTint = BIOME_LEAVES_COLORS[biome] || [1.0, 1.0, 1.0];
        }
      }
    }

    const [nx, ny, nz] = FACE_DIRS[face];
    const bType = getBlockType(blockId);

    for (const [vx, vy, vz] of verts) {
      // Lower top vertices of fluid blocks to match surface height
      let adjVy = vy;
      if (isFluid && vy > 0) {
        adjVy = surfaceY;
      }
      data.positions.push(x + vx, y + adjVy, z + vz);
      data.normals.push(nx, ny, nz);
      if (data.blockTypes) {
        data.blockTypes.push(bType);
      }

      // Compute Ambient Occlusion
      let aoMultiplier = 1.0;
      const isAOApplicable = !isFluid && def && !def.transparent;
      if (isAOApplicable && getNeighborBlock) {
        let ox = 0, oy = 0, oz = 0;
        if (nx === 0) ox = (vx === 0 ? -1 : 1);
        if (ny === 0) oy = (vy === 0 ? -1 : 1);
        if (nz === 0) oz = (vz === 0 ? -1 : 1);

        let blockSide1 = 0;
        let blockSide2 = 0;
        let blockCorner = 0;

        if (nx !== 0) {
          blockSide1 = getNeighborBlock(worldX + nx, worldY + oy, worldZ);
          blockSide2 = getNeighborBlock(worldX + nx, worldY, worldZ + oz);
          blockCorner = getNeighborBlock(worldX + nx, worldY + oy, worldZ + oz);
        } else if (ny !== 0) {
          blockSide1 = getNeighborBlock(worldX + ox, worldY + ny, worldZ);
          blockSide2 = getNeighborBlock(worldX, worldY + ny, worldZ + oz);
          blockCorner = getNeighborBlock(worldX + ox, worldY + ny, worldZ + oz);
        } else {
          blockSide1 = getNeighborBlock(worldX + ox, worldY, worldZ + nz);
          blockSide2 = getNeighborBlock(worldX, worldY + oy, worldZ + nz);
          blockCorner = getNeighborBlock(worldX + ox, worldY + oy, worldZ + nz);
        }

        const isOpaque = (id: number) => id !== 0 && !BlockRegistry.isTransparent(id);
        const s1 = isOpaque(blockSide1) ? 1 : 0;
        const s2 = isOpaque(blockSide2) ? 1 : 0;
        const c = isOpaque(blockCorner) ? 1 : 0;

        let ao = 3;
        if (s1 === 1 && s2 === 1) {
          ao = 0;
        } else {
          ao = 3 - (s1 + s2 + c);
        }

        if (ao === 2) aoMultiplier = 0.82;
        else if (ao === 1) aoMultiplier = 0.65;
        else if (ao === 0) aoMultiplier = 0.48;
      }

      let vr = baseBrightness * aoMultiplier;
      let vg = baseBrightness * aoMultiplier;
      let vb = baseBrightness * aoMultiplier;

      if (biomeTint) {
        vr *= biomeTint[0];
        vg *= biomeTint[1];
        vb *= biomeTint[2];
      }

      data.colors.push(vr, vg, vb);
    }

    // UV mapping — scale v-coords when fluid surface is lower
    const uvVScale = isFluid ? surfaceY : 1;
    if (face === 2 || face === 3) {
      data.uvs.push(uv.u0, uv.v0);
      data.uvs.push(uv.u0, uv.v0 + (uv.v1 - uv.v0) * uvVScale);
      data.uvs.push(uv.u1, uv.v0 + (uv.v1 - uv.v0) * uvVScale);
      data.uvs.push(uv.u1, uv.v0);
    } else {
      data.uvs.push(uv.u0, uv.v0);
      data.uvs.push(uv.u1, uv.v0);
      data.uvs.push(uv.u1, uv.v0 + (uv.v1 - uv.v0) * uvVScale);
      data.uvs.push(uv.u0, uv.v0 + (uv.v1 - uv.v0) * uvVScale);
    }

    // two triangles
    data.indices.push(
      baseIdx, baseIdx + 1, baseIdx + 2,
      baseIdx, baseIdx + 2, baseIdx + 3
    );
  }

  private addSign(
    data: ChunkMeshData,
    x: number, y: number, z: number,
    blockId: number,
    meta: any,
    atlas: { getUV(key: string): { u0: number; v0: number; u1: number; v1: number } },
    lightBrightness: number
  ) {
    const baseId = blockId & 0x3FF;
    const isStanding = baseId === 63;
    
    if (isStanding) {
      const poleBounds: CuboidBounds = {
        minX: 0.45, maxX: 0.55,
        minY: 0, maxY: 0.6,
        minZ: 0.45, maxZ: 0.55
      };
      this.addCuboid(data, x, y, z, blockId, atlas, poleBounds, {}, undefined, false, lightBrightness);
      
      const boardBounds: CuboidBounds = {
        minX: 0.05, maxX: 0.95,
        minY: 0.6, maxY: 1.0,
        minZ: 0.44, maxZ: 0.56
      };
      this.addCuboid(data, x, y, z, blockId, atlas, boardBounds, {}, undefined, false, lightBrightness);
    } else {
      const facing = meta?.facing ?? 'north';
      let bounds: CuboidBounds;
      if (facing === 'south') {
        bounds = { minX: 0.05, maxX: 0.95, minY: 0.25, maxY: 0.75, minZ: 0, maxZ: 0.12 };
      } else if (facing === 'north') {
        bounds = { minX: 0.05, maxX: 0.95, minY: 0.25, maxY: 0.75, minZ: 0.88, maxZ: 1.0 };
      } else if (facing === 'east') {
        bounds = { minX: 0, maxX: 0.12, minY: 0.25, maxY: 0.75, minZ: 0.05, maxZ: 0.95 };
      } else {
        bounds = { minX: 0.88, maxX: 1.0, minY: 0.25, maxY: 0.75, minZ: 0.05, maxZ: 0.95 };
      }
      this.addCuboid(data, x, y, z, blockId, atlas, bounds, {}, undefined, false, lightBrightness);
    }
  }

  private addLadder(
    data: ChunkMeshData,
    x: number, y: number, z: number,
    blockId: number,
    meta: any,
    atlas: { getUV(key: string): { u0: number; v0: number; u1: number; v1: number } },
    lightBrightness: number
  ) {
    const facing = meta?.facing ?? 'north';
    let bounds: CuboidBounds;
    if (facing === 'south') {
      bounds = { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 0.05 };
    } else if (facing === 'north') {
      bounds = { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0.95, maxZ: 1.0 };
    } else if (facing === 'east') {
      bounds = { minX: 0, maxX: 0.05, minY: 0, maxY: 1, minZ: 0, maxZ: 1 };
    } else {
      bounds = { minX: 0.95, maxX: 1.0, minY: 0, maxY: 1, minZ: 0, maxZ: 1 };
    }
    this.addCuboid(data, x, y, z, blockId, atlas, bounds, {}, undefined, false, lightBrightness);
  }

  private addBanner(
    data: ChunkMeshData,
    x: number, y: number, z: number,
    blockId: number,
    meta: any,
    atlas: { getUV(key: string): { u0: number; v0: number; u1: number; v1: number } },
    lightBrightness: number
  ) {
    const baseId = blockId & 0x3FF;
    const isStanding = baseId === 176;

    if (isStanding) {
      const poleBounds: CuboidBounds = {
        minX: 0.45, maxX: 0.55,
        minY: 0, maxY: 1.0,
        minZ: 0.45, maxZ: 0.55
      };
      this.addCuboid(data, x, y, z, blockId, atlas, poleBounds, {}, undefined, false, lightBrightness);
      
      const bannerBounds: CuboidBounds = {
        minX: 0.15, maxX: 0.85,
        minY: 0.15, maxY: 0.95,
        minZ: 0.48, maxZ: 0.52
      };
      this.addCuboid(data, x, y, z, blockId, atlas, bannerBounds, {}, undefined, false, lightBrightness);
    } else {
      const facing = meta?.facing ?? 'north';
      let bounds: CuboidBounds;
      if (facing === 'south') {
        bounds = { minX: 0.15, maxX: 0.85, minY: 0.05, maxY: 0.85, minZ: 0, maxZ: 0.04 };
      } else if (facing === 'north') {
        bounds = { minX: 0.15, maxX: 0.85, minY: 0.05, maxY: 0.85, minZ: 0.96, maxZ: 1.0 };
      } else if (facing === 'east') {
        bounds = { minX: 0, maxX: 0.04, minY: 0.05, maxY: 0.85, minZ: 0.15, maxZ: 0.85 };
      } else {
        bounds = { minX: 0.96, maxX: 1.0, minY: 0.05, maxY: 0.85, minZ: 0.15, maxZ: 0.85 };
      }
      this.addCuboid(data, x, y, z, blockId, atlas, bounds, {}, undefined, false, lightBrightness);
    }
  }

  private addTorch(
    data: ChunkMeshData,
    x: number, y: number, z: number,
    atlas: { getUV(key: string): { u0: number; v0: number; u1: number; v1: number } },
    lightBrightness: number = 0.93 // 14/15
  ) {
    const uv = atlas.getUV('torch');
    const brightness = Math.max(0.2, lightBrightness);

    // Plane 1 - Front Side
    this.addTorchQuad(
      data,
      [x + 0.25, y + 0.0, z + 0.25],
      [x + 0.75, y + 0.0, z + 0.75],
      [x + 0.75, y + 0.8, z + 0.75],
      [x + 0.25, y + 0.8, z + 0.25],
      [-0.707, 0, 0.707],
      uv,
      brightness
    );

    // Plane 1 - Back Side
    this.addTorchQuad(
      data,
      [x + 0.75, y + 0.0, z + 0.75],
      [x + 0.25, y + 0.0, z + 0.25],
      [x + 0.25, y + 0.8, z + 0.25],
      [x + 0.75, y + 0.8, z + 0.75],
      [0.707, 0, -0.707],
      uv,
      brightness
    );

    // Plane 2 - Front Side
    this.addTorchQuad(
      data,
      [x + 0.25, y + 0.0, z + 0.75],
      [x + 0.75, y + 0.0, z + 0.25],
      [x + 0.75, y + 0.8, z + 0.25],
      [x + 0.25, y + 0.8, z + 0.75],
      [0.707, 0, 0.707],
      uv,
      brightness
    );

    // Plane 2 - Back Side
    this.addTorchQuad(
      data,
      [x + 0.75, y + 0.0, z + 0.25],
      [x + 0.25, y + 0.0, z + 0.75],
      [x + 0.25, y + 0.8, z + 0.75],
      [x + 0.75, y + 0.8, z + 0.25],
      [-0.707, 0, -0.707],
      uv,
      brightness
    );
  }

  private addDoor(
    data: ChunkMeshData,
    x: number, y: number, z: number,
    blockId: number,
    meta: BlockMetadata | undefined,
    atlas: { getUV(key: string): { u0: number; v0: number; u1: number; v1: number } },
    lightBrightness: number = 1.0
  ) {
    const thickness = 0.125;
    const facing = meta?.facing ?? 'north';
    const hinge = meta?.hinge ?? 'left';
    const isOpen = meta?.open ?? false;
    const isLower = meta?.doorHalf !== 'upper';

    let bounds: CuboidBounds;
    if (!isOpen) {
      bounds = (facing === 'east' || facing === 'west')
        ? { minX: 0.4375, maxX: 0.5625, minY: 0, maxY: 1, minZ: 0, maxZ: 1 }
        : { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0.4375, maxZ: 0.5625 };
    } else {
      switch (facing) {
        case 'north':
          bounds = hinge === 'left'
            ? { minX: 0, maxX: thickness, minY: 0, maxY: 1, minZ: 0, maxZ: 1 }
            : { minX: 1 - thickness, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 1 };
          break;
        case 'south':
          bounds = hinge === 'left'
            ? { minX: 1 - thickness, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 1 }
            : { minX: 0, maxX: thickness, minY: 0, maxY: 1, minZ: 0, maxZ: 1 };
          break;
        case 'east':
          bounds = hinge === 'left'
            ? { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: thickness }
            : { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 1 - thickness, maxZ: 1 };
          break;
        case 'west':
          bounds = hinge === 'left'
            ? { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 1 - thickness, maxZ: 1 }
            : { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: thickness };
          break;
        default:
          bounds = { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0.4375, maxZ: 0.5625 };
      }
    }

    this.addCuboid(data, x, y, z, blockId, atlas, bounds, {
      top: !isLower || !this.isDoorId(this.getBlock(x, y + 1, z)),
      bottom: isLower || !this.isDoorId(this.getBlock(x, y - 1, z)),
    }, undefined, hinge === 'right', lightBrightness);
  }

  private addTrapdoor(
    data: ChunkMeshData,
    x: number, y: number, z: number,
    blockId: number,
    meta: BlockMetadata | undefined,
    atlas: { getUV(key: string): { u0: number; v0: number; u1: number; v1: number } },
    lightBrightness: number = 1.0
  ) {
    const thickness = 0.1875;
    const facing = meta?.facing ?? 'north';
    const isOpen = meta?.open ?? false;
 
    let bounds: CuboidBounds;
    let customTextureKeys: string[];
 
    const mainTex = isOpen ? 'oak_trapdoor_open' : 'oak_trapdoor_closed';
 
    if (!isOpen) {
      bounds = { minX: 0, maxX: 1, minY: 0, maxY: thickness, minZ: 0, maxZ: 1 };
      // Closed: Top and Bottom get main trapdoor texture, sides get planks
      customTextureKeys = [
        mainTex,       // top (y+)
        mainTex,       // bottom (y-)
        'oak_planks',  // right (x+)
        'oak_planks',  // left (x-)
        'oak_planks',  // front (z+)
        'oak_planks',  // back (z-)
      ];
    } else {
      switch (facing) {
        case 'north':
          bounds = { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: thickness };
          // North open: Front and Back get main trapdoor texture, others get planks
          customTextureKeys = [
            'oak_planks',  // top
            'oak_planks',  // bottom
            'oak_planks',  // right
            'oak_planks',  // left
            mainTex,       // front
            mainTex,       // back
          ];
          break;
        case 'south':
          bounds = { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 1 - thickness, maxZ: 1 };
          customTextureKeys = [
            'oak_planks',  // top
            'oak_planks',  // bottom
            'oak_planks',  // right
            'oak_planks',  // left
            mainTex,       // front
            mainTex,       // back
          ];
          break;
        case 'east':
          bounds = { minX: 1 - thickness, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 1 };
          // East open: Right and Left get main trapdoor texture, others get planks
          customTextureKeys = [
            'oak_planks',  // top
            'oak_planks',  // bottom
            mainTex,       // right
            mainTex,       // left
            'oak_planks',  // front
            'oak_planks',  // back
          ];
          break;
        case 'west':
          bounds = { minX: 0, maxX: thickness, minY: 0, maxY: 1, minZ: 0, maxZ: 1 };
          customTextureKeys = [
            'oak_planks',  // top
            'oak_planks',  // bottom
            mainTex,       // right
            mainTex,       // left
            'oak_planks',  // front
            'oak_planks',  // back
          ];
          break;
        default:
          bounds = { minX: 0, maxX: 1, minY: 0, maxY: thickness, minZ: 0, maxZ: 1 };
          customTextureKeys = [
            mainTex, mainTex, 'oak_planks', 'oak_planks', 'oak_planks', 'oak_planks'
          ];
      }
    }
 
    this.addCuboid(data, x, y, z, blockId, atlas, bounds, {}, customTextureKeys, false, lightBrightness);
  }

  private addCuboid(
    data: ChunkMeshData,
    x: number, y: number, z: number,
    blockId: number,
    atlas: { getUV(key: string): { u0: number; v0: number; u1: number; v1: number } },
    bounds: CuboidBounds,
    faceOverrides: Partial<Record<'top' | 'bottom', boolean>> = {},
    customTextureKeys?: string[],
    mirrorHorizontal = false,
    lightBrightness: number = 1.0,
    biome: number = 0,
    meta?: BlockMetadata
  ) {
    const faces = getCuboidFaces(bounds);
    const shouldDraw = {
      top: faceOverrides.top ?? true,
      bottom: faceOverrides.bottom ?? true,
      right: true,
      left: true,
      front: true,
      back: true,
    };
    const finalLightBrightness = Math.max(0.0, lightBrightness);

    const def = BlockRegistry.get(blockId);
    let biomeTint: [number, number, number] | null = null;
    if (def && def.name === 'vine') {
      const isHighAltitude = y >= 105 && (biome === BiomeType.Mountains || biome === BiomeType.Snow);
      if (isHighAltitude) {
        biomeTint = [0.85, 0.92, 0.90];
      } else {
        biomeTint = BIOME_LEAVES_COLORS[biome] || [1.0, 1.0, 1.0];
      }
    }

    const bType = getBlockType(blockId);

    faces.forEach((faceDef, faceIndex) => {
      const faceName = FACE_NAMES[faceIndex];
      if (!shouldDraw[faceName]) return;

      const texKey = customTextureKeys ? customTextureKeys[faceIndex] : VisualResolver.getBlockFaceTexture(blockId, faceIndex, meta);
      const uv = atlas.getUV(texKey);
      const baseIdx = data.positions.length / 3;

      for (const [vx, vy, vz] of faceDef.verts) {
        data.positions.push(x + vx, y + vy, z + vz);
        data.normals.push(...faceDef.normal);
        if (data.blockTypes) {
          data.blockTypes.push(bType);
        }
        const brightness = Math.max(0.0, FACE_BRIGHTNESS[faceIndex] * finalLightBrightness);
        let vr = brightness;
        let vg = brightness;
        let vb = brightness;
        if (biomeTint) {
          vr *= biomeTint[0];
          vg *= biomeTint[1];
          vb *= biomeTint[2];
        }
        data.colors.push(vr, vg, vb);
      }

      const uStart = mirrorHorizontal ? uv.u1 : uv.u0;
      const uEnd = mirrorHorizontal ? uv.u0 : uv.u1;

      if (faceIndex === 2 || faceIndex === 3) {
        data.uvs.push(uStart, uv.v0);
        data.uvs.push(uStart, uv.v1);
        data.uvs.push(uEnd, uv.v1);
        data.uvs.push(uEnd, uv.v0);
      } else {
        data.uvs.push(uStart, uv.v0);
        data.uvs.push(uEnd, uv.v0);
        data.uvs.push(uEnd, uv.v1);
        data.uvs.push(uStart, uv.v1);
      }
      data.indices.push(
        baseIdx, baseIdx + 1, baseIdx + 2,
        baseIdx, baseIdx + 2, baseIdx + 3
      );
    });
  }

  private isDoorId(id: number): boolean {
    return BlockRegistry.isDoor(id);
  }

  private addTorchQuad(
    data: ChunkMeshData,
    p1: [number, number, number],
    p2: [number, number, number],
    p3: [number, number, number],
    p4: [number, number, number],
    normal: [number, number, number],
    uv: { u0: number; v0: number; u1: number; v1: number },
    brightness: number
  ) {
    const baseIdx = data.positions.length / 3;

    data.positions.push(...p1);
    data.positions.push(...p2);
    data.positions.push(...p3);
    data.positions.push(...p4);

    for (let i = 0; i < 4; i++) {
      data.normals.push(...normal);
      data.colors.push(brightness, brightness, brightness);
      if (data.blockTypes) data.blockTypes.push(0);
    }

    data.uvs.push(uv.u0, uv.v0); // Bottom-left
    data.uvs.push(uv.u1, uv.v0); // Bottom-right
    data.uvs.push(uv.u1, uv.v1); // Top-right
    data.uvs.push(uv.u0, uv.v1); // Top-left

    data.indices.push(
      baseIdx, baseIdx + 1, baseIdx + 2,
      baseIdx, baseIdx + 2, baseIdx + 3
    );
  }

  private addStair(
    data: ChunkMeshData,
    x: number, y: number, z: number,
    blockId: number,
    meta: BlockMetadata | undefined,
    atlas: { getUV(key: string): { u0: number; v0: number; u1: number; v1: number } },
    lightBrightness: number = 1.0
  ) {
    const facing = meta?.stairFacing ?? 'north';
    // Bottom half (full width, half height)
    const bottomBounds: CuboidBounds = { minX: 0, maxX: 1, minY: 0, maxY: 0.5, minZ: 0, maxZ: 1 };
    this.addCuboid(data, x, y, z, blockId, atlas, bottomBounds, {}, undefined, false, lightBrightness);

    // Top step (half block, depends on facing)
    let topBounds: CuboidBounds;
    switch (facing) {
      case 'north': topBounds = { minX: 0, maxX: 1, minY: 0.5, maxY: 1, minZ: 0, maxZ: 0.5 }; break;
      case 'south': topBounds = { minX: 0, maxX: 1, minY: 0.5, maxY: 1, minZ: 0.5, maxZ: 1 }; break;
      case 'east':  topBounds = { minX: 0.5, maxX: 1, minY: 0.5, maxY: 1, minZ: 0, maxZ: 1 }; break;
      case 'west':  topBounds = { minX: 0, maxX: 0.5, minY: 0.5, maxY: 1, minZ: 0, maxZ: 1 }; break;
      default:      topBounds = { minX: 0, maxX: 1, minY: 0.5, maxY: 1, minZ: 0, maxZ: 0.5 };
    }
    this.addCuboid(data, x, y, z, blockId, atlas, topBounds, {}, undefined, false, lightBrightness);
  }

  private addFence(
    data: ChunkMeshData,
    x: number, y: number, z: number,
    blockId: number,
    meta: BlockMetadata | undefined,
    atlas: { getUV(key: string): { u0: number; v0: number; u1: number; v1: number } },
    lightBrightness: number = 1.0,
    getNeighborBlock: (wx: number, wy: number, wz: number) => number,
    worldX: number,
    worldZ: number
  ) {
    // Center post: 6x16x6 pixels = 0.375 wide, full height
    const postBounds: CuboidBounds = { minX: 0.25, maxX: 0.75, minY: 0, maxY: 1.5, minZ: 0.25, maxZ: 0.75 };
    this.addCuboid(data, x, y, z, blockId, atlas, postBounds, {}, undefined, false, lightBrightness);

    // Check connections to adjacent blocks
    const wx = worldX + x;
    const wz = worldZ + z;
    const isFenceLike = (bid: number) => {
      const def = BlockRegistry.get(bid);
      return !!def && (def.name.includes('fence') || def.name.includes('wall'));
    };
    const connectsTo = (bid: number) => isFenceLike(bid) || BlockRegistry.isSolid(bid);

    // North (-Z)
    if (connectsTo(getNeighborBlock(wx, y, wz - 1))) {
      const b: CuboidBounds = { minX: 0.25, maxX: 0.75, minY: 0.375, maxY: 1.25, minZ: 0, maxZ: 0.25 };
      this.addCuboid(data, x, y, z, blockId, atlas, b, {}, undefined, false, lightBrightness);
    }
    // South (+Z)
    if (connectsTo(getNeighborBlock(wx, y, wz + 1))) {
      const b: CuboidBounds = { minX: 0.25, maxX: 0.75, minY: 0.375, maxY: 1.25, minZ: 0.75, maxZ: 1 };
      this.addCuboid(data, x, y, z, blockId, atlas, b, {}, undefined, false, lightBrightness);
    }
    // East (+X)
    if (connectsTo(getNeighborBlock(wx + 1, y, wz))) {
      const b: CuboidBounds = { minX: 0.75, maxX: 1, minY: 0.375, maxY: 1.25, minZ: 0.25, maxZ: 0.75 };
      this.addCuboid(data, x, y, z, blockId, atlas, b, {}, undefined, false, lightBrightness);
    }
    // West (-X)
    if (connectsTo(getNeighborBlock(wx - 1, y, wz))) {
      const b: CuboidBounds = { minX: 0, maxX: 0.25, minY: 0.375, maxY: 1.25, minZ: 0.25, maxZ: 0.75 };
      this.addCuboid(data, x, y, z, blockId, atlas, b, {}, undefined, false, lightBrightness);
    }
  }

  private addPlant(
    data: ChunkMeshData,
    x: number, y: number, z: number,
    blockId: number,
    atlas: { getUV(key: string): { u0: number; v0: number; u1: number; v1: number } },
    lightBrightness: number = 1.0,
    biome: number = 0
  ) {
    const texKey = VisualResolver.getBlockFaceTexture(blockId, 0);
    const uv = atlas.getUV(texKey);
    const brightness = Math.max(0.0, lightBrightness);

    const def = BlockRegistry.get(blockId);
    let tint: [number, number, number] = [1.0, 1.0, 1.0];
    if (def && (def.name.includes('grass') || def.name.includes('fern'))) {
      const isHighAltitude = y >= 105 && (biome === BiomeType.Mountains || biome === BiomeType.Snow);
      if (isHighAltitude) {
        tint = [0.90, 0.95, 0.98]; // snowy frost
      } else {
        tint = BIOME_GRASS_COLORS[biome] || [1.0, 1.0, 1.0];
      }
    }

    // Two diagonal planes forming an X shape
    // Plane 1: NW to SE
    this.addPlantQuad(data,
      [x, y, z], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z],
      [-0.707, 0, 0.707], uv, brightness, tint
    );
    this.addPlantQuad(data,
      [x + 1, y, z + 1], [x, y, z], [x, y + 1, z], [x + 1, y + 1, z + 1],
      [0.707, 0, -0.707], uv, brightness, tint
    );

    // Plane 2: NE to SW
    this.addPlantQuad(data,
      [x + 1, y, z], [x, y, z + 1], [x, y + 1, z + 1], [x + 1, y + 1, z],
      [0.707, 0, 0.707], uv, brightness, tint
    );
    this.addPlantQuad(data,
      [x, y, z + 1], [x + 1, y, z], [x + 1, y + 1, z], [x, y + 1, z + 1],
      [-0.707, 0, -0.707], uv, brightness, tint
    );
  }

  private addPlantQuad(
    data: ChunkMeshData,
    p1: [number, number, number],
    p2: [number, number, number],
    p3: [number, number, number],
    p4: [number, number, number],
    normal: [number, number, number],
    uv: { u0: number; v0: number; u1: number; v1: number },
    brightness: number,
    tint: [number, number, number] = [1.0, 1.0, 1.0]
  ) {
    const baseIdx = data.positions.length / 3;
    data.positions.push(...p1, ...p2, ...p3, ...p4);
    for (let i = 0; i < 4; i++) {
      data.normals.push(...normal);
      data.colors.push(brightness * tint[0], brightness * tint[1], brightness * tint[2]);
      if (data.blockTypes) {
        data.blockTypes.push(0);
      }
    }
    data.uvs.push(uv.u0, uv.v0, uv.u1, uv.v0, uv.u1, uv.v1, uv.u0, uv.v1);
    data.indices.push(baseIdx, baseIdx + 1, baseIdx + 2, baseIdx, baseIdx + 2, baseIdx + 3);
  }

  private createGeometry(data: ChunkMeshData): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry();
    if (data.positions.length === 0) return geo;

    geo.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(data.uvs, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(data.colors, 3));
    if (data.blockTypes) {
      geo.setAttribute('blockType', new THREE.Float32BufferAttribute(data.blockTypes, 1));
    } else {
      const count = data.positions.length / 3;
      geo.setAttribute('blockType', new THREE.Float32BufferAttribute(new Float32Array(count), 1));
    }
    geo.setIndex(data.indices);
    return geo;
  }

  dispose() {
    this.mesh?.geometry.dispose();
    this.transparentMesh?.geometry.dispose();
  }
}

// Face quad vertices (4 corners per face)
const FACE_QUADS: [number, number, number][][] = [
  // top (y+)
  [[0,1,1],[1,1,1],[1,1,0],[0,1,0]],
  // bottom (y-)
  [[0,0,0],[1,0,0],[1,0,1],[0,0,1]],
  // right (x+)
  [[1,0,0],[1,1,0],[1,1,1],[1,0,1]],
  // left (x-)
  [[0,0,1],[0,1,1],[0,1,0],[0,0,0]],
  // front (z+)
  [[0,0,1],[1,0,1],[1,1,1],[0,1,1]],
  // back (z-)
  [[1,0,0],[0,0,0],[0,1,0],[1,1,0]],
];

const FACE_DIRS: [number, number, number][] = [
  [0,1,0], [0,-1,0], [1,0,0], [-1,0,0], [0,0,1], [0,0,-1]
];

type CuboidBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
};

const FACE_NAMES = ['top', 'bottom', 'right', 'left', 'front', 'back'] as const;

const FACE_BRIGHTNESS = [1.0, 0.5, 0.8, 0.8, 0.9, 0.7];

function getCuboidFaces(bounds: CuboidBounds) {
  const { minX, maxX, minY, maxY, minZ, maxZ } = bounds;

  return [
    {
      verts: [
        [minX, maxY, maxZ],
        [maxX, maxY, maxZ],
        [maxX, maxY, minZ],
        [minX, maxY, minZ],
      ] as [number, number, number][],
      normal: [0, 1, 0] as [number, number, number],
    },
    {
      verts: [
        [minX, minY, minZ],
        [maxX, minY, minZ],
        [maxX, minY, maxZ],
        [minX, minY, maxZ],
      ] as [number, number, number][],
      normal: [0, -1, 0] as [number, number, number],
    },
    {
      verts: [
        [maxX, minY, minZ],
        [maxX, maxY, minZ],
        [maxX, maxY, maxZ],
        [maxX, minY, maxZ],
      ] as [number, number, number][],
      normal: [1, 0, 0] as [number, number, number],
    },
    {
      verts: [
        [minX, minY, maxZ],
        [minX, maxY, maxZ],
        [minX, maxY, minZ],
        [minX, minY, minZ],
      ] as [number, number, number][],
      normal: [-1, 0, 0] as [number, number, number],
    },
    {
      verts: [
        [minX, minY, maxZ],
        [maxX, minY, maxZ],
        [maxX, maxY, maxZ],
        [minX, maxY, maxZ],
      ] as [number, number, number][],
      normal: [0, 0, 1] as [number, number, number],
    },
    {
      verts: [
        [maxX, minY, minZ],
        [minX, minY, minZ],
        [minX, maxY, minZ],
        [maxX, maxY, minZ],
      ] as [number, number, number][],
      normal: [0, 0, -1] as [number, number, number],
    },
  ];
}
