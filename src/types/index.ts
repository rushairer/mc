import * as THREE from 'three';
import type { ActivePotionEffect, PotionEffectData } from '../systems/PotionEffect';

export interface BlockDef {
  id: number;
  officialId?: string;
  name: string;
  textureKey: string;           // single texture for all faces
  textureTop?: string;          // override for top face
  textureBottom?: string;       // override for bottom face
  transparent: boolean;
  solid: boolean;
  hardness: number;             // seconds to break by hand
  toolCategory?: 'pickaxe' | 'axe' | 'shovel' | 'sword';
  dropsId?: number;             // block ID to drop (default: self)
  luminance: number;            // 0-15 light emission
  baseId?: number;
  metadata?: number;
  displayName?: string;
}

export type BlockFacing = 'north' | 'south' | 'east' | 'west' | 'up' | 'down';

export interface BlockMetadata {
  facing?: BlockFacing;
  redstoneType?: 'wire' | 'torch' | 'repeater' | 'piston' | 'lever' | 'button' | 'comparator' | 'observer' | 'daylight_detector' | 'pressure_plate' | 'tripwire_hook' | 'tripwire';
  containerType?: 'chest' | 'barrel' | 'hopper' | 'furnace' | 'smoker' | 'blast_furnace' | 'brewing_stand';
  inventory?: (ItemStack | null)[];
  spawnerMobType?: 'zombie' | 'skeleton' | 'spider';
  transferCooldown?: number; // for hoppers
  doorHalf?: 'lower' | 'upper';
  hinge?: 'left' | 'right';
  open?: boolean;
  powered?: boolean;
  signal?: number;
  extended?: boolean;
  slabHalf?: 'top' | 'bottom';
  stairFacing?: BlockFacing;
  fenceConnections?: boolean[]; // [north, south, east, west]
  fluidLevel?: number; // 1-8: surface height = fluidLevel / 8 (8 = full block)
  signText?: string[];
  rotation?: number;
  burnTime?: number;
  cookTime?: number;
  maxBurnTime?: number;
  sticky?: boolean;
  bedPart?: 'head' | 'foot';
  cakeBites?: number;
  cauldronFluid?: 'water' | 'lava';
  cauldronLevel?: number;
  compostLevel?: number;
  campfireItems?: (ItemStack | null)[];
  campfireCookTimes?: number[];
}

export interface SerializedBlockMetadata {
  index: number;
  metadata: BlockMetadata;
}

export interface ChunkCoord {
  x: number;
  z: number;
}

export interface ChunkMeshData {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
  colors: number[];
  blockTypes?: number[];
}

export interface PlayerState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  yaw: number;
  pitch: number;
  health: number;
  hunger: number;
  selectedSlot: number;
  onGround: boolean;
  flying: boolean;
}

export interface ItemStack {
  id: number;
  count: number;
  durability?: number;
  customName?: string;
  enchantments?: { id: 'sharpness' | 'efficiency' | 'protection' | 'unbreaking'; level: number }[];
  potion?: {
    kind: PotionKind;
    name: string;
    effect?: PotionEffectData;
  };
  map?: {
    id: number;
    centerX: number;
    centerZ: number;
    scale: number;
    dimension: number;
    pixels: string[];
    playerMarker: { x: number; z: number };
  };
  book?: {
    title?: string;
    author?: string;
    pages: string[];
    signed?: boolean;
  };
}

export type PotionKind = 'bottle' | 'water' | 'awkward' | 'healing' | 'regeneration' | 'speed' | 'fire_resistance' | 'poison';

export type { ActivePotionEffect, PotionEffectData };

export interface WorldSaveData {
  chunks: { cx: number; cz: number; data: Uint16Array }[];
  player: PlayerState;
  inventory: (ItemStack | null)[];
  seed: number;
}

export type BlockFace = 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right';
