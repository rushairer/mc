import { BlockRegistry } from '../world/BlockRegistry';
import rawItems from './data/items.json';
import type { DataPackItem } from '../systems/DataPackTypes';

export interface ItemDef {
  id: number; // internal runtime ID: legacy packed ID or generated bridge ID
  officialId: string; // vanilla resource location, e.g. minecraft:honey_bottle
  baseId: number;
  metadata: number;
  name: string;
  displayName: string;
  maxStackSize: number;
  category: 'block' | 'tool' | 'food' | 'material' | 'armor';
  toolType?: 'pickaxe' | 'axe' | 'shovel' | 'sword' | 'hoe' | 'spear';
  toolMaterial?: 'wood' | 'stone' | 'iron' | 'gold' | 'diamond' | 'copper' | 'netherite';
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
  copper:  { durability: 191,  miningSpeed: 5, damage: 2 },
  gold:    { durability: 32,   miningSpeed: 12, damage: 1 },
  diamond: { durability: 1561, miningSpeed: 8, damage: 4 },
  netherite: { durability: 2031, miningSpeed: 9, damage: 5 },
} as const;

// ─── Armor Material Stats ───
const ARMOR_STATS = {
  leather: { helmet: 1, chestplate: 3, leggings: 2, boots: 1 },
  gold:    { helmet: 2, chestplate: 5, leggings: 3, boots: 1 },
  chainmail:{ helmet: 2, chestplate: 5, leggings: 4, boots: 1 },
  iron:    { helmet: 2, chestplate: 6, leggings: 5, boots: 2 },
  copper:  { helmet: 2, chestplate: 5, leggings: 4, boots: 1 },
  diamond: { helmet: 3, chestplate: 8, leggings: 6, boots: 3 },
  netherite: { helmet: 3, chestplate: 8, leggings: 6, boots: 3 },
  turtle:  { helmet: 2, chestplate: 0, leggings: 0, boots: 0 },
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
  'cod': { hunger: 2, saturation: 0.4 },
  'cooked_cod': { hunger: 5, saturation: 6.0 },
  'salmon': { hunger: 2, saturation: 0.4 },
  'cooked_salmon': { hunger: 6, saturation: 9.6 },
  'tropical_fish': { hunger: 1, saturation: 0.2 },
  'pufferfish': { hunger: 1, saturation: 0.2 },
  'cookie': { hunger: 2, saturation: 0.4 },
  'melon': { hunger: 2, saturation: 1.2 },
  'melon_slice': { hunger: 2, saturation: 1.2 },
  'carrot': { hunger: 3, saturation: 3.6 },
  'potato': { hunger: 1, saturation: 0.6 },
  'baked_potato': { hunger: 5, saturation: 6.0 },
  'beetroot': { hunger: 1, saturation: 1.2 },
  'beetroot_soup': { hunger: 6, saturation: 7.2 },
  'chorus_fruit': { hunger: 4, saturation: 2.4 },
  'dried_kelp': { hunger: 1, saturation: 0.6 },
  'glow_berries': { hunger: 2, saturation: 0.4 },
  'sweet_berries': { hunger: 2, saturation: 0.4 },
  'suspicious_stew': { hunger: 6, saturation: 7.2 },
  'pumpkin_pie': { hunger: 8, saturation: 4.8 },
  'golden_carrot': { hunger: 6, saturation: 14.4 },
  'golden_apple': { hunger: 4, saturation: 9.6 },
  'honey_bottle': { hunger: 6, saturation: 1.2 },
};

// ─── Block Drop Mappings (Packed IDs) ───
const BLOCK_DROP_OVERRIDES: Record<number, number | (() => number)> = {
  2: 3,                 // grass -> dirt
  16: 263,              // coal ore -> coal
  26: 355,              // bed block -> bed item
  56: 264,              // diamond ore -> diamond
  73: 331,              // redstone ore -> redstone dust
  21: (4 << 10) | 351,  // lapis ore -> lapis lazuli (dye metadata 4)
  13: () => Math.random() < 0.1 ? 318 : 13, // gravel -> flint (10%) or gravel
  82: 337,              // clay block -> clay ball
  118: 380,             // cauldron block -> cauldron item
};

