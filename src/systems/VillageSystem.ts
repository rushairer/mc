import type { Chunk } from '../world/Chunk';
import { BiomeType, type WorldGen } from '../world/WorldGen';
import { CHUNK_SIZE, SEA_LEVEL, WORLD_HEIGHT } from '../constants';
import type { Inventory } from '../player/Inventory';

export type VillagerProfession = 'farmer' | 'librarian' | 'toolsmith' | 'cleric';

export interface VillageInfo {
  id: string;
  centerX: number;
  centerZ: number;
  profession: VillagerProfession;
  spawnPoints: { x: number; y: number; z: number }[];
}

export interface TradeOffer {
  id: string;
  profession: VillagerProfession;
  input: { id: number; count: number };
  output: { id: number; count: number };
}

interface HousePlan {
  x: number;
  z: number;
  w: number;
  d: number;
  profession: VillagerProfession;
}

const VILLAGE_CELL_SIZE = 128;
const VILLAGE_RADIUS = 44;
const PROFESSIONS: VillagerProfession[] = ['farmer', 'librarian', 'toolsmith', 'cleric'];

const TRADE_TABLE: Record<VillagerProfession, TradeOffer[]> = {
  farmer: [
    { id: 'farmer_wheat', profession: 'farmer', input: { id: 296, count: 20 }, output: { id: 388, count: 1 } },
    { id: 'farmer_bread', profession: 'farmer', input: { id: 388, count: 1 }, output: { id: 297, count: 6 } },
    { id: 'farmer_apple', profession: 'farmer', input: { id: 388, count: 2 }, output: { id: 260, count: 5 } },
  ],
  librarian: [
    { id: 'librarian_paper', profession: 'librarian', input: { id: 339, count: 24 }, output: { id: 388, count: 1 } },
    { id: 'librarian_bookshelf', profession: 'librarian', input: { id: 388, count: 3 }, output: { id: 47, count: 1 } },
    { id: 'librarian_book', profession: 'librarian', input: { id: 388, count: 1 }, output: { id: 340, count: 2 } },
  ],
  toolsmith: [
    { id: 'toolsmith_coal', profession: 'toolsmith', input: { id: 263, count: 15 }, output: { id: 388, count: 1 } },
    { id: 'toolsmith_iron_pickaxe', profession: 'toolsmith', input: { id: 388, count: 5 }, output: { id: 257, count: 1 } },
    { id: 'toolsmith_iron_axe', profession: 'toolsmith', input: { id: 388, count: 4 }, output: { id: 258, count: 1 } },
  ],
  cleric: [
    { id: 'cleric_rotten_flesh', profession: 'cleric', input: { id: 367, count: 20 }, output: { id: 388, count: 1 } },
    { id: 'cleric_redstone', profession: 'cleric', input: { id: 388, count: 2 }, output: { id: 331, count: 6 } },
    { id: 'cleric_glowstone', profession: 'cleric', input: { id: 388, count: 3 }, output: { id: 348, count: 4 } },
  ],
};

export class VillageSystem {
  static getOffers(profession: VillagerProfession): TradeOffer[] {
    return TRADE_TABLE[profession] ?? TRADE_TABLE.farmer;
  }

  static performTrade(inventory: Inventory, offer: TradeOffer, creative = false): boolean {
    if (!creative && inventory.countItem(offer.input.id) < offer.input.count) {
      return false;
    }

    if (!creative) {
      inventory.removeItem(offer.input.id, offer.input.count);
    }

    const leftover = inventory.addItem(offer.output.id, offer.output.count);
    if (leftover > 0) {
      // Roll back the payment if the reward cannot fit.
      if (!creative) {
        inventory.addItem(offer.input.id, offer.input.count);
      }
      return false;
    }

    return true;
  }

