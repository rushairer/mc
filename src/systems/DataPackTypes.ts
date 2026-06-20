import type { BlockDef } from '../types';
import type { ItemDef } from '../items/ItemRegistry';
import type { RawRecipe } from '../items/CraftingRecipes';

export interface DataPackManifest {
  pack: {
    name: string;
    description?: string;
    version?: string;
  };
  blocks?: DataPackBlock[];
  items?: DataPackItem[];
  recipes?: Record<string, RawRecipe[]>;
}

export type DataPackBlock = Partial<Omit<BlockDef, 'id' | 'name' | 'textureKey' | 'transparent' | 'solid' | 'hardness' | 'luminance'>> & {
  id: number;
  name: string;
  textureKey: string;
  transparent?: boolean;
  solid?: boolean;
  hardness?: number;
  luminance?: number;
};

export type DataPackItem = Partial<Omit<ItemDef, 'id' | 'officialId' | 'baseId' | 'metadata' | 'name' | 'displayName' | 'maxStackSize' | 'category'>> & {
  id: number;
  officialId?: string;
  baseId?: number;
  metadata?: number;
  name: string;
  displayName?: string;
  maxStackSize?: number;
  category?: ItemDef['category'];
};

