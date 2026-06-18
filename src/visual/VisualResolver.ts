import { BlockRegistry } from '../world/BlockRegistry';
import { ItemRegistry } from '../items/ItemRegistry';
import type { BlockDef, BlockFacing } from '../types';

function getOppositeFacing(facing: BlockFacing): BlockFacing {
  switch (facing) {
    case 'up': return 'down';
    case 'down': return 'up';
    case 'north': return 'south';
    case 'south': return 'north';
    case 'east': return 'west';
    case 'west': return 'east';
  }
}


export type VisualFace = 'top' | 'bottom' | 'right' | 'left' | 'front' | 'back';
export type ItemVisualKind = 'block' | 'tool' | 'sprite';

const FACE_NAMES: VisualFace[] = ['top', 'bottom', 'right', 'left', 'front', 'back'];

const WOOD_MATERIALS = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak'] as const;
type WoodMaterial = typeof WOOD_MATERIALS[number];

function baseId(id: number): number {
  return id & 0x3FF;
}

function metadata(id: number): number {
  return id >> 10;
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/^minecraft:/, '').replace(/\s+/g, '_');
}

function woodMaterialFromName(name: string): WoodMaterial | null {
  const normalized = normalizeName(name);
  if (normalized.includes('dark_oak')) return 'dark_oak';
  for (const material of WOOD_MATERIALS) {
    if (normalized.includes(material)) return material;
  }
  return null;
}

function woodMaterialFromLog(id: number, block?: BlockDef): WoodMaterial {
  const b = baseId(id);
  const meta = metadata(id);
  if (b === 162) return (meta & 0x3) === 1 ? 'dark_oak' : 'acacia';

  const named = block ? woodMaterialFromName(block.name) : null;
  if (named) return named;

  const material = meta & 0x3;
  return material === 1 ? 'spruce' : material === 2 ? 'birch' : material === 3 ? 'jungle' : 'oak';
}

function materialPrefix(material: WoodMaterial): string {
  return material === 'oak' ? 'oak' : material;
}

