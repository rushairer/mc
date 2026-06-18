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
import { MobSystem } from '../systems/MobSystem';
import { Mob } from '../entities/Mob';
import { ParticleSystem } from '../systems/ParticleSystem';
import { FluidSystem } from '../systems/FluidSystem';
import { WeatherSystem } from '../systems/WeatherSystem';
import { SoundSystem } from '../systems/SoundSystem';
import { SaveSystem, type SaveData } from '../systems/SaveSystem';
import { RedstoneSystem } from '../systems/RedstoneSystem';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { CommandSystem } from '../systems/CommandSystem';
import { VisualResolver } from '../visual/VisualResolver';
import { DroppedItemSystem } from '../systems/DroppedItemSystem';
import { XPSystem } from '../systems/XPSystem';
import { EnchantSystem } from '../systems/EnchantSystem';
import { CHUNK_SIZE } from '../constants';
import type { Enchantment } from '../systems/EnchantSystem';
import type { BlockFacing, BlockMetadata, ItemStack } from '../types';

export type UIType = 'none' | 'inventory' | 'furnace' | 'crafting_table' | 'chest' | 'enchanting_table' | 'anvil' | 'death' | 'menu' | 'pause';

export interface GameState {
  fps: number;
  playerX: number;
  playerY: number;
  playerZ: number;
  biome: string;
  chunkCount: number;
  mobCount: number;
  selectedBlock: string;
  selectedSlot: number;
  health: number;
  hunger: number;
  oxygen: number;
  onGround: boolean;
  flying: boolean;
  openUI: UIType;
  inventory: Inventory;
  chestInventory: (ItemStack | null)[] | null;
  heldItemId: number;
  isNight: boolean;
  isUnderwater: boolean;
  gameMode: 'survival' | 'creative';
  activeSlot: string;
  chatOpen: boolean;
  chatInitialValue: string;
  chatMessages: string[];
  xpLevel: number;
  xpProgress: number;
  xpCurrent: number;
  xpNext: number;
}

export type GameStateListener = (state: GameState) => void;

const BIOME_NAMES = ['Plains', 'Desert', 'Mountains', 'Forest', 'Snow', 'Ocean'];
const DAY_LENGTH = 600; // 10 minutes in seconds
const NIGHT_START = 0.5;
const NIGHT_END = 0.95;

export class Game {
  renderer: Renderer;
  input: InputManager;
  private atlas: TextureAtlas;
  chunks: ChunkManager;
  player: Player;
  inventory: Inventory;
  private survival: SurvivalSystem;
  private mobs: MobSystem;
  private particles: ParticleSystem;
  private fluids: FluidSystem;
  private weather: WeatherSystem;
  private sound: SoundSystem;
  private redstone: RedstoneSystem;
  private projectiles: ProjectileSystem;
  droppedItems!: DroppedItemSystem;
  private xp: XPSystem;
  private commands: CommandSystem;
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
  private lockCooldown = 0;
  openUI: UIType = 'none';
  gameMode: 'survival' | 'creative' = 'survival';
  private autoSaveTimer = 0;
  private breakProgress = 0;
  private breakingBlockPos: THREE.Vector3 | null = null;
  private lastFrameWasBreaking = false;
  private seed = 12345;
  private gameTime = 0.05; // 0=sunrise, 0.25=noon, 0.5=sunset, 0.75=midnight
  private damageFlashTimer = 0;
  private swordSwingTimer = 0;
  private eatingTimer = 0;
  private chewSoundTimer = 0;
  private stepTimer = 0;
  private perspectiveMode: 'first' | 'third' = 'first';
  private container: HTMLElement;
  private fpArmGroup!: THREE.Group;
  private fpLastHeldItemId = -1;
  private openChestPos: THREE.Vector3 | null = null;
  private lastLightRebuildTime = -1;
  private lightScanTimer = 0;

  activeSlot: string = 'world_1';

  constructor(container: HTMLElement, initialMode?: 'survival' | 'creative', initialSlot?: string) {
    this.container = container;
    this.activeSlot = initialSlot ?? 'world_1';
    this.gameMode = initialMode ?? 'survival';
    this.openUI = 'menu';
    this.renderer = new Renderer(container);
    this.input = new InputManager(this.renderer.renderer.domElement);
    this.atlas = new TextureAtlas();
    this.chunks = new ChunkManager(this.renderer.scene, this.atlas, this.seed);
    this.clock = new THREE.Clock();
    this.inventory = new Inventory();
    this.survival = new SurvivalSystem();
    this.mobs = new MobSystem(this.renderer.scene);
    this.particles = new ParticleSystem(this.renderer.scene);
    this.fluids = new FluidSystem();
    this.sound = new SoundSystem();
    this.weather = new WeatherSystem(this.renderer.scene, this.sound);
    this.redstone = new RedstoneSystem();
    this.projectiles = new ProjectileSystem(this.renderer.scene);
    this.xp = new XPSystem(this.renderer.scene);
    this.commands = new CommandSystem({
      getPlayerPosition: () => ({
        x: this.player.position.x,
        y: this.player.position.y,
        z: this.player.position.z,
      }),
      setPlayerPosition: (x, y, z) => {
        this.player.position.set(x, y, z);
        this.player.velocity.set(0, 0, 0);
      },
      addItem: (id, count) => this.inventory.addItem(id, count),
      setGameMode: (mode) => { this.gameMode = mode; },
      setTimeOfDay: (t) => { this.gameTime = t; },
      setWeather: (type) => { this.weather.setWeatherType(type); },
      getGameMode: () => this.gameMode,
    });

    // Default hotbar (Starter Kit)
    this.inventory.setSlot(0, { id: 272, count: 1 });  // Stone Sword
    this.inventory.setSlot(1, { id: 274, count: 1 });  // Stone Pickaxe
    this.inventory.setSlot(2, { id: 275, count: 1 });  // Stone Axe
    this.inventory.setSlot(3, { id: 364, count: 32 }); // Steak (Food)
    this.inventory.setSlot(4, { id: 17, count: 64 });   // Oak Log
    this.inventory.setSlot(5, { id: 5, count: 64 });   // Oak Planks
    this.inventory.setSlot(6, { id: 58, count: 4 });   // Crafting Table
    this.inventory.setSlot(7, { id: 54, count: 4 });   // Chest
    this.inventory.setSlot(8, { id: 50, count: 64 });  // Torch


    // Spawn
    const spawnX = 8;
    const spawnZ = 8;
    const spawnY = this.chunks.getWorldGen().getTerrainHeight(spawnX, spawnZ) + 3;
    this.player = new Player(spawnX, spawnY, spawnZ);
    this.droppedItems = new DroppedItemSystem(this.renderer.scene, (itemId) => this.player.createItemVisualMesh(itemId));
    this.chunks.update(spawnX, spawnZ);
    this.player.resolveStuck(this.chunks);
    this.renderer.scene.add(this.player.mesh);

    // Pointer lock
    this.container.addEventListener('click', this.handleContainerClick);

    this.createHighlight();

    this.fpArmGroup = this.createFpArm();
    this.renderer.camera.add(this.fpArmGroup);

    this.running = true;
    this.animate();
  }

  private handleContainerClick = () => {
    if (!this.input.locked && this.openUI === 'none' && !this.chatOpen) {
      this.input.requestLock();
      this.lockCooldown = 0.5;
    }
  };

  private createFpArm(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'fpArmGroup';

    const shirtColor = 0x008080;

    // Arm mesh (origin is now at top/shoulder, so offset down by half height)
    const armGeo = new THREE.BoxGeometry(0.12, 0.45, 0.12);
    const armMat = new THREE.MeshLambertMaterial({ color: shirtColor });
    const armMesh = new THREE.Mesh(armGeo, armMat);
    armMesh.name = 'armMesh';
    armMesh.position.set(0, -0.225, 0); // Offset down by half height
    group.add(armMesh);

    // Hand mesh (placed at the bottom of the arm)
    const handGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    const handMat = new THREE.MeshLambertMaterial({ color: 0xFFCC99 });
    const handMesh = new THREE.Mesh(handGeo, handMat);
    handMesh.name = 'handMesh';
    handMesh.position.set(0, -0.51, 0); // y = -0.45 - 0.06
    group.add(handMesh);

    // Held item slot (placed in hand)
    const heldItemSlot = new THREE.Group();
    heldItemSlot.name = 'heldItemSlot';
    heldItemSlot.position.set(0, -0.51, 0);
    group.add(heldItemSlot);

    // Position shoulder in bottom-right corner of viewport, pushed off-screen to the right
    group.position.set(0.42, -0.02, -0.22);
    group.rotation.set(Math.PI / 3.2, Math.PI / 4.5, -Math.PI / 12);

    return group;
  }

