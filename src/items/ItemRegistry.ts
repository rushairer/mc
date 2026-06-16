import { BlockRegistry } from '../world/BlockRegistry';

export interface ItemDef {
  id: number;
  name: string;
  displayName: string;
  maxStackSize: number;
  category: 'block' | 'tool' | 'food' | 'material' | 'armor';
  toolType?: 'pickaxe' | 'axe' | 'shovel' | 'sword';
  toolMaterial?: 'wood' | 'stone' | 'iron' | 'gold' | 'diamond';
  durability?: number;
  damage?: number;
  miningSpeed?: number;
  hungerRestore?: number;
  saturationRestore?: number;
  armorSlot?: 'helmet' | 'chestplate' | 'leggings' | 'boots';
  armorDefense?: number;
}

// ─── Tool Material Stats ───
const TOOL_STATS = {
  wood:    { durability: 59,   miningSpeed: 2, damage: 1 },
  stone:   { durability: 131,  miningSpeed: 4, damage: 2 },
  iron:    { durability: 250,  miningSpeed: 6, damage: 3 },
  gold:    { durability: 32,   miningSpeed: 12, damage: 1 },
  diamond: { durability: 1561, miningSpeed: 8, damage: 4 },
} as const;

// ─── Armor Material Stats ───
const ARMOR_STATS = {
  iron:    { helmet: 2, chestplate: 6, leggings: 5, boots: 2 },
  diamond: { helmet: 3, chestplate: 8, leggings: 6, boots: 3 },
} as const;

const items: Map<number, ItemDef> = new Map();

function reg(def: ItemDef) {
  items.set(def.id, def);
}

// ─── Block items (ID 1-99 match block IDs) ───
// These are implicit — BlockRegistry already has them.
// We just register the item versions.

// ─── Materials (100-149) ───
reg({ id: 100, name: 'stick',       displayName: 'Stick',       maxStackSize: 64, category: 'material' });
reg({ id: 101, name: 'coal',        displayName: 'Coal',        maxStackSize: 64, category: 'material' });
reg({ id: 102, name: 'iron_ingot',  displayName: 'Iron Ingot',  maxStackSize: 64, category: 'material' });
reg({ id: 103, name: 'gold_ingot',  displayName: 'Gold Ingot',  maxStackSize: 64, category: 'material' });
reg({ id: 104, name: 'diamond',     displayName: 'Diamond',     maxStackSize: 64, category: 'material' });
reg({ id: 105, name: 'iron_nugget', displayName: 'Iron Nugget', maxStackSize: 64, category: 'material' });
reg({ id: 106, name: 'gold_nugget', displayName: 'Gold Nugget', maxStackSize: 64, category: 'material' });
reg({ id: 107, name: 'string',      displayName: 'String',      maxStackSize: 64, category: 'material' });
reg({ id: 108, name: 'flint',       displayName: 'Flint',       maxStackSize: 64, category: 'material' });
reg({ id: 109, name: 'paper',       displayName: 'Paper',       maxStackSize: 64, category: 'material' });
reg({ id: 110, name: 'book',        displayName: 'Book',        maxStackSize: 64, category: 'material' });
reg({ id: 111, name: 'redstone',    displayName: 'Redstone',    maxStackSize: 64, category: 'material' });
reg({ id: 112, name: 'lapis',       displayName: 'Lapis Lazuli', maxStackSize: 64, category: 'material' });

// ─── Wooden Tools (120-124) ───
const W = TOOL_STATS.wood;
reg({ id: 120, name: 'wooden_sword',   displayName: 'Wooden Sword',   maxStackSize: 1, category: 'tool', toolType: 'sword',   toolMaterial: 'wood', durability: W.durability, damage: W.damage + 3, miningSpeed: W.miningSpeed });
reg({ id: 121, name: 'wooden_shovel',  displayName: 'Wooden Shovel',  maxStackSize: 1, category: 'tool', toolType: 'shovel',  toolMaterial: 'wood', durability: W.durability, damage: W.damage, miningSpeed: W.miningSpeed });
reg({ id: 122, name: 'wooden_pickaxe', displayName: 'Wooden Pickaxe', maxStackSize: 1, category: 'tool', toolType: 'pickaxe', toolMaterial: 'wood', durability: W.durability, damage: W.damage, miningSpeed: W.miningSpeed });
reg({ id: 123, name: 'wooden_axe',    displayName: 'Wooden Axe',     maxStackSize: 1, category: 'tool', toolType: 'axe',     toolMaterial: 'wood', durability: W.durability, damage: W.damage + 2, miningSpeed: W.miningSpeed });

