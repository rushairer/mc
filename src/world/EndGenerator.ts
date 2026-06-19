import { CHUNK_SIZE, WORLD_HEIGHT } from '../constants';
import type { ItemStack } from '../types';
import { Chunk } from './Chunk';

const END_STONE = 121;
const CHEST = 54;
const END_ROD = 198;
const CHORUS_PLANT = 199;
const CHORUS_FLOWER = 200;
const PURPUR_BLOCK = 201;
const PURPUR_PILLAR = 202;
const PURPUR_STAIRS = 203;
const PURPUR_SLAB = 205;
const END_BRICKS = 206;

const GRID_SIZE = 192;
const CITY_FOOTPRINT = 46;
const CITY_BASE_Y = 72;

export interface EndCityAnchor {
  id: string;
  x: number;
  z: number;
}

export interface EndCitySpawnPoint {
  id: string;
  x: number;
  y: number;
  z: number;
}

export class EndGenerator {
  constructor(private seed: number) {}

  decorateChunk(chunk: Chunk) {
    this.generateChorusTrees(chunk);
    this.generateEndCities(chunk);
    chunk.dirty = true;
  }

  getNearbyShulkerSpawns(x: number, z: number, radius: number): EndCitySpawnPoint[] {
    const anchors = this.getAnchorsNear(x - radius, z - radius, x + radius, z + radius);
    return anchors.flatMap((anchor) => this.getShulkerSpawns(anchor));
  }

  private generateChorusTrees(chunk: Chunk) {
    const worldX = chunk.cx * CHUNK_SIZE;
    const worldZ = chunk.cz * CHUNK_SIZE;

    for (let x = 1; x < CHUNK_SIZE - 1; x++) {
      for (let z = 1; z < CHUNK_SIZE - 1; z++) {
        const wx = worldX + x;
        const wz = worldZ + z;
        if (Math.hypot(wx, wz) < 170) continue;
        if (this.hash(wx, wz, 8101) > 0.018) continue;

        const surfaceY = this.findEndStoneSurface(chunk, x, z);
        if (surfaceY < 56 || surfaceY > 92) continue;
        this.placeChorusTree(chunk, wx, surfaceY + 1, wz);
      }
    }
  }

  private generateEndCities(chunk: Chunk) {
    const minX = chunk.cx * CHUNK_SIZE;
    const minZ = chunk.cz * CHUNK_SIZE;
    const maxX = minX + CHUNK_SIZE - 1;
    const maxZ = minZ + CHUNK_SIZE - 1;
    const anchors = this.getAnchorsNear(
      minX - CITY_FOOTPRINT,
      minZ - CITY_FOOTPRINT,
      maxX + CITY_FOOTPRINT,
      maxZ + CITY_FOOTPRINT
    );

    for (const anchor of anchors) {
      this.placeEndCity(chunk, anchor);
    }
  }

  private getAnchorsNear(minX: number, minZ: number, maxX: number, maxZ: number): EndCityAnchor[] {
    const minGX = Math.floor(minX / GRID_SIZE) - 1;
    const maxGX = Math.floor(maxX / GRID_SIZE) + 1;
    const minGZ = Math.floor(minZ / GRID_SIZE) - 1;
    const maxGZ = Math.floor(maxZ / GRID_SIZE) + 1;
    const anchors: EndCityAnchor[] = [];

    for (let gx = minGX; gx <= maxGX; gx++) {
      for (let gz = minGZ; gz <= maxGZ; gz++) {
        const anchor = this.getCityAnchor(gx, gz);
        if (!anchor) continue;
        if (anchor.x + CITY_FOOTPRINT < minX || anchor.x - CITY_FOOTPRINT > maxX) continue;
        if (anchor.z + CITY_FOOTPRINT < minZ || anchor.z - CITY_FOOTPRINT > maxZ) continue;
        anchors.push(anchor);
      }
    }

    return anchors;
  }

