import * as THREE from 'three';

const ATLAS_SIZE = 256;
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
    const idx = this.tileIndex.get(key);
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
    const idx = this.tileIndex.get(key);
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

  private allocateTile(key: string): number {
    if (this.tileIndex.has(key)) return this.tileIndex.get(key)!;
    const idx = this.nextIndex++;
    this.tileIndex.set(key, idx);
    return idx;
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
      // Vanilla-style water: bright blue, partially transparent, with blocky flowing streaks.
      ctx.fillStyle = 'rgba(63, 118, 228, 0.58)';
      ctx.fillRect(x, y, s, s);

      const light = 'rgba(109, 160, 255, 0.34)';
      const mid = 'rgba(73, 134, 238, 0.30)';
      const dark = 'rgba(33, 77, 174, 0.24)';

      ctx.fillStyle = light;
      ctx.fillRect(x + 1, y + 2, 6, 1);
      ctx.fillRect(x + 7, y + 3, 4, 1);
      ctx.fillRect(x + 12, y + 1, 2, 1);
      ctx.fillRect(x + 3, y + 9, 5, 1);
      ctx.fillRect(x + 8, y + 10, 4, 1);
      ctx.fillRect(x + 12, y + 13, 3, 1);

      ctx.fillStyle = mid;
      ctx.fillRect(x + 0, y + 5, 4, 1);
      ctx.fillRect(x + 4, y + 6, 5, 1);
      ctx.fillRect(x + 10, y + 7, 4, 1);
      ctx.fillRect(x + 1, y + 13, 5, 1);
      ctx.fillRect(x + 7, y + 14, 4, 1);

      ctx.fillStyle = dark;
      ctx.fillRect(x + 9, y + 0, 5, 1);
      ctx.fillRect(x + 12, y + 4, 3, 1);
      ctx.fillRect(x + 0, y + 11, 3, 1);
      ctx.fillRect(x + 5, y + 12, 6, 1);
      ctx.fillRect(x + 13, y + 9, 2, 1);
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

    const drawTool = (key: string, type: 'sword'|'pickaxe'|'shovel'|'axe', material: string) => {
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
        if (type === 'sword') {
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
        } else if (type === 'pickaxe') {
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