// ─── Stone Tools (130-134) ───
const S = TOOL_STATS.stone;
reg({ id: 130, name: 'stone_sword',   displayName: 'Stone Sword',   maxStackSize: 1, category: 'tool', toolType: 'sword',   toolMaterial: 'stone', durability: S.durability, damage: S.damage + 3, miningSpeed: S.miningSpeed });
reg({ id: 131, name: 'stone_shovel',  displayName: 'Stone Shovel',  maxStackSize: 1, category: 'tool', toolType: 'shovel',  toolMaterial: 'stone', durability: S.durability, damage: S.damage, miningSpeed: S.miningSpeed });
reg({ id: 132, name: 'stone_pickaxe', displayName: 'Stone Pickaxe', maxStackSize: 1, category: 'tool', toolType: 'pickaxe', toolMaterial: 'stone', durability: S.durability, damage: S.damage, miningSpeed: S.miningSpeed });
reg({ id: 133, name: 'stone_axe',    displayName: 'Stone Axe',     maxStackSize: 1, category: 'tool', toolType: 'axe',     toolMaterial: 'stone', durability: S.durability, damage: S.damage + 2, miningSpeed: S.miningSpeed });

// ─── Iron Tools (140-144) ───
const I = TOOL_STATS.iron;
reg({ id: 140, name: 'iron_sword',   displayName: 'Iron Sword',   maxStackSize: 1, category: 'tool', toolType: 'sword',   toolMaterial: 'iron', durability: I.durability, damage: I.damage + 3, miningSpeed: I.miningSpeed });
reg({ id: 141, name: 'iron_shovel',  displayName: 'Iron Shovel',  maxStackSize: 1, category: 'tool', toolType: 'shovel',  toolMaterial: 'iron', durability: I.durability, damage: I.damage, miningSpeed: I.miningSpeed });
reg({ id: 142, name: 'iron_pickaxe', displayName: 'Iron Pickaxe', maxStackSize: 1, category: 'tool', toolType: 'pickaxe', toolMaterial: 'iron', durability: I.durability, damage: I.damage, miningSpeed: I.miningSpeed });
reg({ id: 143, name: 'iron_axe',    displayName: 'Iron Axe',     maxStackSize: 1, category: 'tool', toolType: 'axe',     toolMaterial: 'iron', durability: I.durability, damage: I.damage + 2, miningSpeed: I.miningSpeed });

// ─── Diamond Tools (150-154) ───
const D = TOOL_STATS.diamond;
reg({ id: 150, name: 'diamond_sword',   displayName: 'Diamond Sword',   maxStackSize: 1, category: 'tool', toolType: 'sword',   toolMaterial: 'diamond', durability: D.durability, damage: D.damage + 3, miningSpeed: D.miningSpeed });
reg({ id: 151, name: 'diamond_shovel',  displayName: 'Diamond Shovel',  maxStackSize: 1, category: 'tool', toolType: 'shovel',  toolMaterial: 'diamond', durability: D.durability, damage: D.damage, miningSpeed: D.miningSpeed });
reg({ id: 152, name: 'diamond_pickaxe', displayName: 'Diamond Pickaxe', maxStackSize: 1, category: 'tool', toolType: 'pickaxe', toolMaterial: 'diamond', durability: D.durability, damage: D.damage, miningSpeed: D.miningSpeed });
reg({ id: 153, name: 'diamond_axe',    displayName: 'Diamond Axe',     maxStackSize: 1, category: 'tool', toolType: 'axe',     toolMaterial: 'diamond', durability: D.durability, damage: D.damage + 2, miningSpeed: D.miningSpeed });

// ─── Golden Tools (160-164) ───
const G = TOOL_STATS.gold;
reg({ id: 160, name: 'golden_sword',   displayName: 'Golden Sword',   maxStackSize: 1, category: 'tool', toolType: 'sword',   toolMaterial: 'gold', durability: G.durability, damage: G.damage + 3, miningSpeed: G.miningSpeed });
reg({ id: 161, name: 'golden_shovel',  displayName: 'Golden Shovel',  maxStackSize: 1, category: 'tool', toolType: 'shovel',  toolMaterial: 'gold', durability: G.durability, damage: G.damage, miningSpeed: G.miningSpeed });
reg({ id: 162, name: 'golden_pickaxe', displayName: 'Golden Pickaxe', maxStackSize: 1, category: 'tool', toolType: 'pickaxe', toolMaterial: 'gold', durability: G.durability, damage: G.damage, miningSpeed: G.miningSpeed });
reg({ id: 163, name: 'golden_axe',    displayName: 'Golden Axe',     maxStackSize: 1, category: 'tool', toolType: 'axe',     toolMaterial: 'gold', durability: G.durability, damage: G.damage + 2, miningSpeed: G.miningSpeed });

// ─── Food (170-179) ───
reg({ id: 170, name: 'apple',       displayName: 'Apple',       maxStackSize: 64, category: 'food', hungerRestore: 4, saturationRestore: 2.4 });
reg({ id: 171, name: 'bread',       displayName: 'Bread',       maxStackSize: 64, category: 'food', hungerRestore: 5, saturationRestore: 6.0 });
reg({ id: 172, name: 'cooked_beef', displayName: 'Steak',       maxStackSize: 64, category: 'food', hungerRestore: 8, saturationRestore: 12.8 });
reg({ id: 173, name: 'raw_beef',    displayName: 'Raw Beef',    maxStackSize: 64, category: 'food', hungerRestore: 3, saturationRestore: 1.8 });
reg({ id: 174, name: 'raw_porkchop',displayName: 'Raw Porkchop',maxStackSize: 64, category: 'food', hungerRestore: 3, saturationRestore: 1.8 });
reg({ id: 175, name: 'cooked_porkchop', displayName: 'Cooked Porkchop', maxStackSize: 64, category: 'food', hungerRestore: 8, saturationRestore: 12.8 });
reg({ id: 176, name: 'wheat',       displayName: 'Wheat',       maxStackSize: 64, category: 'material' });
reg({ id: 177, name: 'seeds',       displayName: 'Seeds',       maxStackSize: 64, category: 'material' });
reg({ id: 178, name: 'bucket',      displayName: 'Bucket',      maxStackSize: 16, category: 'material' });

