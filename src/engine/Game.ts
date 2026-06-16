import * as THREE from 'three';
import { Renderer } from './Renderer';
import { InputManager } from './InputManager';
import { TextureAtlas } from './TextureAtlas';
import { ChunkManager } from '../world/ChunkManager';
import { Player } from '../player/Player';
import { Inventory } from '../player/Inventory';
import { BlockRegistry } from '../world/BlockRegistry';
import { ItemRegistry } from '../items/ItemRegistry';
import { SurvivalSystem } from '../systems/SurvivalSystem';
import { SaveSystem, type SaveData } from '../systems/SaveSystem';
import { CHUNK_SIZE } from '../constants';

export type UIType = 'none' | 'inventory' | 'furnace';

export interface GameState {
  fps: number;
  playerX: number;
  playerY: number;
  playerZ: number;
  biome: string;
  chunkCount: number;
  selectedBlock: string;
  selectedSlot: number;
  health: number;
  hunger: number;
  onGround: boolean;
  flying: boolean;
  openUI: UIType;
  inventory: Inventory;
  heldItemId: number;  // item ID in selected hotbar slot
}

export type GameStateListener = (state: GameState) => void;

const BIOME_NAMES = ['Plains', 'Desert', 'Mountains', 'Forest', 'Snow', 'Ocean'];

export class Game {
  renderer: Renderer;
  input: InputManager;
  private atlas: TextureAtlas;
  chunks: ChunkManager;
  player: Player;
  inventory: Inventory;
  private survival: SurvivalSystem;
  private clock: THREE.Clock;
  running = false;
  private stateListeners: GameStateListener[] = [];
  private targetBlock: { blockPos: THREE.Vector3; faceNormal: THREE.Vector3 } | null = null;
  private highlightMesh: THREE.LineSegments | null = null;
  private fpsFrames = 0;
  private fpsTime = 0;
  private currentFps = 0;
  private breakCooldown = 0;
  private placeCooldown = 0;
  openUI: UIType = 'none';
  private autoSaveTimer = 0;
  private breakProgress = 0;     // 0..1
  private breakingBlockPos: THREE.Vector3 | null = null;
  private lastFrameWasBreaking = false;
  private seed = 12345;

  constructor(container: HTMLElement) {
    this.renderer = new Renderer(container);
    this.input = new InputManager(this.renderer.renderer.domElement);
    this.atlas = new TextureAtlas();
    this.chunks = new ChunkManager(this.renderer.scene, this.atlas, this.seed);
    this.clock = new THREE.Clock();
    this.inventory = new Inventory();
    this.survival = new SurvivalSystem();

    // Default hotbar items
    this.inventory.setSlot(0, { id: 2, count: 64 });  // grass
    this.inventory.setSlot(1, { id: 1, count: 64 });  // stone
    this.inventory.setSlot(2, { id: 5, count: 64 });  // planks
    this.inventory.setSlot(3, { id: 6, count: 64 });  // log
    this.inventory.setSlot(4, { id: 4, count: 64 });  // cobble
    this.inventory.setSlot(5, { id: 8, count: 64 });  // sand
    this.inventory.setSlot(6, { id: 30, count: 64 }); // torch
    this.inventory.setSlot(7, { id: 26, count: 64 }); // glass
    this.inventory.setSlot(8, { id: 7, count: 64 });  // leaves

    // Spawn
    const spawnX = 8;
    const spawnZ = 8;
    const spawnY = this.chunks.getWorldGen().getTerrainHeight(spawnX, spawnZ) + 3;
    this.player = new Player(spawnX, spawnY, spawnZ);
    this.chunks.update(spawnX, spawnZ);

    // Pointer lock
    container.addEventListener('click', () => {
      if (!this.input.locked && this.openUI === 'none') {
        this.input.requestLock();
      }
    });

    this.createHighlight();

    // Try to load save
    this.loadGame();

    this.running = true;
    this.animate();
  }

  onStateChange(listener: GameStateListener) {
    this.stateListeners.push(listener);
  }

  openInventoryUI() {
    this.openUI = 'inventory';
    document.exitPointerLock();
  }

  openFurnaceUI() {
    this.openUI = 'furnace';
    document.exitPointerLock();
  }

  closeUI() {
    this.openUI = 'none';
  }

  requestSave() {
    this.saveGame();
  }

