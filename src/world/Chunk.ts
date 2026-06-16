import * as THREE from 'three';
import { CHUNK_SIZE, WORLD_HEIGHT } from '../constants';
import { BlockRegistry } from './BlockRegistry';
import type { ChunkMeshData } from '../types';

export class Chunk {
  data: Uint8Array;
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
    this.data[this.getIndex(x, y, z)] = id;
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

          const isTrans = def.transparent;
          const target = isTrans ? transparent : solid;

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

const FACE_BRIGHTNESS = [1.0, 0.5, 0.8, 0.8, 0.9, 0.7];