  static getNearbyVillages(worldGen: WorldGen, wx: number, wz: number, radius: number): VillageInfo[] {
    const villages: VillageInfo[] = [];
    const minCellX = Math.floor((wx - radius) / VILLAGE_CELL_SIZE);
    const maxCellX = Math.floor((wx + radius) / VILLAGE_CELL_SIZE);
    const minCellZ = Math.floor((wz - radius) / VILLAGE_CELL_SIZE);
    const maxCellZ = Math.floor((wz + radius) / VILLAGE_CELL_SIZE);

    for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
      for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ++) {
        const village = this.getVillageForCell(worldGen, cellX, cellZ);
        if (!village) continue;
        const dx = village.centerX - wx;
        const dz = village.centerZ - wz;
        if (dx * dx + dz * dz <= radius * radius) {
          villages.push(village);
        }
      }
    }

    return villages;
  }

  static generateChunk(worldGen: WorldGen, chunk: Chunk) {
    const worldX = chunk.cx * CHUNK_SIZE;
    const worldZ = chunk.cz * CHUNK_SIZE;
    const villages = this.getVillagesTouchingChunk(worldGen, chunk.cx, chunk.cz);

    for (const village of villages) {
      this.placeVillageRoads(worldGen, chunk, worldX, worldZ, village);
      this.placeVillageFarms(worldGen, chunk, worldX, worldZ, village);
      for (const house of this.getHousePlans(village)) {
        this.placeHouse(worldGen, chunk, worldX, worldZ, house);
      }
    }
  }

  private static getVillagesTouchingChunk(worldGen: WorldGen, cx: number, cz: number): VillageInfo[] {
    const chunkCenterX = cx * CHUNK_SIZE + CHUNK_SIZE / 2;
    const chunkCenterZ = cz * CHUNK_SIZE + CHUNK_SIZE / 2;
    const search = VILLAGE_RADIUS + CHUNK_SIZE;
    return this.getNearbyVillages(worldGen, chunkCenterX, chunkCenterZ, search);
  }

  private static getVillageForCell(worldGen: WorldGen, cellX: number, cellZ: number): VillageInfo | null {
    const roll = this.hash01(worldGen.seed, cellX, 19, cellZ);
    if (roll > 0.28) return null;

    const offsetX = Math.floor((this.hash01(worldGen.seed, cellX, 41, cellZ) - 0.5) * 52);
    const offsetZ = Math.floor((this.hash01(worldGen.seed, cellX, 73, cellZ) - 0.5) * 52);
    const centerX = cellX * VILLAGE_CELL_SIZE + VILLAGE_CELL_SIZE / 2 + offsetX;
    const centerZ = cellZ * VILLAGE_CELL_SIZE + VILLAGE_CELL_SIZE / 2 + offsetZ;
    const biome = worldGen.getBiome(centerX, centerZ);
    if (biome !== BiomeType.Plains && biome !== BiomeType.Desert) return null;

    const centerY = worldGen.getTerrainHeight(centerX, centerZ);
    if (centerY <= SEA_LEVEL + 1) return null;

    let maxDelta = 0;
    const sample = [
      [centerX - 18, centerZ - 18],
      [centerX + 18, centerZ - 18],
      [centerX - 18, centerZ + 18],
      [centerX + 18, centerZ + 18],
      [centerX, centerZ],
    ];
    for (const [sx, sz] of sample) {
      maxDelta = Math.max(maxDelta, Math.abs(worldGen.getTerrainHeight(sx, sz) - centerY));
    }
    if (maxDelta > 7) return null;

    const profession = PROFESSIONS[Math.floor(this.hash01(worldGen.seed, cellX, 101, cellZ) * PROFESSIONS.length)];
    const id = `${cellX},${cellZ}`;
    const plans = this.getHousePlans({ centerX, centerZ, profession });
    const spawnPoints = plans.slice(0, 4).map((house) => ({
      x: house.x + Math.floor(house.w / 2) + 0.5,
      y: worldGen.getTerrainHeight(house.x + Math.floor(house.w / 2), house.z + Math.floor(house.d / 2)) + 2,
      z: house.z + Math.floor(house.d / 2) + 0.5,
    }));

    return { id, centerX, centerZ, profession, spawnPoints };
  }

  private static getHousePlans(village: Pick<VillageInfo, 'centerX' | 'centerZ' | 'profession'>): HousePlan[] {
    const cx = Math.floor(village.centerX);
    const cz = Math.floor(village.centerZ);
    return [
      { x: cx - 24, z: cz - 18, w: 8, d: 7, profession: 'farmer' },
      { x: cx + 14, z: cz - 18, w: 8, d: 7, profession: 'librarian' },
      { x: cx - 22, z: cz + 14, w: 7, d: 8, profession: 'toolsmith' },
      { x: cx + 14, z: cz + 14, w: 7, d: 8, profession: 'cleric' },
      { x: cx - 4, z: cz - 31, w: 8, d: 7, profession: village.profession },
    ];
  }

  private static placeVillageRoads(worldGen: WorldGen, chunk: Chunk, worldX: number, worldZ: number, village: VillageInfo) {
    const cx = Math.floor(village.centerX);
    const cz = Math.floor(village.centerZ);
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = worldX + lx;
        const wz = worldZ + lz;
        const onRoad =
          (Math.abs(wx - cx) <= 1 && Math.abs(wz - cz) <= 35) ||
          (Math.abs(wz - cz) <= 1 && Math.abs(wx - cx) <= 35);
        if (!onRoad) continue;
        const y = worldGen.getTerrainHeight(wx, wz);
        if (y <= SEA_LEVEL) continue;
        this.clearAbove(chunk, lx, y + 1, lz, 3);
        chunk.setBlock(lx, y, lz, 13); // gravel path
      }
    }
  }

  private static placeVillageFarms(worldGen: WorldGen, chunk: Chunk, worldX: number, worldZ: number, village: VillageInfo) {
    const farms = [
      { x: Math.floor(village.centerX) - 12, z: Math.floor(village.centerZ) + 4 },
      { x: Math.floor(village.centerX) + 5, z: Math.floor(village.centerZ) + 4 },
    ];

    for (const farm of farms) {
      for (let wx = farm.x; wx < farm.x + 7; wx++) {
        for (let wz = farm.z; wz < farm.z + 9; wz++) {
          const lx = wx - worldX;
          const lz = wz - worldZ;
          if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) continue;
          const y = worldGen.getTerrainHeight(wx, wz);
          if (y <= SEA_LEVEL) continue;
          this.clearAbove(chunk, lx, y + 1, lz, 2);
          if ((wx - farm.x) === 3) {
            chunk.setBlock(lx, y, lz, 9); // irrigation
          } else {
            chunk.setBlock(lx, y, lz, 60); // farmland
            chunk.setBlock(lx, y + 1, lz, 59); // wheat
          }
        }
      }
    }
  }

  private static placeHouse(worldGen: WorldGen, chunk: Chunk, worldX: number, worldZ: number, house: HousePlan) {
    const baseY = worldGen.getTerrainHeight(house.x + Math.floor(house.w / 2), house.z + Math.floor(house.d / 2));
    if (baseY <= SEA_LEVEL || baseY > WORLD_HEIGHT - 8) return;

    for (let wx = house.x - 1; wx <= house.x + house.w; wx++) {
      for (let wz = house.z - 1; wz <= house.z + house.d; wz++) {
        const lx = wx - worldX;
        const lz = wz - worldZ;
        if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) continue;

        for (let y = baseY - 2; y <= baseY; y++) {
          if (y >= 1) chunk.setBlock(lx, y, lz, 4); // cobblestone foundation
        }
        this.clearAbove(chunk, lx, baseY + 1, lz, 7);

        const inHouse = wx >= house.x && wx < house.x + house.w && wz >= house.z && wz < house.z + house.d;
        if (!inHouse) continue;

        const localX = wx - house.x;
        const localZ = wz - house.z;
        const edge = localX === 0 || localZ === 0 || localX === house.w - 1 || localZ === house.d - 1;
        const door = localZ === house.d - 1 && localX === Math.floor(house.w / 2);

        chunk.setBlock(lx, baseY + 1, lz, 5); // plank floor

        if (edge && !door) {
          for (let y = baseY + 2; y <= baseY + 4; y++) {
            const isWindow = y === baseY + 3 && ((localX === 0 || localX === house.w - 1) && localZ >= 2 && localZ <= house.d - 3);
            chunk.setBlock(lx, y, lz, isWindow ? 20 : 5);
          }
        } else {
          for (let y = baseY + 2; y <= baseY + 4; y++) chunk.setBlock(lx, y, lz, 0);
        }

        if (door) {
          chunk.setBlock(lx, baseY + 2, lz, 64);
          chunk.setBlockMeta(lx, baseY + 2, lz, { facing: 'south', doorHalf: 'lower', hinge: 'left', open: false }, true);
          chunk.setBlock(lx, baseY + 3, lz, 64);
          chunk.setBlockMeta(lx, baseY + 3, lz, { facing: 'south', doorHalf: 'upper', hinge: 'left', open: false }, true);
        }

        const roofOverhang = wx >= house.x - 1 && wx <= house.x + house.w && wz >= house.z - 1 && wz <= house.z + house.d;
        if (roofOverhang) {
          chunk.setBlock(lx, baseY + 5, lz, 53); // oak stairs as a simple roof tile
        }

        if (localX === 1 && localZ === 1) {
          const workstation = house.profession === 'farmer' ? 61 : house.profession === 'librarian' ? 47 : house.profession === 'toolsmith' ? 58 : 117;
          chunk.setBlock(lx, baseY + 2, lz, workstation);
          if (workstation === 61) {
            chunk.setBlockMeta(lx, baseY + 2, lz, { containerType: 'furnace', inventory: [null, null, null] }, true);
          } else if (workstation === 117) {
            chunk.setBlockMeta(lx, baseY + 2, lz, { containerType: 'brewing_stand', inventory: [null, null, null, null, null] }, true);
          }
        }

        if (localX === house.w - 2 && localZ === 1) {
          chunk.setBlock(lx, baseY + 2, lz, 50);
        }
      }
    }
  }

  private static clearAbove(chunk: Chunk, x: number, y: number, z: number, height: number) {
    for (let dy = 0; dy < height; dy++) {
      const yy = y + dy;
      if (yy > 0 && yy < WORLD_HEIGHT) {
        chunk.setBlock(x, yy, z, 0);
      }
    }
  }

  private static hash01(seed: number, x: number, y: number, z: number): number {
    let h = (x * 374761393 + y * 668265263 + z * 1274126177 + seed) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = h ^ (h >>> 16);
    return (h >>> 0) / 0xffffffff;
  }
}
