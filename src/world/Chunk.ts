import * as THREE from 'three';
import { CHUNK_SIZE, WORLD_HEIGHT } from '../constants';
import { BlockRegistry } from './BlockRegistry';
import type { BlockMetadata, ChunkMeshData, SerializedBlockMetadata } from '../types';

export class Chunk {
  data: Uint8Array;
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
    this.data = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT);
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

  /**
   * Build optimized mesh using greedy meshing.
   * getNeighborBlock: (wx, wy, wz) => blockId for cross-chunk lookups
   * getNeighborLight: (wx, wy, wz) => combined light level 0-15
   * timeOfDay: 0..1 day cycle for sky light brightness modulation
   */
  buildMesh(
    atlas: { getUV(key: string): { u0: number; v0: number; u1: number; v1: number } },
    getNeighborBlock: (wx: number, wy: number, wz: number) => number,
    getNeighborLight: (wx: number, wy: number, wz: number) => number,
    timeOfDay: number = 0.25
  ): { solidGeo: THREE.BufferGeometry; transparentGeo: THREE.BufferGeometry } {
    const solid: ChunkMeshData = { positions: [], normals: [], uvs: [], indices: [], colors: [] };
    const transparent: ChunkMeshData = { positions: [], normals: [], uvs: [], indices: [], colors: [] };

    const worldX = this.cx * CHUNK_SIZE;
    const worldZ = this.cz * CHUNK_SIZE;

    // For each block in chunk
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const id = this.getBlock(x, y, z);
          if (id === 0) continue;

          const def = BlockRegistry.get(id);
          if (!def) continue;

          const meta = this.getBlockMeta(x, y, z);

          const isTrans = def.transparent;
          const isTranslucent = id === 13 || id === 14 || id === 28;
          const target = isTranslucent ? transparent : solid;

          if (id === 30) {
            const light = this.getLightAt(x, y, z);
            this.addTorch(target, x, y, z, atlas, light);
            continue;
          }

          if (id === 37 || id === 38) {
            const light = this.getLightAt(x, y, z);
            this.addDoor(target, x, y, z, id, meta, atlas, light);
            continue;
          }

          if (id === 39 || id === 40) {
            const light = this.getLightAt(x, y, z);
            this.addTrapdoor(target, x, y, z, id, meta, atlas, light);
            continue;
          }

          // Slabs (IDs 41-46)
          if (id >= 41 && id <= 46) {
            const light = this.getLightAt(x, y, z);
            const isTop = meta?.slabHalf === 'top';
            const bounds: CuboidBounds = isTop
              ? { minX: 0, maxX: 1, minY: 0.5, maxY: 1, minZ: 0, maxZ: 1 }
              : { minX: 0, maxX: 1, minY: 0, maxY: 0.5, minZ: 0, maxZ: 1 };
            this.addCuboid(target, x, y, z, id, atlas, bounds, {}, undefined, false, light);
            continue;
          }

          // Stairs (IDs 47-52)
          if (id >= 47 && id <= 52) {
            const light = this.getLightAt(x, y, z);
            this.addStair(target, x, y, z, id, meta, atlas, light);
            continue;
          }

          // Fences & walls (IDs 53-56)
          if (id >= 53 && id <= 56) {
            const light = this.getLightAt(x, y, z);
            this.addFence(target, x, y, z, id, meta, atlas, light, getNeighborBlock, worldX, worldZ);
            continue;
          }

          // Flowers & plants (IDs 58-65) - cross-shaped rendering
          if (id >= 58 && id <= 65) {
            const light = this.getLightAt(x, y, z);
            this.addPlant(target, x, y, z, id, atlas, light);
            continue;
          }

          // Check 6 faces
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
                // If this block is also transparent, cull if they are the same block type
                if (isTrans && neighborId === id) {
                  continue;
                }
              }
            }
            let depth = 0;
            if (neighborId === 13) {
              let wy = ny;
              const wx = worldX + nx;
              const wz = worldZ + nz;
              const isLocal = (nx >= 0 && nx < CHUNK_SIZE && nz >= 0 && nz < CHUNK_SIZE);

              if (isLocal) {
                while (wy < WORLD_HEIGHT - 1 && wy - ny < 32) {
                  if (this.getBlock(nx, wy + 1, nz) === 13) {
                    wy++;
                  } else {
                    break;
                  }
                }
              } else {
                while (wy < WORLD_HEIGHT - 1 && wy - ny < 32) {
                  if (getNeighborBlock(wx, wy + 1, wz) === 13) {
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
            let faceLight: number;
            if (nx < 0 || nx >= CHUNK_SIZE || nz < 0 || nz >= CHUNK_SIZE) {
              faceLight = getNeighborLight(worldX + nx, ny, worldZ + nz);
            } else if (ny < 0 || ny >= WORLD_HEIGHT) {
              faceLight = ny >= WORLD_HEIGHT ? 15 : 0;
            } else {
              faceLight = this.getLightAt(nx, ny, nz);
            }

            this.addFace(target, x, y, z, face, id, atlas, depth, faceLight, timeOfDay);
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
    lightLevel: number = 15,
    timeOfDay: number = 0.25
  ) {
    const texKey = BlockRegistry.getTextureForFace(blockId, face);
    const uv = atlas.getUV(texKey);

    const verts = FACE_QUADS[face];
    const baseIdx = data.positions.length / 3;

    for (const [vx, vy, vz] of verts) {
      data.positions.push(x + vx, y + vy, z + vz);
      const [nx, ny, nz] = FACE_DIRS[face];
      data.normals.push(nx, ny, nz);
    }

    // UV mapping
    if (face === 2 || face === 3) {
      data.uvs.push(uv.u0, uv.v0);
      data.uvs.push(uv.u0, uv.v1);
      data.uvs.push(uv.u1, uv.v1);
      data.uvs.push(uv.u1, uv.v0);
    } else {
      data.uvs.push(uv.u0, uv.v0);
      data.uvs.push(uv.u1, uv.v0);
      data.uvs.push(uv.u1, uv.v1);
      data.uvs.push(uv.u0, uv.v1);
    }

    // Compute brightness from light level + face direction shading
    const sunAngle = timeOfDay * Math.PI * 2;
    const sunBrightness = Math.max(0.1, Math.sin(sunAngle));
    const skyBrightness = (lightLevel / 15) * sunBrightness;
    const blockBrightness = lightLevel / 15;
    // Use max of sky-scaled and block light
    const lightBrightness = Math.max(skyBrightness, blockBrightness);
    let brightness = lightBrightness * FACE_BRIGHTNESS[face];
    // Clamp minimum so nothing is completely black
    brightness = Math.max(0.04, Math.min(1.0, brightness));

    if (waterDepth > 0 && blockId !== 13) {
      const tint = Math.max(0.12, Math.pow(0.82, waterDepth));
      brightness *= tint;
    }

    data.colors.push(brightness, brightness, brightness);
    data.colors.push(brightness, brightness, brightness);
    data.colors.push(brightness, brightness, brightness);
    data.colors.push(brightness, brightness, brightness);

    // two triangles
    data.indices.push(
      baseIdx, baseIdx + 1, baseIdx + 2,
      baseIdx, baseIdx + 2, baseIdx + 3
    );
  }

  private addTorch(
    data: ChunkMeshData,
    x: number, y: number, z: number,
    atlas: { getUV(key: string): { u0: number; v0: number; u1: number; v1: number } },
    lightLevel: number = 14
  ) {
    const uv = atlas.getUV('torch');
    const brightness = Math.max(0.2, lightLevel / 15);

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
    lightLevel: number = 15
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
    }, undefined, hinge === 'right', lightLevel);
  }

  private addTrapdoor(
    data: ChunkMeshData,
    x: number, y: number, z: number,
    blockId: number,
    meta: BlockMetadata | undefined,
    atlas: { getUV(key: string): { u0: number; v0: number; u1: number; v1: number } },
    lightLevel: number = 15
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
 
    this.addCuboid(data, x, y, z, blockId, atlas, bounds, {}, customTextureKeys, false, lightLevel);
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
    lightLevel: number = 15
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
    const lightBrightness = Math.max(0.04, lightLevel / 15);

    faces.forEach((faceDef, faceIndex) => {
      const faceName = FACE_NAMES[faceIndex];
      if (!shouldDraw[faceName]) return;

      const texKey = customTextureKeys ? customTextureKeys[faceIndex] : BlockRegistry.getTextureForFace(blockId, faceIndex);
      const uv = atlas.getUV(texKey);
      const baseIdx = data.positions.length / 3;

      for (const [vx, vy, vz] of faceDef.verts) {
        data.positions.push(x + vx, y + vy, z + vz);
        data.normals.push(...faceDef.normal);
        const brightness = Math.max(0.04, FACE_BRIGHTNESS[faceIndex] * lightBrightness);
        data.colors.push(brightness, brightness, brightness);
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
    return id === 37 || id === 38;
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
    lightLevel: number = 15
  ) {
    const facing = meta?.stairFacing ?? 'north';
    // Bottom half (full width, half height)
    const bottomBounds: CuboidBounds = { minX: 0, maxX: 1, minY: 0, maxY: 0.5, minZ: 0, maxZ: 1 };
    this.addCuboid(data, x, y, z, blockId, atlas, bottomBounds, {}, undefined, false, lightLevel);

    // Top step (half block, depends on facing)
    let topBounds: CuboidBounds;
    switch (facing) {
      case 'north': topBounds = { minX: 0, maxX: 1, minY: 0.5, maxY: 1, minZ: 0, maxZ: 0.5 }; break;
      case 'south': topBounds = { minX: 0, maxX: 1, minY: 0.5, maxY: 1, minZ: 0.5, maxZ: 1 }; break;
      case 'east':  topBounds = { minX: 0.5, maxX: 1, minY: 0.5, maxY: 1, minZ: 0, maxZ: 1 }; break;
      case 'west':  topBounds = { minX: 0, maxX: 0.5, minY: 0.5, maxY: 1, minZ: 0, maxZ: 1 }; break;
      default:      topBounds = { minX: 0, maxX: 1, minY: 0.5, maxY: 1, minZ: 0, maxZ: 0.5 };
    }
    this.addCuboid(data, x, y, z, blockId, atlas, topBounds, {}, undefined, false, lightLevel);
  }

  private addFence(
    data: ChunkMeshData,
    x: number, y: number, z: number,
    blockId: number,
    meta: BlockMetadata | undefined,
    atlas: { getUV(key: string): { u0: number; v0: number; u1: number; v1: number } },
    lightLevel: number = 15,
    getNeighborBlock: (wx: number, wy: number, wz: number) => number,
    worldX: number,
    worldZ: number
  ) {
    // Center post: 6x16x6 pixels = 0.375 wide, full height
    const postBounds: CuboidBounds = { minX: 0.25, maxX: 0.75, minY: 0, maxY: 1.5, minZ: 0.25, maxZ: 0.75 };
    this.addCuboid(data, x, y, z, blockId, atlas, postBounds, {}, undefined, false, lightLevel);

    // Check connections to adjacent blocks
    const wx = worldX + x;
    const wz = worldZ + z;
    const isFence = (bid: number) => bid >= 53 && bid <= 56;
    const connectsTo = (bid: number) => isFence(bid) || BlockRegistry.isSolid(bid);

    // North (-Z)
    if (connectsTo(getNeighborBlock(wx, y, wz - 1))) {
      const b: CuboidBounds = { minX: 0.25, maxX: 0.75, minY: 0.375, maxY: 1.25, minZ: 0, maxZ: 0.25 };
      this.addCuboid(data, x, y, z, blockId, atlas, b, {}, undefined, false, lightLevel);
    }
    // South (+Z)
    if (connectsTo(getNeighborBlock(wx, y, wz + 1))) {
      const b: CuboidBounds = { minX: 0.25, maxX: 0.75, minY: 0.375, maxY: 1.25, minZ: 0.75, maxZ: 1 };
      this.addCuboid(data, x, y, z, blockId, atlas, b, {}, undefined, false, lightLevel);
    }
    // East (+X)
    if (connectsTo(getNeighborBlock(wx + 1, y, wz))) {
      const b: CuboidBounds = { minX: 0.75, maxX: 1, minY: 0.375, maxY: 1.25, minZ: 0.25, maxZ: 0.75 };
      this.addCuboid(data, x, y, z, blockId, atlas, b, {}, undefined, false, lightLevel);
    }
    // West (-X)
    if (connectsTo(getNeighborBlock(wx - 1, y, wz))) {
      const b: CuboidBounds = { minX: 0, maxX: 0.25, minY: 0.375, maxY: 1.25, minZ: 0.25, maxZ: 0.75 };
      this.addCuboid(data, x, y, z, blockId, atlas, b, {}, undefined, false, lightLevel);
    }
  }

  private addPlant(
    data: ChunkMeshData,
    x: number, y: number, z: number,
    blockId: number,
    atlas: { getUV(key: string): { u0: number; v0: number; u1: number; v1: number } },
    lightLevel: number = 15
  ) {
    const texKey = BlockRegistry.getTextureForFace(blockId, 0);
    const uv = atlas.getUV(texKey);
    const brightness = Math.max(0.04, lightLevel / 15);

    // Two diagonal planes forming an X shape
    // Plane 1: NW to SE
    this.addPlantQuad(data,
      [x, y, z], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z],
      [-0.707, 0, 0.707], uv, brightness
    );
    this.addPlantQuad(data,
      [x + 1, y, z + 1], [x, y, z], [x, y + 1, z], [x + 1, y + 1, z + 1],
      [0.707, 0, -0.707], uv, brightness
    );

    // Plane 2: NE to SW
    this.addPlantQuad(data,
      [x + 1, y, z], [x, y, z + 1], [x, y + 1, z + 1], [x + 1, y + 1, z],
      [0.707, 0, 0.707], uv, brightness
    );
    this.addPlantQuad(data,
      [x, y, z + 1], [x + 1, y, z], [x + 1, y + 1, z], [x, y + 1, z + 1],
      [-0.707, 0, -0.707], uv, brightness
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
    brightness: number
  ) {
    const baseIdx = data.positions.length / 3;
    data.positions.push(...p1, ...p2, ...p3, ...p4);
    for (let i = 0; i < 4; i++) {
      data.normals.push(...normal);
      data.colors.push(brightness, brightness, brightness);
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
