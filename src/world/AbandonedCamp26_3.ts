import { CHUNK_SIZE, SEA_LEVEL, WORLD_HEIGHT } from '../constants';
import { coordinateRandom } from '../engine/DeterministicRandom';
import { ItemRegistry } from '../items/ItemRegistry';
import type { ItemStack } from '../types';
import { BlockRegistry } from './BlockRegistry';
import { Chunk } from './Chunk';
import { BiomeType, type WorldGen } from './WorldGen';
import {
  ABANDONED_CAMP_BIOMES,
  EXPLORER_MAP_NAMES,
  getWildernessBoundIds,
} from './WildernessBound26_3';

export type AbandonedCampVariant26_3 = typeof ABANDONED_CAMP_BIOMES[number];

export interface AbandonedCampPlan26_3 {
  id: string;
  centerX: number;
  centerY: number;
  centerZ: number;
  cellX: number;
  cellZ: number;
  variant: AbandonedCampVariant26_3;
}

const CAMP_CELL_SIZE = 192;
const CAMP_RADIUS = 7;
const CAMP_SPAWN_CHANCE = 0.22;

function dappledForestAt(worldGen: WorldGen, x: number, z: number): boolean {
  if (worldGen.getBiome(x, z) !== BiomeType.Forest) return false;
  const radius = 96;
  return [
    [radius, 0], [-radius, 0], [0, radius], [0, -radius],
    [radius, radius], [radius, -radius], [-radius, radius], [-radius, -radius],
  ].some(([dx, dz]) => worldGen.getBiome(x + dx, z + dz) === BiomeType.Snow);
}

export function abandonedCampVariantForLegacyBiome26_3(
  worldGen: WorldGen,
  x: number,
  z: number,
): AbandonedCampVariant26_3 | null {
  const biome = worldGen.getBiome(x, z);
  if (biome === BiomeType.Forest) return dappledForestAt(worldGen, x, z) ? 'dappled_forest' : 'forest';
  if (biome === BiomeType.Plains) return 'meadow';
  if (biome === BiomeType.Mountains) return 'windswept_forest';
  if (biome === BiomeType.Snow) return 'snowy_taiga';
  if (biome === BiomeType.Jungle) return coordinateRandom(worldGen.seed, x, 2710, z) < 0.5 ? 'bamboo_jungle' : 'sparse_jungle';
  if (biome === BiomeType.Swamp) return 'swamp';
  if (biome === BiomeType.Badlands) return 'wooded_badlands';
  return null;
}

export function getAbandonedCampPlanForCell26_3(
  worldGen: WorldGen,
  cellX: number,
  cellZ: number,
): AbandonedCampPlan26_3 | null {
  if (coordinateRandom(worldGen.seed, cellX, 2711, cellZ) >= CAMP_SPAWN_CHANCE) return null;

  const offsetX = Math.floor((coordinateRandom(worldGen.seed, cellX, 2712, cellZ) - 0.5) * 80);
  const offsetZ = Math.floor((coordinateRandom(worldGen.seed, cellX, 2713, cellZ) - 0.5) * 80);
  const centerX = cellX * CAMP_CELL_SIZE + Math.floor(CAMP_CELL_SIZE / 2) + offsetX;
  const centerZ = cellZ * CAMP_CELL_SIZE + Math.floor(CAMP_CELL_SIZE / 2) + offsetZ;
  const variant = abandonedCampVariantForLegacyBiome26_3(worldGen, centerX, centerZ);
  if (!variant) return null;

  const centerY = worldGen.getTerrainHeight(centerX, centerZ);
  if (centerY <= SEA_LEVEL + 1 || centerY >= WORLD_HEIGHT - 8) return null;

  let maxDelta = 0;
  for (const [dx, dz] of [[-5, -5], [5, -5], [-5, 5], [5, 5]] as const) {
    maxDelta = Math.max(maxDelta, Math.abs(worldGen.getTerrainHeight(centerX + dx, centerZ + dz) - centerY));
  }
  if (maxDelta > 4) return null;

  return {
    id: `${cellX},${cellZ}`,
    centerX,
    centerY,
    centerZ,
    cellX,
    cellZ,
    variant,
  };
}