  private updateFpHeldItem(itemId: number) {
    if (itemId === this.fpLastHeldItemId) return;
    this.fpLastHeldItemId = itemId;

    const slot = this.fpArmGroup.getObjectByName('heldItemSlot');
    if (!slot) return;

    // Clear previous children
    while (slot.children.length > 0) {
      const child = slot.children[0];
      slot.remove(child);
      child.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    }

    if (itemId === 0) return;

    // Reuse Player's 3D mesh generator
    const mesh = this.player.createItemVisualMesh(itemId);
    if (mesh) {
      slot.add(mesh);

      const itemDef = ItemRegistry.get(itemId);
      if (itemDef) {
        if (itemDef.category === 'block') {
          // Position block on top/center of the hand, avoiding clipping and aligning with palm (lowered to y = -0.56)
          slot.position.set(0.04, -0.56, -0.10);
          slot.rotation.set(Math.PI / 6, Math.PI / 4, 0); // Rotate slightly for 3D perspective
          mesh.rotation.set(0, 0, 0); // Reset default rotation
        } else if (itemDef.category === 'tool') {
          // Align tool handle inside hand (lowered to y = -0.56)
          slot.position.set(0.02, -0.56, -0.05);
          slot.rotation.set(0, 0, 0);

          // Get default positions to compute the direction from slot to screen center
          const defX = 0.42;
          const defY = -0.02;
          const defZ = -0.22;
          const defRotX = Math.PI / 3.2;
          const defRotY = Math.PI / 4.5;
          const defRotZ = -Math.PI / 12;

          const armGroupRot = new THREE.Euler(defRotX, defRotY, defRotZ);
          const slotPos = slot.position.clone();
          // Calculate the slot position in camera space (idle state)
          const slotCameraPos = slotPos.applyEuler(armGroupRot).add(new THREE.Vector3(defX, defY, defZ));

          // Screen center target at distance D (D controls how inward/forward it points)
          const targetDistance = 0.95;
          const targetCameraPos = new THREE.Vector3(0, 0, -targetDistance);

          // Direction from hand/slot to screen center target
          const toolDir = new THREE.Vector3().subVectors(targetCameraPos, slotCameraPos).normalize();

          // Align local Y axis (0, 1, 0) with toolDir in camera space
          const qAlign = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), toolDir);

          // Convert to local space of the slot (which is the child of arm group)
          const qArm = new THREE.Quaternion().setFromEuler(armGroupRot);
          const qMesh = qArm.clone().invert().multiply(qAlign);

          // Apply a twist rotation around the tool's local Y axis so the flat side faces the screen naturally
          // We twist by -Math.PI / 4.5 (approx -40 degrees)
          const twistAngle = -Math.PI / 4.5;
          const qTwist = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), twistAngle);
          qMesh.multiply(qTwist);

