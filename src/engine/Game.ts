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
import { canConsumeFoodItem, getDefaultUseRemainderItemId, getItemUseDurationSeconds, shouldConsumePlacedItem } from '../items/ItemUseRules';
import { SurvivalSystem } from '../systems/SurvivalSystem';
import { MobSystem } from '../systems/MobSystem';
import { Mob } from '../entities/Mob';
import { shouldTameEntity } from '../entities/EntityInteractionRules';
import { canApplySaddle, canControlMountedMob, canMountMob, getNameTagLabel } from '../entities/MobItemInteractionRules';
import { armorStandSlotIndex, canPlaceArmorStandAt, firstEquippedArmorStandSlot, snapArmorStandYaw } from '../entities/ArmorStandRules';
import {
  LEAD_SNAP_DISTANCE,
  canPlaceHangingEntity,
  choosePaintingVariant,
  hangingEntityWorldPosition,
  hangingSupportPositionFromWorld,
  fenceLeashHolderId,
  isFenceBlockName,
  isLeashableMobType,
  mobLeashHolderId,
  parseFenceLeashHolderId,
  parseMobLeashHolderId,
  leashDistance,
  leashPullVector,
  shouldBreakLeash,
  type HangingEntityType,
} from '../entities/HangingEntityRules';
import { cloneItemStack } from '../items/ItemStackRules';
import {
  getJukeboxSong,
  getStoredJukeboxDisc,
  isJukeboxPlayableItemName,
} from '../world/JukeboxRules';
import {
  TOTEM_OF_UNDYING_EFFECTS,
  consumeTotemStack,
  findHeldTotemHand,
  shouldActivateTotem,
} from '../items/TotemRules';
import { ParticleSystem } from '../systems/ParticleSystem';
import { FluidSystem } from '../systems/FluidSystem';
import { WeatherSystem } from '../systems/WeatherSystem';
import { SoundSystem } from '../systems/SoundSystem';
import { ResourcePackSystem } from '../systems/ResourcePackSystem';
import { DataPackSystem } from '../systems/DataPackSystem';
import {
  SAVE_SCHEMA_VERSION,
  SaveSystem,
  type SaveData,
  type SaveDimensionId,
  type SavedChunk,
  type SerializedMob,
} from '../systems/SaveSystem';
import { RedstoneSystem, type RedstoneEntity } from '../systems/RedstoneSystem';
import { ProjectileSystem, type ProjectileType } from '../systems/ProjectileSystem';
import { CommandSystem } from '../systems/CommandSystem';
import { VisualResolver } from '../visual/VisualResolver';
import { Dimension, DimensionGenerator } from '../world/DimensionGenerator';
import { DroppedItemSystem } from '../systems/DroppedItemSystem';
import { VehicleSystem, Vehicle } from '../systems/VehicleSystem';
import { XPSystem } from '../systems/XPSystem';
import { EnchantSystem } from '../systems/EnchantSystem';
import { PotionEffectSystem, PotionEffects } from '../systems/PotionEffect';
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
import type { PotionEffectData } from '../systems/PotionEffect';
import { NetworkClient } from '../server/NetworkClient';
import { PacketType } from '../server/NetworkProtocol';
import { coordinateRandom, XorShiftRandom, hashIntegers } from './DeterministicRandom';
import { TickScheduler, type ScheduledTick } from '../systems/TickScheduler';
import {
  BehaviorRegistry,
  type BlockInteractionContext,
  type BlockPosition,
  type EntityInteractionContext,
  type ItemInteractionContext,
  type ItemUseStopReason,
  type WorldContext,
} from '../world/BehaviorRegistry';
import { planBlockPlacement } from '../world/BlockPlacement';
import { spawnEggMobTypeForItemName } from '../world/SpawnEggRules';
import { resolveAxeStrippedBlockName, resolveHoeFarmlandTargetName, resolveShovelPathTargetName, rotateBoneMealSpreadOffsets26_3 } from '../world/ItemOnBlockRules';
import { fallingLeafParticle26_3, shouldPrioritizeShieldUse26_3 } from '../world/WildernessBoundChanges26_3';
import { useStrawBed as resolveStrawBedUse26_3 } from '../world/WildernessBound26_3';
import {
  CushionSeatSystem26_3,
  cushionColorFromItemName26_3,
  type CushionPlacementPoint,
} from '../world/WildernessBoundGameplay26_3';
import { applySaturationStew26_3 } from '../world/SuspiciousStew26_3';
import { findChorusFruitDestination26_3 } from '../world/TeleportRules26_3';
import { GOAT_HORN_COOLDOWN_SECONDS, goatHornSoundIndex, spyglassFov } from '../items/SpecialItemUseRules';
import { WIND_CHARGE_COOLDOWN_SECONDS, WIND_CHARGE_DIRECT_DAMAGE, windBurstImpulse } from '../items/WindChargeRules';
import { getMaceSmashBonus, getMaceSmashImpulse, isMaceSmash, MACE_HEAVY_SMASH_THRESHOLD } from '../items/MaceRules';
import { isBundleItemName, removeOneFromBundle } from '../items/BundleRules';
import {
  createDecoratedPotMetadata,
  decoratedPotBreakDrops,
  decoratedPotDecorationStacks,
  insertOneIntoDecoratedPot,
} from '../items/DecoratedPotRules';
import {
  archaeologyBrushStage,
  archaeologyTargetKey,
  brushedReplacementName,
  isBrushExcavationComplete,
  isSuspiciousBlockName,
  normalizeArchaeologyLootCount,
} from '../items/ArchaeologyRules';
import { getButtonPressTicks } from '../world/ButtonRules';
import {
  applySignInteraction,
  createDefaultSignMetadata,
  getSignSideForPlayer,
  getSignTextForSide,
  isSignBlockName,
  isWallSignBlockName,
  setSignTextForSide,
  type SignSide,
} from '../world/SignRules';
import { resolveFenceGateManualToggle, resolveOpenableRedstoneState } from '../world/OpenableRules';
import { canPlaceChestFromNeighborDegrees, isChestObstructingBlock } from '../world/ContainerRules';
import { canAcceptFurnaceOutput, getFurnaceCookSpeed, getFurnaceFuelBurnTime, getFurnaceFuelRemainder, getWetSpongeFuelRemainder, isFurnaceRecipeAllowed } from '../world/FurnaceRules';
import { getBedHeadPosition, getBedOtherPosition, isMonsterWithinBedSleepRange, resolveBedUse } from '../world/BedRules';
import { getDamageShake, normalizeDamageFlash } from '../systems/FeelRules';
import { rollBlockLoot, rollLootTable, type LootTable } from '../world/LootSystem';
import { getBlockXpRange, rollXp, BREEDING_XP_RANGE, FISHING_XP_RANGE, EXPERIENCE_BOTTLE_XP_RANGE } from '../world/XpRules';
import type { WorldTickPayload, WorldTickType } from '../world/WorldTick';
import { getAttackCooldownSeconds } from '../items/CombatAttributes';
import { calculateMeleeDamage, getSweepDamage, isChargedMeleeAttack } from '../systems/CombatRules';
import { applyDamageProtection, baseArmorApplies, type PlayerDamageKind } from '../systems/DamageRules';
import {
  SHIELD_MOVEMENT_MULTIPLIER,
  getBlockedShieldDurabilityDamage,
  isShieldBlockActive,
  shieldCanBlockDamage,
  shieldFacesSource,
} from '../systems/ShieldRules';
import { createHurtCooldownState, resolveHurtDamage, tickHurtCooldown } from '../systems/HurtCooldown';
import { getMeleeDurabilityCost } from '../systems/DurabilityRules';
import {
  BOW_FULL_CHARGE_SECONDS,
  canReleaseBow,
  getBowPower as getJavaBowPower,
  getCrossbowChargeSeconds,
} from '../systems/RangedRules';

const HONEY_BOTTLE_ID = 454;
const GLASS_BOTTLE_ID = 374;
const ENDER_EYE_ID = 381;
const ENDER_PEARL_ID = 368;
const SNOWBALL_ID = 332;
const EGG_ID = 344;
const FISHING_ROD_ID = 346;
const EXPERIENCE_BOTTLE_ID = 384;
const RAW_FISH_ID = 349;
const RAW_SALMON_ID = (1 << 10) | 349;
const CLOWNFISH_ID = (2 << 10) | 349;
const PUFFERFISH_ID = (3 << 10) | 349;

// P2.7: fishing loot as a data-driven loot table (weights mirror 1.20.1 odds).
const FISHING_LOOT_TABLE: LootTable = {
  pools: [{
    rolls: 1,
    entries: [
      { itemId: RAW_FISH_ID, min: 1, max: 1, weight: 70 },
      { itemId: RAW_SALMON_ID, min: 1, max: 1, weight: 18 },
      { itemId: CLOWNFISH_ID, min: 1, max: 1, weight: 8 },
      { itemId: PUFFERFISH_ID, min: 1, max: 1, weight: 4 },
    ],
  }],
};
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
const BOW_BASE_DAMAGE = 6;
const BOW_MIN_SPEED = 7;
const BOW_MAX_SPEED = 30;
const WORLD_SPAWN_X = 8;
const WORLD_SPAWN_Z = 8;
const CAMPFIRE_COOK_TICKS = 30 * 20;

export type UIType = 'none' | 'inventory' | 'furnace' | 'crafting_table' | 'chest' | 'hopper' | 'enchanting_table' | 'anvil' | 'brewing_stand' | 'trading' | 'death' | 'menu' | 'pause' | 'end_poem' | 'sign_edit' | 'advancements' | 'map' | 'book' | 'stonecutter' | 'cartography_table' | 'loom';

type FishingBobberState = {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  phase: 'flying' | 'waiting' | 'hooked';
  waitTimer: number;
  hookedTimer: number;
};

