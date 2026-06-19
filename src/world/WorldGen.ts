import { SimplexNoise } from './SimplexNoise';
import { CHUNK_SIZE, WORLD_HEIGHT, SEA_LEVEL } from '../constants';
import { Chunk } from './Chunk';
import { VillageSystem } from '../systems/VillageSystem';
import type { ItemStack } from '../types';

export enum BiomeType {
  Plains = 0,
  Desert = 1,
  Mountains = 2,
  Forest = 3,
  Snow = 4,
  Ocean = 5,
  Swamp = 6,
  Jungle = 7,
  River = 8,
  MushroomIsland = 9,
  Badlands = 10,
}

export interface BiomeConfig {
  baseHeight: number;
  amplitude: number;
  treeChance: number;
  surfaceBlock: number;
  underBlock: number;
  stoneDepth: number;
}

const STONE = 1;
const GRASS = 2;
const DIRT = 3;
const WATER = 9;
const SAND = 12;
const RED_SAND = (1 << 10) | 12;
const GRAVEL = 13;
const CLAY = 82;
const REEDS = 83;
const CACTUS = 81;
const MELON = 103;
const VINES = 106;
const MYCELIUM = 110;
const LILY_PAD = 111;
const COCOA = 127;
const TERRACOTTA = 172;
const DEAD_BUSH = 32;
const TALL_GRASS = (1 << 10) | 31;
const FERN = (2 << 10) | 31;
const BLUE_ORCHID = (1 << 10) | 38;
const STONE_BRICKS = 98;
const MOSSY_STONE_BRICKS = (1 << 10) | 98;
const CRACKED_STONE_BRICKS = (2 << 10) | 98;
const CHISELED_STONE_BRICKS = (3 << 10) | 98;
const COBBLESTONE = 4;
const MOSSY_COBBLESTONE = 48;
const MOB_SPAWNER = 52;
const CHEST = 54;
const PLANKS = 5;
const WEB = 30;
const RAIL = 66;
const FENCE = 85;
const IRON_BARS = 101;
const TORCH = 50;
const END_PORTAL = 119;
const END_PORTAL_FRAME = 120;

const BIOME_CONFIGS: Record<BiomeType, BiomeConfig> = {
  [BiomeType.Plains]:    { baseHeight: 98, amplitude: 12, treeChance: 0.005, surfaceBlock: 2, underBlock: 3, stoneDepth: 3 },
  [BiomeType.Desert]:    { baseHeight: 97, amplitude: 6,  treeChance: 0,     surfaceBlock: 12, underBlock: 12, stoneDepth: 3 },
  [BiomeType.Mountains]: { baseHeight: 114, amplitude: 50, treeChance: 0.002, surfaceBlock: 2, underBlock: 3, stoneDepth: 4 },
  [BiomeType.Forest]:    { baseHeight: 100, amplitude: 16, treeChance: 0.03,  surfaceBlock: 2, underBlock: 3, stoneDepth: 3 },
  [BiomeType.Snow]:      { baseHeight: 102, amplitude: 20, treeChance: 0.008, surfaceBlock: 80, underBlock: 3, stoneDepth: 3 },
  [BiomeType.Ocean]:     { baseHeight: 74, amplitude: 10, treeChance: 0,     surfaceBlock: 12, underBlock: 3, stoneDepth: 3 },
  [BiomeType.Swamp]:     { baseHeight: 62, amplitude: 3,  treeChance: 0.02,  surfaceBlock: 2, underBlock: 3, stoneDepth: 3 },
  [BiomeType.Jungle]:    { baseHeight: 98, amplitude: 18, treeChance: 0.08,  surfaceBlock: 2, underBlock: 3, stoneDepth: 3 },
  [BiomeType.River]:     { baseHeight: 60, amplitude: 2,  treeChance: 0,     surfaceBlock: 12, underBlock: 12, stoneDepth: 3 },
  [BiomeType.MushroomIsland]: { baseHeight: 75, amplitude: 10, treeChance: 0.02, surfaceBlock: 110, underBlock: 3, stoneDepth: 3 },
  [BiomeType.Badlands]:  { baseHeight: 96, amplitude: 15, treeChance: 0,     surfaceBlock: RED_SAND, underBlock: 172, stoneDepth: 15 },
};

function getBadlandsBlockId(y: number): number {
  const layer = y % 14;
  if (layer === 0 || layer === 1) return (1 << 10) | 172; // Orange hardened clay
  if (layer === 3 || layer === 4) return (4 << 10) | 172; // Yellow hardened clay
  if (layer === 6) return (0 << 10) | 172; // White hardened clay
  if (layer === 8 || layer === 9) return (14 << 10) | 172; // Red hardened clay
  if (layer === 11 || layer === 12) return (12 << 10) | 172; // Brown hardened clay
  return 172; // standard terracotta
}

export class WorldGen {
  private noise: SimplexNoise;
  private temperatureNoise: SimplexNoise;
  private humidityNoise: SimplexNoise;
  private caveNoise: SimplexNoise;
  private riverNoise: SimplexNoise;
  private mushroomNoise: SimplexNoise;
  private treeSeed: number;
  seed: number;

  constructor(seed: number) {
    this.seed = seed;
    this.noise = new SimplexNoise(seed);
    this.temperatureNoise = new SimplexNoise(seed + 100);
    this.humidityNoise = new SimplexNoise(seed + 200);
    this.caveNoise = new SimplexNoise(seed + 300);
    this.riverNoise = new SimplexNoise(seed + 400);
    this.mushroomNoise = new SimplexNoise(seed + 500);
    this.treeSeed = seed;
  }

  getBiome(wx: number, wz: number): BiomeType {
    const continent = 64 + this.noise.fbm2D(wx * 0.008, wz * 0.008, 4) * 30;

    // Rare island patches in deep ocean become mushroom fields instead of random inland spots.
    const mNoise = this.mushroomNoise.noise2D(wx * 0.002, wz * 0.002);
    if (continent < SEA_LEVEL - 4 && mNoise > 0.78) {
      return BiomeType.MushroomIsland;
    }

    if (continent < SEA_LEVEL - 2) return BiomeType.Ocean;

    // Winding channels cut through land, but not through oceans or mushroom islands.
    const rNoise = this.riverNoise.noise2D(wx * 0.004, wz * 0.004);
    if (Math.abs(rNoise) < 0.018) {
      return BiomeType.River;
    }

    const temp = this.temperatureNoise.fbm2D(wx * 0.005, wz * 0.005, 3);
    const humid = this.humidityNoise.fbm2D(wx * 0.005, wz * 0.005, 3);

    if (temp < -0.3) return BiomeType.Snow;
    
    // Badlands (Mesa): Hot & Dry
    if (temp > 0.4 && humid < -0.15) return BiomeType.Badlands;
    
    // Desert: Hot & Dry (lower temperature threshold than Badlands)
    if (temp > 0.35 && humid < 0.1) return BiomeType.Desert;

    // Jungle: Hot & Wet
    if (temp > 0.3 && humid > 0.35) return BiomeType.Jungle;

    // Swamp: Warm & Wet (lower temperature than Jungle)
    if (temp > 0.0 && humid > 0.3) return BiomeType.Swamp;

    // Forest: Wet
    if (humid > 0.25 && temp > -0.1) return BiomeType.Forest;

    if (temp > 0.1) return BiomeType.Mountains;
    return BiomeType.Plains;
  }

