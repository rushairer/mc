import type { BlockDef } from '../types';
import rawBlocks from '../items/data/blocks.json';

const blocks: Map<number, BlockDef> = new Map();
const blocksByOfficialId: Map<string, BlockDef> = new Map();

// ─── Texture Custom Overrides for Multi-face Blocks ───
const TEXTURE_OVERRIDES: Record<string, { textureKey: string; textureTop?: string; textureBottom?: string }> = {
  'grass': { textureKey: 'dirt', textureTop: 'grass_top', textureBottom: 'dirt' },
  'mycelium': { textureKey: 'mycelium_side', textureTop: 'mycelium_top', textureBottom: 'dirt' },
  'log': { textureKey: 'oak_log_side', textureTop: 'oak_log_top', textureBottom: 'oak_log_top' },
  'log2': { textureKey: 'acacia_log_side', textureTop: 'acacia_log_top', textureBottom: 'acacia_log_top' },
  'oak_wood': { textureKey: 'oak_log_side', textureTop: 'oak_log_top', textureBottom: 'oak_log_top' },
  'spruce_wood': { textureKey: 'spruce_log_side', textureTop: 'spruce_log_top', textureBottom: 'spruce_log_top' },
  'birch_wood': { textureKey: 'birch_log_side', textureTop: 'birch_log_top', textureBottom: 'birch_log_top' },
  'jungle_wood': { textureKey: 'jungle_log_side', textureTop: 'jungle_log_top', textureBottom: 'jungle_log_top' },
  'crafting_table': { textureKey: 'crafting_side', textureTop: 'crafting_top', textureBottom: 'oak_planks' },
  'furnace': { textureKey: 'furnace_side', textureTop: 'furnace_top', textureBottom: 'furnace_top' },
  'lit_furnace': { textureKey: 'furnace_front_lit', textureTop: 'furnace_top', textureBottom: 'furnace_top' },
  'tnt': { textureKey: 'tnt_side', textureTop: 'tnt_top', textureBottom: 'tnt_bottom' },
  'chest': { textureKey: 'chest_side', textureTop: 'chest_top', textureBottom: 'chest_top' },
  'hopper': { textureKey: 'hopper_side', textureTop: 'hopper_top', textureBottom: 'hopper_side' },
};

const normalizeName = (name: string) => name.toLowerCase().replace(/ /g, '_');
const getRuntimeId = (block: { id: number | string; runtimeId?: number }) => {
  if (typeof block.id === 'number') return block.id;
  if (typeof block.runtimeId === 'number') return block.runtimeId;
  throw new Error(`Block ${block.id} is missing runtimeId`);
};
const getOfficialId = (block: { id: number | string; name: string; officialId?: string }) =>
  typeof block.id === 'string' ? block.id : (block.officialId ?? `minecraft:${block.name}`);

const registerBlock = (block: BlockDef) => {
  blocks.set(block.id, block);
  if (block.officialId) blocksByOfficialId.set(block.officialId, block);
};