// Vanilla has several inventory items whose item ID differs from the block ID
// placed into the world. Keep this map explicit so icons, hand meshes, and
// right-click placement can agree on one source of truth.
const ITEM_PLACE_BLOCK_OVERRIDES: Record<number, number> = {
  295: 59,  // wheat seeds -> wheat crop
  323: 63,  // sign -> standing sign
  425: 176, // banner -> standing banner
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
const itemsByOfficialId: Map<string, ItemDef> = new Map();

const getRuntimeId = (item: { id: number | string; runtimeId?: number }) => {
  if (typeof item.id === 'number') return item.id;
  if (typeof item.runtimeId === 'number') return item.runtimeId;
  throw new Error(`Item ${item.id} is missing runtimeId`);
};

const getOfficialId = (item: { id: number | string; name: string; officialId?: string }) =>
  typeof item.id === 'string' ? item.id : (item.officialId ?? `minecraft:${item.name}`);

// ─── Initialize Registry from JSON ───
for (const item of rawItems) {
  const baseId = getRuntimeId(item);
  const officialId = getOfficialId(item);
  const isBlock = baseId < 256;

  const registerItem = (id: number, meta: number, name: string, displayName: string, itemOfficialId: string) => {
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
    if (name.endsWith('_pickaxe') || name.endsWith('_shovel') || name.endsWith('_axe') || name.endsWith('_sword') || name.endsWith('_hoe') || name.endsWith('_spear')) {
      category = 'tool';
      if (name.endsWith('_pickaxe')) toolType = 'pickaxe';
      else if (name.endsWith('_shovel')) toolType = 'shovel';
      else if (name.endsWith('_axe')) toolType = 'axe';
      else if (name.endsWith('_sword')) toolType = 'sword';
      else if (name.endsWith('_hoe')) toolType = 'hoe';
      else if (name.endsWith('_spear')) toolType = 'spear';

      // Material
      if (name.startsWith('wooden_') || name.startsWith('wood_')) toolMaterial = 'wood';
      else if (name.startsWith('stone_')) toolMaterial = 'stone';
      else if (name.startsWith('iron_')) toolMaterial = 'iron';
      else if (name.startsWith('copper_')) toolMaterial = 'copper';
      else if (name.startsWith('golden_') || name.startsWith('gold_')) toolMaterial = 'gold';
      else if (name.startsWith('diamond_')) toolMaterial = 'diamond';
      else if (name.startsWith('netherite_')) toolMaterial = 'netherite';

      if (toolMaterial) {
        const stats = TOOL_STATS[toolMaterial];
        durability = stats.durability;
        miningSpeed = stats.miningSpeed;
        damage = toolType === 'sword' || toolType === 'spear' ? stats.damage + 3 : (toolType === 'axe' ? stats.damage + 2 : stats.damage);
      }
    } else if (name === 'bow' || name === 'crossbow' || name === 'trident' || name === 'mace' || name === 'brush' || name === 'fishing_rod') {
      category = 'tool';
      toolType = 'sword'; // generic usable-tool bucket for durability and basic interaction checks
      durability = item.maxDurability ?? (name === 'fishing_rod' ? 64 : 384);
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
      else if (name.startsWith('copper_')) materialKey = 'copper';
      else if (name.startsWith('diamond_')) materialKey = 'diamond';
      else if (name.startsWith('netherite_')) materialKey = 'netherite';
      else if (name.startsWith('turtle_')) materialKey = 'turtle';

      if (materialKey && armorSlot) {
        armorDefense = ARMOR_STATS[materialKey][armorSlot];
        // Approximate durability
        const baseDurabilities = { helmet: 55, chestplate: 80, leggings: 75, boots: 65 };
        const multipliers = { leather: 3, gold: 7, chainmail: 12, iron: 15, copper: 10, diamond: 33, netherite: 37, turtle: 11 };
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

    const itemDef = {
      id,
      officialId: itemOfficialId,
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
    };
    items.set(id, itemDef);
    itemsByOfficialId.set(itemOfficialId, itemDef);
  };

  // Register variations
  if (item.variations && item.variations.length > 0) {
    for (const v of item.variations) {
      const packedId = (v.metadata << 10) | baseId;
      const vName = v.displayName.toLowerCase().replace(/ /g, '_');
      registerItem(packedId, v.metadata, vName, v.displayName, `${officialId}#${v.metadata}`);
    }
  } else {
    registerItem(baseId, 0, item.name, item.displayName, officialId);
  }
}

export const ItemRegistry = {
  registerDataPackItems(dataItems: DataPackItem[]) {
    for (const item of dataItems) {
      const itemDef: ItemDef = {
        id: item.id,
        officialId: item.officialId ?? `minecraft:${item.name}`,
        baseId: item.baseId ?? (item.id & 0x3FF),
        metadata: item.metadata ?? (item.id >> 10),
        name: item.name,
        displayName: item.displayName ?? item.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        maxStackSize: item.maxStackSize ?? 64,
        category: item.category ?? 'material',
        toolType: item.toolType,
        toolMaterial: item.toolMaterial,
        durability: item.durability,
        damage: item.damage,
        miningSpeed: item.miningSpeed,
        hungerRestore: item.hungerRestore,
        saturationRestore: item.saturationRestore,
        armorSlot: item.armorSlot,
        armorDefense: item.armorDefense,
        placeBlockId: item.placeBlockId,
      };
      items.set(itemDef.id, itemDef);
      itemsByOfficialId.set(itemDef.officialId, itemDef);
    }
  },

  get(id: number): ItemDef | undefined {
    // Check direct item registration
    const it = items.get(id);
    if (it) return it;

    // Fallback: block-as-item. Modern vanilla blocks use runtime IDs above the
    // legacy 0-255 range, so ask BlockRegistry directly before old base-ID math.
    const directBlock = BlockRegistry.get(id);
    if (directBlock && directBlock.id === id && id !== 0) {
      return {
        id,
        officialId: directBlock.officialId ?? `minecraft:${directBlock.name}`,
        baseId: directBlock.baseId ?? directBlock.id,
        metadata: directBlock.metadata ?? 0,
        name: directBlock.name,
        displayName: directBlock.displayName ?? directBlock.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        maxStackSize: 64,
        category: 'block',
        placeBlockId: id,
      };
    }

    // Fallback: legacy packed block-as-item
    const baseId = id & 0x3FF;
    if (baseId < 256) {
      const block = BlockRegistry.get(id);
      if (!block) return undefined;
      return {
        id,
        officialId: `minecraft:${block.name}`,
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

    const directBlock = BlockRegistry.get(id);
    if (directBlock && directBlock.id === id && id !== 0) return id;

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
    const normalized = name.startsWith('minecraft:') ? name : `minecraft:${name}`;
    const byOfficialId = itemsByOfficialId.get(normalized);
    if (byOfficialId) return byOfficialId;

    for (const item of items.values()) {
      if (item.name === name || item.officialId === name || item.officialId === normalized) return item;
    }
    return undefined;
  },
};