type GameBlockInteractionContext = BlockInteractionContext;
type GameItemInteractionContext = ItemInteractionContext;
type GameEntityInteractionContext = EntityInteractionContext<Mob | Vehicle>;
type ActiveItemUse = {
  itemId: number;
  slotIndex: number;
  elapsedSeconds: number;
  stackSnapshot: ItemStack;
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
  absorption: number;
  /** P4.4 — normalized damage flash (0..1) for the red vignette overlay. */
  damageFlash: number;
  /** P5.4 — multiplayer connection status for the UI. */
  networkStatus: 'idle' | 'connecting' | 'connected' | 'disconnected';
  onGround: boolean;
  flying: boolean;
  openUI: UIType;
  inventory: Inventory;
  chestInventory: (ItemStack | null)[] | null;
  serverContainerCursor: ItemStack | null;
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
  improvedTransparency26_3: { enabled: boolean; backend: 'sorted-alpha' | 'oit-pending'; fullOit: false };
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
  private editingSignSide: SignSide = 'front';
  editingBookSlot: number | null = null;
  openMapSlot: number | null = null;
  lookedAtSignText: string[] | null = null;
  private commands: CommandSystem;
  private clock: THREE.Clock;
  gamerules!: GameRuleSystem;
  advancements!: AdvancementSystem;
  running = false;
  private stateListeners: GameStateListener[] = [];
  private targetBlock: { blockPos: THREE.Vector3; faceNormal: THREE.Vector3; hitPoint: THREE.Vector3 } | null = null;
  private highlightMesh: THREE.LineSegments | null = null;
  private fpsFrames = 0;
  private fpsTime = 0;
  private currentFps = 0;
  private breakCooldown = 0;
  /** P4.2 — timer for random cave drip ambience. */
  private caveDripTimer = 0;
  /** P5.2 — throttle for uploading local player state in multiplayer. */
  private playerStateSyncTimer = 0;
  /** P3.4 — lingering potion area clouds. */
  private lingeringClouds: Array<{
    pos: THREE.Vector3;
    effect: PotionEffectData;
    remaining: number;
    tickTimer: number;
  }> = [];
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
  private spawnProtectionTimer = 0;
  private swordSwingTimer = 0;
  private attackCooldownTimer = 0;
  private attackCooldownDuration = 0.625;
  private isShieldBlocking = false;
  private shieldUseTimer = 0;
  private shieldDisableTimer = 0;
  private hurtCooldown = createHurtCooldownState();
  private bowChargeTimer = 0;
  private bowChargeActive = false;
  private fishingBobber: FishingBobberState | null = null;
  private eatingTimer = 0;
  private chewSoundTimer = 0;
  private activeItemUse: ActiveItemUse | null = null;
  private activeBrushTarget: { x: number; y: number; z: number; key: string } | null = null;
  private brushLastStage = 0;
  private goatHornCooldown = 0;
  private windChargeCooldown = 0;
  private maceFallStartY: number | null = null;
  private maceFallDistance = 0;
  private stepTimer = 0;
  private perspectiveMode: 'first' | 'third' = 'first';
  private container: HTMLElement;
  private fpArmGroup!: THREE.Group;
  private fpLastHeldItemId = -1;
  private openChestPos: THREE.Vector3 | null = null;
  private openChestVehicleId: number | null = null;
  private serverContainerCursor: ItemStack | null = null;
  private vehicleInputSendTimer = 0;
  private mobInputSendTimer = 0;
  private leashLines = new Map<number, THREE.Line>();
  private openHopperPos: THREE.Vector3 | null = null;
  private openFurnacePos: THREE.Vector3 | null = null;
  private openBrewingPos: THREE.Vector3 | null = null;
  private tradingProfession: VillagerProfession | null = null;
  private lastLightRebuildTime = -1;
  private lightScanTimer = 0;
  private ambientTimer = 0;
  private farmingTickAccumulator = 0;
  private farmingSimulationSequence = 0;
  private furnaceTickTimer = 0;
  private particleScanTimer = 0;
  private ambientParticleSources: { x: number; y: number; z: number; type: 'torch' | 'furnace' | 'enchanting_table' | 'poplar_leaves'; color?: number; blockId?: number }[] = [];
  private savedMobsByDimension: Partial<Record<SaveDimensionId, SerializedMob[]>> = {};
  private worldTickScheduler = new TickScheduler<WorldTickType, WorldTickPayload>(20);
  private behaviors = new BehaviorRegistry<
    GameBlockInteractionContext,
    GameItemInteractionContext,
    GameEntityInteractionContext
  >();
  private cushionSeats26_3 = new CushionSeatSystem26_3();
  private cushionMeshes26_3 = new Map<string, THREE.Mesh>();
  private activeCushionSeat26_3: CushionPlacementPoint | null = null;

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
    this.setupNetworkStatusHook();
    this.chunks = new ChunkManager(this.renderer.scene, this.atlas, this.seed, this);
    this.clock = new THREE.Clock();
    this.inventory = new Inventory();
    this.survival = new SurvivalSystem(new XorShiftRandom(hashIntegers(this.seed, 0x53555256)));
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
    this.mobs.setItemVisualFactory((itemId) => this.player.createItemVisualMesh(itemId));
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
    this.registerBehaviors();
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

  private registerBehaviors() {
    this.behaviors.registerBlock(['cauldron', 'water_cauldron', 'lava_cauldron'], {
      id: 'minecraft:cauldron',
      interact: ({ position, block, heldItem }) => ({
        handled: this.tryUseCauldronWithBucket(
          position.x,
          position.y,
          position.z,
          block.name,
          heldItem?.id ?? 0,
          heldItem,
        ),
        cooldown: 0.25,
      }),
    });
    this.behaviors.registerBlock('composter', {
      id: 'minecraft:composter',
      interact: ({ position, block, heldItem }) => ({
        handled: this.tryUseComposter(position.x, position.y, position.z, block.name, heldItem),
        cooldown: 0.25,
      }),
    });
    this.behaviors.registerBlock('cake', {
      id: 'minecraft:cake',
      preventsItemUse: true,
      interact: ({ position }) => {
        this.eatCakeBlock(position.x, position.y, position.z);
        return { handled: true, cooldown: 0.25 };
      },
    });
    this.behaviors.registerBlock('bell', {
      id: 'minecraft:bell',
      preventsItemUse: true,
      interact: ({ position }) => {
        this.ringBell(position.x, position.y, position.z);
        return { handled: true, cooldown: 0.35 };
      },
    });
    this.behaviors.registerBlock(['campfire', 'soul_campfire'], {
      id: 'minecraft:campfire',
      interact: ({ position, heldItem }) => ({
        handled: this.tryUseCampfire(position.x, position.y, position.z, heldItem),
        cooldown: 0.25,
      }),
      scheduledTick: (_world, position, reason) => {
        if (reason === 'campfire_cook') {
          this.completeCampfireCooking(position.x, position.y, position.z);
        }
      },
    });

    this.behaviors.registerBlock(['furnace', 'lit_furnace', 'smoker', 'blast_furnace'], {
      id: 'minecraft:furnace',
      preventsItemUse: true,
      interact: ({ position }) => {
        this.openFurnaceUI(position.x, position.y, position.z);
        return { handled: true, cooldown: 0.5 };
      },
    });
    this.behaviors.registerBlock('crafting_table', {
      id: 'minecraft:crafting_table',
      preventsItemUse: true,
      interact: () => {
        this.openCraftingTableUI();
        return { handled: true, cooldown: 0.5 };
      },
    });
    // P3.5: stonecutter / cartography table / loom open their workstation UIs.
    this.behaviors.registerBlock([], {
      id: 'minecraft:stonecutter',
      preventsItemUse: true,
      interact: () => {
        this.openStonecutterUI();
        return { handled: true, cooldown: 0.5 };
      },
    });
    this.behaviors.registerBlock([], {
      id: 'minecraft:cartography_table',
      preventsItemUse: true,
      interact: () => {
        this.openCartographyUI();
        return { handled: true, cooldown: 0.5 };
      },
    });
    this.behaviors.registerBlock([], {
      id: 'minecraft:loom',
      preventsItemUse: true,
      interact: () => {
        this.openLoomUI();
        return { handled: true, cooldown: 0.5 };
      },
    });
    this.behaviors.registerBlock(['chest', 'barrel'], {
      id: 'minecraft:storage',
      preventsItemUse: true,
      interact: ({ position }) => {
        this.openChestUI(position.x, position.y, position.z);
        return { handled: true, cooldown: 0.5 };
      },
    });
    this.behaviors.registerBlock('hopper', {
      id: 'minecraft:hopper',
      preventsItemUse: true,
      interact: ({ position }) => {
        this.openHopperUI(position.x, position.y, position.z);
        return { handled: true, cooldown: 0.5 };
      },
    });
    this.behaviors.registerBlock('enchanting_table', {
      id: 'minecraft:enchanting_table',
      preventsItemUse: true,
      interact: () => {
        this.openEnchantUI();
        return { handled: true, cooldown: 0.5 };
      },
    });
    this.behaviors.registerBlock(['anvil', 'chipped_anvil', 'damaged_anvil'], {
      id: 'minecraft:anvil',
      preventsItemUse: true,
      interact: () => {
        this.openAnvilUI();
        return { handled: true, cooldown: 0.5 };
      },
    });
    this.behaviors.registerBlock('brewing_stand', {
      id: 'minecraft:brewing_stand',
      preventsItemUse: true,
      interact: ({ position }) => {
        this.openBrewingUI(position.x, position.y, position.z);
        return { handled: true, cooldown: 0.5 };
      },
    });
    this.behaviors.registerBlock('wooden_door', {
      id: 'minecraft:door',
      preventsItemUse: true,
      interact: ({ position }) => {
        this.toggleDoor(position.x, position.y, position.z);
        this.sound.playLever();
        return { handled: true, cooldown: 0.25 };
      },
    });
    this.behaviors.registerBlock('trapdoor', {
      id: 'minecraft:trapdoor',
      preventsItemUse: true,
      interact: ({ position }) => {
        this.toggleTrapdoor(position.x, position.y, position.z);
        this.sound.playLever();
        return { handled: true, cooldown: 0.25 };
      },
    });
    this.behaviors.registerBlock(['daylight_detector', 'daylight_detector_inverted'], {
      id: 'minecraft:daylight_detector',
      preventsItemUse: true,
      interact: ({ position, blockId }) => {
        this.toggleDaylightDetector(position.x, position.y, position.z, blockId);
        return { handled: true, cooldown: 0.25 };
      },
    });
    this.behaviors.registerBlock(['comparator', 'unpowered_comparator', 'powered_comparator'], {
      id: 'minecraft:comparator',
      preventsItemUse: true,
      interact: ({ position, blockId }) => {
        this.toggleComparatorMode(position.x, position.y, position.z, blockId);
        return { handled: true, cooldown: 0.25 };
      },
    });
    this.behaviors.registerBlock('lever', {
      id: 'minecraft:lever',
      preventsItemUse: true,
      interact: ({ position }) => {
        const powered = this.redstone.toggleLever(position.x, position.y, position.z);
        this.updateRedstoneMetadata(position.x, position.y, position.z, {
          powered,
          signal: powered ? 15 : 0,
        });
        this.applyRedstoneToNeighbors(position.x, position.y, position.z);
        this.sound.playLever();
        return { handled: true, cooldown: 0.25 };
      },
    });
    this.behaviors.registerBlock(['tnt'], {
      id: 'minecraft:tnt',
      // TNT is inert to an ordinary right-click; ignition belongs to the held item.
      interact: () => ({ handled: false }),
    });
    // P3.6: repeater delay cycling + note block pitch cycling.
    this.behaviors.registerBlock([], {
      id: 'minecraft:repeater',
      preventsItemUse: true,
      interact: ({ position }) => {
        this.cycleRepeaterDelay(position.x, position.y, position.z);
        this.sound.playLever();
        return { handled: true, cooldown: 0.25 };
      },
    });
    this.behaviors.registerBlock([], {
      id: 'minecraft:note_block',
      preventsItemUse: true,
      interact: ({ position }) => {
        this.cycleNotePitch(position.x, position.y, position.z);
        return { handled: true, cooldown: 0.25 };
      },
    });
    this.behaviors.registerBlock([], {
      id: 'minecraft:jukebox',
      interact: ({ position, blockId, heldItem }) => ({
        handled: this.tryInteractJukebox(position, blockId, heldItem),
        cooldown: 0.25,
      }),
    });
    this.behaviors.registerBlock([], {
      id: 'minecraft:decorated_pot',
      interact: ({ position, heldItem }) => ({
        handled: this.tryInsertDecoratedPot(position.x, position.y, position.z, heldItem),
        cooldown: 0.12,
      }),
    });
    // P3.1: buttons (wooden 0.5s / stone 1.5s press), fence gates and iron
    // doors. Buttons emit a redstone pulse while pressed and reset on a
    // scheduled world tick; gates open/close by hand and by redstone; iron
    // doors ignore right-click and are driven by redstone only.
    this.behaviors.registerBlock([], {
      id: 'minecraft:button',
      preventsItemUse: true,
      interact: ({ position }) => {
        this.pressButton(position.x, position.y, position.z);
        return { handled: true, cooldown: 0.25 };
      },
      scheduledTick: (_world, position, reason) => {
        if (reason === 'button_reset') {
          this.releaseButton(position.x, position.y, position.z);
        }
      },
    });
    this.behaviors.registerBlock([], {
      id: 'minecraft:fence_gate',
      preventsItemUse: true,
      interact: ({ position }) => {
        this.toggleFenceGate(position.x, position.y, position.z);
        this.sound.playLever();
        return { handled: true, cooldown: 0.25 };
      },
    });
    this.behaviors.registerBlock([], {
      id: 'minecraft:fence',
      interact: ({ position, block, heldItem }) => ({
        handled: this.tryTieLeashedMobsToFence(position, block.name, heldItem),
        cooldown: 0.25,
      }),
    });
    this.behaviors.registerBlock([], {
      id: 'minecraft:iron_door',
      preventsItemUse: true,
      interact: () => ({ handled: true, cooldown: 0.25 }), // iron doors cannot be hand-opened
    });
    this.behaviors.registerBlock([], {
      id: 'minecraft:iron_trapdoor',
      preventsItemUse: true,
      interact: () => ({ handled: true, cooldown: 0.25 }), // iron trapdoors are redstone-only too
    });
    this.behaviors.registerBlock('bed', {
      id: 'minecraft:bed',
      preventsItemUse: true,
      interact: ({ position }) => {
        this.useBed(position.x, position.y, position.z);
        return { handled: true, cooldown: 0.25 };
      },
    });
    this.behaviors.registerBlock([], {
      id: 'minecraft:straw_bed',
      preventsItemUse: true,
      interact: ({ position }) => {
        this.useStrawBed26_3(position.x, position.y, position.z);
        return { handled: true, cooldown: 0.25 };
      },
    });
    this.behaviors.registerBlock([], {
      id: 'minecraft:sign',
      preventsItemUse: true,
      interact: (context) => {
        const { position, heldItem } = context;
        const block = BlockRegistry.get(this.chunks.getBlock(position.x, position.y, position.z));
        if (!block) return { handled: false };
        const currentMeta = this.chunks.getBlockMeta(position.x, position.y, position.z);
        const side = getSignSideForPlayer(
          block.name,
          currentMeta,
          position.x,
          position.z,
          this.player.position.x,
          this.player.position.z,
        );
        const heldItemName = heldItem ? ItemRegistry.get(heldItem.id)?.name : undefined;
        const result = applySignInteraction(currentMeta, heldItemName, side);

        if (result.consumeItem && heldItem && this.sendServerBlockItemUse(heldItem, context)) {
          return { handled: true, cooldown: 0.25 };
        }

        if (!this.isMultiplayerNetworkConnected()) {
          this.chunks.setBlockMeta(position.x, position.y, position.z, result.metadata, true);
          if (result.consumeItem && heldItem && this.gameMode !== 'creative') {
            this.inventory.removeFromSlot(this.player.selectedSlot, 1);
          }
        }

        if (result.opensEditor) {
          this.editingSignPos = new THREE.Vector3(position.x, position.y, position.z);
          this.editingSignSide = side;
          this.openUI = 'sign_edit';
          document.exitPointerLock();
        }
        this.notifyState();
        return { handled: result.handled, cooldown: 0.25 };
      },
    });

    this.behaviors.registerItem(['map', 'filled_map', 'writable_book', 'written_book'], {
      id: 'minecraft:readable',
      use: ({ stack }) => ({ handled: this.tryUseHeldReadableItem(stack), cooldown: 0.35 }),
    });
    this.behaviors.registerItem('block_item', {
      id: 'minecraft:block_item',
      use: ({ stack, target }) => ({
        handled: this.tryPlaceBlockItem(stack, target),
        cooldown: 0.25,
      }),
    });
    this.behaviors.registerItem([], {
      id: 'minecraft:cushion',
      use: ({ item, stack, target }) => ({
        handled: this.tryPlaceCushion26_3(item.name, stack, target),
        cooldown: 0.25,
      }),
    });
    this.behaviors.registerItem('bow', {
      id: 'minecraft:bow',
      canStartUse: () => this.canUseBow(),
      startUse: () => {
        this.bowChargeActive = true;
        this.bowChargeTimer = 0;
        this.breakProgress = 0;
        this.breakingBlockPos = null;
        this.lastFrameWasBreaking = false;
        this.notifyState();
        return { handled: true };
      },
      continueUse: (_context, progress) => {
        this.bowChargeTimer = progress.elapsedSeconds;
        return { handled: true };
      },
      stopUse: (_context, progress) => {
        if (progress.reason === 'released') {
          this.releaseBowCharge(progress.stillSelected);
        } else {
          this.bowChargeActive = false;
          this.bowChargeTimer = 0;
          this.notifyState();
        }
        return { handled: true };
      },
    });
    this.behaviors.registerItem('crossbow', {
      id: 'minecraft:crossbow',
      use: ({ stack }) => ({ handled: this.fireLoadedCrossbow(stack), cooldown: 0.5 }),
      canStartUse: ({ stack }) => !stack.chargedProjectileId && this.canUseBow(),
      startUse: () => {
        this.bowChargeActive = true;
        this.bowChargeTimer = 0;
        this.breakProgress = 0;
        this.breakingBlockPos = null;
        this.lastFrameWasBreaking = false;
        this.notifyState();
        return { handled: true };
      },
      continueUse: ({ stack }, progress) => {
        const chargeTime = getCrossbowChargeSeconds(EnchantSystem.getLevel(stack, 'quick_charge'));
        this.bowChargeTimer = chargeTime <= 0
          ? BOW_FULL_CHARGE_SECONDS
          : progress.elapsedSeconds / chargeTime * BOW_FULL_CHARGE_SECONDS;
        if (progress.elapsedSeconds < chargeTime) return { handled: true };

        const projectileId = this.getBowAmmoItemId() ?? ItemRegistry.getByName('arrow')?.id ?? 262;
        if (this.gameMode !== 'creative') {
          if (!this.inventory.removeItem(projectileId, 1)) {
            return { handled: true, completed: true };
          }
        }
        stack.chargedProjectileId = projectileId;
        this.bowChargeActive = false;
        this.bowChargeTimer = 0;
        this.sound.playLever();
        this.notifyState();
        return { handled: true, completed: true, cooldown: 0.2 };
      },
      stopUse: (_context, progress) => {
        this.bowChargeActive = false;
        this.bowChargeTimer = 0;
        if (progress.reason !== 'completed') this.notifyState();
        return { handled: true };
      },
    });
    this.behaviors.registerItem('shield', {
      id: 'minecraft:shield',
      startUse: () => ({ handled: true }),
      continueUse: () => ({ handled: true }),
      stopUse: () => ({ handled: true }),
    });
    this.behaviors.registerItem('spyglass', {
      id: 'minecraft:spyglass',
      startUse: () => {
        this.setSpyglassActive(true);
        return { handled: true };
      },
      continueUse: () => ({ handled: true }),
      stopUse: () => {
        this.setSpyglassActive(false);
        return { handled: true };
      },
    });
    this.behaviors.registerItem('goat_horn', {
      id: 'minecraft:goat_horn',
      use: ({ stack }) => {
        if (this.goatHornCooldown > 0) return { handled: true, cooldown: 0.1 };
        this.goatHornCooldown = GOAT_HORN_COOLDOWN_SECONDS;
        this.sound.playGoatHorn(goatHornSoundIndex(stack.goatHornInstrument));
        this.swordSwingTimer = Math.max(this.swordSwingTimer, 0.35);
        return { handled: true, cooldown: 0.25 };
      },
    });
    this.behaviors.registerItem('food', {
      id: 'minecraft:food',
      canStartUse: ({ stack }) => this.canConsumeFood(stack),
      startUse: () => {
        this.eatingTimer = 0;
        this.chewSoundTimer = 0;
        return { handled: true };
      },
      continueUse: ({ stack }, progress) => this.continueFoodUse(stack, progress.deltaSeconds),
      stopUse: () => {
        this.resetConsumptionProgress();
        return { handled: true };
      },
    });
    this.behaviors.registerItem('potion', {
      id: 'minecraft:potion',
      // P3.4: splash/lingering potions are thrown instantly; normal potions drink.
      use: ({ stack }) => {
        const variant = stack.potion?.variant;
        if (variant === 'splash' || variant === 'lingering') {
          this.throwPotion(stack);
          return { handled: true, cooldown: 0.5 };
        }
        return { handled: false };
      },
      canStartUse: ({ stack }) => stack.id === 373 && !!stack.potion?.effect && !stack.potion?.variant,
      startUse: () => {
        this.eatingTimer = 0;
        this.chewSoundTimer = 0;
        return { handled: true };
      },
      continueUse: ({ stack }, progress) => this.continuePotionUse(stack, progress.deltaSeconds),
      stopUse: () => {
        this.resetConsumptionProgress();
        return { handled: true };
      },
    });
    this.behaviors.registerItem([], {
      id: 'minecraft:milk',
      canStartUse: () => true,
      startUse: () => {
        this.resetConsumptionProgress();
        return { handled: true };
      },
      continueUse: ({ stack }, progress) => this.continueMilkUse(stack, progress.deltaSeconds),
      stopUse: () => {
        this.resetConsumptionProgress();
        return { handled: true };
      },
    });
    this.behaviors.registerItem(['bucket', 'water_bucket', 'lava_bucket'], {
      id: 'minecraft:bucket',
      use: ({ stack, target }) => ({ handled: this.tryUseBucket(stack, target), cooldown: 0.25 }),
    });
    this.behaviors.registerItem('boat', {
      id: 'minecraft:boat',
      use: ({ stack, target }) => ({ handled: this.tryPlaceBoat(stack, target), cooldown: 0.5 }),
    });
    this.behaviors.registerItem('minecart', {
      id: 'minecraft:minecart',
      use: ({ stack, target }) => ({ handled: this.tryPlaceMinecart(stack, target), cooldown: 0.5 }),
    });
    this.behaviors.registerItem('flint_and_steel', {
      id: 'minecraft:flint_and_steel',
      use: ({ target }) => ({ handled: this.tryUseFlintAndSteel(target), cooldown: 0.25 }),
    });
    this.behaviors.registerItem('fire_charge', {
      id: 'minecraft:fire_charge',
      use: ({ target }) => ({ handled: this.tryUseFireCharge(target), cooldown: 0.25 }),
    });
    this.behaviors.registerItem(
      ItemRegistry.all().filter((item) => isBundleItemName(item.name)).map((item) => item.name),
      {
        id: 'minecraft:bundle',
        use: ({ stack }) => ({ handled: this.tryEmptyBundleInHand(stack), cooldown: 0.18 }),
      },
    );
    this.behaviors.registerItem('brush', {
      id: 'minecraft:brush',
      canStartUse: ({ target }) => !!target && isSuspiciousBlockName(target.block.name),
      startUse: ({ stack, target }) => {
        if (!target || !isSuspiciousBlockName(target.block.name)) return { handled: false };
        const { x, y, z } = target.position;
        this.activeBrushTarget = { x, y, z, key: archaeologyTargetKey(x, y, z) };
        this.brushLastStage = 0;
        if (this.isMultiplayerNetworkConnected()) {
          this.network.send(PacketType.C2S_BRUSH_ACTION, {
            action: 'start', itemId: stack.id, x, y, z,
          });
        }
        return { handled: true };
      },
      continueUse: ({ stack, target }, progress) =>
        this.continueBrushUse(stack, target, progress.elapsedSeconds),
      stopUse: ({ stack }, progress) => {
        const active = this.activeBrushTarget;
        if (
          active
          && progress.reason !== 'completed'
          && this.isMultiplayerNetworkConnected()
        ) {
          this.network.send(PacketType.C2S_BRUSH_ACTION, {
            action: 'cancel',
            itemId: stack.id,
            x: active.x,
            y: active.y,
            z: active.z,
          });
        }
        this.resetBrushUseProgress();
        return { handled: true };
      },
    });
    this.behaviors.registerItem([], {
      id: 'minecraft:shears',
      use: ({ target }) => ({ handled: this.tryUseShears(target), cooldown: 0.25 }),
    });
    this.behaviors.registerItem([], {
      id: 'minecraft:bone_meal',
      use: ({ target }) => ({ handled: this.tryUseBoneMeal26_3(target), cooldown: 0.25 }),
    });
    this.behaviors.registerItem([], {
      id: 'minecraft:shovel',
      use: ({ target }) => ({ handled: this.tryUseShovel(target), cooldown: 0.25 }),
    });
    this.behaviors.registerItem([], {
      id: 'minecraft:axe',
      use: ({ target }) => ({ handled: this.tryUseAxe(target), cooldown: 0.25 }),
    });
    this.behaviors.registerItem('wooden_hoe', {
      id: 'minecraft:hoe',
      use: ({ target }) => ({ handled: this.tryTillFarmland(target), cooldown: 0.25 }),
    });
    this.behaviors.registerItem('armor_stand', {
      id: 'minecraft:armor_stand',
      use: ({ stack, target }) => ({ handled: this.tryPlaceArmorStand(stack, target), cooldown: 0.35 }),
    });
    this.behaviors.registerItem('item_frame', {
      id: 'minecraft:item_frame',
      use: ({ stack, target }) => ({ handled: this.tryPlaceHangingEntity('item_frame', stack, target), cooldown: 0.25 }),
    });
    this.behaviors.registerItem('painting', {
      id: 'minecraft:painting',
      use: ({ stack, target }) => ({ handled: this.tryPlaceHangingEntity('painting', stack, target), cooldown: 0.25 }),
    });
    this.behaviors.registerItem('lead', {
      id: 'minecraft:lead',
      // Entity-target use is dispatched by minecraft:mob_interaction.
      use: () => ({ handled: false }),
    });
    this.behaviors.registerItem([], {
      id: 'minecraft:spawn_egg',
      use: ({ stack, target }) => ({ handled: this.tryUseSpawnEgg(stack, target), cooldown: 0.25 }),
    });
    this.behaviors.registerItem('fishing_rod', {
      id: 'minecraft:fishing_rod',
      use: ({ stack }) => ({ handled: this.tryUseFishingRod(stack.id), cooldown: 0.35 }),
    });
    this.behaviors.registerItem('wind_charge', {
      id: 'minecraft:wind_charge',
      use: ({ stack }) => ({ handled: this.tryThrowWindCharge(stack.id), cooldown: 0.05 }),
    });
    this.behaviors.registerItem(['snowball', 'egg', 'ender_pearl', 'trident', 'fireworks', 'firework_rocket', 'experience_bottle'], {
      id: 'minecraft:throwable',
      use: ({ stack }) => ({
        handled: this.tryThrowHeldProjectile(stack.id),
        cooldown: stack.id === ENDER_PEARL_ID
          ? 0.8
          : stack.id === TRIDENT_ID
            ? 0.7
            : stack.id === FIREWORK_ROCKET_ID || stack.id === MODERN_FIREWORK_ROCKET_ID
              ? 0.4
              : 0.35,
      }),
    });
    this.behaviors.registerItem('ender_eye', {
      id: 'minecraft:ender_eye',
      use: ({ target }) => {
        if (target && (target.blockId & 0x3FF) === END_PORTAL_FRAME_ID) {
          const held = this.inventory.getSlot(this.player.selectedSlot);
          if (held && this.sendServerBlockItemUse(held, target)) {
            return { handled: true, cooldown: 0.25 };
          }
          const { x, y, z } = target.position;
          const activated = this.useEnderEyeOnPortalFrame(x, y, z);
          if (activated) {
            this.sound.playBlockPlace(END_PORTAL_FRAME_ID);
            if (this.gameMode !== 'creative') {
              this.inventory.removeFromSlot(this.player.selectedSlot, 1);
            }
          } else {
            this.sound.playLever();
          }
          return { handled: true, cooldown: 0.25 };
        }

        this.throwEnderEye();
        return { handled: true, cooldown: 0.5 };
      },
    });

    this.behaviors.registerEntity(['vehicle:boat', 'vehicle:chest_boat', 'vehicle:minecart'], {
      id: 'minecraft:vehicle_mount',
      interact: ({ target }) => {
        if (!(target instanceof Vehicle) || this.riddenVehicle || this.riddenMob) {
          return { handled: false };
        }
        if (this.isMultiplayerNetworkConnected()) {
          if (target.type === 'chest_boat' && this.input.isKeyDown('shift')) {
            this.openChestVehicleId = target.id;
            this.openChestPos = null;
            this.openUI = 'chest';
            document.exitPointerLock();
            this.network.send(PacketType.C2S_VEHICLE_INTERACT, {
              vehicleId: target.id,
              action: 'open_container',
            });
            this.notifyState();
          } else {
            this.network.send(PacketType.C2S_VEHICLE_INTERACT, {
              vehicleId: target.id,
              action: 'mount',
            });
          }
          return { handled: true, cooldown: 0.5 };
        }
        this.riddenVehicle = target;
        target.isRidden = true;
        this.sound.playLever();
        return { handled: true, cooldown: 0.5 };
      },
    });
    this.behaviors.registerEntity(
      [
        'mob:zombie', 'mob:skeleton', 'mob:creeper', 'mob:spider', 'mob:cow', 'mob:pig', 'mob:sheep', 'mob:chicken',
        'mob:blaze', 'mob:zombie_pigman', 'mob:magma_cube', 'mob:wither_skeleton', 'mob:villager', 'mob:enderman',
        'mob:witch', 'mob:iron_golem', 'mob:wolf', 'mob:cat', 'mob:horse', 'mob:shulker', 'mob:pillager',
        'mob:wither', 'mob:guardian', 'mob:vex', 'mob:armor_stand', 'mob:item_frame', 'mob:painting',
      ],
      {
        id: 'minecraft:mob_interaction',
        interact: ({ target, heldItem }) => target instanceof Mob
          ? this.tryInteractMob(target, heldItem)
          : { handled: false },
      },
    );
  }

  private getTargetBlockInteractionContext(heldItem: ItemStack | null): GameBlockInteractionContext | undefined {
    if (!this.targetBlock) return undefined;

    const { blockPos, faceNormal, hitPoint } = this.targetBlock;
    const blockId = this.chunks.getBlock(blockPos.x, blockPos.y, blockPos.z);
    const block = BlockRegistry.get(blockId);
    if (!block) return undefined;

    return {
      position: { x: blockPos.x, y: blockPos.y, z: blockPos.z },
      face: faceNormal.x > 0
        ? 'east'
        : faceNormal.x < 0
          ? 'west'
          : faceNormal.y > 0
            ? 'up'
            : faceNormal.y < 0
              ? 'down'
              : faceNormal.z > 0
                ? 'south'
                : 'north',
      hitPoint: { x: hitPoint.x, y: hitPoint.y, z: hitPoint.z },
      blockId,
      block,
      heldItem,
    };
  }

  private sendServerBlockItemUse(stack: ItemStack, target?: BlockInteractionContext): boolean {
    if (!target || !this.isMultiplayerNetworkConnected()) return false;
    this.network.send(PacketType.C2S_ITEM_USE, {
      kind: 'block',
      itemId: stack.id,
      x: target.position.x,
      y: target.position.y,
      z: target.position.z,
      face: target.face,
    });
    return true;
  }

  private sendServerEntityItemUse(stack: ItemStack, entityId: number): boolean {
    if (!this.isMultiplayerNetworkConnected()) return false;
    this.network.send(PacketType.C2S_ITEM_USE, {
      kind: 'entity',
      itemId: stack.id,
      entityId,
    });
    return true;
  }

  private consumeInteractionItem() {
    if (this.gameMode !== 'creative') {
      this.inventory.removeFromSlot(this.player.selectedSlot, 1);
    }
  }

  private spawnMobInteractionParticles(mob: Mob, color: number, count: number) {
    this.particles.spawnBlockBreak(
      mob.position.x,
      mob.position.y + mob.height,
      mob.position.z,
      color,
      count,
    );
  }

  private tryInteractMob(target: Mob, heldItem: ItemStack | null) {
    const heldItemId = heldItem?.id ?? 0;
    const heldItemName = heldItem ? ItemRegistry.get(heldItem.id)?.name : undefined;

    if (target.def.type === 'armor_stand') {
      const result = this.tryInteractArmorStand(target, heldItem);
      if (result.handled) return result;
    }

    if (target.def.type === 'item_frame') {
      return this.tryInteractItemFrame(target, heldItem);
    }
    if (target.def.type === 'painting') {
      return { handled: false };
    }
    if (heldItemName === 'shears') {
      const snipped = this.tryShearLeashConnections(target, heldItem!);
      if (snipped.handled) return snipped;
    }

    if (this.input.isKeyDown('shift')) {
      const transferred = this.tryTransferPlayerLeashesToMob(target);
      if (transferred.handled) return transferred;
    }

    if (heldItemName === 'lead' && isLeashableMobType(target.def.type)) {
      return this.tryUseLeadOnMob(target, heldItem!);
    }
    const localLeashOwner =
      target.leashHolderId === 'local-player' ||
      (!!this.network.playerId && target.leashHolderId === this.network.playerId);
    if (!heldItem && localLeashOwner && isLeashableMobType(target.def.type)) {
      return this.tryDetachLeadFromMob(target);
    }

    const nameTagLabel = heldItemName === 'name_tag' ? getNameTagLabel(heldItem) : null;
    if (nameTagLabel) {
      if (heldItem && this.sendServerEntityItemUse(heldItem, target.id)) {
        return { handled: true, cooldown: 0.25 };
      }
      target.customName = nameTagLabel;
      this.consumeInteractionItem();
      this.sound.playLever();
      this.spawnMobInteractionParticles(target, 0x55ff55, 8);
      return { handled: true, cooldown: 0.25 };
    }

    if (
      heldItemName === 'saddle' &&
      canApplySaddle(target.def.type, target.isBaby, target.isTamed, target.isSaddled)
    ) {
      if (heldItem && this.sendServerEntityItemUse(heldItem, target.id)) {
        return { handled: true, cooldown: 0.25 };
      }
      target.isSaddled = true;
      this.consumeInteractionItem();
      this.sound.playLever();
      return { handled: true, cooldown: 0.25 };
    }

    if (
      heldItemName === 'shears' &&
      (target.def.type === 'horse' || target.def.type === 'pig') &&
      target.isSaddled &&
      !target.isRidden &&
      !this.input.isKeyDown('shift')
    ) {
      if (heldItem && this.sendServerEntityItemUse(heldItem, target.id)) {
        return { handled: true, cooldown: 0.25 };
      }
      target.isSaddled = false;
      if (this.gameMode !== 'creative') {
        const saddle = ItemRegistry.getByName('saddle');
        if (saddle) {
          this.droppedItems.spawnItem(
            saddle.id,
            1,
            target.position.clone().add(new THREE.Vector3(0, 0.55, 0)),
            new THREE.Vector3(0, 0.9, 0),
            0.25,
          );
        }
        this.inventory.damageTool(this.player.selectedSlot);
      }
      this.sound.playLever();
      this.notifyState();
      return { handled: true, cooldown: 0.25 };
    }

    if (target.def.type === 'sheep' && heldItemName === 'shears' && !target.isBaby && !target.isSheared) {
      if (heldItem && this.sendServerEntityItemUse(heldItem, target.id)) {
        return { handled: true, cooldown: 0.25 };
      }
      target.isSheared = true;
      const woolCount = 1 + Math.floor(Math.random() * 3);
      this.droppedItems.spawnItem(
        35,
        woolCount,
        target.position.clone().add(new THREE.Vector3(0, 0.7, 0)),
        new THREE.Vector3((Math.random() - 0.5) * 0.5, 1.2, (Math.random() - 0.5) * 0.5),
        0.5,
      );
      if (this.gameMode !== 'creative') this.inventory.damageTool(this.player.selectedSlot);
      this.sound.playBlockBreak(35);
      return { handled: true, cooldown: 0.25 };
    }

    if (target.def.type === 'villager') {
      this.openTradingUI(target.villagerProfession);
      return { handled: true, cooldown: 0.5 };
    }

    const shouldFeedForBreeding =
      target.isAttractedBy(heldItemId) &&
      !(target.def.type === 'wolf' && target.isTamed && target.health < 20) &&
      !(target.def.type === 'cat' && target.isTamed && target.health < target.def.health);

    if (shouldFeedForBreeding && target.isBaby) {
      target.babyAge = Math.max(0, target.babyAge - 6);
      this.spawnMobInteractionParticles(target, 0x55ff55, 12);
      this.sound.playEat();
      this.consumeInteractionItem();
      return { handled: true, cooldown: 0.25 };
    }

    if (shouldFeedForBreeding && target.canEnterLoveMode(heldItemId)) {
      target.loveTimer = 30;
      this.spawnMobInteractionParticles(target, 0xff5555, 15);
      this.sound.playEat();
      this.consumeInteractionItem();
      return { handled: true, cooldown: 0.25 };
    }

    if (target.def.type === 'wolf') {
      if (!target.isTamed && heldItemId === 352) {
        this.sound.playEat();
        this.consumeInteractionItem();
        if (shouldTameEntity(
          this.seed,
          this.worldTickScheduler.getCurrentTick(),
          target.id,
          heldItemId,
        )) {
          target.isTamed = true;
          target.isSitting = true;
          target.health = 20;
          this.spawnMobInteractionParticles(target, 0xff5555, 15);
        } else {
          this.spawnMobInteractionParticles(target, 0x555555, 8);
        }
        return { handled: true, cooldown: 0.25 };
      }

      if (target.isTamed) {
        if (heldItemId === 352 && target.health < 20) {
          target.health = Math.min(20, target.health + 4);
          this.sound.playEat();
          this.consumeInteractionItem();
          this.spawnMobInteractionParticles(target, 0x55ff55, 8);
        } else {
          target.isSitting = !target.isSitting;
          this.sound.playLever();
        }
        return { handled: true, cooldown: 0.25 };
      }
    }

    if (target.def.type === 'cat') {
      if (!target.isTamed && heldItemId === RAW_FISH_ID) {
        this.sound.playEat();
        this.consumeInteractionItem();
        if (shouldTameEntity(
          this.seed,
          this.worldTickScheduler.getCurrentTick(),
          target.id,
          heldItemId,
        )) {
          target.isTamed = true;
          target.isSitting = true;
          this.spawnMobInteractionParticles(target, 0xff5555, 15);
        } else {
          this.spawnMobInteractionParticles(target, 0x555555, 8);
        }
        return { handled: true, cooldown: 0.25 };
      }

      if (target.isTamed) {
        if (heldItemId === RAW_FISH_ID && target.health < target.def.health) {
          target.health = Math.min(target.def.health, target.health + 4);
          this.sound.playEat();
          this.consumeInteractionItem();
          this.spawnMobInteractionParticles(target, 0x55ff55, 8);
        } else {
          target.isSitting = !target.isSitting;
          this.sound.playLever();
        }
        return { handled: true, cooldown: 0.25 };
      }
    }

    if ((target.def.type === 'horse' || target.def.type === 'pig') && canMountMob(target.def.type, target.isBaby, target.isTamed)) {
      if (this.isMultiplayerNetworkConnected()) {
        this.network.send(PacketType.C2S_MOB_INTERACT, { mobId: target.id, action: 'mount' });
        return { handled: true, cooldown: 0.5 };
      }

      if (target.def.type === 'horse' && !target.isTamed) {
        const tamed = shouldTameEntity(
          this.seed,
          this.worldTickScheduler.getCurrentTick(),
          target.id,
          0,
          0.2,
        );
        if (tamed) {
          target.isTamed = true;
          this.spawnMobInteractionParticles(target, 0xff5555, 15);
        } else {
          this.spawnMobInteractionParticles(target, 0x555555, 8);
        }
      }

      this.riddenMob = target;
      target.isRidden = true;
      target.isSitting = false;
      this.sound.playLever();
      return { handled: true, cooldown: 0.5 };
    }

    return { handled: false };
  }

  private tryInteractTargetEntity() {
    const heldItem = this.inventory.getSlot(this.player.selectedSlot);
    const targetVehicle = this.vehicles.getVehicleInRay(this.player.eyePosition, this.player.forward, 4.5);
    if (targetVehicle) {
      const result = this.behaviors.interactEntity(`vehicle:${targetVehicle.type}`, {
        target: targetVehicle,
        heldItem,
      });
      if (result?.handled) return result;
    }

    const targetMob = this.mobs.getMobInRay(this.player.eyePosition, this.player.forward, 4.5);
    if (!targetMob) return undefined;
    return this.behaviors.interactEntity(`mob:${targetMob.def.type}`, {
      target: targetMob,
      heldItem,
    });
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
          if (itemDef.toolType === 'bow' || itemDef.toolType === 'crossbow') {
            slot.position.set(-0.02, -0.58, -0.08);
            slot.rotation.set(-Math.PI / 12, Math.PI / 5, -Math.PI / 10);
            mesh.rotation.set(Math.PI / 2.4, -Math.PI / 9, Math.PI / 12);
            return;
          }

          if (itemDef.toolType === 'fishing_rod' || itemDef.toolType === 'trident') {
            slot.position.set(0.02, -0.57, -0.06);
            slot.rotation.set(Math.PI / 8, Math.PI / 5, -Math.PI / 10);
            mesh.rotation.set(Math.PI / 2.8, -Math.PI / 5, Math.PI / 12);
            return;
          }

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

  dropStackFromUI(stack: ItemStack) {
    if (stack.count <= 0) return;

    const lookDir = this.player.forward.clone();
    const spawnPos = this.player.eyePosition.clone().sub(new THREE.Vector3(0, 0.2, 0));
    const velocity = lookDir.multiplyScalar(3.5).add(new THREE.Vector3(0, 2.0, 0));
    velocity.x += (Math.random() - 0.5) * 0.5;
    velocity.z += (Math.random() - 0.5) * 0.5;

    this.droppedItems.spawnStack(stack, spawnPos, velocity, 1.5);
    this.notifyState();
  }

  dropItemFromUI(itemId: number, count: number) {
    this.dropStackFromUI({ id: itemId, count });
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

  // ─── P3.5: workstation UIs ───

  openStonecutterUI() {
    this.openUI = 'stonecutter';
    document.exitPointerLock();
  }

  openCartographyUI() {
    this.openUI = 'cartography_table';
    document.exitPointerLock();
  }

  openLoomUI() {
    this.openUI = 'loom';
    document.exitPointerLock();
  }

  /** P3.5 — cartography craft: clone / zoom out / lock a filled map. */
  handleCartographyCraft(mapItem: ItemStack, ingredient: ItemStack): ItemStack | null {
    const mapData = mapItem.map;
    if (!mapData || mapData.locked) return null;
    if (ingredient.id === EMPTY_MAP_ID) {
      return { id: FILLED_MAP_ID, count: 1, map: this.maps.cloneMap(mapData) };
    }
    if (ingredient.id === 339) { // paper -> zoom out
      return { id: FILLED_MAP_ID, count: 1, map: this.maps.zoomOutMap(mapData, this.chunks.getWorldGen()) };
    }
    if (ingredient.id === 102) { // glass pane -> lock
      return { id: FILLED_MAP_ID, count: 1, map: this.maps.lockMap(mapData) };
    }
    return null;
  }

  private isChestBlockedAt(x: number, y: number, z: number): boolean {
    const above = BlockRegistry.get(this.chunks.getBlock(x, y + 1, z));
    return isChestObstructingBlock(above);
  }

  private canPlaceChestAt(x: number, y: number, z: number): boolean {
    const directions: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const adjacentChestDegrees: number[] = [];
    for (const [dx, dz] of directions) {
      const nx = x + dx;
      const nz = z + dz;
      if (BlockRegistry.get(this.chunks.getBlock(nx, y, nz))?.name !== 'chest') continue;
      let degree = 0;
      for (const [odx, odz] of directions) {
        const ox = nx + odx;
        const oz = nz + odz;
        if (ox === x && oz === z) continue;
        if (BlockRegistry.get(this.chunks.getBlock(ox, y, oz))?.name === 'chest') degree++;
      }
      adjacentChestDegrees.push(degree);
    }
    return canPlaceChestFromNeighborDegrees(adjacentChestDegrees);
  }

  openChestUI(x: number, y: number, z: number) {
    const block = BlockRegistry.get(this.chunks.getBlock(x, y, z));
    if (block?.name === 'chest') {
      const partners = this.getDoubleChestPartners(x, y, z);
      const blocked = partners
        ? this.isChestBlockedAt(partners.leftPos.x, partners.leftPos.y, partners.leftPos.z)
          || this.isChestBlockedAt(partners.rightPos.x, partners.rightPos.y, partners.rightPos.z)
        : this.isChestBlockedAt(x, y, z);
      if (blocked) return;
    }

    const metadata = this.ensureChestMetadata(x, y, z);
    if (!metadata) return;

    this.openChestPos = new THREE.Vector3(x, y, z);
    this.openUI = 'chest';
    document.exitPointerLock();
    // P5.3: the server owns container contents in multiplayer.
    if (this.isMultiplayerNetworkConnected()) {
      this.network.send(PacketType.C2S_CONTAINER_OPEN, { x, y, z });
    }
  }

  /** P5.3 — apply server-owned block or Chest Boat container contents. */
  applyServerContainerData(
    x: number | undefined,
    y: number | undefined,
    z: number | undefined,
    slots: (ItemStack | null)[],
    cursor: ItemStack | null = null,
    source: 'block' | 'vehicle' = 'block',
    vehicleId?: number,
  ) {
    this.serverContainerCursor = cursor;
    if (source === 'vehicle') {
      if (vehicleId === undefined || this.openChestVehicleId !== vehicleId) return;
      const vehicle = this.vehicles.vehicles.get(vehicleId);
      if (!vehicle || vehicle.type !== 'chest_boat') return;
      vehicle.inventory = slots.map((slot) => (slot ? { ...slot } : null));
      this.notifyState();
      return;
    }

    const openPos = this.openChestPos ?? this.openHopperPos;
    if (x === undefined || y === undefined || z === undefined || !openPos || openPos.x !== x || openPos.y !== y || openPos.z !== z) return;
    const metadata = this.chunks.getBlockMeta(x, y, z);
    if (!metadata) return;
    metadata.inventory = slots.map((slot) => (slot ? { ...slot } : null));
    this.chunks.setBlockMeta(x, y, z, metadata, true);
    this.notifyState();
  }

  applyServerVehicleRider(vehicleId: number, riderId: string | null) {
    const vehicle = this.vehicles.vehicles.get(vehicleId);
    if (!vehicle) return;
    vehicle.isRidden = riderId !== null;
    if (riderId === this.network.playerId) {
      this.riddenVehicle = vehicle;
    } else if (this.riddenVehicle?.id === vehicleId) {
      this.riddenVehicle = null;
    }
  }

  applyServerMobRider(mobId: number, riderId: string | null) {
    const mob = this.mobs.mobs.get(mobId);
    if (!mob) return;
    mob.isRidden = riderId !== null;
    if (riderId === this.network.playerId) {
      this.riddenMob = mob;
    } else if (this.riddenMob?.id === mobId) {
      this.riddenMob = null;
    }
  }

  handleServerVehicleDespawn(vehicleId: number) {
    if (this.riddenVehicle?.id === vehicleId) this.riddenVehicle = null;
    if (this.openChestVehicleId === vehicleId) {
      this.openChestVehicleId = null;
      this.serverContainerCursor = null;
      if (this.openUI === 'chest') this.openUI = 'none';
    }
    this.vehicles.removeVehicle(vehicleId);
    this.notifyState();
  }

  openHopperUI(x: number, y: number, z: number) {
    const metadata = this.ensureHopperMetadata(x, y, z);
    if (!metadata) return;

    this.openHopperPos = new THREE.Vector3(x, y, z);
    this.openUI = 'hopper';
    document.exitPointerLock();
    if (this.isMultiplayerNetworkConnected()) {
      this.network.send(PacketType.C2S_CONTAINER_OPEN, { x, y, z });
    }
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

    // Single-player owns its local simulation. The in-memory server uses a
    // separate world snapshot and must not overwrite a save that was just loaded.
    if (this.activeSlot !== 'multiplayer' && this.network.isConnected) {
      this.network.disconnect();
    }

    this.openUI = 'none';
    // Don't request lock here — the loading screen may still be covering the canvas.
    // App.tsx will request pointer lock after the loading screen is hidden.
    this.lockCooldown = 2.0;
    // P4.1: procedural background music starts with the world.
    this.sound.startMusic();
    this.notifyState();
  }

  private setupNetworkStatusHook() {
    this.network.onStatusChange = (status) => {
      if (status === 'disconnected' && this.activeSlot === 'multiplayer' && this.running) {
        this.addChatMessage('Connection lost to the server.');
        this.notifyState();
      }
    };
  }

  private isMultiplayerNetworkConnected(): boolean {
    return this.activeSlot === 'multiplayer' && !!this.network?.isConnected;
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
      this.closeServerContainerSession();
      this.openChestPos = null;
      this.openChestVehicleId = null;
    } else if (this.openUI === 'hopper') {
      this.closeServerContainerSession();
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

  getEditingSignText(): string[] {
    if (!this.editingSignPos) return ['', '', '', ''];
    const pos = this.editingSignPos;
    return getSignTextForSide(this.chunks.getBlockMeta(pos.x, pos.y, pos.z), this.editingSignSide);
  }

  saveSignText(lines: string[]) {
    if (this.editingSignPos) {
      const pos = this.editingSignPos;
      if (this.isMultiplayerNetworkConnected()) {
        this.network.send(PacketType.C2S_SIGN_UPDATE, {
          x: pos.x,
          y: pos.y,
          z: pos.z,
          lines: Array.from({ length: 4 }, (_, index) => (lines[index] ?? '').slice(0, 15)),
        });
      } else {
        const currentMeta = this.chunks.getBlockMeta(pos.x, pos.y, pos.z);
        this.chunks.setBlockMeta(
          pos.x,
          pos.y,
          pos.z,
          setSignTextForSide(currentMeta, this.editingSignSide, lines),
          true,
        );
      }
      this.editingSignPos = null;
      this.editingSignSide = 'front';
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
    this.player.saturation = 5;
    this.player.flying = false;
    this.spawnProtectionTimer = 3;
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
    this.goatHornCooldown = Math.max(0, this.goatHornCooldown - dt);
    this.windChargeCooldown = Math.max(0, this.windChargeCooldown - dt);
    this.damageFlashTimer = Math.max(0, this.damageFlashTimer - dt);
    this.swordSwingTimer = Math.max(0, this.swordSwingTimer - dt);
    this.attackCooldownTimer = Math.max(0, this.attackCooldownTimer - dt);
    if (wasAttackCoolingDown) {
      this.notifyState();
    }
    this.lockCooldown = Math.max(0, this.lockCooldown - dt);
    this.spawnProtectionTimer = Math.max(0, this.spawnProtectionTimer - dt);
    this.shieldDisableTimer = Math.max(0, this.shieldDisableTimer - dt);
    this.hurtCooldown = tickHurtCooldown(this.hurtCooldown, dt);
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
      this.stopActiveItemUse('cancelled');
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

    // Riding Horse / Pig controls. Mounting and steering are separate in Java:
    // unsaddled horses can be mounted for taming, but only a tamed+saddled horse is steerable;
    // pigs require both a saddle and a Carrot on a Stick for player steering.
    if (this.riddenMob) {
      const heldRideItem = this.inventory.getSlot(this.player.selectedSlot);
      const heldRideItemName = heldRideItem ? ItemRegistry.get(heldRideItem.id)?.name : undefined;
      const canControl = canControlMountedMob(
        this.riddenMob.def.type,
        this.riddenMob.isTamed,
        this.riddenMob.isSaddled,
        heldRideItemName,
      );
      const forward = canControl && !this.chatOpen && this.input.isKeyDown('w');
      const back = canControl && !this.chatOpen && this.input.isKeyDown('s');
      const left = canControl && !this.chatOpen && this.input.isKeyDown('a');
      const right = canControl && !this.chatOpen && this.input.isKeyDown('d');
      const jump = canControl && this.riddenMob.def.type === 'horse' && !this.chatOpen && this.input.isKeyDown(' ');

      if (this.isMultiplayerNetworkConnected()) {
        this.mobInputSendTimer -= dt;
        if (this.mobInputSendTimer <= 0) {
          this.mobInputSendTimer = 0.05;
          this.network.send(PacketType.C2S_MOB_INPUT, {
            mobId: this.riddenMob.id,
            forward,
            back,
            left,
            right,
            jump,
          });
        }
      } else {
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
        } else if (canControl) {
          this.riddenMob.velocity.x = 0;
          this.riddenMob.velocity.z = 0;
        }

        if (jump && this.riddenMob.onGround) {
          this.riddenMob.velocity.y = 9.5;
          this.riddenMob.onGround = false;
        }
      }

      // Dismount with Shift key
      const dismount = this.chatOpen ? false : this.input.isKeyDown('shift');
      if (dismount && this.placeCooldown <= 0) {
        if (this.isMultiplayerNetworkConnected()) {
          this.network.send(PacketType.C2S_MOB_INTERACT, { mobId: this.riddenMob.id, action: 'dismount' });
        } else {
          this.riddenMob.isRidden = false;
          this.riddenMob = null;
          this.player.position.x += 1.2;
        }
        this.placeCooldown = 0.5;
      }
    }

    if (this.riddenVehicle) {
      const dismount = this.chatOpen ? false : this.input.isKeyDown('shift');
      if (dismount && this.placeCooldown <= 0) {
        if (this.isMultiplayerNetworkConnected()) {
          this.network.send(PacketType.C2S_VEHICLE_INTERACT, {
            vehicleId: this.riddenVehicle.id,
            action: 'dismount',
          });
        } else {
          this.riddenVehicle.isRidden = false;
          this.riddenVehicle = null;
          this.player.position.x += 1.2;
        }
        this.placeCooldown = 0.5;
      }
    }

    // Player update
    this.updateShieldBlockingState(dt);
    this.player.speedMultiplier = this.potionEffects.getSpeedMultiplier() * (this.isShieldBlocking ? SHIELD_MOVEMENT_MULTIPLIER : 1.0);
    // P3.3: Jump Boost raises jump; Depth Strider raises swim speed.
    this.player.jumpBoostMultiplier = 1 + this.potionEffects.getLevel('jump_boost') * 0.4;
    this.player.swimSpeedMultiplier = 1 + EnchantSystem.getArmorLevel(this.inventory.armor, 'depth_strider') * 0.33;
    // Absorption effect expired -> clear the extra hearts.
    if (this.potionEffects.getLevel('absorption') === 0) {
      this.player.absorption = 0;
    }
    if (this.potionEffects.has('levitation') && !this.player.flying && !this.riddenMob) {
      this.player.velocity.y = Math.max(this.player.velocity.y, 3.8);
      this.player.onGround = false;
    }
    const doubleTappedSpace = this.input.consumeSpaceDoubleTap();
    if (doubleTappedSpace && !this.chatOpen && this.gameMode === 'creative') {
      this.player.flying = !this.player.flying;
      this.notifyState();
    }
    if (this.activeCushionSeat26_3 && !this.chatOpen && this.input.isKeyDown('shift')) {
      this.cushionSeats26_3.stand('local-player');
      this.activeCushionSeat26_3 = null;
      this.player.position.x += 1.0;
      this.placeCooldown = Math.max(this.placeCooldown, 0.25);
    }

    const sittingOnCushion26_3 = this.activeCushionSeat26_3 !== null;
    const mouseDelta = this.input.consumeMouseDelta();
    this.player.update(dt, {
      dx: this.chatOpen ? 0 : mouseDelta.dx,
      dy: this.chatOpen ? 0 : mouseDelta.dy,
      forward: this.chatOpen || sittingOnCushion26_3 ? false : this.input.isKeyDown('w'),
      back: this.chatOpen || sittingOnCushion26_3 ? false : this.input.isKeyDown('s'),
      left: this.chatOpen || sittingOnCushion26_3 ? false : this.input.isKeyDown('a'),
      right: this.chatOpen || sittingOnCushion26_3 ? false : this.input.isKeyDown('d'),
      jump: this.chatOpen || sittingOnCushion26_3 ? false : this.input.isKeyDown(' '),
      sprint: this.chatOpen || sittingOnCushion26_3 ? false : this.input.isKeyDown('control'),
      sneak: this.chatOpen || this.riddenMob || this.riddenVehicle || sittingOnCushion26_3 ? false : this.input.isKeyDown('shift'),
      fly: false,
    }, this.chunks);

    if (this.activeCushionSeat26_3) {
      this.player.position.set(
        this.activeCushionSeat26_3.x,
        this.activeCushionSeat26_3.y + 0.18,
        this.activeCushionSeat26_3.z,
      );
      this.player.velocity.set(0, 0, 0);
      this.player.onGround = true;
    }

    const playerShelfBounceEvent26_3 = this.player.consumeShelfMushroomBounceSound26_3();
    if (playerShelfBounceEvent26_3) this.sound.playNamedEvent26_3(playerShelfBounceEvent26_3);

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

    this.updateMaceFallTracking();

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

    const isNetworkConnected = this.isMultiplayerNetworkConnected();

    if (!isNetworkConnected) {
      // Mob system
      const isNight = this.isNight();
      const heldItem = this.inventory.getSlot(this.player.selectedSlot)?.id || 0;
      const playerLookDir = new THREE.Vector3();
      this.renderer.camera.getWorldDirection(playerLookDir);

      this.mobs.update(dt, this.player.position, isNight,
        (x, y, z) => this.chunks.getBlock(x, y, z),
        (damage, knockback, attacker) => {
          this.damagePlayer(damage, 'mob', knockback, attacker);
          if (attacker && attacker.def.type === 'wither_skeleton') {
            this.potionEffects.apply({ id: 'wither', level: 1, duration: 10.0 }, (amount) => {
              this.player.health = Math.min(20, this.player.health + amount);
            });
          }
        },
        (x, y, z) => this.chunks.isSolidBlock(x, y, z),
        this.gameMode,
        (mob) => {
          this.handleMobDeath(mob, EnchantSystem.getLevel(this.inventory.getSlot(this.player.selectedSlot), 'looting'));
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
          this.xp.spawnXP(rollXp(BREEDING_XP_RANGE, Math.random), pos.clone().add(new THREE.Vector3(0, 0.5, 0)));
          this.sound.playXP();
        },
        playerLookDir,
        this.chunks.dimensionGen.endGenerator,
        (mob, kind) => {
          if (kind === 'idle') {
            this.sound.playMobSound(mob.def.type, 'idle');
          }
        },
        (_mob, eventName) => {
          this.sound.playNamedEvent26_3(eventName);
        },
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
          this.sound.playMobSound(mob.def.type, 'death');
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
      if (this.isMultiplayerNetworkConnected()) {
        this.vehicleInputSendTimer -= dt;
        if (this.riddenVehicle && this.vehicleInputSendTimer <= 0) {
          this.vehicleInputSendTimer = 0.05;
          this.network.send(PacketType.C2S_VEHICLE_INPUT, {
            vehicleId: this.riddenVehicle.id,
            forward: vehicleKeys.w,
            back: vehicleKeys.s,
            left: vehicleKeys.a,
            right: vehicleKeys.d,
          });
        }
      } else {
        this.vehicles.update(
          dt,
          (x, y, z) => this.chunks.getBlock(x, y, z),
          (x, y, z) => this.chunks.isSolidBlock(x, y, z),
          vehicleKeys
        );
      }

      // Update projectiles
      this.projectiles.update(
        dt,
        (x, y, z) => this.chunks.getBlock(x, y, z),
        (damage, knockback, type) => {
          this.damagePlayer(damage, 'projectile', knockback);
          if (type === 'shulker_bullet') {
            this.potionEffects.apply({ id: 'levitation', level: 1, duration: 8 }, () => {});
          }
          if (type === 'wither_skull') {
            this.potionEffects.apply({ id: 'wither', level: 1, duration: 10.0 }, (amount) => {
              this.damagePlayer(amount, 'wither');
            });
          }
        },
        (mobId, damage, knockback, type, onFire) => {
          const mob = this.mobs.mobs.get(mobId);
          if (mob) {
            const projectileDamage = type === 'snowball' && mob.def.type === 'blaze' ? 3 : damage;
            mob.takeDamage(projectileDamage, knockback);
            // P3.3: Flame enchantment sets the target on fire.
            if (onFire && type === 'arrow') {
              mob.burnTicks = Math.max(mob.burnTicks ?? 0, 5);
            }
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
          this.handlePotionSplash(pos, fromPlayer, damage, undefined, undefined);
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

      // Update dropped items. Multiplayer item pickup/merge is server authoritative.
      this.droppedItems.update(
        dt,
        this.player.position,
        (x, y, z) => this.chunks.isSolidBlock(x, y, z),
        this.inventory,
        () => this.sound.playPickup(),
        () => this.notifyState(),
        !this.isMultiplayerNetworkConnected(),
      );

      this.xp.update(
        dt,
        this.player.position,
        (x, y, z) => this.chunks.isSolidBlock(x, y, z),
        () => {
          this.sound.playXP();
          this.particles.spawnXP(this.player.position.x, this.player.position.y + 0.5, this.player.position.z, 8);
        },
        () => this.notifyState(),
        (amount) => this.inventory.repairWithMendingXP(this.player.selectedSlot, amount)
      );

      // Resolve collisions (mob-mob, player-mob)
      this.resolveCollisions();
      this.breakUnsupportedHangingEntities();
    }

    this.updateLeashedMobs(dt, isNetworkConnected);

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

    // Java 26.3: rebindable F3 + X toggles Improved Transparency.
    if (!this.chatOpen && this.input.consumeImprovedTransparencyToggle26_3()) {
      this.renderer.toggleImprovedTransparency26_3();
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
        flying: this.player.flying,
        onGround: this.player.onGround,
        sprinting: this.input.isKeyDown('control') && this.input.isKeyDown('w') && this.player.hunger > 6 && !this.player.flying,
        sneaking: this.input.isKeyDown('shift'),
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

      // Camera position at eye level in first person (P4.4: damage shake)
      const eye = this.player.eyePosition;
      const shake = getDamageShake(this.damageFlashTimer);
      if (shake > 0) {
        this.renderer.camera.position.set(
          eye.x + (Math.random() - 0.5) * shake,
          eye.y + (Math.random() - 0.5) * shake,
          eye.z + (Math.random() - 0.5) * shake,
        );
      } else {
        this.renderer.camera.position.copy(eye);
      }

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

        if (this.breakProgress > 0 && this.breakingBlockPos && this.player.swingProgress <= 0) {
          // P4.4: arm pump while mining.
          const pump = Math.sin(this.breakProgress * Math.PI * 4) * 0.6;
          this.fpArmGroup.position.set(
            defX + pump * 0.015,
            defY - pump * 0.012,
            defZ - pump * 0.03
          );
          this.fpArmGroup.rotation.set(
            defRotX - pump * 0.18,
            defRotY,
            defRotZ - pump * 0.05
          );
        } else if (this.player.swingProgress > 0) {
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
    const localHeldItemName = ItemRegistry.get(localHeldItemId)?.name ?? '';
    const includeFluidsInRaycast =
      localHeldItemName === 'bucket'
      || localHeldItemName.endsWith('_bucket')
      || localHeldItemName === 'boat'
      || localHeldItemName.endsWith('_boat');
    this.targetBlock = this.player.raycast(this.chunks, includeFluidsInRaycast);
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

    if (!this.chatOpen && this.input.isMouseDown(2) && this.placeCooldown <= 0) {
      const entityResult = this.tryInteractTargetEntity();
      if (entityResult?.handled) {
        this.stopActiveItemUse('blocked');
        this.placeCooldown = entityResult.cooldown ?? 0.25;
        return;
      }
    }

    const continuousItemUseActive = this.updateContinuousItemUse(dt);

    // ─── Left click: attack mobs OR break blocks ───
    const selectedItemStack = this.inventory.getSlot(this.player.selectedSlot);
    const selectedItemId = selectedItemStack?.id ?? 0;
    const selectedItemDef = ItemRegistry.get(selectedItemId);
    const isHoldingSword = ItemRegistry.isTool(selectedItemId) && selectedItemDef?.toolType === 'sword';
    const isHoldingMace = selectedItemDef?.toolType === 'mace';
    const isHoldingTool = ItemRegistry.isTool(selectedItemId);
    const baseAttackDamage = isHoldingTool
      ? (ItemRegistry.get(selectedItemId)?.damage ?? 1)
      : 1;
    const attributeAttackDamage = baseAttackDamage + PotionEffects.getMeleeDamageModifier(
      this.potionEffects.getLevel('strength'),
      this.potionEffects.getLevel('weakness'),
    );
    const enchantmentAttackDamage = EnchantSystem.getSharpnessBonus(
      EnchantSystem.getLevel(selectedItemStack, 'sharpness')
    );
    const attackCooldownDuration = this.getAttackCooldownDuration(selectedItemId);
    const attackCooldownProgress = this.getAttackCooldownProgress();
    const isCriticalMelee = isChargedMeleeAttack(attackCooldownProgress) && this.isCriticalMeleeAttack();
    const maceSmashActive = isHoldingMace && isMaceSmash(this.maceFallDistance);
    const meleeAttackDamage = calculateMeleeDamage({
      baseAttributeDamage: attributeAttackDamage,
      enchantmentDamage: enchantmentAttackDamage,
      cooldownProgress: attackCooldownProgress,
      critical: maceSmashActive ? false : isCriticalMelee,
    }) + (maceSmashActive ? getMaceSmashBonus(this.maceFallDistance) : 0);

    if (!this.chatOpen && this.input.isMouseDown(0) && this.swordSwingTimer <= 0) {
        // First: try to attack vehicle
        const targetVehicle = this.vehicles.getVehicleInRay(this.player.eyePosition, this.player.forward, 4.5);
        if (targetVehicle) {
          this.swordSwingTimer = 0.4;
          this.startAttackCooldown(attackCooldownDuration);
          if (isNetworkConnected) {
            this.network.send(PacketType.C2S_VEHICLE_INTERACT, {
              vehicleId: targetVehicle.id,
              action: 'attack',
            });
            return;
          }
          this.sound.playBlockBreak(5); // Planks/wood sound for vehicle destruction
          
          let itemId = targetVehicle.sourceItemId ?? 328;
          if (!targetVehicle.sourceItemId) {
            if (targetVehicle.type === 'boat') {
              const boatDef = ItemRegistry.getByName('oak_boat') || ItemRegistry.getByName('boat');
              itemId = boatDef?.id ?? 333;
            } else if (targetVehicle.type === 'chest_boat') {
              const chestBoatDef = ItemRegistry.getByName('oak_chest_boat');
              itemId = chestBoatDef?.id ?? 20190;
            } else {
              const cartDef = ItemRegistry.getByName('minecart');
              itemId = cartDef?.id ?? 328;
            }
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

        // First: try server-authoritative player/mob attack in multiplayer.
        const dir = this.player.forward;
        const entityReach = this.gameMode === 'creative' ? 5 : 3;

        if (!isNetworkConnected) {
          const decorativeTarget = this.mobs.getMobInRay(this.player.eyePosition, dir, entityReach);
          if (
            decorativeTarget?.def.type === 'item_frame' &&
            decorativeTarget.itemFrameItem &&
            this.gameMode !== 'creative'
          ) {
            const released = cloneItemStack(decorativeTarget.itemFrameItem);
            decorativeTarget.setItemFrameItem(null);
            if (released) {
              this.droppedItems.spawnStack(
                released,
                decorativeTarget.position.clone(),
                new THREE.Vector3((Math.random() - 0.5) * 0.35, 0.8, (Math.random() - 0.5) * 0.35),
                0.25,
              );
            }
            this.sound.playPickup();
            this.swordSwingTimer = 0.4;
            this.startAttackCooldown(attackCooldownDuration);
            return;
          }
        }

        if (isNetworkConnected) {
          const playerId = this.network.getOtherPlayerInRay(this.player.eyePosition, dir, entityReach);
          if (playerId) {
            this.network.send(PacketType.C2S_INTERACT_ENTITY, { entityId: playerId, type: 'attack' });
            this.swordSwingTimer = 0.4;
            this.startAttackCooldown(attackCooldownDuration);
            return;
          }
          const networkMob = this.mobs.getMobInRay(this.player.eyePosition, dir, entityReach);
          if (networkMob) {
            this.network.send(PacketType.C2S_INTERACT_ENTITY, { entityId: networkMob.id, type: 'attack' });
            this.swordSwingTimer = 0.4;
            this.startAttackCooldown(attackCooldownDuration);
            return;
          }
        }

      const mobHit = this.mobs.playerAttackMob(
        this.player.eyePosition,
        dir,
        meleeAttackDamage,
        entityReach,
        {
          smiteLevel: EnchantSystem.getLevel(selectedItemStack, 'smite'),
          fireTicks: EnchantSystem.getFireTicks(EnchantSystem.getLevel(selectedItemStack, 'fire_aspect')),
          knockbackLevel: EnchantSystem.getLevel(selectedItemStack, 'knockback'),
        }
      );

      if (mobHit.hit) {
        if (maceSmashActive && mobHit.mob) {
          this.applyLocalMaceSmash(mobHit.mob.position, this.maceFallDistance, mobHit.mob.id);
        }
        if (isHoldingMace && this.gameMode !== 'creative') {
          this.inventory.damageTool(this.player.selectedSlot, 1);
        }
        this.swordSwingTimer = 0.4;
        this.startAttackCooldown(attackCooldownDuration);
        if (mobHit.mob) {
          this.sound.playMobSound(mobHit.mob.def.type, 'hurt');
        }
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
              getSweepDamage(attributeAttackDamage + enchantmentAttackDamage, 0),
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
        this.sound.playMobSound('wither', 'hurt');
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
            const isSurvival = this.gameMode !== 'creative';
            if (isSurvival) {
              // Damage tool
              const heldItemStack = this.inventory.getSlot(this.player.selectedSlot);
              if (heldItemStack && ItemRegistry.isTool(heldItemStack.id)) {
                const heldDef = ItemRegistry.get(heldItemStack.id);
                const meleeDurabilityCost = getMeleeDurabilityCost(heldDef?.toolType);
                if (meleeDurabilityCost > 0) {
                  this.inventory.damageTool(this.player.selectedSlot, meleeDurabilityCost);
                }
              }
            }
            // P2.7: a wrong-tier tool (e.g. stone pickaxe on diamond ore)
            // breaks the block but drops nothing, matching Java 1.20.1.
            const harvestable = isSurvival ? ItemRegistry.canHarvest(selectedItemId, blockId) : true;
            this.destroyBlockAt(bp.x, bp.y, bp.z, true, harvestable, {
              fortune: EnchantSystem.getLevel(selectedItemStack, 'fortune'),
              silkTouch: EnchantSystem.getLevel(selectedItemStack, 'silk_touch') > 0,
            });
            // P2.7: data-driven mining XP (ores and datapack xpDrop).
            if (isSurvival && blockDef) {
              const xpRange = blockDef.xpDrop ?? getBlockXpRange(blockDef.name);
              if (xpRange) {
                const xpRandom = new XorShiftRandom(
                  hashIntegers(this.seed, this.worldTickScheduler.getCurrentTick(), bp.x, bp.y, bp.z)
                );
                const xpAmount = xpRange.min + xpRandom.nextInt(xpRange.max - xpRange.min + 1);
                if (xpAmount > 0) {
                  this.xp.spawnXP(xpAmount, new THREE.Vector3(bp.x + 0.5, bp.y + 0.5, bp.z + 0.5));
                }
              }
            }
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
    if (!continuousItemUseActive && !this.chatOpen && this.input.isMouseDown(2) && this.placeCooldown <= 0) {
      const selectedSlot = this.inventory.getSlot(this.player.selectedSlot);
      const heldItemId = selectedSlot?.id ?? 0;
      const heldItemDef = ItemRegistry.get(heldItemId);
      const targetInteraction = this.getTargetBlockInteractionContext(selectedSlot);

      if (targetInteraction && this.trySitOnCushion26_3(targetInteraction)) {
        this.placeCooldown = 0.25;
        return;
      }

      const blockBehaviorResult = targetInteraction
        ? this.behaviors.interactBlock(targetInteraction)
        : undefined;
      if (blockBehaviorResult?.handled) {
        this.placeCooldown = blockBehaviorResult.cooldown ?? 0.25;
        return;
      }

      const offhandStack = this.inventory.getOffhand();
      const offhandName = offhandStack ? ItemRegistry.get(offhandStack.id)?.name : undefined;
      if (
        this.isShieldBlocking
        && shouldPrioritizeShieldUse26_3(heldItemDef?.name, offhandName)
      ) {
        // Java 26.3: raising a shield wins over Hoe/Shovel item-on-block actions.
        this.placeCooldown = 0.05;
        return;
      }

      if (selectedSlot && heldItemDef) {
        const itemResult = this.behaviors.useItem({
          item: heldItemDef,
          stack: selectedSlot,
          target: targetInteraction,
        });
        if (itemResult?.handled) {
          this.placeCooldown = itemResult.cooldown ?? 0.25;
          return;
        }
      }

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
    }, this.gamerules.getDifficulty(), this.gamerules,
      (id) => this.potionEffects.has(id as any),
      (id) => EnchantSystem.getArmorLevel(this.inventory.armor, id as any),
    );

    // P3.3: Hunger effect drains hunger over time (1 per 4 seconds per level).
    if (this.potionEffects.getLevel('hunger') > 0 && this.player.hunger > 0) {
      this.player.hunger = Math.max(0, this.player.hunger - this.potionEffects.getLevel('hunger') * 0.25 * dt);
    }
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


    // P5.2: upload simulated player state so the server's pushes stay convergent.
    if (this.isMultiplayerNetworkConnected()) {
      this.playerStateSyncTimer -= dt;
      if (this.playerStateSyncTimer <= 0) {
        this.playerStateSyncTimer = 0.5;
        this.network.send(PacketType.C2S_PLAYER_STATE, {
          health: this.player.health,
          hunger: this.player.hunger,
          oxygen: this.player.oxygen,
          blocking: this.isShieldBlocking,
        });
      }
    }

    // P3.4: lingering potion clouds re-apply their effect in an area.
    for (let i = this.lingeringClouds.length - 1; i >= 0; i--) {
      const cloud = this.lingeringClouds[i];
      cloud.remaining -= dt;
      cloud.tickTimer += dt;
      if (cloud.tickTimer >= 0.5) {
        cloud.tickTimer = 0;
        this.particles.spawnBlockBreak(
          cloud.pos.x + (Math.random() - 0.5) * 2,
          cloud.pos.y + Math.random() * 1.5,
          cloud.pos.z + (Math.random() - 0.5) * 2,
          0x8a2be2,
          3,
        );
        if (this.player.position.distanceTo(cloud.pos) <= 3.5 && this.gameMode !== 'creative') {
          this.potionEffects.apply(cloud.effect, (amount) => {
            this.player.health = Math.min(20, this.player.health + amount);
          });
        }
        for (const mob of this.mobs.mobs.values()) {
          if (mob.position.distanceTo(cloud.pos) <= 3.5 && (cloud.effect.id === 'poison' || cloud.effect.id === 'wither')) {
            mob.takeDamage(cloud.effect.level);
          }
        }
      }
      if (cloud.remaining <= 0) {
        this.lingeringClouds.splice(i, 1);
      }
    }

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

    const worldTickResult = this.worldTickScheduler.advance(dt);
    const worldTicks = worldTickResult.steps;
    this.processScheduledWorldTicks(worldTickResult.due);

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
        // P3.1: doors / fence gates / trapdoors react to adjacent redstone power.
        this.applyRedstoneToNeighbors(component.x, component.y, component.z);
      },
      this.gameTime,
      (x, y, z) => this.chunks.getBlockMeta(x, y, z),
      entitiesList,
      worldTicks,
    );

    // Hopper simulation
    this.hoppers.update(dt);

    // Farming simulation (farmland hydration, crop growth)
    this.updateFarming(worldTicks);

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
      // P4.1: background music mood follows day/night and underground state.
      this.sound.updateMusicMode(this.isNight(), py < 32);
      // P4.2: rain ambience follows the weather; cave drips underground.
      this.sound.updateRainAmbience(this.weather.getCurrentWeather() as any);
      if (py < 32) {
        this.caveDripTimer -= dt;
        if (this.caveDripTimer <= 0) {
          this.caveDripTimer = 3 + Math.random() * 5;
          this.sound.playCaveDrip();
        }
      } else {
        this.caveDripTimer = 0;
      }
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

  private scheduleWorldTick(
    type: WorldTickType,
    x: number,
    y: number,
    z: number,
    delayTicks: number,
    reason: string,
    dimension = this.chunks.currentDimension,
    source?: BlockPosition,
  ) {
    if (y < 0 || y >= WORLD_HEIGHT) return;
    this.worldTickScheduler.schedule({
      type,
      x,
      y,
      z,
      dimension,
      delayTicks,
      priority: type === 'neighbor_update' ? 'high' : 'normal',
      payload: {
        reason,
        sourceX: source?.x,
        sourceY: source?.y,
        sourceZ: source?.z,
      },
    });
  }

  private scheduleFluidNeighborhood(
    x: number,
    y: number,
    z: number,
    delayTicks = 5,
    dimension = this.chunks.currentDimension,
  ) {
    for (const [dx, dy, dz] of [[0, 0, 0], [0, -1, 0], [0, 1, 0], [-1, 0, 0], [1, 0, 0], [0, 0, -1], [0, 0, 1]]) {
      this.scheduleWorldTick('fluid', x + dx, y + dy, z + dz, delayTicks, 'fluid_neighbor', dimension);
    }
  }

  private scheduleNeighborUpdates(
    x: number,
    y: number,
    z: number,
    dimension = this.chunks.currentDimension,
  ) {
    const source = { x, y, z };
    for (const [dx, dy, dz] of [[0, 0, 0], [0, -1, 0], [0, 1, 0], [-1, 0, 0], [1, 0, 0], [0, 0, -1], [0, 0, 1]]) {
      this.scheduleWorldTick(
        'neighbor_update',
        x + dx,
        y + dy,
        z + dz,
        1,
        'block_changed',
        dimension,
        source,
      );
    }
  }

  public onBlockChanged(
    x: number,
    y: number,
    z: number,
    previousId: number,
    nextId: number,
    dimension: Dimension,
  ) {
    if (previousId === nextId) return;
    const previousName = BlockRegistry.get(previousId)?.name;
    const nextName = BlockRegistry.get(nextId)?.name;
    if (
      (previousName === 'campfire' || previousName === 'soul_campfire')
      && nextName !== 'campfire'
      && nextName !== 'soul_campfire'
    ) {
      this.worldTickScheduler.cancel('block_event', x, y, z, dimension);
    }
    this.scheduleNeighborUpdates(x, y, z, dimension);
    this.scheduleFluidNeighborhood(x, y, z, 5, dimension);
  }

  private processScheduledWorldTicks(ticks: ScheduledTick<WorldTickType, WorldTickPayload>[]) {
    for (const tick of ticks) {
      if (tick.dimension !== this.chunks.currentDimension || !this.isWorldPositionLoaded(tick.x, tick.y, tick.z)) {
        this.scheduleWorldTick(
          tick.type,
          tick.x,
          tick.y,
          tick.z,
          20,
          tick.payload?.reason ?? 'deferred_unloaded_tick',
          tick.dimension as Dimension,
          this.tickSourcePosition(tick.payload),
        );
        continue;
      }

      if (tick.type === 'fluid') {
        const result = this.fluids.processTick(tick.x, tick.y, tick.z, {
          getBlock: (x, y, z) => this.chunks.getBlock(x, y, z),
          getBlockMeta: (x, y, z) => this.chunks.getBlockMeta(x, y, z),
          setBlock: (x, y, z, id) => this.chunks.setBlock(x, y, z, id),
          setBlockMeta: (x, y, z, metadata, markDirty) => this.chunks.setBlockMeta(x, y, z, metadata, markDirty),
          dimension: tick.dimension,
        });
        for (const next of result.next) {
          this.scheduleWorldTick(
            'fluid',
            next.x,
            next.y,
            next.z,
            result.delayTicks,
            'fluid_propagation',
            tick.dimension as Dimension,
          );
        }
        continue;
      }

      if (tick.type === 'neighbor_update') {
        this.redstone.observeBlockChange(tick.x, tick.y, tick.z);
        const blockId = this.chunks.getBlock(tick.x, tick.y, tick.z);
        if (BlockRegistry.isFluid(blockId)) {
          this.scheduleWorldTick('fluid', tick.x, tick.y, tick.z, 5, 'neighbor_update', tick.dimension as Dimension);
        }
        this.checkFluidAdjacency(tick.x, tick.y, tick.z);
      }

      this.dispatchScheduledBlockBehavior(tick);
    }
  }

  private dispatchScheduledBlockBehavior(tick: ScheduledTick<WorldTickType, WorldTickPayload>) {
    const blockId = this.chunks.getBlock(tick.x, tick.y, tick.z);
    const block = BlockRegistry.get(blockId);
    const behavior = block ? this.behaviors.getBlockBehavior(block) : undefined;
    if (!behavior?.scheduledTick) return;
    const position = { x: tick.x, y: tick.y, z: tick.z };
    behavior.scheduledTick(
      this.createWorldContext(tick.dimension as Dimension),
      position,
      tick.payload?.reason ?? tick.type,
    );
  }

  private createWorldContext(dimension: Dimension): WorldContext {
    return {
      dimension,
      getBlock: ({ x, y, z }) => this.chunks.getBlock(x, y, z),
      getBlockState: ({ x, y, z }) => this.chunks.getBlockState(x, y, z),
      getBlockMetadata: ({ x, y, z }) => this.chunks.getBlockMeta(x, y, z),
      setBlock: ({ x, y, z }, blockId) => this.chunks.setBlock(x, y, z, blockId),
      setBlockStateProperties: ({ x, y, z }, properties) => this.chunks.setBlockStateProperties(x, y, z, properties),
      setBlockMetadata: ({ x, y, z }, metadata) => this.chunks.setBlockMeta(x, y, z, metadata, true),
      scheduleTick: ({ x, y, z }, delayTicks, reason) => {
        this.scheduleWorldTick('block_event', x, y, z, delayTicks, reason, dimension);
      },
    };
  }

  private tickSourcePosition(payload?: WorldTickPayload): BlockPosition | undefined {
    if (
      !payload
      || !Number.isFinite(payload.sourceX)
      || !Number.isFinite(payload.sourceY)
      || !Number.isFinite(payload.sourceZ)
    ) return undefined;
    return { x: payload.sourceX!, y: payload.sourceY!, z: payload.sourceZ! };
  }

  private isWorldPositionLoaded(x: number, y: number, z: number): boolean {
    if (y < 0 || y >= WORLD_HEIGHT) return false;
    return !!this.chunks.getChunk(Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE));
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

  private updateFarming(worldTicks: number) {
    this.farmingTickAccumulator += worldTicks;
    while (this.farmingTickAccumulator >= 20) {
      this.farmingTickAccumulator -= 20;
      this.farmingSimulationSequence++;
      this.runFarmingTick(this.farmingSimulationSequence);
    }
  }

  private runFarmingTick(sequence: number) {

    const px = Math.floor(this.player.position.x);
    const py = Math.floor(this.player.position.y);
    const pz = Math.floor(this.player.position.z);

    // Random tick: sample 15 random blocks near player
    for (let i = 0; i < 15; i++) {
      const rx = px + Math.floor(coordinateRandom(this.seed, sequence, i, 11) * 32) - 16;
      const ry = Math.max(1, Math.min(254, py + Math.floor(coordinateRandom(this.seed, sequence, i, 23) * 16) - 8));
      const rz = pz + Math.floor(coordinateRandom(this.seed, sequence, i, 37) * 32) - 16;

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
            if (coordinateRandom(this.seed, sequence, i, 53) < growthChance) {
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

  private getAdjacentBlockPosition(target: BlockInteractionContext): BlockPosition | null {
    if (!target.face) return null;

    const offsets: Record<BlockFacing, BlockPosition> = {
      east: { x: 1, y: 0, z: 0 },
      west: { x: -1, y: 0, z: 0 },
      up: { x: 0, y: 1, z: 0 },
      down: { x: 0, y: -1, z: 0 },
      south: { x: 0, y: 0, z: 1 },
      north: { x: 0, y: 0, z: -1 },
    };
    const offset = offsets[target.face];
    return {
      x: target.position.x + offset.x,
      y: target.position.y + offset.y,
      z: target.position.z + offset.z,
    };
  }

  private cushionSupportKey26_3(position: BlockPosition): string {
    return `${position.x},${position.y},${position.z}`;
  }

  private cushionSeatKey26_3(point: CushionPlacementPoint): string {
    return `${point.x.toFixed(3)},${point.y.toFixed(3)},${point.z.toFixed(3)}`;
  }

  private createCushionMesh26_3(point: CushionPlacementPoint, colorName: string): THREE.Mesh {
    const colors: Record<string, number> = {
      white: 0xf0f0f0, orange: 0xf9801d, magenta: 0xc74ebd, light_blue: 0x3ab3da,
      yellow: 0xfed83d, lime: 0x80c71f, pink: 0xf38baa, gray: 0x474f52,
      light_gray: 0x9d9d97, cyan: 0x169c9c, purple: 0x8932b8, blue: 0x3c44aa,
      brown: 0x835432, green: 0x5e7c16, red: 0xb02e26, black: 0x1d1d21,
    };
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.74, 0.18, 0.74),
      new THREE.MeshLambertMaterial({ color: colors[colorName] ?? 0xffffff }),
    );
    mesh.position.set(point.x, point.y + 0.09, point.z);
    mesh.name = 'wilderness-bound-cushion';
    return mesh;
  }

  private tryPlaceCushion26_3(itemName: string, stack: ItemStack, target?: BlockInteractionContext): boolean {
    if (!target || stack.count <= 0 || target.face !== 'up' || !target.block.solid) return false;
    const color = cushionColorFromItemName26_3(itemName);
    if (!color) return false;
    const seat = this.cushionSeats26_3.place({
      hitX: target.position.x + 0.5,
      hitZ: target.position.z + 0.5,
      supportTopY: target.position.y + 1,
      flatSurface: true,
      supportingBlock: true,
      color,
    }, this.cushionSupportKey26_3(target.position));
    if (!seat) return false;

    const mesh = this.createCushionMesh26_3(seat, color);
    this.cushionMeshes26_3.set(this.cushionSeatKey26_3(seat), mesh);
    this.renderer.scene.add(mesh);
    this.sound.playBlockPlace(35);
    if (this.gameMode !== 'creative') {
      this.inventory.removeFromSlot(this.player.selectedSlot, 1);
    }
    this.notifyState();
    return true;
  }

  private breakCushionsSupportedBy26_3(position: BlockPosition, spawnDrop: boolean): void {
    const broken = this.cushionSeats26_3.breakUnsupported(this.cushionSupportKey26_3(position));
    for (const seat of broken) {
      const key = this.cushionSeatKey26_3(seat);
      const mesh = this.cushionMeshes26_3.get(key);
      if (mesh) {
        this.renderer.scene.remove(mesh);
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) mesh.material.forEach(material => material.dispose());
        else mesh.material.dispose();
        this.cushionMeshes26_3.delete(key);
      }
      if (seat.occupantId === 'local-player') this.activeCushionSeat26_3 = null;
      if (spawnDrop && this.gameMode !== 'creative') {
        const item = ItemRegistry.getByName(`${seat.color}_cushion`);
        if (item) this.droppedItems.spawnItem(item.id, 1, new THREE.Vector3(seat.x, seat.y + 0.2, seat.z), new THREE.Vector3(0, 1.1, 0), 0.5);
      }
    }
  }

  private trySitOnCushion26_3(target: BlockInteractionContext): boolean {
    if (target.face !== 'up' || this.activeCushionSeat26_3) return false;
    const seat = this.cushionSeats26_3.getSeatForSupport(this.cushionSupportKey26_3(target.position));
    if (!seat) return false;
    const result = this.cushionSeats26_3.sit('local-player', seat);
    if (!result.seated || !result.position) return false;
    this.activeCushionSeat26_3 = result.position;
    this.player.velocity.set(0, 0, 0);
    this.notifyState();
    return true;
  }

  private tryPlaceBlockItem(stack: ItemStack, target?: BlockInteractionContext): boolean {
    if (!target || stack.count <= 0) return false;
    const item = ItemRegistry.get(stack.id);
    if (!item) return false;

    const playerX = Math.floor(this.player.position.x);
    const playerZ = Math.floor(this.player.position.z);
    const decision = planBlockPlacement({
      item,
      target,
      placeBlockId: ItemRegistry.getPlaceBlockId(stack.id),
      playerOccupiedCells: [
        { x: playerX, y: Math.floor(this.player.position.y), z: playerZ },
        { x: playerX, y: Math.floor(this.player.position.y + 1.5), z: playerZ },
      ],
    }, {
      getBlock: ({ x, y, z }) => this.chunks.getBlock(x, y, z),
      getBlockMetadata: ({ x, y, z }) => this.chunks.getBlockMeta(x, y, z),
    });
    if (!decision.ok) return false;

    const { plan } = decision;
    const { x, y, z } = plan.position;
    if (BlockRegistry.get(plan.blockId)?.name === 'chest' && !this.canPlaceChestAt(x, y, z)) return false;
    const multiplayerPlacement = this.isMultiplayerNetworkConnected();
    if (multiplayerPlacement) {
      this.network.send(PacketType.C2S_BLOCK_PLACE, {
        x,
        y,
        z,
        blockId: plan.blockId,
        facing: plan.facing,
        targetX: target.position.x,
        targetY: target.position.y,
        targetZ: target.position.z,
        targetFace: target.face,
      });
    } else if (plan.kind === 'door') {
      if (!this.placeDoor(x, y, z, plan.blockId)) return false;
    } else if (plan.kind === 'bed') {
      if (!this.placeBed(x, y, z, plan.blockId)) return false;
    } else if (plan.kind === 'slab') {
      this.chunks.setBlock(x, y, z, plan.blockId);
      this.chunks.setBlockMeta(x, y, z, plan.slabHalf ? { slabHalf: plan.slabHalf } : null);
      this.redstone.observeBlockChange(x, y, z);
    } else {
      this.chunks.setBlock(x, y, z, plan.blockId);
      this.setPlacedBlockMetadata(x, y, z, plan.blockId, plan.facing, stack);
      this.redstone.observeBlockChange(x, y, z);
      this.checkFluidAdjacency(x, y, z);

      if (plan.checksWitherSpawn) this.checkWitherSpawning(x, y, z);
      if (plan.schedulesFluid) this.scheduleFluidNeighborhood(x, y, z);
      if (plan.opensSignEditor) {
        this.editingSignPos = new THREE.Vector3(x, y, z);
        this.editingSignSide = 'front';
        this.openUI = 'sign_edit';
        document.exitPointerLock();
        this.notifyState();
      }
    }

    this.sound.playBlockPlace(plan.blockId);
    if (!multiplayerPlacement && shouldConsumePlacedItem(this.gameMode)) {
      this.inventory.removeFromSlot(this.player.selectedSlot);
    }
    return true;
  }

  private tryInsertDecoratedPot(x: number, y: number, z: number, heldItem: ItemStack | null): boolean {
    if (!heldItem || heldItem.count <= 0) return false;
    if (this.isMultiplayerNetworkConnected()) {
      this.network.send(PacketType.C2S_INTERACT_BLOCK, { x, y, z });
      return true;
    }

    const currentMeta = this.chunks.getBlockMeta(x, y, z);
    const result = insertOneIntoDecoratedPot(currentMeta, heldItem, this.gameMode === 'creative');
    if (result.inserted <= 0) return false;
    const nextMeta = {
      ...result.metadata,
      decoratedPotWobbleUntil: Date.now() + 450,
    };
    this.chunks.setBlockMeta(x, y, z, nextMeta, true);
    this.sound.playBlockPlace(this.chunks.getBlock(x, y, z));
    if (this.gameMode !== 'creative') {
      this.inventory.setSlot(this.player.selectedSlot, result.held);
    }
    this.redstone.observeBlockChange(x, y, z);
    this.notifyState();
    return true;
  }

  private tryUseBucket(stack: ItemStack, target?: BlockInteractionContext): boolean {
    if (!target) return false;
    if (this.sendServerBlockItemUse(stack, target)) return true;
    const bucketName = ItemRegistry.get(stack.id)?.name;
    if (!bucketName) return false;

    if (bucketName === 'bucket') {
      const targetName = target.block.name;
      const filledName = BlockRegistry.isWater(target.blockId)
        ? 'water_bucket'
        : BlockRegistry.isLava(target.blockId)
          ? 'lava_bucket'
          : targetName === 'powder_snow'
            ? 'powder_snow_bucket'
            : null;
      if (!filledName) return false;
      const filledBucket = ItemRegistry.getByName(filledName);
      if (!filledBucket) return false;

      const { x, y, z } = target.position;
      this.chunks.setBlock(x, y, z, 0);
      this.chunks.setBlockMeta(x, y, z, null);
      if (filledName !== 'powder_snow_bucket') this.scheduleFluidNeighborhood(x, y, z);
      this.sound.playBucketFill();
      this.replaceHeldBucketAfterUse(stack, filledBucket.id);
      this.notifyState();
      return true;
    }

    const placedBlockName = bucketName === 'water_bucket'
      ? 'water'
      : bucketName === 'lava_bucket'
        ? 'lava'
        : bucketName === 'powder_snow_bucket'
          ? 'powder_snow'
          : null;
    if (!placedBlockName) return false;
    const placePosition = this.getAdjacentBlockPosition(target);
    if (!placePosition) return false;

    const currentBlock = this.chunks.getBlock(placePosition.x, placePosition.y, placePosition.z);
    const isReplaceable = currentBlock === 0 ||
      BlockRegistry.isFluid(currentBlock) ||
      currentBlock === 31 ||
      currentBlock === 37 ||
      currentBlock === 38;
    if (!isReplaceable) return false;

    const placedBlock = BlockRegistry.getByName(placedBlockName);
    const emptyBucket = ItemRegistry.getByName('bucket');
    if (!placedBlock || !emptyBucket) return false;
    this.chunks.setBlock(placePosition.x, placePosition.y, placePosition.z, placedBlock.id);
    this.chunks.setBlockMeta(
      placePosition.x,
      placePosition.y,
      placePosition.z,
      bucketName === 'powder_snow_bucket' ? null : { fluidLevel: 8 },
    );
    if (bucketName !== 'powder_snow_bucket') {
      this.scheduleFluidNeighborhood(placePosition.x, placePosition.y, placePosition.z);
    }
    this.sound.playBucketEmpty();
    this.replaceHeldBucketAfterUse(stack, emptyBucket.id);
    this.notifyState();
    return true;
  }

  private tryUseSpawnEgg(stack: ItemStack, target?: BlockInteractionContext): boolean {
    if (!target) return false;
    const itemName = ItemRegistry.get(stack.id)?.name ?? '';
    const mobType = spawnEggMobTypeForItemName(itemName);
    if (!mobType) return false;
    if (this.sendServerBlockItemUse(stack, target)) return true;

    const position = this.getAdjacentBlockPosition(target);
    if (!position) return false;
    const mob = this.mobs.spawnMob(mobType, position.x + 0.5, position.y, position.z + 0.5);
    if (!mob) return false;

    this.sound.playLever();
    if (this.gameMode !== 'creative') {
      this.inventory.removeFromSlot(this.player.selectedSlot, 1);
    }
    this.notifyState();
    return true;
  }

  private tryPlaceArmorStand(stack: ItemStack, target?: BlockInteractionContext): boolean {
    if (!target || !target.face || target.face === 'down') return false;
    if (this.sendServerBlockItemUse(stack, target)) return true;

    const position = this.getAdjacentBlockPosition(target);
    if (!position) return false;
    const canPlace = canPlaceArmorStandAt(
      position,
      target.face,
      (x, y, z) => this.chunks.isSolidBlock(x, y, z),
      (x, y, z) => {
        if (
          Math.abs(this.player.position.x - x) < 0.55 &&
          Math.abs(this.player.position.y - y) < 1.98 &&
          Math.abs(this.player.position.z - z) < 0.55
        ) return true;
        return Array.from(this.mobs.mobs.values()).some((mob) =>
          mob.health > 0 &&
          Math.abs(mob.position.x - x) < (mob.width + 0.5) * 0.5 &&
          Math.abs(mob.position.y - y) < Math.max(mob.height, 1.975) &&
          Math.abs(mob.position.z - z) < (mob.width + 0.5) * 0.5
        );
      },
    );
    if (!canPlace) return false;

    const stand = this.mobs.spawnMob('armor_stand', position.x + 0.5, position.y, position.z + 0.5);
    if (!stand) return false;
    stand.yaw = snapArmorStandYaw(this.player.yaw);
    stand.mesh.rotation.y = stand.yaw;
    if (this.gameMode !== 'creative') this.inventory.removeFromSlot(this.player.selectedSlot, 1);
    this.sound.playBlockPlace(target.blockId);
    this.notifyState();
    return true;
  }

  private tryInteractArmorStand(target: Mob, heldItem: ItemStack | null) {
    if (target.def.type !== 'armor_stand') return { handled: false };

    const heldDef = heldItem ? ItemRegistry.get(heldItem.id) : undefined;
    const isArmorItem = !!heldDef && heldDef.category === 'armor' && !!heldDef.armorSlot;

    if (this.isMultiplayerNetworkConnected()) {
      if (heldItem && !isArmorItem) return { handled: false };
      this.network.send(PacketType.C2S_MOB_INTERACT, { mobId: target.id, action: 'interact' });
      return { handled: true, cooldown: 0.25 };
    }

    if (heldItem) {
      const def = heldDef;
      if (def?.category !== 'armor' || !def.armorSlot) return { handled: false };
      const slotIndex = armorStandSlotIndex(def.armorSlot);
      const existing = target.getArmorStandEquipment(slotIndex);
      const equipped = { ...heldItem, count: 1 };
      target.setArmorStandEquipment(slotIndex, equipped);
      if (this.gameMode !== 'creative') {
        this.inventory.setSlot(this.player.selectedSlot, existing);
      }
      this.sound.playLever();
      this.notifyState();
      return { handled: true, cooldown: 0.25 };
    }

    const slotIndex = firstEquippedArmorStandSlot(target.armorStandEquipment);
    if (slotIndex < 0) return { handled: false };
    const existing = target.getArmorStandEquipment(slotIndex);
    if (!existing) return { handled: false };
    target.setArmorStandEquipment(slotIndex, null);
    this.inventory.setSlot(this.player.selectedSlot, existing);
    this.sound.playPickup();
    this.notifyState();
    return { handled: true, cooldown: 0.25 };
  }

  private tryPlaceHangingEntity(
    type: HangingEntityType,
    stack: ItemStack,
    target?: BlockInteractionContext,
  ): boolean {
    if (!target?.face) return false;
    if (this.sendServerBlockItemUse(stack, target)) return true;

    const canPlace = canPlaceHangingEntity(
      type,
      target.position,
      target.face,
      (x, y, z) => this.chunks.isSolidBlock(x, y, z),
      (x, y, z) => Array.from(this.mobs.mobs.values()).some((mob) =>
        mob.health > 0 &&
        Math.abs(mob.position.x - x) < 0.6 &&
        Math.abs(mob.position.y - y) < 0.6 &&
        Math.abs(mob.position.z - z) < 0.6
      ),
    );
    if (!canPlace) return false;

    const pos = hangingEntityWorldPosition(target.position, target.face);
    const entity = this.mobs.spawnMob(type, pos.x, pos.y, pos.z);
    if (!entity) return false;
    entity.setHangingFace(target.face);
    if (type === 'painting') {
      entity.setPaintingVariant(choosePaintingVariant(this.seed, target.position));
    }

    if (this.gameMode !== 'creative') {
      this.inventory.removeFromSlot(this.player.selectedSlot, 1);
    }
    this.sound.playBlockPlace(target.blockId);
    this.notifyState();
    return true;
  }

  private tryInteractItemFrame(target: Mob, heldItem: ItemStack | null) {
    if (target.def.type !== 'item_frame') return { handled: false };

    if (this.isMultiplayerNetworkConnected()) {
      this.network.send(PacketType.C2S_MOB_INTERACT, { mobId: target.id, action: 'interact' });
      return { handled: true, cooldown: 0.2 };
    }

    if (!target.itemFrameItem) {
      if (!heldItem) return { handled: false };
      target.setItemFrameItem(heldItem);
      if (this.gameMode !== 'creative') {
        this.inventory.removeFromSlot(this.player.selectedSlot, 1);
      }
      this.sound.playLever();
      this.notifyState();
      return { handled: true, cooldown: 0.2 };
    }

    target.rotateItemFrame();
    this.sound.playLever();
    this.notifyState();
    return { handled: true, cooldown: 0.2 };
  }

  private tryUseLeadOnMob(target: Mob, heldItem: ItemStack) {
    if (!isLeashableMobType(target.def.type)) return { handled: false };
    const localHolderId = this.network.playerId ?? 'local-player';
    if (target.leashHolderId === 'local-player' || target.leashHolderId === localHolderId) {
      return { handled: false };
    }

    const existingFenceHolder = parseFenceLeashHolderId(target.leashHolderId);
    const existingMobHolder = parseMobLeashHolderId(target.leashHolderId);
    const heldByOtherPlayer =
      !!target.leashHolderId &&
      !existingFenceHolder &&
      existingMobHolder === null &&
      target.leashHolderId !== localHolderId &&
      target.leashHolderId !== 'local-player';
    if (heldByOtherPlayer) return { handled: false };

    if (this.sendServerEntityItemUse(heldItem, target.id)) {
      return { handled: true, cooldown: 0.25 };
    }

    if (target.leashHolderId && this.gameMode !== 'creative') {
      this.droppedItems.spawnItem(
        420,
        1,
        target.position.clone().add(new THREE.Vector3(0, 0.4, 0)),
        new THREE.Vector3(0, 0.8, 0),
        0.25,
      );
    }
    target.leashHolderId = 'local-player';
    if (this.gameMode !== 'creative') {
      this.inventory.removeFromSlot(this.player.selectedSlot, 1);
    }
    this.sound.playLever();
    this.notifyState();
    return { handled: true, cooldown: 0.25 };
  }

  private tryTransferPlayerLeashesToMob(target: Mob) {
    if (target.def.type === 'item_frame' || target.def.type === 'painting' || target.def.type === 'armor_stand') {
      return { handled: false };
    }

    const localHolderId = this.network.playerId ?? 'local-player';
    const holderId = mobLeashHolderId(target.id);
    const targetCenter = {
      x: target.position.x,
      y: target.position.y + target.height * 0.55,
      z: target.position.z,
    };
    const attachable = Array.from(this.mobs.mobs.values()).filter((mob) =>
      mob.id !== target.id &&
      isLeashableMobType(mob.def.type) &&
      (mob.leashHolderId === 'local-player' || mob.leashHolderId === localHolderId) &&
      leashDistance(targetCenter, {
        x: mob.position.x,
        y: mob.position.y + mob.height * 0.55,
        z: mob.position.z,
      }) <= LEAD_SNAP_DISTANCE
    );
    if (attachable.length === 0) return { handled: false };

    if (this.isMultiplayerNetworkConnected()) {
      this.network.send(PacketType.C2S_MOB_INTERACT, { mobId: target.id, action: 'transfer_leashes' });
      return { handled: true, cooldown: 0.25 };
    }

    for (const mob of attachable) mob.leashHolderId = holderId;
    this.sound.playLever();
    this.notifyState();
    return { handled: true, cooldown: 0.25 };
  }

  private tryShearLeashConnections(target: Mob, heldItem: ItemStack) {
    const childHolderId = mobLeashHolderId(target.id);
    const childConnections = Array.from(this.mobs.mobs.values()).filter(
      (mob) => mob.leashHolderId === childHolderId,
    );
    const ownConnection = !!target.leashHolderId && isLeashableMobType(target.def.type);
    if (!ownConnection && childConnections.length === 0) return { handled: false };

    if (this.sendServerEntityItemUse(heldItem, target.id)) {
      return { handled: true, cooldown: 0.25 };
    }

    const broken = ownConnection ? [target, ...childConnections] : childConnections;
    for (const mob of broken) {
      mob.leashHolderId = null;
      if (this.gameMode !== 'creative') {
        this.droppedItems.spawnItem(
          420,
          1,
          mob.position.clone().add(new THREE.Vector3(0, 0.4, 0)),
          new THREE.Vector3(0, 0.8, 0),
          0.25,
        );
      }
    }
    if (this.gameMode !== 'creative') this.inventory.damageTool(this.player.selectedSlot);
    this.sound.playLever();
    this.notifyState();
    return { handled: true, cooldown: 0.25 };
  }

  private tryInteractJukebox(
    position: BlockPosition,
    blockId: number,
    heldItem: ItemStack | null,
  ): boolean {
    const block = BlockRegistry.get(blockId);
    if (block?.name !== 'jukebox') return false;

    const currentMeta = this.chunks.getBlockMeta(position.x, position.y, position.z) ?? {};
    const storedDisc = getStoredJukeboxDisc(currentMeta.jukeboxDisc);
    const heldName = heldItem ? ItemRegistry.get(heldItem.id)?.name : undefined;
    const heldIsDisc = isJukeboxPlayableItemName(heldName);
    if (!storedDisc && !heldIsDisc) return false;

    if (this.isMultiplayerNetworkConnected()) {
      this.network.send(PacketType.C2S_INTERACT_BLOCK, {
        x: position.x,
        y: position.y,
        z: position.z,
      });
      return true;
    }

    if (storedDisc) {
      const nextMeta: BlockMetadata = { ...currentMeta };
      delete nextMeta.jukeboxDisc;
      delete nextMeta.jukeboxSong;
      delete nextMeta.jukeboxComparatorOutput;
      this.chunks.setBlockMeta(position.x, position.y, position.z, nextMeta, true);
      this.sound.stopJukeboxSong();
      this.droppedItems.spawnStack(
        storedDisc,
        new THREE.Vector3(position.x + 0.5, position.y + 1.0, position.z + 0.5),
        new THREE.Vector3(0, 1.2, 0),
        0.25,
      );
      this.applyRedstoneToNeighbors(position.x, position.y, position.z);
      this.notifyState();
      return true;
    }

    if (!heldItem) return false;
    const song = getJukeboxSong(heldName);
    if (!song) return false;
    const jukeboxDisc = getStoredJukeboxDisc(heldItem);
    if (!jukeboxDisc) return false;

    const nextMeta: BlockMetadata = {
      ...currentMeta,
      jukeboxDisc,
      jukeboxSong: song.songId,
      jukeboxComparatorOutput: song.comparatorOutput,
    };
    this.chunks.setBlockMeta(position.x, position.y, position.z, nextMeta, true);
    if (this.gameMode !== 'creative') {
      this.inventory.removeFromSlot(this.player.selectedSlot, 1);
    }
    this.sound.playJukeboxSong(song.songId);
    this.applyRedstoneToNeighbors(position.x, position.y, position.z);
    this.notifyState();
    return true;
  }

  private tryTieLeashedMobsToFence(
    position: BlockPosition,
    blockName: string,
    heldItem: ItemStack | null,
  ): boolean {
    if (!isFenceBlockName(blockName)) return false;
    const localHolderId = this.network.playerId ?? 'local-player';
    const fenceHolderId = fenceLeashHolderId(this.chunks.currentDimension, position);
    const fenceCenter = {
      x: position.x + 0.5,
      y: position.y + 0.65,
      z: position.z + 0.5,
    };
    const playerLeashed = Array.from(this.mobs.mobs.values()).filter((mob) =>
      isLeashableMobType(mob.def.type) &&
      (mob.leashHolderId === 'local-player' || mob.leashHolderId === localHolderId)
    );
    const attachable = playerLeashed.filter((mob) =>
      leashDistance(fenceCenter, {
        x: mob.position.x,
        y: mob.position.y + mob.height * 0.55,
        z: mob.position.z,
      }) <= LEAD_SNAP_DISTANCE
    );
    const fenceLeashed = Array.from(this.mobs.mobs.values()).filter((mob) =>
      isLeashableMobType(mob.def.type) &&
      mob.leashHolderId === fenceHolderId &&
      leashDistance(fenceCenter, {
        x: mob.position.x,
        y: mob.position.y + mob.height * 0.55,
        z: mob.position.z,
      }) <= LEAD_SNAP_DISTANCE
    );
    const heldName = heldItem ? ItemRegistry.get(heldItem.id)?.name : undefined;
    const shearing = heldName === 'shears' && fenceLeashed.length > 0;
    const transferBack =
      !this.input.isKeyDown('shift') &&
      attachable.length === 0 &&
      playerLeashed.length === 0 &&
      fenceLeashed.length > 0;

    if (!shearing && attachable.length === 0 && !transferBack) return false;

    if (this.isMultiplayerNetworkConnected()) {
      this.network.send(PacketType.C2S_INTERACT_BLOCK, {
        x: position.x,
        y: position.y,
        z: position.z,
      });
      return true;
    }

    if (shearing) {
      for (const mob of fenceLeashed) {
        mob.leashHolderId = null;
        if (this.gameMode !== 'creative') {
          this.droppedItems.spawnItem(
            420,
            1,
            mob.position.clone().add(new THREE.Vector3(0, 0.4, 0)),
            new THREE.Vector3(0, 0.8, 0),
            0.25,
          );
        }
      }
      if (this.gameMode !== 'creative') this.inventory.damageTool(this.player.selectedSlot);
    } else if (attachable.length > 0) {
      for (const mob of attachable) mob.leashHolderId = fenceHolderId;
    } else if (transferBack) {
      for (const mob of fenceLeashed) mob.leashHolderId = 'local-player';
    }
    this.sound.playLever();
    this.notifyState();
    return true;
  }

  private tryDetachLeadFromMob(target: Mob) {
    if (!target.leashHolderId || !isLeashableMobType(target.def.type)) return { handled: false };
    if (this.isMultiplayerNetworkConnected()) {
      this.network.send(PacketType.C2S_MOB_INTERACT, { mobId: target.id, action: 'interact' });
      return { handled: true, cooldown: 0.25 };
    }

    target.leashHolderId = null;
    if (this.gameMode !== 'creative') {
      this.droppedItems.spawnItem(
        420,
        1,
        target.position.clone().add(new THREE.Vector3(0, 0.4, 0)),
        new THREE.Vector3(0, 0.8, 0),
        0.25,
      );
    }
    this.sound.playPickup();
    this.notifyState();
    return { handled: true, cooldown: 0.25 };
  }

  private breakUnsupportedHangingEntities() {
    const broken: Mob[] = [];
    for (const mob of this.mobs.mobs.values()) {
      if ((mob.def.type !== 'item_frame' && mob.def.type !== 'painting') || !mob.hangingFace) continue;
      const support = hangingSupportPositionFromWorld(mob.position, mob.hangingFace);
      if (!this.chunks.isSolidBlock(support.x, support.y, support.z)) broken.push(mob);
    }
    for (const mob of broken) {
      this.handleMobDeath(mob, 0);
      this.mobs.removeMob(mob.id);
    }
  }

  private updateLeashedMobs(dt: number, networkAuthoritative: boolean) {
    const active = new Set<number>();

    for (const mob of this.mobs.mobs.values()) {
      if (!mob.leashHolderId || !isLeashableMobType(mob.def.type)) continue;

      const localHolder =
        mob.leashHolderId === 'local-player' ||
        (!!this.network.playerId && mob.leashHolderId === this.network.playerId);
      const fenceHolder = parseFenceLeashHolderId(mob.leashHolderId);
      const holderMobId = parseMobLeashHolderId(mob.leashHolderId);
      const holderMob = holderMobId === null ? null : this.mobs.mobs.get(holderMobId) ?? null;
      let holder: THREE.Vector3 | null = null;

      if (localHolder) {
        holder = this.player.position.clone().add(new THREE.Vector3(0, 1.0, 0));
      } else if (fenceHolder && fenceHolder.dimension === this.chunks.currentDimension) {
        holder = new THREE.Vector3(
          fenceHolder.position.x + 0.5,
          fenceHolder.position.y + 0.65,
          fenceHolder.position.z + 0.5,
        );
      } else if (holderMob && holderMob.id !== mob.id && holderMob.health > 0) {
        holder = holderMob.position.clone().add(new THREE.Vector3(0, holderMob.height * 0.55, 0));
      } else {
        const remote = this.network.otherPlayers.get(mob.leashHolderId);
        if (remote) holder = remote.mesh.position.clone().add(new THREE.Vector3(0, 1.0, 0));
      }

      const locallyResolvableHolder = localHolder || !!fenceHolder || holderMobId !== null;
      if (!holder) {
        if (!networkAuthoritative && locallyResolvableHolder) {
          mob.leashHolderId = null;
          if (this.gameMode !== 'creative') {
            this.droppedItems.spawnItem(
              420,
              1,
              mob.position.clone().add(new THREE.Vector3(0, 0.4, 0)),
              new THREE.Vector3(0, 0.8, 0),
              0.25,
            );
          }
        }
        continue;
      }

      active.add(mob.id);
      const center = mob.position.clone().add(new THREE.Vector3(0, mob.height * 0.55, 0));

      if (!networkAuthoritative && locallyResolvableHolder) {
        if (fenceHolder) {
          const block = BlockRegistry.get(this.chunks.getBlock(
            fenceHolder.position.x,
            fenceHolder.position.y,
            fenceHolder.position.z,
          ));
          if (!block || !isFenceBlockName(block.name)) {
            mob.leashHolderId = null;
            if (this.gameMode !== 'creative') {
              this.droppedItems.spawnItem(
                420,
                1,
                mob.position.clone().add(new THREE.Vector3(0, 0.4, 0)),
                new THREE.Vector3(0, 0.8, 0),
                0.25,
              );
            }
            continue;
          }
        }

        const distance = leashDistance(holder, center);
        if (shouldBreakLeash(distance)) {
          mob.leashHolderId = null;
          if (this.gameMode !== 'creative') {
            this.droppedItems.spawnItem(
              420,
              1,
              mob.position.clone().add(new THREE.Vector3(0, 0.4, 0)),
              new THREE.Vector3(0, 0.8, 0),
              0.25,
            );
          }
          const stale = this.leashLines.get(mob.id);
          if (stale) {
            this.renderer.scene.remove(stale);
            stale.geometry.dispose();
            (stale.material as THREE.Material).dispose();
            this.leashLines.delete(mob.id);
          }
          continue;
        }

        const pull = leashPullVector(holder, center);
        mob.velocity.x += pull.x * dt;
        mob.velocity.y += pull.y * dt;
        mob.velocity.z += pull.z * dt;
        if (Math.abs(pull.x) + Math.abs(pull.z) > 1e-6) {
          mob.yaw = Math.atan2(holder.x - center.x, holder.z - center.z);
          mob.mesh.rotation.y = mob.yaw;
        }
      }

      let line = this.leashLines.get(mob.id);
      if (!line) {
        line = new THREE.Line(
          new THREE.BufferGeometry(),
          new THREE.LineBasicMaterial({ color: 0x6b4a2b }),
        );
        line.name = 'mob_leash';
        this.renderer.scene.add(line);
        this.leashLines.set(mob.id, line);
      }
      line.geometry.setFromPoints([holder, center]);
    }

    for (const [mobId, line] of this.leashLines) {
      if (active.has(mobId)) continue;
      this.renderer.scene.remove(line);
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
      this.leashLines.delete(mobId);
    }
  }

  private tryPlaceBoat(stack: ItemStack, target?: BlockInteractionContext): boolean {
    if (!target) return false;
    if (this.sendServerBlockItemUse(stack, target)) return true;
    const position = this.getAdjacentBlockPosition(target);
    if (!position) return false;

    const itemName = ItemRegistry.get(stack.id)?.name ?? '';
    const vehicleType = itemName.endsWith('_chest_boat') ? 'chest_boat' : 'boat';
    this.vehicles.spawnVehicle(vehicleType, new THREE.Vector3(position.x + 0.5, position.y + 0.2, position.z + 0.5), stack.id);
    this.sound.playBlockPlace(5);
    if (this.gameMode !== 'creative') {
      this.inventory.removeFromSlot(this.player.selectedSlot, 1);
    }
    return true;
  }

  private tryPlaceMinecart(stack: ItemStack, target?: BlockInteractionContext): boolean {
    if (!target || !BlockRegistry.isRail(target.blockId)) return false;
    if (this.sendServerBlockItemUse(stack, target)) return true;
    const { x, y, z } = target.position;

    this.vehicles.spawnVehicle('minecart', new THREE.Vector3(x + 0.5, y + 0.05, z + 0.5), stack.id);
    this.sound.playBlockPlace(1);
    if (this.gameMode !== 'creative') {
      this.inventory.removeFromSlot(this.player.selectedSlot, 1);
    }
    return true;
  }

  private tryUseFlintAndSteel(target?: BlockInteractionContext): boolean {
    if (!target) return false;
    const held = this.inventory.getSlot(this.player.selectedSlot);
    if (held && this.sendServerBlockItemUse(held, target)) return true;

    if (target.block.name === 'tnt') {
      this.igniteTNT(target.position.x, target.position.y, target.position.z);
      if (this.gameMode !== 'creative') this.inventory.damageTool(this.player.selectedSlot);
      return true;
    }

    const position = this.getAdjacentBlockPosition(target);
    if (!position) return false;

    const activated = this.chunks.dimensionGen.findAndActivatePortalFrame(
      (x, y, z) => this.chunks.getBlock(x, y, z),
      (x, y, z, id) => this.chunks.setBlock(x, y, z, id),
      position.x,
      position.y,
      position.z,
    );
    if (activated) {
      this.sound.playBlockPlace(0);
      if (this.gameMode !== 'creative') this.inventory.damageTool(this.player.selectedSlot);
      return true;
    }

    if (this.chunks.getBlock(position.x, position.y, position.z) !== 0) return false;
    const fire = BlockRegistry.getByName('fire');
    if (!fire) return false;
    this.chunks.setBlock(position.x, position.y, position.z, fire.id);
    this.chunks.setBlockMeta(position.x, position.y, position.z, null);
    this.redstone.observeBlockChange(position.x, position.y, position.z);
    this.sound.playBlockPlace(fire.id);
    if (this.gameMode !== 'creative') this.inventory.damageTool(this.player.selectedSlot);
    return true;
  }

  private tryUseFireCharge(target?: BlockInteractionContext): boolean {
    if (!target) return false;
    const held = this.inventory.getSlot(this.player.selectedSlot);
    if (held && this.sendServerBlockItemUse(held, target)) return true;

    if (target.block.name === 'tnt') {
      this.igniteTNT(target.position.x, target.position.y, target.position.z);
      if (this.gameMode !== 'creative') this.inventory.removeFromSlot(this.player.selectedSlot, 1);
      return true;
    }

    const position = this.getAdjacentBlockPosition(target);
    if (!position) return false;

    const activated = this.chunks.dimensionGen.findAndActivatePortalFrame(
      (x, y, z) => this.chunks.getBlock(x, y, z),
      (x, y, z, id) => this.chunks.setBlock(x, y, z, id),
      position.x,
      position.y,
      position.z,
    );
    if (activated) {
      this.sound.playBlockPlace(0);
      if (this.gameMode !== 'creative') this.inventory.removeFromSlot(this.player.selectedSlot, 1);
      return true;
    }

    if (this.chunks.getBlock(position.x, position.y, position.z) !== 0) return false;
    const fire = BlockRegistry.getByName('fire');
    if (!fire) return false;
    this.chunks.setBlock(position.x, position.y, position.z, fire.id);
    this.chunks.setBlockMeta(position.x, position.y, position.z, null);
    this.redstone.observeBlockChange(position.x, position.y, position.z);
    this.sound.playBlockPlace(fire.id);
    if (this.gameMode !== 'creative') this.inventory.removeFromSlot(this.player.selectedSlot, 1);
    return true;
  }

  private tryUseShears(target?: BlockInteractionContext): boolean {
    if (!target) return false;
    const held = this.inventory.getSlot(this.player.selectedSlot);
    if (held && this.sendServerBlockItemUse(held, target)) return true;
    if (target.block.name !== 'pumpkin') return false;
    const carved = BlockRegistry.getByName('carved_pumpkin');
    if (!carved) return false;
    const { x, y, z } = target.position;
    this.chunks.setBlock(x, y, z, carved.id);
    this.chunks.setBlockMeta(x, y, z, { facing: this.getPlayerHorizontalFacing() }, true);
    this.redstone.observeBlockChange(x, y, z);

    const seeds = ItemRegistry.getByName('pumpkin_seeds');
    if (seeds) {
      this.droppedItems.spawnItem(
        seeds.id,
        4,
        new THREE.Vector3(x + 0.5, y + 0.8, z + 0.5),
        new THREE.Vector3(0, 1.1, 0),
        0.5,
      );
    }
    if (this.gameMode !== 'creative') this.inventory.damageTool(this.player.selectedSlot);
    this.sound.playBlockPlace(carved.id);
    return true;
  }

  private tryUseShovel(target?: BlockInteractionContext): boolean {
    if (!target || target.face !== 'up') return false;
    if (!resolveShovelPathTargetName(target.block.name)) return false;
    const held = this.inventory.getSlot(this.player.selectedSlot);
    if (held && this.sendServerBlockItemUse(held, target)) return true;
    const { x, y, z } = target.position;
    if (this.chunks.getBlock(x, y + 1, z) !== 0) return false;

    const path = BlockRegistry.getByName('dirt_path') ?? BlockRegistry.getByName('grass_path');
    if (!path) return false;
    this.chunks.setBlock(x, y, z, path.id);
    this.chunks.setBlockMeta(x, y, z, null, true);
    this.redstone.observeBlockChange(x, y, z);
    this.sound.playBlockPlace(path.id);
    if (this.gameMode !== 'creative') this.inventory.damageTool(this.player.selectedSlot);
    return true;
  }

  private tryUseAxe(target?: BlockInteractionContext): boolean {
    if (!target) return false;
    const strippedName = resolveAxeStrippedBlockName(target.block.name);
    if (!strippedName) return false;
    const held = this.inventory.getSlot(this.player.selectedSlot);
    if (held && this.sendServerBlockItemUse(held, target)) return true;
    const stripped = BlockRegistry.getByName(strippedName);
    if (!stripped) return false;

    const { x, y, z } = target.position;
    const metadata = this.chunks.getBlockMeta(x, y, z);
    this.chunks.setBlock(x, y, z, stripped.id);
    this.chunks.setBlockMeta(x, y, z, metadata ?? null, true);
    this.redstone.observeBlockChange(x, y, z);
    this.sound.playBlockPlace(stripped.id);
    if (this.gameMode !== 'creative') this.inventory.damageTool(this.player.selectedSlot);
    return true;
  }

  private tryUseBoneMeal26_3(target?: BlockInteractionContext): boolean {
    if (!target) return false;
    if (target.block.name !== 'shelf_mushroom' && target.block.name !== 'red_shrub') return false;
    const held = this.inventory.getSlot(this.player.selectedSlot);
    if (held && this.sendServerBlockItemUse(held, target)) return true;
    const { x, y, z } = target.position;

    if (target.block.name === 'shelf_mushroom') {
      const metadata = this.chunks.getBlockMeta(x, y, z);
      if (metadata?.shelfMushroomSize === 'large') return false;
      this.chunks.setBlockMeta(x, y, z, { ...metadata, shelfMushroomSize: 'large' }, true);
      if (this.gameMode !== 'creative') this.inventory.removeFromSlot(this.player.selectedSlot, 1);
      this.sound.playBlockPlace(target.blockId);
      this.notifyState();
      return true;
    }

    if (target.block.name !== 'red_shrub') return false;
    const start = Math.floor(coordinateRandom(
      this.seed,
      x,
      this.worldTickScheduler.getCurrentTick() + 2630,
      z,
    ) * 8);
    for (const offset of rotateBoneMealSpreadOffsets26_3(start)) {
      const nx = x + offset.x;
      const nz = z + offset.z;
      if (this.chunks.getBlock(nx, y, nz) !== 0) continue;
      if (!BlockRegistry.isSolid(this.chunks.getBlock(nx, y - 1, nz))) continue;
      this.chunks.setBlock(nx, y, nz, target.blockId);
      this.chunks.setBlockMeta(nx, y, nz, null, true);
      this.redstone.observeBlockChange(nx, y, nz);
      if (this.gameMode !== 'creative') this.inventory.removeFromSlot(this.player.selectedSlot, 1);
      this.sound.playBlockPlace(target.blockId);
      this.notifyState();
      return true;
    }
    return false;
  }

  private tryTillFarmland(target?: BlockInteractionContext): boolean {
    if (!target || target.face === 'down') return false;
    if (!resolveHoeFarmlandTargetName(target.block.name)) return false;
    const { x, y, z } = target.position;
    if (this.chunks.getBlock(x, y + 1, z) !== 0) return false;
    const held = this.inventory.getSlot(this.player.selectedSlot);
    if (held && this.sendServerBlockItemUse(held, target)) return true;

    const moisture = this.isWaterNearby(x, y, z) ? 7 : 0;
    this.chunks.setBlock(x, y, z, (moisture << 10) | 60);
    this.chunks.setBlockMeta(x, y, z, null);
    this.sound.playBlockPlace(3);
    if (this.gameMode !== 'creative') {
      this.inventory.damageTool(this.player.selectedSlot);
    }
    return true;
  }

  private resetConsumptionProgress() {
    this.eatingTimer = 0;
    this.chewSoundTimer = 0;
  }

  private canConsumeFood(stack: ItemStack): boolean {
    return canConsumeFoodItem(stack, this.player.hunger);
  }

  private continuePotionUse(stack: ItemStack, dt: number) {
    const potion = stack.potion?.effect;
    if (!potion) return { handled: false };

    this.eatingTimer += dt;
    this.chewSoundTimer += dt;
    if (this.chewSoundTimer >= 0.35) {
      this.chewSoundTimer = 0;
      this.sound.playDrink();
    }
    if (this.eatingTimer < 1.6) return { handled: true };

    this.potionEffects.apply(
      potion,
      (amount) => { this.player.health = Math.min(20, this.player.health + amount); },
    );
    // P3.3: Absorption potion grants extra hearts (2 per level).
    if (potion.id === 'absorption') {
      this.player.absorption = 4 * potion.level;
    }
    this.sound.playBurp();
    // P5.2: server-validated consumable use in multiplayer.
    if ((this.isMultiplayerNetworkConnected())) {
      this.network.send(PacketType.C2S_ITEM_CONSUME, {
        slot: this.player.selectedSlot,
        itemId: stack.id,
      });
    } else if (this.gameMode !== 'creative') {
      this.inventory.setSlot(this.player.selectedSlot, { id: GLASS_BOTTLE_ID, count: 1 });
    }
    this.notifyState();
    return { handled: true, completed: true, cooldown: 0.5 };
  }

  private applyChorusFruitTeleport26_3(): boolean {
    const from = this.player.position.clone();
    const destination = findChorusFruitDestination26_3(
      { x: from.x, y: from.y, z: from.z },
      (x, y, z) => this.chunks.getBlock(x, y, z),
      Math.random,
      WORLD_HEIGHT,
    );
    if (!destination) return false;

    const to = new THREE.Vector3(destination.x, destination.y, destination.z);
    this.player.position.copy(to);
    this.player.onGround = false;
    this.particles.spawnTeleportTrail26_3(
      from.clone().add(new THREE.Vector3(0, this.player.eyeHeight * 0.5, 0)),
      to.clone().add(new THREE.Vector3(0, this.player.eyeHeight * 0.5, 0)),
      24,
    );
    this.sound.playNamedEvent26_3('item.chorus_fruit.teleport');
    return true;
  }

  private continueMilkUse(stack: ItemStack, dt: number) {
    this.eatingTimer += dt;
    this.chewSoundTimer += dt;
    if (this.chewSoundTimer >= 0.35) {
      this.chewSoundTimer = 0;
      this.sound.playDrink();
    }
    if (this.eatingTimer < getItemUseDurationSeconds(stack)) return { handled: true };

    this.potionEffects.clear();
    this.player.absorption = 0;
    this.sound.playDrink();
    if (this.isMultiplayerNetworkConnected()) {
      this.network.send(PacketType.C2S_ITEM_CONSUME, {
        slot: this.player.selectedSlot,
        itemId: stack.id,
      });
    } else if (this.gameMode !== 'creative') {
      const remainder = getDefaultUseRemainderItemId(stack.id);
      this.inventory.setSlot(
        this.player.selectedSlot,
        remainder === undefined ? null : { id: remainder, count: 1 },
      );
    }
    this.notifyState();
    return { handled: true, completed: true, cooldown: 0.5 };
  }

  private continueFoodUse(stack: ItemStack, dt: number) {
    const foodDef = ItemRegistry.get(stack.id);
    if (!foodDef || !this.canConsumeFood(stack)) return { handled: false };

    this.eatingTimer += dt;
    this.chewSoundTimer += dt;
    if (this.chewSoundTimer >= 0.25) {
      this.chewSoundTimer = 0;
      this.sound.playEat();

      let foodColor = 0xc0a080;
      const baseFoodId = stack.id & 0x3FF;
      if (baseFoodId === 260) foodColor = 0xff0000;
      else if (baseFoodId === 363 || baseFoodId === 364) foodColor = 0xa04040;
      else if (baseFoodId === 322) foodColor = 0xffd700;
      else if (stack.id === HONEY_BOTTLE_ID) foodColor = 0xe8a300;

      const front = this.player.eyePosition.clone().add(this.player.forward.multiplyScalar(0.4));
      this.particles.spawnBlockBreak(front.x, front.y, front.z, foodColor);
    }
    if (this.eatingTimer < getItemUseDurationSeconds(stack)) return { handled: true };

    this.player.hunger = Math.min(20, this.player.hunger + (foodDef.hungerRestore ?? 0));
    this.player.saturation = Math.min(
      this.player.hunger,
      this.player.saturation + (foodDef.saturationRestore ?? 0),
    );
    for (const effect of stack.foodEffects ?? []) {
      if (effect.id === 'saturation') {
        const saturated = applySaturationStew26_3(this.player.hunger, this.player.saturation);
        this.player.hunger = saturated.hunger;
        this.player.saturation = saturated.saturation;
      } else {
        this.potionEffects.apply(effect, (amount) => {
          this.player.health = Math.min(20, this.player.health + amount);
        });
      }
    }

    const baseFoodId = stack.id & 0x3FF;
    if (baseFoodId === 322) {
      const isEnchanted = (stack.id >> 10) === 1;
      if (isEnchanted) {
        this.potionEffects.apply({ id: 'regeneration', level: 2, duration: 20 }, (amount) => {
          this.player.health = Math.min(20, this.player.health + amount);
        });
        this.potionEffects.apply({ id: 'fire_resistance', level: 1, duration: 300 }, () => {});
        this.player.health = 20;
      } else {
        this.potionEffects.apply({ id: 'regeneration', level: 1, duration: 5 }, (amount) => {
          this.player.health = Math.min(20, this.player.health + amount);
        });
      }
    }

    if (stack.id === HONEY_BOTTLE_ID) {
      this.potionEffects.remove('poison');
    }

    this.sound.playBurp();
    // P5.2: in multiplayer the server validates and deducts consumables.
    if (foodDef.name === 'chorus_fruit') {
      this.applyChorusFruitTeleport26_3();
    }

    if (this.isMultiplayerNetworkConnected()) {
      this.network.send(PacketType.C2S_ITEM_CONSUME, {
        slot: this.player.selectedSlot,
        itemId: stack.id,
      });
    } else if (this.gameMode !== 'creative') {
      const containerItemId = stack.containerItemId ?? getDefaultUseRemainderItemId(stack.id);
      if (containerItemId !== undefined) {
        if (stack.count <= 1) {
          this.inventory.setSlot(this.player.selectedSlot, { id: containerItemId, count: 1 });
        } else {
          this.inventory.removeFromSlot(this.player.selectedSlot);
          this.inventory.addItem(containerItemId, 1);
        }
      } else if (stack.id === HONEY_BOTTLE_ID) {
        if (stack.count <= 1) {
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
    return { handled: true, completed: true, cooldown: 0.5 };
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

  private handleMobDeath(mob: Mob, lootingLevel = 0) {
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

    if (mob.def.type === 'item_frame' && mob.itemFrameItem && this.gameMode !== 'creative') {
      const framed = cloneItemStack(mob.itemFrameItem);
      if (framed) {
        this.droppedItems.spawnStack(
          framed,
          mob.position.clone(),
          new THREE.Vector3((Math.random() - 0.5) * 0.4, 1.0, (Math.random() - 0.5) * 0.4),
          0.25,
        );
      }
    }

    if (mob.def.type === 'armor_stand' && this.gameMode !== 'creative') {
      for (const stack of mob.armorStandEquipment) {
        if (!stack) continue;
        this.droppedItems.spawnStack(
          stack,
          mob.position.clone().add(new THREE.Vector3(0, 0.75, 0)),
          new THREE.Vector3((Math.random() - 0.5) * 0.4, 1.1, (Math.random() - 0.5) * 0.4),
          0.5,
        );
      }
    }

    // Drop items in 3D world (magma cubes only drop if size === 1)
    const isMagmaCube = mob.def.type === 'magma_cube';
    const decorative = mob.def.type === 'armor_stand' || mob.def.type === 'item_frame' || mob.def.type === 'painting';
    const shouldDrop = (!isMagmaCube || mob.size === 1)
      && !(decorative && this.gameMode === 'creative');

    if (shouldDrop) {
      for (const drop of mob.def.drops) {
        // P3.3: Looting applies to living-mob loot, not the Armor Stand item itself.
        const rolls = decorative ? 1 : 1 + lootingLevel;
        for (let roll = 0; roll < rolls; roll++) {
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
      this.sound.playMobSound('wither', 'hurt');
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
    return getAttackCooldownSeconds(itemDef?.toolType, itemDef?.toolMaterial);
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
    sweepDamage: number,
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

    if (this.isMultiplayerNetworkConnected()) {
      const direction = this.player.forward;
      this.network.send(PacketType.C2S_FISHING_ACTION, {
        action: this.fishingBobber ? 'reel' : 'cast',
        itemId: heldItemId,
        dirX: direction.x,
        dirY: direction.y,
        dirZ: direction.z,
      });
      this.placeCooldown = 0.35;
      return true;
    }

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
      this.xp.spawnXP(rollXp(FISHING_XP_RANGE, Math.random), bobber.position.clone());
      this.particles.spawnXP(bobber.position.x, bobber.position.y, bobber.position.z, 8);
      this.sound.playPickup();
      if (this.gameMode !== 'creative') this.inventory.damageTool(this.player.selectedSlot);
    } else if (bobber.phase === 'waiting' && !Number.isFinite(bobber.waitTimer)) {
      this.sound.playLever();
      if (this.gameMode !== 'creative') {
        this.inventory.damageTool(this.player.selectedSlot);
        this.inventory.damageTool(this.player.selectedSlot);
      }
    } else {
      this.sound.playLever();
    }

    this.clearFishingBobber();
  }

  private updateFishingBobber(dt: number) {
    const bobber = this.fishingBobber;
    if (!bobber) return;
    if (this.isMultiplayerNetworkConnected()) {
      bobber.mesh.position.copy(bobber.position);
      return;
    }

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

  applyServerFishingState(payload: {
    active: boolean;
    x?: number;
    y?: number;
    z?: number;
    phase?: 'flying' | 'waiting' | 'hooked';
  }) {
    if (!payload.active) {
      this.clearFishingBobber();
      this.notifyState();
      return;
    }
    if (![payload.x, payload.y, payload.z].every(Number.isFinite)) return;

    if (!this.fishingBobber) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 8, 8),
        new THREE.MeshLambertMaterial({ color: 0xfff2e5, emissive: 0x220000 }),
      );
      const position = new THREE.Vector3(payload.x!, payload.y!, payload.z!);
      this.fishingBobber = {
        mesh,
        position,
        velocity: new THREE.Vector3(),
        phase: payload.phase ?? 'flying',
        waitTimer: 0,
        hookedTimer: 0,
      };
      mesh.position.copy(position);
      this.renderer.scene.add(mesh);
    }

    const bobber = this.fishingBobber;
    const previousPhase = bobber.phase;
    bobber.position.set(payload.x!, payload.y!, payload.z!);
    bobber.phase = payload.phase ?? bobber.phase;
    bobber.mesh.position.copy(bobber.position);
    if (previousPhase !== bobber.phase) {
      this.disposeFishingBobberMaterial(bobber.mesh);
      bobber.mesh.material = new THREE.MeshLambertMaterial({
        color: bobber.phase === 'hooked' ? 0xff3333 : 0xfff2e5,
        emissive: bobber.phase === 'hooked' ? 0x440000 : 0x220000,
      });
    }
    this.notifyState();
  }

  private rollFishingLoot(): number {
    // P2.7: data-driven fishing loot table (weights mirror 1.20.1 odds).
    const drops = rollLootTable(FISHING_LOOT_TABLE, Math.random);
    return drops.length > 0 ? drops[0].itemId : RAW_FISH_ID;
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

  private handlePotionSplash(
    pos: THREE.Vector3,
    fromPlayer: boolean,
    damage: number,
    effect?: PotionEffectData,
    variant?: 'splash' | 'lingering',
  ) {
    this.particles.spawnBlockBreak(pos.x, pos.y, pos.z, 0x8a2be2, 35);
    this.sound.playBlockBreak(0); // Default break sound category (stone) for potion splash

    // P3.4: player-thrown potions apply their own effect in a radius.
    if (effect) {
      this.applyPotionSplashEffect(pos, effect, variant === 'lingering');
      return;
    }

    // Witch potions (no effect data): poison or instant damage.
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

  /**
   * P3.4 — apply a thrown potion's effect in a radius. Lingering potions also
   * spawn an area cloud that re-applies the effect while it lasts.
   */
  private applyPotionSplashEffect(pos: THREE.Vector3, effect: PotionEffectData, lingering: boolean) {
    const radius = lingering ? 4 : 3.5;
    const distToPlayer = this.player.position.distanceTo(pos);
    if (distToPlayer <= radius && this.gameMode !== 'creative') {
      this.potionEffects.apply(effect, (amount) => {
        this.player.health = Math.min(20, this.player.health + amount);
      });
    }
    for (const mob of this.mobs.mobs.values()) {
      if (mob.position.distanceTo(pos) > radius) continue;
      // Harmful effects damage mobs; beneficial effects are ignored (1.20.1
      // undead-inversion is out of scope).
      if (effect.id === 'poison' || effect.id === 'wither') {
        mob.takeDamage(effect.level);
      }
    }
    if (lingering) {
      this.lingeringClouds.push({
        pos: pos.clone(),
        effect: { ...effect },
        remaining: Math.max(5, Math.ceil(effect.duration / 4)),
        tickTimer: 0,
      });
    }
  }

  private throwPotion(stack: ItemStack) {
    const origin = this.player.eyePosition.clone();
    const direction = this.player.forward.clone();
    // P5.1: multiplayer splash potions spawn server-side.
    if (this.sendItemAction({ action: 'throw', itemId: stack.id, potionEffect: stack.potion?.effect })) {
      this.sound.playBowShoot(1);
      return;
    }
    this.projectiles.shootPotion(origin, direction, true, 2, stack.potion?.effect, stack.potion?.variant as 'splash' | 'lingering');
    if (this.gameMode !== 'creative') {
      this.inventory.removeItem(stack.id, 1);
    }
    this.sound.playBowShoot(1);
    this.notifyState();
  }

  private tryShatterDecoratedPotFromProjectile(pos: THREE.Vector3): boolean {
    if (this.isMultiplayerNetworkConnected() || !this.gamerules.getRule('projectilesCanBreakBlocks')) return false;
    const x = Math.floor(pos.x);
    const y = Math.floor(pos.y);
    const z = Math.floor(pos.z);
    const blockId = this.chunks.getBlock(x, y, z);
    if (BlockRegistry.get(blockId)?.name !== 'decorated_pot') return false;

    const meta = this.chunks.getBlockMeta(x, y, z);
    for (const stack of meta?.inventory ?? []) {
      if (!stack || stack.count <= 0) continue;
      this.droppedItems.spawnStack(
        stack,
        new THREE.Vector3(x + 0.5, y + 0.6, z + 0.5),
        new THREE.Vector3((Math.random() - 0.5) * 0.8, 1.1, (Math.random() - 0.5) * 0.8),
        0.35,
      );
    }
    for (const ingredient of decoratedPotDecorationStacks(meta?.potDecorations)) {
      this.droppedItems.spawnStack(
        ingredient,
        new THREE.Vector3(x + 0.5, y + 0.55, z + 0.5),
        new THREE.Vector3((Math.random() - 0.5) * 0.8, 1.0, (Math.random() - 0.5) * 0.8),
        0.35,
      );
    }
    this.chunks.setBlock(x, y, z, 0);
    this.chunks.setBlockMeta(x, y, z, null);
    this.redstone.unregister(x, y, z);
    this.redstone.observeBlockChange(x, y, z);
    this.particles.spawnBlockBreak(x + 0.5, y + 0.5, z + 0.5, 0xb46f45, 24);
    this.sound.playBlockBreak(blockId);
    this.notifyState();
    return true;
  }

  private handleThrowableImpact(type: ProjectileType, pos: THREE.Vector3, fromPlayer: boolean) {
    if (this.tryShatterDecoratedPotFromProjectile(pos)) return;
    if (type === 'wind_charge') {
      this.applyWindChargeBurst(pos);
      return;
    }

    if (type === 'experience_bottle') {
      this.particles.spawnXP(pos.x, pos.y, pos.z, 12);
      this.sound.playXP();
      if (!this.isMultiplayerNetworkConnected() && fromPlayer) {
        this.xp.spawnXP(rollXp(EXPERIENCE_BOTTLE_XP_RANGE, Math.random), pos.clone());
      }
      return;
    }

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
        if (chick) {
          chick.isBaby = true;
          chick.babyAge = 240;
          chick.mesh.scale.setScalar(0.5);
        }
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

  private updateMaceFallTracking() {
    if (this.player.flying || this.riddenMob || this.riddenVehicle || this.player.onGround) {
      this.maceFallStartY = null;
      this.maceFallDistance = 0;
      return;
    }
    if (this.player.velocity.y < 0) {
      if (this.maceFallStartY === null) this.maceFallStartY = this.player.position.y;
      this.maceFallDistance = Math.max(this.maceFallDistance, this.maceFallStartY - this.player.position.y);
    }
  }

  private applyLocalMaceSmash(impact: THREE.Vector3, fallDistance: number, struckMobId: number) {
    this.player.velocity.y = 0;
    this.survival.resetFall();
    this.maceFallStartY = null;
    this.maceFallDistance = 0;
    this.sound.playMaceSmash(fallDistance > MACE_HEAVY_SMASH_THRESHOLD);
    this.particles.spawnBlockBreak(impact.x, impact.y, impact.z, 0x9aa6ad, fallDistance > 5 ? 34 : 22);

    for (const mob of this.mobs.mobs.values()) {
      if (mob.id === struckMobId || mob.health <= 0) continue;
      const impulse = getMaceSmashImpulse(impact, mob.position, fallDistance);
      if (Math.abs(impulse.x) + Math.abs(impulse.y) + Math.abs(impulse.z) <= 1e-6) continue;
      mob.velocity.add(new THREE.Vector3(impulse.x, impulse.y, impulse.z));
    }
  }

  private applyWindChargeBurst(pos: THREE.Vector3) {
    this.particles.spawnBlockBreak(pos.x, pos.y, pos.z, 0xd8f7f8, 28);
    this.sound.playWindBurst();

    const playerImpulse = windBurstImpulse(pos, {
      x: this.player.position.x,
      y: this.player.position.y + 0.9,
      z: this.player.position.z,
    });
    this.player.velocity.add(new THREE.Vector3(playerImpulse.x, playerImpulse.y, playerImpulse.z));

    for (const mob of this.mobs.mobs.values()) {
      const impulse = windBurstImpulse(pos, {
        x: mob.position.x,
        y: mob.position.y + mob.height * 0.5,
        z: mob.position.z,
      });
      if (Math.abs(impulse.x) + Math.abs(impulse.y) + Math.abs(impulse.z) <= 1e-6) continue;
      mob.velocity.add(new THREE.Vector3(impulse.x, impulse.y, impulse.z));
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
      this.damagePlayer(damage, 'explosion', knockback);
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
        this.scheduleWorldTick('fluid', nx, ny, nz, 5, 'adjacent_block_change');
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

  private updateShieldBlockingState(dt: number) {
    const selected = this.inventory.getSlot(this.player.selectedSlot);
    const wantsToBlock = !this.bowChargeActive &&
      !this.isBowStack(selected) &&
      !this.chatOpen &&
      this.openUI === 'none' &&
      this.input.isMouseDown(2) &&
      this.shieldDisableTimer <= 0 &&
      this.getActiveShieldSlot() !== null;

    if (wantsToBlock) {
      this.shieldUseTimer += dt;
    } else {
      this.shieldUseTimer = 0;
    }

    if (wantsToBlock !== this.isShieldBlocking) {
      this.isShieldBlocking = wantsToBlock;
      this.notifyState();
    }
  }

  private isBowStack(stack: ItemStack | null | undefined): stack is ItemStack {
    if (!stack) return false;
    const def = ItemRegistry.get(stack.id);
    return def?.behaviorId === 'minecraft:bow';
  }

  private getBowAmmoItemId(): number | null {
    const arrowNames = ['arrow', 'spectral_arrow', 'tipped_arrow'];
    for (const name of arrowNames) {
      const id = ItemRegistry.getByName(name)?.id;
      if (id !== undefined && this.inventory.countItem(id) > 0) return id;
    }
    return null;
  }

  private canUseBow(): boolean {
    return this.gameMode === 'creative' || this.getBowAmmoItemId() !== null;
  }

  private getBowPower(chargeTime: number): number {
    return getJavaBowPower(chargeTime);
  }

  private getItemInteractionContext(stack: ItemStack): GameItemInteractionContext | null {
    const item = ItemRegistry.get(stack.id);
    if (!item) return null;
    return {
      item,
      stack,
      target: this.getTargetBlockInteractionContext(stack),
    };
  }

  private resetBrushUseProgress() {
    const active = this.activeBrushTarget;
    if (active && !this.isMultiplayerNetworkConnected()) {
      const meta = this.chunks.getBlockMeta(active.x, active.y, active.z);
      if (meta?.archaeologyProgress) {
        this.chunks.setBlockMeta(
          active.x,
          active.y,
          active.z,
          { ...meta, archaeologyProgress: 0 },
          true,
        );
      }
    }
    this.activeBrushTarget = null;
    this.brushLastStage = 0;
  }

  private continueBrushUse(
    stack: ItemStack,
    target: BlockInteractionContext | undefined,
    elapsedSeconds: number,
  ) {
    const active = this.activeBrushTarget;
    if (!active || !target || !isSuspiciousBlockName(target.block.name)) {
      return { handled: true, completed: true };
    }
    const { x, y, z } = target.position;
    if (archaeologyTargetKey(x, y, z) !== active.key) {
      return { handled: true, completed: true };
    }

    const stage = archaeologyBrushStage(elapsedSeconds);
    if (stage > this.brushLastStage) {
      this.brushLastStage = stage;
      this.sound.playBrush(target.block.name as 'suspicious_sand' | 'suspicious_gravel');
      this.particles.spawnBlockBreak(x + 0.5, y + 0.5, z + 0.5, target.block.name === 'suspicious_gravel' ? 0x8b8181 : 0xd9bd8c, 4);
      if (!this.isMultiplayerNetworkConnected()) {
        const meta = this.chunks.getBlockMeta(x, y, z) ?? {};
        this.chunks.setBlockMeta(x, y, z, { ...meta, archaeologyProgress: stage }, true);
      }
    }

    if (!isBrushExcavationComplete(elapsedSeconds)) return { handled: true };
    return {
      handled: this.completeBrushExcavation(stack, target),
      completed: true,
      cooldown: 0.1,
    };
  }

  private completeBrushExcavation(stack: ItemStack, target: BlockInteractionContext): boolean {
    const { x, y, z } = target.position;
    const currentId = this.chunks.getBlock(x, y, z);
    const current = BlockRegistry.get(currentId);
    const replacementName = brushedReplacementName(current?.name);
    if (!replacementName) return false;

    if (this.isMultiplayerNetworkConnected()) {
      this.network.send(PacketType.C2S_BRUSH_ACTION, {
        action: 'complete',
        itemId: stack.id,
        x,
        y,
        z,
      });
      return true;
    }

    const replacement = BlockRegistry.getByName(replacementName);
    if (!replacement) return false;
    const meta = this.chunks.getBlockMeta(x, y, z);
    this.chunks.setBlock(x, y, z, replacement.id);
    this.chunks.setBlockMeta(x, y, z, null, true);

    const lootCount = normalizeArchaeologyLootCount(meta?.archaeologyLootCount);
    if (meta?.archaeologyNatural && meta.archaeologyLootItemId && lootCount > 0) {
      this.droppedItems.spawnItem(
        meta.archaeologyLootItemId,
        lootCount,
        new THREE.Vector3(x + 0.5, y + 0.65, z + 0.5),
        new THREE.Vector3(0, 0.8, 0),
        0.25,
      );
    }
    if (this.gameMode !== 'creative') this.inventory.damageTool(this.player.selectedSlot, 1);
    this.sound.playBrush(current!.name as 'suspicious_sand' | 'suspicious_gravel');
    this.particles.spawnBlockBreak(x + 0.5, y + 0.5, z + 0.5, current!.name === 'suspicious_gravel' ? 0x8b8181 : 0xd9bd8c, 18);
    this.notifyState();
    return true;
  }

  private setSpyglassActive(active: boolean) {
    const nextFov = spyglassFov(70, active);
    if (Math.abs(this.renderer.camera.fov - nextFov) > 1e-6) {
      this.renderer.camera.fov = nextFov;
      this.renderer.camera.updateProjectionMatrix();
    }
  }

  private stopActiveItemUse(reason: ItemUseStopReason): boolean {
    const active = this.activeItemUse;
    if (!active) return false;
    this.activeItemUse = null;

    const selected = this.inventory.getSlot(this.player.selectedSlot);
    const stillSelected = this.player.selectedSlot === active.slotIndex && selected?.id === active.itemId;
    const stack = stillSelected && selected ? selected : active.stackSnapshot;
    const context = this.getItemInteractionContext(stack);
    if (!context) return false;

    const result = this.behaviors.stopItemUse(context, {
      deltaSeconds: 0,
      elapsedSeconds: active.elapsedSeconds,
      reason,
      stillSelected,
    });
    if (result?.cooldown !== undefined) {
      this.placeCooldown = Math.max(this.placeCooldown, result.cooldown);
    }
    return result?.handled ?? false;
  }

  private updateContinuousItemUse(dt: number): boolean {
    const selected = this.inventory.getSlot(this.player.selectedSlot);
    const context = selected ? this.getItemInteractionContext(selected) : null;
    const behavior = context ? this.behaviors.getItemBehavior(context.item) : undefined;
    const targetPreventsUse = context?.target
      ? this.behaviors.preventsItemUse(context.target)
      : false;
    const rightDown = !this.chatOpen && this.openUI === 'none' && this.input.isMouseDown(2);
    const canContinue = !!context && !!behavior?.continueUse && rightDown && !targetPreventsUse;

    if (this.activeItemUse && (
      !canContinue ||
      !selected ||
      selected.id !== this.activeItemUse.itemId ||
      this.player.selectedSlot !== this.activeItemUse.slotIndex
    )) {
      const reason: ItemUseStopReason = !rightDown
        ? 'released'
        : targetPreventsUse
          ? 'blocked'
          : 'switched';
      this.stopActiveItemUse(reason);
    }

    if (!canContinue || !context || !selected || !behavior?.continueUse) return false;

    if (!this.activeItemUse) {
      if (!this.behaviors.canStartItemUse(context)) return false;
      const startResult = this.behaviors.startItemUse(context) ?? { handled: true };
      if (!startResult.handled) return false;
      this.activeItemUse = {
        itemId: selected.id,
        slotIndex: this.player.selectedSlot,
        elapsedSeconds: 0,
        stackSnapshot: structuredClone(selected),
      };
    }

    const activeUse = this.activeItemUse;
    if (!activeUse) return false;
    activeUse.elapsedSeconds += dt;
    const result = this.behaviors.continueItemUse(context, {
      deltaSeconds: dt,
      elapsedSeconds: activeUse.elapsedSeconds,
    }) ?? { handled: false };
    if (result.cooldown !== undefined) {
      this.placeCooldown = Math.max(this.placeCooldown, result.cooldown);
    }
    if (result.completed) {
      this.stopActiveItemUse('completed');
    }
    return result.handled;
  }

  private releaseBowCharge(stillHoldingBow: boolean) {
    const chargeTime = this.bowChargeTimer;
    this.bowChargeActive = false;
    this.bowChargeTimer = 0;

    if (!stillHoldingBow || !canReleaseBow(chargeTime) || !this.canUseBow()) {
      this.notifyState();
      return;
    }

    const power = this.getBowPower(chargeTime);
    if (this.gameMode !== 'creative') {
      const ammoId = this.getBowAmmoItemId();
      if (ammoId === null) {
        this.notifyState();
        return;
      }
      // P5.1: in multiplayer the server consumes the arrow and spawns it.
      if (this.isMultiplayerNetworkConnected()) {
        const bowStack = this.inventory.getSlot(this.player.selectedSlot);
        const powerBonus = EnchantSystem.getPowerMultiplier(EnchantSystem.getLevel(bowStack, 'power')) - 1;
        this.network.send(PacketType.C2S_ITEM_ACTION, {
          action: 'bow_release',
          itemId: bowStack?.id ?? 0,
          power,
          damageBonus: powerBonus,
          dirX: this.player.forward.x,
          dirY: this.player.forward.y,
          dirZ: this.player.forward.z,
        });
        this.sound.playBowShoot(power);
        this.swordSwingTimer = Math.max(0.2, 0.9 * power);
        this.notifyState();
        return;
      }
      this.inventory.removeItem(ammoId, 1);
      this.inventory.damageTool(this.player.selectedSlot);
    }

    const bowStack = this.inventory.getSlot(this.player.selectedSlot);
    this.projectiles.shootArrow(
      this.player.eyePosition.clone(),
      this.player.forward.clone(),
      true,
      Math.max(1, BOW_BASE_DAMAGE * power) * EnchantSystem.getPowerMultiplier(
        EnchantSystem.getLevel(bowStack, 'power')
      ),
      THREE.MathUtils.lerp(BOW_MIN_SPEED, BOW_MAX_SPEED, power),
      EnchantSystem.getLevel(bowStack, 'flame') > 0,
      EnchantSystem.getLevel(bowStack, 'punch'),
    );
    this.sound.playBowShoot(power);
    this.swordSwingTimer = Math.max(0.2, 0.9 * power);
    this.notifyState();
  }

  private fireLoadedCrossbow(stack: ItemStack): boolean {
    if (!stack.chargedProjectileId) return false;

    this.projectiles.shootArrow(
      this.player.eyePosition.clone(),
      this.player.forward.clone(),
      true,
      9,
      32,
    );
    delete stack.chargedProjectileId;
    if (this.gameMode !== 'creative') {
      this.inventory.damageTool(this.player.selectedSlot);
    }
    this.sound.playBowShoot(1);
    this.swordSwingTimer = Math.max(this.swordSwingTimer, 0.35);
    this.notifyState();
    return true;
  }

  private isShieldStack(stack: ItemStack | null | undefined): stack is ItemStack {
    if (!stack) return false;
    const def = ItemRegistry.get(stack.id);
    return stack.id === SHIELD_ID || def?.behaviorId === 'minecraft:shield';
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

    const durabilityCost = getBlockedShieldDurabilityDamage(amount);
    if (durabilityCost <= 0) return;

    shield.stack.durability ??= SHIELD_MAX_DURABILITY;
    for (let point = 0; point < durabilityCost; point++) {
      if (!EnchantSystem.shouldUseDurability(shield.stack)) continue;
      shield.stack.durability -= 1;
      if (shield.stack.durability <= 0) break;
    }

    if (shield.stack.durability <= 0) {
      if (shield.source === 'mainhand') {
        this.inventory.setSlot(this.player.selectedSlot, null);
      } else {
        this.inventory.setOffhand(null);
      }
      this.isShieldBlocking = false;
      this.shieldUseTimer = 0;
      this.sound.playBlockBreak(5);
    }
  }

  private canShieldBlock(type: PlayerDamageKind, knockback?: THREE.Vector3): boolean {
    if (!shieldCanBlockDamage(type)) return false;
    if (!isShieldBlockActive(this.shieldUseTimer, this.shieldDisableTimer)) return false;
    if (!knockback || knockback.lengthSq() === 0) return false;
    const facing = this.player.forward.clone().setY(0);
    const sourceToPlayer = knockback.clone().setY(0);
    if (facing.lengthSq() === 0 || sourceToPlayer.lengthSq() === 0) return false;
    return shieldFacesSource(facing.x, facing.z, sourceToPlayer.x, sourceToPlayer.z);
  }

  private applyTotemEffects(playSound = true) {
    this.player.health = 1;
    this.potionEffects.clear();
    this.player.absorption = 0;

    for (const effect of TOTEM_OF_UNDYING_EFFECTS) {
      this.potionEffects.apply(effect, (amount) => {
        this.player.health = Math.min(20, this.player.health + amount);
      });
      if (effect.id === 'absorption') {
        this.player.absorption = 4 * effect.level;
      }
    }

    if (playSound) this.sound.playTotemUse();
    this.particles.spawnBlockBreak(
      this.player.position.x,
      this.player.position.y + 1,
      this.player.position.z,
      0xf2d64b,
      36,
    );
  }

  private tryActivateHeldTotem(type: PlayerDamageKind, resultingHealth: number): boolean {
    if (!shouldActivateTotem(type, resultingHealth)) return false;

    const selected = this.inventory.getSlot(this.player.selectedSlot);
    const offhand = this.inventory.getOffhand();
    const hand = findHeldTotemHand(
      selected,
      offhand,
      (itemId) => ItemRegistry.get(itemId)?.name,
    );
    if (!hand) return false;

    if (hand === 'mainhand') {
      this.inventory.setSlot(this.player.selectedSlot, consumeTotemStack(selected));
    } else {
      this.inventory.setOffhand(consumeTotemStack(offhand));
    }

    this.applyTotemEffects(true);
    this.notifyState();
    return true;
  }

  /** Apply the server-authoritative Totem effects after inventory/health sync. */
  applyServerTotemActivation() {
    this.applyTotemEffects(false);
    this.notifyState();
  }

  damagePlayer(
    amount: number,
    type: PlayerDamageKind,
    knockback?: THREE.Vector3,
    attacker?: Mob
  ) {
    if (this.gameMode === 'creative' || this.spawnProtectionTimer > 0) return;

    if (this.canShieldBlock(type, knockback)) {
      this.damageActiveShield(amount);
      // Direct melee/projectiles lose their knockback when blocked;
      // explosions retain only the project's reduced shielded impulse.
      if (type === 'explosion' && knockback) {
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

    const hurtResult = resolveHurtDamage(this.hurtCooldown, amount);
    this.hurtCooldown = hurtResult.next;
    if (!hurtResult.accepted || hurtResult.appliedDamage <= 0) return;
    const effectiveRawDamage = hurtResult.appliedDamage;

    // P3.3: Thorns reflects damage back to the attacking mob.
    if (attacker && (type === 'mob' || type === 'projectile')) {
      const thornsLevel = this.inventory.armor.reduce((max, item) => Math.max(max, EnchantSystem.getLevel(item, 'thorns')), 0);
      if (thornsLevel > 0 && Math.random() < EnchantSystem.getThornsChance(thornsLevel)) {
        attacker.takeDamage(EnchantSystem.getThornsDamage(thornsLevel));
      }
    }

    const protectionLevels = this.inventory.armor.reduce((totals, item) => {
      totals.protection += EnchantSystem.getLevel(item, 'protection');
      totals.fireProtection += EnchantSystem.getLevel(item, 'fire_protection');
      totals.blastProtection += EnchantSystem.getLevel(item, 'blast_protection');
      totals.projectileProtection += EnchantSystem.getLevel(item, 'projectile_protection');
      totals.featherFalling += EnchantSystem.getLevel(item, 'feather_falling');
      return totals;
    }, {
      protection: 0,
      fireProtection: 0,
      blastProtection: 0,
      projectileProtection: 0,
      featherFalling: 0,
    });

    const defense = this.inventory.getTotalArmorDefense();
    const toughness = this.inventory.getTotalArmorToughness();
    let finalDamage = applyDamageProtection(effectiveRawDamage, type, defense, toughness, protectionLevels);

    // Starvation is tagged bypasses_effects in Java; other project damage kinds
    // are reduced by Resistance after the armor-dependent calculation.
    if (type !== 'starve') {
      finalDamage *= 1 - PotionEffects.getResistanceReduction(this.potionEffects.getLevel('resistance'));
    }

    if (baseArmorApplies(type) && defense > 0 && finalDamage > 0) {
      this.inventory.damageArmor(effectiveRawDamage);
    }

    // P3.3: Absorption absorbs damage before health.
    if (this.player.absorption > 0) {
      const absorbed = Math.min(this.player.absorption, finalDamage);
      this.player.absorption -= absorbed;
      finalDamage = Math.max(0, finalDamage - absorbed);
    }

    const resultingHealth = Math.max(0, this.player.health - Math.max(0, finalDamage));
    const totemActivated =
      !this.network.isConnected &&
      this.tryActivateHeldTotem(type, resultingHealth);
    if (!totemActivated) {
      this.player.health = resultingHealth;
    }

    if (knockback) {
      this.player.velocity.add(knockback);
    }

    this.damageFlashTimer = 0.3;
    if (!totemActivated) this.sound.playHurt();

    this.particles.spawnDamageParticles(
      this.player.position.x,
      this.player.position.y + 1,
      this.player.position.z
    );

    if (this.player.health <= 0 && !this.network.isConnected) {
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
      if (trimmed.startsWith('/') && this.activeSlot !== 'multiplayer') {
        const result = this.commands.execute(trimmed);
        this.chatMessages.push(result.message);
      } else if (this.isMultiplayerNetworkConnected()) {
        this.network.send(PacketType.C2S_CHAT, { text: trimmed });
      } else {
        this.chatMessages.push(`<Player> ${trimmed}`);
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

  addChatMessage(formatted: string) {
    this.chatMessages.push(formatted);
    if (this.chatMessages.length > 50) {
      this.chatMessages = this.chatMessages.slice(-50);
    }
    this.notifyState();
  }

  private notifyState() {
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

    if (this.openMapSlot !== null) {
      const openMapStack = this.inventory.getSlot(this.openMapSlot);
      if (openMapStack?.map) {
        openMapStack.map = this.maps.updatePlayerMarker(
          openMapStack.map,
          this.player.position.x,
          this.player.position.z,
          THREE.MathUtils.radToDeg(this.player.yaw),
        );
      }
    }

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
      absorption: this.player.absorption,
      damageFlash: normalizeDamageFlash(this.damageFlashTimer),
      networkStatus: this.network?.getStatus() ?? 'idle',
      onGround: this.player.onGround,
      flying: this.player.flying,
      openUI: this.openUI,
      inventory: this.inventory,
      chestInventory: this.getOpenChestInventory(),
      serverContainerCursor: this.serverContainerCursor,
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
      improvedTransparency26_3: this.renderer.getImprovedTransparencyState26_3(),
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

    // 2. Preserve entities and safely unload old dimension meshes
    this.snapshotCurrentDimensionMobs();
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
    this.restoreCurrentDimensionMobs();
    this.player.resolveStuck(this.chunks);

    // Play portal teleport sound
    this.sound.playPickup();
    this.advancements.checkDimensionChange(this.chunks.currentDimension);
    this.notifyState();
  }

  private teleportToEnd() {
    this.snapshotCurrentDimensionMobs();
    this.chunks.unloadAllMeshes();
    this.mobs.dispose();
    this.riddenVehicle = null;
    this.vehicles.dispose();

    this.chunks.currentDimension = Dimension.End;
    this.player.position.set(0.5, 65.2, 0.5);
    this.player.velocity.set(0, 0, 0);

    this.chunks.update(this.player.position.x, this.player.position.z);
    this.restoreCurrentDimensionMobs();
    this.player.resolveStuck(this.chunks);

    this.sound.playPickup();
    this.advancements.checkDimensionChange(2);
    this.notifyState();
  }

  private teleportFromEndToOverworld() {
    this.snapshotCurrentDimensionMobs();
    this.chunks.unloadAllMeshes();
    this.mobs.dispose();
    this.riddenVehicle = null;
    this.vehicles.dispose();

    this.chunks.currentDimension = Dimension.Overworld;
    const spawn = this.findSafeWorldSpawnPosition();
    this.player.position.copy(spawn);
    this.player.velocity.set(0, 0, 0);

    this.chunks.update(this.player.position.x, this.player.position.z);
    this.restoreCurrentDimensionMobs();
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
    this.snapshotCurrentDimensionMobs();
    const dimensions: SaveData['dimensions'] = {
      0: { chunks: [], mobs: [...(this.savedMobsByDimension[0] ?? [])] },
      1: { chunks: [], mobs: [...(this.savedMobsByDimension[1] ?? [])] },
      2: { chunks: [], mobs: [...(this.savedMobsByDimension[2] ?? [])] },
    };
    for (const [, chunk] of this.chunks.overworldChunks) {
      dimensions[0]!.chunks.push({
        cx: chunk.cx,
        cz: chunk.cz,
        data: new Uint16Array(chunk.data),
        metadata: chunk.serializeMetadata(),
      });
    }
    for (const [, chunk] of this.chunks.netherChunks) {
      dimensions[1]!.chunks.push({
        cx: chunk.cx,
        cz: chunk.cz,
        data: new Uint16Array(chunk.data),
        metadata: chunk.serializeMetadata(),
      });
    }
    for (const [, chunk] of this.chunks.endChunks) {
      dimensions[2]!.chunks.push({
        cx: chunk.cx,
        cz: chunk.cz,
        data: new Uint16Array(chunk.data),
        metadata: chunk.serializeMetadata(),
      });
    }

    const saveData: SaveData = {
      schemaVersion: SAVE_SCHEMA_VERSION,
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
      dimensions,
      endDragonDefeated: this.enderDragon.getState().defeated,
      endDragonHealth: this.enderDragon.getHealthForSave(),
      gamerules: this.gamerules.toJSON(),
      advancements: this.advancements.getUnlockedList(),
      simulationTick: this.worldTickScheduler.getCurrentTick(),
      scheduledBlockTicks: this.worldTickScheduler.getPendingTicks(),
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
        this.isSavedSpawnColumnStale(data.dimensions[0]?.chunks, data.player.x, data.player.z, this.chunks.currentDimension) ||
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
      this.worldTickScheduler.restore(data.simulationTick ?? 0, data.scheduledBlockTicks ?? []);
      this.farmingSimulationSequence = Math.floor((data.simulationTick ?? 0) / 20);
      this.farmingTickAccumulator = (data.simulationTick ?? 0) % 20;
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

      this.chunks.overworldChunks.clear();
      this.chunks.netherChunks.clear();
      this.chunks.endChunks.clear();
      for (const dimension of [0, 1, 2] as const) {
        for (const chunk of data.dimensions[dimension]?.chunks ?? []) {
          if (migratedLegacySpawn && this.isChunkNearPlayerSpawn(chunk.cx, chunk.cz, dimension)) continue;
          this.chunks.restoreChunk(chunk.cx, chunk.cz, chunk.data, chunk.metadata, dimension);
        }
      }
      this.restoreScheduledCampfireTicks();

      this.savedMobsByDimension = {
        0: [...(data.dimensions[0]?.mobs ?? [])],
        1: [...(data.dimensions[1]?.mobs ?? [])],
        2: [...(data.dimensions[2]?.mobs ?? [])],
      };

      if (migratedLegacySpawn) {
        this.chunks.update(this.player.position.x, this.player.position.z);
        this.player.position.y = this.findSafeYInLoadedWorld(this.player.position.x, this.player.position.z) + 2;
      }

      this.restoreRedstoneFromLoadedChunks();
      this.chunks.update(this.player.position.x, this.player.position.z);
      this.restoreCurrentDimensionMobs();
      this.player.resolveStuck(this.chunks);
      this.spawnProtectionTimer = 3;

      if (data.recovery?.recovered && data.recovery.warnings.length) {
        console.warn('Save recovered with warnings:', data.recovery.warnings);
      } else if (data.recovery?.warnings.length) {
        console.info('Save migrated:', data.recovery.warnings);
      }
      console.log(`Game loaded from save schema v${data.schemaVersion}`);
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

  private isSavedSpawnColumnStale(chunks: SavedChunk[] | undefined, x: number, z: number, dimension: Dimension): boolean {
    if (!chunks || dimension !== Dimension.Overworld) return false;
    if (Math.hypot(x - WORLD_SPAWN_X, z - WORLD_SPAWN_Z) > 32) return false;

    const wx = Math.floor(x);
    const wz = Math.floor(z);
    const expectedTerrainY = this.chunks.getWorldGen().getTerrainHeight(wx, wz);
    if (expectedTerrainY <= SEA_LEVEL + 1 || expectedTerrainY < 0 || expectedTerrainY >= WORLD_HEIGHT) return false;

    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const chunk = chunks.find((c) => c.cx === cx && c.cz === cz);
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

  private snapshotCurrentDimensionMobs() {
    const dimension = this.chunks.currentDimension as SaveDimensionId;
    this.savedMobsByDimension[dimension] = this.mobs.serialize(dimension);
  }

  private restoreCurrentDimensionMobs() {
    const dimension = this.chunks.currentDimension as SaveDimensionId;
    this.mobs.restore(this.savedMobsByDimension[dimension], dimension);
  }

  completeEndPoem() {
    this.openUI = 'none';
    this.teleportFromEndToOverworld();
    this.input.requestLock();
    this.lockCooldown = 0.5;
    this.notifyState();
  }

  private throwEnderEye() {
    const held = this.inventory.getSlot(this.player.selectedSlot);
    if (held?.id === ENDER_EYE_ID && this.sendItemAction({ action: 'ender_eye_throw', itemId: held.id })) {
      this.placeCooldown = 0.5;
      return;
    }

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

  /** P5.1 — in multiplayer, ask the server to spawn the projectile. */
  private sendItemAction(payload: Record<string, unknown>): boolean {
    if (!this.isMultiplayerNetworkConnected()) return false;
    const dir = this.player.forward;
    this.network.send(PacketType.C2S_ITEM_ACTION, {
      ...payload,
      dirX: dir.x,
      dirY: dir.y,
      dirZ: dir.z,
    });
    return true;
  }

  bundleInventoryAction(
    action: 'insert_from_slot' | 'extract_to_inventory',
    bundleSlot: number,
    sourceSlot?: number,
    selectedIndex = 0,
  ): boolean {
    if (!this.isMultiplayerNetworkConnected()) return false;
    this.network.send(PacketType.C2S_BUNDLE_ACTION, {
      action,
      bundleSlot,
      sourceSlot,
      selectedIndex,
    });
    return true;
  }

  private tryEmptyBundleInHand(stack: ItemStack): boolean {
    const result = removeOneFromBundle(stack, 0);
    if (!result.removed) return false;

    if (this.isMultiplayerNetworkConnected()) {
      this.network.send(PacketType.C2S_BUNDLE_ACTION, {
        action: 'drop_one',
        bundleSlot: this.player.selectedSlot,
        selectedIndex: 0,
      });
      return true;
    }

    this.inventory.setSlot(this.player.selectedSlot, result.bundle);
    const origin = this.player.eyePosition.clone().add(this.player.forward.clone().multiplyScalar(0.65));
    const velocity = this.player.forward.clone().multiplyScalar(3.2);
    velocity.y += 1.0;
    this.droppedItems.spawnStack(result.removed, origin, velocity, 0.25);
    this.sound.playBundleDrop();
    this.notifyState();
    return true;
  }

  private tryThrowWindCharge(heldItemId: number): boolean {
    if (ItemRegistry.get(heldItemId)?.name !== 'wind_charge') return false;
    if (this.windChargeCooldown > 0) return true;

    this.windChargeCooldown = WIND_CHARGE_COOLDOWN_SECONDS;
    if (this.sendItemAction({ action: 'throw', itemId: heldItemId })) {
      this.sound.playWindChargeThrow();
      return true;
    }

    const origin = this.player.eyePosition.clone().add(this.player.forward.clone().multiplyScalar(0.35));
    this.projectiles.shootWindCharge(origin, this.player.forward, true, WIND_CHARGE_DIRECT_DAMAGE);
    this.sound.playWindChargeThrow();
    if (this.gameMode !== 'creative') {
      this.inventory.removeFromSlot(this.player.selectedSlot, 1);
    }
    this.notifyState();
    return true;
  }

  private tryThrowHeldProjectile(heldItemId: number): boolean {
    if (
      heldItemId !== SNOWBALL_ID &&
      heldItemId !== EGG_ID &&
      heldItemId !== ENDER_PEARL_ID &&
      heldItemId !== TRIDENT_ID &&
      heldItemId !== FIREWORK_ROCKET_ID &&
      heldItemId !== MODERN_FIREWORK_ROCKET_ID &&
      heldItemId !== EXPERIENCE_BOTTLE_ID &&
      ItemRegistry.get(heldItemId)?.name !== 'experience_bottle'
    ) {
      return false;
    }

    if (heldItemId === EXPERIENCE_BOTTLE_ID || ItemRegistry.get(heldItemId)?.name === 'experience_bottle') {
      if (this.sendItemAction({ action: 'throw', itemId: heldItemId })) {
        this.sound.playLever();
        this.placeCooldown = 0.35;
        return true;
      }
      const origin = this.player.eyePosition.clone().add(this.player.forward.clone().multiplyScalar(0.35));
      this.projectiles.shootExperienceBottle(origin, this.player.forward, true);
      this.sound.playLever();
      if (this.gameMode !== 'creative') {
        this.inventory.removeFromSlot(this.player.selectedSlot, 1);
      }
      this.placeCooldown = 0.35;
      this.notifyState();
      return true;
    }

    if (heldItemId === FIREWORK_ROCKET_ID || heldItemId === MODERN_FIREWORK_ROCKET_ID) {
      if (this.sendItemAction({ action: 'throw', itemId: heldItemId })) {
        this.sound.playLever();
        this.placeCooldown = 0.4;
        return true;
      }
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
      // P5.1: multiplayer throws spawn server-side.
      if (this.sendItemAction({ action: 'throw', itemId: heldItemId })) {
        this.placeCooldown = 0.7;
        return true;
      }
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
    // P5.1: multiplayer throws spawn server-side.
    if (this.sendItemAction({ action: 'throw', itemId: heldItemId })) {
      this.placeCooldown = type === 'ender_pearl' ? 0.8 : 0.35;
      return true;
    }
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
    return coordinateRandom(this.seed, x, y, z);
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

  private setPlacedBlockMetadata(
    x: number,
    y: number,
    z: number,
    blockId: number,
    facing: BlockFacing,
    placedStack?: ItemStack,
  ) {
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

    if (name.endsWith('_button')) {
      const buttonFacing = facing === 'up' || facing === 'down' ? this.getPlayerHorizontalFacing() : facing;
      this.redstone.register(x, y, z, 'button', buttonFacing);
      this.chunks.setBlockMeta(x, y, z, {
        facing: buttonFacing,
        redstoneType: 'button',
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
      // P3.6: repeaters default to a 1-tick output delay.
      const metadata: Record<string, unknown> = {
        facing,
        redstoneType,
        powered: false,
        signal: 0,
        extended: false,
      };
      if (redstoneType === 'repeater') {
        metadata.delayTicks = 1;
        this.redstone.setRepeaterDelay(x, y, z, 1);
      }
      this.chunks.setBlockMeta(x, y, z, metadata as any, true);
      return;
    }

    if (name === 'decorated_pot') {
      this.chunks.setBlockMeta(x, y, z, createDecoratedPotMetadata(placedStack, facing), true);
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

    if (name === 'campfire' || name === 'soul_campfire') {
      this.chunks.setBlockMeta(x, y, z, {
        facing,
        campfireItems: new Array(4).fill(null),
        campfireCookTimes: new Array(4).fill(0),
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
        powered: false,
      }, true);
      return;
    }

    if (name.includes('fence_gate')) {
      let gateFacing = facing;
      if (gateFacing === 'up' || gateFacing === 'down') {
        gateFacing = this.getPlayerHorizontalFacing();
      }
      this.chunks.setBlockMeta(x, y, z, {
        facing: gateFacing,
        open: false,
        powered: false,
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

    if (isSignBlockName(name) && !isWallSignBlockName(name)) {
      const rotation = Math.round(((this.player.yaw + Math.PI) * 16) / (2 * Math.PI)) % 16;
      this.chunks.setBlockMeta(x, y, z, createDefaultSignMetadata({ rotation }), true);
      return;
    }

    if (isSignBlockName(name) && isWallSignBlockName(name)) {
      this.chunks.setBlockMeta(x, y, z, createDefaultSignMetadata({ facing }), true);
      return;
    }

    if (name === 'standing_banner') {
      const rotation = Math.round(((this.player.yaw + Math.PI) * 16) / (2 * Math.PI)) % 16;
      this.chunks.setBlockMeta(x, y, z, { rotation }, true);
      return;
    }

    if (name === 'wall_banner') {
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

  private tryUseCampfire(
    x: number,
    y: number,
    z: number,
    selectedSlot: ItemStack | null
  ): boolean {
    if (!selectedSlot) return false;

    const recipe = findSmeltingResult(selectedSlot.id);
    if (!recipe || !ItemRegistry.isFood(recipe.output)) return false;

    const currentMeta = this.chunks.getBlockMeta(x, y, z) ?? {};
    const campfireItems = [...(currentMeta.campfireItems ?? new Array(4).fill(null))].slice(0, 4);
    const cookTimes = [...(currentMeta.campfireCookTimes ?? new Array(4).fill(0))].slice(0, 4);
    const dueTicks = [...(currentMeta.campfireCookDueTicks ?? new Array(4).fill(0))].slice(0, 4);
    while (campfireItems.length < 4) campfireItems.push(null);
    while (cookTimes.length < 4) cookTimes.push(0);
    while (dueTicks.length < 4) dueTicks.push(0);

    const slotIndex = campfireItems.findIndex((item) => !item);
    if (slotIndex === -1) return true;

    campfireItems[slotIndex] = { id: selectedSlot.id, count: 1 };
    cookTimes[slotIndex] = 0;
    dueTicks[slotIndex] = this.worldTickScheduler.getCurrentTick() + CAMPFIRE_COOK_TICKS;

    this.chunks.setBlockMeta(x, y, z, {
      ...currentMeta,
      campfireItems,
      campfireCookTimes: cookTimes,
      campfireCookDueTicks: dueTicks,
    }, true);
    this.scheduleWorldTick('block_event', x, y, z, CAMPFIRE_COOK_TICKS, 'campfire_cook');

    if (this.gameMode !== 'creative') {
      this.inventory.removeFromSlot(this.player.selectedSlot, 1);
    }

    this.sound.playBlockPlace(this.chunks.getBlock(x, y, z));
    this.particles.spawnBlockBreak(x + 0.5, y + 0.35, z + 0.5, 0xffa34d, 8);
    this.notifyState();
    return true;
  }

  private completeCampfireCooking(x: number, y: number, z: number) {
    const blockName = BlockRegistry.get(this.chunks.getBlock(x, y, z))?.name;
    if (blockName !== 'campfire' && blockName !== 'soul_campfire') return;

    const metadata = this.chunks.getBlockMeta(x, y, z) ?? {};
    const items = [...(metadata.campfireItems ?? new Array(4).fill(null))].slice(0, 4);
    const cookTimes = [...(metadata.campfireCookTimes ?? new Array(4).fill(0))].slice(0, 4);
    const dueTicks = [...(metadata.campfireCookDueTicks ?? new Array(4).fill(0))].slice(0, 4);
    while (items.length < 4) items.push(null);
    while (cookTimes.length < 4) cookTimes.push(0);
    while (dueTicks.length < 4) dueTicks.push(0);

    const currentTick = this.worldTickScheduler.getCurrentTick();
    let nextDueTick = Number.POSITIVE_INFINITY;
    let changed = false;
    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      if (!item) {
        cookTimes[index] = 0;
        dueTicks[index] = 0;
        continue;
      }
      if (!Number.isFinite(dueTicks[index]) || dueTicks[index] <= 0) {
        dueTicks[index] = currentTick + CAMPFIRE_COOK_TICKS;
      }
      if (dueTicks[index] > currentTick) {
        nextDueTick = Math.min(nextDueTick, dueTicks[index]);
        continue;
      }

      const recipe = findSmeltingResult(item.id);
      if (recipe && ItemRegistry.isFood(recipe.output)) {
        const dropPosition = new THREE.Vector3(x + 0.5, y + 0.45, z + 0.5);
        const velocity = new THREE.Vector3(
          (coordinateRandom(this.seed, currentTick, index, 71) - 0.5) * 0.35,
          0.35,
          (coordinateRandom(this.seed, currentTick, index, 83) - 0.5) * 0.35,
        );
        this.droppedItems.spawnItem(recipe.output, recipe.outputCount, dropPosition, velocity, 0.25);
        this.xp.spawnXP(recipe.xp, dropPosition.clone().add(new THREE.Vector3(0, 0.15, 0)));
        this.sound.playPickup();
        this.particles.spawnBlockBreak(x + 0.5, y + 0.35, z + 0.5, 0xffc05a, 10);
      }
      items[index] = null;
      cookTimes[index] = 0;
      dueTicks[index] = 0;
      changed = true;
    }

    if (Number.isFinite(nextDueTick)) {
      this.scheduleWorldTick('block_event', x, y, z, nextDueTick - currentTick, 'campfire_cook');
    }
    if (changed || metadata.campfireCookDueTicks === undefined) {
      this.chunks.setBlockMeta(x, y, z, {
        ...metadata,
        campfireItems: items,
        campfireCookTimes: cookTimes,
        campfireCookDueTicks: dueTicks,
      }, true);
      this.notifyState();
    }
  }

  private restoreScheduledCampfireTicks() {
    const currentTick = this.worldTickScheduler.getCurrentTick();
    const dimensionChunks = [
      [Dimension.Overworld, this.chunks.overworldChunks],
      [Dimension.Nether, this.chunks.netherChunks],
      [Dimension.End, this.chunks.endChunks],
    ] as const;

    for (const [dimension, chunks] of dimensionChunks) {
      for (const chunk of chunks.values()) {
        for (const [index, metadata] of chunk.metadata.entries()) {
          const items = metadata.campfireItems;
          if (!items?.some(Boolean)) continue;
          const blockName = BlockRegistry.get(chunk.data[index])?.name;
          if (blockName !== 'campfire' && blockName !== 'soul_campfire') continue;

          const cookTimes = [...(metadata.campfireCookTimes ?? new Array(4).fill(0))].slice(0, 4);
          const dueTicks = [...(metadata.campfireCookDueTicks ?? new Array(4).fill(0))].slice(0, 4);
          while (cookTimes.length < 4) cookTimes.push(0);
          while (dueTicks.length < 4) dueTicks.push(0);

          let earliestDueTick = Number.POSITIVE_INFINITY;
          for (let slot = 0; slot < 4; slot++) {
            if (!items[slot]) {
              dueTicks[slot] = 0;
              continue;
            }
            if (!Number.isFinite(dueTicks[slot]) || dueTicks[slot] <= currentTick) {
              const elapsedTicks = Math.max(0, Math.floor((cookTimes[slot] ?? 0) * 20));
              dueTicks[slot] = currentTick + Math.max(1, CAMPFIRE_COOK_TICKS - elapsedTicks);
            }
            earliestDueTick = Math.min(earliestDueTick, dueTicks[slot]);
          }

          metadata.campfireCookDueTicks = dueTicks;
          const localX = index % CHUNK_SIZE;
          const localZ = Math.floor((index % (CHUNK_SIZE * CHUNK_SIZE)) / CHUNK_SIZE);
          const y = Math.floor(index / (CHUNK_SIZE * CHUNK_SIZE));
          const worldX = chunk.cx * CHUNK_SIZE + localX;
          const worldZ = chunk.cz * CHUNK_SIZE + localZ;
          if (Number.isFinite(earliestDueTick)) {
            this.scheduleWorldTick(
              'block_event',
              worldX,
              y,
              worldZ,
              earliestDueTick - currentTick,
              'campfire_cook',
              dimension,
            );
          }
        }
      }
    }
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
    if (y <= 0 || y >= 254) return false;
    if (!BlockRegistry.isSolid(this.chunks.getBlock(x, y - 1, z))) return false;
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
      powered: false,
    }, true);
    this.redstone.observeBlockChange(x, y, z);

    this.chunks.setBlock(x, y + 1, z, doorBlockId);
    this.chunks.setBlockMeta(x, y + 1, z, {
      facing,
      doorHalf: 'upper',
      hinge,
      open: false,
      powered: false,
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

    if (y <= 0) return false;
    if (
      !BlockRegistry.isSolid(this.chunks.getBlock(x, y - 1, z))
      || !BlockRegistry.isSolid(this.chunks.getBlock(headX, y - 1, headZ))
    ) {
      return false;
    }

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

  private toggleDaylightDetector(x: number, y: number, z: number, blockId: number) {
    const isNormal = blockId === 151 || (blockId & 0x3FF) === 151;
    const newBaseId = isNormal ? 178 : 151;
    const metaVal = (blockId >> 10) & 0xF;
    const newPackedId = (metaVal << 10) | newBaseId;
    const currentMeta = this.chunks.getBlockMeta(x, y, z);

    this.chunks.setBlock(x, y, z, newPackedId);
    this.chunks.setBlockMeta(x, y, z, {
      ...currentMeta,
      facing: 'up',
      redstoneType: 'daylight_detector',
    }, true);
    this.redstone.register(x, y, z, 'daylight_detector', 'up');
    this.sound.playLever();
  }

  private toggleComparatorMode(x: number, y: number, z: number, blockId: number) {
    const metaVal = (blockId >> 10) & 0x7;
    const newMeta = metaVal < 4 ? metaVal + 4 : metaVal - 4;
    const newPackedId = (newMeta << 10) | (blockId & 0x3FF);
    const currentMeta = this.chunks.getBlockMeta(x, y, z);

    this.chunks.setBlock(x, y, z, newPackedId);
    this.chunks.setBlockMeta(x, y, z, {
      ...currentMeta,
      facing: currentMeta?.facing ?? 'north',
      redstoneType: 'comparator',
      open: newMeta >= 4,
    }, true);
    this.sound.playLever();
  }

  private useStrawBed26_3(x: number, y: number, z: number) {
    const dimensionName = this.chunks.currentDimension === Dimension.Overworld
      ? 'overworld'
      : this.chunks.currentDimension === Dimension.Nether
        ? 'nether'
        : 'end';
    const outcome = resolveStrawBedUse26_3(dimensionName);
    const metadata = this.chunks.getBlockMeta(x, y, z);
    const facing = metadata?.facing ?? 'north';
    const forward = facing === 'east'
      ? { x: 1, z: 0 }
      : facing === 'west'
        ? { x: -1, z: 0 }
        : facing === 'south'
          ? { x: 0, z: 1 }
          : { x: 0, z: -1 };
    const direction = metadata?.bedPart === 'head' ? -1 : 1;
    const positions = [
      { x, y, z },
      { x: x + forward.x * direction, y, z: z + forward.z * direction },
    ];

    for (const position of positions) {
      const id = this.chunks.getBlock(position.x, position.y, position.z);
      if (BlockRegistry.get(id)?.name !== 'straw_bed') continue;
      this.chunks.setBlock(position.x, position.y, position.z, 0);
      this.chunks.setBlockMeta(position.x, position.y, position.z, null, true);
      this.redstone.observeBlockChange(position.x, position.y, position.z);
    }

    if (outcome.canSleep) {
      if (this.gameTime >= 0.5) this.gameTime = 0.05;
      this.advancements.checkSleep();
      this.sound.playBlockPlace(35);
    } else {
      this.sound.playBlockBreak(35);
    }
    this.notifyState();
  }

  private useBed(x: number, y: number, z: number) {
    const dimension = this.chunks.currentDimension === Dimension.Overworld
      ? 'overworld'
      : this.chunks.currentDimension === Dimension.Nether
        ? 'nether'
        : 'end';
    const metadata = this.chunks.getBlockMeta(x, y, z);
    const head = getBedHeadPosition({ x, y, z }, metadata);
    const canSleepNow = this.isNight() || this.weather.getCurrentWeather() === 'thunder';
    const monstersNearby = Array.from(this.mobs.mobs.values()).some((mob) =>
      mob.health > 0 && mob.def.hostile && isMonsterWithinBedSleepRange(head, mob.position),
    );
    const outcome = resolveBedUse(dimension, canSleepNow, monstersNearby);

    if (outcome.explodes) {
      this.createExplosion(head.x + 0.5, head.y + 0.5, head.z + 0.5, 5);
      return;
    }

    if (outcome.setsSpawn) {
      this.bedSpawnPoint = new THREE.Vector3(head.x + 0.5, head.y + 1, head.z + 0.5);
    }
    this.sound.playBlockPlace(35);

    if (outcome.canSleep) {
      this.advancements.checkSleep();
      this.gameTime = 0.0;
      if (this.weather.getCurrentWeather() !== 'clear') this.weather.setWeatherType('clear');
      this.addChatMessage('You are now sleeping. Morning has come.');
      this.notifyState();
    } else if (outcome.blockedByMonsters) {
      this.addChatMessage('You may not rest now; there are monsters nearby');
    } else {
      this.addChatMessage('You can only sleep at night or during thunderstorms');
    }
  }

  private setDoorOpen(x: number, y: number, z: number, open: boolean, powered?: boolean) {
    const base = this.getDoorBase(x, y, z);
    if (!base) return;

    const lowerMeta = this.chunks.getBlockMeta(base.x, base.y, base.z);
    const upperMeta = this.chunks.getBlockMeta(base.x, base.y + 1, base.z);
    if ((lowerMeta?.open ?? upperMeta?.open ?? false) === open) return;

    const facing = lowerMeta?.facing ?? upperMeta?.facing ?? 'north';
    const hinge = lowerMeta?.hinge ?? upperMeta?.hinge ?? 'left';
    const nextPowered = powered ?? lowerMeta?.powered ?? upperMeta?.powered ?? false;
    const blockId = this.chunks.getBlock(base.x, base.y, base.z);

    this.chunks.setBlock(base.x, base.y, base.z, blockId);
    this.chunks.setBlockMeta(base.x, base.y, base.z, {
      ...lowerMeta,
      facing,
      doorHalf: 'lower',
      hinge,
      open,
      powered: nextPowered,
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
        powered: nextPowered,
      }, true);
      this.redstone.observeBlockChange(base.x, base.y + 1, base.z);
    }
  }

  private toggleDoor(x: number, y: number, z: number) {
    const base = this.getDoorBase(x, y, z);
    if (!base) return;
    const lowerMeta = this.chunks.getBlockMeta(base.x, base.y, base.z);
    const upperMeta = this.chunks.getBlockMeta(base.x, base.y + 1, base.z);
    this.setDoorOpen(base.x, base.y, base.z, !(lowerMeta?.open ?? upperMeta?.open ?? false));
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

  // ─── P3.1: buttons, fence gates, redstone-driven openable blocks ───

  private pressButton(x: number, y: number, z: number) {
    const blockId = this.chunks.getBlock(x, y, z);
    if (blockId === 0) return;
    const def = BlockRegistry.get(blockId);
    if (!def || !def.name.endsWith('_button')) return;

    const meta = this.chunks.getBlockMeta(x, y, z) ?? {};
    if (meta.powered) return; // already pressed

    this.chunks.setBlockMeta(x, y, z, {
      ...meta,
      redstoneType: 'button',
      powered: true,
      signal: 15,
    }, true);

    const existing = this.redstone.get(x, y, z);
    if (existing && existing.type === 'button') {
      existing.state = true;
      existing.signal = 15;
    } else {
      this.redstone.register(x, y, z, 'button', meta.facing ?? 'north', { signal: 15, state: true });
    }
    this.redstone.observeBlockChange(x, y, z);
    this.sound.playLever();

    // Java: wooden buttons stay pressed 30 ticks; stone-family buttons 20 ticks.
    this.applyRedstoneToNeighbors(x, y, z);
    this.scheduleWorldTick('block_event', x, y, z, getButtonPressTicks(def.name), 'button_reset');
  }

  private releaseButton(x: number, y: number, z: number) {
    const comp = this.redstone.get(x, y, z);
    if (comp && comp.type === 'button') {
      comp.state = false;
      comp.signal = 0;
    }
    const meta = this.chunks.getBlockMeta(x, y, z);
    if (meta?.powered) {
      this.chunks.setBlockMeta(x, y, z, { ...meta, powered: false, signal: 0 }, true);
      this.redstone.observeBlockChange(x, y, z);
      this.applyRedstoneToNeighbors(x, y, z);
    }
  }

  private toggleFenceGate(x: number, y: number, z: number) {
    const meta = this.chunks.getBlockMeta(x, y, z);
    const next = resolveFenceGateManualToggle(meta, this.getPlayerHorizontalFacing());
    this.chunks.setBlockMeta(x, y, z, { ...meta, open: next.open, facing: next.facing }, true);
    this.redstone.observeBlockChange(x, y, z);
  }

  private applyRedstoneToNeighbors(x: number, y: number, z: number) {
    const NEIGHBORS: Array<[number, number, number]> = [
      [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
    ];
    for (const [dx, dy, dz] of NEIGHBORS) {
      this.applyRedstonePowerToBlock(x + dx, y + dy, z + dz);
    }
  }

  /**
   * Java 1.20.1 openable-block power rules:
   * - fence gates / trapdoors open while powered and close when unpowered;
   * - iron doors open while powered and close when unpowered (no hand use);
   * - wooden doors open while powered and keep their state when unpowered.
   */
  private applyRedstonePowerToBlock(x: number, y: number, z: number) {
    const blockId = this.chunks.getBlock(x, y, z);
    if (blockId === 0) return;
    const def = BlockRegistry.get(blockId);
    if (!def) return;
    const name = def.name;
    const powered = this.redstone.isPositionPowered(x, y, z);

    // P3.6: note blocks play on a rising power edge.
    if (name === 'note_block') {
      const meta = this.chunks.getBlockMeta(x, y, z) ?? {};
      const wasPowered = !!meta.notePowered;
      if (powered && !wasPowered) {
        this.playNoteBlock(x, y, z);
        this.chunks.setBlockMeta(x, y, z, { ...meta, notePowered: true }, true);
      } else if (!powered && wasPowered) {
        this.chunks.setBlockMeta(x, y, z, { ...meta, notePowered: false }, true);
      }
      return;
    }

    // P3.6: redstone lamps light up while powered (swap block variants).
    if (name === 'redstone_lamp' || name === 'lit_redstone_lamp') {
      const LAMP_ID = 123;
      const LIT_LAMP_ID = 124;
      const base = blockId & 0x3FF;
      const isLit = base === LIT_LAMP_ID;
      if (powered && !isLit) {
        this.chunks.setBlock(x, y, z, (blockId & ~0x3FF) | LIT_LAMP_ID);
        this.chunks.setBlockMeta(x, y, z, null);
        this.redstone.observeBlockChange(x, y, z);
      } else if (!powered && isLit) {
        this.chunks.setBlock(x, y, z, (blockId & ~0x3FF) | LAMP_ID);
        this.chunks.setBlockMeta(x, y, z, null);
        this.redstone.observeBlockChange(x, y, z);
      }
      return;
    }

    const isDoor = name.endsWith('door') && !name.includes('trapdoor');
    const isGate = name.includes('fence_gate');
    const isTrapdoor = name.includes('trapdoor');
    if (!isDoor && !isGate && !isTrapdoor) return;

    const meta = this.chunks.getBlockMeta(x, y, z);
    const decision = resolveOpenableRedstoneState(meta, powered);
    if (!decision.changed) return;

    if (isDoor) {
      this.setDoorOpen(x, y, z, decision.open, decision.powered);
    } else {
      this.chunks.setBlockMeta(x, y, z, {
        ...meta,
        open: decision.open,
        powered: decision.powered,
      }, true);
      this.redstone.observeBlockChange(x, y, z);
    }
  }

  // ─── P3.6: redstone components and timing ───

  /** Repeater right-click cycles the output delay 1 -> 2 -> 3 -> 4 -> 1. */
  private cycleRepeaterDelay(x: number, y: number, z: number) {
    const meta = this.chunks.getBlockMeta(x, y, z);
    const current = meta?.delayTicks ?? 1;
    const next = (current % 4) + 1;
    this.chunks.setBlockMeta(x, y, z, { ...meta, delayTicks: next }, true);
    this.redstone.setRepeaterDelay(x, y, z, next);
  }

  /** Note block right-click cycles the pitch through 25 semitones. */
  private cycleNotePitch(x: number, y: number, z: number) {
    const meta = this.chunks.getBlockMeta(x, y, z);
    const next = ((meta?.notePitch ?? 0) + 1) % 25;
    this.chunks.setBlockMeta(x, y, z, { ...meta, notePitch: next }, true);
    this.sound.playNoteBlock(next);
  }

  /** Play the note block's current pitch (called when redstone powers it). */
  private playNoteBlock(x: number, y: number, z: number) {
    const meta = this.chunks.getBlockMeta(x, y, z);
    this.sound.playNoteBlock(meta?.notePitch ?? 0);
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
    if (this.openChestVehicleId !== null) {
      return this.vehicles.vehicles.get(this.openChestVehicleId)?.inventory ?? null;
    }
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

  private closeServerContainerSession() {
    if (!this.network.isConnected || (!this.openChestPos && !this.openHopperPos && this.openChestVehicleId === null)) return;
    this.network.send(PacketType.C2S_CONTAINER_CLOSE, {});
    this.serverContainerCursor = null;
  }

  serverContainerClick(
    area: 'container' | 'player',
    slotIndex: number,
    options: { button?: 'left' | 'right'; shift?: boolean } = {},
  ) {
    if (!this.network.isConnected || (!this.openChestPos && !this.openHopperPos && this.openChestVehicleId === null)) return false;
    this.network.send(PacketType.C2S_CONTAINER_CLICK, { area, slotIndex, ...options });
    return true;
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

  private destroyBlockAt(
    x: number,
    y: number,
    z: number,
    spawnDrop: boolean = true,
    harvestable: boolean = true,
    dropEnchants?: { fortune: number; silkTouch: boolean },
  ) {
    const blockId = this.chunks.getBlock(x, y, z);
    const baseId = blockId & 0x3FF;
    if (baseId === 0) return;

    const meta = this.chunks.getBlockMeta(x, y, z);
    const def = BlockRegistry.get(blockId);
    const doorPartnerY = this.isDoorBlock(blockId)
      ? meta?.doorHalf === 'upper'
        ? y - 1
        : meta?.doorHalf === 'lower'
          ? y + 1
          : this.isDoorBlock(this.chunks.getBlock(x, y - 1, z))
            ? y - 1
            : this.isDoorBlock(this.chunks.getBlock(x, y + 1, z))
              ? y + 1
              : null
      : null;
    const isBedBlock = !!def && (def.name === 'bed' || def.name.endsWith('_bed'));
    const bedPartner = isBedBlock && meta?.bedPart
      ? getBedOtherPosition({ x, y, z }, meta)
      : null;

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
          this.droppedItems.spawnStack(slot, dropPos, velocity, 0.5);
        }
      }
    }

    if (spawnDrop && meta?.campfireItems) {
      for (const slot of meta.campfireItems) {
        if (slot && slot.count > 0) {
          const dropPos = new THREE.Vector3(x + 0.5, y + 0.35, z + 0.5);
          const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 1.0,
            1.0 + Math.random(),
            (Math.random() - 0.5) * 1.0
          );
          this.droppedItems.spawnItem(slot.id, slot.count, dropPos, velocity, 0.5);
        }
      }
    }

    if (spawnDrop && meta?.jukeboxDisc) {
      const jukeboxDisc = getStoredJukeboxDisc(meta.jukeboxDisc);
      if (jukeboxDisc) {
        this.droppedItems.spawnStack(
          jukeboxDisc,
          new THREE.Vector3(x + 0.5, y + 0.8, z + 0.5),
          new THREE.Vector3(0, 1.0, 0),
          0.5,
        );
      }
      this.sound.stopJukeboxSong();
    }

    // 2. Spawn item drop for the block itself
    if (spawnDrop && this.gameMode !== 'creative' && (harvestable || def?.name === 'decorated_pot')) {
      const dropPos = new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5);
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 1.5,
        1.5 + Math.random() * 1.5,
        (Math.random() - 0.5) * 1.5
      );

      if (def?.name === 'decorated_pot') {
        const selectedStack = dropEnchants
          ? this.inventory.getSlot(this.player.selectedSlot)
          : null;
        for (const drop of decoratedPotBreakDrops(
          meta,
          selectedStack,
          dropEnchants?.silkTouch ?? false,
          false,
        )) {
          this.droppedItems.spawnStack(drop, dropPos, velocity, 0.5);
        }
      } else if (this.isDoorBlock(blockId)) {
        const doorItemId = ItemRegistry.getItemIdForPlacedBlock(blockId);
        if (doorItemId !== undefined) {
          this.droppedItems.spawnItem(doorItemId, 1, dropPos, velocity, 0.5);
        }
      } else if (baseId === 59 || baseId === 141 || baseId === 142) {
        this.spawnCropDrops(x, y, z, blockId);
      } else if (baseId === 92) {
        // Placed cakes are consumed in-world and do not return an item when broken.
      } else if (baseId === 118 || def?.name.includes('cauldron')) {
        this.droppedItems.spawnItem(380, 1, dropPos, velocity, 0.5);
      } else {
        // P2.7: block drops come from data-driven loot tables (LootSystem).
        // P3.3: Silk Touch drops the block itself; Fortune adds extra rolls.
        let drops = rollBlockLoot(def, Math.random);
        if (dropEnchants?.silkTouch) {
          drops = [{ itemId: def?.id ?? blockId, count: 1 }];
        } else if (dropEnchants?.fortune && dropEnchants.fortune > 0) {
          drops = drops.map((drop) => ({
            ...drop,
            count: drop.count * (1 + Math.floor(Math.random() * (dropEnchants.fortune + 1))),
          }));
        }
        for (const drop of drops) {
          if (drop.count > 0 && drop.itemId > 0) {
            this.droppedItems.spawnItem(drop.itemId, drop.count, dropPos, velocity, 0.5);
          }
        }
      }
    }

    // 3. Set block to air and clear metadata
    this.chunks.setBlock(x, y, z, 0);
    this.chunks.setBlockMeta(x, y, z, null);
    this.breakCushionsSupportedBy26_3({ x, y, z }, spawnDrop);
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

    // Paired blocks are resolved from metadata captured before this half was cleared.
    if (doorPartnerY !== null) {
      const partnerId = this.chunks.getBlock(x, doorPartnerY, z);
      if (this.isDoorBlock(partnerId)) {
        this.destroyBlockAt(x, doorPartnerY, z, false);
      }
    }

    if (bedPartner) {
      const partnerId = this.chunks.getBlock(bedPartner.x, bedPartner.y, bedPartner.z);
      const partnerDef = BlockRegistry.get(partnerId);
      if (partnerDef?.name === def?.name) {
        this.destroyBlockAt(bedPartner.x, bedPartner.y, bedPartner.z, false);
      }
    }

    // Fluid check after removal
    this.checkFluidAdjacency(x, y, z);
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
            const blockName = BlockRegistry.get(blockId)?.name ?? '';
            const leafParticle = fallingLeafParticle26_3(blockName);
            if (leafParticle) {
              const color = leafParticle.includes(':red_') ? 0xc84b3f : leafParticle.includes(':orange_') ? 0xe68a3a : 0xe7c94c;
              this.ambientParticleSources.push({ x, y, z, type: 'poplar_leaves', color, blockId });
            } else if (baseId === 50) { // Torch
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
      if (src.type === 'poplar_leaves') {
        if (Math.random() < 0.012 * probabilityMult) {
          this.particles.spawnFallingLeaf(src.x + 0.5, src.y + 0.15, src.z + 0.5, src.color ?? 0xe7c94c);
        }
        if (Math.random() < 0.0008 * probabilityMult) {
          this.sound.playNamedEvent26_3('block.poplar_leaves.ambient', src.blockId ?? 0);
        }
      } else if (src.type === 'torch') {
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
      const typeValid = isFurnaceRecipeAllowed(meta.containerType, input.id, hasRecipe.output);

      if (typeValid) {
        recipeOutputId = hasRecipe.output;
        recipeOutputCount = hasRecipe.outputCount;
        recipeCookTime = hasRecipe.cookTime;

        canCook = canAcceptFurnaceOutput(
          output,
          recipeOutputId,
          recipeOutputCount,
          ItemRegistry.getMaxStackSize(recipeOutputId),
        );
      }
    }

    let metadataChanged = false;

    // Consume fuel if furnace is unlit but we need to cook
    if (meta.burnTime === 0 && canCook && fuel && isSmeltingFuel(fuel.id)) {
      const fuelBurnTime = getFurnaceFuelBurnTime(meta.containerType, getFuelBurnTime(fuel.id));
      if (fuelBurnTime > 0) {
        meta.burnTime = fuelBurnTime;
        meta.maxBurnTime = fuelBurnTime;
        const fuelRemainder = getFurnaceFuelRemainder(fuel);
        if (fuelRemainder) meta.inventory[1] = fuelRemainder;
        else {
          fuel.count--;
          if (fuel.count <= 0) meta.inventory[1] = null;
        }
        metadataChanged = true;
      }
    }

    const currentlyLit = meta.burnTime > 0;

    if (currentlyLit && canCook && input) {
      const speed = getFurnaceCookSpeed(meta.containerType);
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

        const wetSpongeRemainder = getWetSpongeFuelRemainder(ItemRegistry.get(input.id)?.name ?? BlockRegistry.get(input.id)?.name, meta.inventory[1]);
        if (wetSpongeRemainder) meta.inventory[1] = wetSpongeRemainder;

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