// ─── Initialize Registry from JSON ───
for (const b of rawBlocks) {
  const runtimeId = getRuntimeId(b);
  const officialId = getOfficialId(b);

  // Determine if transparent, solid, etc.
  const isTransparent = b.transparent || b.boundingBox === 'empty' || b.name === 'torch' || b.name === 'redstone_wire' || b.name.includes('sapling') || b.name.includes('flower') || b.name.includes('glass');
  const isSolid = b.boundingBox === 'block' && b.name !== 'water' && b.name !== 'lava' && b.name !== 'flowing_water' && b.name !== 'flowing_lava';
  const emitLight = b.emitLight ?? 0;

  // Determine tool category based on material or name
  let toolCategory: 'pickaxe' | 'axe' | 'shovel' | 'sword' | undefined = undefined;
  if (b.material === 'rock' || b.name.includes('ore') || b.name.includes('stone') || b.name.includes('brick') || b.name.includes('cobblestone') || b.name.includes('obsidian') || b.id === 61 || b.id === 62) {
    toolCategory = 'pickaxe';
  } else if (b.material === 'wood' || b.name.includes('planks') || b.name.includes('log') || b.name.includes('door') || b.name.includes('trapdoor') || b.name.includes('fence')) {
    toolCategory = 'axe';
  } else if (b.material === 'dirt' || b.name === 'grass' || b.name === 'dirt' || b.name === 'sand' || b.name === 'gravel' || b.name === 'clay') {
    toolCategory = 'shovel';
  }

  // Helper to get texture properties
  const getTextureProperties = (name: string) => {
    const normalized = normalizeName(name);
    let key = normalized;

    // Logs (special multi-face blocks)
    if (normalized.includes('spruce') && normalized.includes('log')) {
      return { textureKey: 'spruce_log_side', textureTop: 'spruce_log_top', textureBottom: 'spruce_log_top' };
    }
    if (normalized.includes('birch') && normalized.includes('log')) {
      return { textureKey: 'birch_log_side', textureTop: 'birch_log_top', textureBottom: 'birch_log_top' };
    }
    if (normalized.includes('acacia') && normalized.includes('log')) {
      return { textureKey: 'acacia_log_side', textureTop: 'acacia_log_top', textureBottom: 'acacia_log_top' };
    }
    if (normalized.includes('jungle') && normalized.includes('log')) {
      return { textureKey: 'jungle_log_side', textureTop: 'jungle_log_top', textureBottom: 'jungle_log_top' };
    }

    // Planks
    if (normalized.includes('spruce') && normalized.includes('planks')) key = 'spruce_planks';
    else if (normalized.includes('birch') && normalized.includes('planks')) key = 'birch_planks';
    else if (normalized.includes('acacia') && normalized.includes('planks')) key = 'acacia_planks';
    else if (normalized.includes('jungle') && normalized.includes('planks')) key = 'jungle_planks';
    else if (normalized.includes('planks')) key = 'oak_planks';

    // Leaves
    if (normalized.includes('spruce') && normalized.includes('leaves')) key = 'spruce_leaves';
    else if (normalized.includes('birch') && normalized.includes('leaves')) key = 'birch_leaves';
    else if (normalized.includes('acacia') && normalized.includes('leaves')) key = 'acacia_leaves';
    else if (normalized.includes('jungle') && normalized.includes('leaves')) key = 'jungle_leaves';
    else if (normalized.includes('leaves')) key = 'oak_leaves';
    
    // Check specific texture overrides
    for (const [ovrKey, ovrVal] of Object.entries(TEXTURE_OVERRIDES)) {
      if (normalized === ovrKey || normalized.includes(ovrKey)) {
        return ovrVal;
      }
    }

    return { textureKey: key };
  };

  // Register variations if present
  if (b.variations && b.variations.length > 0) {
    // Also register base block under its base ID (without metadata)
    const tex = getTextureProperties(b.name);
    registerBlock({
      id: runtimeId,
      officialId,
      name: b.name,
      textureKey: tex.textureKey,
      textureTop: tex.textureTop,
      textureBottom: tex.textureBottom,
      transparent: isTransparent,
      solid: isSolid,
      hardness: b.hardness ?? 1.0,
      toolCategory,
      luminance: emitLight,
      baseId: runtimeId,
      metadata: 0,
      displayName: b.displayName,
    });

    for (const v of b.variations) {
      const packedId = (v.metadata << 10) | runtimeId;
      const vName = normalizeName(v.displayName);
      const tex = getTextureProperties(vName);
      registerBlock({
        id: packedId,
        officialId: `${officialId}#${v.metadata}`,
        name: vName,
        textureKey: tex.textureKey,
        textureTop: tex.textureTop,
        textureBottom: tex.textureBottom,
        transparent: isTransparent,
        solid: isSolid,
        hardness: b.hardness ?? 1.0,
        toolCategory,
        luminance: emitLight,
        baseId: runtimeId,
        metadata: v.metadata,
        displayName: v.displayName,
      });
    }
  } else {
    // Standard register
    const tex = getTextureProperties(b.name);
    registerBlock({
      id: runtimeId,
      officialId,
      name: b.name,
      textureKey: tex.textureKey,
      textureTop: tex.textureTop,
      textureBottom: tex.textureBottom,
      transparent: isTransparent,
      solid: isSolid,
      hardness: b.hardness ?? 1.0,
      toolCategory,
      luminance: emitLight,
      baseId: runtimeId,
      metadata: 0,
      displayName: b.displayName,
    });
  }
}

// Ensure Air is registered at ID 0 if not present
if (!blocks.has(0)) {
  blocks.set(0, {
    id: 0,
    officialId: 'minecraft:air',
    name: 'air',
    textureKey: 'stone',
    transparent: true,
    solid: false,
    hardness: 0,
    luminance: 0,
  });
}

export const BlockRegistry = {
  get(id: number): BlockDef | undefined {
    return blocks.get(id) ?? blocks.get(id & 0x3FF);
  },

  isTransparent(id: number): boolean {
    if (id === 0) return true;
    const b = this.get(id);
    return b ? b.transparent : false;
  },

  isSolid(id: number): boolean {
    if (id === 0) return false;
    const b = this.get(id);
    return b ? b.solid : false;
  },

  getTextureForFace(id: number, face: number): string {
    const b = this.get(id);
    if (!b) return 'stone';
    if (face === 0 && b.textureTop) return b.textureTop;
    if (face === 1 && b.textureBottom) return b.textureBottom;
    return b.textureKey;
  },

  all(): BlockDef[] {
    return Array.from(blocks.values());
  },

  getByName(name: string): BlockDef | undefined {
    // Exact or normalized name match
    const normalized = name.startsWith('minecraft:') ? name : `minecraft:${name}`;
    const byOfficialId = blocksByOfficialId.get(normalized);
    if (byOfficialId) return byOfficialId;

    for (const b of blocks.values()) {
      if (b.name === name || b.officialId === name || b.officialId === normalized) return b;
    }
    return undefined;
  },

  getLuminance(id: number): number {
    if (id === 0) return 0;
    const b = this.get(id);
    return b ? b.luminance : 0;
  },

  isFluid(id: number): boolean {
    const baseId = id & 0x3FF;
    return baseId === 8 || baseId === 9 || baseId === 10 || baseId === 11; // flowing water, still water, flowing lava, still lava
  },

  isWater(id: number): boolean {
    const baseId = id & 0x3FF;
    return baseId === 8 || baseId === 9;
  },

  isLava(id: number): boolean {
    const baseId = id & 0x3FF;
    return baseId === 10 || baseId === 11;
  },

  isTorch(id: number): boolean {
    const baseId = id & 0x3FF;
    return baseId === 50 || baseId === 75 || baseId === 76; // torch, unlit redstone torch, lit redstone torch
  },

  isDoor(id: number): boolean {
    const baseId = id & 0x3FF;
    // wooden door, iron door, oak/spruce/birch trapdoors, etc.
    return baseId === 64 || baseId === 71 || baseId === 96 || baseId === 167 || baseId === 193 || baseId === 194 || baseId === 195 || baseId === 196 || baseId === 197;
  }
};
