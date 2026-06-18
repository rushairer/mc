import * as THREE from 'three';
import { Chunk } from './Chunk';
import { WorldGen } from './WorldGen';
import { BlockRegistry } from './BlockRegistry';
import { CHUNK_SIZE, WORLD_HEIGHT, RENDER_DISTANCE } from '../constants';
import { TextureAtlas } from '../engine/TextureAtlas';
import type { BlockMetadata, SerializedBlockMetadata } from '../types';

export class ChunkManager {
  chunks: Map<string, Chunk> = new Map();
  private worldGen: WorldGen;
  private atlas: TextureAtlas;
  private scene: THREE.Scene;
  private material: THREE.MeshBasicMaterial;
  private transparentMaterial: THREE.MeshBasicMaterial;
  timeOfDay = 0.25;

  constructor(scene: THREE.Scene, atlas: TextureAtlas, seed: number) {
    this.scene = scene;
    this.atlas = atlas;
    this.worldGen = new WorldGen(seed);

    this.material = new THREE.MeshBasicMaterial({
      map: atlas.getTexture(),
      vertexColors: true,
      side: THREE.FrontSide,
      alphaTest: 0.1,
    });

    this.transparentMaterial = new THREE.MeshBasicMaterial({
      map: atlas.getTexture(),
      vertexColors: true,
      transparent: true,
      side: THREE.FrontSide,
      depthWrite: false,
    });

    const setupLightningShader = (material: THREE.Material) => {
      material.onBeforeCompile = (shader) => {
        shader.uniforms.lightningOffset = { value: 0 };
        shader.vertexShader = shader.vertexShader.replace(
          '#include <common>',
          '#include <common>\nuniform float lightningOffset;'
        );
        shader.vertexShader = shader.vertexShader.replace(
          '#include <color_vertex>',
          '#include <color_vertex>\nvColor = clamp(vColor + vec3(lightningOffset), 0.0, 1.0);'
        );
        material.userData.shader = shader;
      };
    };

    setupLightningShader(this.material);
    setupLightningShader(this.transparentMaterial);
  }

  static key(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  static fromKey(key: string): [number, number] {
    const parts = key.split(',');
    return [parseInt(parts[0]), parseInt(parts[1])];
  }

  getChunk(cx: number, cz: number): Chunk | undefined {
    return this.chunks.get(ChunkManager.key(cx, cz));
  }

  getBlock(wx: number, wy: number, wz: number): number {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return 0;

    let lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    let lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return chunk.getBlock(lx, wy, lz);
  }

  getLight(wx: number, wy: number, wz: number): number {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return 15;

    let lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    let lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return chunk.getLightAt(lx, wy, lz);
  }

  getSkyLight(wx: number, wy: number, wz: number): number {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return 15;

    let lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    let lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return chunk.getSkyLightAt(lx, wy, lz);
  }

  getBlockLight(wx: number, wy: number, wz: number): number {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return 0;

    let lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    let lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return chunk.getBlockLightAt(lx, wy, lz);
  }

  setBlock(wx: number, wy: number, wz: number, id: number) {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return;

    let lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    let lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    chunk.setBlock(lx, wy, lz, id);

    // Mark neighbor chunks as dirty if on boundary
    if (lx === 0) this.markDirty(cx - 1, cz);
    if (lx === CHUNK_SIZE - 1) this.markDirty(cx + 1, cz);
    if (lz === 0) this.markDirty(cx, cz - 1);
    if (lz === CHUNK_SIZE - 1) this.markDirty(cx, cz + 1);

    // Recompute light for this chunk and rebuild
    this.computeChunkLight(chunk);
    this.rebuildChunkMesh(chunk);
  }

  getBlockMeta(wx: number, wy: number, wz: number): BlockMetadata | undefined {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return undefined;

    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return chunk.getBlockMeta(lx, wy, lz);
  }

  isSolidBlock(wx: number, wy: number, wz: number): boolean {
    const blockId = this.getBlock(wx, wy, wz);
    const def = BlockRegistry.get(blockId);
    const isDoorOrTrapdoor = def && (def.name.endsWith('door') || def.name.includes('trapdoor'));
    if (isDoorOrTrapdoor) {
      const meta = this.getBlockMeta(wx, wy, wz);
      return !meta?.open;
    }
    return BlockRegistry.isSolid(blockId);
  }

  setBlockMeta(wx: number, wy: number, wz: number, metadata: BlockMetadata | null, markDirty = false) {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return;

    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    chunk.setBlockMeta(lx, wy, lz, metadata, markDirty);
  }

  restoreChunk(cx: number, cz: number, data: Uint16Array, metadata?: SerializedBlockMetadata[]) {
    const key = ChunkManager.key(cx, cz);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = new Chunk(cx, cz);
      this.chunks.set(key, chunk);
    } else {
      if (chunk.mesh) {
        this.scene.remove(chunk.mesh);
        chunk.mesh.geometry.dispose();
        chunk.mesh = null;
      }
      if (chunk.transparentMesh) {
        this.scene.remove(chunk.transparentMesh);
        chunk.transparentMesh.geometry.dispose();
        chunk.transparentMesh = null;
      }
    }

    chunk.data = new Uint16Array(data);
    chunk.restoreMetadata(metadata);
    this.computeChunkLight(chunk);
    this.rebuildChunkMesh(chunk);

    this.markDirty(cx - 1, cz);
    this.markDirty(cx + 1, cz);
    this.markDirty(cx, cz - 1);
    this.markDirty(cx, cz + 1);
  }

