import { CHUNK_SIZE, WORLD_HEIGHT } from '../constants';
import { coordinateRandom } from '../engine/DeterministicRandom';
import { Chunk } from './Chunk';
import { BiomeType, WorldGen } from './WorldGen';
import {
  POPLAR_LEAF_BLOCKS,
  getWildernessBoundIds,
  poplarLeafVariantForGrowth,
} from './WildernessBound26_3';

let installed = false;

const COLD_NEIGHBOR_RADIUS = 96;
const DAPPLED_SAMPLES: ReadonlyArray<readonly [number, number]> = [
  [COLD_NEIGHBOR_RADIUS, 0],
  [-COLD_NEIGHBOR_RADIUS, 0],
  [0, COLD_NEIGHBOR_RADIUS],
  [0, -COLD_NEIGHBOR_RADIUS],
  [COLD_NEIGHBOR_RADIUS, COLD_NEIGHBOR_RADIUS],
  [COLD_NEIGHBOR_RADIUS, -COLD_NEIGHBOR_RADIUS],
  [-COLD_NEIGHBOR_RADIUS, COLD_NEIGHBOR_RADIUS],
  [-COLD_NEIGHBOR_RADIUS, -COLD_NEIGHBOR_RADIUS],
];

/**
 * The legacy generator does not yet expose modern multi-noise biome climate
 * bands. Treat Forest cells adjacent to the project's Snow biome as the 26.3
 * Dappled Forest overlay so new content participates in real chunk generation
 * without changing old biome numeric ids or save compatibility.
 */
export function isDappledForestOverlay(worldGen: Pick<WorldGen, 'getBiome'>, wx: number, wz: number): boolean {
  if (worldGen.getBiome(wx, wz) !== BiomeType.Forest) return false;
  return DAPPLED_SAMPLES.some(([dx, dz]) => worldGen.getBiome(wx + dx, wz + dz) === BiomeType.Snow);
}

function setIfAir(chunk: Chunk, x: number, y: number, z: number, id: number): boolean {
  if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE || y < 1 || y >= WORLD_HEIGHT) return false;
  if (chunk.getBlock(x, y, z) !== 0) return false;
  chunk.setBlock(x, y, z, id);
  return true;
}

function isGrassSurface(chunk: Chunk, x: number, y: number, z: number): boolean {
  return (chunk.getBlock(x, y, z) & 0x3ff) === 2;
}

function placeShelfMushroom(chunk: Chunk, x: number, y: number, z: number, salt: number): void {
  const shelf = getWildernessBoundIds().shelfMushroom;
  const side = salt & 3;
  const offsets = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  const [dx, dz] = offsets[side];
  setIfAir(chunk, x + dx, y, z + dz, shelf);
}

function placePoplarTree(worldGen: WorldGen, chunk: Chunk, x: number, z: number, wx: number, wz: number): boolean {
  const surfaceY = worldGen.getTerrainHeight(wx, wz);
  if (!isGrassSurface(chunk, x, surfaceY, z)) return false;
  if (chunk.getBlock(x, surfaceY + 1, z) !== 0) return false;

  const ids = getWildernessBoundIds();
  const heightRoll = coordinateRandom(worldGen.seed, wx, 2631, wz);
  const trunkHeight = 7 + Math.floor(heightRoll * 6);
  const top = surfaceY + trunkHeight;
  if (top + 3 >= WORLD_HEIGHT) return false;

  const leafColor = poplarLeafVariantForGrowth(coordinateRandom(worldGen.seed, wx, 2632, wz));
  const leaves = POPLAR_LEAF_BLOCKS[leafColor].id;

  for (let y = surfaceY + 1; y <= top; y++) {
    chunk.setBlock(x, y, z, ids.poplarLog);
  }

  for (let dy = -3; dy <= 2; dy++) {
    const y = top + dy;
    const radius = dy === 2 ? 1 : dy <= -2 ? 2 : 3;
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        const manhattan = Math.abs(dx) + Math.abs(dz);
        if (manhattan > radius + 1 || (dx === 0 && dz === 0 && y <= top)) continue;
        const hole = coordinateRandom(worldGen.seed, wx + dx, 2633 + dy, wz + dz);
        if (hole < 0.12 && manhattan >= radius) continue;
        setIfAir(chunk, x + dx, y, z + dz, leaves);
      }
    }
  }

  if (trunkHeight >= 8) {
    const shelfY = surfaceY + 2 + Math.floor(coordinateRandom(worldGen.seed, wx, 2634, wz) * (trunkHeight - 4));
    placeShelfMushroom(chunk, x, shelfY, z, Math.floor(coordinateRandom(worldGen.seed, wx, 2635, wz) * 4));
  }
  return true;
}