          // Apply calculated quaternion to the mesh
          mesh.quaternion.copy(qMesh);
        } else {
          // Material / Food (lowered to y = -0.58)
          slot.position.set(0.02, -0.58, -0.08);
          slot.rotation.set(Math.PI / 6, Math.PI / 4, 0);
          mesh.rotation.set(0, 0, 0);
        }
      }
    }
  }

  dropHandItem() {
    const slotItem = this.inventory.getSlot(this.player.selectedSlot);
    if (!slotItem) return;

    let dropCount = 1;
    if (this.gameMode !== 'creative') {
      dropCount = (this.input.isKeyDown('control') || this.input.isKeyDown('shift')) ? slotItem.count : 1;
      this.inventory.removeFromSlot(this.player.selectedSlot, dropCount);
    } else {
      dropCount = (this.input.isKeyDown('control') || this.input.isKeyDown('shift')) ? slotItem.count : 1;
    }

    const lookDir = this.player.forward.clone();
    const spawnPos = this.player.eyePosition.clone().sub(new THREE.Vector3(0, 0.2, 0));
    
    const velocity = lookDir.multiplyScalar(3.5).add(new THREE.Vector3(0, 2.0, 0));
    velocity.x += (Math.random() - 0.5) * 0.5;
    velocity.z += (Math.random() - 0.5) * 0.5;

    this.droppedItems.spawnItem(slotItem.id, dropCount, spawnPos, velocity, 1.5);
    this.notifyState();
  }

  dropItemFromUI(itemId: number, count: number) {
    if (count <= 0) return;

    const lookDir = this.player.forward.clone();
    const spawnPos = this.player.eyePosition.clone().sub(new THREE.Vector3(0, 0.2, 0));
    
    const velocity = lookDir.multiplyScalar(3.5).add(new THREE.Vector3(0, 2.0, 0));
    velocity.x += (Math.random() - 0.5) * 0.5;
    velocity.z += (Math.random() - 0.5) * 0.5;

    this.droppedItems.spawnItem(itemId, count, spawnPos, velocity, 1.5);
    this.notifyState();
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

  openCraftingTableUI() {
    this.openUI = 'crafting_table';
    document.exitPointerLock();
  }

  openChestUI(x: number, y: number, z: number) {
    const metadata = this.ensureChestMetadata(x, y, z);
    if (!metadata) return;

    this.openChestPos = new THREE.Vector3(x, y, z);
    this.openUI = 'chest';
    document.exitPointerLock();
  }

  openEnchantUI() {
    this.openUI = 'enchanting_table';
    document.exitPointerLock();
  }

  openAnvilUI() {
    this.openUI = 'anvil';
    document.exitPointerLock();
  }

  enchantItem(item: ItemStack, cost: number, enchantment: Enchantment): ItemStack | null {
    if (this.gameMode !== 'creative' && !this.xp.spendLevels(cost)) {
      return null;
    }

    const enchanted = EnchantSystem.apply(item, enchantment);
    this.sound.playXP();
    this.notifyState();
    return enchanted;
  }

  spendLevels(cost: number): boolean {
    if (this.gameMode === 'creative') return true;
    const spent = this.xp.spendLevels(cost);
    if (spent) this.notifyState();
    return spent;
  }

  startGame(mode?: 'survival' | 'creative') {
    if (mode) {
      this.gameMode = mode;
      // In creative, flying can start enabled or match what was saved.
      // If switching to survival, make sure they are not flying.
      if (mode === 'survival') {
        this.player.flying = false;
      }
    }
    this.openUI = 'none';
    // Don't request lock here — the loading screen may still be covering the canvas.
    // App.tsx will request pointer lock after the loading screen is hidden.
    this.lockCooldown = 2.0;
    this.notifyState();
  }

  resumeGame() {
    this.openUI = 'none';
    this.input.requestLock();
    this.lockCooldown = 0.5;
    this.notifyState();
  }

  requestPointerLock() {
    this.input.requestLock();
    this.lockCooldown = 0.5;
  }

  async manualSave(): Promise<boolean> {
    try {
      await this.saveGame();
      return true;
    } catch (e) {
      console.warn('Manual save failed:', e);
      return false;
    }
  }

  closeUI() {
    if (this.openUI === 'chest') {
      this.openChestPos = null;
    }
    this.openUI = 'none';
    this.input.requestLock();
    this.lockCooldown = 0.5;
    this.notifyState();
  }

  respawn() {
    const safePos = this.bedSpawnPoint
      ? this.bedSpawnPoint.clone()
      : this.findSafeRespawnPosition();

    // Chunk loading around safe position
    this.chunks.update(safePos.x, safePos.z);

    this.player.position.copy(safePos);
    this.player.velocity.set(0, 0, 0);
    this.player.health = 20;
    this.player.hunger = 20;
    this.player.saturation = 20;
    this.player.flying = false;
    this.player.resolveStuck(this.chunks);
    this.survival.resetFall();

    this.openUI = 'none';
    this.input.requestLock();
    this.lockCooldown = 0.5;
    this.notifyState();
  }

  private findSafeRespawnPosition(): THREE.Vector3 {
    const spawnPoint = new THREE.Vector3(8, 0, 8);
    let bestPos: THREE.Vector3 | null = null;

    for (let attempt = 0; attempt < 30; attempt++) {
      // Choose a random distance (30 to 80 blocks) and angle
      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 50;
      const rx = Math.floor(spawnPoint.x + Math.cos(angle) * dist);
      const rz = Math.floor(spawnPoint.z + Math.sin(angle) * dist);

      // Get surface Y height
      const ry = this.chunks.getWorldGen().getTerrainHeight(rx, rz);

      // Check block type at surface and below
      const surfaceBlockId = this.chunks.getBlock(rx, ry, rz);
      const belowBlockId = this.chunks.getBlock(rx, ry - 1, rz);

      // Avoid water and lava
      if (BlockRegistry.isFluid(surfaceBlockId) || BlockRegistry.isFluid(belowBlockId)) {
        continue;
      }

      const candidatePos = new THREE.Vector3(rx + 0.5, ry + 1.5, rz + 0.5);

      // Check for nearby hostile mobs
      const nearbyMobs = this.mobs.getMobsNear(candidatePos, 16);
      const nearbyHostiles = nearbyMobs.filter(mob => mob.def.hostile);

      if (nearbyHostiles.length === 0) {
        bestPos = candidatePos;
        break;
      }

      // Keep track of the one with fewest hostiles just in case
      if (!bestPos) {
        bestPos = candidatePos;
      }
    }

    // Fallback: if all attempts fail, use the last candidate but clear/kill mobs within 12 blocks of it
    if (!bestPos) {
      const angle = Math.random() * Math.PI * 2;
      const rx = Math.floor(spawnPoint.x + Math.cos(angle) * 30);
      const rz = Math.floor(spawnPoint.z + Math.sin(angle) * 30);
      const ry = this.chunks.getWorldGen().getTerrainHeight(rx, rz);
      bestPos = new THREE.Vector3(rx + 0.5, ry + 1.5, rz + 0.5);

      const nearbyMobs = this.mobs.getMobsNear(bestPos, 12);
      for (const mob of nearbyMobs) {
        if (mob.def.hostile) {
          mob.health = 0; // kill it
        }
      }
    }

    return bestPos;
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

    // Timers
    this.autoSaveTimer += dt;
    if (this.autoSaveTimer >= 60) {
      this.autoSaveTimer = 0;
      this.saveGame();
    }

    this.breakCooldown = Math.max(0, this.breakCooldown - dt);
    this.placeCooldown = Math.max(0, this.placeCooldown - dt);
    this.damageFlashTimer = Math.max(0, this.damageFlashTimer - dt);
    this.swordSwingTimer = Math.max(0, this.swordSwingTimer - dt);
    this.lockCooldown = Math.max(0, this.lockCooldown - dt);

    // Game time (day/night cycle)
    this.gameTime = (this.gameTime + dt / DAY_LENGTH) % 1;
    const lightningOpacity = this.weather.getLightningFlashOpacity();
    this.renderer.setTimeOfDay(this.gameTime, lightningOpacity);
    this.chunks.setLightningOffset(lightningOpacity);
    this.chunks.timeOfDay = this.gameTime;

    // Rebuild meshes when sun position changes enough to affect brightness
    if (this.lastLightRebuildTime < 0 || Math.abs(this.gameTime - this.lastLightRebuildTime) > 0.005) {
      this.lastLightRebuildTime = this.gameTime;
      for (const chunk of this.chunks.chunks.values()) {
        chunk.dirty = true;
      }
    }

    // Underwater fog and background override
    const headBlock = this.chunks.getBlock(
      Math.floor(this.player.position.x),
      Math.floor(this.player.position.y + 1.62),
      Math.floor(this.player.position.z)
    );
    const isUnderwater = (headBlock & 0x3FF) === 8 || (headBlock & 0x3FF) === 9;

    if (isUnderwater) {
      const sunAngle = this.gameTime * Math.PI * 2;
      const sunY = Math.sin(sunAngle);
      const daylight = sunY >= 0 ? THREE.MathUtils.lerp(0.35, 1.0, sunY) : 0.18;
      const effectiveDaylight = THREE.MathUtils.lerp(daylight, 1.0, lightningOpacity);
      const deepWaterColor = new THREE.Color(0.015, 0.11, 0.30);
      const shallowWaterColor = new THREE.Color(0.06, 0.30, 0.72);
      const waterFogColor = deepWaterColor.clone().lerp(shallowWaterColor, effectiveDaylight);

      if (lightningOpacity > 0) {
        // Blend towards light blue/white
        const flashColor = new THREE.Color(0xd0e0ff);
        waterFogColor.lerp(flashColor, lightningOpacity * 0.5);
      }

      this.renderer.scene.background = waterFogColor;
      if (this.renderer.scene.fog) {
        const fog = this.renderer.scene.fog as THREE.Fog;
        fog.color.copy(waterFogColor);
        fog.near = 0.35;
        const visibility = THREE.MathUtils.lerp(8, 22, effectiveDaylight);
        fog.far = THREE.MathUtils.lerp(visibility, 30, lightningOpacity);
      }
    } else {
      if (this.renderer.scene.fog) {
        const fog = this.renderer.scene.fog as THREE.Fog;
        fog.near = this.renderer.fogNear;
        fog.far = this.renderer.fogFar;
      }
    }

    // If pointer lock is lost and no UI is open, open pause menu (only if not in lock cooldown and chat is closed)
    if (!this.input.locked && this.openUI === 'none' && this.lockCooldown <= 0 && !this.chatOpen) {
      this.openUI = 'pause';
      this.notifyState();
      this.renderer.render();
      return;
    }

    // UI open: skip game input
    if (this.openUI !== 'none') {
      this.particles.update(dt);
      this.mobs.update(dt, this.player.position, this.isNight(),
        (x, y, z) => this.chunks.getBlock(x, y, z),
        () => {}, // no mob attacks while UI open
        (x, y, z) => this.chunks.isSolidBlock(x, y, z)
      );
      this.renderer.render();
      this.notifyState();
      return;
    }

    // E key → inventory
    if (!this.chatOpen && this.input.isKeyDown('e')) {
      this.openInventoryUI();
      this.input.keys.delete('e');
      this.renderer.render();
      this.notifyState();
      return;
    }

    // Consume scroll input (disabled to prevent accidental triggers on trackpads)
    this.input.consumeScroll();

    // Number keys 1-9
    if (!this.chatOpen) {
      for (let i = 1; i <= 9; i++) {
        if (this.input.isKeyDown(String(i))) {
          this.player.selectedSlot = i - 1;
          this.input.keys.delete(String(i));
        }
      }
    }

    // Player update
    const mouseDelta = this.input.consumeMouseDelta();
    this.player.update(dt, {
      dx: this.chatOpen ? 0 : mouseDelta.dx,
      dy: this.chatOpen ? 0 : mouseDelta.dy,
      forward: this.chatOpen ? false : this.input.isKeyDown('w'),
      back: this.chatOpen ? false : this.input.isKeyDown('s'),
      left: this.chatOpen ? false : this.input.isKeyDown('a'),
      right: this.chatOpen ? false : this.input.isKeyDown('d'),
      jump: this.chatOpen ? false : this.input.isKeyDown(' '),
      sprint: this.chatOpen ? false : (this.input.isKeyDown('control') || this.input.isKeyDown('shift')),
      fly: false,
    }, this.chunks);

    // Mob system
    const isNight = this.isNight();
    this.mobs.update(dt, this.player.position, isNight,
      (x, y, z) => this.chunks.getBlock(x, y, z),
      (damage, knockback) => {
        this.damagePlayer(damage, 'mob', knockback);
      },
      (x, y, z) => this.chunks.isSolidBlock(x, y, z),
      this.gameMode,
      (mob) => {
        this.handleMobDeath(mob);
      },
      (origin, direction) => {
        this.projectiles.shootArrow(origin, direction, false, 4);
      }
    );

    // Check creeper explosions
    for (const [id, mob] of this.mobs.mobs) {
      if (mob.def.type === 'creeper' && mob.fuseTimer >= 1.5) {
        this.handleCreeperExplosion(mob);
        this.mobs.removeMob(id);
      }
    }

    // Update TNT fuses
    for (let i = this.tntFuses.length - 1; i >= 0; i--) {
      this.tntFuses[i].timer -= dt;
      if (this.tntFuses[i].timer <= 0) {
        const tnt = this.tntFuses[i];
        this.createExplosion(tnt.position.x, tnt.position.y, tnt.position.z, 4);
        this.tntFuses.splice(i, 1);
      }
    }

    // Update projectiles
    this.projectiles.update(
      dt,
      (x, y, z) => this.chunks.getBlock(x, y, z),
      (damage, knockback) => this.damagePlayer(damage, 'mob', knockback),
      (mobId, damage, knockback) => {
        const mob = this.mobs.mobs.get(mobId);
        if (mob) mob.takeDamage(damage, knockback);
      },
      () => Array.from(this.mobs.mobs.values()).map(m => ({
        id: m.id, position: m.position, width: m.def.width, height: m.def.height
      })),
      this.player.position,
      0.6, 1.8
    );

    // Update dropped items
    this.droppedItems.update(
      dt,
      this.player.position,
      (x, y, z) => this.chunks.isSolidBlock(x, y, z),
      this.inventory,
      () => this.sound.playPickup(),
      () => this.notifyState()
    );

    this.xp.update(
      dt,
      this.player.position,
      (x, y, z) => this.chunks.isSolidBlock(x, y, z),
      () => this.sound.playXP(),
      () => this.notifyState()
    );

    // Resolve collisions (mob-mob, player-mob)
    this.resolveCollisions();

    if (!this.chatOpen && (this.input.isMouseDown(0) || this.input.isMouseDown(2))) {
      this.player.startSwing();
    }

    // T key or / key → open chat/command
    const tPressed = this.input.isKeyDown('t');
    const slashPressed = this.input.isKeyDown('/');
    if ((tPressed || slashPressed) && !this.chatOpen) {
      this.chatOpen = true;
      this.chatInitialValue = slashPressed ? '/' : '';
      this.input.keys.clear();
      this.input.mouseButtons.clear();
      document.exitPointerLock();
      this.notifyState();
    }

    // F key → fly toggle (creative mode only)
    if (!this.chatOpen && this.input.isKeyDown('f') && this.gameMode === 'creative') {
      this.player.flying = !this.player.flying;
      this.input.keys.delete('f');
      this.notifyState();
    }

    // F5 key → perspective toggle
    if (!this.chatOpen && this.input.isKeyDown('f5')) {
      this.perspectiveMode = this.perspectiveMode === 'first' ? 'third' : 'first';
      this.input.keys.delete('f5');
      this.notifyState();
    }

    // Q key → drop active hand item
    if (!this.chatOpen && this.input.isKeyDown('q')) {
      this.dropHandItem();
      this.input.keys.delete('q');
    }

    // Chunk loading
    this.chunks.update(this.player.position.x, this.player.position.z);

    // Update player mesh visibility and transform
    const selectedSlotStack = this.inventory.getSlot(this.player.selectedSlot);
    const heldItemId = selectedSlotStack?.id ?? 0;
    this.player.updateHeldItem(heldItemId);

    if (this.perspectiveMode === 'first') {
      this.player.mesh.visible = false;

      // Camera position at eye level in first person
      const eye = this.player.eyePosition;
      this.renderer.camera.position.copy(eye);

      // First person arm visibility and animation
      if (this.openUI === 'none') {
        this.fpArmGroup.visible = true;
        this.updateFpHeldItem(heldItemId);

        // Default position & rotation matching the shoulder-pivot coordinates (pushed off-screen to the right)
        const defX = 0.42;
        const defY = -0.02;
        const defZ = -0.22;

        const defRotX = Math.PI / 3.2;
        const defRotY = Math.PI / 4.5;
        const defRotZ = -Math.PI / 12;

        if (this.player.swingProgress > 0) {
          const t = this.player.swingProgress;
          const swingAngle = Math.sin(t * Math.PI);

          // Rotate around a stable shoulder position with minimal translation
          this.fpArmGroup.position.set(
            defX - swingAngle * 0.04,
            defY - swingAngle * 0.03,
            defZ - swingAngle * 0.04
          );

          this.fpArmGroup.rotation.set(
            defRotX - swingAngle * 0.5,
            defRotY + swingAngle * 0.3,
            defRotZ - swingAngle * 0.1
          );
        } else {
          // Subtle breathing / walking bobbing
          const speed = this.player.velocity.clone().setY(0).length();
          const time = Date.now() * 0.005;
          let bobY = 0;
          let bobX = 0;
          if (this.player.onGround && speed > 0.1) {
            bobY = Math.sin(time * 2) * 0.015;
            bobX = Math.cos(time) * 0.01;
          } else {
            bobY = Math.sin(time) * 0.005;
          }

          this.fpArmGroup.position.set(defX + bobX, defY + bobY, defZ);
          this.fpArmGroup.rotation.set(defRotX, defRotY, defRotZ);
        }
      } else {
        this.fpArmGroup.visible = false;
      }
    } else {
      this.fpArmGroup.visible = false;
      this.player.mesh.visible = true;
      this.player.mesh.position.copy(this.player.position);
      this.player.mesh.rotation.y = this.player.yaw + Math.PI;

      const head = this.player.mesh.getObjectByName('head');
      if (head) {
        head.rotation.x = -this.player.pitch;
      }

      // Swing animation
      const speed = this.player.velocity.clone().setY(0).length();
      const isMoving = speed > 0.1;
      const time = Date.now() * 0.008;

      const armL = this.player.mesh.getObjectByName('armL');
      const armR = this.player.mesh.getObjectByName('armR');
      const legL = this.player.mesh.getObjectByName('legL');
      const legR = this.player.mesh.getObjectByName('legR');

      const swingAngle = isMoving ? Math.sin(time) * 0.6 : 0;
      if (armL) armL.rotation.x = -swingAngle;
      if (legL) legL.rotation.x = swingAngle;
      if (legR) legR.rotation.x = -swingAngle;

      if (this.player.swingProgress > 0) {
        const punchAngle = Math.sin(this.player.swingProgress * Math.PI) * 1.5;
        if (armR) {
          armR.rotation.x = -punchAngle;
          armR.rotation.z = Math.sin(this.player.swingProgress * Math.PI) * 0.3;
        }
      } else {
        if (armR) {
          armR.rotation.x = swingAngle;
          armR.rotation.z = 0;
        }
      }

      // Camera position behind player in third person (with collision check)
      const eye = this.player.eyePosition;
      const dir = this.player.forward;
      const raycastDir = dir.clone().negate();
      const step = 0.1;
      const maxD = 3.5;
      let finalD = maxD;

      for (let d = 0; d < maxD; d += step) {
        const checkPos = eye.clone().addScaledVector(raycastDir, d);
        const bx = Math.floor(checkPos.x);
        const by = Math.floor(checkPos.y);
        const bz = Math.floor(checkPos.z);
        const blockId = this.chunks.getBlock(bx, by, bz);
        if (blockId !== 0 && this.chunks.isSolidBlock(bx, by, bz)) {
          finalD = Math.max(0.2, d - 0.2);
          break;
        }
      }

      const camPos = eye.clone().addScaledVector(raycastDir, finalD);
      this.renderer.camera.position.copy(camPos);
    }

    this.renderer.camera.rotation.order = 'YXZ';
    this.renderer.camera.rotation.y = this.player.yaw;
    this.renderer.camera.rotation.x = this.player.pitch;

    // Raycast
    this.targetBlock = this.player.raycast(this.chunks);
    this.updateHighlight();

    // ─── Left click: attack mobs OR break blocks ───
    const selectedItemStack = this.inventory.getSlot(this.player.selectedSlot);
    const selectedItemId = selectedItemStack?.id ?? 0;
    const isHoldingSword = ItemRegistry.isTool(selectedItemId) &&
      ItemRegistry.get(selectedItemId)?.toolType === 'sword';
    const isHoldingTool = ItemRegistry.isTool(selectedItemId);
    const baseAttackDamage = isHoldingTool
      ? (ItemRegistry.get(selectedItemId)?.damage ?? 1)
      : 1;
    const attackDamage = baseAttackDamage + EnchantSystem.getSharpnessBonus(
      EnchantSystem.getLevel(selectedItemStack, 'sharpness')
    );

    if (!this.chatOpen && this.input.isMouseDown(0) && this.swordSwingTimer <= 0) {
      // Bow shooting
      const heldItemId = this.inventory.getSlot(this.player.selectedSlot)?.id;
      const heldItemDef = heldItemId ? ItemRegistry.get(heldItemId) : null;
      if (heldItemDef && heldItemDef.name === 'bow') { // Bow
        const arrowDef = ItemRegistry.getByName('arrow');
        const arrowId = arrowDef?.id ?? 262;
        const hasArrow = this.inventory.countItem(arrowId) > 0 || this.gameMode === 'creative';
        if (hasArrow) {
          if (this.gameMode !== 'creative') this.inventory.removeItem(arrowId, 1);
          this.projectiles.shootArrow(
            this.player.eyePosition.clone(),
            this.player.forward.clone(),
            true
          );
          this.sound.playHurt(); // reuse as bow sound
          this.swordSwingTimer = 0.9; // bow cooldown
        }
      } else {
      // First: try to attack mob
      const dir = this.player.forward;
      const mobHit = this.mobs.playerAttackMob(
        this.player.eyePosition,
        dir,
        attackDamage,
        4.5
      );

      if (mobHit.hit) {
        this.swordSwingTimer = 0.4;
        this.sound.playMobHurt();
        // Spawn damage particles on mob
        if (mobHit.mob) {
          this.particles.spawnDamageParticles(
            mobHit.mob.position.x,
            mobHit.mob.position.y + mobHit.mob.def.height * 0.5,
            mobHit.mob.position.z
          );
        }
      } else if (this.targetBlock) {
        // Break block
        const bp = this.targetBlock.blockPos;

        if (this.gameMode === 'creative') {
          this.breakProgress = 1.0;
        } else {
          const baseBreakTime = ItemRegistry.getBreakTime(
            this.chunks.getBlock(bp.x, bp.y, bp.z),
            selectedItemId
          );
          const efficiency = EnchantSystem.getEfficiencyMultiplier(
            EnchantSystem.getLevel(selectedItemStack, 'efficiency')
          );
          const breakTime = baseBreakTime / efficiency;

          if (this.breakingBlockPos && this.breakingBlockPos.equals(bp)) {
            this.breakProgress += dt / Math.max(breakTime, 0.05);
          } else {
            this.breakingBlockPos = bp.clone();
            this.breakProgress = dt / Math.max(breakTime, 0.05);
          }
        }

        if (this.breakProgress >= 1) {
          const blockId = this.chunks.getBlock(bp.x, bp.y, bp.z);
          const blockDef = BlockRegistry.get(blockId);
          const isDoor = this.isDoorBlock(blockId);

          // Spawn break particles
          if (blockDef) {
            const blockColor = this.getBlockParticleColor(blockId);
            this.particles.spawnBlockBreak(bp.x, bp.y, bp.z, blockColor);
          }

          if (this.gameMode !== 'creative') {
            // Drop item in 3D world
            const dropPos = new THREE.Vector3(bp.x + 0.5, bp.y + 0.3, bp.z + 0.5);
            const velocity = new THREE.Vector3(
              (Math.random() - 0.5) * 1.5,
              1.5 + Math.random() * 1.5,
              (Math.random() - 0.5) * 1.5
            );
            if (isDoor) {
              this.droppedItems.spawnItem(37, 1, dropPos, velocity, 0.5);
            } else {
              const dropId = ItemRegistry.getBlockDropItem(blockId);
              if (dropId > 0) {
                this.droppedItems.spawnItem(dropId, 1, dropPos, velocity, 0.5);
              }
            }

            // Damage tool
            const heldItemStack = this.inventory.getSlot(this.player.selectedSlot);
            if (heldItemStack && ItemRegistry.isTool(heldItemStack.id)) {
              this.inventory.damageTool(this.player.selectedSlot);
            }
          }

          // Fluid check: if breaking a block next to water, trigger flow
          this.checkFluidAdjacency(bp.x, bp.y, bp.z);

          if (isDoor) {
            this.breakDoor(bp.x, bp.y, bp.z);
          } else {
            this.chunks.setBlock(bp.x, bp.y, bp.z, 0);
            this.redstone.unregister(bp.x, bp.y, bp.z);
            this.chunks.setBlockMeta(bp.x, bp.y, bp.z, null);
          }
          this.sound.playBlockBreak();
          this.breakProgress = 0;
          this.breakingBlockPos = null;
        }
        this.lastFrameWasBreaking = true;
      }
      } // close else (not bow)
    } else {
      this.breakProgress = 0;
      this.breakingBlockPos = null;
      this.lastFrameWasBreaking = false;
    }

    // ─── Right click: place block / interact ───
    if (!this.chatOpen && this.input.isMouseDown(2) && this.placeCooldown <= 0) {
      if (this.targetBlock) {
        const { blockPos, faceNormal } = this.targetBlock;
        const targetId = this.chunks.getBlock(blockPos.x, blockPos.y, blockPos.z);
        const targetDef = BlockRegistry.get(targetId);
        const targetName = targetDef?.name ?? '';

        // Right-click furnace
        if (targetName.includes('furnace')) {
          this.openFurnaceUI();
          this.placeCooldown = 0.5;
        } else if (targetName === 'crafting_table') {
          this.openCraftingTableUI();
          this.placeCooldown = 0.5;
        } else if (targetName === 'chest') {
          this.openChestUI(blockPos.x, blockPos.y, blockPos.z);
          this.placeCooldown = 0.5;
        } else if (targetName === 'enchanting_table') {
          this.openEnchantUI();
          this.placeCooldown = 0.5;
        } else if (targetName.includes('anvil')) {
          this.openAnvilUI();
          this.placeCooldown = 0.5;
        } else if (this.isDoorBlock(targetId)) {
          this.toggleDoor(blockPos.x, blockPos.y, blockPos.z);
          this.sound.playLever();
          this.placeCooldown = 0.25;
        } else if (this.isTrapdoorBlock(targetId)) {
          this.toggleTrapdoor(blockPos.x, blockPos.y, blockPos.z);
          this.sound.playLever();
          this.placeCooldown = 0.25;
        } else if (targetName === 'lever') {
          const powered = this.redstone.toggleLever(blockPos.x, blockPos.y, blockPos.z);
          this.updateRedstoneMetadata(blockPos.x, blockPos.y, blockPos.z, {
            powered,
            signal: powered ? 15 : 0,
          });
          this.sound.playLever();
          this.placeCooldown = 0.25;
        } else if (targetName === 'tnt') {
          // Ignite TNT
          this.igniteTNT(blockPos.x, blockPos.y, blockPos.z);
          this.placeCooldown = 0.25;
        } else if (targetName === 'bed') {
          // Bed: set spawn point
          this.bedSpawnPoint = new THREE.Vector3(blockPos.x + 0.5, blockPos.y + 1, blockPos.z + 0.5);
          this.sound.playBlockPlace();
          this.placeCooldown = 0.25;
        } else {
          // Place block
          const placePos = blockPos.clone().add(faceNormal);
          const px = Math.floor(this.player.position.x);
          const py = Math.floor(this.player.position.y);
          const pz = Math.floor(this.player.position.z);
          const py1 = Math.floor(this.player.position.y + 1.5);

          const insidePlayer = placePos.x === px && placePos.z === pz &&
            (placePos.y === py || placePos.y === py1);

          if (!insidePlayer) {
            const slot = this.inventory.getSlot(this.player.selectedSlot);
            if (slot && slot.count > 0) {
              const itemDef = ItemRegistry.get(slot.id);
              const isDoorItem = itemDef && itemDef.name.endsWith('door');
              const blockId = ItemRegistry.getPlaceBlockId(slot.id) ?? 0;
              if (blockId > 0) {
                let facing: BlockFacing = 'north';
                if (faceNormal.x > 0) facing = 'east';
                else if (faceNormal.x < 0) facing = 'west';
                else if (faceNormal.y > 0) facing = 'up';
                else if (faceNormal.y < 0) facing = 'down';
                else if (faceNormal.z > 0) facing = 'south';
                else if (faceNormal.z < 0) facing = 'north';

                const blockDef = BlockRegistry.get(blockId) || BlockRegistry.getByName(itemDef?.name ?? '');
                const isSlab = blockDef && blockDef.name.includes('slab') && !blockDef.name.includes('double');

                if (isDoorItem || (blockDef && blockDef.name.endsWith('door') && !blockDef.name.includes('trapdoor'))) {
                  const doorBlockId = blockDef?.id ?? 64; // Fallback to wooden door block (64)
                  const placed = this.placeDoor(placePos.x, placePos.y, placePos.z, doorBlockId);
                  if (placed) {
                    this.sound.playBlockPlace();
                    if (this.gameMode !== 'creative') {
                      this.inventory.removeFromSlot(this.player.selectedSlot);
                    }
                    this.placeCooldown = 0.25;
                  }
                } else if (isSlab) {
                  // Slab placement
                  const existingBlock = this.chunks.getBlock(placePos.x, placePos.y, placePos.z);
                  if (existingBlock === blockId) {
                    // Stacking: convert to double slab block
                    let doubleBlockId = blockId;
                    const doubleName = blockDef.name.startsWith('double_') ? blockDef.name : `double_${blockDef.name}`;
                    const doubleDef = BlockRegistry.getByName(doubleName) || BlockRegistry.getByName(`minecraft:${doubleName}`);
                    if (doubleDef) {
                      doubleBlockId = doubleDef.id;
                    }
                    this.chunks.setBlock(placePos.x, placePos.y, placePos.z, doubleBlockId);
                    this.chunks.setBlockMeta(placePos.x, placePos.y, placePos.z, null);
                  } else {
                    this.chunks.setBlock(placePos.x, placePos.y, placePos.z, blockId);
                    const slabHalf = faceNormal.y > 0 ? 'bottom' : 'top';
                    this.chunks.setBlockMeta(placePos.x, placePos.y, placePos.z, { slabHalf });
                  }
                  this.sound.playBlockPlace();
                  if (this.gameMode !== 'creative') {
                    this.inventory.removeFromSlot(this.player.selectedSlot);
                  }
                  this.placeCooldown = 0.25;
                } else {
                  this.chunks.setBlock(placePos.x, placePos.y, placePos.z, blockId);
                  this.sound.playBlockPlace();
                  if (this.gameMode !== 'creative') {
                    this.inventory.removeFromSlot(this.player.selectedSlot);
                  }
                  this.placeCooldown = 0.25;

                  // Register redstone component if it is one
                  this.setPlacedBlockMetadata(placePos.x, placePos.y, placePos.z, blockId, facing);

                  // If placing water/lava, start fluid simulation
                  if (BlockRegistry.isFluid(blockId)) {
                    this.fluids.addSource(placePos.x, placePos.y, placePos.z, blockId);
                  }
                }
              }
            }
          }
        }
      }
    }

    // ─── Food Eating ───
    const foodSlotStack = this.inventory.getSlot(this.player.selectedSlot);
    const isHoldingFood = foodSlotStack && ItemRegistry.isFood(foodSlotStack.id);
    const targetBlockId = this.targetBlock ? this.chunks.getBlock(this.targetBlock.blockPos.x, this.targetBlock.blockPos.y, this.targetBlock.blockPos.z) : 0;
    const targetDef = targetBlockId ? BlockRegistry.get(targetBlockId) : null;
    const targetName = targetDef?.name ?? '';
    const pointingAtInteractive = this.targetBlock && (
      targetName.includes('furnace') ||
      targetName === 'crafting_table' ||
      targetName === 'enchanting_table' ||
      targetName.includes('anvil') ||
      targetName === 'lever' ||
      targetName === 'chest' ||
      targetName === 'bed' ||
      this.isDoorBlock(targetBlockId) ||
      this.isTrapdoorBlock(targetBlockId)
    );

    if (!this.chatOpen && this.input.isMouseDown(2) && isHoldingFood && !pointingAtInteractive && this.player.hunger < 20) {
      this.eatingTimer += dt;
      this.chewSoundTimer += dt;

      if (this.chewSoundTimer >= 0.25) {
        this.chewSoundTimer = 0;
        this.sound.playEat();

        let foodColor = 0xC0A080;
        const baseFoodId = foodSlotStack.id & 0x3FF;
        if (baseFoodId === 260) foodColor = 0xFF0000;
        else if (baseFoodId === 363 || baseFoodId === 364) foodColor = 0xA04040;

        const front = this.player.eyePosition.clone().add(this.player.forward.multiplyScalar(0.4));
        this.particles.spawnBlockBreak(front.x, front.y, front.z, foodColor);
      }

      if (this.eatingTimer >= 1.6) {
        const foodDef = ItemRegistry.get(foodSlotStack.id);
        if (foodDef) {
          this.player.hunger = Math.min(20, this.player.hunger + (foodDef.hungerRestore ?? 0));
          this.player.saturation = Math.min(this.player.hunger, this.player.saturation + (foodDef.saturationRestore ?? 0));
          this.sound.playBurp();
          this.inventory.removeFromSlot(this.player.selectedSlot);
        }
        this.eatingTimer = 0;
        this.chewSoundTimer = 0;
        this.placeCooldown = 0.5;
      }
    } else {
      this.eatingTimer = 0;
      this.chewSoundTimer = 0;
    }

    // ─── Footsteps ───
    const isMoving = !this.chatOpen && (this.input.isKeyDown('w') || this.input.isKeyDown('s') || this.input.isKeyDown('a') || this.input.isKeyDown('d')) && !this.player.flying;
    if (this.player.onGround && isMoving) {
      const isSprinting = this.input.isKeyDown('control');
      const stepInterval = isSprinting ? 0.28 : 0.38;
      this.stepTimer += dt;
      if (this.stepTimer >= stepInterval) {
        this.stepTimer = 0;
        const bx = Math.floor(this.player.position.x);
        const by = Math.floor(this.player.position.y - 0.1);
        const bz = Math.floor(this.player.position.z);
        const blockId = this.chunks.getBlock(bx, by, bz);
        this.sound.playStep(blockId);
      }
    } else {
      this.stepTimer = 0;
    }

    // Mobs and drops updated earlier in tick

    this.survival.update(dt, this.player, this.gameMode, (x, y, z) => this.chunks.getBlock(x, y, z), (dmg, type) => {
      this.damagePlayer(dmg, type);
    });

    // Death check
    if (this.player.health <= 0) {
      // Drop inventory items at death location in 3D world
      const deathPos = this.player.position.clone().add(new THREE.Vector3(0, 0.5, 0));
      for (let i = 0; i < 36; i++) {
        const slot = this.inventory.getSlot(i);
        if (slot) {
          const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 4.0,
            2.0 + Math.random() * 3.0,
            (Math.random() - 0.5) * 4.0
          );
          this.droppedItems.spawnItem(slot.id, slot.count, deathPos, velocity, 1.0);
          this.inventory.setSlot(i, null);
        }
      }
      // Drop equipped armor as well
      if (this.inventory.armor && Array.isArray(this.inventory.armor)) {
        for (let i = 0; i < 4; i++) {
          const armorItem = this.inventory.armor[i];
          if (armorItem) {
            const velocity = new THREE.Vector3(
              (Math.random() - 0.5) * 4.0,
              2.0 + Math.random() * 3.0,
              (Math.random() - 0.5) * 4.0
            );
            this.droppedItems.spawnItem(armorItem.id, armorItem.count, deathPos, velocity, 1.0);
            this.inventory.armor[i] = null;
          }
        }
      }
      this.openUI = 'death';
      this.xp.reset();
      document.exitPointerLock();
      this.notifyState();
      this.renderer.render();
      return;
    }

    // Redstone simulation
    this.redstone.update(
      dt,
      (x, y, z) => this.chunks.getBlock(x, y, z),
      (x, y, z, id) => this.chunks.setBlock(x, y, z, id),
      (soundType) => {
        if (soundType === 'piston_extend') this.sound.playPistonExtend();
        else if (soundType === 'piston_retract') this.sound.playPistonRetract();
      },
      (component) => {
        this.updateRedstoneMetadata(component.x, component.y, component.z, {
          powered: component.state,
          signal: component.signal,
          extended: component.type === 'piston' ? component.state : undefined,
        });
      }
    );

    // Fluid simulation
    this.fluids.update(dt,
      (x, y, z) => this.chunks.getBlock(x, y, z),
      (x, y, z, id) => this.chunks.setBlock(x, y, z, id),
      (x, y, z, meta) => this.chunks.setBlockMeta(x, y, z, meta)
    );

    // Particles
    this.particles.update(dt);

    // Weather
    this.weather.update(dt, this.player.position, isNight);

    // Dynamic lighting
    this.lightScanTimer += dt;
    if (this.lightScanTimer >= 0.15) {
      this.lightScanTimer = 0;
      this.updateDynamicLighting();
    }

    this.renderer.render();
    this.notifyState();
  };

  private handleMobDeath(mob: Mob) {
    this.sound.playMobDeath();
    // Spawn death particles
    this.particles.spawnDeathParticles(
      mob.position.x,
      mob.position.y,
      mob.position.z,
      mob.def.bodyColor
    );

    // Drop items in 3D world
    for (const drop of mob.def.drops) {
      if (Math.random() < drop.chance) {
        const dropPos = mob.position.clone().add(new THREE.Vector3(0, 0.5, 0));
        const velocity = new THREE.Vector3(
          (Math.random() - 0.5) * 1.5,
          1.5 + Math.random() * 1.5,
          (Math.random() - 0.5) * 1.5
        );
        this.droppedItems.spawnItem(drop.id, drop.count, dropPos, velocity, 0.5);
      }
    }

    if (this.gameMode !== 'creative' && mob.def.xpDrop > 0) {
      this.xp.spawnXP(mob.def.xpDrop, mob.position.clone().add(new THREE.Vector3(0, 0.45, 0)));
    }
  }

  private handleCreeperExplosion(mob: Mob) {
    this.createExplosion(mob.position.x, mob.position.y + 0.5, mob.position.z, 3, mob);
  }

  private createExplosion(x: number, y: number, z: number, radius: number, source?: Mob) {
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    const cz = Math.floor(z);

    // Destroy blocks in sphere
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (dx * dx + dy * dy + dz * dz > radius * radius) continue;
          const bx = cx + dx;
          const by = cy + dy;
          const bz = cz + dz;
          const blockId = this.chunks.getBlock(bx, by, bz);
          if (blockId === 0) continue;
          const def = BlockRegistry.get(blockId);
          if (!def) continue;
          if (def.hardness >= 20) continue; // obsidian-level blocks survive
          // Chain reaction: ignite nearby TNT
          if (blockId === 21) {
            this.igniteTNT(bx, by, bz);
            continue;
          }
          if (this.gameMode !== 'creative') {
            const dropId = ItemRegistry.getBlockDropItem(blockId);
            if (dropId > 0 && Math.random() < 0.6) {
              const dropPos = new THREE.Vector3(bx + 0.5, by + 0.3, bz + 0.5);
              const velocity = new THREE.Vector3(
                (bx + 0.5 - x) * 2.5 + (Math.random() - 0.5) * 1.5,
                (by + 0.5 - y) * 2.5 + 2.0 + Math.random() * 2.0,
                (bz + 0.5 - z) * 2.5 + (Math.random() - 0.5) * 1.5
              );
              this.droppedItems.spawnItem(dropId, 1, dropPos, velocity, 0.5);
            }
          }
          this.chunks.setBlock(bx, by, bz, 0);
        }
      }
    }

    // Damage entities in radius
    const explosionDamage = 49;
    const damageRadius = radius * 2 + 1;
    const playerDist = this.player.position.distanceTo(new THREE.Vector3(x, y, z));
    if (playerDist < damageRadius && this.gameMode !== 'creative') {
      const falloff = 1 - (playerDist / damageRadius);
      const damage = Math.ceil(explosionDamage * falloff);
      const knockback = new THREE.Vector3()
        .subVectors(this.player.position, new THREE.Vector3(x, y, z))
        .normalize()
        .multiplyScalar(8);
      knockback.y = 5;
      this.damagePlayer(damage, 'mob', knockback);
    }

    // Damage nearby mobs
    for (const [, otherMob] of this.mobs.mobs) {
      if (source && otherMob.id === source.id) continue;
      const dist = otherMob.position.distanceTo(new THREE.Vector3(x, y, z));
      if (dist < damageRadius) {
        const falloff = 1 - (dist / damageRadius);
        const damage = Math.ceil(explosionDamage * falloff);
        const kb = new THREE.Vector3()
          .subVectors(otherMob.position, new THREE.Vector3(x, y, z))
          .normalize()
          .multiplyScalar(6);
        kb.y = 4;
        otherMob.takeDamage(damage, kb);
      }
    }

    // Effects
    this.sound.playExplosion();
    this.particles.spawnBlockBreak(cx, cy, cz, 0x8B8B8B, 20);
  }

  private igniteTNT(wx: number, wy: number, wz: number) {
    this.chunks.setBlock(wx, wy, wz, 0); // Remove TNT block
    // Schedule explosion after 4 seconds
    const tntPos = new THREE.Vector3(wx + 0.5, wy + 0.5, wz + 0.5);
    this.tntFuses.push({ position: tntPos, timer: 4.0 });
  }

  private tntFuses: { position: THREE.Vector3; timer: number }[] = [];
  private bedSpawnPoint: THREE.Vector3 | null = null;
  chatOpen = false;
  chatInitialValue = '';
  chatMessages: string[] = [];

  private checkFluidAdjacency(x: number, y: number, z: number) {
    const dirs: [number, number, number][] = [[0,1,0],[0,-1,0],[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]];
    for (const [dx, dy, dz] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      const nz = z + dz;
      const nb = this.chunks.getBlock(nx, ny, nz);
      if (BlockRegistry.isFluid(nb)) {
        this.fluids.addSource(nx, ny, nz, nb);
      }
    }
  }

  private getBlockParticleColor(blockId: number): number {
    const baseId = blockId & 0x3FF;
    const colors: Record<number, number> = {
      1: 0x888888,   // stone
      2: 0x5B8C32,   // grass
      3: 0x8B6914,   // dirt
      4: 0x7A7A7A,   // cobblestone
      5: 0xBC9862,   // planks
      17: 0x6B511D,  // log
      18: 0x3A7D1A,  // leaves
      12: 0xE8D7A3,  // sand
      45: 0x9B4B3A,  // bricks
      20: 0xCCEEFF,  // glass
    };
    return colors[baseId] ?? 0xAAAAAA;
  }

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

  damagePlayer(amount: number, type: 'mob' | 'fall' | 'drown' | 'starve', knockback?: THREE.Vector3) {
    if (this.gameMode === 'creative') return;

    let finalDamage = amount;
    const defense = this.inventory.getTotalArmorDefense();

    if (type === 'mob' || type === 'fall') {
      const reduction = Math.min(0.8, defense * 0.04);
      const protectionReduction = this.inventory.armor.reduce((sum, item) => {
        return sum + EnchantSystem.getProtectionReduction(EnchantSystem.getLevel(item, 'protection'));
      }, 0);
      finalDamage = Math.max(1, amount * (1 - Math.min(0.9, reduction + protectionReduction)));
      
      if (defense > 0) {
        this.inventory.damageArmor(1);
      }
    }

    this.player.health = Math.max(0, this.player.health - finalDamage);

    if (knockback) {
      this.player.velocity.add(knockback);
    }

    this.damageFlashTimer = 0.3;
    this.sound.playHurt();

    this.particles.spawnDamageParticles(
      this.player.position.x,
      this.player.position.y + 1,
      this.player.position.z
    );

    if (this.player.health <= 0) {
      this.openUI = 'death';
      this.xp.reset();
      document.exitPointerLock();
      this.notifyState();
      this.renderer.render();
    }
  }

  submitChat(message: string) {
    const trimmed = message.trim();
    if (trimmed) {
      if (trimmed.startsWith('/')) {
        const result = this.commands.execute(trimmed);
        this.chatMessages.push(result.message);
      } else {
        this.chatMessages.push(trimmed);
      }
      // Keep only last 50 messages
      if (this.chatMessages.length > 50) {
        this.chatMessages = this.chatMessages.slice(-50);
      }
    }
    this.chatOpen = false;
    this.input.keys.clear();
    this.input.mouseButtons.clear();
    this.input.requestLock();
    this.lockCooldown = 0.5;
    this.notifyState();
  }

  private notifyState() {
    this.player.updateArmorMesh(this.inventory.armor);
    this.updateFpArmArmor();

    const biomeId = this.chunks.getBiomeAt(
      Math.floor(this.player.position.x),
      Math.floor(this.player.position.z)
    );

    const selectedSlot = this.inventory.getSlot(this.player.selectedSlot);
    const selectedName = selectedSlot
      ? ItemRegistry.getDisplayName(selectedSlot.id)
      : 'empty';

    const headBlock = this.chunks.getBlock(
      Math.floor(this.player.position.x),
      Math.floor(this.player.position.y + 1.62),
      Math.floor(this.player.position.z)
    );
    const isUnderwater = (headBlock & 0x3FF) === 8 || (headBlock & 0x3FF) === 9;
    const xpState = this.xp.getState();

    const state: GameState = {
      fps: this.currentFps,
      playerX: Math.round(this.player.position.x * 10) / 10,
      playerY: Math.round(this.player.position.y * 10) / 10,
      playerZ: Math.round(this.player.position.z * 10) / 10,
      biome: BIOME_NAMES[biomeId] || 'Unknown',
      chunkCount: this.chunks.getLoadedChunkCount(),
      mobCount: this.mobs.mobs.size,
      selectedBlock: selectedName,
      selectedSlot: this.player.selectedSlot,
      health: this.player.health,
      hunger: this.player.hunger,
      oxygen: this.player.oxygen,
      onGround: this.player.onGround,
      flying: this.player.flying,
      openUI: this.openUI,
      inventory: this.inventory,
      chestInventory: this.getOpenChestInventory(),
      heldItemId: selectedSlot?.id ?? 0,
      isNight: this.isNight(),
      isUnderwater,
      gameMode: this.gameMode,
      activeSlot: this.activeSlot,
      chatOpen: this.chatOpen,
      chatInitialValue: this.chatInitialValue,
      chatMessages: this.chatMessages,
      xpLevel: xpState.level,
      xpProgress: xpState.progress,
      xpCurrent: xpState.current,
      xpNext: xpState.next,
    };

    for (const listener of this.stateListeners) {
      listener(state);
    }
  }

  private isNight(): boolean {
    return this.gameTime >= NIGHT_START && this.gameTime <= NIGHT_END;
  }

  private async saveGame() {
    const chunkData: SaveData['chunks'] = [];
    for (const [, chunk] of this.chunks.chunks) {
      chunkData.push({
        cx: chunk.cx,
        cz: chunk.cz,
        data: new Uint16Array(chunk.data),
        metadata: chunk.serializeMetadata(),
      });
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
        gameMode: this.gameMode,
        perspectiveMode: this.perspectiveMode,
        xpLevel: this.xp.getState().level,
        xpCurrent: this.xp.getState().current,
        xpTotal: this.xp.getState().total,
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
      await SaveSystem.save(saveData, this.activeSlot);
    } catch (e) {
      console.warn('Save failed:', e);
    }
  }

  async loadGame() {
    try {
      const data = await SaveSystem.load(this.activeSlot);
      if (!data) return;

      this.player.position.set(data.player.x, data.player.y, data.player.z);
      this.player.yaw = typeof data.player.yaw === 'number' && !isNaN(data.player.yaw) ? data.player.yaw : 0;
      this.player.pitch = typeof data.player.pitch === 'number' && !isNaN(data.player.pitch) ? data.player.pitch : 0;
      this.player.health = data.player.health;
      this.player.hunger = data.player.hunger;
      this.player.flying = data.player.flying;
      if (data.player.gameMode) {
        this.gameMode = data.player.gameMode;
      }
      if (data.player.perspectiveMode) {
        this.perspectiveMode = data.player.perspectiveMode;
      }
      this.xp.setState(
        data.player.xpLevel ?? 0,
        data.player.xpCurrent ?? 0,
        data.player.xpTotal ?? 0
      );

      if (data.inventory) {
        this.inventory.fromJSON(data.inventory.slots);
        if (data.inventory.armor && Array.isArray(data.inventory.armor)) {
          this.inventory.armor = [...data.inventory.armor];
          while (this.inventory.armor.length < 4) {
            this.inventory.armor.push(null);
          }
        } else {
          this.inventory.armor = new Array(4).fill(null);
        }
      }

      if (data.chunks) {
        for (const chunk of data.chunks) {
          this.chunks.restoreChunk(chunk.cx, chunk.cz, chunk.data, chunk.metadata);
        }
      }

      this.restoreRedstoneFromLoadedChunks();
      this.chunks.update(this.player.position.x, this.player.position.z);
      this.player.resolveStuck(this.chunks);

      console.log('Game loaded from save');
      this.notifyState();
    } catch (e) {
      console.warn('Load failed:', e);
    }
  }

  private setPlacedBlockMetadata(x: number, y: number, z: number, blockId: number, facing: BlockFacing) {
    const redstoneType = this.getRedstoneType(blockId);
    if (redstoneType) {
      this.redstone.register(x, y, z, redstoneType, facing);
      this.chunks.setBlockMeta(x, y, z, {
        facing,
        redstoneType,
        powered: false,
        signal: 0,
        extended: false,
      }, true);
      return;
    }

    const def = BlockRegistry.get(blockId);
    if (!def) return;
    const name = def.name;

    if (name === 'chest') {
      this.chunks.setBlockMeta(x, y, z, {
        facing,
        containerType: 'chest',
        inventory: new Array(27).fill(null),
      }, true);
      return;
    }

    if (name.includes('trapdoor')) {
      let hingeFacing = facing;
      if (facing === 'up' || facing === 'down') {
        hingeFacing = this.getPlayerHorizontalFacing();
      } else {
        if (facing === 'north') hingeFacing = 'south';
        else if (facing === 'south') hingeFacing = 'north';
        else if (facing === 'east') hingeFacing = 'west';
        else if (facing === 'west') hingeFacing = 'east';
      }
      this.chunks.setBlockMeta(x, y, z, {
        facing: hingeFacing,
        open: false,
      }, true);
      return;
    }

    if (this.usesFacingMetadata(blockId)) {
      this.chunks.setBlockMeta(x, y, z, { facing }, true);
    }
  }

  private getRedstoneType(blockId: number): BlockMetadata['redstoneType'] | null {
    const def = BlockRegistry.get(blockId);
    if (!def) return null;
    const name = def.name;
    if (name === 'redstone_torch' || name === 'unlit_redstone_torch') return 'torch';
    if (name === 'redstone_wire') return 'wire';
    if (name === 'unpowered_repeater' || name === 'powered_repeater') return 'repeater';
    if (name === 'piston' || name === 'sticky_piston') return 'piston';
    if (name === 'lever') return 'lever';
    return null;
  }

  private usesFacingMetadata(blockId: number): boolean {
    const def = BlockRegistry.get(blockId);
    if (!def) return false;
    const name = def.name;
    return name.includes('furnace') || name === 'chest' || name.includes('trapdoor') || name === 'crafting_table' || name.includes('stairs') || name.includes('repeater') || name.includes('piston') || name.includes('door');
  }

  private isDoorBlock(blockId: number): boolean {
    const def = BlockRegistry.get(blockId);
    return def ? def.name.endsWith('door') && !def.name.includes('trapdoor') : false;
  }

  private isTrapdoorBlock(blockId: number): boolean {
    const def = BlockRegistry.get(blockId);
    return def ? def.name.includes('trapdoor') : false;
  }

  private getPlayerHorizontalFacing(): BlockFacing {
    const forward = this.player.forward;
    if (Math.abs(forward.x) > Math.abs(forward.z)) {
      return forward.x > 0 ? 'east' : 'west';
    }
    return forward.z > 0 ? 'south' : 'north';
  }

  private getDoorNeighborPosition(x: number, z: number, facing: BlockFacing, side: 'left' | 'right') {
    switch (facing) {
      case 'north':
        return side === 'left' ? { x: x - 1, z } : { x: x + 1, z };
      case 'south':
        return side === 'left' ? { x: x + 1, z } : { x: x - 1, z };
      case 'east':
        return side === 'left' ? { x, z: z - 1 } : { x, z: z + 1 };
      case 'west':
        return side === 'left' ? { x, z: z + 1 } : { x, z: z - 1 };
      default:
        return side === 'left' ? { x: x - 1, z } : { x: x + 1, z };
    }
  }

  private getDoorHinge(x: number, y: number, z: number, facing: BlockFacing): 'left' | 'right' {
    const leftNeighbor = this.getDoorNeighborPosition(x, z, facing, 'left');
    const rightNeighbor = this.getDoorNeighborPosition(x, z, facing, 'right');

    const leftMeta = this.chunks.getBlockMeta(leftNeighbor.x, y, leftNeighbor.z);
    const rightMeta = this.chunks.getBlockMeta(rightNeighbor.x, y, rightNeighbor.z);
    const leftBlock = this.chunks.getBlock(leftNeighbor.x, y, leftNeighbor.z);
    const rightBlock = this.chunks.getBlock(rightNeighbor.x, y, rightNeighbor.z);

    if (this.isDoorBlock(leftBlock) && leftMeta?.facing === facing) {
      return 'right';
    }
    if (this.isDoorBlock(rightBlock) && rightMeta?.facing === facing) {
      return 'left';
    }

    const centerX = x + 0.5;
    const centerZ = z + 0.5;
    switch (facing) {
      case 'north':
        return this.player.position.x < centerX ? 'left' : 'right';
      case 'south':
        return this.player.position.x > centerX ? 'left' : 'right';
      case 'east':
        return this.player.position.z < centerZ ? 'left' : 'right';
      case 'west':
        return this.player.position.z > centerZ ? 'left' : 'right';
      default:
        return 'left';
    }
  }

  private placeDoor(x: number, y: number, z: number, doorBlockId: number): boolean {
    if (y < 0 || y >= 254) return false;
    if (this.chunks.getBlock(x, y, z) !== 0 || this.chunks.getBlock(x, y + 1, z) !== 0) {
      return false;
    }

    const px = Math.floor(this.player.position.x);
    const py = Math.floor(this.player.position.y);
    const pz = Math.floor(this.player.position.z);
    if (x === px && z === pz && (y === py || y === py + 1 || y + 1 === py || y + 1 === py + 1)) {
      return false;
    }

    const facing = this.getPlayerHorizontalFacing();
    const hinge = this.getDoorHinge(x, y, z, facing);
    this.chunks.setBlock(x, y, z, doorBlockId);
    this.chunks.setBlockMeta(x, y, z, {
      facing,
      doorHalf: 'lower',
      hinge,
      open: false,
    }, true);

    this.chunks.setBlock(x, y + 1, z, doorBlockId);
    this.chunks.setBlockMeta(x, y + 1, z, {
      facing,
      doorHalf: 'upper',
      hinge,
      open: false,
    }, true);

    return true;
  }

  private getDoorBase(x: number, y: number, z: number): { x: number; y: number; z: number } | null {
    const blockId = this.chunks.getBlock(x, y, z);
    if (!this.isDoorBlock(blockId)) return null;

    const meta = this.chunks.getBlockMeta(x, y, z);
    if (meta?.doorHalf === 'upper') {
      return { x, y: y - 1, z };
    }
    if (meta?.doorHalf === 'lower') {
      return { x, y, z };
    }

    if (this.isDoorBlock(this.chunks.getBlock(x, y - 1, z))) {
      return { x, y: y - 1, z };
    }
    return { x, y, z };
  }

  private toggleDoor(x: number, y: number, z: number) {
    const base = this.getDoorBase(x, y, z);
    if (!base) return;

    const lowerMeta = this.chunks.getBlockMeta(base.x, base.y, base.z);
    const upperMeta = this.chunks.getBlockMeta(base.x, base.y + 1, base.z);
    const open = !(lowerMeta?.open ?? upperMeta?.open ?? false);
    const facing = lowerMeta?.facing ?? upperMeta?.facing ?? 'north';
    const hinge = lowerMeta?.hinge ?? upperMeta?.hinge ?? 'left';
    const blockId = this.chunks.getBlock(base.x, base.y, base.z);

    this.chunks.setBlock(base.x, base.y, base.z, blockId);
    this.chunks.setBlockMeta(base.x, base.y, base.z, {
      ...lowerMeta,
      facing,
      doorHalf: 'lower',
      hinge,
      open,
    }, true);

    if (this.isDoorBlock(this.chunks.getBlock(base.x, base.y + 1, base.z))) {
      this.chunks.setBlock(base.x, base.y + 1, base.z, blockId);
      this.chunks.setBlockMeta(base.x, base.y + 1, base.z, {
        ...upperMeta,
        facing,
        doorHalf: 'upper',
        hinge,
        open,
      }, true);
    }
  }

  private breakDoor(x: number, y: number, z: number) {
    const base = this.getDoorBase(x, y, z);
    if (!base) return;

    this.chunks.setBlock(base.x, base.y, base.z, 0);
    this.chunks.setBlockMeta(base.x, base.y, base.z, null);

    if (this.isDoorBlock(this.chunks.getBlock(base.x, base.y + 1, base.z))) {
      this.chunks.setBlock(base.x, base.y + 1, base.z, 0);
      this.chunks.setBlockMeta(base.x, base.y + 1, base.z, null);
    }
  }

  private toggleTrapdoor(x: number, y: number, z: number) {
    const blockId = this.chunks.getBlock(x, y, z);
    if (!this.isTrapdoorBlock(blockId)) return;

    const meta = this.chunks.getBlockMeta(x, y, z);
    const open = !(meta?.open ?? false);

    this.chunks.setBlockMeta(x, y, z, {
      ...meta,
      open,
    }, true);
  }

  private ensureChestMetadata(x: number, y: number, z: number): BlockMetadata | null {
    const blockId = this.chunks.getBlock(x, y, z);
    const def = BlockRegistry.get(blockId);
    if (!def || def.name !== 'chest') return null;

    const current = this.chunks.getBlockMeta(x, y, z);
    if (current?.containerType === 'chest' && current.inventory) {
      return current;
    }

    const metadata: BlockMetadata = {
      ...current,
      containerType: 'chest',
      inventory: new Array(27).fill(null),
    };
    this.chunks.setBlockMeta(x, y, z, metadata);
    return metadata;
  }

  private getOpenChestInventory(): (ItemStack | null)[] | null {
    if (!this.openChestPos) return null;

    const metadata = this.ensureChestMetadata(
      this.openChestPos.x,
      this.openChestPos.y,
      this.openChestPos.z
    );
    return metadata?.inventory ?? null;
  }

  private updateRedstoneMetadata(x: number, y: number, z: number, patch: BlockMetadata) {
    const current = this.chunks.getBlockMeta(x, y, z);
    if (!current?.redstoneType) return;

    this.chunks.setBlockMeta(x, y, z, {
      ...current,
      ...patch,
    });
  }

  private restoreRedstoneFromLoadedChunks() {
    this.redstone.dispose();

    for (const chunk of this.chunks.chunks.values()) {
      for (const { index, metadata } of chunk.serializeMetadata()) {
        if (!metadata.redstoneType) continue;

        const localX = index % CHUNK_SIZE;
        const localZ = Math.floor(index / CHUNK_SIZE) % CHUNK_SIZE;
        const localY = Math.floor(index / (CHUNK_SIZE * CHUNK_SIZE));
        const worldX = chunk.cx * CHUNK_SIZE + localX;
        const worldZ = chunk.cz * CHUNK_SIZE + localZ;
        this.redstone.register(
          worldX,
          localY,
          worldZ,
          metadata.redstoneType,
          metadata.facing ?? 'north',
          {
            signal: metadata.signal ?? 0,
            state: metadata.powered ?? metadata.extended ?? false,
          }
        );
      }
    }
  }

  private resolveCollisions() {
    const getBlock = (x: number, y: number, z: number) => this.chunks.getBlock(x, y, z);

    // 1. Resolve Mob-Mob collisions
    const mobs = Array.from(this.mobs.mobs.values());
    for (let i = 0; i < mobs.length; i++) {
      for (let j = i + 1; j < mobs.length; j++) {
        const mobA = mobs[i];
        const mobB = mobs[j];

        const hwA = mobA.def.width / 2;
        const hwB = mobB.def.width / 2;
        const dx = mobA.position.x - mobB.position.x;
        const dz = mobA.position.z - mobB.position.z;
        const distSq = dx * dx + dz * dz;
        const minDist = hwA + hwB;

        if (distSq < minDist * minDist) {
          // Check Y overlap
          const yOverlap = (mobA.position.y < mobB.position.y + mobB.def.height) &&
                           (mobA.position.y + mobA.def.height > mobB.position.y);
          if (yOverlap) {
            let dist = Math.sqrt(distSq);
            let localDx = dx;
            let localDz = dz;
            if (dist === 0) {
              dist = 0.001;
              localDx = 0.001;
              localDz = 0;
            }
            const overlap = minDist - dist;
            const pushX = (localDx / dist) * overlap * 0.5;
            const pushZ = (localDz / dist) * overlap * 0.5;

            // Push mobA
            mobA.position.x += pushX;
            if (mobA.checkCollision(getBlock)) mobA.position.x -= pushX;
            mobA.position.z += pushZ;
            if (mobA.checkCollision(getBlock)) mobA.position.z -= pushZ;

            // Push mobB
            mobB.position.x -= pushX;
            if (mobB.checkCollision(getBlock)) mobB.position.x += pushX;
            mobB.position.z -= pushZ;
            if (mobB.checkCollision(getBlock)) mobB.position.z += pushZ;

            // Update meshes
            mobA.mesh.position.copy(mobA.position);
            mobB.mesh.position.copy(mobB.position);
          }
        }
      }
    }

    // 2. Resolve Player-Mob collisions
    const player = this.player;
    const hwP = 0.3; // PLAYER_WIDTH / 2
    const playerHeight = 1.8; // PLAYER_HEIGHT

    for (const mob of mobs) {
      const hwM = mob.def.width / 2;
      const dx = player.position.x - mob.position.x;
      const dz = player.position.z - mob.position.z;
      const distSq = dx * dx + dz * dz;
      const minDist = hwP + hwM;

      if (distSq < minDist * minDist) {
        // Check Y overlap
        const yOverlap = (player.position.y < mob.position.y + mob.def.height) &&
                         (player.position.y + playerHeight > mob.position.y);
        if (yOverlap) {
          let dist = Math.sqrt(distSq);
          let localDx = dx;
          let localDz = dz;
          if (dist === 0) {
            dist = 0.001;
            localDx = 0.001;
            localDz = 0;
          }
          const overlap = minDist - dist;

          // Player is heavier or has control: push player by 30%, mob by 70%
          const pushPx = (localDx / dist) * overlap * 0.3;
          const pushPz = (localDz / dist) * overlap * 0.3;
          const pushMx = -(localDx / dist) * overlap * 0.7;
          const pushMz = -(localDz / dist) * overlap * 0.7;

          // Push Player
          player.position.x += pushPx;
          if (player.checkCollision(this.chunks)) player.position.x -= pushPx;
          player.position.z += pushPz;
          if (player.checkCollision(this.chunks)) player.position.z -= pushPz;

          // Push Mob
          mob.position.x += pushMx;
          if (mob.checkCollision(getBlock)) mob.position.x -= pushMx;
          mob.position.z += pushMz;
          if (mob.checkCollision(getBlock)) mob.position.z -= pushMz;

          // Update mob mesh
          mob.mesh.position.copy(mob.position);
        }
      }
    }
  }

  getItemIconStyle(itemId: number, iconSize: number = 32): any {
    const key = VisualResolver.getItemIconKey(itemId);
    return this.atlas.getIconStyle(key, iconSize);
  }

  updateFpArmArmor() {
    if (!this.fpArmGroup) return;
    const armMesh = this.fpArmGroup.getObjectByName('armMesh') as THREE.Mesh;
    if (!armMesh) return;

    const chestplate = this.inventory.armor[1];
    let color = 0x008080; // default teal shirt color
    if (chestplate) {
      const itemDef = ItemRegistry.get(chestplate.id);
      if (itemDef && itemDef.category === 'armor') {
        const isIron = itemDef.name.startsWith('iron_');
        color = isIron ? 0xd8d8d8 : 0x55ffff;
      }
    }

    if (Array.isArray(armMesh.material)) {
      armMesh.material.forEach((m) => {
        if (m && 'color' in m) (m as any).color.setHex(color);
      });
    } else {
      if (armMesh.material && 'color' in armMesh.material) {
        (armMesh.material as any).color.setHex(color);
      }
    }
  }

  private updateDynamicLighting() {
    const lightPositions: THREE.Vector3[] = [];
    
    // Check if player is holding a torch
    const heldItemId = this.inventory.getSlot(this.player.selectedSlot)?.id ?? 0;
    if (BlockRegistry.isTorch(heldItemId)) {
      lightPositions.push(new THREE.Vector3(
        this.player.position.x,
        this.player.position.y + 1.0,
        this.player.position.z
      ));
    }

    // Scan for placed torches or lava blocks around player
    const px = Math.floor(this.player.position.x);
    const py = Math.floor(this.player.position.y);
    const pz = Math.floor(this.player.position.z);
    const radius = 12;

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dz = -radius; dz <= radius; dz++) {
          const blockId = this.chunks.getBlock(px + dx, py + dy, pz + dz);
          // Torch or Lava
          if (BlockRegistry.isTorch(blockId) || BlockRegistry.isLava(blockId)) {
            lightPositions.push(new THREE.Vector3(px + dx + 0.5, py + dy + 0.5, pz + dz + 0.5));
          }
        }
      }
    }

    // Sort by distance to player
    lightPositions.sort((a, b) => a.distanceToSquared(this.player.position) - b.distanceToSquared(this.player.position));
    this.renderer.updateTorchLights(lightPositions.slice(0, 4));
  }

  dispose() {
    this.running = false;
    this.container.removeEventListener('click', this.handleContainerClick);
    if (this.openUI !== 'menu') {
      this.saveGame();
    }
    this.mobs.dispose();
    this.particles.dispose();
    this.xp.dispose();
    this.weather.dispose();
    this.sound.dispose();
    this.redstone.dispose();
    this.input.dispose();
    this.renderer.dispose();
  }
}