export function getNearbyAbandonedCamps26_3(
  worldGen: WorldGen,
  x: number,
  z: number,
  radius: number,
): AbandonedCampPlan26_3[] {
  const minCellX = Math.floor((x - radius) / CAMP_CELL_SIZE);
  const maxCellX = Math.floor((x + radius) / CAMP_CELL_SIZE);
  const minCellZ = Math.floor((z - radius) / CAMP_CELL_SIZE);
  const maxCellZ = Math.floor((z + radius) / CAMP_CELL_SIZE);
  const plans: AbandonedCampPlan26_3[] = [];
  for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
    for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ++) {
      const plan = getAbandonedCampPlanForCell26_3(worldGen, cellX, cellZ);
      if (!plan) continue;
      const dx = plan.centerX - x;
      const dz = plan.centerZ - z;
      if (dx * dx + dz * dz <= radius * radius) plans.push(plan);
    }
  }
  return plans;
}

export function findExplorerCampTarget26_3(
  worldGen: WorldGen,
  source: AbandonedCampPlan26_3,
  searchCells = 8,
): AbandonedCampPlan26_3 | null {
  let nearest: AbandonedCampPlan26_3 | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (let dx = -searchCells; dx <= searchCells; dx++) {
    for (let dz = -searchCells; dz <= searchCells; dz++) {
      if (dx === 0 && dz === 0) continue;
      const candidate = getAbandonedCampPlanForCell26_3(worldGen, source.cellX + dx, source.cellZ + dz);
      if (!candidate || candidate.variant === source.variant) continue;
      const distX = candidate.centerX - source.centerX;
      const distZ = candidate.centerZ - source.centerZ;
      const distance = distX * distX + distZ * distZ;
      if (distance < nearestDistance) {
        nearest = candidate;
        nearestDistance = distance;
      }
    }
  }
  return nearest;
}

function resolveItem(name: string, fallback?: number): number | undefined {
  return ItemRegistry.getByName(name)?.id ?? fallback;
}

function stack(name: string, count = 1): ItemStack | null {
  const id = resolveItem(name);
  return id === undefined ? null : { id, count };
}

export function buildAbandonedCampLoot26_3(
  worldGen: WorldGen,
  plan: AbandonedCampPlan26_3,
  container: 'chest' | 'barrel',
): (ItemStack | null)[] {
  const size = container === 'chest' ? 27 : 27;
  const inventory: (ItemStack | null)[] = Array(size).fill(null);
  const candidates: ItemStack[] = [];
  const add = (value: ItemStack | null) => { if (value) candidates.push(value); };

  add(stack('bread', 1 + Math.floor(coordinateRandom(worldGen.seed, plan.centerX, 2720, plan.centerZ) * 3)));
  add(stack('torch', 2 + Math.floor(coordinateRandom(worldGen.seed, plan.centerX, 2721, plan.centerZ) * 5)));
  add(stack('gunpowder', 1 + Math.floor(coordinateRandom(worldGen.seed, plan.centerX, 2722, plan.centerZ) * 3)));
  add(stack('white_cushion'));
  add(stack('straw_bed'));

  if (container === 'chest') {
    const target = findExplorerCampTarget26_3(worldGen, plan);
    const mapName = target
      ? 'abandoned_camp_map'
      : EXPLORER_MAP_NAMES[Math.floor(coordinateRandom(worldGen.seed, plan.centerX, 2723, plan.centerZ) * EXPLORER_MAP_NAMES.length)];
    add(stack(mapName));
  } else {
    add(stack('shelf_mushroom', 1 + Math.floor(coordinateRandom(worldGen.seed, plan.centerX, 2724, plan.centerZ) * 2)));
  }

  for (let i = 0; i < candidates.length; i++) {
    const slot = Math.floor(coordinateRandom(worldGen.seed, plan.centerX + i, 2725, plan.centerZ - i) * size);
    let cursor = slot;
    while (inventory[cursor] && cursor < size - 1) cursor++;
    while (inventory[cursor] && cursor > 0) cursor--;
    if (!inventory[cursor]) inventory[cursor] = candidates[i];
  }
  return inventory;
}

function setWorldBlock(chunk: Chunk, wx: number, y: number, wz: number, id: number): boolean {
  const worldX = chunk.cx * CHUNK_SIZE;
  const worldZ = chunk.cz * CHUNK_SIZE;
  const x = wx - worldX;
  const z = wz - worldZ;
  if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE || y < 1 || y >= WORLD_HEIGHT) return false;
  chunk.setBlock(x, y, z, id);
  return true;
}

function setWorldMeta(chunk: Chunk, wx: number, y: number, wz: number, metadata: Parameters<Chunk['setBlockMeta']>[3]): void {
  const x = wx - chunk.cx * CHUNK_SIZE;
  const z = wz - chunk.cz * CHUNK_SIZE;
  if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE || y < 1 || y >= WORLD_HEIGHT) return;
  chunk.setBlockMeta(x, y, z, metadata, true);
}

