export interface ResourcePackManifest {
  pack: {
    name: string;
    description?: string;
    version?: string;
  };
  textures?: Record<string, string>;
  sounds?: Record<string, string | string[]>;
  models?: Record<string, string>;
}

export interface LoadedResourcePack {
  url: string;
  baseUrl: string;
  manifest: ResourcePackManifest;
}

const ACTIVE_PACK_KEY = 'mc.resourcePackUrl';
const DEFAULT_PACK_URL = '/resource-packs/default/pack.json';

export class ResourcePackSystem {
  static getActivePackUrl(): string {
    if (typeof window === 'undefined') return DEFAULT_PACK_URL;
    const queryPack = new URLSearchParams(window.location.search).get('resourcePack');
    if (queryPack) return queryPack;
    return window.localStorage.getItem(ACTIVE_PACK_KEY) || DEFAULT_PACK_URL;
  }

  static setActivePackUrl(url: string) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(ACTIVE_PACK_KEY, url);
  }

  static clearActivePackUrl() {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(ACTIVE_PACK_KEY);
  }

  static async loadActivePack(): Promise<LoadedResourcePack | null> {
    return this.loadPack(this.getActivePackUrl());
  }

  static async loadPack(url: string): Promise<LoadedResourcePack | null> {
    try {
      const response = await fetch(url, { cache: 'no-cache' });
      if (!response.ok) {
        console.warn(`Resource pack not loaded: ${url} (${response.status})`);
        return null;
      }

      const manifest = await response.json() as ResourcePackManifest;
      if (!manifest.pack?.name) {
        console.warn(`Resource pack not loaded: ${url} is missing pack.name`);
        return null;
      }

      return {
        url,
        baseUrl: new URL('.', new URL(url, window.location.href)).toString(),
        manifest,
      };
    } catch (error) {
      console.warn(`Resource pack not loaded: ${url}`, error);
      return null;
    }
  }

  static resolveAssetUrl(pack: LoadedResourcePack, path: string): string {
    return new URL(path, pack.baseUrl).toString();
  }
}