  private animate = () => {
    if (!this.running) return;
    requestAnimationFrame(this.animate);

    const dt = Math.min(this.clock.getDelta(), 0.1);

    // FPS
    this.fpsFrames++;
    this.fpsTime += dt;
    if (this.fpsTime >= 1) {
      this.currentFps = Math.round(this.fpsFrames / this.fpsTime);
      this.fpsFrames = 0;
      this.fpsTime = 0;
    }

    // Auto-save every 60 seconds
    this.autoSaveTimer += dt;
    if (this.autoSaveTimer >= 60) {
      this.autoSaveTimer = 0;
      this.saveGame();
    }

    // Cooldowns
    this.breakCooldown = Math.max(0, this.breakCooldown - dt);
    this.placeCooldown = Math.max(0, this.placeCooldown - dt);

    // ─── UI is open: skip game input ───
    if (this.openUI !== 'none') {
      this.renderer.render();
      this.notifyState();
      return;
    }

    // ─── E key to open inventory ───
    if (this.input.isKeyDown('e')) {
      this.openInventoryUI();
      this.input.keys.delete('e');
      this.renderer.render();
      this.notifyState();
      return;
    }

    // Scroll for hotbar
    const scroll = this.input.consumeScroll();
    if (scroll !== 0) {
      this.player.selectedSlot = ((this.player.selectedSlot + (scroll > 0 ? 1 : -1)) % 9 + 9) % 9;
    }

    // Number keys 1-9 for hotbar
    for (let i = 1; i <= 9; i++) {
      if (this.input.isKeyDown(String(i))) {
        this.player.selectedSlot = i - 1;
        this.input.keys.delete(String(i));
      }
    }

    // Player update
    const mouseDelta = this.input.consumeMouseDelta();
    this.player.update(dt, {
      dx: mouseDelta.dx,
      dy: mouseDelta.dy,
      forward: this.input.isKeyDown('w'),
      back: this.input.isKeyDown('s'),
      left: this.input.isKeyDown('a'),
      right: this.input.isKeyDown('d'),
      jump: this.input.isKeyDown(' '),
      sprint: this.input.isKeyDown('control'),
      fly: false,
    }, this.chunks);

    // F key to toggle fly
    if (this.input.isKeyDown('f')) {
      this.player.flying = !this.player.flying;
      this.input.keys.delete('f');
    }

    // Chunk loading
    this.chunks.update(this.player.position.x, this.player.position.z);

    // Camera
    const eye = this.player.eyePosition;
    this.renderer.camera.position.copy(eye);
    this.renderer.camera.rotation.order = 'YXZ';
    this.renderer.camera.rotation.y = this.player.yaw;
    this.renderer.camera.rotation.x = this.player.pitch;

    // Raycast
    this.targetBlock = this.player.raycast(this.chunks);
    this.updateHighlight();

    // ─── Block breaking with progress ───
    const selectedItemId = this.inventory.getSlot(this.player.selectedSlot)?.id ?? 0;
    const breakTime = this.targetBlock
      ? ItemRegistry.getBreakTime(this.targetBlock.blockPos.x < 0 ? 1 : this.chunks.getBlock(
          this.targetBlock.blockPos.x,
          this.targetBlock.blockPos.y,
          this.targetBlock.blockPos.z
        ), selectedItemId)
      : 0;

    if (this.input.isMouseDown(0) && this.targetBlock) {
      const bp = this.targetBlock.blockPos;

      // Check if we're still breaking the same block
      if (this.breakingBlockPos && this.breakingBlockPos.equals(bp)) {
        this.breakProgress += dt / Math.max(breakTime, 0.05);
      } else {
        this.breakingBlockPos = bp.clone();
        this.breakProgress = dt / Math.max(breakTime, 0.05);
      }

      if (this.breakProgress >= 1) {
        // Get block drop
        const blockId = this.chunks.getBlock(bp.x, bp.y, bp.z);
        const dropId = ItemRegistry.getBlockDropItem(blockId);
        if (dropId > 0) {
          this.inventory.addItem(dropId, 1);
        }
        this.chunks.setBlock(bp.x, bp.y, bp.z, 0);
        this.breakProgress = 0;
        this.breakingBlockPos = null;
      }
      this.lastFrameWasBreaking = true;
    } else {
      this.breakProgress = 0;
      this.breakingBlockPos = null;
      this.lastFrameWasBreaking = false;
    }

    // ─── Block placement ───
    if (this.input.isMouseDown(2) && this.placeCooldown <= 0) {
      if (this.targetBlock) {
        const { blockPos, faceNormal } = this.targetBlock;
        const placePos = blockPos.clone().add(faceNormal);

        // Don't place inside player
        const px = Math.floor(this.player.position.x);
        const py = Math.floor(this.player.position.y);
        const pz = Math.floor(this.player.position.z);
        const py1 = Math.floor(this.player.position.y + 1.5);

        const insidePlayer = placePos.x === px && placePos.z === pz &&
          (placePos.y === py || placePos.y === py1);

        if (!insidePlayer) {
          const slot = this.inventory.getSlot(this.player.selectedSlot);
          if (slot && slot.count > 0) {
            const blockId = ItemRegistry.isBlock(slot.id) ? slot.id : 0;
            if (blockId > 0) {
              this.chunks.setBlock(placePos.x, placePos.y, placePos.z, blockId);
              this.inventory.removeFromSlot(this.player.selectedSlot);
              this.placeCooldown = 0.25;
            }
          }
        }
      }
    }

    // ─── Right-click on furnace/crafting table blocks ───
    if (this.input.isMouseDown(2) && this.placeCooldown <= 0 && this.targetBlock) {
      const bp = this.targetBlock.blockPos;
      const blockId = this.chunks.getBlock(bp.x, bp.y, bp.z);
      if (blockId === 25) { // furnace
        this.openFurnaceUI();
        this.placeCooldown = 0.5;
      }
    }

    // Survival
    this.survival.update(dt, {
      position: this.player.position,
      velocity: this.player.velocity,
      onGround: this.player.onGround,
      health: this.player.health,
      hunger: this.player.hunger,
      flying: this.player.flying,
    }, (x, y, z) => this.chunks.getBlock(x, y, z), (dmg) => {
      this.player.health = Math.max(0, this.player.health - dmg);
    });

    // Day/night
    const time = (Date.now() % 120000) / 120000;
    this.renderer.setTimeOfDay(time);

    this.renderer.render();
    this.notifyState();
  };