function clearWorldColumn(chunk: Chunk, wx: number, y: number, wz: number, height: number): void {
  for (let dy = 1; dy <= height; dy++) setWorldBlock(chunk, wx, y + dy, wz, 0);
}

function placeCampPlan(worldGen: WorldGen, chunk: Chunk, plan: AbandonedCampPlan26_3): void {
  const ids = getWildernessBoundIds();
  const poplarLog = ids.poplarLog;
  const planks = ids.poplarPlanks;
  const campfire = BlockRegistry.getByName('campfire')?.id;
  const chest = BlockRegistry.getByName('chest')?.id ?? 54;
  const barrel = BlockRegistry.getByName('barrel')?.id;
  const hay = BlockRegistry.getByName('hay_block')?.id ?? ItemRegistry.getByName('hay_block')?.placeBlockId;
  const centerY = plan.centerY;

  // Common platform / cleared campsite.
  for (let dx = -5; dx <= 5; dx++) {
    for (let dz = -5; dz <= 5; dz++) {
      const wx = plan.centerX + dx;
      const wz = plan.centerZ + dz;
      const y = worldGen.getTerrainHeight(wx, wz);
      if (Math.abs(y - centerY) > 4) continue;
      clearWorldColumn(chunk, wx, y, wz, 4);
      if (Math.abs(dx) <= 3 && Math.abs(dz) <= 3) setWorldBlock(chunk, wx, y, wz, planks);
    }
  }

  // Fallen/rack logs and a small biome-neutral shelter outline.
  for (let dx = -4; dx <= 4; dx++) {
    setWorldBlock(chunk, plan.centerX + dx, centerY + 1, plan.centerZ - 4, poplarLog);
  }
  for (let dy = 1; dy <= 3; dy++) {
    setWorldBlock(chunk, plan.centerX - 4, centerY + dy, plan.centerZ - 4, poplarLog);
    setWorldBlock(chunk, plan.centerX + 4, centerY + dy, plan.centerZ - 4, poplarLog);
  }

  if (campfire !== undefined) setWorldBlock(chunk, plan.centerX, centerY + 1, plan.centerZ, campfire);
  if (hay !== undefined) {
    setWorldBlock(chunk, plan.centerX - 3, centerY + 1, plan.centerZ + 3, hay);
    setWorldBlock(chunk, plan.centerX - 2, centerY + 1, plan.centerZ + 3, hay);
  }
  setWorldBlock(chunk, plan.centerX + 2, centerY + 1, plan.centerZ + 3, ids.strawBed);

  if (setWorldBlock(chunk, plan.centerX + 4, centerY + 1, plan.centerZ + 2, chest)) {
    setWorldMeta(chunk, plan.centerX + 4, centerY + 1, plan.centerZ + 2, {
      containerType: 'chest',
      inventory: buildAbandonedCampLoot26_3(worldGen, plan, 'chest'),
    });
  }
  if (barrel !== undefined && setWorldBlock(chunk, plan.centerX - 4, centerY + 1, plan.centerZ + 2, barrel)) {
    setWorldMeta(chunk, plan.centerX - 4, centerY + 1, plan.centerZ + 2, {
      containerType: 'barrel',
      inventory: buildAbandonedCampLoot26_3(worldGen, plan, 'barrel'),
    });
  }
}

export function decorateAbandonedCampChunk26_3(worldGen: WorldGen, chunk: Chunk): AbandonedCampPlan26_3[] {
  const chunkMinX = chunk.cx * CHUNK_SIZE;
  const chunkMinZ = chunk.cz * CHUNK_SIZE;
  const centerX = chunkMinX + Math.floor(CHUNK_SIZE / 2);
  const centerZ = chunkMinZ + Math.floor(CHUNK_SIZE / 2);
  const plans = getNearbyAbandonedCamps26_3(worldGen, centerX, centerZ, CAMP_CELL_SIZE + CAMP_RADIUS + CHUNK_SIZE);
    .filter(plan =>
      plan.centerX + CAMP_RADIUS >= chunkMinX
      && plan.centerX - CAMP_RADIUS < chunkMinX + CHUNK_SIZE
      && plan.centerZ + CAMP_RADIUS >= chunkMinZ
      && plan.centerZ - CAMP_RADIUS < chunkMinZ + CHUNK_SIZE,
    );
  for (const plan of plans) placeCampPlan(worldGen, chunk, plan);
  return plans;
}