  getTerrainHeight(wx: number, wz: number): number {
    const biome = this.getBiome(wx, wz);
    const cfg = BIOME_CONFIGS[biome];

    const n = this.noise.fbm2D(wx * 0.01, wz * 0.01, 6, 2.0, 0.45);
    let height = cfg.baseHeight + n * cfg.amplitude;

    // Smooth river carving transition
    const rNoise = this.riverNoise.noise2D(wx * 0.004, wz * 0.004);
    if (Math.abs(rNoise) < 0.035 && biome !== BiomeType.MushroomIsland && biome !== BiomeType.Ocean) {
      const t = 1 - Math.abs(rNoise) / 0.035;
      height = height * (1 - t) + (60 + n * 2) * t;
    }

    return Math.floor(Math.max(1, Math.min(WORLD_HEIGHT - 2, height)));
  }

  generateChunk(chunk: Chunk) {
    const cx = chunk.cx;
    const cz = chunk.cz;
    const worldX = cx * CHUNK_SIZE;
    const worldZ = cz * CHUNK_SIZE;

    // Phase 1: Generate terrain
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = worldX + x;
        const wz = worldZ + z;

        const height = this.getTerrainHeight(wx, wz);
        const biome = this.getBiome(wx, wz);
        const cfg = BIOME_CONFIGS[biome];

        for (let y = 0; y < WORLD_HEIGHT; y++) {
          let blockId = 0;

          const riverNoise = this.riverNoise.noise2D(wx * 0.004, wz * 0.004);
          const riverBank = Math.abs(riverNoise) < 0.03 && biome !== BiomeType.Ocean && biome !== BiomeType.MushroomIsland;
          const shore = height <= SEA_LEVEL + 1 && height >= SEA_LEVEL - 3;
          const surfaceBlock = this.getSurfaceBlockForColumn(biome, height, y, riverBank, shore);
          const underBlock = this.getUnderBlockForColumn(biome, riverBank, shore, wx, wz);

          if (y === 0) {
            blockId = 7; // bedrock
          } else if (y < height - cfg.stoneDepth) {
            blockId = STONE; // stone
          } else if (y < height) {
            if (biome === BiomeType.Badlands) {
              blockId = getBadlandsBlockId(y);
            } else {
              blockId = underBlock; // dirt/sand/snow under surface
            }
          } else if (y === height) {
            blockId = surfaceBlock; // grass/sand/etc surface
          } else if (y <= SEA_LEVEL && y > height) {
            blockId = WATER; // water (still)
          }

          // Swamp underwater clay generation
          if (biome === BiomeType.Swamp && y < SEA_LEVEL && y >= height - 2) {
            if (blockId === DIRT || blockId === GRASS) {
              const clayNoise = this.noise.noise2D(wx * 0.05, wz * 0.05);
              if (clayNoise > 0.1) {
                blockId = CLAY; // clay
              }
            }
          }

          chunk.setBlock(x, y, z, blockId);
        }
      }
    }

    // Phase 2: Caves
    for (let y = 5; y < WORLD_HEIGHT - 10; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
          const wx = worldX + x;
          const wz = worldZ + z;

          // Smoother, larger vertical structures
          const cave = this.caveNoise.fbm3D(wx * 0.02, y * 0.02, wz * 0.02, 3);
          const cave2 = this.caveNoise.noise3D(wx * 0.015, y * 0.015, wz * 0.015);

          // Caves get larger and more connected (lower threshold) the deeper we go
          const depthFactor = (WORLD_HEIGHT - y) / WORLD_HEIGHT;
          const threshold = 0.50 - depthFactor * 0.12;

          if (cave > threshold && cave2 > 0.05) {
            const current = chunk.getBlock(x, y, z);
            if (current !== 0 && (current & 0x3FF) !== 9 && (current & 0x3FF) !== 11) {
              const height = this.getTerrainHeight(wx, wz);
              if (y <= 10) {
                chunk.setBlock(x, y, z, 11); // Lava (still) at the very bottom
              } else if (y <= SEA_LEVEL && height <= SEA_LEVEL) {
                chunk.setBlock(x, y, z, 9); // Water (still)
              } else {
                chunk.setBlock(x, y, z, 0); // Air
              }
            }
          }
        }
      }
    }

    // Phase 3: Ore distribution
    this.generateOres(chunk, worldX, worldZ);

    // Phase 4: Trees
    this.generateTrees(chunk, worldX, worldZ);

    // Phase 5: Flowers and grass
    this.generateSurfaceDecor(chunk, worldX, worldZ);

    // Phase 6: Villages
    VillageSystem.generateChunk(this, chunk);

    // Phase 7: Dungeons
    this.generateDungeons(chunk, worldX, worldZ);

    // Phase 8: Abandoned mineshafts
    this.generateMineshafts(chunk, worldX, worldZ);

    // Phase 9: Stronghold portal rooms
    this.generateStrongholds(chunk, worldX, worldZ);

    chunk.dirty = true;
  }

  private generateMineshafts(chunk: Chunk, worldX: number, worldZ: number) {
    const cx = chunk.cx;
    const cz = chunk.cz;
    const spacing = 5;
    const offsetX = Math.floor(this.pseudoRandom(this.seed, 509, 127) * spacing);
    const offsetZ = Math.floor(this.pseudoRandom(this.seed, 619, 191) * spacing);

    if (this.positiveMod(cx - offsetX, spacing) !== 0 || this.positiveMod(cz - offsetZ, spacing) !== 0) {
      return;
    }

    const distanceFromSpawnChunks = Math.sqrt(cx * cx + cz * cz);
    if (distanceFromSpawnChunks < 2) return;

    const floorY = 18 + Math.floor(this.pseudoRandom(cx * 31, this.seed + 809, cz * 37) * 28);
    if (floorY < 8 || floorY > WORLD_HEIGHT - 8) return;

    this.placeMineshaft(chunk, worldX, worldZ, floorY);
  }

  private placeMineshaft(chunk: Chunk, worldX: number, worldZ: number, floorY: number) {
    const eastWest = this.pseudoRandom(worldX, floorY + 907, worldZ) < 0.5;
    const center = 8;

    if (eastWest) {
      this.carveMineshaftCorridor(chunk, worldX, worldZ, 1, 14, center, center, floorY, 'east_west', true);
      this.carveMineshaftCorridor(chunk, worldX, worldZ, center, center, 2, 13, floorY, 'north_south', false);
      if (this.pseudoRandom(worldX, floorY + 991, worldZ) < 0.65) {
        this.carveMineshaftCorridor(chunk, worldX, worldZ, 3, 12, 4, 4, floorY, 'east_west', false);
      }
    } else {
      this.carveMineshaftCorridor(chunk, worldX, worldZ, center, center, 1, 14, floorY, 'north_south', true);
      this.carveMineshaftCorridor(chunk, worldX, worldZ, 2, 13, center, center, floorY, 'east_west', false);
      if (this.pseudoRandom(worldX, floorY + 991, worldZ) < 0.65) {
        this.carveMineshaftCorridor(chunk, worldX, worldZ, 11, 11, 3, 12, floorY, 'north_south', false);
      }
    }

    const chestRoll = this.pseudoRandom(worldX + 17, floorY + 1061, worldZ - 17);
    if (chestRoll < 0.78) {
      const chestX = eastWest ? 11 : 5;
      const chestZ = eastWest ? 6 : 11;
      chunk.setBlock(chestX, floorY + 1, chestZ, CHEST);
      chunk.setBlockMeta(chestX, floorY + 1, chestZ, {
        containerType: 'chest',
        inventory: this.createMineshaftLoot(worldX + chestX, floorY + 1, worldZ + chestZ),
      }, true);
    }
  }

  private carveMineshaftCorridor(
    chunk: Chunk,
    worldX: number,
    worldZ: number,
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number,
    floorY: number,
    axis: 'east_west' | 'north_south',
    main: boolean
  ) {
    const width = 3;
    const halfWidth = Math.floor(width / 2);
    const corridorMinX = axis === 'east_west' ? minX : minX - halfWidth;
    const corridorMaxX = axis === 'east_west' ? maxX : maxX + halfWidth;
    const corridorMinZ = axis === 'north_south' ? minZ : minZ - halfWidth;
    const corridorMaxZ = axis === 'north_south' ? maxZ : maxZ + halfWidth;

    for (let x = corridorMinX; x <= corridorMaxX; x++) {
      for (let z = corridorMinZ; z <= corridorMaxZ; z++) {
        if (!this.isInsideChunk(x, z)) continue;

        chunk.setBlock(x, floorY, z, PLANKS);
        for (let y = floorY + 1; y <= floorY + 3; y++) {
          chunk.setBlock(x, y, z, 0);
        }
        chunk.setBlock(x, floorY + 4, z, this.pseudoRandom(worldX + x, floorY + 1123, worldZ + z) < 0.35 ? PLANKS : 0);

        const decorRand = this.pseudoRandom(worldX + x * 13, floorY + 1187, worldZ + z * 17);
        if (yIsRailLine(axis, x, z, minX, minZ) && (main || decorRand < 0.55)) {
          chunk.setBlock(x, floorY + 1, z, RAIL);
        } else if (decorRand < 0.08) {
          chunk.setBlock(x, floorY + 2, z, WEB);
        } else if (decorRand < 0.11) {
          chunk.setBlock(x, floorY + 3, z, WEB);
        }
      }
    }

    const supportEvery = 4;
    const start = axis === 'east_west' ? minX : minZ;
    const end = axis === 'east_west' ? maxX : maxZ;
    for (let step = start + 1; step <= end; step += supportEvery) {
      if (axis === 'east_west') {
        this.placeMineshaftSupport(chunk, axis, step, floorY, minZ - halfWidth, minZ + halfWidth);
      } else {
        this.placeMineshaftSupport(chunk, axis, step, floorY, minX - halfWidth, minX + halfWidth);
      }
    }

    const torchPos = axis === 'east_west'
      ? [Math.min(maxX, minX + 6), floorY + 2, corridorMinZ]
      : [corridorMinX, floorY + 2, Math.min(maxZ, minZ + 6)];
    const [tx, ty, tz] = torchPos;
    if (this.isInsideChunk(tx, tz)) {
      chunk.setBlock(tx, ty, tz, TORCH);
    }

    function yIsRailLine(lineAxis: 'east_west' | 'north_south', x: number, z: number, lineX: number, lineZ: number): boolean {
      return lineAxis === 'east_west' ? z === lineZ : x === lineX;
    }
  }

  private placeMineshaftSupport(
    chunk: Chunk,
    axis: 'east_west' | 'north_south',
    step: number,
    floorY: number,
    crossStart: number,
    crossEnd: number
  ) {
    if (axis === 'east_west') {
      const x = step;
      if (x < 0 || x >= CHUNK_SIZE) return;
      for (const z of [crossStart, crossEnd]) {
        if (!this.isInsideChunk(x, z)) continue;
        chunk.setBlock(x, floorY + 1, z, FENCE);
        chunk.setBlock(x, floorY + 2, z, FENCE);
        chunk.setBlock(x, floorY + 3, z, FENCE);
      }
      for (let z = crossStart; z <= crossEnd; z++) {
        if (this.isInsideChunk(x, z)) {
          chunk.setBlock(x, floorY + 4, z, PLANKS);
        }
      }
    } else {
      const z = step;
      if (z < 0 || z >= CHUNK_SIZE) return;
      for (const x of [crossStart, crossEnd]) {
        if (!this.isInsideChunk(x, z)) continue;
        chunk.setBlock(x, floorY + 1, z, FENCE);
        chunk.setBlock(x, floorY + 2, z, FENCE);
        chunk.setBlock(x, floorY + 3, z, FENCE);
      }
      for (let x = crossStart; x <= crossEnd; x++) {
        if (this.isInsideChunk(x, z)) {
          chunk.setBlock(x, floorY + 4, z, PLANKS);
        }
      }
    }
  }

  private createMineshaftLoot(wx: number, y: number, wz: number): (ItemStack | null)[] {
    const inventory: (ItemStack | null)[] = new Array(27).fill(null);
    const lootTable: Array<{ id: number; min: number; max: number; weight: number }> = [
      { id: 66, min: 4, max: 8, weight: 18 },    // rail
      { id: 263, min: 2, max: 6, weight: 14 },   // coal
      { id: 265, min: 1, max: 4, weight: 12 },   // iron ingot
      { id: 266, min: 1, max: 3, weight: 6 },    // gold ingot
      { id: 331, min: 2, max: 6, weight: 8 },    // redstone
      { id: (4 << 10) | 351, min: 3, max: 8, weight: 7 }, // lapis lazuli
      { id: 287, min: 1, max: 5, weight: 10 },   // string
      { id: 297, min: 1, max: 3, weight: 8 },    // bread
      { id: 328, min: 1, max: 1, weight: 4 },    // minecart
      { id: 361, min: 2, max: 4, weight: 4 },    // pumpkin seeds
      { id: 362, min: 2, max: 4, weight: 4 },    // melon seeds
      { id: 264, min: 1, max: 2, weight: 2 },    // diamond
    ];

    const totalWeight = lootTable.reduce((sum, entry) => sum + entry.weight, 0);
    const rolls = 4 + Math.floor(this.pseudoRandom(wx, y + 1, wz) * 4);

    for (let roll = 0; roll < rolls; roll++) {
      let slot = Math.floor(this.pseudoRandom(wx + roll * 41, y + 2, wz - roll * 23) * inventory.length);
      for (let attempts = 0; attempts < inventory.length && inventory[slot]; attempts++) {
        slot = (slot + 1) % inventory.length;
      }
      if (inventory[slot]) continue;

      let pick = this.pseudoRandom(wx - roll * 13, y + 3, wz + roll * 31) * totalWeight;
      let selected = lootTable[0];
      for (const entry of lootTable) {
        pick -= entry.weight;
        if (pick <= 0) {
          selected = entry;
          break;
        }
      }

      const countRange = selected.max - selected.min + 1;
      const count = selected.min + Math.floor(this.pseudoRandom(wx + roll * 7, y + 4, wz + roll * 11) * countRange);
      inventory[slot] = { id: selected.id, count };
    }

    return inventory;
  }

  private isInsideChunk(x: number, z: number): boolean {
    return x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE;
  }

  private generateDungeons(chunk: Chunk, worldX: number, worldZ: number) {
    const cx = chunk.cx;
    const cz = chunk.cz;
    const spacing = 6;
    const offsetX = Math.floor(this.pseudoRandom(this.seed, 157, 43) * spacing);
    const offsetZ = Math.floor(this.pseudoRandom(this.seed, 211, 89) * spacing);

    if (this.positiveMod(cx - offsetX, spacing) !== 0 || this.positiveMod(cz - offsetZ, spacing) !== 0) {
      return;
    }

    const distanceFromSpawnChunks = Math.sqrt(cx * cx + cz * cz);
    if (distanceFromSpawnChunks < 2) return;

    const floorY = 14 + Math.floor(this.pseudoRandom(cx * 17, this.seed + 503, cz * 23) * 34);
    if (floorY < 8 || floorY > WORLD_HEIGHT - 8) return;

    this.placeDungeonRoom(chunk, worldX, worldZ, floorY);
  }

  private placeDungeonRoom(chunk: Chunk, worldX: number, worldZ: number, floorY: number) {
    const minX = 3;
    const maxX = 12;
    const minZ = 3;
    const maxZ = 12;
    const ceilingY = floorY + 4;

    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        for (let y = floorY; y <= ceilingY; y++) {
          const boundary = x === minX || x === maxX || z === minZ || z === maxZ || y === floorY || y === ceilingY;
          if (boundary) {
            chunk.setBlock(x, y, z, this.getDungeonStone(worldX + x, y, worldZ + z));
          } else {
            chunk.setBlock(x, y, z, 0);
          }
        }
      }
    }

    const centerX = 8;
    const centerZ = 8;
    chunk.setBlock(centerX, floorY + 1, centerZ, MOB_SPAWNER);
    chunk.setBlockMeta(centerX, floorY + 1, centerZ, {
      spawnerMobType: this.getDungeonSpawnerType(worldX + centerX, floorY, worldZ + centerZ),
    }, true);

    // Four low openings make the room discoverable from nearby cave systems.
    for (const [x, z, dx, dz] of [
      [centerX, minZ, 0, -1],
      [centerX, maxZ, 0, 1],
      [minX, centerZ, -1, 0],
      [maxX, centerZ, 1, 0],
    ] as const) {
      for (let y = floorY + 1; y <= floorY + 2; y++) {
        chunk.setBlock(x, y, z, 0);
        chunk.setBlock(x + dx, y, z + dz, 0);
      }
    }

    const chestPositions = [
      [minX + 1, floorY + 1, minZ + 1],
      [maxX - 1, floorY + 1, maxZ - 1],
    ] as const;
    const chestCount = this.pseudoRandom(worldX, floorY + 71, worldZ) < 0.55 ? 2 : 1;
    for (let i = 0; i < chestCount; i++) {
      const [x, y, z] = chestPositions[i];
      chunk.setBlock(x, y, z, CHEST);
      chunk.setBlockMeta(x, y, z, {
        containerType: 'chest',
        inventory: this.createDungeonLoot(worldX + x, y, worldZ + z),
      }, true);
    }

    for (const [x, y, z] of [[minX + 1, floorY + 2, centerZ], [maxX - 1, floorY + 2, centerZ]]) {
      chunk.setBlock(x, y, z, TORCH);
    }
  }

  private getDungeonStone(wx: number, y: number, wz: number): number {
    const rand = this.pseudoRandom(wx, y + 1301, wz);
    return rand < 0.48 ? MOSSY_COBBLESTONE : COBBLESTONE;
  }

  private getDungeonSpawnerType(wx: number, y: number, wz: number): 'zombie' | 'skeleton' | 'spider' {
    const rand = this.pseudoRandom(wx, y + 1609, wz);
    if (rand < 0.5) return 'zombie';
    if (rand < 0.82) return 'skeleton';
    return 'spider';
  }

  private createDungeonLoot(wx: number, y: number, wz: number): (ItemStack | null)[] {
    const inventory: (ItemStack | null)[] = new Array(27).fill(null);
    const lootTable: Array<{ id: number; min: number; max: number; weight: number }> = [
      { id: 297, min: 1, max: 2, weight: 16 },   // bread
      { id: 296, min: 1, max: 4, weight: 18 },   // wheat
      { id: 265, min: 1, max: 4, weight: 14 },   // iron ingot
      { id: 266, min: 1, max: 3, weight: 8 },    // gold ingot
      { id: 331, min: 1, max: 4, weight: 10 },   // redstone
      { id: 352, min: 1, max: 6, weight: 14 },   // bone
      { id: 289, min: 1, max: 4, weight: 12 },   // gunpowder
      { id: 287, min: 1, max: 4, weight: 12 },   // string
      { id: 325, min: 1, max: 1, weight: 5 },    // bucket
      { id: 329, min: 1, max: 1, weight: 3 },    // saddle
      { id: 421, min: 1, max: 1, weight: 2 },    // name tag
      { id: 2256, min: 1, max: 1, weight: 1 },   // 13 disc
      { id: 2257, min: 1, max: 1, weight: 1 },   // cat disc
    ];

    const totalWeight = lootTable.reduce((sum, entry) => sum + entry.weight, 0);
    const rolls = 3 + Math.floor(this.pseudoRandom(wx, y + 1, wz) * 4);

    for (let roll = 0; roll < rolls; roll++) {
      let slot = Math.floor(this.pseudoRandom(wx + roll * 37, y + 2, wz - roll * 19) * inventory.length);
      for (let attempts = 0; attempts < inventory.length && inventory[slot]; attempts++) {
        slot = (slot + 1) % inventory.length;
      }
      if (inventory[slot]) continue;

      let pick = this.pseudoRandom(wx - roll * 11, y + 3, wz + roll * 29) * totalWeight;
      let selected = lootTable[0];
      for (const entry of lootTable) {
        pick -= entry.weight;
        if (pick <= 0) {
          selected = entry;
          break;
        }
      }

      const countRange = selected.max - selected.min + 1;
      const count = selected.min + Math.floor(this.pseudoRandom(wx + roll * 5, y + 4, wz + roll * 7) * countRange);
      inventory[slot] = { id: selected.id, count };
    }

    return inventory;
  }

  private generateStrongholds(chunk: Chunk, worldX: number, worldZ: number) {
    const cx = chunk.cx;
    const cz = chunk.cz;
    const spacing = 24;
    const offsetX = Math.floor(this.pseudoRandom(this.seed, 19, 7) * spacing);
    const offsetZ = Math.floor(this.pseudoRandom(this.seed, 31, 11) * spacing);

    if (this.positiveMod(cx - offsetX, spacing) !== 0 || this.positiveMod(cz - offsetZ, spacing) !== 0) {
      return;
    }

    const distanceFromSpawnChunks = Math.sqrt(cx * cx + cz * cz);
    if (distanceFromSpawnChunks < 8) return;

    const roomY = 26 + Math.floor(this.pseudoRandom(cx, this.seed, cz) * 22);
    this.placeStrongholdPortalRoom(chunk, worldX, worldZ, roomY);
  }

  private placeStrongholdPortalRoom(chunk: Chunk, worldX: number, worldZ: number, floorY: number) {
    const minX = 2;
    const maxX = 13;
    const minZ = 2;
    const maxZ = 13;
    const maxY = floorY + 7;

    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        for (let y = floorY; y <= maxY; y++) {
          const boundary = x === minX || x === maxX || z === minZ || z === maxZ || y === floorY || y === maxY;
          if (boundary) {
            chunk.setBlock(x, y, z, this.getStrongholdBrick(worldX + x, y, worldZ + z));
          } else {
            chunk.setBlock(x, y, z, 0);
          }
        }
      }
    }

    // A short stair-like entrance notch gives caves a chance to connect into the room.
    for (let z = minZ; z <= minZ + 3; z++) {
      for (let x = 6; x <= 9; x++) {
        chunk.setBlock(x, floorY + 1, z, 0);
        chunk.setBlock(x, floorY + 2, z, 0);
        chunk.setBlock(x, floorY + 3, z, 0);
      }
    }

    // Portal dais.
    for (let x = 4; x <= 12; x++) {
      for (let z = 4; z <= 12; z++) {
        const edge = x === 4 || x === 12 || z === 4 || z === 12;
        chunk.setBlock(x, floorY + 1, z, edge ? STONE_BRICKS : 0);
      }
    }

    // Horizontal End portal frame ring around a 3x3 center.
    const centerX = 8;
    const centerZ = 8;
    const portalY = floorY + 2;
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        const onFrame = (Math.abs(dx) === 2 && Math.abs(dz) <= 1) || (Math.abs(dz) === 2 && Math.abs(dx) <= 1);
        const inside = Math.abs(dx) <= 1 && Math.abs(dz) <= 1;
        const x = centerX + dx;
        const z = centerZ + dz;

        if (onFrame) {
          const baseMeta = this.getEndPortalFrameMeta(dx, dz);
          const hasEye = this.pseudoRandom(worldX + x, portalY, worldZ + z) < 0.12;
          chunk.setBlock(x, portalY, z, ((hasEye ? baseMeta + 4 : baseMeta) << 10) | END_PORTAL_FRAME);
        } else if (inside) {
          chunk.setBlock(x, portalY, z, 0);
        }
      }
    }

    // Iron-bar window hints and torches make generated rooms recognizable underground.
    for (const [x, z] of [[minX, 7], [minX, 8], [maxX, 7], [maxX, 8], [7, maxZ], [8, maxZ]]) {
      chunk.setBlock(x, floorY + 3, z, IRON_BARS);
      chunk.setBlock(x, floorY + 4, z, IRON_BARS);
    }
    for (const [x, y, z] of [[5, floorY + 3, 5], [11, floorY + 3, 5], [5, floorY + 3, 11], [11, floorY + 3, 11]]) {
      chunk.setBlock(x, y, z, TORCH);
    }
  }

  private getStrongholdBrick(wx: number, y: number, wz: number): number {
    const rand = this.pseudoRandom(wx, y + 917, wz);
    if (rand < 0.08) return CRACKED_STONE_BRICKS;
    if (rand < 0.18) return MOSSY_STONE_BRICKS;
    if (rand > 0.97) return CHISELED_STONE_BRICKS;
    return STONE_BRICKS;
  }

  private getEndPortalFrameMeta(dx: number, dz: number): number {
    if (dz === -2) return 0; // north side faces south
    if (dx === 2) return 1;  // east side faces west
    if (dz === 2) return 2;  // south side faces north
    return 3;                // west side faces east
  }

  private positiveMod(value: number, mod: number): number {
    return ((value % mod) + mod) % mod;
  }

  private getSurfaceBlockForColumn(
    biome: BiomeType,
    height: number,
    y: number,
    riverBank: boolean,
    shore: boolean
  ): number {
    if (biome === BiomeType.Badlands) {
      return height <= SEA_LEVEL + 2 ? RED_SAND : getBadlandsBlockId(y);
    }
    if (biome === BiomeType.MushroomIsland) return MYCELIUM;
    if (riverBank) return y < SEA_LEVEL - 1 ? GRAVEL : SAND;
    if (shore && biome !== BiomeType.Swamp) return SAND;
    return BIOME_CONFIGS[biome].surfaceBlock;
  }

  private getUnderBlockForColumn(
    biome: BiomeType,
    riverBank: boolean,
    shore: boolean,
    wx: number,
    wz: number
  ): number {
    if (biome === BiomeType.Badlands) return TERRACOTTA;
    if (riverBank) return this.noise.noise2D(wx * 0.08, wz * 0.08) > 0.2 ? CLAY : SAND;
    if (shore && biome !== BiomeType.Swamp) return SAND;
    return BIOME_CONFIGS[biome].underBlock;
  }

  private generateOres(chunk: Chunk, worldX: number, worldZ: number) {
    const ores = [
      { id: 16, min: 5, max: 90, count: 30 },   // coal (16)
      { id: 15, min: 5, max: 70, count: 22 },   // iron (15)
      { id: 14, min: 5, max: 50, count: 8 },    // gold (14)
      { id: 56, min: 5, max: 25, count: 5 },    // diamond (56)
    ];

    for (const ore of ores) {
      for (let i = 0; i < ore.count; i++) {
        const x = Math.floor(this.pseudoRandom(worldX + i * 7, ore.id, worldZ) * CHUNK_SIZE);
        const z = Math.floor(this.pseudoRandom(worldX, ore.id + i * 3, worldZ + i * 11) * CHUNK_SIZE);
        const y = ore.min + Math.floor(this.pseudoRandom(worldX + i * 13, ore.id + i, worldZ + i * 17) * (ore.max - ore.min));

        if (x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE && y >= 0 && y < WORLD_HEIGHT) {
          if (chunk.getBlock(x, y, z) === 1) {
            chunk.setBlock(x, y, z, ore.id);
          }
        }
      }
    }

    // Additional pass: Generate ores exposed on cave walls
    this.generateCaveWallOres(chunk, worldX, worldZ);
  }

  private generateCaveWallOres(chunk: Chunk, worldX: number, worldZ: number) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = worldX + x;
        const wz = worldZ + z;
        for (let y = 5; y < WORLD_HEIGHT - 10; y++) {
          if (chunk.getBlock(x, y, z) !== 1) continue; // Must be stone

          // Check if it's a cave wall (adjacent to air, water, or lava)
          let isWall = false;
          const neighbors = [
            [x + 1, y, z], [x - 1, y, z],
            [x, y + 1, z], [x, y - 1, z],
            [x, y, z + 1], [x, y, z - 1]
          ];
          for (const [nx, ny, nz] of neighbors) {
            if (nx >= 0 && nx < CHUNK_SIZE && ny >= 0 && ny < WORLD_HEIGHT && nz >= 0 && nz < CHUNK_SIZE) {
              const b = chunk.getBlock(nx, ny, nz);
              const baseB = b & 0x3FF;
              if (baseB === 0 || baseB === 8 || baseB === 9 || baseB === 10 || baseB === 11) {
                isWall = true;
                break;
              }
            }
          }

          if (isWall) {
            const rand = this.pseudoRandom(wx, y, wz);
            if (y <= 20) {
              if (rand < 0.015) {
                chunk.setBlock(x, y, z, 56); // Diamond Ore (56)
              } else if (rand < 0.035) {
                chunk.setBlock(x, y, z, 14); // Gold Ore (14)
              } else if (rand < 0.075) {
                chunk.setBlock(x, y, z, 15); // Iron Ore (15)
              } else if (rand < 0.135) {
                chunk.setBlock(x, y, z, 16); // Coal Ore (16)
              }
            } else if (y <= 40) {
              if (rand < 0.025) {
                chunk.setBlock(x, y, z, 14); // Gold Ore (14)
              } else if (rand < 0.07) {
                chunk.setBlock(x, y, z, 15); // Iron Ore (15)
              } else if (rand < 0.14) {
                chunk.setBlock(x, y, z, 16); // Coal Ore (16)
              }
            } else if (y <= 80) {
              if (rand < 0.05) {
                chunk.setBlock(x, y, z, 15); // Iron Ore (15)
              } else if (rand < 0.13) {
                chunk.setBlock(x, y, z, 16); // Coal Ore (16)
              }
            } else if (y <= 120) {
              if (rand < 0.10) {
                chunk.setBlock(x, y, z, 16); // Coal Ore (16)
              }
            }
          }
        }
      }
    }
  }

  private generateTrees(chunk: Chunk, worldX: number, worldZ: number) {
    for (let x = 2; x < CHUNK_SIZE - 2; x++) {
      for (let z = 2; z < CHUNK_SIZE - 2; z++) {
        const wx = worldX + x;
        const wz = worldZ + z;

        const biome = this.getBiome(wx, wz);
        const cfg = BIOME_CONFIGS[biome];

        if (cfg.treeChance <= 0) continue;

        // Use deterministic random based on world position
        const rand = this.pseudoRandom(wx, 42, wz);
        if (rand > cfg.treeChance) continue;

        // Find surface
        let surfaceY = -1;
        for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
          const id = chunk.getBlock(x, y, z);
          if (id === cfg.surfaceBlock || id === 2) {
            surfaceY = y;
            break;
          }
        }
        if (surfaceY < 10 || surfaceY > WORLD_HEIGHT - 15) continue;

        this.placeTree(chunk, x, surfaceY + 1, z, biome);
      }
    }
  }

  private placeTree(chunk: Chunk, x: number, y: number, z: number, biome: BiomeType) {
    const rand = this.pseudoRandom(x * 7, y, z * 13);

    if (biome === BiomeType.Snow || biome === BiomeType.Mountains) {
      this.placeSpruceTree(chunk, x, y, z);
    } else if (biome === BiomeType.Forest && rand > 0.5) {
      this.placeBirchTree(chunk, x, y, z);
    } else if (biome === BiomeType.Jungle) {
      this.placeJungleTree(chunk, x, y, z);
    } else if (biome === BiomeType.Swamp) {
      this.placeSwampOakTree(chunk, x, y, z);
    } else if (biome === BiomeType.MushroomIsland) {
      this.placeGiantMushroom(chunk, x, y, z);
    } else {
      this.placeOakTree(chunk, x, y, z);
    }
  }

  private placeJungleTree(chunk: Chunk, x: number, y: number, z: number) {
    const rand = this.pseudoRandom(x, y, z);
    const trunkHeight = 7 + Math.floor(rand * 6);
    const logId = (3 << 10) | 17;    // jungle log
    const leafId = (3 << 10) | 18;   // jungle leaves

    // Place trunk
    for (let h = 0; h < trunkHeight; h++) {
      const ly = y + h;
      if (ly >= WORLD_HEIGHT) break;
      chunk.setBlock(x, ly, z, logId);

      // Place vines on sides of log (randomly)
      if (h > 1 && h < trunkHeight - 2) {
        const vRand = this.pseudoRandom(x * 5, ly, z * 7);
        if (vRand < 0.18 && x > 0) chunk.setBlock(x - 1, ly, z, COCOA);
        else if (vRand < 0.36 && x < CHUNK_SIZE - 1) chunk.setBlock(x + 1, ly, z, COCOA);
        else if (vRand < 0.52 && z > 0) chunk.setBlock(x, ly, z - 1, COCOA);
        else if (vRand < 0.68 && z < CHUNK_SIZE - 1) chunk.setBlock(x, ly, z + 1, COCOA);
        else if (vRand < 0.76 && x > 0) chunk.setBlock(x - 1, ly, z, VINES);
        else if (vRand < 0.84 && x < CHUNK_SIZE - 1) chunk.setBlock(x + 1, ly, z, VINES);
        else if (vRand < 0.92 && z > 0) chunk.setBlock(x, ly, z - 1, VINES);
        else if (z < CHUNK_SIZE - 1) chunk.setBlock(x, ly, z + 1, VINES);
      }
    }

    // Large bushy canopy
    const leafStart = y + trunkHeight - 3;
    const leafEnd = y + trunkHeight + 2;

    for (let ly = leafStart; ly <= leafEnd; ly++) {
      const distFromTop = leafEnd - ly;
      const r = distFromTop <= 1 ? 1 : (distFromTop === 2 ? 2 : 3);
      for (let lx = -r; lx <= r; lx++) {
        for (let lz = -r; lz <= r; lz++) {
          if (lx === 0 && lz === 0 && ly < y + trunkHeight) continue;
          if (Math.abs(lx) === r && Math.abs(lz) === r && r > 1) {
            if (this.pseudoRandom(x + lx, ly, z + lz) > 0.4) continue;
          }
          const bx = x + lx;
          const bz = z + lz;
          if (bx >= 0 && bx < CHUNK_SIZE && bz >= 0 && bz < CHUNK_SIZE && ly < WORLD_HEIGHT) {
            if (chunk.getBlock(bx, ly, bz) === 0) {
              chunk.setBlock(bx, ly, bz, leafId);
            }
          }
        }
      }
    }
  }

  private placeSwampOakTree(chunk: Chunk, x: number, y: number, z: number) {
    this.placeOakTree(chunk, x, y, z);

    const leafId = 18;

    const leafStart = y + 2;
    const leafEnd = y + 7;
    for (let ly = leafStart; ly <= leafEnd; ly++) {
      for (let lx = -3; lx <= 3; lx++) {
        for (let lz = -3; lz <= 3; lz++) {
          const bx = x + lx;
          const bz = z + lz;
          if (bx >= 0 && bx < CHUNK_SIZE && bz >= 0 && bz < CHUNK_SIZE && ly < WORLD_HEIGHT) {
            if (chunk.getBlock(bx, ly, bz) === leafId) {
              if (ly > y + 1 && chunk.getBlock(bx, ly - 1, bz) === 0 && this.pseudoRandom(bx, ly, bz) < 0.18) {
                chunk.setBlock(bx, ly - 1, bz, VINES);
                if (ly > y + 2 && chunk.getBlock(bx, ly - 2, bz) === 0 && this.pseudoRandom(bx + 1, ly, bz) < 0.5) {
                  chunk.setBlock(bx, ly - 2, bz, VINES);
                }
              }
            }
          }
        }
      }
    }
  }

  private placeGiantMushroom(chunk: Chunk, x: number, y: number, z: number) {
    const rand = this.pseudoRandom(x, y, z);
    const isRed = rand > 0.5;
    const capId = isRed ? 100 : 99;
    const stemId = (10 << 10) | capId; // stem metadata 10

    const height = 5 + Math.floor(rand * 3);

    for (let h = 0; h < height; h++) {
      if (y + h < WORLD_HEIGHT) {
        chunk.setBlock(x, y + h, z, stemId);
      }
    }

    const cy = y + height;
    if (cy >= WORLD_HEIGHT - 3) return;

    if (isRed) {
      for (let lx = -1; lx <= 1; lx++) {
        for (let lz = -1; lz <= 1; lz++) {
          chunk.setBlock(x + lx, cy, z + lz, capId);
        }
      }
      for (let h = 1; h <= 2; h++) {
        const sideY = cy - h;
        for (let lx = -2; lx <= 2; lx++) {
          for (let lz = -2; lz <= 2; lz++) {
            const isBorderX = Math.abs(lx) === 2;
            const isBorderZ = Math.abs(lz) === 2;
            if ((isBorderX && Math.abs(lz) <= 1) || (isBorderZ && Math.abs(lx) <= 1)) {
              chunk.setBlock(x + lx, sideY, z + lz, capId);
            }
          }
        }
      }
    } else {
      for (let lx = -2; lx <= 2; lx++) {
        for (let lz = -2; lz <= 2; lz++) {
          if (Math.abs(lx) === 2 && Math.abs(lz) === 2) continue;
          chunk.setBlock(x + lx, cy, z + lz, capId);
        }
      }
    }
  }

  private placeOakTree(chunk: Chunk, x: number, y: number, z: number) {
    const trunkHeight = 4 + Math.floor(this.pseudoRandom(x, y, z) * 3);
    const logId = 17;     // oak log
    const leafId = 18;    // oak leaves

    for (let h = 0; h < trunkHeight; h++) {
      if (y + h < WORLD_HEIGHT) chunk.setBlock(x, y + h, z, logId);
    }

    const leafStart = y + trunkHeight - 2;
    const leafEnd = y + trunkHeight + 1;
    const radius = 2;

    for (let ly = leafStart; ly <= leafEnd; ly++) {
      const r = ly < leafEnd ? radius : 1;
      for (let lx = -r; lx <= r; lx++) {
        for (let lz = -r; lz <= r; lz++) {
          if (lx === 0 && lz === 0 && ly < y + trunkHeight) continue;
          if (Math.abs(lx) === r && Math.abs(lz) === r) continue;
          const bx = x + lx;
          const bz = z + lz;
          if (bx >= 0 && bx < CHUNK_SIZE && bz >= 0 && bz < CHUNK_SIZE && ly < WORLD_HEIGHT) {
            if (chunk.getBlock(bx, ly, bz) === 0) chunk.setBlock(bx, ly, bz, leafId);
          }
        }
      }
    }
  }

  private placeSpruceTree(chunk: Chunk, x: number, y: number, z: number) {
    const trunkHeight = 6 + Math.floor(this.pseudoRandom(x, y, z) * 3);
    const logId = (1 << 10) | 17;    // spruce log
    const leafId = (1 << 10) | 18;   // spruce leaves

    for (let h = 0; h < trunkHeight; h++) {
      if (y + h < WORLD_HEIGHT) chunk.setBlock(x, y + h, z, logId);
    }

    // Cone-shaped leaves
    for (let ly = y + 2; ly <= y + trunkHeight + 1; ly++) {
      const distFromTop = y + trunkHeight + 1 - ly;
      const r = Math.min(2, Math.floor(distFromTop * 0.7));
      if (r < 0) continue;
      for (let lx = -r; lx <= r; lx++) {
        for (let lz = -r; lz <= r; lz++) {
          if (lx === 0 && lz === 0 && ly < y + trunkHeight) continue;
          if (Math.abs(lx) === r && Math.abs(lz) === r && r > 1) continue;
          const bx = x + lx;
          const bz = z + lz;
          if (bx >= 0 && bx < CHUNK_SIZE && bz >= 0 && bz < CHUNK_SIZE && ly < WORLD_HEIGHT) {
            if (chunk.getBlock(bx, ly, bz) === 0) chunk.setBlock(bx, ly, bz, leafId);
          }
        }
      }
    }
  }

  private placeBirchTree(chunk: Chunk, x: number, y: number, z: number) {
    const trunkHeight = 6 + Math.floor(this.pseudoRandom(x, y, z) * 2);
    const logId = (2 << 10) | 17;    // birch log
    const leafId = (2 << 10) | 18;   // birch leaves

    for (let h = 0; h < trunkHeight; h++) {
      if (y + h < WORLD_HEIGHT) chunk.setBlock(x, y + h, z, logId);
    }

    // Tall narrow canopy
    const leafStart = y + trunkHeight - 2;
    const leafEnd = y + trunkHeight + 2;

    for (let ly = leafStart; ly <= leafEnd; ly++) {
      const r = ly >= y + trunkHeight + 1 ? 1 : 2;
      for (let lx = -r; lx <= r; lx++) {
        for (let lz = -r; lz <= r; lz++) {
          if (lx === 0 && lz === 0 && ly < y + trunkHeight) continue;
          if (Math.abs(lx) === r && Math.abs(lz) === r) continue;
          const bx = x + lx;
          const bz = z + lz;
          if (bx >= 0 && bx < CHUNK_SIZE && bz >= 0 && bz < CHUNK_SIZE && ly < WORLD_HEIGHT) {
            if (chunk.getBlock(bx, ly, bz) === 0) chunk.setBlock(bx, ly, bz, leafId);
          }
        }
      }
    }
  }

  private generateSurfaceDecor(chunk: Chunk, worldX: number, worldZ: number) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = worldX + x;
        const wz = worldZ + z;
        const biome = this.getBiome(wx, wz);

        const rand = this.pseudoRandom(wx * 31, 99, wz * 17);

        // 1. Swamp Lily Pads (placed on water surfaces, regardless of the land grass check)
        if (biome === BiomeType.Swamp && rand < 0.18) {
          let surfaceWaterY = -1;
          for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
            const id = chunk.getBlock(x, y, z) & 0x3FF;
            if (id === 9) { // water
              surfaceWaterY = y;
              break;
            }
          }
          if (surfaceWaterY !== -1 && surfaceWaterY < WORLD_HEIGHT - 1) {
            const above = chunk.getBlock(x, surfaceWaterY + 1, z);
            if (above === 0) {
              chunk.setBlock(x, surfaceWaterY + 1, z, LILY_PAD); // lily pad
            }
          }
        }

        if (biome === BiomeType.Ocean) continue;

        const decorChance = biome === BiomeType.Jungle ? 0.11
          : biome === BiomeType.Swamp ? 0.1
          : biome === BiomeType.Badlands ? 0.06
          : 0.08;
        if (rand > decorChance) continue;

        // Find surface (supporting Grass, Snow, Mycelium, Sand, Clay)
        let surfaceY = -1;
        for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
          const id = chunk.getBlock(x, y, z);
          const baseId = id & 0x3FF;
          if (id === 2 || id === 27 || id === 110 || baseId === 12 || baseId === 172) {
            surfaceY = y;
            break;
          }
        }
        if (surfaceY < 10 || surfaceY >= WORLD_HEIGHT - 3) continue;

        const aboveBlock = chunk.getBlock(x, surfaceY + 1, z);
        if (aboveBlock !== 0) continue;

        const decorRand = this.pseudoRandom(wx * 43, surfaceY, wz * 59);

        if (biome === BiomeType.MushroomIsland) {
          if (decorRand < 0.35) chunk.setBlock(x, surfaceY + 1, z, 39); // brown mushroom
          else if (decorRand < 0.7) chunk.setBlock(x, surfaceY + 1, z, 40); // red mushroom
        } else if (biome === BiomeType.Jungle) {
          if (decorRand < 0.32) chunk.setBlock(x, surfaceY + 1, z, FERN); // fern
          else if (decorRand < 0.72) chunk.setBlock(x, surfaceY + 1, z, TALL_GRASS); // tall grass
          else if (decorRand < 0.82) chunk.setBlock(x, surfaceY + 1, z, MELON); // melon block
        } else if (biome === BiomeType.Swamp) {
          if (decorRand < 0.24) chunk.setBlock(x, surfaceY + 1, z, BLUE_ORCHID); // blue orchid
          else if (decorRand < 0.62) chunk.setBlock(x, surfaceY + 1, z, TALL_GRASS); // tall grass
          else if (decorRand < 0.76) chunk.setBlock(x, surfaceY + 1, z, FERN); // fern
        } else if (biome === BiomeType.Badlands) {
          if (decorRand < 0.55) chunk.setBlock(x, surfaceY + 1, z, DEAD_BUSH);
          else if (decorRand < 0.68) {
            const cactusHeight = 1 + Math.floor(this.pseudoRandom(wx, surfaceY + 11, wz) * 3);
            for (let h = 1; h <= cactusHeight; h++) {
              if (surfaceY + h < WORLD_HEIGHT) {
                chunk.setBlock(x, surfaceY + h, z, CACTUS);
              }
            }
          }
        } else if (biome === BiomeType.Desert) {
          if (decorRand < 0.15) {
            const cactusHeight = 1 + Math.floor(decorRand * 20) % 3;
            for (let h = 1; h <= cactusHeight; h++) {
              if (surfaceY + h < WORLD_HEIGHT) {
                chunk.setBlock(x, surfaceY + h, z, CACTUS); // cactus
              }
            }
          } else if (decorRand < 0.35) {
            chunk.setBlock(x, surfaceY + 1, z, DEAD_BUSH);
          }
        } else if (biome === BiomeType.River) {
          let nextToWater = false;
          const checkDirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
          for (const [dx, dz] of checkDirs) {
            const nx = x + dx;
            const nz = z + dz;
            if (nx >= 0 && nx < CHUNK_SIZE && nz >= 0 && nz < CHUNK_SIZE) {
              const nId = chunk.getBlock(nx, surfaceY, nz) & 0x3FF;
              if (nId === 8 || nId === 9) {
                nextToWater = true;
                break;
              }
            }
          }
          if (nextToWater && decorRand < 0.35) {
            const reedsHeight = 2 + Math.floor(decorRand * 10) % 2;
            for (let h = 1; h <= reedsHeight; h++) {
              if (surfaceY + h < WORLD_HEIGHT) {
                chunk.setBlock(x, surfaceY + h, z, REEDS); // reeds
              }
            }
          }
        } else if (biome === BiomeType.Forest) {
          if (decorRand < 0.3) chunk.setBlock(x, surfaceY + 1, z, 38); // poppy
          else if (decorRand < 0.5) chunk.setBlock(x, surfaceY + 1, z, 37); // dandelion
          else if (decorRand < 0.6) chunk.setBlock(x, surfaceY + 1, z, (2 << 10) | 31); // fern
          else chunk.setBlock(x, surfaceY + 1, z, (1 << 10) | 31); // tall grass
        } else if (biome === BiomeType.Snow) {
          // Snow biome
        } else {
          // Plains
          if (decorRand < 0.2) chunk.setBlock(x, surfaceY + 1, z, 37); // dandelion
          else if (decorRand < 0.35) chunk.setBlock(x, surfaceY + 1, z, 38); // poppy
          else if (decorRand < 0.5) chunk.setBlock(x, surfaceY + 1, z, (4 << 10) | 38); // red tulip
          else if (decorRand < 0.6) chunk.setBlock(x, surfaceY + 1, z, (1 << 10) | 38); // blue orchid
          else chunk.setBlock(x, surfaceY + 1, z, (1 << 10) | 31); // tall grass
        }
      }
    }
  }

  private pseudoRandom(x: number, y: number, z: number): number {
    let h = (x * 374761393 + y * 668265263 + z * 1274126177 + this.seed) | 0;
    h = (h ^ (h >> 13)) * 1274126177;
    h = h ^ (h >> 16);
    return (h & 0x7fffffff) / 0x7fffffff;
  }
}
