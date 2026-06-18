import * as THREE from 'three';

export interface BlockDef {
  id: number;
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
  redstoneType?: 'wire' | 'torch' | 'repeater' | 'piston' | 'lever' | 'button';
  containerType?: 'chest';
  inventory?: (ItemStack | null)[];
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
}

export interface WorldSaveData {
  chunks: { cx: number; cz: number; data: Uint16Array }[];
  player: PlayerState;
  inventory: (ItemStack | null)[];
  seed: number;
}

export type BlockFace = 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right';