  private markDirty(cx: number, cz: number) {
    const chunk = this.getChunk(cx, cz);
    if (chunk) {
      chunk.dirty = true;
      this.rebuildChunkMesh(chunk);
    }
  }

  update(playerX: number, playerZ: number) {
    const pcx = Math.floor(playerX / CHUNK_SIZE);
    const pcz = Math.floor(playerZ / CHUNK_SIZE);

    const neededChunks = new Set<string>();

    // Load chunks within render distance
    for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
      for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
        if (dx * dx + dz * dz > RENDER_DISTANCE * RENDER_DISTANCE) continue;

        const cx = pcx + dx;
        const cz = pcz + dz;
        const key = ChunkManager.key(cx, cz);
        neededChunks.add(key);

        if (!this.chunks.has(key)) {
          this.loadChunk(cx, cz);
        }
      }
    }

    // Unload distant chunks
    for (const [key, chunk] of this.chunks) {
      if (!neededChunks.has(key)) {
        this.unloadChunk(key, chunk);
      }
    }

    // Rebuild dirty chunks (limit per frame for perf)
    let rebuilt = 0;
    for (const chunk of this.chunks.values()) {
      if (chunk.dirty && rebuilt < 4) {
        this.rebuildChunkMesh(chunk);
        rebuilt++;
      }
    }
  }

  private loadChunk(cx: number, cz: number) {
    const chunk = new Chunk(cx, cz);
    this.worldGen.generateChunk(chunk);
    this.chunks.set(ChunkManager.key(cx, cz), chunk);
    this.computeChunkLight(chunk);
    this.rebuildChunkMesh(chunk);

    // Mark loaded neighbors as dirty so they rebuild and cull boundary faces
    this.markDirty(cx - 1, cz);
    this.markDirty(cx + 1, cz);
    this.markDirty(cx, cz - 1);
    this.markDirty(cx, cz + 1);
  }

  private computeChunkLight(chunk: Chunk) {
    const getNeighborBlock = (wx: number, wy: number, wz: number): number => {
      return this.getBlock(wx, wy, wz);
    };

    chunk.computeSkyLight(getNeighborBlock);
    chunk.computeBlockLight();
  }

  private unloadChunk(key: string, chunk: Chunk) {
    const [cx, cz] = ChunkManager.fromKey(key);
    if (chunk.mesh) {
      this.scene.remove(chunk.mesh);
      chunk.mesh.geometry.dispose();
    }
    if (chunk.transparentMesh) {
      this.scene.remove(chunk.transparentMesh);
      chunk.transparentMesh.geometry.dispose();
    }
    this.chunks.delete(key);

    // Mark remaining loaded neighbors as dirty so they rebuild and render border faces against the empty air
    this.markDirty(cx - 1, cz);
    this.markDirty(cx + 1, cz);
    this.markDirty(cx, cz - 1);
    this.markDirty(cx, cz + 1);
  }

  private rebuildChunkMesh(chunk: Chunk) {
    // Remove old meshes
    if (chunk.mesh) {
      this.scene.remove(chunk.mesh);
      chunk.mesh.geometry.dispose();
      chunk.mesh = null;
    }
    if (chunk.transparentMesh) {
      this.scene.remove(chunk.transparentMesh);
      chunk.transparentMesh.geometry.dispose();
      chunk.transparentMesh = null;
    }

    const getNeighborBlock = (wx: number, wy: number, wz: number): number => {
      return this.getBlock(wx, wy, wz);
    };

    const getNeighborSkyLight = (wx: number, wy: number, wz: number): number => {
      return this.getSkyLight(wx, wy, wz);
    };

    const getNeighborBlockLight = (wx: number, wy: number, wz: number): number => {
      return this.getBlockLight(wx, wy, wz);
    };

    const { solidGeo, transparentGeo } = chunk.buildMesh(
      this.atlas, getNeighborBlock, getNeighborSkyLight, getNeighborBlockLight, this.timeOfDay
    );

    if (solidGeo.attributes.position) {
      chunk.mesh = new THREE.Mesh(solidGeo, this.material);
      chunk.mesh.position.set(chunk.cx * CHUNK_SIZE, 0, chunk.cz * CHUNK_SIZE);
      chunk.mesh.matrixAutoUpdate = false;
      chunk.mesh.updateMatrix();
      this.scene.add(chunk.mesh);
    }

    if (transparentGeo.attributes.position) {
      chunk.transparentMesh = new THREE.Mesh(transparentGeo, this.transparentMaterial);
      chunk.transparentMesh.position.set(chunk.cx * CHUNK_SIZE, 0, chunk.cz * CHUNK_SIZE);
      chunk.transparentMesh.matrixAutoUpdate = false;
      chunk.transparentMesh.updateMatrix();
      this.scene.add(chunk.transparentMesh);
    }
  }

  setLightningOffset(offset: number) {
    if (this.material.userData.shader) {
      this.material.userData.shader.uniforms.lightningOffset.value = offset;
    }
    if (this.transparentMaterial.userData.shader) {
      this.transparentMaterial.userData.shader.uniforms.lightningOffset.value = offset;
    }
  }

  getWorldGen(): WorldGen {
    return this.worldGen;
  }

  getLoadedChunkCount(): number {
    return this.chunks.size;
  }

  getBiomeAt(wx: number, wz: number) {
    return this.worldGen.getBiome(wx, wz);
  }
}
