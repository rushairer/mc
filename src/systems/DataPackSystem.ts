import { BlockRegistry } from '../world/BlockRegistry';
import { ItemRegistry } from '../items/ItemRegistry';
import { addCraftingRecipes } from '../items/CraftingRecipes';
import type { DataPackManifest } from './DataPackTypes';

export interface LoadedDataPack {
  url: string;
  baseUrl: string;
  manifest: DataPackManifest;
}

const ACTIVE_DATA_PACK_KEY = 'mc.dataPackUrl';
const DEFAULT_DATA_PACK_URL = '/data-packs/default/pack.json';

export class DataPackSystem {
  static getActivePackUrl(): string {
    if (typeof window === 'undefined') return DEFAULT_DATA_PACK_URL;
    const queryPack = new URLSearchParams(window.location.search).get('dataPack');
    if (queryPack) return queryPack;
    return window.localStorage.getItem(ACTIVE_DATA_PACK_KEY) || DEFAULT_DATA_PACK_URL;
  }

  static setActivePackUrl(url: string) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(ACTIVE_DATA_PACK_KEY, url);
  }

  static clearActivePackUrl() {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(ACTIVE_DATA_PACK_KEY);
  }

  static async loadActivePack(): Promise<LoadedDataPack | null> {
    return this.loadPack(this.getActivePackUrl());
  }

  static async loadPack(url: string): Promise<LoadedDataPack | null> {
    try {
      const response = await fetch(url, { cache: 'no-cache' });
      if (!response.ok) {
        console.warn(`Data pack not loaded: ${url} (${response.status})`);
        return null;
      }

      const manifest = await response.json() as DataPackManifest;
      if (!manifest.pack?.name) {
        console.warn(`Data pack not loaded: ${url} is missing pack.name`);
        return null;
      }

      return {
        url,
        baseUrl: new URL('.', new URL(url, window.location.href)).toString(),
        manifest,
      };
    } catch (error) {
      console.warn(`Data pack not loaded: ${url}`, error);
      return null;
    }
  }

  static apply(pack: LoadedDataPack | null) {
    if (!pack) return;
    const { blocks = [], items = [], recipes = {} } = pack.manifest;
    if (blocks.length > 0) BlockRegistry.registerDataPackBlocks(blocks);
    if (items.length > 0) ItemRegistry.registerDataPackItems(items);
    if (Object.keys(recipes).length > 0) addCraftingRecipes(recipes);
  }
}
