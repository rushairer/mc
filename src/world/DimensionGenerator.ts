import * as THREE from 'three';
import { SimplexNoise } from '../world/SimplexNoise';
import { CHUNK_SIZE, WORLD_HEIGHT } from '../constants';
import { Chunk } from '../world/Chunk';
import { EndGenerator } from './EndGenerator';

export enum Dimension {
  Overworld = 0,
  Nether = 1,
  End = 2,
}

export class DimensionGenerator {
  private netherNoise: SimplexNoise;
  private netherNoise2: SimplexNoise;
  private lavaNoise: SimplexNoise;
  private endNoise: SimplexNoise;
  private endIslandNoise: SimplexNoise;
  readonly endGenerator: EndGenerator;

  constructor(seed: number) {
    this.netherNoise = new SimplexNoise(seed + 1000);
    this.netherNoise2 = new SimplexNoise(seed + 2000);
    this.lavaNoise = new SimplexNoise(seed + 3000);
    this.endNoise = new SimplexNoise(seed + 4000);
    this.endIslandNoise = new SimplexNoise(seed + 5000);
    this.endGenerator = new EndGenerator(seed);
  }

  generateEndChunk(chunk: Chunk) {
    const cx = chunk.cx;
    const cz = chunk.cz;
    const worldX = cx * CHUNK_SIZE;
    const worldZ = cz * CHUNK_SIZE;

    const END_STONE = 121;
    const OBSIDIAN = 49;
    const BEDROCK = 7;
    const FIRE = 51;
    const GLASS = 20;
    const ISLAND_CENTER_Y = 64;

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = worldX + x;
        const wz = worldZ + z;
        const distance = Math.sqrt(wx * wx + wz * wz);
        const columnNoise = this.endNoise.fbm2D(wx * 0.035, wz * 0.035, 4, 2.0, 0.5);
        const ridgeNoise = this.endNoise.noise2D(wx * 0.09, wz * 0.09);

        let topY = -1;
        let bottomY = -1;

        if (distance < 128) {
          const falloff = Math.max(0, 1 - distance / 128);
          const thickness = Math.max(2, Math.floor(10 + falloff * 18 + columnNoise * 4));
          topY = Math.floor(ISLAND_CENTER_Y + falloff * 9 + columnNoise * 5);
          bottomY = Math.floor(topY - thickness * (0.55 + falloff * 0.7));
        } else {
          const islandNoise = this.endIslandNoise.fbm2D(wx * 0.008, wz * 0.008, 3, 2.0, 0.45);
          const localNoise = this.endNoise.fbm2D(wx * 0.03, wz * 0.03, 3, 2.0, 0.5);
          if (islandNoise > 0.58) {
            const islandStrength = Math.min(1, (islandNoise - 0.58) / 0.22);
            const thickness = Math.max(2, Math.floor(4 + islandStrength * 10 + localNoise * 3));
            topY = Math.floor(58 + islandStrength * 10 + localNoise * 5);
            bottomY = topY - thickness;
          }
        }

        for (let y = 0; y < WORLD_HEIGHT; y++) {
          let blockId = 0;
          if (topY >= 0 && y >= bottomY && y <= topY) {
            const undersideTaper = (y - bottomY) / Math.max(1, topY - bottomY);
            const keep = undersideTaper > 0.18 || ridgeNoise > -0.35;
            blockId = keep ? END_STONE : 0;
          }
          chunk.setBlock(x, y, z, blockId);
        }
      }
    }

    this.generateEndSpawnPlatform(chunk, OBSIDIAN);
    this.generateEndPillars(chunk, OBSIDIAN, BEDROCK, FIRE, GLASS);
    this.endGenerator.decorateChunk(chunk);

    chunk.dirty = true;
  }

  private generateEndSpawnPlatform(chunk: Chunk, obsidianId: number) {
    const worldX = chunk.cx * CHUNK_SIZE;
    const worldZ = chunk.cz * CHUNK_SIZE;
    const platformY = 64;

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = worldX + x;
        const wz = worldZ + z;
        if (wx >= -2 && wx <= 2 && wz >= -2 && wz <= 2) {
          chunk.setBlock(x, platformY, z, obsidianId);
          for (let y = platformY + 1; y <= platformY + 8; y++) {
            chunk.setBlock(x, y, z, 0);
          }
        }
      }
    }
  }

  private generateEndPillars(chunk: Chunk, obsidianId: number, bedrockId: number, fireId: number, glassId: number) {
    const pillars = [
      { x: 38, z: 0, radius: 3, height: 34 },
      { x: -34, z: 16, radius: 3, height: 39 },
      { x: 12, z: -42, radius: 2, height: 31 },
      { x: -48, z: -28, radius: 4, height: 45 },
      { x: 55, z: 34, radius: 3, height: 42 },
      { x: -5, z: 58, radius: 2, height: 36 },
      { x: 72, z: -18, radius: 4, height: 49 },
      { x: -70, z: 46, radius: 3, height: 44 },
    ];

    const worldX = chunk.cx * CHUNK_SIZE;
    const worldZ = chunk.cz * CHUNK_SIZE;

    for (const pillar of pillars) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
          const wx = worldX + x;
          const wz = worldZ + z;
          const dx = wx - pillar.x;
          const dz = wz - pillar.z;
          if (dx * dx + dz * dz > pillar.radius * pillar.radius) continue;

          const baseY = 62;
          for (let y = baseY; y < baseY + pillar.height && y < WORLD_HEIGHT; y++) {
            chunk.setBlock(x, y, z, obsidianId);
          }
        }
      }

      const topY = 62 + pillar.height;
      this.setIfInChunk(chunk, pillar.x, topY, pillar.z, bedrockId);
      this.setIfInChunk(chunk, pillar.x, topY + 1, pillar.z, fireId);
      this.setIfInChunk(chunk, pillar.x, topY + 2, pillar.z, glassId);
    }
  }

  private setIfInChunk(chunk: Chunk, wx: number, y: number, wz: number, blockId: number) {
    if (y < 0 || y >= WORLD_HEIGHT) return;
    const minX = chunk.cx * CHUNK_SIZE;
    const minZ = chunk.cz * CHUNK_SIZE;
    const lx = wx - minX;
    const lz = wz - minZ;
    if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) return;
    chunk.setBlock(lx, y, lz, blockId);
  }

  generateNetherChunk(chunk: Chunk) {
    const cx = chunk.cx;
    const cz = chunk.cz;
    const worldX = cx * CHUNK_SIZE;
    const worldZ = cz * CHUNK_SIZE;

    // Nether is 128 blocks tall, mostly enclosed
    const NETHER_HEIGHT = 128;

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = worldX + x;
        const wz = worldZ + z;

        // Terrain shape: 3D noise carving
        for (let y = 0; y < NETHER_HEIGHT; y++) {
          let blockId = 87; // netherrack (ID 87)

          // Carve large caves
          const cave1 = this.netherNoise.fbm3D(wx * 0.02, y * 0.03, wz * 0.02, 4);
          const cave2 = this.netherNoise2.noise3D(wx * 0.04, y * 0.05, wz * 0.04);

          if (cave1 > 0.3 && cave2 > 0) {
            blockId = 0; // air (nether cave)
          }

          // Lava lakes at bottom
          if (y < 30) {
            const lavaLevel = this.lavaNoise.noise2D(wx * 0.03, wz * 0.03);
            if (y < 30 + lavaLevel * 5) {
              if (blockId === 0) blockId = 11; // stationary lava (ID 11)
            }
          }

          // Bedrock ceiling and floor
          if (y === 0 || y >= NETHER_HEIGHT - 1) {
            blockId = 7; // bedrock (ID 7)
          }

          // Nether quartz ore
          if (blockId === 87 && y > 10 && y < 117) {
            const quartz = this.netherNoise.noise3D(wx * 0.1, y * 0.1, wz * 0.1);
            if (quartz > 0.7) {
              blockId = 153; // nether quartz ore (ID 153)
            }
          }

          // Soul sand valleys/patches on top of netherrack floors (y around 30 to 45)
          if (blockId === 87 && y >= 30 && y <= 45) {
            const soulPatch = this.netherNoise.noise2D(wx * 0.05, wz * 0.05);
            if (soulPatch > 0.45) {
              blockId = 88; // soul sand (ID 88)
            }
          }

          // Glowstone clusters on ceiling
          if (blockId === 87 && y > NETHER_HEIGHT - 12 && y < NETHER_HEIGHT - 1) {
            const glow = this.netherNoise2.noise3D(wx * 0.08, y * 0.08, wz * 0.08);
            if (glow > 0.6) {
              blockId = 89; // glowstone (ID 89)
            }
          }

          // Nether Wart growing on Soul Sand
          if (blockId === 0 && y > 0) {
            const blockBelow = chunk.getBlock(x, y - 1, z) & 0x3FF;
            if (blockBelow === 88) {
              const wartNoise = this.netherNoise.noise3D(wx * 0.2, y * 0.2, wz * 0.2);
              if (wartNoise > 0.6) {
                const age = Math.floor((wartNoise - 0.6) * 10) % 4; // 0-3
                blockId = (age << 10) | 115; // nether_wart (ID 115)
              }
            }
          }

          chunk.setBlock(x, y, z, blockId);
        }

        // Fill above nether height with air
        for (let y = NETHER_HEIGHT; y < WORLD_HEIGHT; y++) {
          chunk.setBlock(x, y, z, 0);
        }
      }
    }

    // Generate Nether Brick ruins ( pillars / archways )
    const chunkHash = Math.abs(Math.sin(cx * 12.9898 + cz * 78.233) * 43758.5453) % 1.0;
    if (chunkHash < 0.08) { // 8% chance per chunk
      const rx = Math.floor(chunkHash * 100) % 12 + 2; // avoid edge boundaries [2, 13]
      const rz = Math.floor(chunkHash * 1000) % 12 + 2;

      // Find solid floor with air pocket
      let floorY = -1;
      for (let y = 35; y < 75; y++) {
        const id = chunk.getBlock(rx, y, rz) & 0x3FF;
        const idAbove = chunk.getBlock(rx, y + 1, rz) & 0x3FF;
        if ((id === 87 || id === 88) && idAbove === 0) {
          // Verify clear space above
          let clear = true;
          for (let h = 1; h <= 6; h++) {
            if ((chunk.getBlock(rx, y + h, rz) & 0x3FF) !== 0) {
              clear = false;
              break;
            }
          }
          if (clear) {
            floorY = y;
            break;
          }
        }
      }

      if (floorY !== -1) {
        // Build Nether Brick ruins!
        const pillarHeight = 4 + (Math.floor(chunkHash * 50) % 2);
        for (let h = 1; h <= pillarHeight; h++) {
          chunk.setBlock(rx, floorY + h, rz, 112); // nether_brick
        }
        chunk.setBlock(rx, floorY + pillarHeight + 1, rz, 112);
        chunk.setBlock(rx - 1, floorY + pillarHeight + 1, rz, 112);
        chunk.setBlock(rx + 1, floorY + pillarHeight + 1, rz, 112);
        chunk.setBlock(rx - 1, floorY + pillarHeight, rz, 112);
        chunk.setBlock(rx + 1, floorY + pillarHeight, rz, 112);
      }
    }

    chunk.dirty = true;
  }

  /**
   * Check if a portal frame is complete (4×5 obsidian frame).
   * Returns center position if valid.
   */
  checkPortalFrame(
    getBlock: (x: number, y: number, z: number) => number,
    x: number, y: number, z: number
  ): { valid: boolean; cx: number; cy: number; cz: number; axis: 'x' | 'z' } | null {
    // Check both X and Z axis orientations
    for (const axis of ['x', 'z'] as const) {
      const isValid = this.checkPortalAtAxis(getBlock, x, y, z, axis);
      if (isValid) {
        return {
          valid: true,
          cx: x,
          cy: y + 2,
          cz: z,
          axis,
        };
      }
    }
    return null;
  }

  private checkPortalAtAxis(
    getBlock: (x: number, y: number, z: number) => number,
    x: number, y: number, z: number,
    axis: 'x' | 'z'
  ): boolean {
    // Portal is 4 wide × 5 tall obsidian frame with 2×3 air inside
    const dx = axis === 'x' ? 1 : 0;
    const dz = axis === 'z' ? 1 : 0;

    // Check all obsidian border blocks
    for (let h = 0; h < 5; h++) {
      // Left/right pillars
      if (getBlock(x - dx, y + h, z - dz) !== 49) return false; // obsidian (stone placeholder was 1)
      if (getBlock(x + dx * 3, y + h, z + dz * 3) !== 49) return false;

      // Top/bottom bars
      if (h === 0 || h === 4) {
        for (let w = 0; w < 4; w++) {
          if (getBlock(x + dx * w, y + h, z + dz * w) !== 49) return false;
        }
      }
    }

    // Check inside is air
    for (let h = 1; h <= 3; h++) {
      for (let w = 1; w <= 2; w++) {
        if (getBlock(x + dx * w, y + h, z + dz * w) !== 0) return false;
      }
    }

    return true;
  }

  /**
   * Fill portal interior with portal blocks.
   */
  activatePortal(
    setBlock: (x: number, y: number, z: number, id: number) => void,
    x: number, y: number, z: number,
    axis: 'x' | 'z'
  ) {
    const dx = axis === 'x' ? 1 : 0;
    const dz = axis === 'z' ? 1 : 0;

    for (let h = 1; h <= 3; h++) {
      for (let w = 1; w <= 2; w++) {
        setBlock(x + dx * w, y + h, z + dz * w, 90);
      }
    }
  }

  /**
   * Robust search: scans all 6 possible portal positions relative to a clicked air block.
   */
  findAndActivatePortalFrame(
    getBlock: (x: number, y: number, z: number) => number,
    setBlock: (x: number, y: number, z: number, id: number) => void,
    ax: number, ay: number, az: number
  ): { cx: number; cy: number; cz: number; axis: 'x' | 'z' } | null {
    for (const axis of ['x', 'z'] as const) {
      const dx = axis === 'x' ? 1 : 0;
      const dz = axis === 'z' ? 1 : 0;

      for (let w = 0; w < 2; w++) {
        for (let h = 0; h < 3; h++) {
          const x0 = ax - w * dx;
          const y0 = ay - h;
          const z0 = az - w * dz;

          if (this.checkPortalAtBottomLeft(getBlock, x0, y0, z0, axis)) {
            this.activatePortalAt(setBlock, x0, y0, z0, axis);
            return {
              cx: x0 + dx * 0.5 + 0.5,
              cy: y0 + 1,
              cz: z0 + dz * 0.5 + 0.5,
              axis,
            };
          }
        }
      }
    }
    return null;
  }

  checkPortalAtBottomLeft(
    getBlock: (x: number, y: number, z: number) => number,
    x0: number, y0: number, z0: number,
    axis: 'x' | 'z'
  ): boolean {
    const dx = axis === 'x' ? 1 : 0;
    const dz = axis === 'z' ? 1 : 0;

    // Check bottom obsidian
    for (let w = 0; w < 2; w++) {
      if (getBlock(x0 + w * dx, y0 - 1, z0 + w * dz) !== 49) return false;
    }
    // Check top obsidian
    for (let w = 0; w < 2; w++) {
      if (getBlock(x0 + w * dx, y0 + 3, z0 + w * dz) !== 49) return false;
    }
    // Check left pillar obsidian
    for (let h = 0; h < 3; h++) {
      if (getBlock(x0 - dx, y0 + h, z0 - dz) !== 49) return false;
    }
    // Check right pillar obsidian
    for (let h = 0; h < 3; h++) {
      if (getBlock(x0 + 2 * dx, y0 + h, z0 + 2 * dz) !== 49) return false;
    }

    // Check inside is air or portal
    for (let w = 0; w < 2; w++) {
      for (let h = 0; h < 3; h++) {
        const id = getBlock(x0 + w * dx, y0 + h, z0 + w * dz);
        if (id !== 0 && id !== 90) return false;
      }
    }

    return true;
  }

  activatePortalAt(
    setBlock: (x: number, y: number, z: number, id: number) => void,
    x0: number, y0: number, z0: number,
    axis: 'x' | 'z'
  ) {
    const dx = axis === 'x' ? 1 : 0;
    const dz = axis === 'z' ? 1 : 0;

    for (let w = 0; w < 2; w++) {
      for (let h = 0; h < 3; h++) {
        setBlock(x0 + w * dx, y0 + h, z0 + w * dz, 90);
      }
    }
  }

  /**
   * Convert overworld coords to nether coords (÷8).
   */
  overworldToNether(ox: number, oz: number): { nx: number; nz: number } {
    return { nx: Math.floor(ox / 8), nz: Math.floor(oz / 8) };
  }

  /**
   * Convert nether coords to overworld coords (×8).
   */
  netherToOverworld(nx: number, nz: number): { ox: number; oz: number } {
    return { ox: nx * 8, oz: nz * 8 };
  }
}
