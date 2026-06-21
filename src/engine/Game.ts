import * as THREE from 'three';
import { Renderer } from './Renderer';
import { InputManager } from './InputManager';
import { TextureAtlas } from './TextureAtlas';
import { ChunkManager } from '../world/ChunkManager';
import { WorldGen } from '../world/WorldGen';
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
import { ResourcePackSystem } from '../systems/ResourcePackSystem';
import { DataPackSystem } from '../systems/DataPackSystem';
import { SaveSystem, type SaveData } from '../systems/SaveSystem';
import { RedstoneSystem, type RedstoneEntity } from '../systems/RedstoneSystem';
import { ProjectileSystem, type ProjectileType } from '../systems/ProjectileSystem';
import { CommandSystem } from '../systems/CommandSystem';
import { VisualResolver } from '../visual/VisualResolver';
import { Dimension, DimensionGenerator } from '../world/DimensionGenerator';
import { DroppedItemSystem } from '../systems/DroppedItemSystem';
import { VehicleSystem, Vehicle } from '../systems/VehicleSystem';
import { XPSystem } from '../systems/XPSystem';
import { EnchantSystem } from '../systems/EnchantSystem';
import { PotionEffectSystem } from '../systems/PotionEffect';
import { GameRuleSystem } from '../systems/GameRuleSystem';
import { AdvancementSystem } from '../systems/AdvancementSystem';
import { MapSystem } from '../systems/MapSystem';
import { HopperSystem } from '../systems/HopperSystem';
import { VillageSystem, type TradeOffer, type VillagerProfession } from '../systems/VillageSystem';
import { EnderDragonSystem } from '../systems/EnderDragonSystem';
import { findSmeltingResult, isSmeltingFuel, getFuelBurnTime } from '../items/SmeltingRecipes';
import { CHUNK_SIZE, PLAYER_HEIGHT, PLAYER_WIDTH, PLAYER_CRAWL_HEIGHT, RENDER_DISTANCE, SEA_LEVEL, WORLD_HEIGHT } from '../constants';
import type { Enchantment } from '../systems/EnchantSystem';
import type { ActivePotionEffect, BlockFacing, BlockMetadata, ItemStack } from '../types';
import { NetworkClient } from '../server/NetworkClient';
import { PacketType } from '../server/NetworkProtocol';

const HONEY_BOTTLE_ID = 454;
const GLASS_BOTTLE_ID = 374;
const ENDER_EYE_ID = 381;
const ENDER_PEARL_ID = 368;
const SNOWBALL_ID = 332;
const EGG_ID = 344;
const FISHING_ROD_ID = 346;
const RAW_FISH_ID = 349;
const RAW_SALMON_ID = (1 << 10) | 349;
const CLOWNFISH_ID = (2 << 10) | 349;
const PUFFERFISH_ID = (3 << 10) | 349;
const TRIDENT_ID = 20275;
const FIREWORK_ROCKET_ID = 401;
const MODERN_FIREWORK_ROCKET_ID = 20096;
const END_PORTAL_ID = 119;
const END_PORTAL_FRAME_ID = 120;
const FILLED_MAP_ID = 358;
const WRITABLE_BOOK_ID = 386;
const WRITTEN_BOOK_ID = 387;
const EMPTY_MAP_ID = 395;
const SHIELD_ID = 442;
const SHIELD_MAX_DURABILITY = 336;
const BOW_FULL_CHARGE_TIME = 1.0;
const BOW_MIN_RELEASE_TIME = 0.15;
const BOW_BASE_DAMAGE = 6;
const BOW_MIN_SPEED = 7;
const BOW_MAX_SPEED = 30;
const WORLD_SPAWN_X = 8;
const WORLD_SPAWN_Z = 8;

export type UIType = 'none' | 'inventory' | 'furnace' | 'crafting_table' | 'chest' | 'hopper' | 'enchanting_table' | 'anvil' | 'brewing_stand' | 'trading' | 'death' | 'menu' | 'pause' | 'end_poem' | 'sign_edit' | 'advancements' | 'map' | 'book';

