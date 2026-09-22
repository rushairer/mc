import * as THREE from 'three';
import type { ActivePotionEffect, PotionEffectData } from '../systems/PotionEffect';
import type { EnchantmentId } from '../systems/EnchantSystem';

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
  stateSchema?: BlockStateSchema;
  collisionShapes?: BlockCollisionShape[];
  tags?: string[];
  lootTable?: string;
  /** XP range awarded when a player mines this block (data pack overridable). */
  xpDrop?: { min: number; max: number };
  behaviorId?: string;
}

export type BlockFacing = 'north' | 'south' | 'east' | 'west' | 'up' | 'down';

export type BlockStateValue = string | number | boolean;
export type BlockStateProperties = Record<string, BlockStateValue>;

export interface BlockStatePropertySchema {
  values: readonly BlockStateValue[];
  defaultValue: BlockStateValue;
}

export interface BlockStateSchema {
  properties: Record<string, BlockStatePropertySchema>;
}

export interface BlockState {
  baseId: number;
  packedId: number;
  legacyMetadata: number;
  officialId?: string;
  name: string;
  properties: BlockStateProperties;
}

export interface BlockCollisionShape {
  min: [number, number, number];
  max: [number, number, number];
}

export interface BlockMetadata {
  blockState?: BlockStateProperties;
  facing?: BlockFacing;
  redstoneType?: 'wire' | 'torch' | 'repeater' | 'piston' | 'lever' | 'button' | 'comparator' | 'observer' | 'daylight_detector' | 'pressure_plate' | 'tripwire_hook' | 'tripwire';
  /** P3.6 — repeater output delay in ticks (1-4). */
  delayTicks?: number;
  /** P3.6 — note block pitch (0-24 semitones) and power-edge flag. */
  notePitch?: number;
  notePowered?: boolean;
  containerType?: 'chest' | 'barrel' | 'hopper' | 'furnace' | 'smoker' | 'blast_furnace' | 'brewing_stand' | 'decorated_pot';
  inventory?: (ItemStack | null)[];
  spawnerMobType?: 'zombie' | 'skeleton' | 'spider';
  transferCooldown?: number; // for hoppers
  doorHalf?: 'lower' | 'upper';
  hinge?: 'left' | 'right';
  open?: boolean;
  powered?: boolean;
  signal?: number;
  extended?: boolean;
  slabHalf?: 'top' | 'bottom' | 'double';
  stairFacing?: BlockFacing;
  fenceConnections?: boolean[]; // [north, south, east, west]
  fluidLevel?: number; // 1-8: surface height = fluidLevel / 8 (8 = full block)
  /** Legacy alias for front-side text. */
  signText?: string[];
  signTextFront?: string[];
  signTextBack?: string[];
  signColorFront?: string;
  signColorBack?: string;
  signGlowingFront?: boolean;
  signGlowingBack?: boolean;
  signWaxed?: boolean;
  /** Java 26.3 signs default this data-component capability to false. */
  signAllowOpFeatures?: boolean;
  rotation?: number;
  burnTime?: number;
  cookTime?: number;
  maxBurnTime?: number;
  sticky?: boolean;
  bedPart?: 'head' | 'foot';
  /** Java 26.3 Shelf Mushroom visual/growth state. */
  shelfMushroomSize?: 'small' | 'large';
  cakeBites?: number;
  cauldronFluid?: 'water' | 'lava';
  cauldronLevel?: number;
  compostLevel?: number;
  campfireItems?: (ItemStack | null)[];
  campfireCookTimes?: number[];
  campfireCookDueTicks?: number[];
  /** Item currently stored by a Jukebox. */
  jukeboxDisc?: ItemStack;
  /** Canonical jukebox song id, e.g. "cat" or "bounce". */
  jukeboxSong?: string;
  /** Comparator output encoded by the inserted jukebox song (0-15). */
  jukeboxComparatorOutput?: number;
  /** Archaeology: transient brushing stage 0-4. */
  archaeologyProgress?: number;
  /** Archaeology loot exists only on naturally generated suspicious blocks. */
  archaeologyLootItemId?: number;
  archaeologyLootCount?: number;
  archaeologyNatural?: boolean;
  /** Java 26.3 decorated-pot sherd faces; entries preserve full stack components. */
  potDecorations?: {
    back?: ItemStack;
    left?: ItemStack;
    right?: ItemStack;
    front?: ItemStack;
  };
  /** Short visual wobble after inserting an item. */
  decoratedPotWobbleUntil?: number;
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
  chargedProjectileId?: number;
  customName?: string;
  /** Bundle dynamic-container contents. */
  bundleContents?: ItemStack[];
  /** Java 26.3 minecraft:pot_decorations uses four optional full ItemStack faces. */
  potDecorations?: {
    back?: ItemStack;
    left?: ItemStack;
    right?: ItemStack;
    front?: ItemStack;
  };
  /** Java goat-horn instrument data component; absent stacks use ponder. */
  goatHornInstrument?: 'ponder' | 'sing' | 'seek' | 'feel' | 'admire' | 'call' | 'yearn' | 'dream';
  enchantments?: { id: EnchantmentId; level: number }[];
  potion?: {
    kind: PotionKind;
    name: string;
    effect?: PotionEffectData;
    /** P3.4 — normal | splash | lingering. */
    variant?: 'normal' | 'splash' | 'lingering';
  };
  map?: {
    id: number;
    centerX: number;
    centerZ: number;
    scale: number;
    dimension: number;
    pixels: string[];
    playerMarker: { x: number; z: number; rotation?: number };
    locked?: boolean;
    explorerItemName?: string;
    targetMarker?: { x: number; z: number; structure: string };
  };
  book?: {
    title?: string;
    author?: string;
    pages: string[];
    signed?: boolean;
  };
  /** P3.5 — loom-applied banner patterns. */
  patterns?: Array<{ pattern: string; color: string }>;
  /** Food-delivered status components, notably Suspicious Stew. */
  foodEffects?: PotionEffectData[];
  /** Foods such as Suspicious Stew can be consumed at full hunger. */
  alwaysEdible?: boolean;
  /** Container returned after consumption (e.g. bowl from stew). */
  containerItemId?: number;
}

export type PotionKind = 'bottle' | 'water' | 'awkward' | 'healing' | 'regeneration' | 'speed' | 'fire_resistance' | 'poison' | 'strength' | 'hunger' | 'slowness' | 'water_breathing' | 'jump_boost' | 'absorption';

export type { ActivePotionEffect, PotionEffectData };

export interface WorldSaveData {
  chunks: { cx: number; cz: number; data: Uint16Array }[];
  player: PlayerState;
  inventory: (ItemStack | null)[];
  seed: number;
}

export type BlockFace = 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right';
