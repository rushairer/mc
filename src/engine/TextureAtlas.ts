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
  }

  getTexture(): THREE.CanvasTexture {
    return this.texture;
  }

  getUV(key: string): { u0: number; v0: number; u1: number; v1: number } {
    const idx = this.tileIndex.get(key);
    if (idx === undefined) {
      return { u0: 0, v0: 0, u1: 1 / TILES_PER_ROW, v1: 1 / TILES_PER_ROW };
    }
    const col = idx % TILES_PER_ROW;
    const row = Math.floor(idx / TILES_PER_ROW);
    const s = 1 / TILES_PER_ROW;
    return {
      u0: col * s,
      v0: 1 - (row + 1) * s,
      u1: (col + 1) * s,
      v1: 1 - row * s,
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
      ctx.fillStyle = '#2B4FA8';
      ctx.fillRect(x, y, s, s);
      for (let i = 0; i < 8; i++) {
        const py = y + Math.random() * s | 0;
        ctx.fillStyle = '#3A6FD8';
        ctx.fillRect(x, py, s, 1);
      }
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