  private getCityAnchor(gx: number, gz: number): EndCityAnchor | null {
    const roll = this.hash(gx, gz, 4109);
    if (roll > 0.42) return null;

    const offsetX = Math.floor((this.hash(gx, gz, 4110) - 0.5) * 70);
    const offsetZ = Math.floor((this.hash(gx, gz, 4111) - 0.5) * 70);
    const x = gx * GRID_SIZE + Math.floor(GRID_SIZE / 2) + offsetX;
    const z = gz * GRID_SIZE + Math.floor(GRID_SIZE / 2) + offsetZ;
    if (Math.hypot(x, z) < 230) return null;

    return { id: `${gx},${gz}`, x, z };
  }

  private getShulkerSpawns(anchor: EndCityAnchor): EndCitySpawnPoint[] {
    return [
      { id: `${anchor.id}:gate`, x: anchor.x - 4, y: CITY_BASE_Y + 3, z: anchor.z - 6 },
      { id: `${anchor.id}:tower-low`, x: anchor.x + 4, y: CITY_BASE_Y + 9, z: anchor.z + 4 },
      { id: `${anchor.id}:tower-high`, x: anchor.x - 3, y: CITY_BASE_Y + 18, z: anchor.z + 3 },
      { id: `${anchor.id}:ship-room`, x: anchor.x + 24, y: CITY_BASE_Y + 8, z: anchor.z + 1 },
    ];
  }

  private placeEndCity(chunk: Chunk, anchor: EndCityAnchor) {
    const ax = anchor.x;
    const az = anchor.z;
    const y = CITY_BASE_Y;

    this.fillBox(chunk, ax - 8, y, az - 8, ax + 8, y, az + 8, END_BRICKS);
    this.fillBox(chunk, ax - 6, y + 1, az - 6, ax + 6, y + 1, az + 6, PURPUR_BLOCK);
    this.hollowBox(chunk, ax - 6, y + 2, az - 6, ax + 6, y + 7, az + 6, PURPUR_BLOCK, 0);
    this.fillBox(chunk, ax - 4, y + 8, az - 4, ax + 4, y + 8, az + 4, PURPUR_SLAB);
    this.placePillarsToGround(chunk, ax - 7, az - 7, ax + 7, az + 7, y - 1);

    this.hollowBox(chunk, ax - 4, y + 8, az - 4, ax + 4, y + 22, az + 4, PURPUR_PILLAR, 0);
    this.fillBox(chunk, ax - 5, y + 23, az - 5, ax + 5, y + 24, az + 5, PURPUR_BLOCK);
    this.fillBox(chunk, ax - 3, y + 25, az - 3, ax + 3, y + 25, az + 3, PURPUR_SLAB);

    this.fillBox(chunk, ax + 7, y + 7, az - 2, ax + 22, y + 8, az + 2, PURPUR_BLOCK);
    this.fillBox(chunk, ax + 10, y + 9, az - 1, ax + 20, y + 9, az + 1, PURPUR_SLAB);
    this.hollowBox(chunk, ax + 21, y + 5, az - 5, ax + 33, y + 11, az + 5, PURPUR_BLOCK, 0);
    this.fillBox(chunk, ax + 22, y + 4, az - 6, ax + 34, y + 4, az + 6, END_BRICKS);

    this.placeBlock(chunk, ax - 5, y + 4, az, END_ROD);
    this.placeBlock(chunk, ax + 5, y + 4, az, END_ROD);
    this.placeBlock(chunk, ax, y + 11, az - 5, END_ROD);
    this.placeBlock(chunk, ax, y + 18, az + 5, END_ROD);
    this.placeLootChest(chunk, ax + 28, y + 5, az);
  }

  private placeChorusTree(chunk: Chunk, wx: number, y: number, wz: number) {
    const height = 4 + Math.floor(this.hash(wx, wz, 8301) * 5);
    for (let i = 0; i < height; i++) {
      this.placeBlock(chunk, wx, y + i, wz, CHORUS_PLANT);
    }

    const topY = y + height;
    this.placeBlock(chunk, wx, topY, wz, CHORUS_FLOWER);
    const branchCount = 2 + Math.floor(this.hash(wx, wz, 8302) * 3);
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];