  private createHighlight() {
    const geo = new THREE.BoxGeometry(1.005, 1.005, 1.005);
    const edges = new THREE.EdgesGeometry(geo);
    this.highlightMesh = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2, transparent: true, opacity: 0.5 })
    );
    this.highlightMesh.visible = false;
    this.renderer.scene.add(this.highlightMesh);
  }

  private updateHighlight() {
    if (!this.highlightMesh) return;
    if (this.targetBlock) {
      this.highlightMesh.visible = true;
      this.highlightMesh.position.set(
        this.targetBlock.blockPos.x + 0.5,
        this.targetBlock.blockPos.y + 0.5,
        this.targetBlock.blockPos.z + 0.5
      );
    } else {
      this.highlightMesh.visible = false;
    }
  }

  private notifyState() {
    const biomeId = this.chunks.getBiomeAt(
      Math.floor(this.player.position.x),
      Math.floor(this.player.position.z)
    );

    const selectedSlot = this.inventory.getSlot(this.player.selectedSlot);
    const selectedName = selectedSlot
      ? ItemRegistry.getDisplayName(selectedSlot.id)
      : 'empty';

    const state: GameState = {
      fps: this.currentFps,
      playerX: Math.round(this.player.position.x * 10) / 10,
      playerY: Math.round(this.player.position.y * 10) / 10,
      playerZ: Math.round(this.player.position.z * 10) / 10,
      biome: BIOME_NAMES[biomeId] || 'Unknown',
      chunkCount: this.chunks.getLoadedChunkCount(),
      selectedBlock: selectedName,
      selectedSlot: this.player.selectedSlot,
      health: this.player.health,
      hunger: this.player.hunger,
      onGround: this.player.onGround,
      flying: this.player.flying,
      openUI: this.openUI,
      inventory: this.inventory,
      heldItemId: selectedSlot?.id ?? 0,
    };

    for (const listener of this.stateListeners) {
      listener(state);
    }
  }

  private async saveGame() {
    const chunkData: { cx: number; cz: number; data: Uint8Array }[] = [];
    for (const [key, chunk] of this.chunks.chunks) {
      chunkData.push({ cx: chunk.cx, cz: chunk.cz, data: new Uint8Array(chunk.data) });
    }

    const saveData: SaveData = {
      player: {
        x: this.player.position.x,
        y: this.player.position.y,
        z: this.player.position.z,
        yaw: this.player.yaw,
        pitch: this.player.pitch,
        health: this.player.health,
        hunger: this.player.hunger,
        flying: this.player.flying,
      },
      inventory: {
        slots: this.inventory.toJSON(),
        armor: [...this.inventory.armor],
      },
      seed: this.seed,
      chunks: chunkData,
      timestamp: Date.now(),
    };

    try {
      await SaveSystem.save(saveData);
    } catch (e) {
      console.warn('Save failed:', e);
    }
  }

  private async loadGame() {
    try {
      const data = await SaveSystem.load();
      if (!data) return;

      // Restore player
      this.player.position.set(data.player.x, data.player.y, data.player.z);
      this.player.yaw = data.player.yaw;
      this.player.pitch = data.player.pitch;
      this.player.health = data.player.health;
      this.player.hunger = data.player.hunger;
      this.player.flying = data.player.flying;

      // Restore inventory
      if (data.inventory) {
        this.inventory.fromJSON(data.inventory.slots);
        if (data.inventory.armor) {
          this.inventory.armor = data.inventory.armor;
        }
      }

      console.log('Game loaded from save');
    } catch (e) {
      console.warn('Load failed:', e);
    }
  }

  dispose() {
    this.running = false;
    this.saveGame();
    this.input.dispose();
    this.renderer.dispose();
  }
}