type FishingBobberState = {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  phase: 'flying' | 'waiting' | 'hooked';
  waitTimer: number;
  hookedTimer: number;
};

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
  chestTitleKey: 'chest' | 'doubleChest' | 'barrel';
  hopperInventory: (ItemStack | null)[] | null;
  furnaceInventory: (ItemStack | null)[] | null;
  furnaceType: 'furnace' | 'smoker' | 'blast_furnace' | null;
  furnaceBurnTime?: number;
  furnaceCookTime?: number;
  furnaceMaxBurnTime?: number;
  brewingInventory: (ItemStack | null)[] | null;
  tradingOffers: TradeOffer[] | null;
  tradingProfession: VillagerProfession | null;
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
  activePotionEffects: ActivePotionEffect[];
  portalProgress: number;
  isBlocking: boolean;
  bowChargeProgress: number;
  attackCooldownProgress: number;
  lookedAtSignText?: string[] | null;
  currentDimension: number;
  bossName: string | null;
  bossHealth: number;
  bossMaxHealth: number;
  openMapItem: ItemStack | null;
  openBookItem: ItemStack | null;
  openBookEditable: boolean;
  unlockedAdvancements?: string[];
  gamerules?: {
    difficulty: string;
    rules: any;
  };
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
  network: NetworkClient;
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
  private potionEffects: PotionEffectSystem;
  private maps: MapSystem;
  private hoppers: HopperSystem;
  private enderDragon: EnderDragonSystem;
  vehicles: VehicleSystem;
  riddenVehicle: Vehicle | null = null;
  editingSignPos: THREE.Vector3 | null = null;
  editingBookSlot: number | null = null;
  openMapSlot: number | null = null;
  lookedAtSignText: string[] | null = null;
  private commands: CommandSystem;
  private clock: THREE.Clock;
  gamerules!: GameRuleSystem;
  advancements!: AdvancementSystem;
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
  private portalTimer = 0;
  private portalCooldown = 0;
  openUI: UIType = 'none';
  gameMode: 'survival' | 'creative' = 'survival';
  riddenMob: Mob | null = null;
  private autoSaveTimer = 0;
  private breakProgress = 0;
  private breakingBlockPos: THREE.Vector3 | null = null;
  private lastFrameWasBreaking = false;
  private seed = 12345;
  private gameTime = 0.05; // 0=sunrise, 0.25=noon, 0.5=sunset, 0.75=midnight
  private damageFlashTimer = 0;
  private swordSwingTimer = 0;
  private attackCooldownTimer = 0;
  private attackCooldownDuration = 0.625;
  private isShieldBlocking = false;
  private bowChargeTimer = 0;
  private bowChargeActive = false;
  private fishingBobber: FishingBobberState | null = null;
  private eatingTimer = 0;
  private chewSoundTimer = 0;
  private stepTimer = 0;
  private perspectiveMode: 'first' | 'third' = 'first';
  private container: HTMLElement;
  private fpArmGroup!: THREE.Group;
  private fpLastHeldItemId = -1;
  private openChestPos: THREE.Vector3 | null = null;
  private openHopperPos: THREE.Vector3 | null = null;
  private openFurnacePos: THREE.Vector3 | null = null;
  private openBrewingPos: THREE.Vector3 | null = null;
  private tradingProfession: VillagerProfession | null = null;
  private lastLightRebuildTime = -1;
  private lightScanTimer = 0;
  private ambientTimer = 0;
  private farmingTickTimer = 0;
  private furnaceTickTimer = 0;
  private particleScanTimer = 0;
  private ambientParticleSources: { x: number; y: number; z: number; type: 'torch' | 'furnace' | 'enchanting_table' }[] = [];

  activeSlot: string = 'world_1';

  constructor(container: HTMLElement, initialMode?: 'survival' | 'creative', initialSlot?: string) {
    this.container = container;
    this.activeSlot = initialSlot ?? 'world_1';
    this.gameMode = initialMode ?? 'survival';
    this.openUI = 'menu';
    this.renderer = new Renderer(container);
    this.input = new InputManager(this.renderer.renderer.domElement);
    this.atlas = new TextureAtlas();
    this.network = new NetworkClient(this);
    this.chunks = new ChunkManager(this.renderer.scene, this.atlas, this.seed, this);
    this.clock = new THREE.Clock();
    this.inventory = new Inventory();
    this.survival = new SurvivalSystem();
    this.mobs = new MobSystem(this.renderer.scene);
    this.vehicles = new VehicleSystem(this.renderer.scene);
    this.particles = new ParticleSystem(this.renderer.scene);
    this.fluids = new FluidSystem();
    this.sound = new SoundSystem();
    this.loadDataPack();
    this.loadResourcePack();
    this.weather = new WeatherSystem(this.renderer.scene, this.sound);
    this.redstone = new RedstoneSystem();
    this.projectiles = new ProjectileSystem(this.renderer.scene);
    this.xp = new XPSystem(this.renderer.scene);
    this.potionEffects = new PotionEffectSystem();
    this.maps = new MapSystem();
    this.enderDragon = new EnderDragonSystem(this.renderer.scene);
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
      setGameRule: (name, value) => { this.gamerules.setRule(name as any, value); this.syncGamerulesToSystems(); },
      getGameRule: (name) => this.gamerules.getRule(name as any),
      setDifficulty: (diff) => { this.gamerules.setDifficulty(diff as any); this.syncGamerulesToSystems(); },
      getDifficulty: () => this.gamerules.getDifficulty(),
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
    this.inventory.setSlot(9, { id: EMPTY_MAP_ID, count: 1 });  // Empty Map
    this.inventory.setSlot(10, { id: WRITABLE_BOOK_ID, count: 1, book: { pages: [''] } }); // Book and Quill


    // Spawn
    const spawn = this.findSafeWorldSpawnPosition();
    this.player = new Player(spawn.x, spawn.y, spawn.z);
    this.droppedItems = new DroppedItemSystem(this.renderer.scene, (itemId) => this.player.createItemVisualMesh(itemId));
    this.hoppers = new HopperSystem(this.chunks, this.droppedItems, () => this.notifyState());
    this.chunks.update(spawn.x, spawn.z);
    this.player.resolveStuck(this.chunks);
    this.renderer.scene.add(this.player.mesh);

    // Pointer lock
    this.container.addEventListener('click', this.handleContainerClick);

    this.createHighlight();

    this.fpArmGroup = this.createFpArm();
    this.renderer.camera.add(this.fpArmGroup);

    this.gamerules = new GameRuleSystem();
    this.advancements = new AdvancementSystem(this.sound);
    this.syncGamerulesToSystems();

    this.running = true;
    this.animate();
  }

  private async loadResourcePack() {
    const pack = await ResourcePackSystem.loadActivePack();
    if (!pack) return;
    await Promise.all([
      this.atlas.applyResourcePack(pack),
      this.sound.applyResourcePack(pack),
    ]);
    console.info(`Resource pack loaded: ${pack.manifest.pack.name}`);
  }

  private async loadDataPack() {
    const pack = await DataPackSystem.loadActivePack();
    if (!pack) return;
    DataPackSystem.apply(pack);
    console.info(`Data pack loaded: ${pack.manifest.pack.name}`);
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

  openFurnaceUI(x: number, y: number, z: number) {
    const metadata = this.ensureFurnaceMetadata(x, y, z);
    if (!metadata) return;

    this.openFurnacePos = new THREE.Vector3(x, y, z);
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

  openHopperUI(x: number, y: number, z: number) {
    const metadata = this.ensureHopperMetadata(x, y, z);
    if (!metadata) return;

    this.openHopperPos = new THREE.Vector3(x, y, z);
    this.openUI = 'hopper';
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

  openBrewingUI(x: number, y: number, z: number) {
    const metadata = this.ensureBrewingMetadata(x, y, z);
    if (!metadata) return;

    this.openBrewingPos = new THREE.Vector3(x, y, z);
    this.openUI = 'brewing_stand';
    document.exitPointerLock();
  }

  openTradingUI(profession: VillagerProfession) {
    this.tradingProfession = profession;
    this.openUI = 'trading';
    document.exitPointerLock();
    this.notifyState();
  }

  openMapUI(slotIndex: number) {
    this.openMapSlot = slotIndex;
    this.openUI = 'map';
    document.exitPointerLock();
    this.notifyState();
  }

  openBookUI(slotIndex: number) {
    this.editingBookSlot = slotIndex;
    this.openUI = 'book';
    document.exitPointerLock();
    this.notifyState();
  }

  performTrade(offer: TradeOffer): boolean {
    const traded = VillageSystem.performTrade(this.inventory, offer, this.gameMode === 'creative');
    if (traded) {
      this.sound.playPickup();
      this.notifyState();
    }
    return traded;
  }

  enchantItem(item: ItemStack, cost: number, enchantment: Enchantment): ItemStack | null {
    if (this.gameMode !== 'creative' && !this.xp.spendLevels(cost)) {
      return null;
    }

    const enchanted = EnchantSystem.apply(item, enchantment);
    this.sound.playXP();
    this.advancements.checkEnchant();
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

    if (!this.network.isConnected) {
      this.network.connect('mock://local', 'Player', this.gameMode, this.activeSlot);
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
      this.saveOpenChestInventory();
      this.openChestPos = null;
    } else if (this.openUI === 'hopper') {
      this.openHopperPos = null;
    } else if (this.openUI === 'furnace') {
      this.openFurnacePos = null;
    } else if (this.openUI === 'brewing_stand') {
      this.openBrewingPos = null;
    } else if (this.openUI === 'trading') {
      this.tradingProfession = null;
    } else if (this.openUI === 'book') {
      this.editingBookSlot = null;
    } else if (this.openUI === 'map') {
      this.openMapSlot = null;
    }
    this.openUI = 'none';
    this.input.requestLock();
    this.lockCooldown = 0.5;
    this.notifyState();
  }

  saveSignText(lines: string[]) {
    if (this.editingSignPos) {
      const pos = this.editingSignPos;
      const currentMeta = this.chunks.getBlockMeta(pos.x, pos.y, pos.z) || {};
      this.chunks.setBlockMeta(pos.x, pos.y, pos.z, { ...currentMeta, signText: lines }, true);
      this.editingSignPos = null;
    }
    this.openUI = 'none';
    this.input.requestLock();
    this.lockCooldown = 0.5;
    this.notifyState();
  }

  saveBook(pages: string[], title?: string) {
    if (this.editingBookSlot === null) return;

    const slot = this.inventory.getSlot(this.editingBookSlot);
    if (!slot || (slot.id !== WRITABLE_BOOK_ID && slot.id !== WRITTEN_BOOK_ID)) return;

    const cleanPages = pages.map((page) => page.slice(0, 1024)).slice(0, 50);
    if (title && slot.id === WRITABLE_BOOK_ID) {
      slot.id = WRITTEN_BOOK_ID;
      slot.count = 1;
      slot.customName = title.slice(0, 32);
      slot.book = {
        title: title.slice(0, 32),
        author: 'Steve',
        pages: cleanPages.length > 0 ? cleanPages : [''],
        signed: true,
      };
    } else {
      slot.book = {
        ...(slot.book ?? {}),
        pages: cleanPages.length > 0 ? cleanPages : [''],
        signed: slot.id === WRITTEN_BOOK_ID || slot.book?.signed,
      };
    }

    this.editingBookSlot = null;
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
    this.potionEffects.clear();

    this.openUI = 'none';
    this.input.requestLock();
    this.lockCooldown = 0.5;
    this.notifyState();
  }

  private findSafeRespawnPosition(): THREE.Vector3 {
    const spawnPoint = new THREE.Vector3(WORLD_SPAWN_X + 0.5, 0, WORLD_SPAWN_Z + 0.5);
    let bestPos: THREE.Vector3 | null = null;

    for (let attempt = 0; attempt < 30; attempt++) {
      // Choose a random distance (30 to 80 blocks) and angle
      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 50;
      const rx = Math.floor(spawnPoint.x + Math.cos(angle) * dist);
      const rz = Math.floor(spawnPoint.z + Math.sin(angle) * dist);

      // Get surface Y height
      const ry = this.chunks.getWorldGen().getTerrainHeight(rx, rz);
      if (ry <= SEA_LEVEL + 1) {
        continue;
      }

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
      bestPos = this.findSafeWorldSpawnPosition();
    }

    return bestPos;
  }

  private findSafeWorldSpawnPosition(): THREE.Vector3 {
    const worldGen = this.chunks.getWorldGen();
    const maxRadius = 128;

    for (let radius = 0; radius <= maxRadius; radius += 4) {
      for (let dx = -radius; dx <= radius; dx += 4) {
        for (let dz = -radius; dz <= radius; dz += 4) {
          if (radius !== 0 && Math.abs(dx) !== radius && Math.abs(dz) !== radius) continue;

          const x = WORLD_SPAWN_X + dx;
          const z = WORLD_SPAWN_Z + dz;
          const y = worldGen.getTerrainHeight(x, z);

          if (y <= SEA_LEVEL + 1) continue;

          return new THREE.Vector3(x + 0.5, y + 2, z + 0.5);
        }
      }
    }

    const fallbackY = Math.max(worldGen.getTerrainHeight(WORLD_SPAWN_X, WORLD_SPAWN_Z) + 2, SEA_LEVEL + 2);
    return new THREE.Vector3(WORLD_SPAWN_X + 0.5, fallbackY, WORLD_SPAWN_Z + 0.5);
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

    const wasAttackCoolingDown = this.attackCooldownTimer > 0;
    this.breakCooldown = Math.max(0, this.breakCooldown - dt);
    this.placeCooldown = Math.max(0, this.placeCooldown - dt);
    this.damageFlashTimer = Math.max(0, this.damageFlashTimer - dt);
    this.swordSwingTimer = Math.max(0, this.swordSwingTimer - dt);
    this.attackCooldownTimer = Math.max(0, this.attackCooldownTimer - dt);
    if (wasAttackCoolingDown) {
      this.notifyState();
    }
    this.lockCooldown = Math.max(0, this.lockCooldown - dt);
    this.updateFishingBobber(dt);

    // Game time (day/night cycle)
    if (this.gamerules.getRule('doDaylightCycle')) {
      this.gameTime = (this.gameTime + dt / DAY_LENGTH) % 1;
    }
    const lightningOpacity = this.weather.getLightningFlashOpacity();
    this.renderer.setDimension(this.chunks.currentDimension);
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
      Math.floor(this.player.eyePosition.x),
      Math.floor(this.player.eyePosition.y),
      Math.floor(this.player.eyePosition.z)
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
    if (this.input.hasEverLocked && !this.input.locked && this.openUI === 'none' && this.lockCooldown <= 0 && !this.chatOpen) {
      this.openUI = 'pause';
      this.notifyState();
      this.renderer.render();
      return;
    }

    // UI open: skip game input
    if (this.openUI !== 'none') {
      this.input.consumeSpaceDoubleTap();
      if (this.bowChargeActive) {
        this.bowChargeActive = false;
        this.bowChargeTimer = 0;
      }
      this.particles.update(dt);
      this.mobs.update(dt, this.player.position, this.isNight(),
        (x, y, z) => this.chunks.getBlock(x, y, z),
        () => {}, // no mob attacks while UI open
        (x, y, z) => this.chunks.isSolidBlock(x, y, z)
      );
      this.enderDragon.update(
        dt,
        this.chunks.currentDimension,
        this.player.position,
        (x, y, z) => this.chunks.getBlock(x, y, z),
        () => {},
        () => {}
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

    // L key → advancements
    if (!this.chatOpen && this.input.isKeyDown('l')) {
      if ((this.openUI as string) === 'advancements') {
        this.closeUI();
      } else if (this.openUI === 'none') {
        this.openUI = 'advancements';
        document.exitPointerLock();
      }
      this.input.keys.delete('l');
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

      if (this.input.isKeyDown('f')) {
        this.inventory.swapSelectedWithOffhand(this.player.selectedSlot);
        this.input.keys.delete('f');
        this.sound.playPickup();
        this.notifyState();
      }
    }

    // Riding Horse controls
    if (this.riddenMob) {
      const forward = this.chatOpen ? false : this.input.isKeyDown('w');
      const back = this.chatOpen ? false : this.input.isKeyDown('s');
      const left = this.chatOpen ? false : this.input.isKeyDown('a');
      const right = this.chatOpen ? false : this.input.isKeyDown('d');
      const jump = this.chatOpen ? false : this.input.isKeyDown(' ');
      
      const yaw = this.player.yaw;
      let moveX = 0;
      let moveZ = 0;
      
      if (forward) {
        moveX += Math.sin(yaw);
        moveZ += Math.cos(yaw);
      }
      if (back) {
        moveX -= Math.sin(yaw);
        moveZ -= Math.cos(yaw);
      }
      if (left) {
        moveX += Math.sin(yaw + Math.PI / 2);
        moveZ += Math.cos(yaw + Math.PI / 2);
      }
      if (right) {
        moveX -= Math.sin(yaw + Math.PI / 2);
        moveZ -= Math.cos(yaw + Math.PI / 2);
      }
      
      const dir = new THREE.Vector3(moveX, 0, moveZ);
      if (dir.lengthSq() > 0) {
        dir.normalize();
        this.riddenMob.velocity.x = dir.x * this.riddenMob.speed * 1.5;
        this.riddenMob.velocity.z = dir.z * this.riddenMob.speed * 1.5;
        this.riddenMob.mesh.rotation.y = Math.atan2(dir.x, dir.z);
      } else {
        this.riddenMob.velocity.x = 0;
        this.riddenMob.velocity.z = 0;
      }
      
      if (jump && this.riddenMob.onGround) {
        this.riddenMob.velocity.y = 9.5;
        this.riddenMob.onGround = false;
      }
      
      // Dismount with Shift key
      const dismount = this.chatOpen ? false : this.input.isKeyDown('shift');
      if (dismount) {
        this.riddenMob.isRidden = false;
        this.riddenMob = null;
        this.player.position.x += 1.2;
      }
    }

    if (this.riddenVehicle) {
      const dismount = this.chatOpen ? false : this.input.isKeyDown('shift');
      if (dismount) {
        this.riddenVehicle.isRidden = false;
        this.riddenVehicle = null;
        this.player.position.x += 1.2;
        this.placeCooldown = 0.5;
      }
    }

    // Player update
    this.updateShieldBlockingState();
    this.player.speedMultiplier = this.potionEffects.getSpeedMultiplier() * (this.isShieldBlocking ? 0.35 : 1.0);
    if (this.potionEffects.has('levitation') && !this.player.flying && !this.riddenMob) {
      this.player.velocity.y = Math.max(this.player.velocity.y, 3.8);
      this.player.onGround = false;
    }
    const doubleTappedSpace = this.input.consumeSpaceDoubleTap();
    if (doubleTappedSpace && !this.chatOpen && this.gameMode === 'creative') {
      this.player.flying = !this.player.flying;
      this.notifyState();
    }
    const mouseDelta = this.input.consumeMouseDelta();
    this.player.update(dt, {
      dx: this.chatOpen ? 0 : mouseDelta.dx,
      dy: this.chatOpen ? 0 : mouseDelta.dy,
      forward: this.chatOpen ? false : this.input.isKeyDown('w'),
      back: this.chatOpen ? false : this.input.isKeyDown('s'),
      left: this.chatOpen ? false : this.input.isKeyDown('a'),
      right: this.chatOpen ? false : this.input.isKeyDown('d'),
      jump: this.chatOpen ? false : this.input.isKeyDown(' '),
      sprint: this.chatOpen ? false : this.input.isKeyDown('control'),
      sneak: this.chatOpen || this.riddenMob || this.riddenVehicle ? false : this.input.isKeyDown('shift'),
      fly: false,
    }, this.chunks);

    if (this.riddenMob) {
      this.player.position.copy(this.riddenMob.position);
      this.player.position.y += this.riddenMob.height * 0.75;
      this.player.velocity.set(0, 0, 0);
    }

    if (this.riddenVehicle) {
      this.player.position.copy(this.riddenVehicle.position);
      this.player.position.y += 0.55;
      this.player.velocity.set(0, 0, 0);
    }

    // Portal teleportation check
    const px = Math.floor(this.player.position.x);
    const py = Math.floor(this.player.position.y);
    const pz = Math.floor(this.player.position.z);
    const feetBlock = this.chunks.getBlock(px, py, pz) & 0x3FF;
    const headBlockPortal = this.chunks.getBlock(px, py + 1, pz) & 0x3FF;
    const belowBlock = this.chunks.getBlock(px, py - 1, pz) & 0x3FF;
    const inNetherPortal = this.chunks.currentDimension !== Dimension.End
      && (feetBlock === 90 || headBlockPortal === 90);
    const touchingEndPortal = feetBlock === END_PORTAL_ID || belowBlock === END_PORTAL_ID;
    const enteringEndPortal = this.chunks.currentDimension !== Dimension.End && touchingEndPortal;
    const exitingEndPortal = this.chunks.currentDimension === Dimension.End
      && this.enderDragon.getState().defeated
      && touchingEndPortal;

    if (this.portalCooldown > 0) {
      this.portalCooldown -= dt;
      this.portalTimer = 0;
    } else if (exitingEndPortal) {
      this.openUI = 'end_poem';
      try {
        document.exitPointerLock();
      } catch (e) {}
      this.notifyState();
      this.portalTimer = 0;
      this.portalCooldown = 4.0;
    } else if (enteringEndPortal) {
      this.teleportToEnd();
      this.portalTimer = 0;
      this.portalCooldown = 4.0;
    } else if (inNetherPortal) {
      const PORTAL_DELAY = this.gameMode === 'creative' ? 0.5 : 3.0;
      this.portalTimer += dt;
      if (this.portalTimer >= PORTAL_DELAY) {
        this.teleportDimension();
        this.portalTimer = 0;
        this.portalCooldown = 4.0;
      }
    } else {
      this.portalTimer = Math.max(0, this.portalTimer - dt * 2.0);
    }

    const isNetworkConnected = this.network && this.network.isConnected;

    if (!isNetworkConnected) {
      // Mob system
      const isNight = this.isNight();
      const heldItem = this.inventory.getSlot(this.player.selectedSlot)?.id || 0;
      const playerLookDir = new THREE.Vector3();
      this.renderer.camera.getWorldDirection(playerLookDir);

      this.mobs.update(dt, this.player.position, isNight,
        (x, y, z) => this.chunks.getBlock(x, y, z),
        (damage, knockback, attacker) => {
          this.damagePlayer(damage, 'mob', knockback);
          if (attacker && attacker.def.type === 'wither_skeleton') {
            this.potionEffects.apply({ id: 'wither', level: 1, duration: 10.0 }, (amount) => {
              this.player.health = Math.min(20, this.player.health + amount);
            });
          }
        },
        (x, y, z) => this.chunks.isSolidBlock(x, y, z),
        this.gameMode,
        (mob) => {
          this.handleMobDeath(mob);
        },
        (origin, direction, type) => {
          if (type === 'fireball') {
            this.projectiles.shootFireball(origin, direction, false, 4);
          } else if (type === 'potion') {
            this.projectiles.shootPotion(origin, direction, false, 2);
          } else if (type === 'shulker_bullet') {
            this.projectiles.shootShulkerBullet(origin, direction, false, 4);
          } else if (type === 'wither_skull') {
            this.projectiles.shootWitherSkull(origin, direction, false, 8);
          } else {
            this.projectiles.shootArrow(origin, direction, false, 4);
          }
        },
        this.chunks.currentDimension,
        this.chunks.getWorldGen(),
        heldItem,
        (type, pos) => {
          this.particles.spawnBlockBreak(pos.x, pos.y + 0.5, pos.z, 0xff5555, 20);
          this.xp.spawnXP(1 + Math.floor(Math.random() * 7), pos.clone().add(new THREE.Vector3(0, 0.5, 0)));
          this.sound.playXP();
        },
        playerLookDir,
        this.chunks.dimensionGen.endGenerator
      );

      this.enderDragon.update(
        dt,
        this.chunks.currentDimension,
        this.player.position,
        (x, y, z) => this.chunks.getBlock(x, y, z),
        (damage, knockback) => this.damagePlayer(damage, 'mob', knockback),
        (dragon) => this.handleEnderDragonDeath(dragon.position)
      );

      // Check creeper explosions, fuse sound, play ambient mob sounds, and death sounds
      for (const [id, mob] of this.mobs.mobs) {
        if (mob.health <= 0 && !mob.deathSoundPlayed) {
          mob.deathSoundPlayed = true;
          this.sound.playMobDeath();
        }
        if (mob.def.type === 'creeper') {
          if (mob.fuseTimer >= 0 && mob.fuseTimer < dt) {
            this.sound.playCreeperFuse();
          }
          if (mob.fuseTimer >= 1.5) {
            this.handleCreeperExplosion(mob);
            this.mobs.removeMob(id);
            continue;
          }
        }

        if (Math.random() < 0.002 * (dt / 0.016)) {
          this.sound.playMobAmbient(mob.def.type);
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

      // Update vehicles
      const vehicleKeys = {
        w: this.chatOpen ? false : this.input.isKeyDown('w'),
        s: this.chatOpen ? false : this.input.isKeyDown('s'),
        a: this.chatOpen ? false : this.input.isKeyDown('a'),
        d: this.chatOpen ? false : this.input.isKeyDown('d'),
      };
      this.vehicles.update(
        dt,
        (x, y, z) => this.chunks.getBlock(x, y, z),
        (x, y, z) => this.chunks.isSolidBlock(x, y, z),
        vehicleKeys
      );

      // Update projectiles
      this.projectiles.update(
        dt,
        (x, y, z) => this.chunks.getBlock(x, y, z),
        (damage, knockback, type) => {
          this.damagePlayer(damage, 'mob', knockback);
          if (type === 'shulker_bullet') {
            this.potionEffects.apply({ id: 'levitation', level: 1, duration: 8 }, () => {});
          }
          if (type === 'wither_skull') {
            this.potionEffects.apply({ id: 'wither', level: 1, duration: 10.0 }, (amount) => {
              this.damagePlayer(amount, 'wither');
            });
          }
        },
        (mobId, damage, knockback, type) => {
          const mob = this.mobs.mobs.get(mobId);
          if (mob) {
            const projectileDamage = type === 'snowball' && mob.def.type === 'blaze' ? 3 : damage;
            mob.takeDamage(projectileDamage, knockback);
            if (mob.def.type === 'zombie_pigman') {
              this.mobs.makePigmenAngry(mob.position, 32);
            }
          }
        },
        () => Array.from(this.mobs.mobs.values()).map(m => ({
          id: m.id, position: m.position, width: m.width, height: m.height
        })),
        this.player.position,
        PLAYER_WIDTH, this.player.height,
        (pos, fromPlayer, damage) => {
          this.handlePotionSplash(pos, fromPlayer, damage);
        },
        (pos, shattered) => {
          this.handleEnderEyeDone(pos, shattered);
        },
        (pos) => {
          this.handleEnderEyeUpdate(pos);
        },
        (type, pos, fromPlayer) => {
          this.handleThrowableImpact(type, pos, fromPlayer);
        }
      );
      this.handleDragonProjectileHits();

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
        () => {
          this.sound.playXP();
          this.particles.spawnXP(this.player.position.x, this.player.position.y + 0.5, this.player.position.z, 8);
        },
        () => this.notifyState()
      );

      // Resolve collisions (mob-mob, player-mob)
      this.resolveCollisions();
    }

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

    if (isNetworkConnected) {
      this.network.send(PacketType.C2S_PLAYER_MOVE, {
        x: this.player.position.x,
        y: this.player.position.y,
        z: this.player.position.z,
        yaw: this.player.yaw,
        pitch: this.player.pitch,
        flying: this.player.flying
      });
      this.network.update(dt);
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
      this.player.mesh.scale.y = this.player.isCrawling
        ? PLAYER_CRAWL_HEIGHT / PLAYER_HEIGHT
        : (this.player.isSneaking ? this.player.height / PLAYER_HEIGHT : 1);
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
    const heldSlot = this.inventory.getSlot(this.player.selectedSlot);
    const localHeldItemId = heldSlot?.id ?? 0;
    const isHoldingBucket = localHeldItemId === 325 || localHeldItemId === 326 || localHeldItemId === 327;
    this.targetBlock = this.player.raycast(this.chunks, isHoldingBucket);
    this.updateHighlight();

    const prevSignText = this.lookedAtSignText;
    if (this.targetBlock) {
      const { blockPos } = this.targetBlock;
      const targetId = this.chunks.getBlock(blockPos.x, blockPos.y, blockPos.z);
      const baseId = targetId & 0x3FF;
      if (baseId === 63 || baseId === 68) {
        const meta = this.chunks.getBlockMeta(blockPos.x, blockPos.y, blockPos.z);
        this.lookedAtSignText = meta?.signText ?? ['', '', '', ''];
      } else {
        this.lookedAtSignText = null;
      }
    } else {
      this.lookedAtSignText = null;
    }

    if (JSON.stringify(prevSignText) !== JSON.stringify(this.lookedAtSignText)) {
      this.notifyState();
    }

    const bowInputActive = this.updateBowCharging(dt);

    // ─── Left click: attack mobs OR break blocks ───
    const selectedItemStack = this.inventory.getSlot(this.player.selectedSlot);
    const selectedItemId = selectedItemStack?.id ?? 0;
    const isHoldingSword = ItemRegistry.isTool(selectedItemId) &&
      ItemRegistry.get(selectedItemId)?.toolType === 'sword';
    const isHoldingTool = ItemRegistry.isTool(selectedItemId);
    const baseAttackDamage = isHoldingTool
      ? (ItemRegistry.get(selectedItemId)?.damage ?? 1)
      : 1;
    const fullAttackDamage = baseAttackDamage + EnchantSystem.getSharpnessBonus(
      EnchantSystem.getLevel(selectedItemStack, 'sharpness')
    );
    const attackCooldownDuration = this.getAttackCooldownDuration(selectedItemId);
    const attackCooldownProgress = this.getAttackCooldownProgress();
    const attackDamage = fullAttackDamage * this.getAttackCooldownDamageScale();
    const isCriticalMelee = attackCooldownProgress >= 0.9 && this.isCriticalMeleeAttack();
    const meleeAttackDamage = isCriticalMelee ? attackDamage * 1.5 : attackDamage;

    if (!this.chatOpen && this.input.isMouseDown(0) && this.swordSwingTimer <= 0) {
        // First: try to attack vehicle
        const targetVehicle = this.vehicles.getVehicleInRay(this.player.eyePosition, this.player.forward, 4.5);
        if (targetVehicle) {
          this.swordSwingTimer = 0.4;
          this.startAttackCooldown(attackCooldownDuration);
          this.sound.playBlockBreak(5); // Planks/wood sound for vehicle destruction
          
          let itemId = 328;
          if (targetVehicle.type === 'boat') {
            const boatDef = ItemRegistry.getByName('oak_boat') || ItemRegistry.getByName('boat');
            itemId = boatDef?.id ?? 333;
          } else {
            const cartDef = ItemRegistry.getByName('minecart');
            itemId = cartDef?.id ?? 328;
          }
          
          const dropPos = targetVehicle.position.clone().add(new THREE.Vector3(0, 0.2, 0));
          const velocity = new THREE.Vector3((Math.random() - 0.5) * 1.0, 1.5, (Math.random() - 0.5) * 1.0);
          this.droppedItems.spawnItem(itemId, 1, dropPos, velocity, 0.5);
          
          if (this.riddenVehicle === targetVehicle) {
            this.riddenVehicle = null;
          }
          this.vehicles.removeVehicle(targetVehicle.id);
          return;
        }

        // First: try to attack mob
        const dir = this.player.forward;
      const mobHit = this.mobs.playerAttackMob(
        this.player.eyePosition,
        dir,
        meleeAttackDamage,
        4.5
      );

      if (mobHit.hit) {
        this.swordSwingTimer = 0.4;
        this.startAttackCooldown(attackCooldownDuration);
        this.sound.playMobHurt();
        // Spawn damage particles on mob
        if (mobHit.mob) {
          this.particles.spawnDamageParticles(
            mobHit.mob.position.x,
            mobHit.mob.position.y + mobHit.mob.def.height * 0.5,
            mobHit.mob.position.z
          );
          if (isCriticalMelee) {
            this.spawnCriticalHitParticles(
              mobHit.mob.position.x,
              mobHit.mob.position.y + mobHit.mob.def.height * 0.75,
              mobHit.mob.position.z
            );
          } else {
            this.trySweepAttack(
              mobHit.mob,
              attackDamage,
              attackCooldownProgress,
              isHoldingSword
            );
          }
        }
      } else if (this.chunks.currentDimension === Dimension.End && this.enderDragon.attack(
        this.player.eyePosition,
        dir,
        meleeAttackDamage,
        8.5
      )) {
        this.swordSwingTimer = 0.4;
        this.startAttackCooldown(attackCooldownDuration);
        this.sound.playMobHurt();
        const dragon = this.enderDragon.dragon;
        if (dragon) {
          this.particles.spawnDamageParticles(
            dragon.position.x,
            dragon.position.y + 1.5,
            dragon.position.z,
            12
          );
          if (isCriticalMelee) {
            this.spawnCriticalHitParticles(dragon.position.x, dragon.position.y + 2.0, dragon.position.z);
          }
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

          // Check advancements
          if (blockDef) {
            const heldSlot = this.inventory.getSlot(this.player.selectedSlot);
            const heldItemDef = heldSlot ? ItemRegistry.get(heldSlot.id) : null;
            this.advancements.checkBlockBreak(blockDef.name, heldItemDef?.name);
          }

          // Spawn break particles
          if (blockDef) {
            const blockColor = this.getBlockParticleColor(blockId);
            this.particles.spawnBlockBreak(bp.x, bp.y, bp.z, blockColor);
          }

          if (isNetworkConnected) {
            this.network.send(PacketType.C2S_BLOCK_BREAK, { x: bp.x, y: bp.y, z: bp.z });
          } else {
            if (this.gameMode !== 'creative') {
              // Damage tool
              const heldItemStack = this.inventory.getSlot(this.player.selectedSlot);
              if (heldItemStack && ItemRegistry.isTool(heldItemStack.id)) {
                this.inventory.damageTool(this.player.selectedSlot);
              }
            }
            this.destroyBlockAt(bp.x, bp.y, bp.z, true);
          }
          this.sound.playBlockBreak(blockId);
          this.breakProgress = 0;
          this.breakingBlockPos = null;
        }
        this.lastFrameWasBreaking = true;
      }
    } else {
      this.breakProgress = 0;
      this.breakingBlockPos = null;
      this.lastFrameWasBreaking = false;
    }

    // ─── Right click: place block / interact ───
    if (!bowInputActive && !this.chatOpen && this.input.isMouseDown(2) && this.placeCooldown <= 0) {
      // Vehicle mount/ride check
      const targetVehicle = this.vehicles.getVehicleInRay(this.player.eyePosition, this.player.forward, 4.5);
      if (targetVehicle && !this.riddenVehicle && !this.riddenMob) {
        this.riddenVehicle = targetVehicle;
        targetVehicle.isRidden = true;
        this.sound.playLever(); // mount sound
        this.placeCooldown = 0.5;
        return;
      }

      const targetMob = this.mobs.getMobInRay(this.player.eyePosition, this.player.forward, 4.5);
      if (targetMob) {
        const slot = this.inventory.getSlot(this.player.selectedSlot);
        const heldItemId = slot?.id ?? 0;

        if (targetMob.def.type === 'villager') {
          this.openTradingUI(targetMob.villagerProfession);
          this.placeCooldown = 0.5;
          return;
        }

        const shouldFeedForBreeding =
          targetMob.isAttractedBy(heldItemId) &&
          !(targetMob.def.type === 'wolf' && targetMob.isTamed && targetMob.health < 20) &&
          !(targetMob.def.type === 'cat' && targetMob.isTamed && targetMob.health < targetMob.def.health);

        // Breeding animals and speeding up baby growth
        if (shouldFeedForBreeding) {
          if (targetMob.isBaby) {
            targetMob.babyAge = Math.max(0, targetMob.babyAge - 6.0); // 10% faster
            this.particles.spawnBlockBreak(targetMob.position.x, targetMob.position.y + targetMob.height, targetMob.position.z, 0x55ff55, 12);
            this.sound.playEat();
            if (this.gameMode !== 'creative') {
              this.inventory.removeFromSlot(this.player.selectedSlot, 1);
            }
            this.placeCooldown = 0.25;
            return;
          } else if (targetMob.canEnterLoveMode(heldItemId)) {
            targetMob.loveTimer = 30.0;
            this.particles.spawnBlockBreak(targetMob.position.x, targetMob.position.y + targetMob.height, targetMob.position.z, 0xff5555, 15);
            this.sound.playEat();
            if (this.gameMode !== 'creative') {
              this.inventory.removeFromSlot(this.player.selectedSlot, 1);
            }
            this.placeCooldown = 0.25;
            return;
          }
        }

        // Wolf interaction
        if (targetMob.def.type === 'wolf') {
          if (!targetMob.isTamed && heldItemId === 352) { // Bone
            this.sound.playEat();
            if (this.gameMode !== 'creative') {
              this.inventory.removeFromSlot(this.player.selectedSlot, 1);
            }
            if (Math.random() < 0.33) {
              targetMob.isTamed = true;
              targetMob.isSitting = true;
              targetMob.health = 20; // Tamed max health is 20
              this.particles.spawnBlockBreak(targetMob.position.x, targetMob.position.y + targetMob.height, targetMob.position.z, 0xff5555, 15);
            } else {
              this.particles.spawnBlockBreak(targetMob.position.x, targetMob.position.y + targetMob.height, targetMob.position.z, 0x555555, 8);
            }
            this.placeCooldown = 0.25;
            return;
          } else if (targetMob.isTamed) {
            if (heldItemId === 352 && targetMob.health < 20) {
              targetMob.health = Math.min(20, targetMob.health + 4);
              this.sound.playEat();
              if (this.gameMode !== 'creative') {
                this.inventory.removeFromSlot(this.player.selectedSlot, 1);
              }
              this.particles.spawnBlockBreak(targetMob.position.x, targetMob.position.y + targetMob.height, targetMob.position.z, 0x55ff55, 8);
            } else {
              targetMob.isSitting = !targetMob.isSitting;
              this.sound.playLever();
            }
            this.placeCooldown = 0.25;
            return;
          }
        }

        // Cat interaction
        if (targetMob.def.type === 'cat') {
          if (!targetMob.isTamed && heldItemId === 349) { // Raw Fish
            this.sound.playEat();
            if (this.gameMode !== 'creative') {
              this.inventory.removeFromSlot(this.player.selectedSlot, 1);
            }
            if (Math.random() < 0.33) {
              targetMob.isTamed = true;
              targetMob.isSitting = true;
              this.particles.spawnBlockBreak(targetMob.position.x, targetMob.position.y + targetMob.height, targetMob.position.z, 0xff5555, 15);
            } else {
              this.particles.spawnBlockBreak(targetMob.position.x, targetMob.position.y + targetMob.height, targetMob.position.z, 0x555555, 8);
            }
            this.placeCooldown = 0.25;
            return;
          } else if (targetMob.isTamed) {
            if (heldItemId === 349 && targetMob.health < targetMob.def.health) {
              targetMob.health = Math.min(targetMob.def.health, targetMob.health + 4);
              this.sound.playEat();
              if (this.gameMode !== 'creative') {
                this.inventory.removeFromSlot(this.player.selectedSlot, 1);
              }
              this.particles.spawnBlockBreak(targetMob.position.x, targetMob.position.y + targetMob.height, targetMob.position.z, 0x55ff55, 8);
            } else {
              targetMob.isSitting = !targetMob.isSitting;
              this.sound.playLever();
            }
            this.placeCooldown = 0.25;
            return;
          }
        }

        // Horse riding
        if (targetMob.def.type === 'horse') {
          this.riddenMob = targetMob;
          targetMob.isRidden = true;
          targetMob.isSitting = false;
          this.sound.playLever(); // mount sound
          this.placeCooldown = 0.5;
          return;
        }
      }

      const selectedSlot = this.inventory.getSlot(this.player.selectedSlot);
      const heldItemId = selectedSlot?.id ?? 0;

      if (this.targetBlock) {
        const { blockPos, faceNormal } = this.targetBlock;
        const targetId = this.chunks.getBlock(blockPos.x, blockPos.y, blockPos.z);
        const targetDef = BlockRegistry.get(targetId);
        const targetName = targetDef?.name ?? '';

        if (this.tryUseCauldronWithBucket(blockPos.x, blockPos.y, blockPos.z, targetName, heldItemId, selectedSlot)) {
          this.placeCooldown = 0.25;
          return;
        }

        if (this.tryUseComposter(blockPos.x, blockPos.y, blockPos.z, targetName, selectedSlot)) {
          this.placeCooldown = 0.25;
          return;
        }

        // Bucket scoop water/lava
        if (heldItemId === 325) { // Empty Bucket
          const isWaterSource = (targetId & 0x3FF) === 9;
          const isLavaSource = (targetId & 0x3FF) === 11;
          if (isWaterSource || isLavaSource) {
            const filledBucketId = isWaterSource ? 326 : 327;
            this.chunks.setBlock(blockPos.x, blockPos.y, blockPos.z, 0);
            this.chunks.setBlockMeta(blockPos.x, blockPos.y, blockPos.z, null);
            this.fluids.addSource(blockPos.x, blockPos.y, blockPos.z);
            this.sound.playBucketFill();

            if (this.gameMode !== 'creative') {
              if (selectedSlot && selectedSlot.count === 1) {
                this.inventory.setSlot(this.player.selectedSlot, { id: filledBucketId, count: 1 });
              } else if (selectedSlot) {
                selectedSlot.count -= 1;
                this.inventory.setSlot(this.player.selectedSlot, selectedSlot);
                const leftover = this.inventory.addItem(filledBucketId, 1);
                if (leftover > 0) {
                  const spawnPos = this.player.eyePosition.clone().sub(new THREE.Vector3(0, 0.2, 0));
                  const velocity = new THREE.Vector3((Math.random() - 0.5) * 0.2, 0.2, (Math.random() - 0.5) * 0.2);
                  this.droppedItems.spawnItem(filledBucketId, 1, spawnPos, velocity, 0.5);
                }
              }
              this.notifyState();
            }
            this.placeCooldown = 0.25;
            return;
          }
        }

        // Bucket place water/lava
        if (heldItemId === 326 || heldItemId === 327) { // Water or Lava Bucket
          const placePos = blockPos.clone().add(faceNormal);
          const fluidBlockId = heldItemId === 326 ? 9 : 11;

          const currentBlock = this.chunks.getBlock(placePos.x, placePos.y, placePos.z);
          const isReplaceable = currentBlock === 0 || BlockRegistry.isFluid(currentBlock) || currentBlock === 31 || currentBlock === 37 || currentBlock === 38; // air, fluid, grass, flowers
          
          if (isReplaceable) {
            this.chunks.setBlock(placePos.x, placePos.y, placePos.z, fluidBlockId);
            this.chunks.setBlockMeta(placePos.x, placePos.y, placePos.z, {
              fluidLevel: 8
            });
            this.fluids.addSource(placePos.x, placePos.y, placePos.z, fluidBlockId);
            this.sound.playBucketEmpty();

            if (this.gameMode !== 'creative') {
              this.inventory.setSlot(this.player.selectedSlot, { id: 325, count: 1 });
              this.notifyState();
            }
            this.placeCooldown = 0.25;
            return;
          }
        }

        const heldItemDef = ItemRegistry.get(heldItemId);
        const isBoatItem = heldItemDef && heldItemDef.name.includes('boat');
        const isMinecartItem = heldItemDef && heldItemDef.name.includes('minecart');

        if (isBoatItem) {
          const placePos = blockPos.clone().add(faceNormal).add(new THREE.Vector3(0.5, 0.2, 0.5));
          this.vehicles.spawnVehicle('boat', placePos);
          this.sound.playBlockPlace(5); // Planks/wood sound for boat
          if (this.gameMode !== 'creative') {
            this.inventory.removeFromSlot(this.player.selectedSlot, 1);
          }
          this.placeCooldown = 0.5;
          return;
        }

        if (isMinecartItem) {
          const isTargetRail = BlockRegistry.isRail(targetId);
          if (isTargetRail) {
            const placePos = blockPos.clone().add(new THREE.Vector3(0.5, 0.05, 0.5));
            this.vehicles.spawnVehicle('minecart', placePos);
            this.sound.playBlockPlace(1); // Stone/metal sound for minecart
            if (this.gameMode !== 'creative') {
              this.inventory.removeFromSlot(this.player.selectedSlot, 1);
            }
            this.placeCooldown = 0.5;
            return;
          }
        }

        if (heldItemId === 259) { // Flint and Steel
          const placePos = blockPos.clone().add(faceNormal);
          const dimGen = this.chunks.dimensionGen;
          const result = dimGen.findAndActivatePortalFrame(
            (x, y, z) => this.chunks.getBlock(x, y, z),
            (x, y, z, id) => this.chunks.setBlock(x, y, z, id),
            placePos.x, placePos.y, placePos.z
          );
          if (result) {
            this.sound.playBlockPlace(0); // flint sound (stone category)
            if (this.gameMode !== 'creative') {
              this.inventory.damageTool(this.player.selectedSlot);
            }
            this.placeCooldown = 0.25;
            return;
          }
        }

        // Hoe tilling: convert dirt/grass to farmland
        if (heldItemDef && heldItemDef.toolType === 'hoe') {
          const targetBase = targetId & 0x3FF;
          if (targetBase === 3 || targetBase === 2) { // dirt or grass
            const moisture = this.isWaterNearby(blockPos.x, blockPos.y, blockPos.z) ? 7 : 0;
            const farmlandId = (moisture << 10) | 60;
            this.chunks.setBlock(blockPos.x, blockPos.y, blockPos.z, farmlandId);
            this.chunks.setBlockMeta(blockPos.x, blockPos.y, blockPos.z, null);
            this.sound.playBlockPlace(3); // dirt sound
            if (this.gameMode !== 'creative') {
              this.inventory.damageTool(this.player.selectedSlot);
            }
            this.placeCooldown = 0.25;
            return;
          }
        }

        if ((targetId & 0x3FF) === END_PORTAL_FRAME_ID && heldItemId === ENDER_EYE_ID) {
          const activated = this.useEnderEyeOnPortalFrame(blockPos.x, blockPos.y, blockPos.z);
          if (activated) {
            this.sound.playBlockPlace(END_PORTAL_FRAME_ID);
            if (this.gameMode !== 'creative') {
              this.inventory.removeFromSlot(this.player.selectedSlot, 1);
            }
          } else {
            this.sound.playLever();
          }
          this.placeCooldown = 0.25;
          return;
        }

        // Right-click furnace / smoker / blast furnace
        if (targetName.includes('furnace') || targetName === 'smoker' || targetName === 'blast_furnace') {
          this.openFurnaceUI(blockPos.x, blockPos.y, blockPos.z);
          this.placeCooldown = 0.5;
        } else if (targetName === 'crafting_table') {
          this.openCraftingTableUI();
          this.placeCooldown = 0.5;
        } else if (targetName === 'chest' || targetName === 'barrel') {
          this.openChestUI(blockPos.x, blockPos.y, blockPos.z);
          this.placeCooldown = 0.5;
        } else if (targetName === 'hopper') {
          this.openHopperUI(blockPos.x, blockPos.y, blockPos.z);
          this.placeCooldown = 0.5;
        } else if ((targetId & 0x3FF) === 92 || targetName === 'cake') {
          this.eatCakeBlock(blockPos.x, blockPos.y, blockPos.z);
          this.placeCooldown = 0.25;
        } else if (targetName === 'bell') {
          this.ringBell(blockPos.x, blockPos.y, blockPos.z);
          this.placeCooldown = 0.35;
        } else if (targetName === 'enchanting_table') {
          this.openEnchantUI();
          this.placeCooldown = 0.5;
        } else if (targetName.includes('anvil')) {
          this.openAnvilUI();
          this.placeCooldown = 0.5;
        } else if (targetName === 'brewing_stand') {
          this.openBrewingUI(blockPos.x, blockPos.y, blockPos.z);
          this.placeCooldown = 0.5;
        } else if (this.isDoorBlock(targetId)) {
          this.toggleDoor(blockPos.x, blockPos.y, blockPos.z);
          this.sound.playLever();
          this.placeCooldown = 0.25;
        } else if (this.isTrapdoorBlock(targetId)) {
          this.toggleTrapdoor(blockPos.x, blockPos.y, blockPos.z);
          this.sound.playLever();
          this.placeCooldown = 0.25;
        } else if (targetName === 'daylight_detector' || targetName === 'daylight_detector_inverted') {
          const isNormal = targetId === 151 || (targetId & 0x3FF) === 151;
          const newBaseId = isNormal ? 178 : 151;
          const metaVal = (targetId >> 10) & 0xF;
          const newPackedId = (metaVal << 10) | newBaseId;
          const currentMeta = this.chunks.getBlockMeta(blockPos.x, blockPos.y, blockPos.z);
          this.chunks.setBlock(blockPos.x, blockPos.y, blockPos.z, newPackedId);
          this.chunks.setBlockMeta(blockPos.x, blockPos.y, blockPos.z, {
            ...currentMeta,
            facing: 'up',
            redstoneType: 'daylight_detector',
          }, true);

          this.redstone.register(blockPos.x, blockPos.y, blockPos.z, 'daylight_detector', 'up');
          this.sound.playLever();
          this.placeCooldown = 0.25;
        } else if (targetName === 'unpowered_comparator' || targetName === 'powered_comparator') {
          const metaVal = (targetId >> 10) & 0x7;
          const newMeta = metaVal < 4 ? metaVal + 4 : metaVal - 4;
          const newPackedId = (newMeta << 10) | (targetId & 0x3FF);
          const currentMeta = this.chunks.getBlockMeta(blockPos.x, blockPos.y, blockPos.z);
          this.chunks.setBlock(blockPos.x, blockPos.y, blockPos.z, newPackedId);
          this.chunks.setBlockMeta(blockPos.x, blockPos.y, blockPos.z, {
            ...currentMeta,
            facing: currentMeta?.facing ?? 'north',
            redstoneType: 'comparator',
            open: newMeta >= 4,
          }, true);

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
          this.sound.playBlockPlace(35); // Wool/fabric sound for bed
          this.advancements.checkSleep();
          if (this.isNight()) {
            this.gameTime = 0.0;
            this.addChatMessage('You are now sleeping. Morning has come.');
            this.notifyState();
          } else {
            this.addChatMessage('You can only sleep at night');
          }
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
              let blockId = ItemRegistry.getPlaceBlockId(slot.id) ?? 0;
              if (blockId === 63 || blockId === 176) {
                if (faceNormal.y < 0) {
                  return; // Cannot place signs/banners on the bottom of a block
                }
                if (faceNormal.y === 0) {
                  blockId = blockId === 63 ? 68 : 177;
                }
              }
              if (blockId > 0) {
                if (blockId === 115) {
                  const blockBelow = this.chunks.getBlock(placePos.x, placePos.y - 1, placePos.z) & 0x3FF;
                  if (blockBelow !== 88) {
                    return; // Fail placement: Nether Wart can only be placed on Soul Sand
                  }
                }
                // Crops can only be placed on farmland
                const cropBaseId = blockId & 0x3FF;
                if (cropBaseId === 59 || cropBaseId === 141 || cropBaseId === 142) {
                  const blockBelow = this.chunks.getBlock(placePos.x, placePos.y - 1, placePos.z) & 0x3FF;
                  if (blockBelow !== 60) {
                    return; // Fail placement: crops can only be planted on farmland
                  }
                }
                let facing: BlockFacing = 'north';
                if (faceNormal.x > 0) facing = 'east';
                else if (faceNormal.x < 0) facing = 'west';
                else if (faceNormal.y > 0) facing = 'up';
                else if (faceNormal.y < 0) facing = 'down';
                else if (faceNormal.z > 0) facing = 'south';
                else if (faceNormal.z < 0) facing = 'north';

                const blockDef = BlockRegistry.get(blockId) || BlockRegistry.getByName(itemDef?.name ?? '');
                const isSlab = blockDef && blockDef.name.includes('slab') && !blockDef.name.includes('double');

                if (isNetworkConnected) {
                  this.network.send(PacketType.C2S_BLOCK_PLACE, {
                    x: placePos.x,
                    y: placePos.y,
                    z: placePos.z,
                    blockId: blockId,
                    facing: facing
                  });
                  this.sound.playBlockPlace(blockId);
                  if (this.gameMode !== 'creative') {
                    this.inventory.removeFromSlot(this.player.selectedSlot);
                  }
                  this.placeCooldown = 0.25;
                } else {
                  if (isDoorItem || (blockDef && blockDef.name.endsWith('door') && !blockDef.name.includes('trapdoor'))) {
                    const doorBlockId = blockDef?.id ?? 64; // Fallback to wooden door block (64)
                    const placed = this.placeDoor(placePos.x, placePos.y, placePos.z, doorBlockId);
                    if (placed) {
                      this.sound.playBlockPlace(doorBlockId);
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
                      this.redstone.observeBlockChange(placePos.x, placePos.y, placePos.z);
                    } else {
                      this.chunks.setBlock(placePos.x, placePos.y, placePos.z, blockId);
                      const slabHalf = faceNormal.y > 0 ? 'bottom' : 'top';
                      this.chunks.setBlockMeta(placePos.x, placePos.y, placePos.z, { slabHalf });
                      this.redstone.observeBlockChange(placePos.x, placePos.y, placePos.z);
                    }
                    this.sound.playBlockPlace(blockId);
                    if (this.gameMode !== 'creative') {
                      this.inventory.removeFromSlot(this.player.selectedSlot);
                    }
                    this.placeCooldown = 0.25;
                  } else if (blockId === 26 || (blockDef && blockDef.name === 'bed')) {
                    const placed = this.placeBed(placePos.x, placePos.y, placePos.z, blockId);
                    if (placed) {
                      this.sound.playBlockPlace(blockId);
                      if (this.gameMode !== 'creative') {
                        this.inventory.removeFromSlot(this.player.selectedSlot);
                      }
                      this.placeCooldown = 0.25;
                    }
                  } else {
                    this.chunks.setBlock(placePos.x, placePos.y, placePos.z, blockId);
                    this.sound.playBlockPlace(blockId);
                    if (this.gameMode !== 'creative') {
                      this.inventory.removeFromSlot(this.player.selectedSlot);
                    }
                    this.placeCooldown = 0.25;

                    // Register redstone component if it is one
                    this.setPlacedBlockMetadata(placePos.x, placePos.y, placePos.z, blockId, facing);
                    this.redstone.observeBlockChange(placePos.x, placePos.y, placePos.z);
                    this.checkFluidAdjacency(placePos.x, placePos.y, placePos.z);

                    if ((blockId & 0x3FF) === 144 && ((blockId >> 10) & 0xF) === 1) {
                      this.checkWitherSpawning(placePos.x, placePos.y, placePos.z);
                    }

                    // If placing water/lava, start fluid simulation
                    if (BlockRegistry.isFluid(blockId)) {
                      this.fluids.addSource(placePos.x, placePos.y, placePos.z, blockId);
                    }

                    if (blockId === 63 || blockId === 68) {
                      this.editingSignPos = placePos.clone();
                      this.openUI = 'sign_edit';
                      document.exitPointerLock();
                      this.notifyState();
                    }
                  }
                }
              }
            }
          }
        }
      }

      if (selectedSlot && this.tryUseHeldReadableItem(selectedSlot)) {
        this.placeCooldown = 0.35;
        return;
      }

      if (this.tryUseFishingRod(heldItemId)) {
        return;
      }

      if (this.tryThrowHeldProjectile(heldItemId)) {
        return;
      }

      if (heldItemId === ENDER_EYE_ID && this.placeCooldown <= 0) {
        this.throwEnderEye();
      }
    }

    // ─── Food Eating ───
    const foodSlotStack = this.inventory.getSlot(this.player.selectedSlot);
    const isHoldingFood = foodSlotStack && ItemRegistry.isFood(foodSlotStack.id);
    const isGoldenApple = foodSlotStack && (foodSlotStack.id & 0x3FF) === 322;
    const isHoneyBottle = foodSlotStack?.id === HONEY_BOTTLE_ID;
    const canEat = isHoldingFood && (this.player.hunger < 20 || isGoldenApple || isHoneyBottle);

    const targetBlockId = this.targetBlock ? this.chunks.getBlock(this.targetBlock.blockPos.x, this.targetBlock.blockPos.y, this.targetBlock.blockPos.z) : 0;
    const targetDef = targetBlockId ? BlockRegistry.get(targetBlockId) : null;
    const targetName = targetDef?.name ?? '';
    const pointingAtInteractive = this.targetBlock && (
      targetName.includes('furnace') ||
      targetName === 'crafting_table' ||
      targetName === 'enchanting_table' ||
      targetName.includes('anvil') ||
      targetName === 'brewing_stand' ||
      targetName === 'lever' ||
      targetName === 'chest' ||
      targetName === 'barrel' ||
      targetName === 'composter' ||
      targetName === 'hopper' ||
      targetName === 'bed' ||
      targetName === 'cake' ||
      targetName === 'bell' ||
      (targetBlockId & 0x3FF) === 92 ||
      this.isDoorBlock(targetBlockId) ||
      this.isTrapdoorBlock(targetBlockId)
    );

    const isHoldingPotion = foodSlotStack?.id === 373 && !!foodSlotStack.potion?.effect;
    if (!this.chatOpen && this.input.isMouseDown(2) && isHoldingPotion && !pointingAtInteractive) {
      this.eatingTimer += dt;
      this.chewSoundTimer += dt;

      if (this.chewSoundTimer >= 0.35) {
        this.chewSoundTimer = 0;
        this.sound.playDrink();
      }

      if (this.eatingTimer >= 1.6) {
        const potion = foodSlotStack.potion?.effect;
        if (potion) {
          this.potionEffects.apply(
            potion,
            (amount) => { this.player.health = Math.min(20, this.player.health + amount); }
          );
          this.sound.playBurp();
          this.inventory.setSlot(this.player.selectedSlot, { id: 374, count: 1 });
          this.notifyState();
        }
        this.eatingTimer = 0;
        this.chewSoundTimer = 0;
        this.placeCooldown = 0.5;
      }
    } else if (!this.chatOpen && this.input.isMouseDown(2) && canEat && !pointingAtInteractive) {
      this.eatingTimer += dt;
      this.chewSoundTimer += dt;

      if (this.chewSoundTimer >= 0.25) {
        this.chewSoundTimer = 0;
        this.sound.playEat();

        let foodColor = 0xC0A080;
        const baseFoodId = foodSlotStack.id & 0x3FF;
        if (baseFoodId === 260) foodColor = 0xFF0000;
        else if (baseFoodId === 363 || baseFoodId === 364) foodColor = 0xA04040;
        else if (baseFoodId === 322) foodColor = 0xFFD700; // Gold particles!
        else if (foodSlotStack.id === HONEY_BOTTLE_ID) foodColor = 0xE8A300;

        const front = this.player.eyePosition.clone().add(this.player.forward.multiplyScalar(0.4));
        this.particles.spawnBlockBreak(front.x, front.y, front.z, foodColor);
      }

      if (this.eatingTimer >= 1.6) {
        const foodDef = ItemRegistry.get(foodSlotStack.id);
        if (foodDef) {
          this.player.hunger = Math.min(20, this.player.hunger + (foodDef.hungerRestore ?? 0));
          this.player.saturation = Math.min(this.player.hunger, this.player.saturation + (foodDef.saturationRestore ?? 0));

          // Golden Apple / Enchanted Golden Apple status effects
          const baseFoodId = foodSlotStack.id & 0x3FF;
          if (baseFoodId === 322) {
            const isEnchanted = (foodSlotStack.id >> 10) === 1;
            if (isEnchanted) {
              // Enchanted Golden Apple: Regeneration II (20s), Fire Resistance (5m)
              this.potionEffects.apply({ id: 'regeneration', level: 2, duration: 20 }, (amount) => {
                this.player.health = Math.min(20, this.player.health + amount);
              });
              this.potionEffects.apply({ id: 'fire_resistance', level: 1, duration: 300 }, () => {});
              this.player.health = 20; // Instant full heal
            } else {
              // Regular Golden Apple: Regeneration I (5s)
              this.potionEffects.apply({ id: 'regeneration', level: 1, duration: 5 }, (amount) => {
                this.player.health = Math.min(20, this.player.health + amount);
              });
            }
          }

          if (foodSlotStack.id === HONEY_BOTTLE_ID) {
            this.potionEffects.remove('poison');
          }

          this.sound.playBurp();
          if (this.gameMode !== 'creative') {
            if (foodSlotStack.id === HONEY_BOTTLE_ID) {
              if (foodSlotStack.count <= 1) {
                this.inventory.setSlot(this.player.selectedSlot, { id: GLASS_BOTTLE_ID, count: 1 });
              } else {
                this.inventory.removeFromSlot(this.player.selectedSlot);
                this.inventory.addItem(GLASS_BOTTLE_ID, 1);
              }
            } else {
              this.inventory.removeFromSlot(this.player.selectedSlot);
            }
          }
          this.notifyState();
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
      this.damagePlayer(dmg, type as any);
    }, this.gamerules.getDifficulty(), this.gamerules);
    this.potionEffects.update(
      dt,
      (amount) => { this.player.health = Math.min(20, this.player.health + amount); },
      (amount, lethal) => {
        const minHealth = lethal ? 0 : 1;
        const finalHealth = Math.max(minHealth, this.player.health - amount);
        if (finalHealth !== this.player.health) {
          this.player.health = finalHealth;
          if (this.player.health <= 0) {
            this.damagePlayer(amount, 'wither');
          } else {
            // Play hurt sound and flash red
            this.damageFlashTimer = 0.3;
            this.sound.playHurt();
          }
        }
      }
    );

    // Death check
    if (this.player.health <= 0) {
      const keepInv = this.gamerules.getRule('keepInventory');
      if (!keepInv) {
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
        const offhandItem = this.inventory.getOffhand();
        if (offhandItem) {
          const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 4.0,
            2.0 + Math.random() * 3.0,
            (Math.random() - 0.5) * 4.0
          );
          this.droppedItems.spawnItem(offhandItem.id, offhandItem.count, deathPos, velocity, 1.0);
          this.inventory.setOffhand(null);
        }
        this.xp.reset();
      }
      this.openUI = 'death';
      this.potionEffects.clear();
      document.exitPointerLock();
      this.notifyState();
      this.renderer.render();
      return;
    }

    // Redstone simulation
    const entitiesList: RedstoneEntity[] = [
      { pos: this.player.position, type: 'player' as const, width: 0.6 }
    ];
    for (const mob of this.mobs.mobs.values()) {
      entitiesList.push({ pos: mob.position, type: 'mob' as const, width: mob.width });
    }
    for (const item of this.droppedItems.items.values()) {
      entitiesList.push({ pos: item.position, type: 'item' as const, width: 0.3 });
    }

    this.redstone.update(
      dt,
      (x, y, z) => this.chunks.getBlock(x, y, z),
      (x, y, z, id) => {
        const currentMeta = this.chunks.getBlockMeta(x, y, z);
        this.chunks.setBlock(x, y, z, id);
        if (currentMeta) {
          this.chunks.setBlockMeta(x, y, z, currentMeta, true);
        }
      },
      (soundType) => {
        if (soundType === 'piston_extend') this.sound.playPistonExtend();
        else if (soundType === 'piston_retract') this.sound.playPistonRetract();
        else if (soundType === 'click_on' || soundType === 'click_off') this.sound.playLever();
      },
      (component) => {
        if (component.type === 'piston') {
          this.handlePistonChange(component);
        } else {
          this.updateRedstoneMetadata(component.x, component.y, component.z, {
            powered: component.state,
            signal: component.signal,
          });
        }
      },
      this.gameTime,
      (x, y, z) => this.chunks.getBlockMeta(x, y, z),
      entitiesList
    );

    // Fluid simulation
    this.updateFluids(dt);

    // Hopper simulation
    this.hoppers.update(dt);

    // Farming simulation (farmland hydration, crop growth)
    this.updateFarming(dt);

    // Smelting simulation
    this.updateFurnaces(dt);

    // Particles
    this.spawnAmbientParticles(dt);
    this.particles.update(dt);

    // Weather
    this.weather.update(dt, this.player.position, this.isNight(), this.gamerules.getRule('doWeatherCycle'));

    // Ambient sounds
    this.ambientTimer += dt;
    if (this.ambientTimer >= 1.5) {
      this.ambientTimer = 0;
      const px = Math.floor(this.player.position.x);
      const py = Math.floor(this.player.position.y);
      const pz = Math.floor(this.player.position.z);
      const biome = this.chunks.getBiomeAt(px, pz);
      const light = this.chunks.getLight(px, py, pz);
      this.sound.updateAmbientSounds(biome, py, light);
    }

    // Dynamic lighting
    this.lightScanTimer += dt;
    if (this.lightScanTimer >= 0.15) {
      this.lightScanTimer = 0;
      this.updateDynamicLighting();
    }

    this.renderer.render();
    this.notifyState();
  };

  private updateFluids(dt: number) {
    this.fluids.update(dt,
      (x, y, z) => this.chunks.getBlock(x, y, z),
      (x, y, z) => this.chunks.getBlockMeta(x, y, z),
      (x, y, z, id) => this.chunks.setBlock(x, y, z, id),
      (x, y, z, meta, markDirty) => this.chunks.setBlockMeta(x, y, z, meta, markDirty)
    );
  }

  private isWaterNearby(x: number, y: number, z: number): boolean {
    for (let dx = -4; dx <= 4; dx++) {
      for (let dy = 0; dy <= 1; dy++) {
        for (let dz = -4; dz <= 4; dz++) {
          const id = this.chunks.getBlock(x + dx, y + dy, z + dz) & 0x3FF;
          if (id === 8 || id === 9) return true;
        }
      }
    }
    return false;
  }

  private spawnCropDrops(x: number, y: number, z: number, blockId: number) {
    if (this.gameMode === 'creative') return;
    const base = blockId & 0x3FF;
    const age = (blockId >> 10) & 0x7;
    const dropPos = new THREE.Vector3(x + 0.5, y + 0.3, z + 0.5);
    const velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 1.5,
      1.5 + Math.random() * 1.5,
      (Math.random() - 0.5) * 1.5
    );

    if (base === 59) { // Wheat
      if (age === 7) {
        this.droppedItems.spawnItem(296, 1, dropPos.clone(), velocity.clone(), 0.5); // wheat item
        const seedCount = 1 + Math.floor(Math.random() * 3); // 1-3 seeds
        this.droppedItems.spawnItem(295, seedCount, dropPos.clone(), velocity.clone(), 0.5);
      } else {
        this.droppedItems.spawnItem(295, 1, dropPos.clone(), velocity.clone(), 0.5); // 1 seed
      }
    } else if (base === 141) { // Carrots
      if (age === 7) {
        const count = 1 + Math.floor(Math.random() * 4); // 1-4
        this.droppedItems.spawnItem(391, count, dropPos.clone(), velocity.clone(), 0.5);
      } else {
        this.droppedItems.spawnItem(391, 1, dropPos.clone(), velocity.clone(), 0.5);
      }
    } else if (base === 142) { // Potatoes
      if (age === 7) {
        const count = 1 + Math.floor(Math.random() * 4); // 1-4
        this.droppedItems.spawnItem(392, count, dropPos.clone(), velocity.clone(), 0.5);
      } else {
        this.droppedItems.spawnItem(392, 1, dropPos.clone(), velocity.clone(), 0.5);
      }
    }
  }

  private updateFarming(dt: number) {
    this.farmingTickTimer += dt;
    if (this.farmingTickTimer < 1.0) return;
    this.farmingTickTimer = 0;

    const px = Math.floor(this.player.position.x);
    const py = Math.floor(this.player.position.y);
    const pz = Math.floor(this.player.position.z);

    // Random tick: sample 15 random blocks near player
    for (let i = 0; i < 15; i++) {
      const rx = px + Math.floor(Math.random() * 32) - 16;
      const ry = Math.max(1, Math.min(254, py + Math.floor(Math.random() * 16) - 8));
      const rz = pz + Math.floor(Math.random() * 32) - 16;

      const blockId = this.chunks.getBlock(rx, ry, rz);
      const base = blockId & 0x3FF;

      // Farmland hydration and decay
      if (base === 60) {
        const moisture = (blockId >> 10) & 0x7;
        const hasWater = this.isWaterNearby(rx, ry, rz);

        if (hasWater) {
          if (moisture < 7) {
            this.chunks.setBlock(rx, ry, rz, (7 << 10) | 60);
          }
        } else {
          if (moisture > 0) {
            const newMoisture = moisture - 1;
            this.chunks.setBlock(rx, ry, rz, (newMoisture << 10) | 60);
          } else {
            // Check if there's a crop on top
            const aboveBase = this.chunks.getBlock(rx, ry + 1, rz) & 0x3FF;
            if (aboveBase !== 59 && aboveBase !== 141 && aboveBase !== 142) {
              // No crop above: revert to dirt
              this.chunks.setBlock(rx, ry, rz, 3);
            }
          }
        }

        // If a solid non-crop block is placed on farmland, revert to dirt
        const aboveId = this.chunks.getBlock(rx, ry + 1, rz);
        const aboveBase = aboveId & 0x3FF;
        if (aboveBase !== 0 && aboveBase !== 59 && aboveBase !== 141 && aboveBase !== 142) {
          const aboveDef = BlockRegistry.get(aboveId);
          if (aboveDef && aboveDef.solid) {
            // Solid block on top → destroy farmland
            this.chunks.setBlock(rx, ry, rz, 3);
            // Also destroy any crop that was between (shouldn't normally exist)
          }
        }
      }

      // Crop growth
      if (base === 59 || base === 141 || base === 142) {
        const age = (blockId >> 10) & 0x7;
        if (age < 7) {
          // Check if farmland below
          const belowId = this.chunks.getBlock(rx, ry - 1, rz);
          const belowBase = belowId & 0x3FF;
          if (belowBase === 60) {
            const moisture = (belowId >> 10) & 0x7;
            // Growth chance: higher if moist
            const growthChance = moisture > 0 ? 0.25 : 0.10;
            if (Math.random() < growthChance) {
              const newAge = age + 1;
              this.chunks.setBlock(rx, ry, rz, (newAge << 10) | base);
            }
          } else {
            // No farmland below: destroy crop
            this.spawnCropDrops(rx, ry, rz, blockId);
            this.chunks.setBlock(rx, ry, rz, 0);
          }
        }
      }
    }
  }

  private tryUseHeldReadableItem(slot: ItemStack): boolean {
    if (slot.id === EMPTY_MAP_ID) {
      const filledMap: ItemStack = {
        id: FILLED_MAP_ID,
        count: 1,
        map: this.maps.createFilledMap(
          this.chunks.getWorldGen(),
          this.player.position.x,
          this.player.position.z,
          this.chunks.currentDimension
        ),
      };

      if (this.gameMode === 'creative') {
        this.inventory.setSlot(this.player.selectedSlot, filledMap);
      } else if (slot.count <= 1) {
        this.inventory.setSlot(this.player.selectedSlot, filledMap);
      } else {
        const remainingEmptyMaps = slot.count - 1;
        this.inventory.setSlot(this.player.selectedSlot, filledMap);
        this.inventory.addStack({ id: EMPTY_MAP_ID, count: remainingEmptyMaps });
      }
      this.sound.playPickup();
      this.openMapUI(this.player.selectedSlot);
      return true;
    }

    if (slot.id === FILLED_MAP_ID && slot.map) {
      this.openMapUI(this.player.selectedSlot);
      return true;
    }

    if (slot.id === WRITABLE_BOOK_ID || slot.id === WRITTEN_BOOK_ID) {
      if (!slot.book) {
        slot.book = { pages: [''], signed: slot.id === WRITTEN_BOOK_ID };
      }
      this.openBookUI(this.player.selectedSlot);
      return true;
    }

    return false;
  }

  private handleMobDeath(mob: Mob) {
    this.advancements.checkMobKilled(mob.def.type);

    // Spawn death particles
    this.particles.spawnDeathParticles(
      mob.position.x,
      mob.position.y,
      mob.position.z,
      mob.def.bodyColor
    );

    // Magma Cube split logic
    if (mob.def.type === 'magma_cube' && mob.size > 1) {
      const splitCount = 2 + Math.floor(Math.random() * 3); // 2 to 4
      const nextSize = mob.size - 1;
      for (let i = 0; i < splitCount; i++) {
        const ox = (Math.random() - 0.5) * 0.5;
        const oz = (Math.random() - 0.5) * 0.5;
        this.mobs.spawnMob('magma_cube', mob.position.x + ox, mob.position.y + 0.1, mob.position.z + oz, nextSize);
      }
    }

    // Drop items in 3D world (magma cubes only drop if size === 1)
    const isMagmaCube = mob.def.type === 'magma_cube';
    const shouldDrop = !isMagmaCube || mob.size === 1;

    if (shouldDrop) {
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
    }

    if (this.gameMode !== 'creative' && mob.def.xpDrop > 0) {
      this.xp.spawnXP(mob.def.xpDrop, mob.position.clone().add(new THREE.Vector3(0, 0.45, 0)));
    }
  }

  private handleDragonProjectileHits() {
    if (this.chunks.currentDimension !== Dimension.End) return;
    for (const [id, projectile] of this.projectiles.projectiles) {
      if (!projectile.fromPlayer || projectile.inGround) continue;
      const hit = this.enderDragon.hitByProjectile(projectile.position, projectile.damage, projectile.velocity);
      if (!hit) continue;
      this.particles.spawnDamageParticles(projectile.position.x, projectile.position.y, projectile.position.z, 10);
      this.sound.playMobHurt();
      this.projectiles.removeProjectile(id);
    }
  }

  private isCriticalMeleeAttack(): boolean {
    if (this.gameMode === 'creative') return false;
    if (this.player.onGround || this.player.flying || this.riddenMob || this.riddenVehicle) return false;
    if (this.player.velocity.y >= -0.1) return false;

    const feetBlock = this.chunks.getBlock(
      Math.floor(this.player.position.x),
      Math.floor(this.player.position.y),
      Math.floor(this.player.position.z)
    );
    const headBlock = this.chunks.getBlock(
      Math.floor(this.player.eyePosition.x),
      Math.floor(this.player.eyePosition.y),
      Math.floor(this.player.eyePosition.z)
    );
    return !BlockRegistry.isFluid(feetBlock) && !BlockRegistry.isFluid(headBlock);
  }

  private getAttackCooldownDuration(itemId: number): number {
    const itemDef = ItemRegistry.get(itemId);
    if (!itemDef || !ItemRegistry.isTool(itemId)) return 0.4;

    switch (itemDef.toolType) {
      case 'axe':
        return 1.0;
      case 'pickaxe':
      case 'shovel':
      case 'hoe':
        return 0.8;
      case 'spear':
        return 0.9;
      case 'sword':
        return 0.625;
      default:
        return 0.625;
    }
  }

  private getAttackCooldownProgress(): number {
    if (this.attackCooldownDuration <= 0) return 1;
    return THREE.MathUtils.clamp(
      1 - this.attackCooldownTimer / this.attackCooldownDuration,
      0,
      1
    );
  }

  private getAttackCooldownDamageScale(): number {
    const progress = this.getAttackCooldownProgress();
    return 0.2 + progress * progress * 0.8;
  }

  private startAttackCooldown(duration: number) {
    this.attackCooldownDuration = Math.max(duration, 0.05);
    this.attackCooldownTimer = this.attackCooldownDuration;
    this.notifyState();
  }

  private trySweepAttack(
    primaryMob: Mob,
    attackDamage: number,
    attackCooldownProgress: number,
    isHoldingSword: boolean
  ) {
    if (!isHoldingSword || attackCooldownProgress < 0.9) return;
    if (!this.player.onGround || this.player.flying || this.player.isSneaking) return;
    if (this.input.isKeyDown('control')) return;

    const forward = this.player.forward.clone().setY(0);
    if (forward.lengthSq() === 0) return;
    forward.normalize();

    const playerPos = this.player.position;
    const sweepDamage = Math.max(1, attackDamage * 0.35);
    let sweptCount = 0;

    for (const mob of this.mobs.mobs.values()) {
      if (mob === primaryMob || mob.health <= 0) continue;

      const toMob = mob.position.clone().sub(playerPos);
      const verticalDelta = Math.abs(toMob.y);
      toMob.y = 0;
      const horizontalDistance = toMob.length();
      if (horizontalDistance < 0.01 || horizontalDistance > 3.25 || verticalDelta > 1.5) continue;

      const directionToMob = toMob.clone().normalize();
      if (directionToMob.dot(forward) < 0.2) continue;
      if (mob.position.distanceTo(primaryMob.position) > 2.6) continue;

      const knockback = forward.clone().multiplyScalar(2.4);
      knockback.y = 0.35;
      mob.takeDamage(sweepDamage, knockback);
      if (mob.def.type === 'zombie_pigman') {
        this.mobs.makePigmenAngry(mob.position, 32);
      }
      this.particles.spawnDamageParticles(
        mob.position.x,
        mob.position.y + mob.def.height * 0.5,
        mob.position.z,
        3
      );
      sweptCount++;
    }

    if (sweptCount > 0) {
      const center = playerPos.clone().addScaledVector(forward, 1.4);
      this.particles.spawnBlockBreak(center.x, center.y + 1.0, center.z, 0xf5efd7, 10);
    }
  }

  private spawnCriticalHitParticles(x: number, y: number, z: number) {
    this.particles.spawnBlockBreak(x, y, z, 0xfff27a, 12);
    this.particles.spawnBlockBreak(x, y, z, 0xffffff, 6);
  }

  private tryUseFishingRod(heldItemId: number): boolean {
    if (heldItemId !== FISHING_ROD_ID) return false;

    if (this.fishingBobber) {
      this.reelFishingRod();
    } else {
      this.castFishingRod();
    }

    this.placeCooldown = 0.35;
    this.notifyState();
    return true;
  }

  private castFishingRod() {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 8),
      new THREE.MeshLambertMaterial({ color: 0xfff2e5, emissive: 0x220000 })
    );
    const origin = this.player.eyePosition.clone().add(this.player.forward.clone().multiplyScalar(0.45));
    const velocity = this.player.forward.clone().multiplyScalar(14);
    velocity.y += 2.2;

    this.fishingBobber = {
      mesh,
      position: origin.clone(),
      velocity,
      phase: 'flying',
      waitTimer: 0,
      hookedTimer: 0,
    };

    mesh.position.copy(origin);
    this.renderer.scene.add(mesh);
    this.sound.playLever();
    if (this.gameMode !== 'creative') {
      const broke = this.inventory.damageTool(this.player.selectedSlot);
      if (broke) {
        this.clearFishingBobber();
      }
    }
  }

  private reelFishingRod() {
    const bobber = this.fishingBobber;
    if (!bobber) return;

    if (bobber.phase === 'hooked') {
      const lootId = this.rollFishingLoot();
      const dropPos = this.player.eyePosition.clone().add(this.player.forward.clone().multiplyScalar(0.5));
      const velocity = new THREE.Vector3().subVectors(this.player.eyePosition, bobber.position).normalize().multiplyScalar(6);
      velocity.y = 3.5;
      this.droppedItems.spawnItem(lootId, 1, dropPos, velocity, 0.1);
      this.xp.spawnXP(1 + Math.floor(Math.random() * 6), bobber.position.clone());
      this.particles.spawnXP(bobber.position.x, bobber.position.y, bobber.position.z, 8);
      this.sound.playPickup();
    } else {
      this.sound.playLever();
    }

    this.clearFishingBobber();
  }

  private updateFishingBobber(dt: number) {
    const bobber = this.fishingBobber;
    if (!bobber) return;

    if (bobber.phase === 'flying') {
      bobber.velocity.y += -12 * dt;
      const next = bobber.position.clone().addScaledVector(bobber.velocity, dt);
      const bx = Math.floor(next.x);
      const by = Math.floor(next.y);
      const bz = Math.floor(next.z);
      const block = this.chunks.getBlock(bx, by, bz) & 0x3FF;

      if (block === 8 || block === 9) {
        bobber.position.set(next.x, by + 0.85, next.z);
        bobber.velocity.set(0, 0, 0);
        bobber.phase = 'waiting';
        bobber.waitTimer = 4 + Math.random() * 10;
      } else if (this.chunks.isSolidBlock(bx, by, bz)) {
        bobber.position.copy(next);
        bobber.velocity.set(0, 0, 0);
        bobber.phase = 'waiting';
        bobber.waitTimer = Infinity;
      } else {
        bobber.position.copy(next);
      }
    } else if (bobber.phase === 'waiting' && Number.isFinite(bobber.waitTimer)) {
      bobber.waitTimer -= dt;
      bobber.position.y += Math.sin(Date.now() * 0.006) * 0.0015;
      if (bobber.waitTimer <= 0) {
        bobber.phase = 'hooked';
        bobber.hookedTimer = 2.0;
        this.disposeFishingBobberMaterial(bobber.mesh);
        bobber.mesh.material = new THREE.MeshLambertMaterial({ color: 0xff3333, emissive: 0x440000 });
        this.particles.spawnBlockBreak(bobber.position.x, bobber.position.y, bobber.position.z, 0x66ccff, 18);
        this.sound.playXP();
      }
    } else if (bobber.phase === 'hooked') {
      bobber.hookedTimer -= dt;
      bobber.position.y += Math.sin(Date.now() * 0.02) * 0.006;
      if (bobber.hookedTimer <= 0) {
        bobber.phase = 'waiting';
        bobber.waitTimer = 4 + Math.random() * 8;
        this.disposeFishingBobberMaterial(bobber.mesh);
        bobber.mesh.material = new THREE.MeshLambertMaterial({ color: 0xfff2e5, emissive: 0x220000 });
      }
    }

    bobber.mesh.position.copy(bobber.position);
  }

  private rollFishingLoot(): number {
    const roll = Math.random();
    if (roll < 0.70) return RAW_FISH_ID;
    if (roll < 0.88) return RAW_SALMON_ID;
    if (roll < 0.96) return CLOWNFISH_ID;
    return PUFFERFISH_ID;
  }

  private clearFishingBobber() {
    if (!this.fishingBobber) return;
    const mesh = this.fishingBobber.mesh;
    this.renderer.scene.remove(mesh);
    mesh.geometry.dispose();
    this.disposeFishingBobberMaterial(mesh);
    this.fishingBobber = null;
  }

  private disposeFishingBobberMaterial(mesh: THREE.Mesh) {
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((mat) => mat.dispose());
    } else {
      mesh.material.dispose();
    }
  }

  private handleEnderDragonDeath(position: THREE.Vector3) {
    this.sound.playExplosion();
    this.particles.spawnBlockBreak(position.x, position.y, position.z, 0x8a2be2, 80);
    this.xp.spawnXP(120, position.clone().add(new THREE.Vector3(0, 2, 0)));
    this.createEndReturnPortal();
    this.advancements.checkEnderDragonDefeated();
    this.notifyState();
  }

  private createEndReturnPortal() {
    const centerX = 0;
    const centerY = 65;
    const centerZ = 8;

    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dz));
        const x = centerX + dx;
        const z = centerZ + dz;
        if (dist === 2) {
          this.chunks.setBlock(x, centerY, z, 7);
        } else {
          this.chunks.setBlock(x, centerY, z, END_PORTAL_ID);
          this.chunks.setBlock(x, centerY - 1, z, 7);
          for (let y = centerY + 1; y <= centerY + 3; y++) {
            this.chunks.setBlock(x, y, z, 0);
          }
        }
      }
    }

    // Dragon egg placeholder above the exit portal.
    this.chunks.setBlock(centerX, centerY + 1, centerZ, 122);
  }

  private handlePotionSplash(pos: THREE.Vector3, fromPlayer: boolean, damage: number) {
    this.particles.spawnBlockBreak(pos.x, pos.y, pos.z, 0x8a2be2, 35);
    this.sound.playBlockBreak(0); // Default break sound category (stone) for potion splash

    const splashRadius = 3.5;
    const distToPlayer = this.player.position.distanceTo(pos);
    if (distToPlayer <= splashRadius && this.gameMode !== 'creative') {
      const isPoison = Math.random() > 0.5;
      if (isPoison) {
        this.potionEffects.apply({ id: 'poison', level: 1, duration: 6 }, (amount) => {
          this.damagePlayer(amount, 'magic');
        });
      } else {
        const kb = new THREE.Vector3().subVectors(this.player.position, pos).normalize().multiplyScalar(2);
        kb.y = 1;
        this.damagePlayer(6, 'magic', kb);
      }
    }

    for (const mob of this.mobs.mobs.values()) {
      const distToMob = mob.position.distanceTo(pos);
      if (distToMob <= splashRadius) {
        const kb = new THREE.Vector3().subVectors(mob.position, pos).normalize().multiplyScalar(2);
        kb.y = 1;
        mob.takeDamage(damage + 4, kb);

        if (mob.def.type !== 'zombie' && mob.def.type !== 'skeleton' && mob.def.type !== 'zombie_pigman' && mob.def.type !== 'wither_skeleton') {
          setTimeout(() => {
            if (this.mobs.mobs.has(mob.id) && mob.health > 0) mob.takeDamage(2);
          }, 1500);
          setTimeout(() => {
            if (this.mobs.mobs.has(mob.id) && mob.health > 0) mob.takeDamage(2);
          }, 3000);
        }
      }
    }
  }

  private handleThrowableImpact(type: ProjectileType, pos: THREE.Vector3, fromPlayer: boolean) {
    if (type === 'snowball') {
      this.particles.spawnBlockBreak(pos.x, pos.y, pos.z, 0xf4fbff, 12);
      this.sound.playBlockBreak(80);
      return;
    }

    if (type === 'egg') {
      this.particles.spawnBlockBreak(pos.x, pos.y, pos.z, 0xf2ead6, 14);
      this.sound.playBlockBreak(1);
      if (fromPlayer && Math.random() < 0.125) {
        const chick = this.mobs.spawnMob('chicken', pos.x, pos.y + 0.1, pos.z);
        chick.isBaby = true;
        chick.babyAge = 240;
        chick.mesh.scale.setScalar(0.5);
      }
      return;
    }

    if (type === 'ender_pearl' && fromPlayer) {
      this.particles.spawnBlockBreak(pos.x, pos.y, pos.z, 0x2aa884, 24);
      this.sound.playBlockBreak(121);
      this.player.position.copy(pos).add(new THREE.Vector3(0, 0.15, 0));
      this.player.velocity.set(0, 0, 0);
      this.player.resolveStuck(this.chunks);
      this.damagePlayer(5, 'fall');
      this.chunks.update(this.player.position.x, this.player.position.z);
      this.notifyState();
    }

    if (type === 'trident' && fromPlayer) {
      this.particles.spawnBlockBreak(pos.x, pos.y, pos.z, 0x9fb7c4, 14);
      this.sound.playBlockPlace(42);
      this.droppedItems.spawnItem(TRIDENT_ID, 1, pos.clone(), new THREE.Vector3(0, 0.2, 0), 0.4);
    }

    if (type === 'firework_rocket') {
      this.handleFireworkExplosion(pos, fromPlayer);
    }
  }

  private handleFireworkExplosion(pos: THREE.Vector3, fromPlayer: boolean) {
    const colors = [0xff3333, 0x33ccff, 0xffee55, 0x66ff66, 0xff66cc];
    for (const color of colors) {
      this.particles.spawnBlockBreak(
        pos.x + (Math.random() - 0.5) * 0.8,
        pos.y + (Math.random() - 0.5) * 0.8,
        pos.z + (Math.random() - 0.5) * 0.8,
        color,
        14
      );
    }
    this.sound.playExplosion();

    const radius = 3.0;
    if (this.gameMode !== 'creative' && this.player.position.distanceTo(pos) <= radius) {
      const kb = new THREE.Vector3().subVectors(this.player.position, pos).normalize().multiplyScalar(1.5);
      kb.y = 1;
      this.damagePlayer(5, 'mob', kb);
    }

    for (const mob of this.mobs.mobs.values()) {
      const dist = mob.position.distanceTo(pos);
      if (dist > radius) continue;
      const falloff = 1 - dist / radius;
      const kb = new THREE.Vector3().subVectors(mob.position, pos).normalize().multiplyScalar(2);
      kb.y = 1;
      mob.takeDamage(Math.max(1, Math.ceil(7 * falloff)), kb);
      if (fromPlayer && mob.def.type === 'zombie_pigman') {
        this.mobs.makePigmenAngry(mob.position, 32);
      }
    }
  }

  private handleCreeperExplosion(mob: Mob) {
    this.createExplosion(mob.position.x, mob.position.y + 0.5, mob.position.z, 3, mob);
  }

  private createExplosion(x: number, y: number, z: number, radius: number, source?: Mob) {
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    const cz = Math.floor(z);

    const mobGriefing = this.gamerules.getRule('mobGriefing');
    const shouldDestroyBlocks = mobGriefing || !source;

    if (shouldDestroyBlocks) {
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
            this.destroyBlockAt(bx, by, bz, true);
          }
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

  private updateShieldBlockingState() {
    const selected = this.inventory.getSlot(this.player.selectedSlot);
    const wantsToBlock = !this.bowChargeActive &&
      !this.isBowStack(selected) &&
      !this.chatOpen &&
      this.openUI === 'none' &&
      this.input.isMouseDown(2);
    const nextBlocking = wantsToBlock && this.getActiveShieldSlot() !== null;
    if (nextBlocking !== this.isShieldBlocking) {
      this.isShieldBlocking = nextBlocking;
      this.notifyState();
    }
  }

  private isBowStack(stack: ItemStack | null | undefined): stack is ItemStack {
    if (!stack) return false;
    const def = ItemRegistry.get(stack.id);
    return def?.name === 'bow' || def?.officialId === 'minecraft:bow';
  }

  private getArrowItemId(): number {
    return ItemRegistry.getByName('arrow')?.id ?? 262;
  }

  private canUseBow(): boolean {
    return this.gameMode === 'creative' || this.inventory.countItem(this.getArrowItemId()) > 0;
  }

  private getBowPower(chargeTime: number): number {
    const normalized = Math.min(1, Math.max(0, chargeTime / BOW_FULL_CHARGE_TIME));
    return Math.min(1, (normalized * normalized + normalized * 2) / 3);
  }

  private updateBowCharging(dt: number): boolean {
    const selected = this.inventory.getSlot(this.player.selectedSlot);
    const rightDown = !this.chatOpen && this.openUI === 'none' && this.input.isMouseDown(2);
    const canKeepUsingBow = rightDown && this.isBowStack(selected);

    if (!canKeepUsingBow) {
      if (this.bowChargeActive) {
        this.releaseBowCharge(this.isBowStack(selected));
        return true;
      }
      return false;
    }

    if (!this.bowChargeActive) {
      if (!this.canUseBow()) return false;
      this.bowChargeActive = true;
      this.bowChargeTimer = 0;
      this.breakProgress = 0;
      this.breakingBlockPos = null;
      this.lastFrameWasBreaking = false;
      this.notifyState();
      return true;
    }

    this.bowChargeTimer += dt;
    return true;
  }

  private releaseBowCharge(stillHoldingBow: boolean) {
    const chargeTime = this.bowChargeTimer;
    this.bowChargeActive = false;
    this.bowChargeTimer = 0;

    if (!stillHoldingBow || chargeTime < BOW_MIN_RELEASE_TIME || !this.canUseBow()) {
      this.notifyState();
      return;
    }

    const power = this.getBowPower(chargeTime);
    const arrowId = this.getArrowItemId();
    if (this.gameMode !== 'creative') {
      this.inventory.removeItem(arrowId, 1);
    }

    this.projectiles.shootArrow(
      this.player.eyePosition.clone(),
      this.player.forward.clone(),
      true,
      Math.max(1, BOW_BASE_DAMAGE * power),
      THREE.MathUtils.lerp(BOW_MIN_SPEED, BOW_MAX_SPEED, power)
    );
    this.sound.playHurt();
    this.swordSwingTimer = Math.max(0.2, 0.9 * power);
    this.notifyState();
  }

  private isShieldStack(stack: ItemStack | null | undefined): stack is ItemStack {
    if (!stack) return false;
    const def = ItemRegistry.get(stack.id);
    return stack.id === SHIELD_ID || def?.name === 'shield' || def?.officialId === 'minecraft:shield';
  }

  private getActiveShieldSlot(): { stack: ItemStack; source: 'mainhand' | 'offhand' } | null {
    const selected = this.inventory.getSlot(this.player.selectedSlot);
    if (this.isShieldStack(selected)) {
      return { stack: selected, source: 'mainhand' };
    }
    const offhand = this.inventory.getOffhand();
    if (this.isShieldStack(offhand)) {
      return { stack: offhand, source: 'offhand' };
    }
    return null;
  }

  private damageActiveShield(amount: number) {
    if (this.gameMode === 'creative') return;
    const shield = this.getActiveShieldSlot();
    if (!shield) return;

    shield.stack.durability ??= SHIELD_MAX_DURABILITY;
    shield.stack.durability -= Math.max(1, Math.ceil(amount));

    if (shield.stack.durability <= 0) {
      if (shield.source === 'mainhand') {
        this.inventory.setSlot(this.player.selectedSlot, null);
      } else {
        this.inventory.setOffhand(null);
      }
      this.sound.playBlockBreak(5);
    }
  }

  private canShieldBlock(knockback?: THREE.Vector3): boolean {
    if (!this.isShieldBlocking || !knockback || knockback.lengthSq() === 0) return false;
    const directionToDamageSource = knockback.clone().setY(0);
    const facing = this.player.forward.clone().setY(0);
    if (directionToDamageSource.lengthSq() === 0 || facing.lengthSq() === 0) return false;
    directionToDamageSource.normalize().negate();
    facing.normalize();
    return facing.dot(directionToDamageSource) > 0.25;
  }

  damagePlayer(amount: number, type: 'mob' | 'fall' | 'drown' | 'starve' | 'wither' | 'magic' | 'fire' | 'lava', knockback?: THREE.Vector3) {
    if (this.gameMode === 'creative') return;

    if (type === 'mob' && this.canShieldBlock(knockback)) {
      this.damageActiveShield(amount);
      if (knockback) {
        this.player.velocity.add(knockback.clone().multiplyScalar(0.25));
      }
      this.sound.playBlockPlace(5);
      this.particles.spawnBlockBreak(
        this.player.position.x,
        this.player.position.y + 1,
        this.player.position.z,
        0xd8d0b8,
        10
      );
      this.notifyState();
      return;
    }

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
    } else if (type === 'lava' || type === 'fire') {
      const protectionReduction = this.inventory.armor.reduce((sum, item) => {
        return sum + EnchantSystem.getProtectionReduction(EnchantSystem.getLevel(item, 'protection'));
      }, 0);
      finalDamage = Math.max(1, amount * (1 - Math.min(0.9, protectionReduction)));
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
      const keepInv = this.gamerules.getRule('keepInventory');
      if (!keepInv) {
        this.xp.reset();
        this.potionEffects.clear();
      }
      document.exitPointerLock();
      this.notifyState();
      this.renderer.render();
    }
  }

  submitChat(message: string) {
    const trimmed = message.trim();
    if (trimmed) {
      if (this.network && this.network.isConnected) {
        this.network.send(PacketType.C2S_CHAT, { text: trimmed });
      } else {
        if (trimmed.startsWith('/')) {
          const result = this.commands.execute(trimmed);
          this.chatMessages.push(result.message);
        } else {
          this.chatMessages.push(`<Player> ${trimmed}`);
        }
        // Keep only last 50 messages
        if (this.chatMessages.length > 50) {
          this.chatMessages = this.chatMessages.slice(-50);
        }
      }
    }
    this.chatOpen = false;
    this.input.keys.clear();
    this.input.mouseButtons.clear();
    this.input.requestLock();
    this.lockCooldown = 0.5;
    this.notifyState();
  }

  addChatMessage(formatted: string) {
    this.chatMessages.push(formatted);
    if (this.chatMessages.length > 50) {
      this.chatMessages = this.chatMessages.slice(-50);
    }
    this.notifyState();
  }

  private notifyState() {
    if (this.openUI === 'chest') {
      this.saveOpenChestInventory();
    }
    this.player.updateArmorMesh(this.inventory.armor);
    this.updateFpArmArmor();

    // Run advancements checks
    if (this.advancements) {
      this.advancements.checkInventory(this.inventory.slots, this.inventory.armor);
      const brewInv = this.getOpenBrewingInventory();
      if (brewInv) {
        const hasBrewedPotion = brewInv.some(slot => slot && slot.id === 373 && slot.potion && slot.potion.kind !== 'water');
        if (hasBrewedPotion) {
          this.advancements.checkBrew();
        }
      }
    }

    const biomeId = this.chunks.getBiomeAt(
      Math.floor(this.player.position.x),
      Math.floor(this.player.position.z)
    );

    const selectedSlot = this.inventory.getSlot(this.player.selectedSlot);
    const selectedName = selectedSlot
      ? ItemRegistry.getDisplayName(selectedSlot.id)
      : 'empty';

    const headBlock = this.chunks.getBlock(
      Math.floor(this.player.eyePosition.x),
      Math.floor(this.player.eyePosition.y),
      Math.floor(this.player.eyePosition.z)
    );
    const isUnderwater = (headBlock & 0x3FF) === 8 || (headBlock & 0x3FF) === 9;
    const xpState = this.xp.getState();
    const dragonState = this.enderDragon.getState();
    const activeWither = Array.from(this.mobs.mobs.values()).find(m => m.def.type === 'wither' && m.health > 0);

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
      chestTitleKey: this.getOpenChestTitleKey(),
      hopperInventory: this.getOpenHopperInventory(),
      furnaceInventory: this.getOpenFurnaceInventory(),
      furnaceType: this.getOpenFurnaceType(),
      furnaceBurnTime: this.openFurnacePos ? (this.chunks.getBlockMeta(this.openFurnacePos.x, this.openFurnacePos.y, this.openFurnacePos.z)?.burnTime ?? 0) : 0,
      furnaceCookTime: this.openFurnacePos ? (this.chunks.getBlockMeta(this.openFurnacePos.x, this.openFurnacePos.y, this.openFurnacePos.z)?.cookTime ?? 0) : 0,
      furnaceMaxBurnTime: this.openFurnacePos ? (this.chunks.getBlockMeta(this.openFurnacePos.x, this.openFurnacePos.y, this.openFurnacePos.z)?.maxBurnTime ?? 0) : 0,
      brewingInventory: this.getOpenBrewingInventory(),
      tradingOffers: this.tradingProfession ? VillageSystem.getOffers(this.tradingProfession) : null,
      tradingProfession: this.tradingProfession,
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
      activePotionEffects: this.potionEffects.getEffects(),
      portalProgress: Math.min(1.0, this.portalTimer / (this.gameMode === 'creative' ? 0.5 : 3.0)),
      isBlocking: this.isShieldBlocking,
      bowChargeProgress: this.bowChargeActive ? this.getBowPower(this.bowChargeTimer) : 0,
      attackCooldownProgress: this.getAttackCooldownProgress(),
      lookedAtSignText: this.lookedAtSignText,
      currentDimension: this.chunks.currentDimension,
      bossName: dragonState.active ? 'Ender Dragon' : (activeWither ? 'Wither' : null),
      bossHealth: dragonState.active ? dragonState.health : (activeWither ? activeWither.health : 0),
      bossMaxHealth: dragonState.active ? dragonState.maxHealth : (activeWither ? activeWither.def.health : 0),
      openMapItem: this.openMapSlot !== null ? this.inventory.getSlot(this.openMapSlot) : null,
      openBookItem: this.editingBookSlot !== null ? this.inventory.getSlot(this.editingBookSlot) : null,
      openBookEditable: this.editingBookSlot !== null && this.inventory.getSlot(this.editingBookSlot)?.id === WRITABLE_BOOK_ID,
      unlockedAdvancements: this.advancements ? this.advancements.getUnlockedList() : [],
      gamerules: this.gamerules ? {
        difficulty: this.gamerules.getDifficulty(),
        rules: this.gamerules.getRules(),
      } : undefined,
    };

    for (const listener of this.stateListeners) {
      listener(state);
    }
  }

  private syncGamerulesToSystems() {
    if (this.mobs) {
      this.mobs.difficulty = this.gamerules.getDifficulty();
      this.mobs.doMobSpawning = this.gamerules.getRule('doMobSpawning');
    }
    this.notifyState();
  }

  private isNight(): boolean {
    return this.gameTime >= NIGHT_START && this.gameTime <= NIGHT_END;
  }

  private teleportDimension() {
    const currentDim = this.chunks.currentDimension;
    if (currentDim === Dimension.End) return;
    const targetDim = currentDim === Dimension.Overworld ? Dimension.Nether : Dimension.Overworld;

    // 1. Scaled coordinates
    let targetX = this.player.position.x;
    let targetZ = this.player.position.z;
    if (targetDim === Dimension.Nether) {
      targetX = Math.floor(targetX / 8);
      targetZ = Math.floor(targetZ / 8);
    } else {
      targetX = Math.floor(targetX * 8);
      targetZ = Math.floor(targetZ * 8);
    }

    // 2. Safely unload old dimension meshes
    this.chunks.unloadAllMeshes();
    this.mobs.dispose();
    this.riddenVehicle = null;
    this.vehicles.dispose();

    // 3. Switch active dimension
    this.chunks.currentDimension = targetDim;

    // 4. Ensure destination portal exists
    const safeY = this.ensureDestinationPortal(Math.floor(targetX), Math.floor(targetZ), targetDim);

    // 5. Position player
    this.player.position.set(targetX + 0.5, safeY + 0.5, targetZ + 0.5);
    this.player.velocity.set(0, 0, 0);

    // 6. Refresh chunks around player immediately
    this.chunks.update(this.player.position.x, this.player.position.z);
    this.player.resolveStuck(this.chunks);

    // Play portal teleport sound
    this.sound.playPickup();
    this.advancements.checkDimensionChange(this.chunks.currentDimension);
    this.notifyState();
  }

  private teleportToEnd() {
    this.chunks.unloadAllMeshes();
    this.mobs.dispose();
    this.riddenVehicle = null;
    this.vehicles.dispose();

    this.chunks.currentDimension = Dimension.End;
    this.player.position.set(0.5, 65.2, 0.5);
    this.player.velocity.set(0, 0, 0);

    this.chunks.update(this.player.position.x, this.player.position.z);
    this.player.resolveStuck(this.chunks);

    this.sound.playPickup();
    this.advancements.checkDimensionChange(2);
    this.notifyState();
  }

  private teleportFromEndToOverworld() {
    this.chunks.unloadAllMeshes();
    this.mobs.dispose();
    this.riddenVehicle = null;
    this.vehicles.dispose();

    this.chunks.currentDimension = Dimension.Overworld;
    const spawn = this.findSafeWorldSpawnPosition();
    this.player.position.copy(spawn);
    this.player.velocity.set(0, 0, 0);

    this.chunks.update(this.player.position.x, this.player.position.z);
    this.player.resolveStuck(this.chunks);

    this.sound.playPickup();
    this.notifyState();
  }

  private ensureDestinationPortal(tx: number, tz: number, targetDim: number): number {
    const radius = 16;
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        for (let y = 30; y < 110; y++) {
          const x = tx + dx;
          const z = tz + dz;
          if ((this.chunks.getBlock(x, y, z) & 0x3FF) === 90) {
            return y;
          }
        }
      }
    }

    let targetY = 60;
    if (targetDim === Dimension.Overworld) {
      const h = this.chunks.getWorldGen().getTerrainHeight(tx, tz);
      targetY = Math.max(50, h);
    } else {
      targetY = 60;
    }

    const axis = 'x';
    const dx = 1;
    const dz = 0;
    
    const x0 = tx;
    const y0 = targetY + 1;
    const z0 = tz;

    // Place obsidian (49)
    // Bottom bar
    this.chunks.setBlock(x0, y0 - 1, z0, 49);
    this.chunks.setBlock(x0 + dx, y0 - 1, z0 + dz, 49);
    // Top bar
    this.chunks.setBlock(x0, y0 + 3, z0, 49);
    this.chunks.setBlock(x0 + dx, y0 + 3, z0 + dz, 49);
    // Left pillar
    this.chunks.setBlock(x0 - dx, y0, z0 - dz, 49);
    this.chunks.setBlock(x0 - dx, y0 + 1, z0 - dz, 49);
    this.chunks.setBlock(x0 - dx, y0 + 2, z0 - dz, 49);
    // Right pillar
    this.chunks.setBlock(x0 + 2 * dx, y0, z0 + 2 * dz, 49);
    this.chunks.setBlock(x0 + 2 * dx, y0 + 1, z0 + 2 * dz, 49);
    this.chunks.setBlock(x0 + 2 * dx, y0 + 2, z0 + 2 * dz, 49);

    // Corners
    this.chunks.setBlock(x0 - dx, y0 - 1, z0 - dz, 49);
    this.chunks.setBlock(x0 + 2 * dx, y0 - 1, z0 + 2 * dz, 49);
    this.chunks.setBlock(x0 - dx, y0 + 3, z0 - dz, 49);
    this.chunks.setBlock(x0 + 2 * dx, y0 + 3, z0 + 2 * dz, 49);

    // Portal blocks (90)
    for (let w = 0; w < 2; w++) {
      for (let h = 0; h < 3; h++) {
        this.chunks.setBlock(x0 + w * dx, y0 + h, z0 + w * dz, 90);
      }
    }

    return y0;
  }

  private async saveGame() {
    const chunkData: SaveData['chunks'] = [];
    for (const [, chunk] of this.chunks.overworldChunks) {
      chunkData.push({
        cx: chunk.cx,
        cz: chunk.cz,
        data: new Uint16Array(chunk.data),
        metadata: chunk.serializeMetadata(),
        dimension: 0,
      });
    }
    for (const [, chunk] of this.chunks.netherChunks) {
      chunkData.push({
        cx: chunk.cx,
        cz: chunk.cz,
        data: new Uint16Array(chunk.data),
        metadata: chunk.serializeMetadata(),
        dimension: 1,
      });
    }
    for (const [, chunk] of this.chunks.endChunks) {
      chunkData.push({
        cx: chunk.cx,
        cz: chunk.cz,
        data: new Uint16Array(chunk.data),
        metadata: chunk.serializeMetadata(),
        dimension: 2,
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
        activePotionEffects: this.potionEffects.getEffects(),
        currentDimension: this.chunks.currentDimension,
      },
      inventory: {
        slots: this.inventory.toJSON(),
        armor: [...this.inventory.armor],
        offhand: this.inventory.getOffhand(),
      },
      seed: this.seed,
      chunks: chunkData,
      mobs: this.mobs.serialize(this.chunks.currentDimension),
      endDragonDefeated: this.enderDragon.getState().defeated,
      endDragonHealth: this.enderDragon.getHealthForSave(),
      gamerules: this.gamerules.toJSON(),
      advancements: this.advancements.getUnlockedList(),
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
      if (data.player.currentDimension !== undefined) {
        this.chunks.currentDimension = this.chunks.normalizeDimension(data.player.currentDimension);
      } else {
        this.chunks.currentDimension = Dimension.Overworld;
      }
      let migratedLegacySpawn = false;
      if (
        this.shouldMigrateLegacySpawn(data.player.x, data.player.z, this.chunks.currentDimension) ||
        this.isSavedSpawnColumnStale(data.chunks, data.player.x, data.player.z, this.chunks.currentDimension) ||
        this.isDamagedSpawnSave(data.player.x, data.player.y, data.player.z, data.player.health, this.chunks.currentDimension)
      ) {
        this.player.position.copy(this.findSafeWorldSpawnPosition());
        this.player.velocity.set(0, 0, 0);
        this.player.health = 20;
        this.player.hunger = 20;
        this.player.oxygen = 15;
        migratedLegacySpawn = true;
      }
      this.xp.setState(
        data.player.xpLevel ?? 0,
        data.player.xpCurrent ?? 0,
        data.player.xpTotal ?? 0
      );
      this.potionEffects.setEffects(data.player.activePotionEffects);
      this.enderDragon.restore(data.endDragonDefeated ?? false, data.endDragonHealth);

      if ((data as any).gamerules) {
        this.gamerules.fromJSON((data as any).gamerules);
      } else {
        this.gamerules.fromJSON(null);
      }
      this.syncGamerulesToSystems();

      if ((data as any).advancements) {
        this.advancements.load((data as any).advancements);
      } else {
        this.advancements.reset();
      }

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
        this.inventory.setOffhand(data.inventory.offhand ?? null);
        this.maps.restoreFromMaps([
          ...this.inventory.slots.flatMap((slot) => slot?.map ? [slot.map] : []),
          ...(this.inventory.getOffhand()?.map ? [this.inventory.getOffhand()!.map!] : []),
        ]);
      }

      if (data.chunks) {
        this.chunks.overworldChunks.clear();
        this.chunks.netherChunks.clear();
        this.chunks.endChunks.clear();
        for (const chunk of data.chunks) {
          if (migratedLegacySpawn && this.isChunkNearPlayerSpawn(chunk.cx, chunk.cz, chunk.dimension ?? 0)) {
            continue;
          }
          this.chunks.restoreChunk(chunk.cx, chunk.cz, chunk.data, chunk.metadata, chunk.dimension ?? 0);
        }
      }

      if (migratedLegacySpawn) {
        this.chunks.update(this.player.position.x, this.player.position.z);
        this.player.position.y = this.findSafeYInLoadedWorld(this.player.position.x, this.player.position.z) + 2;
      }

      this.restoreRedstoneFromLoadedChunks();
      this.chunks.update(this.player.position.x, this.player.position.z);
      this.mobs.restore(data.mobs, this.chunks.currentDimension);
      this.player.resolveStuck(this.chunks);

      console.log('Game loaded from save');
      this.notifyState();
    } catch (e) {
      console.warn('Load failed:', e);
    }
  }

  private shouldMigrateLegacySpawn(x: number, z: number, dimension: Dimension): boolean {
    if (dimension !== Dimension.Overworld) return false;

    const distanceFromOldSpawn = Math.hypot(x - WORLD_SPAWN_X, z - WORLD_SPAWN_Z);
    if (distanceFromOldSpawn > 16) return false;

    const terrainY = this.chunks.getWorldGen().getTerrainHeight(Math.floor(x), Math.floor(z));
    return terrainY <= SEA_LEVEL + 1;
  }

  private isChunkNearPlayerSpawn(cx: number, cz: number, dimension: number): boolean {
    if (dimension !== Dimension.Overworld) return false;

    const spawnChunkX = Math.floor(this.player.position.x / CHUNK_SIZE);
    const spawnChunkZ = Math.floor(this.player.position.z / CHUNK_SIZE);
    return Math.abs(cx - spawnChunkX) <= RENDER_DISTANCE + 1 && Math.abs(cz - spawnChunkZ) <= RENDER_DISTANCE + 1;
  }

  private isSavedSpawnColumnStale(chunks: SaveData['chunks'] | undefined, x: number, z: number, dimension: Dimension): boolean {
    if (!chunks || dimension !== Dimension.Overworld) return false;
    if (Math.hypot(x - WORLD_SPAWN_X, z - WORLD_SPAWN_Z) > 32) return false;

    const wx = Math.floor(x);
    const wz = Math.floor(z);
    const expectedTerrainY = this.chunks.getWorldGen().getTerrainHeight(wx, wz);
    if (expectedTerrainY <= SEA_LEVEL + 1 || expectedTerrainY < 0 || expectedTerrainY >= WORLD_HEIGHT) return false;

    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const chunk = chunks.find((c) => c.cx === cx && c.cz === cz && (c.dimension ?? 0) === Dimension.Overworld);
    if (!chunk) return false;

    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const id = chunk.data[lx + lz * CHUNK_SIZE + expectedTerrainY * CHUNK_SIZE * CHUNK_SIZE] ?? 0;
    return !BlockRegistry.isSolid(id) || BlockRegistry.isFluid(id);
  }

  private isDamagedSpawnSave(x: number, y: number, z: number, health: number, dimension: Dimension): boolean {
    if (dimension !== Dimension.Overworld) return false;
    if (Math.hypot(x - WORLD_SPAWN_X, z - WORLD_SPAWN_Z) > 32) return false;
    return health <= 0 || y < SEA_LEVEL;
  }

  private findSafeYInLoadedWorld(x: number, z: number): number {
    const wx = Math.floor(x);
    const wz = Math.floor(z);

    for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
      const id = this.chunks.getBlock(wx, y, wz);
      if (BlockRegistry.isSolid(id) && !BlockRegistry.isFluid(id)) {
        return y;
      }
    }

    return Math.max(this.chunks.getWorldGen().getTerrainHeight(wx, wz), SEA_LEVEL + 1);
  }

  completeEndPoem() {
    this.openUI = 'none';
    this.teleportFromEndToOverworld();
    this.input.requestLock();
    this.lockCooldown = 0.5;
    this.notifyState();
  }

  private throwEnderEye() {
    const spacing = 24;
    const offsetX = Math.floor(this.pseudoRandom(this.seed, 19, 7) * spacing);
    const offsetZ = Math.floor(this.pseudoRandom(this.seed, 31, 11) * spacing);

    let nearestDist = Infinity;
    let nearestX = 0;
    let nearestZ = 8;
    let nearestY = 30;

    const pcx = Math.floor(this.player.position.x / 16);
    const pcz = Math.floor(this.player.position.z / 16);

    for (let i = -10; i <= 10; i++) {
      for (let j = -10; j <= 10; j++) {
        const scx = offsetX + Math.round((pcx - offsetX) / spacing + i) * spacing;
        const scz = offsetZ + Math.round((pcz - offsetZ) / spacing + j) * spacing;
        
        const distFromSpawn = Math.sqrt(scx * scx + scz * scz);
        if (distFromSpawn < 8) continue;
        
        const sx = scx * 16 + 8;
        const sz = scz * 16 + 8;
        
        const dx = sx - this.player.position.x;
        const dz = sz - this.player.position.z;
        const distSq = dx * dx + dz * dz;
        if (distSq < nearestDist) {
          nearestDist = distSq;
          nearestX = sx;
          nearestZ = sz;
          const roomY = 26 + Math.floor(this.pseudoRandom(scx, this.seed, scz) * 22);
          nearestY = roomY + 2;
        }
      }
    }

    const targetPos = new THREE.Vector3(nearestX, nearestY, nearestZ);
    const origin = this.player.eyePosition.clone();
    
    this.projectiles.shootEnderEye(origin, targetPos);
    
    this.sound.playLever(); // throw sound
    if (this.gameMode !== 'creative') {
      this.inventory.removeFromSlot(this.player.selectedSlot, 1);
    }
    this.placeCooldown = 0.5;
    this.notifyState();
  }

  private tryThrowHeldProjectile(heldItemId: number): boolean {
    if (
      heldItemId !== SNOWBALL_ID &&
      heldItemId !== EGG_ID &&
      heldItemId !== ENDER_PEARL_ID &&
      heldItemId !== TRIDENT_ID &&
      heldItemId !== FIREWORK_ROCKET_ID &&
      heldItemId !== MODERN_FIREWORK_ROCKET_ID
    ) {
      return false;
    }

    if (heldItemId === FIREWORK_ROCKET_ID || heldItemId === MODERN_FIREWORK_ROCKET_ID) {
      const origin = this.player.eyePosition.clone().add(this.player.forward.clone().multiplyScalar(0.45));
      this.projectiles.shootFireworkRocket(origin, this.player.forward, true);
      this.sound.playLever();

      if (this.gameMode !== 'creative') {
        this.inventory.removeFromSlot(this.player.selectedSlot, 1);
      }

      this.placeCooldown = 0.4;
      this.notifyState();
      return true;
    }

    if (heldItemId === TRIDENT_ID) {
      const origin = this.player.eyePosition.clone().add(this.player.forward.clone().multiplyScalar(0.45));
      this.projectiles.shootTrident(origin, this.player.forward, true, 9);
      this.sound.playLever();

      if (this.gameMode !== 'creative') {
        this.inventory.removeFromSlot(this.player.selectedSlot, 1);
      }

      this.placeCooldown = 0.7;
      this.notifyState();
      return true;
    }

    const type = heldItemId === SNOWBALL_ID ? 'snowball' : heldItemId === EGG_ID ? 'egg' : 'ender_pearl';
    const origin = this.player.eyePosition.clone().add(this.player.forward.clone().multiplyScalar(0.35));
    this.projectiles.shootThrowable(type, origin, this.player.forward, true);
    this.sound.playLever();

    if (this.gameMode !== 'creative') {
      this.inventory.removeFromSlot(this.player.selectedSlot, 1);
    }

    this.placeCooldown = type === 'ender_pearl' ? 0.8 : 0.35;
    this.notifyState();
    return true;
  }

  private handleEnderEyeDone(pos: THREE.Vector3, shattered: boolean) {
    if (shattered) {
      this.particles.spawnBlockBreak(pos.x, pos.y, pos.z, 0x1E5E4A, 30);
      this.sound.playExplosion();
    } else {
      const velocity = new THREE.Vector3(0, -0.5, 0);
      this.droppedItems.spawnItem(ENDER_EYE_ID, 1, pos, velocity, 0.5);
    }
  }

  private handleEnderEyeUpdate(pos: THREE.Vector3) {
    const color = Math.random() < 0.5 ? 0x1E5E4A : 0x8a2be2;
    this.particles.spawnBlockBreak(pos.x, pos.y, pos.z, color, 1);
  }

  private pseudoRandom(x: number, y: number, z: number): number {
    let h = (x * 374761393 + y * 668265263 + z * 1274126177 + this.seed) | 0;
    h = (h ^ (h >> 13)) * 1274126177;
    h = h ^ (h >> 16);
    return (h & 0x7fffffff) / 0x7fffffff;
  }

  private positiveMod(value: number, mod: number): number {
    return ((value % mod) + mod) % mod;
  }

  private useEnderEyeOnPortalFrame(x: number, y: number, z: number): boolean {
    const currentId = this.chunks.getBlock(x, y, z);
    const currentMeta = (currentId >> 10) & 0xF;

    if ((currentId & 0x3FF) !== END_PORTAL_FRAME_ID || currentMeta >= 4) {
      return false;
    }

    this.chunks.setBlock(x, y, z, ((currentMeta + 4) << 10) | END_PORTAL_FRAME_ID);
    this.tryActivateEndPortalNear(x, y, z);
    return true;
  }

  private tryActivateEndPortalNear(x: number, y: number, z: number): boolean {
    for (let centerX = x - 2; centerX <= x + 2; centerX++) {
      for (let centerZ = z - 2; centerZ <= z + 2; centerZ++) {
        if (!this.isCompleteEndPortalFrame(centerX, y, centerZ)) continue;

        for (let dx = -1; dx <= 1; dx++) {
          for (let dz = -1; dz <= 1; dz++) {
            this.chunks.setBlock(centerX + dx, y, centerZ + dz, END_PORTAL_ID);
          }
        }
        this.particles.spawnBlockBreak(centerX + 0.5, y + 0.25, centerZ + 0.5, 0x402060, 32);
        return true;
      }
    }
    return false;
  }

  private isCompleteEndPortalFrame(centerX: number, y: number, centerZ: number): boolean {
    let frameCount = 0;

    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        const onFrame = (Math.abs(dx) === 2 && Math.abs(dz) <= 1) || (Math.abs(dz) === 2 && Math.abs(dx) <= 1);
        const inside = Math.abs(dx) <= 1 && Math.abs(dz) <= 1;
        const blockId = this.chunks.getBlock(centerX + dx, y, centerZ + dz);
        const baseId = blockId & 0x3FF;
        const meta = (blockId >> 10) & 0xF;

        if (onFrame) {
          if (baseId !== END_PORTAL_FRAME_ID || meta < 4) return false;
          frameCount++;
        } else if (inside && baseId !== 0 && baseId !== END_PORTAL_ID) {
          return false;
        }
      }
    }

    return frameCount === 12;
  }

  private setPlacedBlockMetadata(x: number, y: number, z: number, blockId: number, facing: BlockFacing) {
    const def = BlockRegistry.get(blockId);
    if (!def) return;
    const name = def.name;

    if (name === 'unpowered_comparator' || name === 'powered_comparator') {
      const playerFacing = this.getPlayerHorizontalFacing();
      let meta = 0;
      if (playerFacing === 'south') meta = 0;
      else if (playerFacing === 'west') meta = 1;
      else if (playerFacing === 'north') meta = 2;
      else if (playerFacing === 'east') meta = 3;

      const packedId = (meta << 10) | blockId;
      this.chunks.setBlock(x, y, z, packedId);

      this.redstone.register(x, y, z, 'comparator', playerFacing);
      this.chunks.setBlockMeta(x, y, z, {
        facing: playerFacing,
        redstoneType: 'comparator',
        powered: false,
        signal: 0,
        open: false,
      }, true);
      return;
    }

    if (name === 'observer') {
      let observerFacing: BlockFacing = 'north';
      let meta = 2;
      if (facing === 'up') { observerFacing = 'down'; meta = 0; }
      else if (facing === 'down') { observerFacing = 'up'; meta = 1; }
      else if (facing === 'south') { observerFacing = 'north'; meta = 2; }
      else if (facing === 'north') { observerFacing = 'south'; meta = 3; }
      else if (facing === 'east') { observerFacing = 'west'; meta = 4; }
      else if (facing === 'west') { observerFacing = 'east'; meta = 5; }

      const packedId = (meta << 10) | blockId;
      this.chunks.setBlock(x, y, z, packedId);

      this.redstone.register(x, y, z, 'observer', observerFacing);
      this.chunks.setBlockMeta(x, y, z, {
        facing: observerFacing,
        redstoneType: 'observer',
        powered: false,
        signal: 0,
      }, true);
      return;
    }

    if (name === 'daylight_detector' || name === 'daylight_detector_inverted') {
      this.redstone.register(x, y, z, 'daylight_detector', 'up');
      this.chunks.setBlockMeta(x, y, z, {
        facing: 'up',
        redstoneType: 'daylight_detector',
        powered: false,
        signal: 0,
      }, true);
      return;
    }

    if (name.includes('pressure_plate')) {
      this.redstone.register(x, y, z, 'pressure_plate', 'up');
      this.chunks.setBlockMeta(x, y, z, {
        facing: 'up',
        redstoneType: 'pressure_plate',
        powered: false,
        signal: 0,
      }, true);
      return;
    }

    if (name === 'tripwire') {
      this.redstone.register(x, y, z, 'tripwire', 'up');
      this.chunks.setBlockMeta(x, y, z, {
        facing: 'up',
        redstoneType: 'tripwire',
        powered: false,
        signal: 0,
      }, true);
      return;
    }

    if (name === 'tripwire_hook') {
      let hookFacing = facing;
      if (hookFacing === 'up' || hookFacing === 'down') {
        hookFacing = this.getPlayerHorizontalFacing();
      }
      let meta = 0;
      if (hookFacing === 'south') meta = 0;
      else if (hookFacing === 'west') meta = 1;
      else if (hookFacing === 'north') meta = 2;
      else if (hookFacing === 'east') meta = 3;

      const packedId = (meta << 10) | blockId;
      this.chunks.setBlock(x, y, z, packedId);

      this.redstone.register(x, y, z, 'tripwire_hook', hookFacing);
      this.chunks.setBlockMeta(x, y, z, {
        facing: hookFacing,
        redstoneType: 'tripwire_hook',
        powered: false,
        signal: 0,
      }, true);
      return;
    }

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

    if (name === 'chest') {
      this.chunks.setBlockMeta(x, y, z, {
        facing,
        containerType: 'chest',
        inventory: new Array(27).fill(null),
      }, true);
      return;
    }

    if (name === 'barrel') {
      this.chunks.setBlockMeta(x, y, z, {
        facing,
        containerType: 'barrel',
        inventory: new Array(27).fill(null),
      }, true);
      return;
    }

    if (name === 'hopper') {
      let hopperFacing: BlockFacing = 'down';
      if (facing !== 'up' && facing !== 'down') {
        if (facing === 'north') hopperFacing = 'south';
        else if (facing === 'south') hopperFacing = 'north';
        else if (facing === 'east') hopperFacing = 'west';
        else if (facing === 'west') hopperFacing = 'east';
      }
      this.chunks.setBlockMeta(x, y, z, {
        facing: hopperFacing,
        containerType: 'hopper',
        inventory: new Array(5).fill(null),
      }, true);
      return;
    }

    if (name.includes('furnace') || name === 'smoker' || name === 'blast_furnace') {
      const containerType = name === 'smoker' ? 'smoker' : (name === 'blast_furnace' ? 'blast_furnace' : 'furnace');
      this.chunks.setBlockMeta(x, y, z, {
        facing,
        containerType: containerType as any,
        inventory: new Array(3).fill(null),
      }, true);
      return;
    }

    if (name === 'brewing_stand') {
      this.chunks.setBlockMeta(x, y, z, {
        containerType: 'brewing_stand',
        inventory: new Array(5).fill(null),
      }, true);
      return;
    }

    if (name === 'cauldron') {
      this.chunks.setBlockMeta(x, y, z, {
        cauldronLevel: 0,
      }, true);
      return;
    }

    if (name === 'composter') {
      this.chunks.setBlockMeta(x, y, z, {
        compostLevel: 0,
      }, true);
      return;
    }

    if ((blockId & 0x3FF) === 92 || name === 'cake') {
      this.chunks.setBlockMeta(x, y, z, { cakeBites: 0 }, true);
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

    if (name === 'ladder') {
      let ladderFacing = facing;
      if (ladderFacing === 'up' || ladderFacing === 'down') {
        if (this.chunks.isSolidBlock(x, y, z - 1)) {
          ladderFacing = 'south';
        } else if (this.chunks.isSolidBlock(x, y, z + 1)) {
          ladderFacing = 'north';
        } else if (this.chunks.isSolidBlock(x - 1, y, z)) {
          ladderFacing = 'east';
        } else if (this.chunks.isSolidBlock(x + 1, y, z)) {
          ladderFacing = 'west';
        } else {
          ladderFacing = this.getPlayerHorizontalFacing();
        }
      }
      this.chunks.setBlockMeta(x, y, z, { facing: ladderFacing }, true);
      return;
    }

    if (name === 'standing_sign' || name === 'standing_banner') {
      const rotation = Math.round(((this.player.yaw + Math.PI) * 16) / (2 * Math.PI)) % 16;
      this.chunks.setBlockMeta(x, y, z, { rotation }, true);
      return;
    }

    if (name === 'wall_sign' || name === 'wall_banner') {
      this.chunks.setBlockMeta(x, y, z, { facing }, true);
      return;
    }

    if (this.usesFacingMetadata(blockId)) {
      this.chunks.setBlockMeta(x, y, z, { facing }, true);
    }
  }

  private eatCakeBlock(x: number, y: number, z: number) {
    if (this.gameMode !== 'creative' && this.player.hunger >= 20) {
      return;
    }

    const currentMeta = this.chunks.getBlockMeta(x, y, z) ?? {};
    const bites = Math.max(0, Math.min(6, currentMeta.cakeBites ?? 0));

    this.player.hunger = Math.min(20, this.player.hunger + 2);
    this.player.saturation = Math.min(this.player.hunger, this.player.saturation + 0.4);
    this.sound.playEat();
    this.particles.spawnBlockBreak(x + 0.5, y + 0.45, z + 0.5, 0xf5efd7, 10);

    if (bites >= 6) {
      this.chunks.setBlock(x, y, z, 0);
      this.chunks.setBlockMeta(x, y, z, null);
      this.redstone.observeBlockChange(x, y, z);
      this.checkFluidAdjacency(x, y, z);
    } else {
      this.chunks.setBlockMeta(x, y, z, {
        ...currentMeta,
        cakeBites: bites + 1,
      }, true);
    }

    this.notifyState();
  }

  private tryUseCauldronWithBucket(
    x: number,
    y: number,
    z: number,
    targetName: string,
    heldItemId: number,
    selectedSlot: ItemStack | null
  ): boolean {
    const isEmptyCauldron = targetName === 'cauldron';
    const isWaterCauldron = targetName === 'water_cauldron';
    const isLavaCauldron = targetName === 'lava_cauldron';
    if (!isEmptyCauldron && !isWaterCauldron && !isLavaCauldron) return false;

    if (isEmptyCauldron && (heldItemId === 326 || heldItemId === 327)) {
      const fluid = heldItemId === 326 ? 'water' : 'lava';
      const filledDef = BlockRegistry.getByName(fluid === 'water' ? 'water_cauldron' : 'lava_cauldron');
      if (!filledDef) return false;

      this.chunks.setBlock(x, y, z, filledDef.id);
      this.chunks.setBlockMeta(x, y, z, {
        cauldronFluid: fluid,
        cauldronLevel: 3,
      }, true);
      this.redstone.observeBlockChange(x, y, z);
      this.sound.playBucketEmpty();
      this.replaceHeldBucketAfterUse(selectedSlot, 325);
      this.notifyState();
      return true;
    }

    if (heldItemId === 325 && (isWaterCauldron || isLavaCauldron)) {
      const filledBucketId = isWaterCauldron ? 326 : 327;
      this.chunks.setBlock(x, y, z, 118);
      this.chunks.setBlockMeta(x, y, z, { cauldronLevel: 0 }, true);
      this.redstone.observeBlockChange(x, y, z);
      this.sound.playBucketFill();
      this.replaceHeldBucketAfterUse(selectedSlot, filledBucketId);
      this.notifyState();
      return true;
    }

    if (heldItemId === 325 || heldItemId === 326 || heldItemId === 327) {
      return true;
    }

    return false;
  }

  private replaceHeldBucketAfterUse(selectedSlot: ItemStack | null, replacementId: number) {
    if (this.gameMode === 'creative' || !selectedSlot) return;

    if (selectedSlot.count <= 1) {
      this.inventory.setSlot(this.player.selectedSlot, { id: replacementId, count: 1 });
      return;
    }

    selectedSlot.count -= 1;
    this.inventory.setSlot(this.player.selectedSlot, selectedSlot);
    const leftover = this.inventory.addItem(replacementId, 1);
    if (leftover > 0) {
      const spawnPos = this.player.eyePosition.clone().sub(new THREE.Vector3(0, 0.2, 0));
      const velocity = new THREE.Vector3((Math.random() - 0.5) * 0.2, 0.2, (Math.random() - 0.5) * 0.2);
      this.droppedItems.spawnItem(replacementId, leftover, spawnPos, velocity, 0.5);
    }
  }

  private tryUseComposter(
    x: number,
    y: number,
    z: number,
    targetName: string,
    selectedSlot: ItemStack | null
  ): boolean {
    if (targetName !== 'composter') return false;

    const currentMeta = this.chunks.getBlockMeta(x, y, z) ?? {};
    const level = Math.max(0, Math.min(8, currentMeta.compostLevel ?? 0));

    if (level >= 8) {
      this.spawnComposterBoneMeal(x, y, z);
      this.chunks.setBlockMeta(x, y, z, { ...currentMeta, compostLevel: 0 }, true);
      this.sound.playPickup();
      this.particles.spawnBlockBreak(x + 0.5, y + 0.85, z + 0.5, 0xf5f5dc, 16);
      this.notifyState();
      return true;
    }

    if (!selectedSlot || !this.isCompostableItem(selectedSlot.id)) {
      return false;
    }

    const chance = this.getCompostChance(selectedSlot.id);
    const accepted = Math.random() < chance;
    const nextLevel = accepted ? Math.min(8, level + 1) : level;

    this.chunks.setBlockMeta(x, y, z, { ...currentMeta, compostLevel: nextLevel }, true);
    this.sound.playBlockPlace(3);
    this.particles.spawnBlockBreak(x + 0.5, y + 0.75, z + 0.5, accepted ? 0x7b5a2e : 0x5d4a2d, accepted ? 12 : 5);

    if (this.gameMode !== 'creative') {
      this.inventory.removeFromSlot(this.player.selectedSlot, 1);
    }

    this.notifyState();
    return true;
  }

  private isCompostableItem(itemId: number): boolean {
    const item = ItemRegistry.get(itemId);
    if (!item) return false;

    const name = item.name;
    if (
      name === 'bone_meal' ||
      name.includes('bucket') ||
      name.includes('bottle') ||
      name.includes('beef') ||
      name.includes('porkchop') ||
      name.includes('chicken') ||
      name.includes('mutton') ||
      name.includes('rabbit') ||
      name.includes('fish') ||
      name.includes('cod') ||
      name.includes('salmon')
    ) return false;
    if (item.category === 'food') return true;

    return (
      name.includes('seed') ||
      name.includes('sapling') ||
      name.includes('leaves') ||
      name.includes('flower') ||
      name.includes('grass') ||
      name.includes('fern') ||
      name.includes('roots') ||
      name.includes('mushroom') ||
      name.includes('kelp') ||
      name.includes('cactus') ||
      name.includes('sugar_cane') ||
      name.includes('bamboo') ||
      name.includes('wart') ||
      name.includes('crop') ||
      name.includes('apple') ||
      name.includes('melon') ||
      name.includes('pumpkin') ||
      name.includes('carrot') ||
      name.includes('potato') ||
      name.includes('beetroot') ||
      name.includes('wheat')
    );
  }

  private getCompostChance(itemId: number): number {
    const name = ItemRegistry.get(itemId)?.name ?? '';
    if (name.includes('cake') || name.includes('pumpkin_pie')) return 1.0;
    if (name.includes('bread') || name.includes('baked_potato') || name.includes('hay')) return 0.85;
    if (name.includes('apple') || name.includes('carrot') || name.includes('potato') || name.includes('beetroot') || name.includes('wheat')) return 0.65;
    if (name.includes('sapling') || name.includes('seed') || name.includes('grass') || name.includes('leaves')) return 0.3;
    return 0.5;
  }

  private spawnComposterBoneMeal(x: number, y: number, z: number) {
    const boneMealItem = ItemRegistry.getByName('bone_meal');
    const boneMealId = boneMealItem?.id ?? ((15 << 10) | 351);
    const dropPos = new THREE.Vector3(x + 0.5, y + 1.0, z + 0.5);
    const velocity = new THREE.Vector3(0, 0.25, 0);
    this.droppedItems.spawnItem(boneMealId, 1, dropPos, velocity, 0.35);
  }

  private ringBell(x: number, y: number, z: number) {
    this.sound.playBell();
    this.particles.spawnBlockBreak(x + 0.5, y + 0.55, z + 0.5, 0xf5c542, 18);
    this.notifyState();
  }

  private checkWitherSpawning(x: number, y: number, z: number) {
    const isSoulSand = (bx: number, by: number, bz: number) => {
      return (this.chunks.getBlock(bx, by, bz) & 0x3FF) === 88;
    };
    const isSkull = (bx: number, by: number, bz: number) => {
      const id = this.chunks.getBlock(bx, by, bz);
      return (id & 0x3FF) === 144 && ((id >> 10) & 0xF) === 1;
    };

    // Check X-aligned
    for (let offset = -1; offset <= 1; offset++) {
      const centerX = x - offset;
      const centerY = y - 1;
      const centerZ = z;

      if (
        isSoulSand(centerX, centerY, centerZ) &&
        isSoulSand(centerX, centerY - 1, centerZ) &&
        isSoulSand(centerX - 1, centerY, centerZ) &&
        isSoulSand(centerX + 1, centerY, centerZ) &&
        isSkull(centerX - 1, centerY + 1, centerZ) &&
        isSkull(centerX, centerY + 1, centerZ) &&
        isSkull(centerX + 1, centerY + 1, centerZ)
      ) {
        // Clear blocks
        this.chunks.setBlock(centerX, centerY, centerZ, 0);
        this.chunks.setBlock(centerX, centerY - 1, centerZ, 0);
        this.chunks.setBlock(centerX - 1, centerY, centerZ, 0);
        this.chunks.setBlock(centerX + 1, centerY, centerZ, 0);
        this.chunks.setBlock(centerX - 1, centerY + 1, centerZ, 0);
        this.chunks.setBlock(centerX, centerY + 1, centerZ, 0);
        this.chunks.setBlock(centerX + 1, centerY + 1, centerZ, 0);

        // Spawn Wither
        this.mobs.spawnMob('wither', centerX, centerY + 1, centerZ);
        this.particles.spawnBlockBreak(centerX, centerY, centerZ, 0x141414, 50);
        this.sound.playExplosion();
        return;
      }
    }

    // Check Z-aligned
    for (let offset = -1; offset <= 1; offset++) {
      const centerX = x;
      const centerY = y - 1;
      const centerZ = z - offset;

      if (
        isSoulSand(centerX, centerY, centerZ) &&
        isSoulSand(centerX, centerY - 1, centerZ) &&
        isSoulSand(centerX, centerY, centerZ - 1) &&
        isSoulSand(centerX, centerY, centerZ + 1) &&
        isSkull(centerX, centerY + 1, centerZ - 1) &&
        isSkull(centerX, centerY + 1, centerZ) &&
        isSkull(centerX, centerY + 1, centerZ + 1)
      ) {
        // Clear blocks
        this.chunks.setBlock(centerX, centerY, centerZ, 0);
        this.chunks.setBlock(centerX, centerY - 1, centerZ, 0);
        this.chunks.setBlock(centerX, centerY, centerZ - 1, 0);
        this.chunks.setBlock(centerX, centerY, centerZ + 1, 0);
        this.chunks.setBlock(centerX, centerY + 1, centerZ - 1, 0);
        this.chunks.setBlock(centerX, centerY + 1, centerZ, 0);
        this.chunks.setBlock(centerX, centerY + 1, centerZ + 1, 0);

        // Spawn Wither
        this.mobs.spawnMob('wither', centerX, centerY + 1, centerZ);
        this.particles.spawnBlockBreak(centerX, centerY, centerZ, 0x141414, 50);
        this.sound.playExplosion();
        return;
      }
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
    if (name === 'unpowered_comparator' || name === 'powered_comparator') return 'comparator';
    if (name === 'observer') return 'observer';
    if (name === 'daylight_detector' || name === 'daylight_detector_inverted') return 'daylight_detector';
    if (name.includes('pressure_plate')) return 'pressure_plate';
    if (name === 'tripwire_hook') return 'tripwire_hook';
    if (name === 'tripwire') return 'tripwire';
    return null;
  }

  private usesFacingMetadata(blockId: number): boolean {
    const def = BlockRegistry.get(blockId);
    if (!def) return false;
    const name = def.name;
    return name.includes('furnace') || name === 'smoker' || name === 'blast_furnace' || name === 'chest' || name === 'hopper' || name.includes('trapdoor') || name === 'crafting_table' || name.includes('stairs') || name.includes('repeater') || name.includes('piston') || name.includes('door') || name.includes('comparator') || name === 'observer' || name === 'tripwire_hook' || name === 'ladder';
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
    this.redstone.observeBlockChange(x, y, z);

    this.chunks.setBlock(x, y + 1, z, doorBlockId);
    this.chunks.setBlockMeta(x, y + 1, z, {
      facing,
      doorHalf: 'upper',
      hinge,
      open: false,
    }, true);
    this.redstone.observeBlockChange(x, y + 1, z);

    return true;
  }

  private placeBed(x: number, y: number, z: number, bedBlockId: number): boolean {
    if (y < 0 || y >= 254) return false;

    const facing = this.getPlayerHorizontalFacing();
    let dx = 0;
    let dz = 0;
    if (facing === 'north') dz = -1;
    else if (facing === 'south') dz = 1;
    else if (facing === 'east') dx = 1;
    else if (facing === 'west') dx = -1;

    const headX = x + dx;
    const headZ = z + dz;

    // Check if both blocks are empty (0)
    if (this.chunks.getBlock(x, y, z) !== 0 || this.chunks.getBlock(headX, y, headZ) !== 0) {
      return false;
    }

    // Check if players are colliding with either of the bed parts
    const px = Math.floor(this.player.position.x);
    const py = Math.floor(this.player.position.y);
    const pz = Math.floor(this.player.position.z);
    const py1 = Math.floor(this.player.position.y + 1.5);

    const overlapsFoot = x === px && z === pz && (y === py || y === py1);
    const overlapsHead = headX === px && headZ === pz && (y === py || y === py1);

    if (overlapsFoot || overlapsHead) {
      return false;
    }

    // Set foot part
    this.chunks.setBlock(x, y, z, bedBlockId);
    this.chunks.setBlockMeta(x, y, z, {
      facing,
      bedPart: 'foot',
    }, true);
    this.redstone.observeBlockChange(x, y, z);

    // Set head part
    this.chunks.setBlock(headX, y, headZ, bedBlockId);
    this.chunks.setBlockMeta(headX, y, headZ, {
      facing,
      bedPart: 'head',
    }, true);
    this.redstone.observeBlockChange(headX, y, headZ);

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
    this.redstone.observeBlockChange(base.x, base.y, base.z);

    if (this.isDoorBlock(this.chunks.getBlock(base.x, base.y + 1, base.z))) {
      this.chunks.setBlock(base.x, base.y + 1, base.z, blockId);
      this.chunks.setBlockMeta(base.x, base.y + 1, base.z, {
        ...upperMeta,
        facing,
        doorHalf: 'upper',
        hinge,
        open,
      }, true);
      this.redstone.observeBlockChange(base.x, base.y + 1, base.z);
    }
  }

  private breakDoor(x: number, y: number, z: number) {
    const base = this.getDoorBase(x, y, z);
    if (!base) return;

    this.chunks.setBlock(base.x, base.y, base.z, 0);
    this.chunks.setBlockMeta(base.x, base.y, base.z, null);
    this.redstone.observeBlockChange(base.x, base.y, base.z);

    if (this.isDoorBlock(this.chunks.getBlock(base.x, base.y + 1, base.z))) {
      this.chunks.setBlock(base.x, base.y + 1, base.z, 0);
      this.chunks.setBlockMeta(base.x, base.y + 1, base.z, null);
      this.redstone.observeBlockChange(base.x, base.y + 1, base.z);
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
    this.redstone.observeBlockChange(x, y, z);
  }

  private ensureChestMetadata(x: number, y: number, z: number): BlockMetadata | null {
    const blockId = this.chunks.getBlock(x, y, z);
    const def = BlockRegistry.get(blockId);
    if (!def || (def.name !== 'chest' && def.name !== 'barrel')) return null;

    const current = this.chunks.getBlockMeta(x, y, z);
    const expectedType = def.name === 'barrel' ? 'barrel' : 'chest';
    if (current?.containerType === expectedType && current.inventory) {
      return current;
    }

    const metadata: BlockMetadata = {
      ...current,
      containerType: expectedType,
      inventory: new Array(27).fill(null),
    };
    this.chunks.setBlockMeta(x, y, z, metadata);
    return metadata;
  }

  private ensureHopperMetadata(x: number, y: number, z: number): BlockMetadata | null {
    const blockId = this.chunks.getBlock(x, y, z);
    const def = BlockRegistry.get(blockId);
    if (!def || def.name !== 'hopper') return null;

    const current = this.chunks.getBlockMeta(x, y, z);
    if (current?.containerType === 'hopper' && current.inventory) {
      return current;
    }

    const metadata: BlockMetadata = {
      ...current,
      containerType: 'hopper',
      inventory: new Array(5).fill(null),
    };
    this.chunks.setBlockMeta(x, y, z, metadata);
    return metadata;
  }

  private ensureFurnaceMetadata(x: number, y: number, z: number): BlockMetadata | null {
    const blockId = this.chunks.getBlock(x, y, z);
    const def = BlockRegistry.get(blockId);
    if (!def || (!def.name.includes('furnace') && def.name !== 'smoker' && def.name !== 'blast_furnace')) return null;

    const expectedType = def.name === 'smoker' ? 'smoker' : (def.name === 'blast_furnace' ? 'blast_furnace' : 'furnace');
    const current = this.chunks.getBlockMeta(x, y, z);
    if (current?.containerType === expectedType && current.inventory) {
      return current;
    }

    const metadata: BlockMetadata = {
      ...current,
      containerType: expectedType as any,
      inventory: new Array(3).fill(null), // 0: input, 1: fuel, 2: output
    };
    this.chunks.setBlockMeta(x, y, z, metadata);
    return metadata;
  }

  private ensureBrewingMetadata(x: number, y: number, z: number): BlockMetadata | null {
    const blockId = this.chunks.getBlock(x, y, z);
    const def = BlockRegistry.get(blockId);
    if (!def || def.name !== 'brewing_stand') return null;

    const current = this.chunks.getBlockMeta(x, y, z);
    if (current?.containerType === 'brewing_stand' && current.inventory) {
      return current;
    }

    const metadata: BlockMetadata = {
      ...current,
      containerType: 'brewing_stand',
      inventory: new Array(5).fill(null), // 0..2: potions, 3: ingredient, 4: fuel
    };
    this.chunks.setBlockMeta(x, y, z, metadata);
    return metadata;
  }

  private getOpenChestInventory(): (ItemStack | null)[] | null {
    if (!this.openChestPos) return null;

    const x = this.openChestPos.x;
    const y = this.openChestPos.y;
    const z = this.openChestPos.z;

    const partners = this.getDoubleChestPartners(x, y, z);
    if (partners) {
      const leftMeta = this.ensureChestMetadata(partners.leftPos.x, partners.leftPos.y, partners.leftPos.z);
      const rightMeta = this.ensureChestMetadata(partners.rightPos.x, partners.rightPos.y, partners.rightPos.z);
      if (!leftMeta || !rightMeta) return null;

      const leftInv = leftMeta.inventory || new Array(27).fill(null);
      const rightInv = rightMeta.inventory || new Array(27).fill(null);

      const merged = [...leftInv, ...rightInv];

      return new Proxy(merged, {
        set: (target, property, value) => {
          const index = Number(property);
          if (!isNaN(index)) {
            target[index] = value;
            if (index < 27) {
              leftInv[index] = value;
              leftMeta.inventory = leftInv;
              this.chunks.setBlockMeta(partners.leftPos.x, partners.leftPos.y, partners.leftPos.z, leftMeta, true);
            } else {
              rightInv[index - 27] = value;
              rightMeta.inventory = rightInv;
              this.chunks.setBlockMeta(partners.rightPos.x, partners.rightPos.y, partners.rightPos.z, rightMeta, true);
            }
            return true;
          }
          return Reflect.set(target, property, value);
        }
      });
    }

    const metadata = this.ensureChestMetadata(x, y, z);
    return metadata?.inventory ?? null;
  }

  private getOpenChestTitleKey(): 'chest' | 'doubleChest' | 'barrel' {
    if (!this.openChestPos) return 'chest';

    const x = this.openChestPos.x;
    const y = this.openChestPos.y;
    const z = this.openChestPos.z;
    const blockId = this.chunks.getBlock(x, y, z);
    const def = BlockRegistry.get(blockId);
    if (def?.name === 'barrel') return 'barrel';
    return this.getDoubleChestPartners(x, y, z) ? 'doubleChest' : 'chest';
  }

  private getDoubleChestPartners(x: number, y: number, z: number): { leftPos: THREE.Vector3; rightPos: THREE.Vector3 } | null {
    const blockId = this.chunks.getBlock(x, y, z);
    const def = BlockRegistry.get(blockId);
    if (!def || def.name !== 'chest') return null;

    const neighbors = [
      { x: x + 1, y, z },
      { x: x - 1, y, z },
      { x, y, z: z + 1 },
      { x, y, z: z - 1 },
    ];

    for (const n of neighbors) {
      const nid = this.chunks.getBlock(n.x, n.y, n.z);
      const ndef = BlockRegistry.get(nid);
      if (ndef && ndef.name === 'chest') {
        const pos1 = new THREE.Vector3(x, y, z);
        const pos2 = new THREE.Vector3(n.x, n.y, n.z);

        if (x === n.x) {
          if (z < n.z) return { leftPos: pos1, rightPos: pos2 };
          return { leftPos: pos2, rightPos: pos1 };
        } else {
          if (x < n.x) return { leftPos: pos1, rightPos: pos2 };
          return { leftPos: pos2, rightPos: pos1 };
        }
      }
    }
    return null;
  }

  private saveOpenChestInventory() {
    if (!this.openChestPos) return;

    const x = this.openChestPos.x;
    const y = this.openChestPos.y;
    const z = this.openChestPos.z;

    const partners = this.getDoubleChestPartners(x, y, z);
    if (partners) {
      const leftMeta = this.ensureChestMetadata(partners.leftPos.x, partners.leftPos.y, partners.leftPos.z);
      const rightMeta = this.ensureChestMetadata(partners.rightPos.x, partners.rightPos.y, partners.rightPos.z);
      if (leftMeta && rightMeta) {
        this.chunks.setBlockMeta(partners.leftPos.x, partners.leftPos.y, partners.leftPos.z, leftMeta, true);
        this.chunks.setBlockMeta(partners.rightPos.x, partners.rightPos.y, partners.rightPos.z, rightMeta, true);
      }
    } else {
      const metadata = this.ensureChestMetadata(x, y, z);
      if (metadata) {
        this.chunks.setBlockMeta(x, y, z, metadata, true);
      }
    }
  }

  private getOpenHopperInventory(): (ItemStack | null)[] | null {
    if (!this.openHopperPos) return null;

    const metadata = this.ensureHopperMetadata(
      this.openHopperPos.x,
      this.openHopperPos.y,
      this.openHopperPos.z
    );
    return metadata?.inventory ?? null;
  }

  private getOpenFurnaceInventory(): (ItemStack | null)[] | null {
    if (!this.openFurnacePos) return null;

    const metadata = this.ensureFurnaceMetadata(
      this.openFurnacePos.x,
      this.openFurnacePos.y,
      this.openFurnacePos.z
    );
    return metadata?.inventory ?? null;
  }

  private getOpenFurnaceType(): 'furnace' | 'smoker' | 'blast_furnace' | null {
    if (!this.openFurnacePos) return null;

    const metadata = this.ensureFurnaceMetadata(
      this.openFurnacePos.x,
      this.openFurnacePos.y,
      this.openFurnacePos.z
    );
    return (metadata?.containerType as 'furnace' | 'smoker' | 'blast_furnace') ?? null;
  }

  private getOpenBrewingInventory(): (ItemStack | null)[] | null {
    if (!this.openBrewingPos) return null;

    const metadata = this.ensureBrewingMetadata(
      this.openBrewingPos.x,
      this.openBrewingPos.y,
      this.openBrewingPos.z
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
    this.redstone.observeBlockChange(x, y, z);
  }

  private handlePistonChange(component: any) {
    const x = component.x;
    const y = component.y;
    const z = component.z;

    const blockId = this.chunks.getBlock(x, y, z);
    const baseId = blockId & 0x3FF;
    if (baseId !== 33 && baseId !== 29) return; // not a piston/sticky piston

    const meta = this.chunks.getBlockMeta(x, y, z) || {};
    const facing = meta.facing || component.facing || 'north';
    const isSticky = baseId === 29;
    const wasExtended = meta.extended === true;
    const shouldExtend = component.state === true;

    if (shouldExtend && !wasExtended) {
      // Extend!
      const pDir = this.getFacingDirection(facing);
      const frontX = x + pDir[0];
      const frontY = y + pDir[1];
      const frontZ = z + pDir[2];

      const pushId = this.chunks.getBlock(frontX, frontY, frontZ);
      const pushBase = pushId & 0x3FF;

      if (pushId !== 0 && !BlockRegistry.isFluid(pushId)) {
        // We have a block to push
        const targetX = frontX + pDir[0];
        const targetY = frontY + pDir[1];
        const targetZ = frontZ + pDir[2];

        // Move the block and its metadata
        const pushMeta = this.chunks.getBlockMeta(frontX, frontY, frontZ);
        this.chunks.setBlock(targetX, targetY, targetZ, pushId);
        this.chunks.setBlockMeta(targetX, targetY, targetZ, pushMeta || null, true);

        // Update redstone system for target block
        this.redstone.unregister(frontX, frontY, frontZ);
        const redType = this.getRedstoneType(pushBase);
        if (redType && pushMeta) {
          this.redstone.register(targetX, targetY, targetZ, redType, pushMeta.facing || 'north', {
            signal: pushMeta.signal || 0,
            state: pushMeta.powered || pushMeta.extended || false,
          });
        }
        this.redstone.observeBlockChange(frontX, frontY, frontZ);
        this.redstone.observeBlockChange(targetX, targetY, targetZ);
      }

      // Spawn piston head (ID 34) at frontPos
      this.chunks.setBlock(frontX, frontY, frontZ, 34);
      this.chunks.setBlockMeta(frontX, frontY, frontZ, {
        facing: facing,
        sticky: isSticky,
      }, true);

      // Update piston base metadata
      this.chunks.setBlockMeta(x, y, z, {
        ...meta,
        extended: true,
        powered: true,
        signal: component.signal,
        facing,
      }, true);
      this.redstone.observeBlockChange(x, y, z);

    } else if (!shouldExtend && wasExtended) {
      // Retract!
      const pDir = this.getFacingDirection(facing);
      const frontX = x + pDir[0];
      const frontY = y + pDir[1];
      const frontZ = z + pDir[2];

      // Remove piston head
      if ((this.chunks.getBlock(frontX, frontY, frontZ) & 0x3FF) === 34) {
        this.chunks.setBlock(frontX, frontY, frontZ, 0);
        this.chunks.setBlockMeta(frontX, frontY, frontZ, null);
        this.redstone.unregister(frontX, frontY, frontZ);
        this.redstone.observeBlockChange(frontX, frontY, frontZ);
      }

      if (isSticky) {
        // Pull the block 2 spaces in front
        const pullX = x + pDir[0] * 2;
        const pullY = y + pDir[1] * 2;
        const pullZ = z + pDir[2] * 2;

        const pullId = this.chunks.getBlock(pullX, pullY, pullZ);
        const pullBase = pullId & 0x3FF;

        if (pullId !== 0 && pullBase !== 7 && pullBase !== 49 && pullBase !== 34 && !BlockRegistry.isFluid(pullId)) {
          const pullMeta = this.chunks.getBlockMeta(pullX, pullY, pullZ);
          this.chunks.setBlock(frontX, frontY, frontZ, pullId);
          this.chunks.setBlockMeta(frontX, frontY, frontZ, pullMeta || null, true);
          this.chunks.setBlock(pullX, pullY, pullZ, 0);
          this.chunks.setBlockMeta(pullX, pullY, pullZ, null);

          // Update redstone system
          this.redstone.unregister(pullX, pullY, pullZ);
          const redType = this.getRedstoneType(pullBase);
          if (redType && pullMeta) {
            this.redstone.register(frontX, frontY, frontZ, redType, pullMeta.facing || 'north', {
              signal: pullMeta.signal || 0,
              state: pullMeta.powered || pullMeta.extended || false,
            });
          }
          this.redstone.observeBlockChange(pullX, pullY, pullZ);
          this.redstone.observeBlockChange(frontX, frontY, frontZ);
        }
      }

      // Update piston base metadata
      this.chunks.setBlockMeta(x, y, z, {
        ...meta,
        extended: false,
        powered: false,
        signal: component.signal,
        facing,
      }, true);
      this.redstone.observeBlockChange(x, y, z);
    }
  }

  private getFacingDirection(facing: string): [number, number, number] {
    const dirs: Record<string, [number, number, number]> = {
      north: [0, 0, -1], south: [0, 0, 1], east: [1, 0, 0], west: [-1, 0, 0],
      up: [0, 1, 0], down: [0, -1, 0],
    };
    return dirs[facing] ?? [0, 0, -1];
  }

  private getOppositeFacing(facing: string): string {
    switch (facing) {
      case 'up': return 'down';
      case 'down': return 'up';
      case 'north': return 'south';
      case 'south': return 'north';
      case 'east': return 'west';
      case 'west': return 'east';
      default: return 'south';
    }
  }

  private destroyBlockAt(x: number, y: number, z: number, spawnDrop: boolean = true) {
    const blockId = this.chunks.getBlock(x, y, z);
    const baseId = blockId & 0x3FF;
    if (baseId === 0) return;

    const meta = this.chunks.getBlockMeta(x, y, z);
    const def = BlockRegistry.get(blockId);

    // 1. Drop contents if it's a container
    if (spawnDrop && meta?.inventory) {
      for (const slot of meta.inventory) {
        if (slot && slot.count > 0) {
          const dropPos = new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5);
          const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 1.5,
            1.5 + Math.random() * 1.5,
            (Math.random() - 0.5) * 1.5
          );
          this.droppedItems.spawnItem(slot.id, slot.count, dropPos, velocity, 0.5);
        }
      }
    }

    // 2. Spawn item drop for the block itself
    if (spawnDrop && this.gameMode !== 'creative') {
      const dropPos = new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5);
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 1.5,
        1.5 + Math.random() * 1.5,
        (Math.random() - 0.5) * 1.5
      );

      if (this.isDoorBlock(blockId)) {
        this.droppedItems.spawnItem(37, 1, dropPos, velocity, 0.5);
      } else if (baseId === 59 || baseId === 141 || baseId === 142) {
        this.spawnCropDrops(x, y, z, blockId);
      } else if (baseId === 92) {
        // Placed cakes are consumed in-world and do not return an item when broken.
      } else if (baseId === 118 || def?.name.includes('cauldron')) {
        this.droppedItems.spawnItem(380, 1, dropPos, velocity, 0.5);
      } else {
        const dropId = ItemRegistry.getBlockDropItem(blockId);
        if (dropId > 0) {
          this.droppedItems.spawnItem(dropId, 1, dropPos, velocity, 0.5);
        }
      }
    }

    // 3. Set block to air and clear metadata
    this.chunks.setBlock(x, y, z, 0);
    this.chunks.setBlockMeta(x, y, z, null);
    this.redstone.unregister(x, y, z);
    this.redstone.observeBlockChange(x, y, z);

    // 4. Handle dependencies recursively
    // Nether wart above
    const aboveId = this.chunks.getBlock(x, y + 1, z) & 0x3FF;
    if (aboveId === 115) {
      this.destroyBlockAt(x, y + 1, z, spawnDrop);
    }
    // Crop above
    if (aboveId === 59 || aboveId === 141 || aboveId === 142) {
      this.destroyBlockAt(x, y + 1, z, spawnDrop);
    }

    // Piston Base -> Piston Head
    if (baseId === 33 || baseId === 29) {
      if (meta?.extended && meta?.facing) {
        const pDir = this.getFacingDirection(meta.facing);
        const hx = x + pDir[0];
        const hy = y + pDir[1];
        const hz = z + pDir[2];
        if ((this.chunks.getBlock(hx, hy, hz) & 0x3FF) === 34) {
          this.destroyBlockAt(hx, hy, hz, false);
        }
      }
    }

    // Piston Head -> Piston Base
    if (baseId === 34) {
      if (meta?.facing) {
        const oppFacing = this.getOppositeFacing(meta.facing);
        const oppDir = this.getFacingDirection(oppFacing);
        const bx = x + oppDir[0];
        const by = y + oppDir[1];
        const bz = z + oppDir[2];
        const baseBlockId = this.chunks.getBlock(bx, by, bz) & 0x3FF;
        if (baseBlockId === 33 || baseBlockId === 29) {
          this.destroyBlockAt(bx, by, bz, spawnDrop);
        }
      }
    }

    // If it was a door, break the other part of the door
    if (this.isDoorBlock(blockId)) {
      this.breakDoor(x, y, z);
    }

    // Bed cascade destruction
    if (baseId === 26) {
      if (meta?.facing && meta?.bedPart) {
        const facing = meta.facing;
        const part = meta.bedPart;
        let dx = 0;
        let dz = 0;
        if (part === 'head') {
          // opposite of facing
          if (facing === 'north') dz = 1;
          else if (facing === 'south') dz = -1;
          else if (facing === 'east') dx = -1;
          else if (facing === 'west') dx = 1;
        } else {
          // same as facing
          if (facing === 'north') dz = -1;
          else if (facing === 'south') dz = 1;
          else if (facing === 'east') dx = 1;
          else if (facing === 'west') dx = -1;
        }
        const partnerX = x + dx;
        const partnerZ = z + dz;
        const partnerId = this.chunks.getBlock(partnerX, y, partnerZ);
        if ((partnerId & 0x3FF) === 26) {
          this.destroyBlockAt(partnerX, y, partnerZ, false);
        }
      }
    }

    // Fluid check after removal
    this.checkFluidAdjacency(x, y, z);
    this.updateFluids(0.4);
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

        const hwA = mobA.width / 2;
        const hwB = mobB.width / 2;
        const dx = mobA.position.x - mobB.position.x;
        const dz = mobA.position.z - mobB.position.z;
        const distSq = dx * dx + dz * dz;
        const minDist = hwA + hwB;

        if (distSq < minDist * minDist) {
          // Check Y overlap
          const yOverlap = (mobA.position.y < mobB.position.y + mobB.height) &&
                           (mobA.position.y + mobA.height > mobB.position.y);
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
    const hwP = PLAYER_WIDTH / 2;
    const playerHeight = player.height;

    for (const mob of mobs) {
      const hwM = mob.width / 2;
      const dx = player.position.x - mob.position.x;
      const dz = player.position.z - mob.position.z;
      const distSq = dx * dx + dz * dz;
      const minDist = hwP + hwM;

      if (distSq < minDist * minDist) {
        // Check Y overlap
        const yOverlap = (player.position.y < mob.position.y + mob.height) &&
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

  private spawnAmbientParticles(dt: number) {
    this.particleScanTimer += dt;
    if (this.particleScanTimer >= 0.5) {
      this.particleScanTimer = 0;
      this.ambientParticleSources = [];
      const px = Math.floor(this.player.position.x);
      const py = Math.floor(this.player.position.y);
      const pz = Math.floor(this.player.position.z);
      
      for (let x = px - 8; x <= px + 8; x++) {
        for (let y = py - 4; y <= py + 8; y++) {
          for (let z = pz - 8; z <= pz + 8; z++) {
            const blockId = this.chunks.getBlock(x, y, z);
            const baseId = blockId & 0x3FF;
            if (baseId === 50) { // Torch
              this.ambientParticleSources.push({ x, y, z, type: 'torch' });
            } else if (baseId === 62) { // Lit furnace
              this.ambientParticleSources.push({ x, y, z, type: 'furnace' });
            } else if (baseId === 116) { // Enchanting table
              this.ambientParticleSources.push({ x, y, z, type: 'enchanting_table' });
            }
          }
        }
      }
    }

    const probabilityMult = dt / 0.016;
    for (const src of this.ambientParticleSources) {
      if (src.type === 'torch') {
        if (Math.random() < 0.05 * probabilityMult) {
          this.particles.spawnFlame(src.x + 0.5, src.y + 0.6, src.z + 0.5, 1);
        }
        if (Math.random() < 0.02 * probabilityMult) {
          this.particles.spawnSmoke(src.x + 0.5, src.y + 0.6, src.z + 0.5, 1);
        }
      } else if (src.type === 'furnace') {
        if (Math.random() < 0.08 * probabilityMult) {
          this.particles.spawnFlame(src.x + 0.5, src.y + 0.3, src.z + 0.5, 1);
        }
        if (Math.random() < 0.04 * probabilityMult) {
          this.particles.spawnSmoke(src.x + 0.5, src.y + 0.6, src.z + 0.5, 1);
        }
      } else if (src.type === 'enchanting_table') {
        for (let dx = -2; dx <= 2; dx++) {
          for (let dy = 0; dy <= 1; dy++) {
            for (let dz = -2; dz <= 2; dz++) {
              if (dx === 0 && dz === 0) continue;
              const bx = src.x + dx;
              const by = src.y + dy;
              const bz = src.z + dz;
              const blockId = this.chunks.getBlock(bx, by, bz);
              if ((blockId & 0x3FF) === 47) { // Bookshelf
                if (Math.random() < 0.01 * probabilityMult) {
                  this.particles.spawnEnchantingGlyphs(
                    bx + 0.5, by + 0.5, bz + 0.5,
                    src.x + 0.5, src.y + 0.8, src.z + 0.5,
                    1
                  );
                }
              }
            }
          }
        }
      }
    }
  }

  private updateFurnaces(dt: number) {
    this.furnaceTickTimer += dt;
    if (this.furnaceTickTimer < 0.1) return;
    const elapsed = this.furnaceTickTimer;
    this.furnaceTickTimer = 0;

    for (const chunk of this.chunks.chunks.values()) {
      for (const [index, meta] of chunk.metadata.entries()) {
        if (
          meta.containerType === 'furnace' ||
          meta.containerType === 'smoker' ||
          meta.containerType === 'blast_furnace'
        ) {
          const temp = index;
          const x = temp % CHUNK_SIZE;
          const z = Math.floor((temp % (CHUNK_SIZE * CHUNK_SIZE)) / CHUNK_SIZE);
          const y = Math.floor(temp / (CHUNK_SIZE * CHUNK_SIZE));
          
          this.tickFurnaceMetadata(chunk, index, x, y, z, meta, elapsed);
        }
      }
    }
  }

  private tickFurnaceMetadata(
    chunk: any,
    index: number,
    x: number,
    y: number,
    z: number,
    meta: BlockMetadata,
    elapsed: number
  ) {
    if (!meta.inventory) return;

    if (meta.burnTime === undefined) meta.burnTime = 0;
    if (meta.cookTime === undefined) meta.cookTime = 0;
    if (meta.maxBurnTime === undefined) meta.maxBurnTime = 0;

    const isLit = meta.burnTime > 0;
    if (isLit) {
      meta.burnTime = Math.max(0, meta.burnTime - elapsed);
    }

    const input = meta.inventory[0];
    const fuel = meta.inventory[1];
    const output = meta.inventory[2];

    const hasRecipe = input ? findSmeltingResult(input.id) : null;
    let canCook = false;
    let recipeOutputId = 0;
    let recipeOutputCount = 0;
    let recipeCookTime = 10;

    if (hasRecipe && input) {
      let typeValid = true;
      const itemDef = ItemRegistry.get(input.id);
      if (itemDef) {
        if (meta.containerType === 'smoker') {
          typeValid = ItemRegistry.isFood(input.id) || ItemRegistry.isFood(hasRecipe.output);
        } else if (meta.containerType === 'blast_furnace') {
          typeValid = (itemDef.name.includes('ore') || itemDef.name.startsWith('raw_')) && !ItemRegistry.isFood(input.id);
        }
      } else {
        typeValid = false;
      }

      if (typeValid) {
        recipeOutputId = hasRecipe.output;
        recipeOutputCount = hasRecipe.outputCount;
        recipeCookTime = hasRecipe.cookTime;

        if (!output) {
          canCook = true;
        } else if (output.id === recipeOutputId && output.count + recipeOutputCount <= 64) {
          canCook = true;
        }
      }
    }

    let metadataChanged = false;

    // Consume fuel if furnace is unlit but we need to cook
    if (meta.burnTime === 0 && canCook && fuel && isSmeltingFuel(fuel.id)) {
      const fuelBurnTime = getFuelBurnTime(fuel.id);
      if (fuelBurnTime > 0) {
        meta.burnTime = fuelBurnTime;
        meta.maxBurnTime = fuelBurnTime;

        const baseFuelId = fuel.id & 0x3FF;
        if (baseFuelId === 327) { // Lava bucket -> empty bucket
          meta.inventory[1] = { id: 325, count: 1 };
        } else {
          fuel.count--;
          if (fuel.count <= 0) {
            meta.inventory[1] = null;
          }
        }
        metadataChanged = true;
      }
    }

    const currentlyLit = meta.burnTime > 0;

    if (currentlyLit && canCook && input) {
      const speed = (meta.containerType === 'smoker' || meta.containerType === 'blast_furnace') ? 2 : 1;
      meta.cookTime += elapsed * speed;

      if (meta.cookTime >= recipeCookTime) {
        meta.cookTime = 0;
        
        // Consume input
        input.count--;
        if (input.count <= 0) {
          meta.inventory[0] = null;
        }

        // Produce output
        if (!output) {
          meta.inventory[2] = { id: recipeOutputId, count: recipeOutputCount };
        } else {
          meta.inventory[2] = { ...output, count: output.count + recipeOutputCount };
        }

        metadataChanged = true;
      }
    } else {
      if (meta.cookTime > 0) {
        meta.cookTime = Math.max(0, meta.cookTime - elapsed * 2);
        metadataChanged = true;
      }
    }

    const litStateChanged = currentlyLit !== isLit;

    if (litStateChanged || metadataChanged) {
      chunk.dirty = true;

      const worldX = chunk.cx * CHUNK_SIZE + x;
      const worldZ = chunk.cz * CHUNK_SIZE + z;
      if (
        this.openFurnacePos &&
        this.openFurnacePos.x === worldX &&
        this.openFurnacePos.y === y &&
        this.openFurnacePos.z === worldZ
      ) {
        this.notifyState();
      }
    }
  }

  dispose() {
    this.running = false;
    this.container.removeEventListener('click', this.handleContainerClick);
    if (this.openUI !== 'menu') {
      this.saveGame();
    }
    this.clearFishingBobber();
    this.mobs.dispose();
    this.vehicles.dispose();
    this.enderDragon.dispose();
    this.particles.dispose();
    this.xp.dispose();
    this.weather.dispose();
    this.sound.dispose();
    this.redstone.dispose();
    this.input.dispose();
    this.renderer.dispose();
  }
}
