import { BlockRegistry } from '../world/BlockRegistry';
import rawItems from './data/items.json';

export interface ItemDef {
  id: number; // packed ID: (metadata << 10) | baseId
  baseId: number;
  metadata: number;
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
  placeBlockId?: number;
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
  leather: { helmet: 1, chestplate: 3, leggings: 2, boots: 1 },
  gold:    { helmet: 2, chestplate: 5, leggings: 3, boots: 1 },
  chainmail:{ helmet: 2, chestplate: 5, leggings: 4, boots: 1 },
  iron:    { helmet: 2, chestplate: 6, leggings: 5, boots: 2 },
  diamond: { helmet: 3, chestplate: 8, leggings: 6, boots: 3 },
} as const;

// ─── Food Restore Info ───
const FOOD_STATS: Record<string, { hunger: number; saturation: number }> = {
  'apple': { hunger: 4, saturation: 2.4 },
  'bread': { hunger: 5, saturation: 6.0 },
  'cooked_beef': { hunger: 8, saturation: 12.8 },
  'steak': { hunger: 8, saturation: 12.8 },
  'raw_beef': { hunger: 3, saturation: 1.8 },
  'cooked_porkchop': { hunger: 8, saturation: 12.8 },
  'raw_porkchop': { hunger: 3, saturation: 1.8 },
  'cooked_chicken': { hunger: 6, saturation: 7.2 },
  'raw_chicken': { hunger: 2, saturation: 1.2 },
  'cooked_mutton': { hunger: 6, saturation: 9.6 },
  'raw_mutton': { hunger: 2, saturation: 1.2 },
  'cooked_fish': { hunger: 5, saturation: 6.0 },
  'raw_fish': { hunger: 2, saturation: 0.4 },
  'cookie': { hunger: 2, saturation: 0.4 },
  'melon': { hunger: 2, saturation: 1.2 },
  'carrot': { hunger: 3, saturation: 3.6 },
  'potato': { hunger: 1, saturation: 0.6 },
  'baked_potato': { hunger: 5, saturation: 6.0 },
  'pumpkin_pie': { hunger: 8, saturation: 4.8 },
  'golden_apple': { hunger: 4, saturation: 9.6 },
};

// ─── Block Drop Mappings (Packed IDs) ───
const BLOCK_DROP_OVERRIDES: Record<number, number | (() => number)> = {
  2: 3,                 // grass -> dirt
  16: 263,              // coal ore -> coal
  56: 264,              // diamond ore -> diamond
  73: 331,              // redstone ore -> redstone dust
  21: (4 << 10) | 351,  // lapis ore -> lapis lazuli (dye metadata 4)
  13: () => Math.random() < 0.1 ? 318 : 13, // gravel -> flint (10%) or gravel
  82: 337,              // clay block -> clay ball
};

// Vanilla has several inventory items whose item ID differs from the block ID
// placed into the world. Keep this map explicit so icons, hand meshes, and
// right-click placement can agree on one source of truth.
const ITEM_PLACE_BLOCK_OVERRIDES: Record<number, number> = {
  295: 59,  // wheat seeds -> wheat crop
  323: 63,  // sign -> standing sign
  324: 64,  // oak door
  330: 71,  // iron door
  331: 55,  // redstone dust -> redstone wire
  338: 83,  // sugar cane
  354: 92,  // cake
  355: 26,  // bed
  356: 93,  // repeater -> unpowered repeater
  361: 104, // pumpkin seeds -> pumpkin stem
  362: 105, // melon seeds -> melon stem
  372: 115, // nether wart
  379: 117, // brewing stand
  380: 118, // cauldron
  390: 140, // flower pot
  391: 141, // carrot crop
  392: 142, // potato crop
  397: 144, // skull
  1421: (1 << 10) | 144, // wither skeleton skull
  2445: (2 << 10) | 144, // zombie head
  3469: (3 << 10) | 144, // player head
  4493: (4 << 10) | 144, // creeper head
  404: 149, // comparator -> unpowered comparator
  427: 193, // spruce door
  428: 194, // birch door
  429: 195, // jungle door
  430: 196, // acacia door
  431: 197, // dark oak door
  435: 207, // beetroot seeds
};

const items: Map<number, ItemDef> = new Map();

