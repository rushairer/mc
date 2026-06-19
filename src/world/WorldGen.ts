import { SimplexNoise } from './SimplexNoise';
import { CHUNK_SIZE, WORLD_HEIGHT, SEA_LEVEL } from '../constants';
import { Chunk } from './Chunk';
import { VillageSystem } from '../systems/VillageSystem';

export enum BiomeType {
  Plains = 0,
  Desert = 1,
  Mountains = 2,
  Forest = 3,
  Snow = 4,
  Ocean = 5,
}

export interface BiomeConfig {
  baseHeight: number;
  amplitude: number;
  treeChance: number;
  surfaceBlock: number;
  underBlock: number;
  stoneDepth: number;
}

const BIOME_CONFIGS: Record<BiomeType, BiomeConfig> = {
  [BiomeType.Plains]:    { baseHeight: 98, amplitude: 12, treeChance: 0.005, surfaceBlock: 2, underBlock: 3, stoneDepth: 3 },
  [BiomeType.Desert]:    { baseHeight: 97, amplitude: 6,  treeChance: 0,     surfaceBlock: 12, underBlock: 12, stoneDepth: 3 },
  [BiomeType.Mountains]: { baseHeight: 114, amplitude: 50, treeChance: 0.002, surfaceBlock: 2, underBlock: 3, stoneDepth: 4 },
  [BiomeType.Forest]:    { baseHeight: 100, amplitude: 16, treeChance: 0.03,  surfaceBlock: 2, underBlock: 3, stoneDepth: 3 },
  [BiomeType.Snow]:      { baseHeight: 102, amplitude: 20, treeChance: 0.008, surfaceBlock: 80, underBlock: 3, stoneDepth: 3 },
  [BiomeType.Ocean]:     { baseHeight: 74, amplitude: 10, treeChance: 0,     surfaceBlock: 12, underBlock: 3, stoneDepth: 3 },
};

export class WorldGen {
  private noise: SimplexNoise;
  private temperatureNoise: SimplexNoise;
  private humidityNoise: SimplexNoise;
  private caveNoise: SimplexNoise;
  private treeSeed: number;
  seed: number;

  constructor(seed: number) {
    this.seed = seed;
    this.noise = new SimplexNoise(seed);
    this.temperatureNoise = new SimplexNoise(seed + 100);
    this.humidityNoise = new SimplexNoise(seed + 200);
    this.caveNoise = new SimplexNoise(seed + 300);
    this.treeSeed = seed;
  }

  getBiome(wx: number, wz: number): BiomeType {
    const temp = this.temperatureNoise.fbm2D(wx * 0.005, wz * 0.005, 3);
    const humid = this.humidityNoise.fbm2D(wx * 0.005, wz * 0.005, 3);

    if (temp < -0.3) return BiomeType.Snow;
    if (temp > 0.35 && humid < 0.1) return BiomeType.Desert;
    if (humid > 0.3 && temp > -0.1) return BiomeType.Forest;

    // Check if below sea level = ocean
    const baseHeight = 64 + this.noise.fbm2D(wx * 0.008, wz * 0.008, 4) * 30;
    if (baseHeight < SEA_LEVEL - 2) return BiomeType.Ocean;

    if (temp > 0.1) return BiomeType.Mountains;
    return BiomeType.Plains;
  }

  getTerrainHeight(wx: number, wz: number): number {
    const biome = this.getBiome(wx, wz);
    const cfg = BIOME_CONFIGS[biome];

    const n = this.noise.fbm2D(wx * 0.01, wz * 0.01, 6, 2.0, 0.45);
    const height = cfg.baseHeight + n * cfg.amplitude;

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

          if (y === 0) {
            blockId = 7; // bedrock
          } else if (y < height - cfg.stoneDepth) {
            blockId = 1; // stone
          } else if (y < height) {
            blockId = cfg.underBlock; // dirt/sand/snow under surface
          } else if (y === height) {
            blockId = cfg.surfaceBlock; // grass/sand/etc surface
          } else if (y <= SEA_LEVEL && y > height) {
            blockId = 9; // water (still)
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

    chunk.dirty = true;
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
    } else {
      this.placeOakTree(chunk, x, y, z);
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
        if (biome === BiomeType.Desert || biome === BiomeType.Ocean) continue;

        const rand = this.pseudoRandom(wx * 31, 99, wz * 17);
        if (rand > 0.08) continue;

        // Find surface
        let surfaceY = -1;
        for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
          const id = chunk.getBlock(x, y, z);
          if (id === 2 || id === 27) { // grass or snow
            surfaceY = y;
            break;
          }
        }
        if (surfaceY < 10) continue;

        const aboveBlock = chunk.getBlock(x, surfaceY + 1, z);
        if (aboveBlock !== 0) continue;

        const decorRand = this.pseudoRandom(wx * 43, surfaceY, wz * 59);

        if (biome === BiomeType.Forest) {
          if (decorRand < 0.3) chunk.setBlock(x, surfaceY + 1, z, 38); // poppy
          else if (decorRand < 0.5) chunk.setBlock(x, surfaceY + 1, z, 37); // dandelion
          else if (decorRand < 0.6) chunk.setBlock(x, surfaceY + 1, z, (2 << 10) | 31); // fern
          else chunk.setBlock(x, surfaceY + 1, z, (1 << 10) | 31); // tall grass
        } else if (biome === BiomeType.Snow) {
          // Snow biome: less variety
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