    for (let i = 0; i < branchCount; i++) {
      const dir = dirs[(Math.floor(this.hash(wx, wz, 8400 + i) * dirs.length) + i) % dirs.length];
      const branchY = y + 2 + Math.floor(this.hash(wx, wz, 8500 + i) * Math.max(1, height - 2));
      const len = 1 + Math.floor(this.hash(wx, wz, 8600 + i) * 3);
      for (let step = 1; step <= len; step++) {
        this.placeBlock(chunk, wx + dir[0] * step, branchY, wz + dir[1] * step, CHORUS_PLANT);
      }
      this.placeBlock(chunk, wx + dir[0] * len, branchY + 1, wz + dir[1] * len, CHORUS_FLOWER);
    }
  }

  private placeLootChest(chunk: Chunk, wx: number, y: number, wz: number) {
    if (!this.placeBlock(chunk, wx, y, wz, CHEST)) return;

    const local = this.toLocal(chunk, wx, y, wz);
    if (!local) return;

    const inventory: (ItemStack | null)[] = new Array(27).fill(null);
    inventory[2] = { id: 368, count: 2 + Math.floor(this.hash(wx, wz, 8701) * 3) };
    inventory[10] = { id: 432, count: 4 + Math.floor(this.hash(wx, wz, 8702) * 5) };
    inventory[14] = { id: this.hash(wx, wz, 8703) > 0.55 ? 264 : 265, count: 1 + Math.floor(this.hash(wx, wz, 8704) * 3) };
    inventory[22] = { id: this.hash(wx, wz, 8705) > 0.5 ? 388 : 266, count: 1 + Math.floor(this.hash(wx, wz, 8706) * 2) };
    chunk.setBlockMeta(local.x, y, local.z, { containerType: 'chest', inventory });
  }

  private hollowBox(
    chunk: Chunk,
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number,
    wallId: number,
    insideId: number
  ) {
    for (let x = x1; x <= x2; x++) {
      for (let y = y1; y <= y2; y++) {
        for (let z = z1; z <= z2; z++) {
          const edge = x === x1 || x === x2 || y === y1 || y === y2 || z === z1 || z === z2;
          this.placeBlock(chunk, x, y, z, edge ? wallId : insideId);
        }
      }
    }
  }

  private fillBox(chunk: Chunk, x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, blockId: number) {
    for (let x = x1; x <= x2; x++) {
      for (let y = y1; y <= y2; y++) {
        for (let z = z1; z <= z2; z++) {
          this.placeBlock(chunk, x, y, z, blockId);
        }
      }
    }
  }

  private placePillarsToGround(chunk: Chunk, x1: number, z1: number, x2: number, z2: number, topY: number) {
    const corners = [
      [x1, z1],
      [x1, z2],
      [x2, z1],
      [x2, z2],
    ];

    for (const [wx, wz] of corners) {
      for (let y = topY; y >= 54; y--) {
        this.placeBlock(chunk, wx, y, wz, PURPUR_PILLAR);
      }
    }
  }

  private findEndStoneSurface(chunk: Chunk, x: number, z: number): number {
    for (let y = WORLD_HEIGHT - 3; y >= 1; y--) {
      const block = chunk.getBlock(x, y, z) & 0x3FF;
      if (block === END_STONE && chunk.getBlock(x, y + 1, z) === 0 && chunk.getBlock(x, y + 2, z) === 0) {
        return y;
      }
    }
    return -1;
  }

  private placeBlock(chunk: Chunk, wx: number, y: number, wz: number, blockId: number): boolean {
    if (y < 0 || y >= WORLD_HEIGHT) return false;
    const local = this.toLocal(chunk, wx, y, wz);
    if (!local) return false;
    chunk.setBlock(local.x, y, local.z, blockId);
    return true;
  }

  private toLocal(chunk: Chunk, wx: number, y: number, wz: number): { x: number; z: number } | null {
    if (y < 0 || y >= WORLD_HEIGHT) return null;
    const minX = chunk.cx * CHUNK_SIZE;
    const minZ = chunk.cz * CHUNK_SIZE;
    const x = wx - minX;
    const z = wz - minZ;
    if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) return null;
    return { x, z };
  }

  private hash(a: number, b: number, salt: number): number {
    const n = Math.sin(a * 127.1 + b * 311.7 + this.seed * 17.13 + salt * 19.19) * 43758.5453123;
    return n - Math.floor(n);
  }
}