// ─── Initialize Registry from JSON ───
for (const item of rawItems) {
  const baseId = item.id;
  const isBlock = baseId < 256;

  const registerItem = (id: number, meta: number, name: string, displayName: string) => {
    // Determine category
    let category: ItemDef['category'] = isBlock ? 'block' : 'material';
    let toolType: ItemDef['toolType'] = undefined;
    let toolMaterial: ItemDef['toolMaterial'] = undefined;
    let durability: number | undefined = undefined;
    let damage: number | undefined = undefined;
    let miningSpeed: number | undefined = undefined;
    let hungerRestore: number | undefined = undefined;
    let saturationRestore: number | undefined = undefined;
    let armorSlot: ItemDef['armorSlot'] = undefined;
    let armorDefense: number | undefined = undefined;

    // Check if Tool
    if (name.endsWith('_pickaxe') || name.endsWith('_shovel') || name.endsWith('_axe') || name.endsWith('_sword')) {
      category = 'tool';
      if (name.endsWith('_pickaxe')) toolType = 'pickaxe';
      else if (name.endsWith('_shovel')) toolType = 'shovel';
      else if (name.endsWith('_axe')) toolType = 'axe';
      else if (name.endsWith('_sword')) toolType = 'sword';

      // Material
      if (name.startsWith('wooden_') || name.startsWith('wood_')) toolMaterial = 'wood';
      else if (name.startsWith('stone_')) toolMaterial = 'stone';
      else if (name.startsWith('iron_')) toolMaterial = 'iron';
      else if (name.startsWith('golden_') || name.startsWith('gold_')) toolMaterial = 'gold';
      else if (name.startsWith('diamond_')) toolMaterial = 'diamond';

      if (toolMaterial) {
        const stats = TOOL_STATS[toolMaterial];
        durability = stats.durability;
        miningSpeed = stats.miningSpeed;
        damage = toolType === 'sword' ? stats.damage + 3 : (toolType === 'axe' ? stats.damage + 2 : stats.damage);
      }
    } else if (name === 'bow') {
      category = 'tool';
      toolType = 'sword'; // classified under sword for swing/damage checks in player
      durability = 384;
      damage = 1;
    } else if (name.endsWith('_helmet') || name.endsWith('_chestplate') || name.endsWith('_leggings') || name.endsWith('_boots')) {
      category = 'armor';
      if (name.endsWith('_helmet')) armorSlot = 'helmet';
      else if (name.endsWith('_chestplate')) armorSlot = 'chestplate';
      else if (name.endsWith('_leggings')) armorSlot = 'leggings';
      else if (name.endsWith('_boots')) armorSlot = 'boots';

      // Material
      let materialKey: keyof typeof ARMOR_STATS | undefined = undefined;
      if (name.startsWith('leather_')) materialKey = 'leather';
      else if (name.startsWith('golden_') || name.startsWith('gold_')) materialKey = 'gold';
      else if (name.startsWith('chainmail_')) materialKey = 'chainmail';
      else if (name.startsWith('iron_')) materialKey = 'iron';
      else if (name.startsWith('diamond_')) materialKey = 'diamond';

      if (materialKey && armorSlot) {
        armorDefense = ARMOR_STATS[materialKey][armorSlot];
        // Approximate durability
        const baseDurabilities = { helmet: 55, chestplate: 80, leggings: 75, boots: 65 };
        const multipliers = { leather: 3, gold: 7, chainmail: 12, iron: 15, diamond: 33 };
        durability = baseDurabilities[armorSlot] * multipliers[materialKey] / 5;
      }
    } else {
      // Check Food
      for (const [foodName, stats] of Object.entries(FOOD_STATS)) {
        if (name === foodName || name.endsWith(foodName)) {
          category = 'food';
          hungerRestore = stats.hunger;
          saturationRestore = stats.saturation;
          break;
        }
      }
    }

    items.set(id, {
      id,
      baseId,
      metadata: meta,
      name,
      displayName,
      maxStackSize: item.stackSize ?? 64,
      category,
      toolType,
      toolMaterial,
      durability,
      damage,
      miningSpeed,
      hungerRestore,
      saturationRestore,
      armorSlot,
      armorDefense,
      placeBlockId: ITEM_PLACE_BLOCK_OVERRIDES[id] ?? (isBlock ? id : undefined),
    });
  };

  // Register variations
  if (item.variations && item.variations.length > 0) {
    for (const v of item.variations) {
      const packedId = (v.metadata << 10) | baseId;
      const vName = v.displayName.toLowerCase().replace(/ /g, '_');
      registerItem(packedId, v.metadata, vName, v.displayName);
    }
  } else {
    registerItem(baseId, 0, item.name, item.displayName);
  }
}

export const ItemRegistry = {
  get(id: number): ItemDef | undefined {
    // Check direct item registration
    const it = items.get(id);
    if (it) return it;

    // Fallback: block-as-item
    const baseId = id & 0x3FF;
    if (baseId < 256) {
      const block = BlockRegistry.get(id);
      if (!block) return undefined;
      return {
        id,
        baseId: block.baseId ?? (block.id & 0x3FF),
        metadata: block.metadata ?? (block.id >> 10),
        name: block.name,
        displayName: block.displayName ?? block.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        maxStackSize: 64,
        category: 'block',
      };
    }
    return undefined;
  },

  isBlock(id: number): boolean {
    return this.getPlaceBlockId(id) !== undefined;
  },

  getPlaceBlockId(id: number): number | undefined {
    const item = this.get(id);
    if (item?.placeBlockId !== undefined) return item.placeBlockId;

    const baseId = id & 0x3FF;
    if (baseId >= 1 && baseId < 256) return id;
    return undefined;
  },

  isTool(id: number): boolean {
    const item = this.get(id);
    return item?.category === 'tool';
  },

  isFood(id: number): boolean {
    const item = this.get(id);
    return item?.category === 'food';
  },

  getMaxStackSize(id: number): number {
    const item = this.get(id);
    return item?.maxStackSize ?? 64;
  },

  getToolMiningSpeed(id: number, blockId: number): number {
    const item = this.get(id);
    if (!item || item.category !== 'tool') return 1;

    const block = BlockRegistry.get(blockId);
    if (!block) return 1;

    // Matching tool speed bonus
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

  getBlockDropItem(blockId: number): number {
    // Check drop overrides
    const override = BLOCK_DROP_OVERRIDES[blockId];
    if (override !== undefined) {
      return typeof override === 'function' ? override() : override;
    }

    // Default: block drops its own ID
    return blockId;
  },

  getDisplayName(id: number): string {
    const item = this.get(id);
    if (!item) return 'Unknown';
    return item.displayName;
  },

  all(): ItemDef[] {
    return Array.from(items.values());
  },

  getByName(name: string): ItemDef | undefined {
    // Exact or normalized name match
    for (const item of items.values()) {
      if (item.name === name || item.name === `minecraft:${name}`) return item;
    }
    return undefined;
  },
};