function placeFallenPoplar(worldGen: WorldGen, chunk: Chunk, x: number, z: number, wx: number, wz: number): boolean {
  const ids = getWildernessBoundIds();
  const alongX = coordinateRandom(worldGen.seed, wx, 2636, wz) < 0.5;
  const length = 4 + Math.floor(coordinateRandom(worldGen.seed, wx, 2637, wz) * 4);
  const surfaceY = worldGen.getTerrainHeight(wx, wz);

  for (let i = 0; i < length; i++) {
    const lx = x + (alongX ? i : 0);
    const lz = z + (alongX ? 0 : i);
    if (lx < 1 || lx >= CHUNK_SIZE - 1 || lz < 1 || lz >= CHUNK_SIZE - 1) return false;
    const px = wx + (alongX ? i : 0);
    const pz = wz + (alongX ? 0 : i);
    const py = worldGen.getTerrainHeight(px, pz);
    if (Math.abs(py - surfaceY) > 1 || !isGrassSurface(chunk, lx, py, lz) || chunk.getBlock(lx, py + 1, lz) !== 0) return false;
  }

  for (let i = 0; i < length; i++) {
    const lx = x + (alongX ? i : 0);
    const lz = z + (alongX ? 0 : i);
    const px = wx + (alongX ? i : 0);
    const pz = wz + (alongX ? 0 : i);
    const py = worldGen.getTerrainHeight(px, pz);
    chunk.setBlock(lx, py + 1, lz, ids.poplarLog);
  }

  const middle = Math.floor(length / 2);
  const mx = x + (alongX ? middle : 0);
  const mz = z + (alongX ? 0 : middle);
  placeShelfMushroom(chunk, mx, surfaceY + 2, mz, alongX ? 2 : 0);
  return true;
}

function placeRedShrubPatch(worldGen: WorldGen, chunk: Chunk, wx: number, wz: number): void {
  const shrub = getWildernessBoundIds().redShrub;
  for (let x = 1; x < CHUNK_SIZE - 1; x++) {
    for (let z = 1; z < CHUNK_SIZE - 1; z++) {
      const worldX = wx + x;
      const worldZ = wz + z;
      if (coordinateRandom(worldGen.seed, worldX, 2638, worldZ) > 0.025) continue;
      const y = worldGen.getTerrainHeight(worldX, worldZ);
      if (!isGrassSurface(chunk, x, y, z)) continue;
      setIfAir(chunk, x, y + 1, z, shrub);
    }
  }
}

/** Add deterministic 26.3 vegetation to generated Forest chunks near Snow. */
export function decorateWildernessBoundChunk(worldGen: WorldGen, chunk: Chunk): boolean {
  const worldX = chunk.cx * CHUNK_SIZE;
  const worldZ = chunk.cz * CHUNK_SIZE;
  const centerX = worldX + Math.floor(CHUNK_SIZE / 2);
  const centerZ = worldZ + Math.floor(CHUNK_SIZE / 2);
  if (!isDappledForestOverlay(worldGen, centerX, centerZ)) return false;

  const candidates = [
    [4, 4], [11, 4], [4, 11], [11, 11],
  ] as const;
  let trees = 0;
  for (let i = 0; i < candidates.length; i++) {
    const [x, z] = candidates[i];
    const wx = worldX + x;
    const wz = worldZ + z;
    if (i > 0 && coordinateRandom(worldGen.seed, wx, 2639, wz) > 0.62) continue;
    if (placePoplarTree(worldGen, chunk, x, z, wx, wz)) trees++;
  }

  const fallenRoll = coordinateRandom(worldGen.seed, centerX, 2640, centerZ);
  if (fallenRoll < 0.22) {
    placeFallenPoplar(worldGen, chunk, 3, 7, worldX + 3, worldZ + 7);
  }
  placeRedShrubPatch(worldGen, chunk, worldX, worldZ);
  return trees > 0;
}

/**
 * Hook the 26.3 decorator after the legacy generator completes all structures.
 * It is deliberately idempotent and keeps existing seed terrain hashes stable
 * when the latest-version bridge is not installed.
 */
export function installWildernessBoundWorldGen26_3(): void {
  if (installed) return;
  installed = true;
  const originalGenerateChunk = WorldGen.prototype.generateChunk;
  WorldGen.prototype.generateChunk = function generateChunkWithWildernessBound(chunk: Chunk): void {
    originalGenerateChunk.call(this, chunk);
    decorateWildernessBoundChunk(this, chunk);
  };
}

export function isWildernessBoundWorldGen26_3Installed(): boolean {
  return installed;
}
