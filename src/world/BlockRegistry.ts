import type { BlockDef } from '../types';

const blocks: Map<number, BlockDef> = new Map();

function reg(def: BlockDef) {
  blocks.set(def.id, def);
}

// Block ID 0 = air (never registered, implicit)

reg({ id: 1, name: 'stone',          textureKey: 'stone',        transparent: false, solid: true,  hardness: 1.5, toolCategory: 'pickaxe', luminance: 0 });
reg({ id: 2, name: 'grass_block',    textureKey: 'dirt',         textureTop: 'grass_top', textureBottom: 'dirt', transparent: false, solid: true,  hardness: 0.6, toolCategory: 'shovel', dropsId: 3, luminance: 0 });
reg({ id: 3, name: 'dirt',           textureKey: 'dirt',         transparent: false, solid: true,  hardness: 0.5, toolCategory: 'shovel', luminance: 0 });
reg({ id: 4, name: 'cobblestone',    textureKey: 'cobblestone',  transparent: false, solid: true,  hardness: 2.0, toolCategory: 'pickaxe', luminance: 0 });
reg({ id: 5, name: 'oak_planks',     textureKey: 'oak_planks',   transparent: false, solid: true,  hardness: 2.0, toolCategory: 'axe', luminance: 0 });
reg({ id: 6, name: 'oak_log',        textureKey: 'oak_log_side', textureTop: 'oak_log_top', textureBottom: 'oak_log_top', transparent: false, solid: true,  hardness: 2.0, toolCategory: 'axe', luminance: 0 });
reg({ id: 7, name: 'oak_leaves',     textureKey: 'oak_leaves',   transparent: false, solid: true,  hardness: 0.2, toolCategory: 'axe', luminance: 0 });
reg({ id: 8, name: 'sand',           textureKey: 'sand',         transparent: false, solid: true,  hardness: 0.5, toolCategory: 'shovel', luminance: 0 });
reg({ id: 9, name: 'gravel',         textureKey: 'gravel',       transparent: false, solid: true,  hardness: 0.6, toolCategory: 'shovel', luminance: 0 });
reg({ id: 10, name: 'gold_ore',      textureKey: 'gold_ore',     transparent: false, solid: true,  hardness: 3.0, toolCategory: 'pickaxe', luminance: 0 });
reg({ id: 11, name: 'iron_ore',      textureKey: 'iron_ore',     transparent: false, solid: true,  hardness: 3.0, toolCategory: 'pickaxe', luminance: 0 });
reg({ id: 12, name: 'coal_ore',      textureKey: 'coal_ore',     transparent: false, solid: true,  hardness: 3.0, toolCategory: 'pickaxe', luminance: 0 });
reg({ id: 13, name: 'water',         textureKey: 'water',        transparent: true,  solid: false, hardness: 100, luminance: 0 });
reg({ id: 14, name: 'lava',          textureKey: 'lava',         transparent: true,  solid: false, hardness: 100, luminance: 15 });
reg({ id: 15, name: 'sandstone',     textureKey: 'sandstone',    transparent: false, solid: true,  hardness: 0.8, toolCategory: 'pickaxe', luminance: 0 });
reg({ id: 16, name: 'white_wool',    textureKey: 'white_wool',   transparent: false, solid: true,  hardness: 0.8, luminance: 0 });
reg({ id: 17, name: 'gold_block',    textureKey: 'gold_block',   transparent: false, solid: true,  hardness: 3.0, toolCategory: 'pickaxe', luminance: 0 });
reg({ id: 18, name: 'iron_block',    textureKey: 'iron_block',   transparent: false, solid: true,  hardness: 5.0, toolCategory: 'pickaxe', luminance: 0 });
reg({ id: 19, name: 'bricks',        textureKey: 'bricks',       transparent: false, solid: true,  hardness: 2.0, toolCategory: 'pickaxe', luminance: 0 });
reg({ id: 20, name: 'bookshelf',     textureKey: 'oak_planks',   textureTop: 'oak_planks', textureBottom: 'oak_planks', transparent: false, solid: true,  hardness: 1.5, toolCategory: 'axe', luminance: 0 });
reg({ id: 21, name: 'tnt',           textureKey: 'tnt_side',     textureTop: 'tnt_top', textureBottom: 'tnt_bottom', transparent: false, solid: true,  hardness: 0.0, luminance: 0 });
reg({ id: 22, name: 'diamond_ore',   textureKey: 'diamond_ore',  transparent: false, solid: true,  hardness: 3.0, toolCategory: 'pickaxe', luminance: 0 });
reg({ id: 23, name: 'diamond_block', textureKey: 'diamond_block',transparent: false, solid: true,  hardness: 5.0, toolCategory: 'pickaxe', luminance: 0 });
reg({ id: 24, name: 'crafting_table',textureKey: 'crafting_side',textureTop: 'crafting_top', textureBottom: 'oak_planks', transparent: false, solid: true,  hardness: 2.5, toolCategory: 'axe', luminance: 0 });
reg({ id: 25, name: 'furnace',       textureKey: 'furnace_side', textureTop: 'furnace_top', textureBottom: 'furnace_top', transparent: false, solid: true,  hardness: 3.5, toolCategory: 'pickaxe', luminance: 0 });
reg({ id: 26, name: 'glass',         textureKey: 'glass',        transparent: true,  solid: true,  hardness: 0.3, luminance: 0 });
reg({ id: 27, name: 'snow_block',    textureKey: 'snow',         transparent: false, solid: true,  hardness: 0.2, toolCategory: 'shovel', luminance: 0 });
reg({ id: 28, name: 'ice',           textureKey: 'ice',          transparent: true,  solid: true,  hardness: 0.5, toolCategory: 'pickaxe', luminance: 0 });
reg({ id: 29, name: 'clay',          textureKey: 'clay',         transparent: false, solid: true,  hardness: 0.6, toolCategory: 'shovel', luminance: 0 });
reg({ id: 30, name: 'torch',         textureKey: 'torch',        transparent: true,  solid: false, hardness: 0.0, luminance: 14 });
reg({ id: 31, name: 'redstone_wire',  textureKey: 'redstone_wire', transparent: true,  solid: false, hardness: 0.0, luminance: 0 });
reg({ id: 32, name: 'repeater',       textureKey: 'repeater',     transparent: false, solid: true,  hardness: 0.2, luminance: 0 });
reg({ id: 33, name: 'piston',         textureKey: 'cobblestone',  textureTop: 'oak_planks', textureBottom: 'oak_planks', transparent: false, solid: true,  hardness: 1.5, toolCategory: 'axe', luminance: 0 });
reg({ id: 34, name: 'lever',          textureKey: 'lever',        transparent: true,  solid: false, hardness: 0.0, luminance: 0 });
reg({ id: 35, name: 'obsidian',       textureKey: 'obsidian',     transparent: false, solid: true,  hardness: 50.0, toolCategory: 'pickaxe', luminance: 0 });
reg({ id: 36, name: 'chest',          textureKey: 'chest_side',   textureTop: 'chest_top', textureBottom: 'chest_top', transparent: false, solid: true,  hardness: 2.5, toolCategory: 'axe', luminance: 0 });
reg({ id: 37, name: 'oak_door',       textureKey: 'oak_door_closed', transparent: true, solid: true, hardness: 3.0, toolCategory: 'axe', luminance: 0 });
reg({ id: 38, name: 'oak_door_open',  textureKey: 'oak_door_open', transparent: true, solid: true, hardness: 3.0, toolCategory: 'axe', dropsId: 37, luminance: 0 });

export const BlockRegistry = {
  get(id: number): BlockDef | undefined {
    return blocks.get(id);
  },

  isTransparent(id: number): boolean {
    if (id === 0) return true;
    const b = blocks.get(id);
    return b ? b.transparent : false;
  },

  isSolid(id: number): boolean {
    if (id === 0) return false;
    const b = blocks.get(id);
    return b ? b.solid : false;
  },

  getTextureForFace(id: number, face: number): string {
    const b = blocks.get(id);
    if (!b) return 'stone';
    if (face === 0 && b.textureTop) return b.textureTop;
    if (face === 1 && b.textureBottom) return b.textureBottom;
    return b.textureKey;
  },

  all(): BlockDef[] {
    return Array.from(blocks.values());
  },

  getByName(name: string): BlockDef | undefined {
    for (const b of blocks.values()) {
      if (b.name === name) return b;
    }
    return undefined;
  },
};
