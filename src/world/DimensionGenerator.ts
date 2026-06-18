import * as THREE from 'three';
import { SimplexNoise } from '../world/SimplexNoise';
import { CHUNK_SIZE, WORLD_HEIGHT } from '../constants';
import { Chunk } from '../world/Chunk';

export enum Dimension {
  Overworld = 0,
  Nether = 1,
}

export class DimensionGenerator {
  private netherNoise: SimplexNoise;
  private netherNoise2: SimplexNoise;
  private lavaNoise: SimplexNoise;

  constructor(seed: number) {
    this.netherNoise = new SimplexNoise(seed + 1000);
    this.netherNoise2 = new SimplexNoise(seed + 2000);
    this.lavaNoise = new SimplexNoise(seed + 3000);
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
          let blockId = 1; // netherrack (using stone texture as placeholder)

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
              if (blockId === 0) blockId = 14; // lava
            }
          }

          // Bedrock ceiling and floor
          if (y === 0 || y >= NETHER_HEIGHT - 1) {
            blockId = 1; // bedrock
          }

          // Nether quartz ore
          if (blockId === 1 && y > 10 && y < 117) {
            const quartz = this.netherNoise.noise3D(wx * 0.1, y * 0.1, wz * 0.1);
            if (quartz > 0.7) {
              blockId = 1; // quartz ore (using stone)
            }
          }

          // Glowstone clusters on ceiling
          if (y > NETHER_HEIGHT - 10) {
            const glow = this.netherNoise2.noise3D(wx * 0.08, y * 0.08, wz * 0.08);
            if (glow > 0.6) {
              blockId = 30; // glowstone (using torch for now)
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