function shade(hex: string, factor: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * factor)));
  const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * factor)));
  const b = Math.max(0, Math.min(255, Math.round((n & 255) * factor)));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const r = Math.min(220, Math.max(50, (hash & 0xFF0000) >> 16));
  const g = Math.min(220, Math.max(50, (hash & 0x00FF00) >> 8));
  const b = Math.min(220, Math.max(50, hash & 0x0000FF));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export const VisualResolver = {
  faceName(face: number): VisualFace {
    return FACE_NAMES[face] ?? 'front';
  },

  getBlockFaceTexture(blockId: number, face: number): string {
    const block = BlockRegistry.get(blockId);
    if (!block) return 'block:stone';

    const name = block.name;
    const base = baseId(blockId);
    const faceName = this.faceName(face);

    if (base === 2 || name === 'grass') {
      if (faceName === 'top') return 'block:grass_top';
      if (faceName === 'bottom') return 'block:dirt';
      return 'block:grass_side';
    }

    if (base === 8 || base === 9 || name.includes('water')) return 'block:water';
    if (base === 10 || base === 11 || name.includes('lava')) return 'block:lava';

    if (name.includes('planks')) {
      const material = woodMaterialFromName(name) ?? 'oak';
      return `block:${materialPrefix(material)}_planks`;
    }

    if (name.includes('leaves')) {
      const material = woodMaterialFromName(name) ?? 'oak';
      return `block:${materialPrefix(material)}_leaves`;
    }

    if (base === 17 || base === 162 || name.includes('log') || (name.includes('wood') && !name.includes('planks'))) {
      const material = materialPrefix(woodMaterialFromLog(blockId, block));
      const axis = metadata(blockId) & 0xC;
      const endTexture = `block:${material}_log_top`;
      const sideTexture = `block:${material}_log_side`;

      if (axis === 4) return faceName === 'right' || faceName === 'left' ? endTexture : sideTexture;
      if (axis === 8) return faceName === 'front' || faceName === 'back' ? endTexture : sideTexture;
      return faceName === 'top' || faceName === 'bottom' ? endTexture : sideTexture;
    }

    if (name.includes('sand') && !name.includes('red')) return 'block:sand';
    if (name.includes('red_sand')) return 'block:red_sand';
    if (name.includes('cobblestone')) return 'block:cobblestone';
    if (name.includes('stone_brick')) return 'block:stone_bricks';
    if (name === 'stone' || name.includes('stone')) return 'block:stone';
    if (name === 'dirt' || name.includes('dirt')) return 'block:dirt';
    if (name.includes('gravel')) return 'block:gravel';
    if (name.includes('glass')) return 'block:glass';
    if (name.includes('snow')) return 'block:snow';
    if (name.includes('ice')) return 'block:ice';
    if (name.includes('clay')) return 'block:clay';
    if (name.includes('torch')) return 'block:torch';
    if (name.includes('redstone_wire')) return 'block:redstone_wire';
    if (name.includes('repeater')) return 'block:repeater';
    if (name.includes('lever')) return 'block:lever';

    if (name.includes('comparator')) {
      const isPowered = name.includes('powered');
      if (faceName === 'top') {
        return `block:${isPowered ? 'comparator_on' : 'comparator_off'}`;
      }
      return 'block:stone';
    }

    if (name.includes('daylight_detector')) {
      const isInverted = name.includes('inverted');
      if (faceName === 'top') {
        return `block:${isInverted ? 'daylight_detector_inverted_top' : 'daylight_detector_top'}`;
      }
      return 'block:daylight_detector_side';
    }

    if (name.includes('observer')) {
      const meta = metadata(blockId);
      const facings: BlockFacing[] = ['down', 'up', 'north', 'south', 'west', 'east'];
      const F = facings[meta] ?? 'north';
      
      let D: BlockFacing = 'north';
      if (faceName === 'top') D = 'up';
      else if (faceName === 'bottom') D = 'down';
      else if (faceName === 'right') D = 'east';
      else if (faceName === 'left') D = 'west';
      else if (faceName === 'front') D = 'south';
      else if (faceName === 'back') D = 'north';

      if (D === F) {
        return 'block:observer_front';
      }
      const oppositeF = getOppositeFacing(F);
      if (D === oppositeF) {
        return 'block:observer_back';
      }
      return 'block:observer_side';
    }

    if (name === 'stone_pressure_plate') {
      return 'block:stone';
    }
    if (name === 'wooden_pressure_plate') {
      return 'block:oak_planks';
    }
    if (name === 'light_weighted_pressure_plate') {
      return 'block:light_weighted_pressure_plate';
    }
    if (name === 'heavy_weighted_pressure_plate') {
      return 'block:heavy_weighted_pressure_plate';
    }
    if (name === 'tripwire_hook') {
      return 'block:tripwire_hook';
    }
    if (name === 'tripwire') {
      return 'block:tripwire';
    }

    const legacy = BlockRegistry.getTextureForFace(blockId, face);
    return `block:${legacy}`;
  },

  getBlockIconKey(blockId: number): string {
    const block = BlockRegistry.get(blockId);
    if (!block) return 'icon:block:stone';
    const base = baseId(blockId);
    if (base === 2 || block.name === 'grass') return 'icon:block:grass';
    if (block.name.includes('planks')) {
      return `icon:block:${materialPrefix(woodMaterialFromName(block.name) ?? 'oak')}_planks`;
    }
    if (block.name.includes('leaves')) {
      return `icon:block:${materialPrefix(woodMaterialFromName(block.name) ?? 'oak')}_leaves`;
    }
    if (base === 17 || base === 162 || block.name.includes('log') || (block.name.includes('wood') && !block.name.includes('planks'))) {
      return `icon:block:${materialPrefix(woodMaterialFromLog(blockId, block))}_log`;
    }
    return `icon:block:${block.name}`;
  },

  getItemIconKey(itemId: number): string {
    const placeBlockId = ItemRegistry.getPlaceBlockId(itemId);
    if (placeBlockId !== undefined) return this.getBlockIconKey(placeBlockId);

    const item = ItemRegistry.get(itemId);
    if (!item) return 'item:unknown';
    return `item:${item.name}`;
  },

  getItemVisualKind(itemId: number): ItemVisualKind {
    const item = ItemRegistry.get(itemId);
    if (!item) return 'sprite';
    if (ItemRegistry.getPlaceBlockId(itemId) !== undefined) return 'block';
    if (item.category === 'tool') return 'tool';
    return 'sprite';
  },

  getBlockAverageColor(blockId: number): number {
    const block = BlockRegistry.get(blockId);
    if (!block) return 0x888888;
    const key = this.getBlockFaceTexture(blockId, 0).replace(/^block:/, '');
    const color = this.getTextureColor(key, block.name);
    return parseInt(color.slice(1), 16);
  },

  getTextureColor(textureKey: string, fallbackName = textureKey): string {
    const colors: Record<string, string> = {
      stone: '#8c8c8c',
      dirt: '#8b5e34',
      grass_top: '#5b8c32',
      grass_side: '#6f7f35',
      water: '#2f67c7',
      lava: '#d85a16',
      sand: '#dec192',
      red_sand: '#ba6338',
      cobblestone: '#7a7a7a',
      gravel: '#8f8585',
      oak_planks: '#bc9862',
      spruce_planks: '#6b4226',
      birch_planks: '#d4c49a',
      jungle_planks: '#a8794b',
      acacia_planks: '#ba6338',
      dark_oak_planks: '#4c321f',
      oak_log_side: '#6b511d',
      spruce_log_side: '#4a2e1a',
      birch_log_side: '#d7cfaa',
      jungle_log_side: '#6f4d2e',
      acacia_log_side: '#7c4b38',
      dark_oak_log_side: '#3a2518',
      oak_log_top: '#b7905f',
      spruce_log_top: '#6b4226',
      birch_log_top: '#e4d8aa',
      jungle_log_top: '#9b6b3b',
      acacia_log_top: '#ba6338',
      dark_oak_log_top: '#4c321f',
      oak_leaves: '#3a7d1a',
      spruce_leaves: '#2f5a22',
      birch_leaves: '#6fa533',
      jungle_leaves: '#2f7d3a',
      acacia_leaves: '#4d8a24',
      dark_oak_leaves: '#254f18',
      glass: '#cceeff',
      snow: '#f4f8ff',
      ice: '#96c8ff',
      clay: '#9ea4b0',
      torch: '#ffaa00',
      redstone_wire: '#cc0000',
      repeater: '#b0a090',
      lever: '#8b6f47',
    };
    return colors[textureKey] ?? hashColor(fallbackName);
  },

  getIconColors(blockId: number): { top: string; left: string; right: string } {
    const topKey = this.getBlockFaceTexture(blockId, 0).replace(/^block:/, '');
    const sideKey = this.getBlockFaceTexture(blockId, 4).replace(/^block:/, '');
    const top = this.getTextureColor(topKey, topKey);
    const side = this.getTextureColor(sideKey, sideKey);
    return {
      top,
      left: shade(side, 0.82),
      right: shade(side, 0.68),
    };
  },
};
