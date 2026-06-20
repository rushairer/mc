import { WorldGen, BiomeType } from '../world/WorldGen';

export interface MapData {
  id: number;
  centerX: number;
  centerZ: number;
  scale: number;
  dimension: number;
  pixels: string[];
  playerMarker: { x: number; z: number };
}

const MAP_SIZE = 32;

const BIOME_COLORS: Record<BiomeType, string> = {
  [BiomeType.Plains]: '#6bb34a',
  [BiomeType.Desert]: '#d9c06c',
  [BiomeType.Mountains]: '#8f8f86',
  [BiomeType.Forest]: '#2f7d38',
  [BiomeType.Snow]: '#dce8ee',
  [BiomeType.Ocean]: '#2d62b3',
  [BiomeType.Swamp]: '#4f6f3a',
  [BiomeType.Jungle]: '#1f8f36',
  [BiomeType.River]: '#3b86d1',
  [BiomeType.MushroomIsland]: '#a75aa0',
  [BiomeType.Badlands]: '#b56a3a',
};

export class MapSystem {
  private nextMapId = 1;

  createFilledMap(worldGen: WorldGen, x: number, z: number, dimension: number, scale = 4): MapData {
    const centerX = Math.floor(x);
    const centerZ = Math.floor(z);
    const pixels: string[] = [];
    const half = MAP_SIZE / 2;

    for (let py = 0; py < MAP_SIZE; py++) {
      for (let px = 0; px < MAP_SIZE; px++) {
        const wx = Math.floor(centerX + (px - half) * scale);
        const wz = Math.floor(centerZ + (py - half) * scale);
        const biome = worldGen.getBiome(wx, wz);
        const height = worldGen.getTerrainHeight(wx, wz);
        pixels.push(this.tintForHeight(BIOME_COLORS[biome] ?? '#5f9f47', height));
      }
    }

    return {
      id: this.nextMapId++,
      centerX,
      centerZ,
      scale,
      dimension,
      pixels,
      playerMarker: { x: half, z: half },
    };
  }

  restoreFromMaps(maps: MapData[]) {
    const maxId = maps.reduce((max, map) => Math.max(max, map.id), 0);
    this.nextMapId = Math.max(this.nextMapId, maxId + 1);
  }

  private tintForHeight(hex: string, height: number): string {
    const shade = Math.max(-28, Math.min(28, height - 64));
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, (n >> 16) + shade));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + shade));
    const b = Math.max(0, Math.min(255, (n & 255) + shade));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
}
