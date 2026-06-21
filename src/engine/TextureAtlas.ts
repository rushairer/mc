import * as THREE from 'three';
import { BlockRegistry } from '../world/BlockRegistry';
import { ItemRegistry } from '../items/ItemRegistry';
import { VisualResolver } from '../visual/VisualResolver';
import { LoadedResourcePack, ResourcePackSystem } from '../systems/ResourcePackSystem';

const ATLAS_SIZE = 1024;
const TILE_SIZE = 16;
const TILES_PER_ROW = ATLAS_SIZE / TILE_SIZE;

export class TextureAtlas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;
  private tileIndex: Map<string, number> = new Map();
  private nextIndex = 0;
  private dataURL = '';

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = ATLAS_SIZE;
    this.canvas.height = ATLAS_SIZE;
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.colorSpace = THREE.SRGBColorSpace;

    this.generateAllTextures();
    this.dataURL = this.canvas.toDataURL();
  }

  getTexture(): THREE.CanvasTexture {
    return this.texture;
  }

  getDataURL(): string {
    return this.dataURL;
  }

  getIconStyle(key: string, iconSize: number = 32): any {
    const idx = this.tileIndex.get(this.resolveKey(key));
    if (idx === undefined) {
      return {};
    }
    const col = idx % TILES_PER_ROW;
    const row = Math.floor(idx / TILES_PER_ROW);
    const scale = iconSize / TILE_SIZE;
    return {
      backgroundImage: `url(${this.dataURL})`,
      backgroundSize: `${ATLAS_SIZE * scale}px ${ATLAS_SIZE * scale}px`,
      backgroundPosition: `-${col * TILE_SIZE * scale}px -${row * TILE_SIZE * scale}px`,
      width: `${iconSize}px`,
      height: `${iconSize}px`,
      imageRendering: 'pixelated',
    };
  }

  getUV(key: string): { u0: number; v0: number; u1: number; v1: number } {
    const idx = this.tileIndex.get(this.resolveKey(key));
    if (idx === undefined) {
      return { u0: 0, v0: 0, u1: 1 / TILES_PER_ROW, v1: 1 / TILES_PER_ROW };
    }
    const col = idx % TILES_PER_ROW;
    const row = Math.floor(idx / TILES_PER_ROW);
    const s = 1 / TILES_PER_ROW;

    // Inset by half a pixel to prevent texture bleeding
    const eps = 0.5 / ATLAS_SIZE;

    return {
      u0: col * s + eps,
      v0: 1 - (row + 1) * s + eps,
      u1: (col + 1) * s - eps,
      v1: 1 - row * s - eps,
    };
  }

  async applyResourcePack(pack: LoadedResourcePack | null): Promise<void> {
    if (!pack?.manifest.textures) return;

    const entries = Object.entries(pack.manifest.textures);
    await Promise.all(entries.map(async ([key, path]) => {
      try {
        const image = await this.loadImage(ResourcePackSystem.resolveAssetUrl(pack, path));
        this.drawImageTile(key, image);
      } catch (error) {
        console.warn(`Texture override not loaded: ${key}`, error);
      }
    }));

    this.dataURL = this.canvas.toDataURL();
    this.texture.needsUpdate = true;
  }

  private allocateTile(key: string): number {
    if (this.tileIndex.has(key)) return this.tileIndex.get(key)!;
    const idx = this.nextIndex++;
    this.tileIndex.set(key, idx);
    return idx;
  }

  private resolveKey(key: string): string {
    if (this.tileIndex.has(key)) return key;
    if (key.startsWith('block:') || key.startsWith('item:')) {
      const legacy = key.replace(/^(block|item):/, '');
      if (this.tileIndex.has(legacy)) return legacy;
    }
    if (key.startsWith('icon:block:') || key.startsWith('icon:item:')) {
      const legacy = `${key.replace(/^icon:(block|item):/, '')}_icon`;
      if (this.tileIndex.has(legacy)) return legacy;
    }
    return key;
  }

  private aliasTile(alias: string, target: string) {
    const idx = this.tileIndex.get(target);
    if (idx !== undefined) {
      this.tileIndex.set(alias, idx);
    }
  }

  private drawTile(key: string, draw: (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => void) {
    const idx = this.allocateTile(key);
    const col = idx % TILES_PER_ROW;
    const row = Math.floor(idx / TILES_PER_ROW);
    const x = col * TILE_SIZE;
    const y = row * TILE_SIZE;
    draw(this.ctx, x, y, TILE_SIZE);
    this.texture.needsUpdate = true;
  }

  private drawImageTile(key: string, image: CanvasImageSource) {
    const idx = this.allocateTile(key);
    const col = idx % TILES_PER_ROW;
    const row = Math.floor(idx / TILES_PER_ROW);
    const x = col * TILE_SIZE;
    const y = row * TILE_SIZE;
    this.ctx.clearRect(x, y, TILE_SIZE, TILE_SIZE);
    this.ctx.drawImage(image, x, y, TILE_SIZE, TILE_SIZE);
    this.texture.needsUpdate = true;
  }

  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Failed to load image ${url}`));
      image.src = url;
    });
  }

  private generateAllTextures() {
    const c = this.ctx;

    // stone
    this.drawTile('stone', (ctx, x, y, s) => {
      ctx.fillStyle = '#888888';
      ctx.fillRect(x, y, s, s);
      for (let i = 0; i < 30; i++) {
        const px = x + Math.random() * s;
        const py = y + Math.random() * s;
        const gr = 120 + Math.random() * 40 | 0;
        ctx.fillStyle = `rgb(${gr},${gr},${gr})`;
        ctx.fillRect(px | 0, py | 0, 2, 2);
      }
    });

    // grass top
    this.drawTile('grass_top', (ctx, x, y, s) => {
      ctx.fillStyle = '#5B8C32';
      ctx.fillRect(x, y, s, s);
      for (let i = 0; i < 40; i++) {
        const px = x + Math.random() * s;
        const py = y + Math.random() * s;
        const r = 70 + Math.random() * 30 | 0;
        const g = 120 + Math.random() * 40 | 0;
        const b = 30 + Math.random() * 30 | 0;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(px | 0, py | 0, 2, 1);
      }
    });

    this.drawTile('grass_side', (ctx, x, y, s) => {
      ctx.fillStyle = '#8B6914';
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#5B8C32';
      ctx.fillRect(x, y, s, 4);
      for (let i = 0; i < s; i += 3) {
        const h = 1 + (i % 5);
        ctx.fillRect(x + i, y + 4, 1, h);
      }
      ctx.fillStyle = 'rgba(90, 55, 20, 0.35)';
      for (let i = 0; i < 12; i++) {
        ctx.fillRect(x + ((i * 5) % s), y + 7 + ((i * 3) % 8), 2, 1);
      }
    });

    // dirt
    this.drawTile('dirt', (ctx, x, y, s) => {
      ctx.fillStyle = '#8B6914';
      ctx.fillRect(x, y, s, s);
      for (let i = 0; i < 35; i++) {
        const px = x + Math.random() * s;
        const py = y + Math.random() * s;
        const r = 120 + Math.random() * 40 | 0;
        const g = 80 + Math.random() * 30 | 0;
        const b = 20 + Math.random() * 20 | 0;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(px | 0, py | 0, 2, 2);
      }
    });

    // cobblestone
    this.drawTile('cobblestone', (ctx, x, y, s) => {
      ctx.fillStyle = '#7A7A7A';
      ctx.fillRect(x, y, s, s);
      for (let i = 0; i < 6; i++) {
        const bx = x + 1 + Math.random() * (s - 5) | 0;
        const by = y + 1 + Math.random() * (s - 5) | 0;
        const bw = 3 + Math.random() * 5 | 0;
        const bh = 3 + Math.random() * 5 | 0;
        const gr = 90 + Math.random() * 60 | 0;
        ctx.fillStyle = `rgb(${gr},${gr},${gr})`;
        ctx.fillRect(bx, by, bw, bh);
      }
    });

    // oak planks
    this.drawTile('oak_planks', (ctx, x, y, s) => {
      ctx.fillStyle = '#BC9862';
      ctx.fillRect(x, y, s, s);
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = '#A8874D';
        ctx.fillRect(x, y + i * 4, s, 1);
      }
      ctx.fillStyle = '#A8874D';
      ctx.fillRect(x + 7, y, 1, s);
    });

    // oak log side
    this.drawTile('oak_log_side', (ctx, x, y, s) => {
      ctx.fillStyle = '#6B511D';
      ctx.fillRect(x, y, s, s);
      for (let i = 0; i < 16; i++) {
        ctx.fillStyle = i % 3 === 0 ? '#5A4416' : '#7A5E24';
        ctx.fillRect(x + i, y, 1, s);
      }
      for (let i = 0; i < 3; i++) {
        const py = y + Math.random() * s | 0;
        ctx.fillStyle = '#5A4416';
        ctx.fillRect(x, py, s, 1);
      }
    });

    // oak log top
    this.drawTile('oak_log_top', (ctx, x, y, s) => {
      ctx.fillStyle = '#6B511D';
      ctx.fillRect(x, y, s, s);
      const cx = x + s / 2;
      const cy = y + s / 2;
      for (let r = 2; r < s / 2; r += 2) {
        ctx.strokeStyle = r % 4 === 0 ? '#5A4416' : '#7A5E24';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    // oak leaves
    this.drawTile('oak_leaves', (ctx, x, y, s) => {
      ctx.fillStyle = '#3A7D1A';
      ctx.fillRect(x, y, s, s);
      for (let i = 0; i < 50; i++) {
        const px = x + Math.random() * s;
        const py = y + Math.random() * s;
        const g = 80 + Math.random() * 80 | 0;
        ctx.fillStyle = `rgb(${30 + Math.random() * 30 | 0},${g},${10 + Math.random() * 20 | 0})`;
        ctx.fillRect(px | 0, py | 0, 2, 2);
      }
    });

    // spruce_planks
    this.drawTile('spruce_planks', (ctx, x, y, s) => {
      ctx.fillStyle = '#6B4226';
      ctx.fillRect(x, y, s, s);
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = '#5A3620';
        ctx.fillRect(x, y + i * 4 + 3, s, 1);
      }
    });

    // birch_planks
    this.drawTile('birch_planks', (ctx, x, y, s) => {
      ctx.fillStyle = '#D4C49A';
      ctx.fillRect(x, y, s, s);
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = '#C0B080';
        ctx.fillRect(x, y + i * 4 + 3, s, 1);
      }
    });

    // acacia_planks
    this.drawTile('acacia_planks', (ctx, x, y, s) => {
      ctx.fillStyle = '#BA6338';
      ctx.fillRect(x, y, s, s);
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = '#A05530';
        ctx.fillRect(x, y + i * 4 + 3, s, 1);
      }
    });

    this.drawTile('jungle_planks', (ctx, x, y, s) => {
      ctx.fillStyle = '#A8794B';
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#8F633D';
      for (let i = 0; i < 4; i++) ctx.fillRect(x, y + i * 4 + 3, s, 1);
      ctx.fillRect(x + 6, y, 1, s);
    });

    this.drawTile('dark_oak_planks', (ctx, x, y, s) => {
      ctx.fillStyle = '#4C321F';
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#382416';
      for (let i = 0; i < 4; i++) ctx.fillRect(x, y + i * 4 + 3, s, 1);
      ctx.fillRect(x + 9, y, 1, s);
    });

    // spruce_log_side
    this.drawTile('spruce_log_side', (ctx, x, y, s) => {
      ctx.fillStyle = '#3B2616';
      ctx.fillRect(x, y, s, s);
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = '#2A1A0E';
        ctx.fillRect(x + i * 3, y, 1, s);
      }
    });

    // spruce_log_top
    this.drawTile('spruce_log_top', (ctx, x, y, s) => {
      ctx.fillStyle = '#3B2616';
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#5A3D2A';
      ctx.fillRect(x + 4, y + 4, 8, 8);
      ctx.fillStyle = '#3B2616';
      ctx.fillRect(x + 6, y + 6, 4, 4);
    });

    // birch_log_side
    this.drawTile('birch_log_side', (ctx, x, y, s) => {
      ctx.fillStyle = '#DAD6B8';
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#C9C39C';
      ctx.fillRect(x + 3, y, 1, s);
      ctx.fillRect(x + 11, y, 1, s);
      ctx.fillStyle = '#3E3A2C';
      ctx.fillRect(x + 1, y + 2, 4, 1);
      ctx.fillRect(x + 9, y + 4, 5, 1);
      ctx.fillRect(x + 4, y + 7, 3, 1);
      ctx.fillRect(x + 12, y + 9, 3, 1);
      ctx.fillRect(x + 2, y + 12, 5, 1);
      ctx.fillStyle = '#EEE8C8';
      ctx.fillRect(x + 6, y, 1, s);
      ctx.fillRect(x + 14, y, 1, s);
    });

    // birch_log_top
    this.drawTile('birch_log_top', (ctx, x, y, s) => {
      ctx.fillStyle = '#D4D4C8';
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#C0BFA0';
      ctx.fillRect(x + 4, y + 4, 8, 8);
      ctx.fillStyle = '#D4D4C8';
      ctx.fillRect(x + 6, y + 6, 4, 4);
    });

    // acacia_log_side
    this.drawTile('acacia_log_side', (ctx, x, y, s) => {
      ctx.fillStyle = '#6A6A6A';
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#BA6338';
      ctx.fillRect(x + 2, y, s - 4, s);
    });

    // acacia_log_top
    this.drawTile('acacia_log_top', (ctx, x, y, s) => {
      ctx.fillStyle = '#6A6A6A';
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#BA6338';
      ctx.fillRect(x + 4, y + 4, 8, 8);
    });

    this.drawTile('jungle_log_side', (ctx, x, y, s) => {
      ctx.fillStyle = '#6F4D2E';
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#5D3D24';
      for (let i = 1; i < s; i += 4) ctx.fillRect(x + i, y, 1, s);
    });

    this.drawTile('jungle_log_top', (ctx, x, y, s) => {
      ctx.fillStyle = '#9B6B3B';
      ctx.fillRect(x, y, s, s);
      ctx.strokeStyle = '#6F4D2E';
      for (let r = 2; r < s / 2; r += 2) {
        ctx.beginPath();
        ctx.arc(x + s / 2, y + s / 2, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    this.drawTile('dark_oak_log_side', (ctx, x, y, s) => {
      ctx.fillStyle = '#3A2518';
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#25170F';
      for (let i = 2; i < s; i += 4) ctx.fillRect(x + i, y, 1, s);
    });

    this.drawTile('dark_oak_log_top', (ctx, x, y, s) => {
      ctx.fillStyle = '#4C321F';
      ctx.fillRect(x, y, s, s);
      ctx.strokeStyle = '#2C1B10';
      for (let r = 2; r < s / 2; r += 2) {
        ctx.beginPath();
        ctx.arc(x + s / 2, y + s / 2, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    // spruce_leaves
    this.drawTile('spruce_leaves', (ctx, x, y, s) => {
      ctx.fillStyle = '#2D5A1A';
      ctx.fillRect(x, y, s, s);
      for (let i = 0; i < 50; i++) {
        const px = x + Math.random() * s;
        const py = y + Math.random() * s;
        ctx.fillStyle = `rgb(${20 + Math.random() * 20 | 0},${60 + Math.random() * 40 | 0},${10 + Math.random() * 15 | 0})`;
        ctx.fillRect(px | 0, py | 0, 2, 2);
      }
    });

    // birch_leaves
    this.drawTile('birch_leaves', (ctx, x, y, s) => {
      ctx.fillStyle = '#5A8A2A';
      ctx.fillRect(x, y, s, s);
      for (let i = 0; i < 50; i++) {
        const px = x + Math.random() * s;
        const py = y + Math.random() * s;
        ctx.fillStyle = `rgb(${60 + Math.random() * 30 | 0},${110 + Math.random() * 40 | 0},${20 + Math.random() * 20 | 0})`;
        ctx.fillRect(px | 0, py | 0, 2, 2);
      }
    });

    // acacia_leaves
    this.drawTile('acacia_leaves', (ctx, x, y, s) => {
      ctx.fillStyle = '#4A7A1A';
      ctx.fillRect(x, y, s, s);
      for (let i = 0; i < 50; i++) {
        const px = x + Math.random() * s;
        const py = y + Math.random() * s;
        ctx.fillStyle = `rgb(${50 + Math.random() * 30 | 0},${90 + Math.random() * 40 | 0},${15 + Math.random() * 15 | 0})`;
        ctx.fillRect(px | 0, py | 0, 2, 2);
      }
    });

    this.drawTile('jungle_leaves', (ctx, x, y, s) => {
      ctx.fillStyle = '#2F7D3A';
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#245F2D';
      for (let i = 0; i < 35; i++) ctx.fillRect(x + ((i * 7) % s), y + ((i * 5) % s), 2, 2);
    });

    this.drawTile('dark_oak_leaves', (ctx, x, y, s) => {
      ctx.fillStyle = '#254F18';
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#193A10';
      for (let i = 0; i < 35; i++) ctx.fillRect(x + ((i * 7) % s), y + ((i * 5) % s), 2, 2);
    });

    // ─── Flowers & Plants ───

    this.drawTile('dandelion', (ctx, x, y, s) => {
      ctx.fillStyle = '#2A6B10';
      ctx.fillRect(x + 7, y + 4, 2, 12);
      ctx.fillStyle = '#FFD700';
      ctx.fillRect(x + 5, y, 6, 6);
      ctx.fillStyle = '#FFEE00';
      ctx.fillRect(x + 6, y + 1, 4, 4);
    });

    this.drawTile('poppy', (ctx, x, y, s) => {
      ctx.fillStyle = '#2A6B10';
      ctx.fillRect(x + 7, y + 4, 2, 12);
      ctx.fillStyle = '#CC0000';
      ctx.fillRect(x + 5, y, 6, 6);
      ctx.fillStyle = '#FF2222';
      ctx.fillRect(x + 6, y + 1, 4, 4);
      ctx.fillStyle = '#000000';
      ctx.fillRect(x + 7, y + 2, 2, 2);
    });

    this.drawTile('tall_grass', (ctx, x, y, s) => {
      ctx.fillStyle = '#3A8A15';
      ctx.fillRect(x + 2, y + 3, 2, 13);
      ctx.fillRect(x + 6, y + 1, 2, 15);
      ctx.fillRect(x + 10, y + 4, 2, 12);
      ctx.fillRect(x + 13, y + 6, 2, 10);
    });

    this.drawTile('fern', (ctx, x, y, s) => {
      ctx.fillStyle = '#2A7A10';
      ctx.fillRect(x + 1, y + 2, 3, 14);
      ctx.fillRect(x + 5, y + 1, 3, 15);
      ctx.fillRect(x + 9, y + 3, 3, 13);
      ctx.fillRect(x + 12, y + 5, 3, 11);
    });

    this.drawTile('dead_bush', (ctx, x, y, s) => {
      ctx.fillStyle = '#8B6914';
      ctx.fillRect(x + 6, y + 4, 2, 12);
      ctx.fillRect(x + 3, y + 6, 5, 2);
      ctx.fillRect(x + 9, y + 5, 4, 2);
      ctx.fillRect(x + 4, y + 2, 3, 2);
    });

    this.drawTile('blue_orchid', (ctx, x, y, s) => {
      ctx.fillStyle = '#2A6B10';
      ctx.fillRect(x + 7, y + 5, 2, 11);
      ctx.fillStyle = '#5599FF';
      ctx.fillRect(x + 5, y, 6, 6);
      ctx.fillStyle = '#77BBFF';
      ctx.fillRect(x + 6, y + 1, 4, 4);
    });

    this.drawTile('allium', (ctx, x, y, s) => {
      ctx.fillStyle = '#2A6B10';
      ctx.fillRect(x + 7, y + 5, 2, 11);
      ctx.fillStyle = '#AA44CC';
      ctx.fillRect(x + 5, y, 6, 6);
      ctx.fillStyle = '#CC66EE';
      ctx.fillRect(x + 6, y + 1, 4, 4);
    });

    this.drawTile('red_tulip', (ctx, x, y, s) => {
      ctx.fillStyle = '#2A6B10';
      ctx.fillRect(x + 7, y + 5, 2, 11);
      ctx.fillStyle = '#CC2222';
      ctx.fillRect(x + 5, y, 6, 7);
      ctx.fillStyle = '#2A6B10';
      ctx.fillRect(x + 7, y + 2, 2, 3);
    });

    // sand
    this.drawTile('sand', (ctx, x, y, s) => {
      ctx.fillStyle = '#E8D7A3';
      ctx.fillRect(x, y, s, s);
      for (let i = 0; i < 30; i++) {
        const px = x + Math.random() * s;
        const py = y + Math.random() * s;
        const r = 220 + Math.random() * 20 | 0;
        const g = 200 + Math.random() * 20 | 0;
        const b = 140 + Math.random() * 30 | 0;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(px | 0, py | 0, 1, 1);
      }
    });

    // gravel
    this.drawTile('gravel', (ctx, x, y, s) => {
      ctx.fillStyle = '#857B71';
      ctx.fillRect(x, y, s, s);
      for (let i = 0; i < 25; i++) {
        const px = x + Math.random() * s;
        const py = y + Math.random() * s;
        const gr = 100 + Math.random() * 50 | 0;
        ctx.fillStyle = `rgb(${gr},${gr - 5},${gr - 10})`;
        ctx.fillRect(px | 0, py | 0, 3, 2);
      }
    });

    // ores
    this.drawOreTile('gold_ore', '#FFD700');
    this.drawOreTile('iron_ore', '#D4A574');
    this.drawOreTile('coal_ore', '#333333');
    this.drawOreTile('diamond_ore', '#5DECF5');
    this.drawOreTile('redstone_ore', '#FF0000');
    this.drawOreTile('lapis_ore', '#3344CC');

    // water
    this.drawTile('water', (ctx, x, y, s) => {
      ctx.clearRect(x, y, s, s);
      ctx.fillStyle = 'rgba(36, 102, 212, 0.74)';
      ctx.fillRect(x, y, s, s);

      const light = 'rgba(150, 205, 255, 0.10)';
      const mid = 'rgba(58, 128, 230, 0.08)';
      const dark = 'rgba(12, 58, 150, 0.11)';

      ctx.fillStyle = light;
      ctx.fillRect(x + 2, y + 4, 7, 1);
      ctx.fillRect(x + 7, y + 11, 6, 1);

      ctx.fillStyle = mid;
      ctx.fillRect(x + 1, y + 7, 5, 1);
      ctx.fillRect(x + 10, y + 8, 4, 1);

      ctx.fillStyle = dark;
      ctx.fillRect(x + 11, y + 2, 3, 1);
      ctx.fillRect(x + 3, y + 14, 4, 1);
    });

    // lava
    this.drawTile('lava', (ctx, x, y, s) => {
      ctx.fillStyle = '#D84400';
      ctx.fillRect(x, y, s, s);
      for (let i = 0; i < 15; i++) {
        const px = x + Math.random() * s;
        const py = y + Math.random() * s;
        ctx.fillStyle = `rgb(${200 + Math.random() * 55 | 0},${80 + Math.random() * 80 | 0},0)`;
        ctx.fillRect(px | 0, py | 0, 3, 2);
      }
    });

    // sandstone
    this.drawTile('sandstone', (ctx, x, y, s) => {
      ctx.fillStyle = '#E8D4A0';
      ctx.fillRect(x, y, s, s);
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = '#D4C088';
        ctx.fillRect(x, y + i * 4, s, 1);
      }
    });

    // white wool
    this.drawTile('white_wool', (ctx, x, y, s) => {
      ctx.fillStyle = '#E8E8E8';
      ctx.fillRect(x, y, s, s);
      for (let i = 0; i < 40; i++) {
        const px = x + Math.random() * s;
        const py = y + Math.random() * s;
        const gr = 210 + Math.random() * 30 | 0;
        ctx.fillStyle = `rgb(${gr},${gr},${gr})`;
        ctx.fillRect(px | 0, py | 0, 2, 2);
      }
    });

    // metal blocks
    this.drawTile('gold_block', (ctx, x, y, s) => {
      ctx.fillStyle = '#FFD700';
      ctx.fillRect(x, y, s, s);
      ctx.strokeStyle = '#CC9900';
      ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
    });

    this.drawTile('iron_block', (ctx, x, y, s) => {
      ctx.fillStyle = '#D8D8D8';
      ctx.fillRect(x, y, s, s);
      ctx.strokeStyle = '#AAAAAA';
      ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
    });

    this.drawTile('diamond_block', (ctx, x, y, s) => {
      ctx.fillStyle = '#5DECF5';
      ctx.fillRect(x, y, s, s);
      ctx.strokeStyle = '#3ABCC5';
      ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
    });

    // bricks
    this.drawTile('bricks', (ctx, x, y, s) => {
      ctx.fillStyle = '#9B4B3A';
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#C0A090';
      for (let row = 0; row < 4; row++) {
        const yy = y + row * 4;
        ctx.fillRect(x, yy + 3, s, 1);
        const off = row % 2 === 0 ? 0 : 4;
        for (let col = 0; col < 3; col++) {
          ctx.fillRect(x + off + col * 8, yy, 1, 3);
        }
      }
    });

    // stone bricks
    this.drawTile('stone_bricks', (ctx, x, y, s) => {
      ctx.fillStyle = '#7A7A7A';
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#636363';
      ctx.fillRect(x, y + 7, s, 1);
      ctx.fillRect(x + 7, y, 1, 7);
      ctx.fillRect(x + 3, y + 8, 1, 8);
      ctx.fillRect(x + 11, y + 8, 1, 8);
      ctx.fillRect(x, y + 15, s, 1);
    });

    // crafting table
    this.drawTile('crafting_top', (ctx, x, y, s) => {
      ctx.fillStyle = '#BC9862';
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#A8874D';
      ctx.fillRect(x + 3, y + 3, 4, 4);
      ctx.fillRect(x + 9, y + 3, 4, 4);
      ctx.fillRect(x + 3, y + 9, 4, 4);
      ctx.fillRect(x + 9, y + 9, 4, 4);
    });

    this.drawTile('crafting_side', (ctx, x, y, s) => {
      ctx.fillStyle = '#BC9862';
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#8B5E3C';
      ctx.fillRect(x, y + 2, s, 1);
      ctx.fillRect(x, y + 13, s, 1);
    });

    // chest
    this.drawTile('chest_top', (ctx, x, y, s) => {
      ctx.fillStyle = '#9A6126';
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#6F4318';
      ctx.fillRect(x, y + 7, s, 2);
      ctx.fillRect(x + 7, y, 2, s);
      ctx.strokeStyle = '#3B2410';
      ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
    });

    this.drawTile('chest_side', (ctx, x, y, s) => {
      ctx.fillStyle = '#9A6126';
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#6F4318';
      ctx.fillRect(x, y + 4, s, 1);
      ctx.fillRect(x, y + 12, s, 1);
      ctx.fillRect(x + 2, y, 1, s);
      ctx.fillRect(x + 13, y, 1, s);
      ctx.fillStyle = '#D6B15C';
      ctx.fillRect(x + 6, y + 6, 4, 4);
      ctx.fillStyle = '#3B2410';
      ctx.fillRect(x + 7, y + 8, 2, 1);
      ctx.strokeStyle = '#3B2410';
      ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
    });

    // oak door
    this.drawTile('oak_door_closed', (ctx, x, y, s) => {
      ctx.fillStyle = '#8B5A2B';
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#A7773E';
      ctx.fillRect(x + 2, y + 2, 5, 5);
      ctx.fillRect(x + 9, y + 2, 5, 5);
      ctx.fillRect(x + 2, y + 9, 5, 5);
      ctx.fillRect(x + 9, y + 9, 5, 5);
      ctx.strokeStyle = '#4C2F14';
      ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
      ctx.fillStyle = '#D6B15C';
      ctx.fillRect(x + 12, y + 7, 2, 2);
    });


    // oak trapdoor
    this.drawTile('oak_trapdoor_closed', (ctx, x, y, s) => {
      ctx.fillStyle = '#8B5A2B';
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#A7773E';
      ctx.fillRect(x + 2, y + 2, 5, 5);
      ctx.fillRect(x + 9, y + 2, 5, 5);
      ctx.fillRect(x + 2, y + 9, 5, 5);
      ctx.fillRect(x + 9, y + 9, 5, 5);
      ctx.strokeStyle = '#4C2F14';
      ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
      ctx.fillStyle = '#D6B15C';
      ctx.fillRect(x + 7, y + 7, 2, 2);
    });

    this.drawTile('oak_trapdoor_open', (ctx, x, y, s) => {
      ctx.fillStyle = '#8B5A2B';
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#A7773E';
      ctx.fillRect(x + 2, y + 2, 12, 3);
      ctx.fillRect(x + 2, y + 7, 12, 2);
      ctx.fillRect(x + 2, y + 11, 12, 3);
      ctx.strokeStyle = '#4C2F14';
      ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
      ctx.strokeRect(x + 5.5, y + 1, 1, s - 2);
      ctx.strokeRect(x + 10.5, y + 1, 1, s - 2);
      ctx.fillStyle = '#D6B15C';
      ctx.fillRect(x + 2, y + 7, 2, 2);
    });

    // furnace
    this.drawTile('furnace_top', (ctx, x, y, s) => {
      ctx.fillStyle = '#888888';
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#666666';
      ctx.fillRect(x + 2, y + 2, s - 4, s - 4);
    });

    this.drawTile('furnace_side', (ctx, x, y, s) => {
      ctx.fillStyle = '#888888';
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#555555';
      ctx.fillRect(x + 4, y + 5, 8, 8);
      ctx.fillStyle = '#333333';
      ctx.fillRect(x + 5, y + 6, 6, 6);
    });

    // hopper
    this.drawTile('hopper_top', (ctx, x, y, s) => {
      ctx.fillStyle = '#4a4d53';
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#1b1c1e';
      ctx.fillRect(x + 2, y + 2, s - 4, s - 4);
      ctx.strokeStyle = '#2d2f33';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
    });

    this.drawTile('hopper_side', (ctx, x, y, s) => {
      ctx.fillStyle = '#3c3e42';
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#4a4d53';
      ctx.fillRect(x, y, s, 4); // top rim
      ctx.fillStyle = '#2d2f33';
      ctx.fillRect(x, y + 4, s, 1); // border under top rim
      ctx.fillStyle = '#2d2f33';
      ctx.fillRect(x + 3, y + 8, s - 6, s - 8);
    });

    // daylight detector
    this.drawTile('daylight_detector_top', (ctx, x, y, s) => {
      ctx.fillStyle = '#9c704c';
      ctx.fillRect(x, y, s, s);
      ctx.strokeStyle = '#5a3d24';
      ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
      ctx.fillStyle = '#4484a4';
      const margin = 2;
      const size = (s - margin * 2) / 3;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          ctx.fillRect(x + margin + c * size + 0.5, y + margin + r * size + 0.5, size - 1, size - 1);
        }
      }
    });

    this.drawTile('daylight_detector_inverted_top', (ctx, x, y, s) => {
      ctx.fillStyle = '#9c704c';
      ctx.fillRect(x, y, s, s);
      ctx.strokeStyle = '#5a3d24';
      ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
      ctx.fillStyle = '#5c4c6c';
      const margin = 2;
      const size = (s - margin * 2) / 3;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          ctx.fillRect(x + margin + c * size + 0.5, y + margin + r * size + 0.5, size - 1, size - 1);
        }
      }
    });

    this.drawTile('daylight_detector_side', (ctx, x, y, s) => {
      ctx.fillStyle = '#9c704c';
      ctx.fillRect(x, y, s, 4);
      ctx.fillStyle = '#5a3d24';
      ctx.fillRect(x, y + 4, s, 1);
      ctx.fillStyle = '#7a7a7a';
      ctx.fillRect(x, y + 5, s, s - 5);
      ctx.fillStyle = '#606060';
      ctx.fillRect(x + 2, y + 8, 2, 2);
      ctx.fillRect(x + 10, y + 11, 2, 2);
    });

    // redstone comparator
    this.drawTile('comparator_off', (ctx, x, y, s) => {
      ctx.fillStyle = '#8f8f8f';
      ctx.fillRect(x, y, s, s);
      ctx.strokeStyle = '#6a6a6a';
      ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
      ctx.fillStyle = '#500000';
      ctx.fillRect(x + 7, y + 3, 2, 10);
      ctx.fillRect(x + 4, y + 7, 8, 2);
      ctx.fillStyle = '#500000';
      ctx.fillRect(x + 3, y + 10, 2, 2);
      ctx.fillRect(x + 11, y + 10, 2, 2);
      ctx.fillRect(x + 7, y + 2, 2, 2);
    });

    this.drawTile('comparator_on', (ctx, x, y, s) => {
      ctx.fillStyle = '#8f8f8f';
      ctx.fillRect(x, y, s, s);
      ctx.strokeStyle = '#6a6a6a';
      ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(x + 7, y + 3, 2, 10);
      ctx.fillRect(x + 4, y + 7, 8, 2);
      ctx.fillStyle = '#ff5500';
      ctx.fillRect(x + 3, y + 10, 2, 2);
      ctx.fillRect(x + 11, y + 10, 2, 2);
      ctx.fillRect(x + 7, y + 2, 2, 2);
    });

    // observer
    this.drawTile('observer_front', (ctx, x, y, s) => {
      ctx.fillStyle = '#5c5e62';
      ctx.fillRect(x, y, s, s);
      ctx.strokeStyle = '#383a3d';
      ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
      ctx.fillStyle = '#40a0c0';
      ctx.fillRect(x + 3, y + 5, 3, 2);
      ctx.fillRect(x + 10, y + 5, 3, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 4, y + 5, 1, 1);
      ctx.fillRect(x + 11, y + 5, 1, 1);
      ctx.fillStyle = '#2d2f33';
      ctx.fillRect(x + 4, y + 9, 8, 2);
    });

    this.drawTile('observer_back', (ctx, x, y, s) => {
      ctx.fillStyle = '#5c5e62';
      ctx.fillRect(x, y, s, s);
      ctx.strokeStyle = '#383a3d';
      ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
      ctx.fillStyle = '#2d2f33';
      ctx.fillRect(x + 5, y + 5, 6, 6);
      ctx.fillStyle = '#a02020';
      ctx.fillRect(x + 6, y + 6, 4, 4);
    });

    this.drawTile('observer_side', (ctx, x, y, s) => {
      ctx.fillStyle = '#5c5e62';
      ctx.fillRect(x, y, s, s);
      ctx.strokeStyle = '#383a3d';
      ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
      ctx.fillStyle = '#4a4b4e';
      ctx.fillRect(x, y + 4, s, 1);
      ctx.fillRect(x, y + 11, s, 1);
    });

    // light weighted pressure plate (gold)
    this.drawTile('light_weighted_pressure_plate', (ctx, x, y, s) => {
      ctx.fillStyle = '#fce205';
      ctx.fillRect(x, y, s, s);
      ctx.strokeStyle = '#d4af37';
      ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
    });

    // heavy weighted pressure plate (iron)
    this.drawTile('heavy_weighted_pressure_plate', (ctx, x, y, s) => {
      ctx.fillStyle = '#e7e7e7';
      ctx.fillRect(x, y, s, s);
      ctx.strokeStyle = '#c0c0c0';
      ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
    });

    // tripwire hook
    this.drawTile('tripwire_hook', (ctx, x, y, s) => {
      ctx.fillStyle = '#9c704c';
      ctx.fillRect(x + 2, y + 4, s - 4, s - 8);
      ctx.strokeStyle = '#5a3d24';
      ctx.strokeRect(x + 2.5, y + 4.5, s - 5, s - 9);
      ctx.fillStyle = '#c0c0c0';
      ctx.fillRect(x + 6, y + 6, 4, 4);
      ctx.fillStyle = '#777777';
      ctx.fillRect(x + 7, y + 10, 2, 4);
    });

    // tripwire (string)
    this.drawTile('tripwire', (ctx, x, y, s) => {
      ctx.fillStyle = 'rgba(0,0,0,0)';
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#e0e0e0';
      ctx.fillRect(x, y + 7, s, 2);
    });

    // glass
    this.drawTile('glass', (ctx, x, y, s) => {
      ctx.clearRect(x, y, s, s);
      ctx.fillStyle = 'rgba(200,220,255,0.3)';
      ctx.fillRect(x, y, s, s);
      ctx.strokeStyle = 'rgba(200,220,255,0.8)';
      ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 4, y + 4);
      ctx.lineTo(x + 4, y + s - 1);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.stroke();
    });

    // snow
    this.drawTile('snow', (ctx, x, y, s) => {
      ctx.fillStyle = '#F0F0F0';
      ctx.fillRect(x, y, s, s);
      for (let i = 0; i < 15; i++) {
        const px = x + Math.random() * s;
        const py = y + Math.random() * s;
        ctx.fillStyle = `rgba(220,220,230,${0.3 + Math.random() * 0.3})`;
        ctx.fillRect(px | 0, py | 0, 2, 1);
      }
    });

    // ice
    this.drawTile('ice', (ctx, x, y, s) => {
      ctx.fillStyle = 'rgba(150,200,255,0.7)';
      ctx.fillRect(x, y, s, s);
      ctx.strokeStyle = 'rgba(200,230,255,0.4)';
      ctx.beginPath();
      ctx.moveTo(x + 2, y + 1);
      ctx.lineTo(x + s - 3, y + s - 2);
      ctx.stroke();
    });

    // clay
    this.drawTile('clay', (ctx, x, y, s) => {
      ctx.fillStyle = '#9EA4B0';
      ctx.fillRect(x, y, s, s);
      for (let i = 0; i < 20; i++) {
        const px = x + Math.random() * s;
        const py = y + Math.random() * s;
        const gr = 140 + Math.random() * 30 | 0;
        ctx.fillStyle = `rgb(${gr},${gr},${gr + 10})`;
        ctx.fillRect(px | 0, py | 0, 2, 2);
      }
    });

    // torch
    this.drawTile('torch', (ctx, x, y, s) => {
      ctx.clearRect(x, y, s, s);
      ctx.fillStyle = '#8B6914';
      ctx.fillRect(x + 7, y + 3, 2, 10);
      ctx.fillStyle = '#FFAA00';
      ctx.fillRect(x + 6, y + 1, 4, 3);
      ctx.fillStyle = '#FF6600';
      ctx.fillRect(x + 7, y, 2, 2);
    });

    // TNT
    this.drawTile('tnt_top', (ctx, x, y, s) => {
      ctx.fillStyle = '#CC3333';
      ctx.fillRect(x, y, s, s);
    });
    this.drawTile('tnt_bottom', (ctx, x, y, s) => {
      ctx.fillStyle = '#CC3333';
      ctx.fillRect(x, y, s, s);
    });
    this.drawTile('tnt_side', (ctx, x, y, s) => {
      ctx.fillStyle = '#CC3333';
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#DDDDDD';
      ctx.fillRect(x, y + 4, s, 8);
      ctx.fillStyle = '#000000';
      ctx.font = '6px sans-serif';
      ctx.fillText('TNT', x + 3, y + 11);
    });

    // redstone wire
    this.drawTile('redstone_wire', (ctx, x, y, s) => {
      ctx.clearRect(x, y, s, s);
      ctx.fillStyle = '#CC0000';
      ctx.fillRect(x + 6, y + 2, 4, 12);
      ctx.fillRect(x + 2, y + 6, 12, 4);
    });

    // repeater
    this.drawTile('repeater', (ctx, x, y, s) => {
      ctx.fillStyle = '#888888';
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#CC0000';
      ctx.fillRect(x + 4, y + 4, 8, 8);
      ctx.fillStyle = '#AAAAAA';
      ctx.fillRect(x + 2, y + 7, 12, 2);
    });

    // lever
    this.drawTile('lever', (ctx, x, y, s) => {
      ctx.clearRect(x, y, s, s);
      ctx.fillStyle = '#666666';
      ctx.fillRect(x + 7, y + 4, 2, 8);
      ctx.fillStyle = '#AAAAAA';
      ctx.fillRect(x + 6, y + 2, 4, 4);
    });

    // obsidian
    this.drawTile('obsidian', (ctx, x, y, s) => {
      ctx.fillStyle = '#1B0B2E';
      ctx.fillRect(x, y, s, s);
      for (let i = 0; i < 20; i++) {
        const px = x + Math.random() * s;
        const py = y + Math.random() * s;
        const c = 20 + Math.random() * 40 | 0;
        ctx.fillStyle = `rgb(${c + 10},${c},${c + 20})`;
        ctx.fillRect(px | 0, py | 0, 2, 2);
      }
      ctx.strokeStyle = '#3D1F6B';
      ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
    });

    // portal
    this.drawTile('portal', (ctx, x, y, s) => {
      ctx.clearRect(x, y, s, s);
      ctx.fillStyle = 'rgba(74, 20, 140, 0.7)';
      ctx.fillRect(x, y, s, s);
      
      ctx.fillStyle = 'rgba(233, 30, 99, 0.4)';
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(x + Math.floor(Math.random() * s), y, 2, s);
        ctx.fillRect(x, y + Math.floor(Math.random() * s), s, 2);
      }
      
      for (let i = 0; i < 12; i++) {
        const px = x + Math.random() * s;
        const py = y + Math.random() * s;
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(186, 104, 200, 0.7)' : 'rgba(224, 64, 251, 0.7)';
        ctx.fillRect(px | 0, py | 0, 2, 2);
      }
    });

    this.drawTile('end_portal_frame', (ctx, x, y, s) => {
      ctx.fillStyle = '#6f8062';
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#9dad89';
      ctx.fillRect(x + 2, y + 2, s - 4, s - 4);
      ctx.fillStyle = '#526047';
      ctx.fillRect(x + 1, y + 1, s - 2, 2);
      ctx.fillRect(x + 1, y + s - 3, s - 2, 2);
      ctx.fillRect(x + 1, y + 1, 2, s - 2);
      ctx.fillRect(x + s - 3, y + 1, 2, s - 2);
      ctx.fillStyle = '#133f38';
      ctx.fillRect(x + 5, y + 5, 6, 6);
      ctx.fillStyle = '#45c8a3';
      ctx.fillRect(x + 6, y + 6, 4, 4);
      ctx.fillStyle = '#d8ffd0';
      ctx.fillRect(x + 7, y + 7, 2, 1);
    });

    // netherrack
    this.drawTile('netherrack', (ctx, x, y, s) => {
      ctx.fillStyle = '#501414';
      ctx.fillRect(x, y, s, s);
      for (let i = 0; i < 30; i++) {
        const px = x + Math.floor(Math.random() * s);
        const py = y + Math.floor(Math.random() * s);
        const size = Math.random() > 0.7 ? 2 : 1;
        ctx.fillStyle = Math.random() > 0.5 ? '#300808' : '#702020';
        ctx.fillRect(px, py, size, size);
      }
    });

    // soul_sand
    this.drawTile('soul_sand', (ctx, x, y, s) => {
      ctx.fillStyle = '#44332c';
      ctx.fillRect(x, y, s, s);
      for (let i = 0; i < 4; i++) {
        const px = x + Math.floor(Math.random() * (s - 4));
        const py = y + Math.floor(Math.random() * (s - 4));
        ctx.fillStyle = '#2b1e19';
        ctx.fillRect(px, py, 1, 1);
        ctx.fillRect(px + 2, py, 1, 1);
        ctx.fillRect(px + 1, py + 2, 1, 1);
      }
      for (let i = 0; i < 20; i++) {
        const px = x + Math.floor(Math.random() * s);
        const py = y + Math.floor(Math.random() * s);
        ctx.fillStyle = Math.random() > 0.5 ? '#2b1e19' : '#5a463d';
        ctx.fillRect(px, py, 1, 1);
      }
    });

    // glowstone
    this.drawTile('glowstone', (ctx, x, y, s) => {
      ctx.fillStyle = '#e4b75a';
      ctx.fillRect(x, y, s, s);
      ctx.strokeStyle = '#8d5b24';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
      for (let i = 0; i < 12; i++) {
        const px = x + Math.floor(Math.random() * (s - 2)) + 1;
        const py = y + Math.floor(Math.random() * (s - 2)) + 1;
        ctx.fillStyle = '#fffa8d';
        ctx.fillRect(px, py, 2, 2);
      }
    });

    // nether_brick
    this.drawTile('nether_brick', (ctx, x, y, s) => {
      ctx.fillStyle = '#2c151b';
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#15080c';
      ctx.fillRect(x, y + s / 4, s, 1);
      ctx.fillRect(x, y + s / 2, s, 1);
      ctx.fillRect(x, y + 3 * s / 4, s, 1);
      ctx.fillRect(x + s / 2, y, 1, s / 4);
      ctx.fillRect(x + s / 4, y + s / 4, 1, s / 4);
      ctx.fillRect(x + 3 * s / 4, y + s / 4, 1, s / 4);
      ctx.fillRect(x + s / 2, y + s / 2, 1, s / 4);
      ctx.fillRect(x + s / 4, y + 3 * s / 4, 1, s / 4);
      ctx.fillRect(x + 3 * s / 4, y + 3 * s / 4, 1, s / 4);
      for (let i = 0; i < 5; i++) {
        const px = x + Math.floor(Math.random() * s);
        const py = y + Math.floor(Math.random() * s);
        ctx.fillStyle = '#42242c';
        ctx.fillRect(px, py, 1, 1);
      }
    });

    // nether_wart
    this.drawTile('nether_wart', (ctx, x, y, s) => {
      ctx.clearRect(x, y, s, s);
      ctx.fillStyle = '#a01010';
      ctx.fillRect(x + 2, y + s - 6, 2, 4);
      ctx.fillStyle = '#500000';
      ctx.fillRect(x + 2, y + s - 2, 2, 2);
      ctx.fillStyle = '#a01010';
      ctx.fillRect(x + 6, y + s - 8, 3, 5);
      ctx.fillStyle = '#500000';
      ctx.fillRect(x + 6, y + s - 3, 3, 3);
      ctx.fillStyle = '#a01010';
      ctx.fillRect(x + 11, y + s - 6, 2, 4);
      ctx.fillStyle = '#500000';
      ctx.fillRect(x + 11, y + s - 2, 2, 2);
    });

    // quartz_ore
    this.drawTile('quartz_ore', (ctx, x, y, s) => {
      ctx.fillStyle = '#501414';
      ctx.fillRect(x, y, s, s);
      for (let i = 0; i < 15; i++) {
        const px = x + Math.floor(Math.random() * s);
        const py = y + Math.floor(Math.random() * s);
        ctx.fillStyle = '#300808';
        ctx.fillRect(px, py, 1, 1);
      }
      ctx.fillStyle = '#eaeaea';
      ctx.fillRect(x + 2, y + 2, 3, 2);
      ctx.fillRect(x + 5, y + 4, 2, 3);
      ctx.fillRect(x + 7, y + 7, 3, 2);
      ctx.fillRect(x + 10, y + 9, 2, 3);
      ctx.fillStyle = '#ffd8e8';
      ctx.fillRect(x + 1, y + 3, 1, 1);
      ctx.fillRect(x + 4, y + 3, 1, 1);
      ctx.fillRect(x + 7, y + 6, 1, 1);
      ctx.fillRect(x + 12, y + 10, 1, 1);
    });

    // ─── Materials ───
    // stick
    this.drawTile('stick', (ctx, x, y, s) => {
      ctx.clearRect(x, y, s, s);
      ctx.strokeStyle = '#8B5A2B';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 3, y + s - 3);
      ctx.lineTo(x + s - 3, y + 3);
      ctx.stroke();
    });

    // coal
    this.drawTile('coal', (ctx, x, y, s) => {
      ctx.clearRect(x, y, s, s);
      ctx.fillStyle = '#222222';
      ctx.beginPath();
      ctx.moveTo(x + 4, y + 4);
      ctx.lineTo(x + s - 4, y + 6);
      ctx.lineTo(x + s - 3, y + s - 5);
      ctx.lineTo(x + 5, y + s - 4);
      ctx.closePath();
      ctx.fill();
    });

    // ingot helper
    const drawIngot = (key: string, color: string, shadow: string) => {
      this.drawTile(key, (ctx, x, y, s) => {
        ctx.clearRect(x, y, s, s);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x + 3, y + s - 6);
        ctx.lineTo(x + s - 6, y + 3);
        ctx.lineTo(x + s - 3, y + 6);
        ctx.lineTo(x + 6, y + s - 3);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = shadow;
        ctx.fillRect(x + 4, y + s - 5, 2, 2);
      });
    };
    drawIngot('iron_ingot', '#D8D8D8', '#B0B0B0');
    drawIngot('gold_ingot', '#FFD700', '#CC9900');
    drawIngot('iron_nugget', '#D8D8D8', '#B0B0B0'); // simplified nugget using ingot shape
    drawIngot('gold_nugget', '#FFD700', '#CC9900');

    // diamond
    this.drawTile('diamond', (ctx, x, y, s) => {
      ctx.clearRect(x, y, s, s);
      ctx.fillStyle = '#5DECF5';
      ctx.beginPath();
      ctx.moveTo(x + s/2, y + 2);
      ctx.lineTo(x + s - 3, y + 6);
      ctx.lineTo(x + s/2, y + s - 2);
      ctx.lineTo(x + 3, y + 6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#FFF';
      ctx.fillRect(x + s/2 - 1, y + 4, 2, 2);
    });

    // redstone dust
    this.drawTile('redstone', (ctx, x, y, s) => {
      ctx.clearRect(x, y, s, s);
      ctx.fillStyle = '#FF2220';
      ctx.fillRect(x + 4, y + 6, 2, 2);
      ctx.fillRect(x + 10, y + 8, 2, 2);
      ctx.fillRect(x + 7, y + 11, 2, 2);
      ctx.fillStyle = '#990000';
      ctx.fillRect(x + 7, y + 5, 2, 2);
      ctx.fillRect(x + 3, y + 10, 2, 2);
    });

    // lapis
    this.drawTile('lapis', (ctx, x, y, s) => {
      ctx.clearRect(x, y, s, s);
      ctx.fillStyle = '#3344CC';
      ctx.beginPath();
      ctx.moveTo(x + s/2, y + 3);
      ctx.lineTo(x + s - 4, y + 10);
      ctx.lineTo(x + s/2, y + s - 3);
      ctx.lineTo(x + 4, y + 10);
      ctx.closePath();
      ctx.fill();
    });

    // string
    this.drawTile('string', (ctx, x, y, s) => {
      ctx.clearRect(x, y, s, s);
      ctx.strokeStyle = '#E2E2E2';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 2, y + 2);
      ctx.quadraticCurveTo(x + s - 2, y + 6, x + 3, y + s - 3);
      ctx.stroke();
    });

    // flint
    this.drawTile('flint', (ctx, x, y, s) => {
      ctx.clearRect(x, y, s, s);
      ctx.fillStyle = '#444444';
      ctx.beginPath();
      ctx.moveTo(x + 5, y + 11);
      ctx.lineTo(x + 11, y + 4);
      ctx.lineTo(x + 12, y + 10);
      ctx.closePath();
      ctx.fill();
    });

    // feather
    this.drawTile('feather', (ctx, x, y, s) => {
      ctx.clearRect(x, y, s, s);
      // Quill (darker grey shaft)
      ctx.strokeStyle = '#A0A0A0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 2, y + 13);
      ctx.lineTo(x + 13, y + 2);
      ctx.stroke();

      // White barbs along the shaft
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x + 4, y + 10, 2, 2);
      ctx.fillRect(x + 6, y + 8, 2, 2);
      ctx.fillRect(x + 8, y + 6, 2, 2);
      ctx.fillRect(x + 10, y + 4, 2, 2);
      ctx.fillRect(x + 12, y + 2, 2, 2);

      // Light gray details/shadows for depth
      ctx.fillStyle = '#E5E5E5';
      ctx.fillRect(x + 3, y + 11, 2, 2);
      ctx.fillRect(x + 5, y + 9, 2, 2);
      ctx.fillRect(x + 7, y + 7, 2, 2);
      ctx.fillRect(x + 9, y + 5, 2, 2);
      ctx.fillRect(x + 11, y + 3, 2, 2);
    });

    // paper
    this.drawTile('paper', (ctx, x, y, s) => {
      ctx.clearRect(x, y, s, s);
      ctx.fillStyle = '#EEEEEE';
      ctx.fillRect(x + 3, y + 3, s - 6, s - 6);
      ctx.fillStyle = '#CCCCCC';
      ctx.fillRect(x + 4, y + 5, s - 8, 1);
      ctx.fillRect(x + 4, y + 9, s - 8, 1);
    });

    // book
    this.drawTile('book', (ctx, x, y, s) => {
      ctx.clearRect(x, y, s, s);
      ctx.fillStyle = '#8B2500'; // brown/red cover
      ctx.fillRect(x + 3, y + 2, s - 6, s - 4);
      ctx.fillStyle = '#EEEEEE'; // pages
      ctx.fillRect(x + 4, y + 3, s - 8, s - 6);
    });

    // wheat
    this.drawTile('wheat', (ctx, x, y, s) => {
      ctx.clearRect(x, y, s, s);
      ctx.fillStyle = '#EEDD66';
      ctx.fillRect(x + 7, y + 3, 2, 10);
      ctx.fillStyle = '#CCAA33';
      ctx.fillRect(x + 5, y + 5, 6, 2);
      ctx.fillRect(x + 4, y + 8, 8, 2);
    });

    // seeds
    this.drawTile('seeds', (ctx, x, y, s) => {
      ctx.clearRect(x, y, s, s);
      ctx.fillStyle = '#77AA44';
      ctx.fillRect(x + 4, y + 9, 2, 2);
      ctx.fillRect(x + 7, y + 6, 2, 2);
      ctx.fillRect(x + 10, y + 10, 2, 2);
    });

    // bucket
    this.drawTile('bucket', (ctx, x, y, s) => {
      ctx.clearRect(x, y, s, s);
      ctx.strokeStyle = '#D8D8D8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + 4, y + 4);
      ctx.lineTo(x + s - 5, y + 4);
      ctx.lineTo(x + s - 6, y + s - 4);
      ctx.lineTo(x + 5, y + s - 4);
      ctx.closePath();
      ctx.stroke();
    });

    // ─── Food ───
    // apple
    this.drawTile('apple', (ctx, x, y, s) => {
      ctx.clearRect(x, y, s, s);
      ctx.fillStyle = '#E22';
      ctx.beginPath();
      ctx.arc(x + s/2, y + s/2 + 1, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8B5A2B';
      ctx.fillRect(x + s/2 - 1, y + 2, 1, 3);
    });

    // bread
    this.drawTile('bread', (ctx, x, y, s) => {
      ctx.clearRect(x, y, s, s);
      ctx.fillStyle = '#D2B48C';
      ctx.fillRect(x + 2, y + 5, s - 4, s - 10);
      ctx.fillStyle = '#CD853F';
      ctx.fillRect(x + 4, y + 6, 2, 4);
      ctx.fillRect(x + 10, y + 6, 2, 4);
    });

    // steak (cooked beef)
    this.drawTile('cooked_beef', (ctx, x, y, s) => {
      ctx.clearRect(x, y, s, s);
      ctx.fillStyle = '#5C2E2B';
      ctx.fillRect(x + 3, y + 4, s - 6, s - 8);
      ctx.fillStyle = '#A04040';
      ctx.fillRect(x + 5, y + 6, s - 10, s - 12);
    });

    // raw beef
    this.drawTile('raw_beef', (ctx, x, y, s) => {
      ctx.clearRect(x, y, s, s);
      ctx.fillStyle = '#C83232';
      ctx.fillRect(x + 3, y + 4, s - 6, s - 8);
      ctx.fillStyle = '#FFF';
      ctx.fillRect(x + 4, y + 6, 2, 4);
    });

    // raw porkchop
    this.drawTile('raw_porkchop', (ctx, x, y, s) => {
      ctx.clearRect(x, y, s, s);
      ctx.fillStyle = '#FF9999';
      ctx.fillRect(x + 3, y + 4, s - 6, s - 8);
    });

    // cooked porkchop
    this.drawTile('cooked_porkchop', (ctx, x, y, s) => {
      ctx.clearRect(x, y, s, s);
      ctx.fillStyle = '#C68E65';
      ctx.fillRect(x + 3, y + 4, s - 6, s - 8);
    });

    // ─── Tools Helper ───
    const matColors: Record<string, string> = {
      wood: '#8B4513', stone: '#777777', iron: '#E8E8E8', gold: '#FFD700', diamond: '#5DECF5'
    };

    const drawTool = (key: string, type: 'sword'|'pickaxe'|'shovel'|'axe'|'hoe'|'spear', material: string) => {
      this.drawTile(key, (ctx, x, y, s) => {
        ctx.clearRect(x, y, s, s);
        const color = matColors[material] ?? '#FFF';

        // Handle (brown diagonal)
        ctx.strokeStyle = '#5A3A1A';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + 3, y + s - 3);
        ctx.lineTo(x + s/2 + 1, y + s/2 - 1);
        ctx.stroke();

        ctx.fillStyle = color;
      if (type === 'sword' || type === 'spear') {
          // Sword blade
          ctx.beginPath();
          ctx.moveTo(x + s/2 - 1, y + s/2 + 1);
          ctx.lineTo(x + s - 3, y + 3);
          ctx.lineTo(x + s - 4, y + 2);
          ctx.lineTo(x + s/2 - 2, y + s/2);
          ctx.closePath();
          ctx.fill();
          // guard
          ctx.fillStyle = '#333';
          ctx.fillRect(x + 4, y + s - 7, 3, 3);
      } else if (type === 'pickaxe' || type === 'hoe') {
          // Pickaxe head
          ctx.beginPath();
          ctx.moveTo(x + s/2 - 5, y + 3);
          ctx.quadraticCurveTo(x + s - 2, y + 2, x + s - 3, y + s/2 + 3);
          ctx.lineTo(x + s - 5, y + s/2 + 1);
          ctx.quadraticCurveTo(x + s/2 + 1, y + 5, x + s/2 - 4, y + 5);
          ctx.closePath();
          ctx.fill();
        } else if (type === 'shovel') {
          // Shovel head
          ctx.fillRect(x + s/2 + 1, y + 3, 4, 4);
        } else if (type === 'axe') {
          // Axe head
          ctx.fillRect(x + s/2, y + 3, 5, 4);
          ctx.fillRect(x + s/2 + 2, y + 7, 2, 2);
        }
      });
    };

    // Register all tools
    for (const mat of ['wood', 'stone', 'iron', 'gold', 'diamond']) {
      const prefix = mat === 'gold' ? 'golden' : mat === 'wood' ? 'wooden' : mat;
      drawTool(`${prefix}_sword`, 'sword', mat);
      drawTool(`${prefix}_pickaxe`, 'pickaxe', mat);
      drawTool(`${prefix}_shovel`, 'shovel', mat);
      drawTool(`${prefix}_axe`, 'axe', mat);
    }

    // ─── Armor Helper ───
    const drawArmor = (key: string, slot: 'helmet'|'chestplate'|'leggings'|'boots', material: string) => {
      this.drawTile(key, (ctx, x, y, s) => {
        ctx.clearRect(x, y, s, s);
        const color = matColors[material] ?? '#FFF';
        ctx.fillStyle = color;

        if (slot === 'helmet') {
          ctx.fillRect(x + 4, y + 3, s - 8, 4);
          ctx.fillRect(x + 4, y + 7, 2, 4);
          ctx.fillRect(x + s - 6, y + 7, 2, 4);
        } else if (slot === 'chestplate') {
          ctx.fillRect(x + 3, y + 3, s - 6, 8);
          ctx.clearRect(x + 6, y + 3, 4, 2); // neck cutout
        } else if (slot === 'leggings') {
          ctx.fillRect(x + 4, y + 3, s - 8, 9);
          ctx.clearRect(x + 7, y + 6, 2, 6); // leg split
        } else if (slot === 'boots') {
          ctx.fillRect(x + 3, y + 5, 3, 6);
          ctx.fillRect(x + s - 6, y + 5, 3, 6);
        }
      });
    };

    for (const mat of ['iron', 'diamond']) {
      drawArmor(`${mat}_helmet`, 'helmet', mat);
      drawArmor(`${mat}_chestplate`, 'chestplate', mat);
      drawArmor(`${mat}_leggings`, 'leggings', mat);
      drawArmor(`${mat}_boots`, 'boots', mat);
    }

    // ─── 3D Block Icons Generator ───
    const drawBlockIcon = (key: string, topColor: string, leftColor: string, rightColor: string, drawOverlay?: (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => void) => {
      this.drawTile(`${key}_icon`, (ctx, x, y, s) => {
        ctx.clearRect(x, y, s, s);

        // Draw top face (rhombus)
        ctx.beginPath();
        ctx.moveTo(x + 8, y + 1);
        ctx.lineTo(x + 14, y + 4);
        ctx.lineTo(x + 8, y + 7);
        ctx.lineTo(x + 2, y + 4);
        ctx.closePath();
        ctx.fillStyle = topColor;
        ctx.fill();

        // Draw left face
        ctx.beginPath();
        ctx.moveTo(x + 2, y + 4);
        ctx.lineTo(x + 8, y + 7);
        ctx.lineTo(x + 8, y + 14);
        ctx.lineTo(x + 2, y + 11);
        ctx.closePath();
        ctx.fillStyle = leftColor;
        ctx.fill();

        // Draw right face
        ctx.beginPath();
        ctx.moveTo(x + 8, y + 7);
        ctx.lineTo(x + 14, y + 4);
        ctx.lineTo(x + 14, y + 11);
        ctx.lineTo(x + 8, y + 14);
        ctx.closePath();
        ctx.fillStyle = rightColor;
        ctx.fill();

        if (drawOverlay) {
          drawOverlay(ctx, x, y, s);
        }
      });
    };

    const drawFluidIcon = (key: string, color: string, ripple: string) => {
      this.drawTile(`${key}_icon`, (ctx, x, y, s) => {
        ctx.clearRect(x, y, s, s);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x + 8, y + 2);
        ctx.lineTo(x + 14, y + 5);
        ctx.lineTo(x + 14, y + 11);
        ctx.lineTo(x + 8, y + 14);
        ctx.lineTo(x + 2, y + 11);
        ctx.lineTo(x + 2, y + 5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = ripple;
        ctx.fillRect(x + 4, y + 6, 5, 1);
        ctx.fillRect(x + 8, y + 9, 4, 1);
        ctx.fillRect(x + 5, y + 12, 6, 1);
      });
    };

    // Solid blocks
    drawBlockIcon('stone', '#909090', '#7a7a7a', '#686868');
    drawBlockIcon('dirt', '#8f6547', '#7b573d', '#684a34');
    drawBlockIcon('grass_block', '#5e8f33', '#7b573d', '#684a34', (ctx, x, y, s) => {
      // Draw hanging grass overlay
      ctx.fillStyle = '#5e8f33';
      ctx.beginPath();
      ctx.moveTo(x + 2, y + 4);
      ctx.lineTo(x + 8, y + 7);
      ctx.lineTo(x + 8, y + 9);
      ctx.lineTo(x + 6, y + 8);
      ctx.lineTo(x + 5, y + 9);
      ctx.lineTo(x + 4, y + 8);
      ctx.lineTo(x + 2, y + 6);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(x + 8, y + 7);
      ctx.lineTo(x + 14, y + 4);
      ctx.lineTo(x + 14, y + 6);
      ctx.lineTo(x + 12, y + 8);
      ctx.lineTo(x + 11, y + 9);
      ctx.lineTo(x + 10, y + 8);
      ctx.lineTo(x + 8, y + 9);
      ctx.closePath();
      ctx.fill();
    });

    drawBlockIcon('cobblestone', '#888888', '#737373', '#626262', (ctx, x, y, s) => {
      // Cracks
      ctx.fillStyle = '#444444';
      ctx.fillRect(x + 5, y + 3, 2, 1);
      ctx.fillRect(x + 9, y + 4, 1, 1);
      ctx.fillRect(x + 3, y + 7, 2, 1);
      ctx.fillRect(x + 5, y + 10, 1, 2);
      ctx.fillRect(x + 10, y + 8, 2, 1);
      ctx.fillRect(x + 12, y + 6, 1, 2);
    });

    drawBlockIcon('oak_planks', '#c49a65', '#a88354', '#8e6e44', (ctx, x, y, s) => {
      ctx.strokeStyle = '#614324';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 2, y + 7.5);
      ctx.lineTo(x + 8, y + 10.5);
      ctx.moveTo(x + 2, y + 9.5);
      ctx.lineTo(x + 8, y + 12.5);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x + 8, y + 10.5);
      ctx.lineTo(x + 14, y + 7.5);
      ctx.moveTo(x + 8, y + 12.5);
      ctx.lineTo(x + 14, y + 9.5);
      ctx.stroke();
    });

    drawBlockIcon('oak_log', '#d3b283', '#7d5e3c', '#664c30', (ctx, x, y, s) => {
      ctx.strokeStyle = '#7d5e3c';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 8, y + 3);
      ctx.lineTo(x + 11, y + 4.5);
      ctx.lineTo(x + 8, y + 6);
      ctx.lineTo(x + 5, y + 4.5);
      ctx.closePath();
      ctx.stroke();
    });

    drawBlockIcon('oak_leaves', '#407020', '#35601a', '#2c5015');
    drawBlockIcon('spruce_planks', '#6b4226', '#57351f', '#452a19');
    drawBlockIcon('birch_planks', '#d4c49a', '#b8a77f', '#9f8e68');
    drawBlockIcon('jungle_planks', '#a8794b', '#8d643e', '#735132');
    drawBlockIcon('acacia_planks', '#ba6338', '#9f522e', '#854427');
    drawBlockIcon('dark_oak_planks', '#4c321f', '#3a2518', '#2b1a11');
    drawBlockIcon('spruce_log', '#6b4226', '#4a2e1a', '#382314');
    drawBlockIcon('birch_log', '#e4d8aa', '#d7cfaa', '#bfb58e');
    drawBlockIcon('jungle_log', '#9b6b3b', '#6f4d2e', '#5a3d24');
    drawBlockIcon('acacia_log', '#ba6338', '#7c4b38', '#62392b');
    drawBlockIcon('dark_oak_log', '#4c321f', '#3a2518', '#2b1a11');
    drawBlockIcon('spruce_leaves', '#2f5a22', '#264a1c', '#1e3b16');
    drawBlockIcon('birch_leaves', '#6fa533', '#5b8a2a', '#4a7022');
    drawBlockIcon('jungle_leaves', '#2f7d3a', '#286a31', '#205527');
    drawBlockIcon('acacia_leaves', '#4d8a24', '#3f711d', '#325b18');
    drawBlockIcon('dark_oak_leaves', '#254f18', '#1d3f13', '#16300e');
    drawFluidIcon('water', 'rgba(55, 125, 238, 0.82)', 'rgba(170, 210, 255, 0.45)');
    drawFluidIcon('flowing_water', 'rgba(55, 125, 238, 0.82)', 'rgba(170, 210, 255, 0.45)');
    drawFluidIcon('lava', 'rgba(220, 82, 16, 0.95)', 'rgba(255, 210, 70, 0.7)');
    drawFluidIcon('flowing_lava', 'rgba(220, 82, 16, 0.95)', 'rgba(255, 210, 70, 0.7)');
    drawBlockIcon('sand', '#dec192', '#bf9e71', '#a18357');
    drawBlockIcon('gravel', '#998d8d', '#857878', '#706464');

    // Ores
    const drawOreIcon = (name: string, spotCol: string) => {
      drawBlockIcon(name, '#909090', '#7a7a7a', '#686868', (ctx, x, y, s) => {
        ctx.fillStyle = spotCol;
        ctx.fillRect(x + 5, y + 3, 2, 2);
        ctx.fillRect(x + 3, y + 8, 2, 2);
        ctx.fillRect(x + 10, y + 8, 2, 2);
      });
    };
    drawOreIcon('gold_ore', '#ffcc00');
    drawOreIcon('iron_ore', '#e2a97f');
    drawOreIcon('coal_ore', '#222222');
    drawOreIcon('diamond_ore', '#5decf5');

    drawBlockIcon('sandstone', '#dbc291', '#bf9e71', '#a18357');
    drawBlockIcon('white_wool', '#eeeeee', '#dddddd', '#cccccc');
    drawBlockIcon('gold_block', '#fede3a', '#dbbd27', '#bda014');
    drawBlockIcon('iron_block', '#e2e2e2', '#c2c2c2', '#a2a2a2');
    drawBlockIcon('diamond_block', '#6bf3f9', '#4dd2d8', '#2db2b8');
    drawBlockIcon('bricks', '#a0584c', '#8a483e', '#753930');
    drawBlockIcon('obsidian', '#1a0d2e', '#130922', '#0c0517');

    drawBlockIcon('bookshelf', '#c49a65', '#a88354', '#8e6e44', (ctx, x, y, s) => {
      ctx.fillStyle = '#b32b2b'; ctx.fillRect(x + 3, y + 7, 2, 3);
      ctx.fillStyle = '#2b78b3'; ctx.fillRect(x + 10, y + 6, 2, 3);
      ctx.fillStyle = '#51b32b'; ctx.fillRect(x + 5, y + 8, 2, 3);
    });

    drawBlockIcon('tnt', '#e63222', '#c72418', '#a81c10', (ctx, x, y, s) => {
      ctx.fillStyle = '#eeeeee';
      ctx.beginPath();
      ctx.moveTo(x + 2, y + 7);
      ctx.lineTo(x + 8, y + 10);
      ctx.lineTo(x + 8, y + 12);
      ctx.lineTo(x + 2, y + 9);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(x + 8, y + 10);
      ctx.lineTo(x + 14, y + 7);
      ctx.lineTo(x + 14, y + 9);
      ctx.lineTo(x + 8, y + 12);
      ctx.closePath();
      ctx.fill();
    });

    drawBlockIcon('crafting_table', '#b58550', '#835a34', '#664525');
    drawBlockIcon('furnace', '#6b6b6b', '#5c5c5c', '#4d4d4d', (ctx, x, y, s) => {
      ctx.fillStyle = '#222222';
      ctx.beginPath();
      ctx.moveTo(x + 3, y + 8);
      ctx.lineTo(x + 7, y + 10);
      ctx.lineTo(x + 7, y + 13);
      ctx.lineTo(x + 3, y + 11);
      ctx.closePath();
      ctx.fill();
    });

    drawBlockIcon('glass', 'rgba(230, 245, 255, 0.4)', 'rgba(200, 230, 255, 0.3)', 'rgba(180, 210, 255, 0.25)', (ctx, x, y, s) => {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 5, y + 3); ctx.lineTo(x + 7, y + 4);
      ctx.moveTo(x + 3, y + 7); ctx.lineTo(x + 5, y + 8);
      ctx.stroke();
    });

    drawBlockIcon('snow_block', '#ffffff', '#f0f4f8', '#e2ebf4');
    drawBlockIcon('ice', 'rgba(150, 220, 255, 0.7)', 'rgba(130, 200, 255, 0.6)', 'rgba(110, 180, 255, 0.5)');
    drawBlockIcon('clay', '#a0a7b5', '#8f95a3', '#7e8391');
    drawBlockIcon('chest', '#bf7f30', '#a16520', '#855014', (ctx, x, y, s) => {
      ctx.fillStyle = '#dddddd';
      ctx.fillRect(x + 7, y + 7, 2, 2);
    });

    drawBlockIcon('piston', '#a88354', '#777777', '#626262', (ctx, x, y, s) => {
      ctx.fillStyle = '#a88354';
      ctx.beginPath();
      ctx.moveTo(x + 8, y + 1);
      ctx.lineTo(x + 14, y + 4);
      ctx.lineTo(x + 8, y + 7);
      ctx.lineTo(x + 2, y + 4);
      ctx.closePath();
      ctx.fill();
    });

    // ─── Biome specific blocks (mycelium, mushroom blocks, red sand, clay colors, plants) ───

    // mycelium top
    this.drawTile('mycelium_top', (ctx, x, y, s) => {
      ctx.fillStyle = '#7a676a'; // purple-gray mycelium color
      ctx.fillRect(x, y, s, s);
      // add purple and gray speckles
      for (let i = 0; i < 40; i++) {
        const px = x + Math.random() * s;
        const py = y + Math.random() * s;
        ctx.fillStyle = Math.random() > 0.5 ? '#967b8a' : '#5c4e51';
        ctx.fillRect(px | 0, py | 0, 1, 1);
      }
    });

    // mycelium side
    this.drawTile('mycelium_side', (ctx, x, y, s) => {
      // dirt background
      ctx.fillStyle = '#8B6914';
      ctx.fillRect(x, y, s, s);
      // speckles
      for (let i = 0; i < 20; i++) {
        const px = x + Math.random() * s;
        const py = y + Math.random() * s;
        ctx.fillStyle = '#6e5110';
        ctx.fillRect(px | 0, py | 0, 1, 1);
      }
      // mycelium top border (similar to grass side)
      ctx.fillStyle = '#7a676a';
      ctx.fillRect(x, y, s, 3);
      for (let i = 0; i < s; i += 2) {
        const h = 1 + (i % 3);
        ctx.fillRect(x + i, y + 3, 1, h);
      }
    });

    // brown mushroom plant
    this.drawTile('brown_mushroom', (ctx, x, y, s) => {
      // stem
      ctx.fillStyle = '#dcd4b4';
      ctx.fillRect(x + 7, y + 6, 2, 10);
      // cap
      ctx.fillStyle = '#8e7055';
      ctx.fillRect(x + 4, y + 2, 8, 4);
      ctx.fillStyle = '#5c4735';
      ctx.fillRect(x + 5, y + 1, 6, 1);
    });

    // red mushroom plant
    this.drawTile('red_mushroom', (ctx, x, y, s) => {
      // stem
      ctx.fillStyle = '#f0ebe0';
      ctx.fillRect(x + 7, y + 6, 2, 10);
      // cap
      ctx.fillStyle = '#cd2a2a';
      ctx.fillRect(x + 4, y + 2, 8, 4);
      ctx.fillStyle = '#a01a1a';
      ctx.fillRect(x + 5, y + 1, 6, 1);
      // white spots
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 5, y + 3, 1, 1);
      ctx.fillRect(x + 9, y + 4, 1, 1);
      ctx.fillRect(x + 7, y + 2, 1, 1);
    });

    // brown mushroom block cap
    this.drawTile('brown_mushroom_block', (ctx, x, y, s) => {
      ctx.fillStyle = '#8e7055';
      ctx.fillRect(x, y, s, s);
      // spots
      ctx.fillStyle = '#bfa58f';
      for (let i = 0; i < 4; i++) {
        const px = x + ((i * 7) % s);
        const py = y + ((i * 11) % s);
        ctx.fillRect(px, py, 2, 2);
      }
    });

    // red mushroom block cap
    this.drawTile('red_mushroom_block', (ctx, x, y, s) => {
      ctx.fillStyle = '#cd2a2a';
      ctx.fillRect(x, y, s, s);
      // white spots
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 5; i++) {
        const px = x + ((i * 6 + 2) % s);
        const py = y + ((i * 9 + 4) % s);
        ctx.fillRect(px, py, 2, 2);
      }
    });

    // red sand
    this.drawTile('red_sand', (ctx, x, y, s) => {
      ctx.fillStyle = '#c06b38';
      ctx.fillRect(x, y, s, s);
      // grain
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      for (let i = 0; i < 25; i++) {
        const px = x + Math.random() * s;
        const py = y + Math.random() * s;
        ctx.fillRect(px | 0, py | 0, 1 + (i % 2), 1);
      }
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      for (let i = 0; i < 25; i++) {
        const px = x + Math.random() * s;
        const py = y + Math.random() * s;
        ctx.fillRect(px | 0, py | 0, 1 + (i % 2), 1);
      }
    });

    // waterlily
    this.drawTile('waterlily', (ctx, x, y, s) => {
      ctx.fillStyle = '#1f4e1f';
      ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
      // draw split in the lily pad
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(x + 7, y + 1, 2, 8);
      // veins
      ctx.strokeStyle = '#2d6a2d';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 3, y + 3); ctx.lineTo(x + 8, y + 8);
      ctx.moveTo(x + 13, y + 3); ctx.lineTo(x + 8, y + 8);
      ctx.moveTo(x + 8, y + 13); ctx.lineTo(x + 8, y + 8);
      ctx.stroke();
    });

    // vine
    this.drawTile('vine', (ctx, x, y, s) => {
      ctx.fillStyle = '#2d6d1d';
      // draw vine strands
      ctx.fillRect(x + 2, y, 1, s);
      ctx.fillRect(x + 6, y, 1, s);
      ctx.fillRect(x + 10, y, 1, s);
      ctx.fillRect(x + 13, y, 1, s);
      // leaves coming off strands
      for (let i = 0; i < s; i += 3) {
        ctx.fillRect(x + 1, y + i, 2, 1);
        ctx.fillRect(x + 5, y + i + 1, 2, 1);
        ctx.fillRect(x + 9, y + i + 2, 2, 1);
        ctx.fillRect(x + 12, y + i, 2, 1);
      }
    });

    // ladder
    this.drawTile('ladder', (ctx, x, y, s) => {
      ctx.clearRect(x, y, s, s);
      
      // Left and right vertical wood rails
      ctx.fillStyle = '#8B5A2B';
      ctx.fillRect(x + 2, y, 2, s);
      ctx.fillRect(x + 12, y, 2, s);
      
      ctx.fillStyle = '#BC9862'; // Highlight
      ctx.fillRect(x + 2, y, 1, s);
      ctx.fillRect(x + 12, y, 1, s);

      ctx.fillStyle = '#5C3A21'; // Shadow
      ctx.fillRect(x + 3, y, 1, s);
      ctx.fillRect(x + 13, y, 1, s);
      
      // Horizontal rungs
      for (let ry = 2; ry < s; ry += 3) {
        ctx.fillStyle = '#8B5A2B'; // Base rung
        ctx.fillRect(x + 4, y + ry, 8, 1);
        ctx.fillStyle = '#BC9862'; // Top highlight
        ctx.fillRect(x + 4, y + ry - 1, 8, 1);
        ctx.fillStyle = '#5C3A21'; // Bottom shadow
        ctx.fillRect(x + 4, y + ry + 1, 8, 1);
      }
    });

    // Hardened clay (Terracotta) variations
    const CLAY_COLORS: Record<string, string> = {
      'hardened_clay': '#985e46',
      'white_hardened_clay': '#d1b1a1',
      'orange_hardened_clay': '#a1532f',
      'magenta_hardened_clay': '#95586c',
      'light_blue_hardened_clay': '#716c89',
      'yellow_hardened_clay': '#ba8523',
      'lime_hardened_clay': '#677535',
      'pink_hardened_clay': '#a15453',
      'gray_hardened_clay': '#392f2c',
      'light_gray_hardened_clay': '#876a61',
      'cyan_hardened_clay': '#565c5e',
      'purple_hardened_clay': '#764656',
      'blue_hardened_clay': '#4a3a4e',
      'brown_hardened_clay': '#4d3324',
      'green_hardened_clay': '#49531d',
      'red_hardened_clay': '#8f3d2f',
      'black_hardened_clay': '#251715',
    };

    for (const [key, color] of Object.entries(CLAY_COLORS)) {
      this.drawTile(key, (ctx, x, y, s) => {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, s, s);
        // Add subtle clay grain
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        for (let i = 0; i < 20; i++) {
          const px = x + Math.random() * s;
          const py = y + Math.random() * s;
          ctx.fillRect(px | 0, py | 0, 1 + (i % 2), 1);
        }
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        for (let i = 0; i < 20; i++) {
          const px = x + Math.random() * s;
          const py = y + Math.random() * s;
          ctx.fillRect(px | 0, py | 0, 1 + (i % 2), 1);
        }
      });
    }

    // ─── Procedural Fallbacks for All Blocks & Items ───
    const hashColor = (str: string) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
      }
      const r = Math.min(220, Math.max(50, (hash & 0xFF0000) >> 16));
      const g = Math.min(220, Math.max(50, (hash & 0x00FF00) >> 8));
      const b = Math.min(220, Math.max(50, hash & 0x0000FF));
      return {
        r, g, b,
        hex: `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`,
        leftHex: `#${((1 << 24) + ((r * 0.8 | 0) << 16) + ((g * 0.8 | 0) << 8) + (b * 0.8 | 0)).toString(16).slice(1)}`,
        rightHex: `#${((1 << 24) + ((r * 0.65 | 0) << 16) + ((g * 0.65 | 0) << 8) + (b * 0.65 | 0)).toString(16).slice(1)}`
      };
    };

    const drawFallbackBlock = (key: string, name: string) => {
      const colors = hashColor(name);
      // Look up if this block is transparent in BlockRegistry
      const blockDef = BlockRegistry.getByName(name.replace(/(_top|_bottom|_side)$/, ''));
      const isTransparent = blockDef ? blockDef.transparent : false;
      
      this.drawTile(key, (ctx, x, y, s) => {
        if (isTransparent) {
          ctx.clearRect(x, y, s, s);
        } else {
          ctx.fillStyle = colors.hex;
          ctx.fillRect(x, y, s, s);
          
          // Add pixel noise
          ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
          for (let i = 0; i < 15; i++) {
            const px = x + ((Math.sin(i * 123.45) * 50 + 50) % s | 0);
            const py = y + ((Math.cos(i * 543.21) * 50 + 50) % s | 0);
            ctx.fillRect(px, py, 2, 2);
          }
          ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
          for (let i = 0; i < 15; i++) {
            const px = x + ((Math.cos(i * 987.65) * 50 + 50) % s | 0);
            const py = y + ((Math.sin(i * 234.56) * 50 + 50) % s | 0);
            ctx.fillRect(px, py, 2, 2);
          }
        }

        // Draw patterns based on name
        if (name.includes('glass') || name.includes('pane')) {
          ctx.clearRect(x, y, s, s);
          ctx.fillStyle = `rgba(${colors.r}, ${colors.g}, ${colors.b}, 0.25)`;
          ctx.fillRect(x, y, s, s);
          ctx.strokeStyle = `rgba(${colors.r}, ${colors.g}, ${colors.b}, 0.7)`;
          ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
          
          // Diagonal highlights
          ctx.strokeStyle = 'rgba(255,255,255,0.4)';
          ctx.beginPath();
          ctx.moveTo(x + 2, y + 2);
          ctx.lineTo(x + 6, y + 6);
          ctx.moveTo(x + s - 6, y + s - 6);
          ctx.lineTo(x + s - 2, y + s - 2);
          ctx.stroke();
        } else if (name.includes('leaves')) {
          ctx.clearRect(x, y, s, s);
          ctx.fillStyle = `rgb(${colors.r * 0.75 | 0}, ${colors.g * 0.9 | 0}, ${colors.b * 0.75 | 0})`;
          ctx.fillRect(x, y, s, s);
          // Draw leaf cutout pixels
          ctx.fillStyle = `rgb(${colors.r * 0.9 | 0}, ${colors.g | 0}, ${colors.b * 0.9 | 0})`;
          for (let i = 0; i < 30; i++) {
            const lx = x + Math.random() * s | 0;
            const ly = y + Math.random() * s | 0;
            ctx.fillRect(lx, ly, 2, 2);
          }
          // Cutouts (clear rects)
          ctx.fillStyle = 'rgba(0,0,0,0)';
          for (let i = 0; i < 15; i++) {
            const cx = x + Math.random() * s | 0;
            const cy = y + Math.random() * s | 0;
            ctx.clearRect(cx, cy, 1, 1);
          }
        } else if (name.includes('sapling') || name.includes('flower') || name.includes('rose') || name.includes('tulip') || name.includes('dandelion') || name.includes('orchid') || name.includes('allium') || name.includes('bluet') || name.includes('poppy') || name.includes('daisy') || name.includes('sunflower') || name.includes('lilac') || name.includes('peony') || name.includes('sprout') || name.includes('fern') || name.includes('shrub') || name.includes('grass')) {
          ctx.clearRect(x, y, s, s);
          // Draw stem
          ctx.fillStyle = '#4a7023';
          ctx.fillRect(x + 7, y + 6, 2, 10);
          ctx.fillRect(x + 5, y + 9, 4, 1);
          // Draw flower head/sapling leaves
          ctx.fillStyle = colors.hex;
          ctx.fillRect(x + 5, y + 3, 6, 3);
          ctx.fillRect(x + 6, y + 2, 4, 5);
          // Center of the flower
          ctx.fillStyle = '#ffeb3b';
          ctx.fillRect(x + 7, y + 4, 2, 2);
        } else if (name.includes('wool')) {
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
          ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
        } else if (name.includes('ore')) {
          ctx.fillStyle = '#888888';
          ctx.fillRect(x, y, s, s);
          ctx.fillStyle = colors.hex;
          ctx.fillRect(x + 4, y + 4, 3, 3);
          ctx.fillRect(x + 10, y + 6, 2, 2);
          ctx.fillRect(x + 5, y + 10, 2, 2);
        } else if (name.includes('planks') || name.includes('wood')) {
          // Plank horizontal lines
          ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
          ctx.fillRect(x, y + 4, s, 1);
          ctx.fillRect(x, y + 8, s, 1);
          ctx.fillRect(x, y + 12, s, 1);
          // Vertical joints
          ctx.fillRect(x + 5, y, 1, 4);
          ctx.fillRect(x + 11, y + 4, 1, 4);
          ctx.fillRect(x + 3, y + 8, 1, 4);
          ctx.fillRect(x + 9, y + 12, 1, 4);
        } else if (name.includes('log') || name.includes('stem')) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
          ctx.fillRect(x + 4, y, 1, s);
          ctx.fillRect(x + 12, y, 1, s);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.fillRect(x + 6, y, 2, s);
          ctx.fillRect(x + 14, y, 2, s);
        } else if (name.includes('concrete_powder')) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
          for (let i = 0; i < 30; i++) {
            ctx.fillRect(x + (Math.random() * s | 0), y + (Math.random() * s | 0), 1, 1);
          }
          ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
          for (let i = 0; i < 30; i++) {
            ctx.fillRect(x + (Math.random() * s | 0), y + (Math.random() * s | 0), 1, 1);
          }
        } else if (name.includes('concrete')) {
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
          ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
        } else if (name.includes('terracotta')) {
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
          ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
          ctx.fillRect(x + 1, y + 1, s - 2, 1);
          ctx.fillRect(x + 1, y + 2, 1, s - 3);
        } else if (name.includes('brick')) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
          ctx.fillRect(x, y + 3, s, 1);
          ctx.fillRect(x, y + 7, s, 1);
          ctx.fillRect(x, y + 11, s, 1);
          ctx.fillRect(x, y + 15, s, 1);
          ctx.fillRect(x + 4, y, 1, 3);
          ctx.fillRect(x + 12, y, 1, 3);
          ctx.fillRect(x + 8, y + 4, 1, 3);
          ctx.fillRect(x + 16, y + 4, 1, 3);
          ctx.fillRect(x + 4, y + 8, 1, 3);
          ctx.fillRect(x + 12, y + 8, 1, 3);
          ctx.fillRect(x + 8, y + 12, 1, 3);
          ctx.fillRect(x + 16, y + 12, 1, 3);
        } else if (name.includes('polished')) {
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
          ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.strokeRect(x + 1.5, y + 1.5, s - 3, s - 3);
        } else if (name.includes('pillar')) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
          ctx.fillRect(x + 3, y, 1, s);
          ctx.fillRect(x + s - 4, y, 1, s);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.fillRect(x + 4, y, 1, s);
          ctx.fillRect(x + s - 3, y, 1, s);
        } else if (name.includes('prismarine')) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
          ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
          for (let i = 2; i < s; i += 4) {
            ctx.fillRect(x + i, y + i, 2, 2);
          }
        } else if (name.includes('copper')) {
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
          ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
          ctx.fillRect(x + 2, y + 2, 1, 1);
          ctx.fillRect(x + s - 3, y + 2, 1, 1);
          ctx.fillRect(x + 2, y + s - 3, 1, 1);
          ctx.fillRect(x + s - 3, y + s - 3, 1, 1);
        } else if (name.includes('amethyst')) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
          ctx.fillRect(x + 3, y + 3, 4, 4);
          ctx.fillRect(x + 9, y + 9, 3, 3);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
          ctx.fillRect(x + 6, y + 6, 2, 2);
        } else if (name.includes('sandstone')) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
          ctx.fillRect(x, y + 4, s, 2);
          ctx.fillRect(x, y + 11, s, 2);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.fillRect(x, y + 6, s, 1);
          ctx.fillRect(x, y + 13, s, 1);
        }
      });
    };

    // Draw all block textures
    for (const b of BlockRegistry.all()) {
      const key = b.textureKey;
      if (!this.tileIndex.has(key)) {
        drawFallbackBlock(key, b.name);
      }
      if (b.textureTop && !this.tileIndex.has(b.textureTop)) {
        drawFallbackBlock(b.textureTop, b.name + '_top');
      }
      if (b.textureBottom && !this.tileIndex.has(b.textureBottom)) {
        drawFallbackBlock(b.textureBottom, b.name + '_bottom');
      }
      
      const iconKey = `${b.name}_icon`;
      if (!this.tileIndex.has(iconKey)) {
        const colors = VisualResolver.getIconColors(b.id);
        if (b.name.includes('ore')) {
          drawBlockIcon(b.name, '#909090', '#7a7a7a', '#686868', (ctx, ix, iy, is) => {
            ctx.fillStyle = colors.top;
            ctx.fillRect(ix + 5, iy + 3, 2, 2);
            ctx.fillRect(ix + 3, iy + 8, 2, 2);
            ctx.fillRect(ix + 10, iy + 8, 2, 2);
          });
        } else if (BlockRegistry.isFluid(b.id)) {
          const fluidColor = b.name.includes('lava') ? 'rgba(220, 82, 16, 0.95)' : 'rgba(55, 125, 238, 0.82)';
          const rippleColor = b.name.includes('lava') ? 'rgba(255, 210, 70, 0.7)' : 'rgba(170, 210, 255, 0.45)';
          drawFluidIcon(b.name, fluidColor, rippleColor);
        } else {
          drawBlockIcon(b.name, colors.top, colors.left, colors.right);
        }
      }
    }

    // Draw all item textures
    for (const item of ItemRegistry.all()) {
      const key = item.name;
      if (!this.tileIndex.has(key)) {
        if (item.category === 'tool' && item.toolType && item.toolMaterial) {
          const mat = item.toolMaterial === 'gold' ? 'gold' : item.toolMaterial;
          drawTool(key, item.toolType, mat);
        } else if (item.category === 'armor' && item.armorSlot) {
          const parts = item.name.split('_');
          const mat = parts[0] === 'gold' ? 'gold' : parts[0];
          drawArmor(key, item.armorSlot, mat);
        } else {
          // Draw generic item sprite with a semantic pixel silhouette.
          const colors = hashColor(item.name);
          this.drawTile(key, (ctx, x, y, s) => {
            ctx.clearRect(x, y, s, s);
            const name = item.name;
            ctx.fillStyle = colors.hex;

            if (name.includes('ingot')) {
              ctx.fillRect(x + 4, y + 5, 8, 5);
              ctx.fillStyle = 'rgba(255,255,255,0.35)';
              ctx.fillRect(x + 5, y + 5, 5, 1);
            } else if (name.includes('nugget') || name.includes('coal') || name.includes('diamond') || name.includes('lapis')) {
              ctx.fillRect(x + 6, y + 4, 4, 2);
              ctx.fillRect(x + 5, y + 6, 6, 4);
              ctx.fillRect(x + 6, y + 10, 4, 2);
              ctx.fillStyle = 'rgba(255,255,255,0.35)';
              ctx.fillRect(x + 6, y + 5, 2, 1);
            } else if (name.includes('seeds') || name.includes('dye') || name.includes('redstone')) {
              ctx.fillRect(x + 4, y + 9, 2, 2);
              ctx.fillRect(x + 7, y + 7, 2, 2);
              ctx.fillRect(x + 10, y + 10, 2, 2);
              ctx.fillRect(x + 6, y + 11, 2, 1);
            } else if (name.includes('door')) {
              ctx.fillRect(x + 5, y + 2, 7, 12);
              ctx.fillStyle = 'rgba(0,0,0,0.25)';
              ctx.fillRect(x + 6, y + 3, 2, 4);
              ctx.fillRect(x + 9, y + 3, 2, 4);
              ctx.fillRect(x + 6, y + 8, 2, 4);
              ctx.fillRect(x + 9, y + 8, 2, 4);
            } else if (name.includes('paper')) {
              ctx.fillStyle = '#F2F0D8';
              ctx.fillRect(x + 4, y + 2, 8, 12);
              ctx.fillStyle = '#D8D2AA';
              ctx.fillRect(x + 6, y + 5, 5, 1);
              ctx.fillRect(x + 6, y + 8, 4, 1);
            } else if (name.includes('book')) {
              ctx.fillStyle = '#7A3B22';
              ctx.fillRect(x + 3, y + 3, 10, 10);
              ctx.fillStyle = '#E8D8AA';
              ctx.fillRect(x + 5, y + 4, 6, 8);
            } else if (item.category === 'food' || name.includes('apple') || name.includes('bread')) {
              ctx.fillRect(x + 4, y + 5, 8, 6);
              ctx.fillRect(x + 5, y + 3, 5, 2);
              ctx.fillStyle = 'rgba(255,255,255,0.3)';
              ctx.fillRect(x + 5, y + 5, 3, 1);
            } else {
              ctx.fillRect(x + 5, y + 4, 6, 2);
              ctx.fillRect(x + 4, y + 6, 8, 5);
              ctx.fillRect(x + 5, y + 11, 6, 1);
              ctx.fillStyle = 'rgba(255,255,255,0.35)';
              ctx.fillRect(x + 6, y + 5, 3, 1);
            }
          });
        }
      }
    }

    for (const key of Array.from(this.tileIndex.keys())) {
      if (!key.includes(':')) {
        this.aliasTile(`block:${key}`, key);
        this.aliasTile(`item:${key}`, key);
      }
      if (key.endsWith('_icon')) {
        const baseKey = key.slice(0, -'_icon'.length);
        this.aliasTile(`icon:block:${baseKey}`, key);
        this.aliasTile(`icon:item:${baseKey}`, key);
      }
    }

    this.aliasTile('icon:block:grass', 'grass_block_icon');
    this.aliasTile('icon:block:log', 'oak_log_icon');
    this.aliasTile('icon:block:planks', 'oak_planks_icon');
    this.aliasTile('icon:block:leaves', 'oak_leaves_icon');

    // Rails
    this.drawTile('rail', (ctx, x, y, s) => {
      ctx.clearRect(x, y, s, s);
      ctx.fillStyle = '#5c4033';
      for (let i = 2; i < s; i += 4) {
        ctx.fillRect(x + 2, y + i, s - 4, 2);
      }
      ctx.fillStyle = '#aaaaaa';
      ctx.fillRect(x + 3, y, 2, s);
      ctx.fillRect(x + s - 5, y, 2, s);
    });

    this.drawTile('golden_rail', (ctx, x, y, s) => {
      ctx.clearRect(x, y, s, s);
      ctx.fillStyle = '#5c4033';
      for (let i = 2; i < s; i += 4) {
        ctx.fillRect(x + 2, y + i, s - 4, 2);
      }
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(x + 3, y, 2, s);
      ctx.fillRect(x + s - 5, y, 2, s);
      ctx.fillStyle = '#ff3333';
      ctx.fillRect(x + s / 2 - 1, y, 2, s);
    });

    this.drawTile('detector_rail', (ctx, x, y, s) => {
      ctx.clearRect(x, y, s, s);
      ctx.fillStyle = '#5c4033';
      for (let i = 2; i < s; i += 4) {
        ctx.fillRect(x + 2, y + i, s - 4, 2);
      }
      ctx.fillStyle = '#aaaaaa';
      ctx.fillRect(x + 3, y, 2, s);
      ctx.fillRect(x + s - 5, y, 2, s);
      ctx.fillStyle = '#555555';
      ctx.fillRect(x + 5, y + 5, s - 10, s - 10);
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(x + s / 2 - 1, y + s / 2 - 1, 2, 2);
    });

    this.drawTile('activator_rail', (ctx, x, y, s) => {
      ctx.clearRect(x, y, s, s);
      ctx.fillStyle = '#5c4033';
      for (let i = 2; i < s; i += 4) {
        ctx.fillRect(x + 2, y + i, s - 4, 2);
      }
      ctx.fillStyle = '#aaaaaa';
      ctx.fillRect(x + 3, y, 2, s);
      ctx.fillRect(x + s - 5, y, 2, s);
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(x + s / 2 - 1, y + 2, 2, s - 4);
    });

    // Vehicles
    this.drawTile('boat', (ctx, x, y, s) => {
      ctx.fillStyle = '#8B5A2B';
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#5C3317';
      ctx.fillRect(x, y, s, 2);
      ctx.fillRect(x, y, 2, s);
      ctx.fillRect(x, y + s - 2, s, 2);
      ctx.fillRect(x + s - 2, y, 2, s);
    });

    this.drawTile('minecart', (ctx, x, y, s) => {
      ctx.fillStyle = '#cccccc';
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#777777';
      ctx.fillRect(x, y, s, 2);
      ctx.fillRect(x, y, 2, s);
      ctx.fillRect(x, y + s - 2, s, 2);
      ctx.fillRect(x + s - 2, y, 2, s);
    });

    // Boat/Minecart Aliases
    this.aliasTile('oak_boat', 'boat');
    this.aliasTile('spruce_boat', 'boat');
    this.aliasTile('birch_boat', 'boat');
    this.aliasTile('jungle_boat', 'boat');
    this.aliasTile('acacia_boat', 'boat');
    this.aliasTile('dark_oak_boat', 'boat');
    this.aliasTile('cherry_boat', 'boat');
    this.aliasTile('mangrove_boat', 'boat');
    this.aliasTile('oak_chest_boat', 'boat');
    this.aliasTile('spruce_chest_boat', 'boat');
    this.aliasTile('birch_chest_boat', 'boat');
    this.aliasTile('jungle_chest_boat', 'boat');
    this.aliasTile('acacia_chest_boat', 'boat');
    this.aliasTile('dark_oak_chest_boat', 'boat');
    this.aliasTile('cherry_chest_boat', 'boat');
    this.aliasTile('mangrove_chest_boat', 'boat');
    this.aliasTile('chest_minecart', 'minecart');
    this.aliasTile('furnace_minecart', 'minecart');
    this.aliasTile('tnt_minecart', 'minecart');
    this.aliasTile('hopper_minecart', 'minecart');
    this.aliasTile('command_block_minecart', 'minecart');

    for (const block of BlockRegistry.all()) {
      const iconKey = VisualResolver.getBlockIconKey(block.id);
      const resolvedLegacy = this.resolveKey(iconKey);
      if (this.tileIndex.has(resolvedLegacy)) {
        this.aliasTile(`icon:block:${block.name}`, resolvedLegacy);
      }
    }
  }

  private drawOreTile(key: string, spotColor: string) {
    this.drawTile(key, (ctx, x, y, s) => {
      ctx.fillStyle = '#888888';
      ctx.fillRect(x, y, s, s);
      for (let i = 0; i < 20; i++) {
        const px = x + Math.random() * s;
        const py = y + Math.random() * s;
        const gr = 120 + Math.random() * 40 | 0;
        ctx.fillStyle = `rgb(${gr},${gr},${gr})`;
        ctx.fillRect(px | 0, py | 0, 2, 2);
      }
      for (let i = 0; i < 6; i++) {
        const px = x + 2 + Math.random() * (s - 4) | 0;
        const py = y + 2 + Math.random() * (s - 4) | 0;
        ctx.fillStyle = spotColor;
        ctx.fillRect(px, py, 2, 2);
      }
    });
  }
}
