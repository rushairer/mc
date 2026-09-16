import { WorldGen, BiomeType } from '../world/WorldGen';
import { normalizeMapFacingDegrees26_3 } from '../world/WildernessBoundChanges26_3';

export interface MapData {
  id: number;
  centerX: number;
  centerZ: number;
  /** Java map scale level, from 0 (1:1) through 4 (1:16). */
  scale: number;
  dimension: number;
  pixels: string[];
  /** Java 26.3 map player marker always carries facing. */
  playerMarker: { x: number; z: number; rotation?: number };
  /** P3.5 — cartography table lock. */
  locked?: boolean;
  /** Java 26.3 dedicated Explorer Map item type, when this is not a normal Filled Map. */
  explorerItemName?: string;
  /** Marker for the located structure represented by an Explorer Map. */
  targetMarker?: { x: number; z: number; structure: string };
}

const MAP_SIZE = 128;
const MIN_SCALE = 0;
const MAX_SCALE = 4;

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

function clampScale(scale: number): number {
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.floor(scale)));
}

function blocksPerPixel(scale: number): number {
  return 1 << clampScale(scale);
}

/**
 * Since Java 1.8 every map scale is snapped to a global grid whose top-left
 * corner is `multipleOfMapWidth - 64`. This is what makes adjacent maps tile
 * without arbitrary overlaps.
 */
function alignedCenter(coordinate: number, scale: number): number {
  const width = MAP_SIZE * blocksPerPixel(scale);
  return Math.floor((Math.floor(coordinate) + 64) / width) * width + width / 2 - 64;
}

function markerCoordinate(coordinate: number, center: number, scale: number): number {
  const half = MAP_SIZE / 2;
  const pixel = Math.floor((coordinate - center) / blocksPerPixel(scale)) + half;
  return Math.max(0, Math.min(MAP_SIZE - 1, pixel));
}

function playerMarker(
  x: number,
  z: number,
  centerX: number,
  centerZ: number,
  scale: number,
  yawDegrees: number,
): MapData['playerMarker'] {
  return {
    x: markerCoordinate(x, centerX, scale),
    z: markerCoordinate(z, centerZ, scale),
    rotation: normalizeMapFacingDegrees26_3(yawDegrees),
  };
}

export class MapSystem {
  private nextMapId = 1;

  createFilledMap(
    worldGen: WorldGen,
    x: number,
    z: number,
    dimension: number,
    scale = 0,
    playerYawDegrees = 0,
  ): MapData {
    const scaleLevel = clampScale(scale);
    const sampleStride = blocksPerPixel(scaleLevel);
    const centerX = alignedCenter(x, scaleLevel);
    const centerZ = alignedCenter(z, scaleLevel);
    const pixels: string[] = [];
    const half = MAP_SIZE / 2;

    for (let py = 0; py < MAP_SIZE; py++) {
      for (let px = 0; px < MAP_SIZE; px++) {
        const wx = centerX + (px - half) * sampleStride;
        const wz = centerZ + (py - half) * sampleStride;
        const biome = worldGen.getBiome(wx, wz);
        const height = worldGen.getTerrainHeight(wx, wz);
        pixels.push(this.tintForHeight(BIOME_COLORS[biome] ?? '#5f9f47', height));
      }
    }

    return {
      id: this.nextMapId++,
      centerX,
      centerZ,
      scale: scaleLevel,
      dimension,
      pixels,
      playerMarker: playerMarker(x, z, centerX, centerZ, scaleLevel, playerYawDegrees),
    };
  }

  /** Create a Java 26.3 dedicated Explorer Map centered on a located structure. */
  createExplorerMap(
    worldGen: WorldGen,
    playerX: number,
    playerZ: number,
    dimension: number,
    explorerItemName: string,
    targetX: number,
    targetZ: number,
    scale = 2,
    playerYawDegrees = 0,
  ): MapData {
    const map = this.createFilledMap(worldGen, targetX, targetZ, dimension, scale, playerYawDegrees);
    return {
      ...map,
      explorerItemName,
      playerMarker: playerMarker(
        playerX,
        playerZ,
        map.centerX,
        map.centerZ,
        map.scale,
        playerYawDegrees,
      ),
      targetMarker: {
        x: markerCoordinate(targetX, map.centerX, map.scale),
        z: markerCoordinate(targetZ, map.centerZ, map.scale),
        structure: explorerItemName,
      },
    };
  }

  /** Refresh player position + facing without re-sampling terrain. */
  updatePlayerMarker(map: MapData, x: number, z: number, playerYawDegrees: number): MapData {
    return {
      ...map,
      playerMarker: playerMarker(x, z, map.centerX, map.centerZ, map.scale, playerYawDegrees),
    };
  }

  restoreFromMaps(maps: MapData[]) {
    const maxId = maps.reduce((max, map) => Math.max(max, map.id), 0);
    this.nextMapId = Math.max(this.nextMapId, maxId + 1);
  }

  // ─── P3.5: cartography table operations ───

  /** Clone a map: identical data with a fresh id (map + empty map). */
  cloneMap(map: MapData): MapData {
    return {
      ...map,
      id: this.nextMapId++,
      pixels: [...map.pixels],
      playerMarker: { ...map.playerMarker },
      targetMarker: map.targetMarker ? { ...map.targetMarker } : undefined,
    };
  }

  /** Java 26.3: only maps in #minecraft:extendable_maps may be zoomed out. */
  canZoomOutMap(map: MapData): boolean {
    return !map.explorerItemName && !map.locked && clampScale(map.scale) < MAX_SCALE;
  }

  /**
   * Zoom out by one Java scale level (max 4) and re-sample on that scale's
   * global grid. Explorer Maps deliberately remain unchanged in Java 26.3.
   */
  zoomOutMap(map: MapData, worldGen: WorldGen): MapData {
    if (!this.canZoomOutMap(map)) {
      return {
        ...map,
        pixels: [...map.pixels],
        playerMarker: { ...map.playerMarker },
        targetMarker: map.targetMarker ? { ...map.targetMarker } : undefined,
      };
    }
    const scale = Math.min(MAX_SCALE, clampScale(map.scale) + 1);
    const reSampled = this.createFilledMap(
      worldGen,
      map.centerX,
      map.centerZ,
      map.dimension,
      scale,
      map.playerMarker.rotation ?? 0,
    );
    return { ...reSampled, locked: map.locked };
  }

  /** Lock a map so its terrain data can no longer update or be zoomed. */
  lockMap(map: MapData): MapData {
    return {
      ...map,
      locked: true,
      pixels: [...map.pixels],
      playerMarker: { ...map.playerMarker },
      targetMarker: map.targetMarker ? { ...map.targetMarker } : undefined,
    };
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