// ─── Armor (180-195) ───
reg({ id: 180, name: 'iron_helmet',      displayName: 'Iron Helmet',      maxStackSize: 1, category: 'armor', armorSlot: 'helmet',      armorDefense: ARMOR_STATS.iron.helmet,      durability: 165 });
reg({ id: 181, name: 'iron_chestplate',  displayName: 'Iron Chestplate',  maxStackSize: 1, category: 'armor', armorSlot: 'chestplate',  armorDefense: ARMOR_STATS.iron.chestplate,  durability: 240 });
reg({ id: 182, name: 'iron_leggings',    displayName: 'Iron Leggings',    maxStackSize: 1, category: 'armor', armorSlot: 'leggings',    armorDefense: ARMOR_STATS.iron.leggings,    durability: 225 });
reg({ id: 183, name: 'iron_boots',       displayName: 'Iron Boots',       maxStackSize: 1, category: 'armor', armorSlot: 'boots',       armorDefense: ARMOR_STATS.iron.boots,       durability: 195 });
reg({ id: 184, name: 'diamond_helmet',   displayName: 'Diamond Helmet',   maxStackSize: 1, category: 'armor', armorSlot: 'helmet',      armorDefense: ARMOR_STATS.diamond.helmet,   durability: 363 });
reg({ id: 185, name: 'diamond_chestplate',displayName:'Diamond Chestplate',maxStackSize: 1, category: 'armor', armorSlot: 'chestplate',  armorDefense: ARMOR_STATS.diamond.chestplate, durability: 528 });
reg({ id: 186, name: 'diamond_leggings', displayName: 'Diamond Leggings', maxStackSize: 1, category: 'armor', armorSlot: 'leggings',    armorDefense: ARMOR_STATS.diamond.leggings, durability: 495 });
reg({ id: 187, name: 'diamond_boots',    displayName: 'Diamond Boots',    maxStackSize: 1, category: 'armor', armorSlot: 'boots',       armorDefense: ARMOR_STATS.diamond.boots,    durability: 429 });

export const ItemRegistry = {
  get(id: number): ItemDef | undefined {
    if (id >= 1 && id <= 99) {
      // Block-as-item
      const block = BlockRegistry.get(id);
      if (!block) return undefined;
      return {
        id,
        name: block.name,
        displayName: block.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        maxStackSize: 64,
        category: 'block',
      };
    }
    return items.get(id);
  },

  isBlock(id: number): boolean {
    return id >= 1 && id <= 99;
  },

  isTool(id: number): boolean {
    const item = items.get(id);
    return item?.category === 'tool';
  },

  isFood(id: number): boolean {
    const item = items.get(id);
    return item?.category === 'food';
  },

  getMaxStackSize(id: number): number {
    const item = this.get(id);
    return item?.maxStackSize ?? 64;
  },

  getToolMiningSpeed(id: number, blockId: number): number {
    const item = items.get(id);
    if (!item || item.category !== 'tool') return 1;

    const block = BlockRegistry.get(blockId);
    if (!block) return 1;

    // Correct tool = 2x speed bonus (simplified from vanilla's complex multipliers)
    if (block.toolCategory && item.toolType === block.toolCategory) {
      return item.miningSpeed ?? 1;
    }
    return 1;
  },

  getBreakTime(blockId: number, heldItemId: number): number {
    const block = BlockRegistry.get(blockId);
    if (!block) return 0;

    const speed = this.getToolMiningSpeed(heldItemId, blockId);
    return block.hardness / speed;
  },

  // Map block drops to item IDs
  getBlockDropItem(blockId: number): number {
    const block = BlockRegistry.get(blockId);
    if (!block) return 0;
    if (block.dropsId) return block.dropsId;

    // Ore → raw material drops
    if (blockId === 12) return 101; // coal_ore → coal
    if (blockId === 11) return 102; // iron_ore → iron_ingot (simplified)
    if (blockId === 10) return 103; // gold_ore → gold_ingot
    if (blockId === 22) return 104; // diamond_ore → diamond
    if (blockId === 29) return 29;  // clay → clay

    return blockId; // default: drop self
  },

  getDisplayName(id: number): string {
    const item = this.get(id);
    if (!item) return 'Unknown';
    return item.displayName;
  },

  getAll(): ItemDef[] {
    return Array.from(items.values());
  },
};
