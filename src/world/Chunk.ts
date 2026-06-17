import * as THREE from 'three';
import { CHUNK_SIZE, WORLD_HEIGHT } from '../constants';
import { BlockRegistry } from './BlockRegistry';
import type { BlockMetadata, ChunkMeshData, SerializedBlockMetadata } from '../types';

export class Chunk {
  data: Uint8Array;
  metadata: Map<number, BlockMetadata> = new Map();
  mesh: THREE.Mesh | null = null;
  transparentMesh: THREE.Mesh | null = null;
  dirty = true;
  cx: number;
  cz: number;

  constructor(cx: number, cz: number) {
    this.cx = cx;
    this.cz = cz;
    this.data = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT);
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

  /**
   * Build optimized mesh using greedy meshing.
   * getNeighborBlock: (wx, wy, wz) => blockId for cross-chunk lookups
   */
  buildMesh(
    atlas: { getUV(key: string): { u0: number; v0: number; u1: number; v1: number } },
    getNeighborBlock: (wx: number, wy: number, wz: number) => number
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
          const target = isTrans ? transparent : solid;

          if (id === 30) {
            this.addTorch(target, x, y, z, atlas);
            continue;
          }

          if (id === 37 || id === 38) {
            this.addDoor(target, x, y, z, id, meta, atlas);
            continue;
          }

          if (id === 39 || id === 40) {
            this.addTrapdoor(target, x, y, z, id, meta, atlas);
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

            this.addFace(target, x, y, z, face, id, atlas, depth);
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
    waterDepth: number = 0
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
    data.uvs.push(uv.u0, uv.v0);
    data.uvs.push(uv.u1, uv.v0);
    data.uvs.push(uv.u1, uv.v1);
    data.uvs.push(uv.u0, uv.v1);

    // face brightness based on face direction
    let brightness = FACE_BRIGHTNESS[face];
    if (waterDepth > 0 && blockId !== 13) {
      // Exponential attenuation of light in water
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
    atlas: { getUV(key: string): { u0: number; v0: number; u1: number; v1: number } }
  ) {
    const uv = atlas.getUV('torch');
    const brightness = 1.0; // Torches glow fully

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
    atlas: { getUV(key: string): { u0: number; v0: number; u1: number; v1: number } }
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
    });
  }

  private addTrapdoor(
    data: ChunkMeshData,
    x: number, y: number, z: number,
    blockId: number,
    meta: BlockMetadata | undefined,
    atlas: { getUV(key: string): { u0: number; v0: number; u1: number; v1: number } }
  ) {
    const thickness = 0.1875;
    const facing = meta?.facing ?? 'north';
    const isOpen = meta?.open ?? false;
    const textureBlockId = 39;

    let bounds: CuboidBounds;
    if (!isOpen) {
      bounds = { minX: 0, maxX: 1, minY: 0, maxY: thickness, minZ: 0, maxZ: 1 };
    } else {
      switch (facing) {
        case 'north':
          bounds = { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: thickness };
          break;
        case 'south':
          bounds = { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 1 - thickness, maxZ: 1 };
          break;
        case 'east':
          bounds = { minX: 1 - thickness, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 1 };
          break;
        case 'west':
          bounds = { minX: 0, maxX: thickness, minY: 0, maxY: 1, minZ: 0, maxZ: 1 };
          break;
        default:
          bounds = { minX: 0, maxX: 1, minY: 0, maxY: thickness, minZ: 0, maxZ: 1 };
      }
    }

    this.addCuboid(data, x, y, z, textureBlockId, atlas, bounds);
  }

  private addCuboid(
    data: ChunkMeshData,
    x: number, y: number, z: number,
    blockId: number,
    atlas: { getUV(key: string): { u0: number; v0: number; u1: number; v1: number } },
    bounds: CuboidBounds,
    faceOverrides: Partial<Record<'top' | 'bottom', boolean>> = {}
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

    faces.forEach((faceDef, faceIndex) => {
      const faceName = FACE_NAMES[faceIndex];
      if (!shouldDraw[faceName]) return;

      const uv = atlas.getUV(BlockRegistry.getTextureForFace(blockId, faceIndex));
      const baseIdx = data.positions.length / 3;

      for (const [vx, vy, vz] of faceDef.verts) {
        data.positions.push(x + vx, y + vy, z + vz);
        data.normals.push(...faceDef.normal);
        const brightness = FACE_BRIGHTNESS[faceIndex];
        data.colors.push(brightness, brightness, brightness);
      }

      data.uvs.push(uv.u0, uv.v0);
      data.uvs.push(uv.u1, uv.v0);
      data.uvs.push(uv.u1, uv.v1);
      data.uvs.push(uv.u0, uv.v1);
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
