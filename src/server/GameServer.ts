import * as THREE from 'three';
import { PacketType, Packet, compressBlocks } from './NetworkProtocol';
import {
  getBowReleaseParams,
  getServerBowPowerLevel,
  getThrowableProjectileType,
  isValidItemActionForHeldStack,
  parseItemAction,
} from './ItemActionRules';
import { findEnderEyeTarget, shouldEnderEyeShatter } from './EnderEyeRules';
import {
  getServerFishingWaitSeconds,
  parseServerFishingAction,
  rollServerFishingLoot,
  rollServerFishingXp,
  SERVER_FISHING_HOOKED_SECONDS,
} from './ServerFishingRules';
import {
  SERVER_TNT_FUSE_SECONDS,
  adjacentBlockPosition,
  bucketFillItemName,
  bucketPlacedBlockName,
  isValidServerItemUseForHeldStack,
  parseServerItemUseIntent,
  replaceOneHeldItem,
  type ServerBlockItemUseIntent,
  isMinecartItemName,
  serverItemOnBlockKind,
  vehicleTypeForBoatItemName,
} from './ServerItemUseRules';
import {
  createIdleServerVehicleInput,
  parseServerVehicleInput,
  parseServerVehicleInteraction,
  type ServerVehicleInputIntent,
} from './ServerVehicleRules';
import {
  createIdleServerMobRideInput,
  parseServerMobRideInput,
  parseServerMobRideInteraction,
  type ServerMobRideInput,
} from './ServerMobRideRules';
import {
  applyKnockbackResistance,
  getAttackStrength,
  getNetheriteKnockbackResistance,
  getServerKnockbackPlan,
  getServerMeleeDamage,
  getServerMeleeProfile,
  isEntityAttackInReach,
  isServerCriticalHit,
  parseEntityAttackIntent,
} from './ServerCombatRules';
import {
  damageDurableStack,
  damageServerArmorForHit,
  mitigateServerPlayerDamage,
  resolveServerShieldBlock,
} from './ServerPlayerDamage';
import { clampPlayerState, consumeOne, consumeOneWithRemainder, validateConsume } from './PlayerStateRules';
import {
  applyServerContainerClick,
  containerKey,
  createContainerSlots,
  parseContainerClickIntent,
  returnContainerCursorToInventory,
} from './ContainerRules';
import {
  isDescendingAirborne,
  isMoveTooFast,
  isSurvivalFlightSpoof,
  parseServerMoveIntent,
} from './ServerMovementRules';
import { getDeathXpDrop, resetXpAfterDeath, shouldDropStackOnDeath } from './ServerDeathRules';
import { applyGiveToInventory, canExecuteServerCommand, isValidWeatherArgument, validateGiveCount } from './ServerCommandRules';
import { getProjectileImpactBehavior } from './ServerProjectileRules';
import { spawnEggMobTypeForItemName } from '../world/SpawnEggRules';
import { EXPERIENCE_BOTTLE_XP_RANGE, rollXp } from '../world/XpRules';
import {
  canPlaceHeldBlock,
  consumeHeldStack,
  isBlockActionInReach,
  isValidBlockCoordinate,
  isValidHotbarSlot,
  isValidInventoryStack,
  isValidWorldY,
} from './ServerWorldActionRules';
import type { PotionEffectData } from '../systems/PotionEffect';

import { WorldGen } from '../world/WorldGen';
import { Dimension, DimensionGenerator } from '../world/DimensionGenerator';
import { Chunk } from '../world/Chunk';
import { BlockRegistry } from '../world/BlockRegistry';
import { planBlockPlacement } from '../world/BlockPlacement';
import {
  applySignInteraction,
  createDefaultSignMetadata,
  getSignSideForPlayer,
  isSignBlockName,
  isWallSignBlockName,
  setSignTextForSide,
} from '../world/SignRules';
import { isServerSignStylingItemName, parseServerSignUpdate } from './ServerSignRules';
import { resolveAxeStrippedBlockName, resolveHoeFarmlandTargetName, resolveShovelPathTargetName, rotateBoneMealSpreadOffsets26_3 } from '../world/ItemOnBlockRules';
import {
  END_PORTAL_BLOCK_ID,
  END_PORTAL_FRAME_BLOCK_ID,
  fillEndPortalFrameBlock,
  findCompleteEndPortalCenter,
  getEndPortalInteriorCells,
} from '../world/EndPortalRules';
import { coordinateRandom } from '../engine/DeterministicRandom';
import { createServerPlacementCells, getDoorSidePosition, horizontalFacingFromYaw, isPlacementReplaceableBlockName, resolveDoorHinge, signRotationFromYaw } from './ServerPlacementRules';
import { ItemRegistry } from '../items/ItemRegistry';
import { cloneItemStack } from '../items/ItemStackRules';
import { getDefaultUseRemainderItemId } from '../items/ItemUseRules';
import {
  ITEM_ENTITY_DEFAULT_PICKUP_DELAY_SECONDS,
  ITEM_ENTITY_DESPAWN_SECONDS,
  ITEM_ENTITY_MERGE_INTERVAL_SECONDS,
  canItemEntityPositionsMerge,
  insertItemStackIntoSlots,
  isWithinItemPickupBounds,
  mergeItemEntityStacks,
} from '../items/ItemEntityRules';
import { MOB_DEFS, Mob, type MobType } from '../entities/Mob';
import { shouldTameEntity } from '../entities/EntityInteractionRules';
import { canApplySaddle, canControlMountedMob, canMountMob, getNameTagLabel } from '../entities/MobItemInteractionRules';
import { CHUNK_SIZE, RENDER_DISTANCE, SEA_LEVEL, WORLD_HEIGHT } from '../constants';
import type { ItemStack, BlockMetadata } from '../types';
import { createHurtCooldownState, resolveHurtDamage, tickHurtCooldown, type HurtCooldownState } from '../systems/HurtCooldown';
import type { PlayerDamageKind } from '../systems/DamageRules';
import { SAVE_SCHEMA_VERSION, SaveSystem, type SaveData } from '../systems/SaveSystem';

const WORLD_SPAWN_X = 8;
const WORLD_SPAWN_Z = 8;

type OpenServerContainer =
  | { source: 'block'; x: number; y: number; z: number; key: string; cursor: ItemStack | null }
  | { source: 'vehicle'; vehicleId: number; cursor: ItemStack | null };

interface PlayerSession {
  id: string;
  username: string;
  socket: any; // MockWebSocket or WebSocket
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  flying: boolean;
  onGround: boolean;
  sprinting: boolean;
  descending: boolean;
  gameMode: 'survival' | 'creative';
  isOperator: boolean;
  dimension: number;
  health: number;
  hunger: number;
  oxygen: number;
  xpLevel: number;
  xpProgress: number;
  xpCurrent: number;
  inventory: (ItemStack | null)[];
  armor: (ItemStack | null)[];
  offhand: ItemStack | null;
  selectedSlot: number;
  isBlocking: boolean;
  shieldUseSeconds: number;
  shieldDisabledSeconds: number;
  lastAttackTick: number | null;
  hurtCooldown: HurtCooldownState;
  healthAuthorityLockSeconds: number;
  openContainer?: OpenServerContainer;
  ridingVehicleId?: number;
  ridingMobId?: number;
  /** P5.2 — guards one-time death handling. */
  dead?: boolean;
}

interface ServerMob {
  id: number;
  type: MobType;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  yaw: number;
  pitch: number;
  health: number;
  maxHealth: number;
  hurtTimer: number;
  onGround: boolean;
  aiState: 'idle' | 'wander' | 'chase';
  wanderTarget: THREE.Vector3 | null;
  wanderTimer: number;
  despawnTimer: number;
  fuseTimer: number; // for creepers
  shootTimer: number; // for skeletons
  dimension: number;
  isBaby?: boolean;
  isTamed?: boolean;
  isSitting?: boolean;
  isSaddled?: boolean;
  customName?: string;
  isSheared?: boolean;
  riderId?: string;
  riderInput?: ServerMobRideInput;
  isAngry?: boolean;
  angerTimer?: number;
}

interface ServerDroppedItem {
  id: number;
  stack: ItemStack;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  age: number;
  pickupDelay: number;
  dimension: number;
}

interface ServerPrimedTnt {
  id: number;
  position: THREE.Vector3;
  fuseSeconds: number;
  dimension: number;
}

interface ServerVehicle {
  id: number;
  type: 'boat' | 'chest_boat' | 'minecart';
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotationY: number;
  speed: number;
  sourceItemId: number;
  dimension: number;
  inventory: (ItemStack | null)[] | null;
  riderId?: string;
  input: ServerVehicleInputIntent;
}

interface ServerFishingState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  phase: 'flying' | 'waiting' | 'hooked';
  waitSeconds: number;
  hookedSeconds: number;
  dimension: number;
}

interface ServerProjectile {
  id: number;
  type: 'arrow' | 'fireball' | 'shulker_bullet' | 'snowball' | 'egg' | 'ender_pearl' | 'potion' | 'trident' | 'firework_rocket' | 'experience_bottle' | 'eye_of_ender';
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  ownerId?: string;
  age: number;
  dimension: number;
  damage: number;
  /** P5.1 — splash/lingering potion effect carried to the splash site. */
  potionEffect?: PotionEffectData;
}

export class GameServer {
  private players: Map<string, PlayerSession> = new Map();
  private mobs: Map<number, ServerMob> = new Map();
  private droppedItems: Map<number, ServerDroppedItem> = new Map();
  private droppedItemMergeTimer = 0;
  private projectiles: Map<number, ServerProjectile> = new Map();
  private primedTnt: Map<number, ServerPrimedTnt> = new Map();
  private vehicles: Map<number, ServerVehicle> = new Map();
  private fishingStates: Map<string, ServerFishingState> = new Map();
  private nextProjectileId = 1;
  /** P5.3 — server-owned container contents keyed by position. */
  private containerData: Map<string, (ItemStack | null)[]> = new Map();
  
  private overworldChunks: Map<string, Chunk> = new Map();
  private netherChunks: Map<string, Chunk> = new Map();
  private endChunks: Map<string, Chunk> = new Map();

  private worldGen: WorldGen;
  private dimensionGen: DimensionGenerator;
  private seed: number;
  private currentSlot: string = 'world_1';
  
  private nextEntityId = 1000;
  private gameTick = 0;
  private gameTime = 0.05; // Day/Night: 0=sunrise, 0.25=noon, 0.5=sunset, 0.75=midnight
  private weatherType: 'clear' | 'rain' | 'thunder' = 'clear';
  private weatherIntensity = 0;
  private weatherTimer = 100;

  private tickInterval: any;
  private isStandalone = false;
  private endDragonDefeated = false;
  private endDragonHealth = 200;

  constructor(seed: number = 12345, isStandalone = false) {
    this.seed = seed;
    this.isStandalone = isStandalone;
    this.worldGen = new WorldGen(seed);
    this.dimensionGen = new DimensionGenerator(seed);
  }

  start() {
    this.tickInterval = setInterval(() => {
      this.tick();
    }, 50); // 20 TPS
    console.log("GameServer started at 20 TPS. Seed:", this.seed);
  }

  stop() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
    }
    console.log("GameServer stopped.");
  }

  // --- Connection management ---

  addPlayer(socket: any, username: string, isLocalHost: boolean): PlayerSession {
    const id = 'player_' + Math.random().toString(36).substring(2, 9);
    
    // Default spawn point
    const spawn = this.findSafeWorldSpawnPosition();

    const session: PlayerSession = {
      id,
      username,
      socket,
      x: spawn.x,
      y: spawn.y,
      z: spawn.z,
      yaw: 0,
      pitch: 0,
      flying: false,
      onGround: false,
      sprinting: false,
      descending: false,
      gameMode: 'survival',
      isOperator: isLocalHost,
      dimension: 0, // Overworld
      health: 20,
      hunger: 20,
      oxygen: 15,
      xpLevel: 0,
      xpProgress: 0,
      xpCurrent: 0,
      inventory: Array(36).fill(null),
      armor: Array(4).fill(null),
      offhand: null,
      selectedSlot: 0,
      isBlocking: false,
      shieldUseSeconds: 0,
      shieldDisabledSeconds: 0,
      lastAttackTick: null,
      hurtCooldown: createHurtCooldownState(),
      healthAuthorityLockSeconds: 0
    };

    // Starter Pack items
    session.inventory[0] = { id: 272, count: 1 }; // Stone Sword
    session.inventory[1] = { id: 274, count: 1 }; // Stone Pickaxe
    session.inventory[2] = { id: 275, count: 1 }; // Stone Axe
    session.inventory[3] = { id: 364, count: 32 }; // Steak
    session.inventory[4] = { id: 17, count: 64 };  // Oak Log
    session.inventory[5] = { id: 5, count: 64 };   // Oak Planks
    session.inventory[6] = { id: 58, count: 4 };   // Crafting Table
    session.inventory[7] = { id: 54, count: 4 };   // Chest
    session.inventory[8] = { id: 50, count: 64 };  // Torch

    this.players.set(id, session);
    
    // Bind network handler to socket
    socket.onmessage = (event: any) => {
      try {
        const packet: Packet = JSON.parse(event.data);
        this.handlePacket(id, packet);
      } catch (err) {
        console.error("Failed to handle socket packet from", username, err);
      }
    };

    socket.onclose = () => {
      this.removePlayer(id);
    };

    // Send S2C JOIN ACK
    this.sendTo(session, PacketType.S2C_JOIN_ACK, {
      playerId: id,
      seed: this.seed,
      x: session.x,
      y: session.y,
      z: session.z,
      gameMode: 'survival'
    });

    // Notify other players
    this.broadcastExcept(id, PacketType.S2C_PLAYER_JOIN, {
      playerId: id,
      username: username,
      x: session.x,
      y: session.y,
      z: session.z
    });

    // Send existing players to this new player
    for (const other of this.players.values()) {
      if (other.id !== id) {
        this.sendTo(session, PacketType.S2C_PLAYER_JOIN, {
          playerId: other.id,
          username: other.username,
          x: other.x,
          y: other.y,
          z: other.z
        });
      }
    }

    // Send current game state
    this.sendTo(session, PacketType.S2C_TIME, { gameTime: this.gameTime });
    this.sendTo(session, PacketType.S2C_WEATHER, { type: this.weatherType, intensity: this.weatherIntensity });
    this.sendTo(session, PacketType.S2C_INVENTORY_SYNC, { slots: session.inventory, armor: session.armor, offhand: session.offhand });

    // Send initial active mobs
    for (const mob of this.mobs.values()) {
      if (mob.dimension === session.dimension) {
        this.sendTo(session, PacketType.S2C_MOB_SPAWN, {
          id: mob.id,
          type: mob.type,
          x: mob.position.x,
          y: mob.position.y,
          z: mob.position.z,
          yaw: mob.yaw,
          pitch: mob.pitch,
          health: mob.health,
          isBaby: mob.isBaby,
          isTamed: mob.isTamed,
          isSitting: mob.isSitting,
          isSaddled: mob.isSaddled,
          customName: mob.customName,
          isSheared: mob.isSheared,
          riderId: mob.riderId ?? null
        });
      }
    }

    // Send active server-authoritative vehicles to late joiners.
    for (const vehicle of this.vehicles.values()) {
      if (vehicle.dimension === session.dimension) {
        this.sendTo(session, PacketType.S2C_VEHICLE_SPAWN, {
          id: vehicle.id,
          type: vehicle.type,
          sourceItemId: vehicle.sourceItemId,
          x: vehicle.position.x,
          y: vehicle.position.y,
          z: vehicle.position.z,
          rotationY: vehicle.rotationY,
          riderId: vehicle.riderId ?? null,
          dimension: vehicle.dimension,
        });
      }
    }

    // Send active dropped items with their complete stack identity.
    for (const item of this.droppedItems.values()) {
      if (item.dimension === session.dimension) {
        this.sendTo(session, PacketType.S2C_DROPPED_ITEM_SPAWN, {
          id: item.id,
          stack: cloneItemStack(item.stack),
          itemId: item.stack.id,
          count: item.stack.count,
          x: item.position.x,
          y: item.position.y,
          z: item.position.z,
          pickupDelay: item.pickupDelay,
          age: item.age,
          dimension: item.dimension,
        });
      }
    }

    this.sendSystemMessage(`${username} joined the game.`);

    // Try loading world save if local
    if (!this.isStandalone && isLocalHost) {
      this.loadWorldSaveLocal(this.currentSlot, session);
    }

    return session;
  }

  removePlayer(id: string) {
    const session = this.players.get(id);
    if (session) {
      console.log(`Player ${session.username} disconnected.`);
      this.closeServerContainer(session);
      this.fishingStates.delete(session.id);
      if (session.ridingMobId !== undefined) {
        const mob = this.mobs.get(session.ridingMobId);
        if (mob?.riderId === session.id) {
          mob.riderId = undefined;
          mob.riderInput = createIdleServerMobRideInput(mob.id);
          this.broadcastDimension(mob.dimension, PacketType.S2C_MOB_RIDER, {
            mobId: mob.id,
            riderId: null,
          });
        }
        session.ridingMobId = undefined;
      }
      if (session.ridingVehicleId !== undefined) {
        const vehicle = this.vehicles.get(session.ridingVehicleId);
        if (vehicle?.riderId === session.id) {
          vehicle.riderId = undefined;
          vehicle.input = createIdleServerVehicleInput(vehicle.id);
          this.broadcastDimension(vehicle.dimension, PacketType.S2C_VEHICLE_RIDER, {
            vehicleId: vehicle.id,
            riderId: null,
          });
        }
      }
      this.players.delete(id);
      
      // Auto-save local world if we are inside browser
      if (!this.isStandalone && this.players.size === 0) {
        this.saveWorldLocal(this.currentSlot);
      }

      this.broadcast(PacketType.S2C_PLAYER_LEAVE, { playerId: id });
      this.sendSystemMessage(`${session.username} left the game.`);
    }
  }

  // --- Save / Load Logic ---

  async saveWorldLocal(slot: string) {
    if (typeof window === 'undefined' || typeof indexedDB === 'undefined') return;
    
    // We only have one local player on the device
    const localSession = Array.from(this.players.values())[0];
    if (!localSession) return;

    // Serialize chunks
    const dimensions: Record<0 | 1 | 2, { chunks: any[]; mobs: any[] }> = {
      0: { chunks: [], mobs: [] },
      1: { chunks: [], mobs: [] },
      2: { chunks: [], mobs: [] },
    };
    const collectChunks = (chunksMap: Map<string, Chunk>, dim: number) => {
      for (const chunk of chunksMap.values()) {
        const metadataArray = Array.from(chunk.metadata.entries()).map(([index, meta]) => ({
          index,
          metadata: { ...meta }
        }));

        dimensions[dim as 0 | 1 | 2].chunks.push({
          cx: chunk.cx,
          cz: chunk.cz,
          data: chunk.data,
          metadata: metadataArray,
        });
      }
    };

    collectChunks(this.overworldChunks, 0);
    collectChunks(this.netherChunks, 1);
    collectChunks(this.endChunks, 2);

    // Serialize mobs
    for (const mob of this.mobs.values()) {
      const dimension = (mob.dimension === 1 ? 1 : mob.dimension === 2 ? 2 : 0) as 0 | 1 | 2;
      dimensions[dimension].mobs.push({
        type: mob.type,
        x: mob.position.x,
        y: mob.position.y,
        z: mob.position.z,
        health: mob.health,
        dimension,
        isBaby: mob.isBaby,
        isTamed: mob.isTamed,
        isSitting: mob.isSitting,
        isSaddled: mob.isSaddled,
        customName: mob.customName,
        isSheared: mob.isSheared
      });
    }

    const saveData: SaveData = {
      schemaVersion: SAVE_SCHEMA_VERSION,
      player: {
        x: localSession.x,
        y: localSession.y,
        z: localSession.z,
        yaw: localSession.yaw,
        pitch: localSession.pitch,
        health: localSession.health,
        hunger: localSession.hunger,
        flying: localSession.flying,
        xpLevel: localSession.xpLevel,
        xpCurrent: localSession.xpCurrent,
        activePotionEffects: [],
        currentDimension: localSession.dimension === 1 ? 1 : localSession.dimension === 2 ? 2 : 0
      },
      inventory: {
        slots: localSession.inventory,
        armor: localSession.armor,
        offhand: localSession.offhand
      },
      seed: this.seed,
      dimensions,
      timestamp: Date.now()
    };

    try {
      await SaveSystem.save(saveData, slot);
      console.log("Successfully saved local world in slot", slot);
    } catch (e) {
      console.error("Failed to save local world", e);
    }
  }

  async loadWorldSaveLocal(slot: string, session: PlayerSession) {
    if (typeof window === 'undefined' || typeof indexedDB === 'undefined') return;

    try {
      const hasSave = await SaveSystem.hasSave(slot);
      if (!hasSave) return;

      const data = await SaveSystem.load(slot);
      if (!data) return;

      this.seed = data.seed;
      this.worldGen = new WorldGen(this.seed);
      this.dimensionGen = new DimensionGenerator(this.seed);

      // Load player state
      session.x = data.player.x;
      session.y = data.player.y;
      session.z = data.player.z;
      session.yaw = data.player.yaw;
      session.pitch = data.player.pitch;
      session.health = data.player.health;
      session.hunger = data.player.hunger;
      session.flying = data.player.flying;
      session.xpLevel = data.player.xpLevel ?? 0;
      session.xpCurrent = data.player.xpCurrent ?? 0;
      session.dimension = data.player.currentDimension ?? 0;
      let migratedLegacySpawn = false;
      if (
        this.shouldMigrateLegacySpawn(session.x, session.z, session.dimension) ||
        this.isSavedSpawnColumnStale(data.dimensions[0]?.chunks, session.x, session.z, session.dimension) ||
        this.isDamagedSpawnSave(session.x, session.y, session.z, session.health, session.dimension)
      ) {
        const spawn = this.findSafeWorldSpawnPosition();
        session.x = spawn.x;
        session.y = spawn.y;
        session.z = spawn.z;
        session.health = 20;
        session.hunger = 20;
        session.oxygen = 15;
        migratedLegacySpawn = true;
      }
      session.inventory = data.inventory.slots;
      session.armor = data.inventory.armor;
      session.offhand = data.inventory.offhand ?? null;

      // Clear current server chunks
      this.overworldChunks.clear();
      this.netherChunks.clear();
      this.endChunks.clear();

      // Deserialise chunks
      for (const dimension of [0, 1, 2] as const) {
        for (const cData of data.dimensions[dimension]?.chunks ?? []) {
          if (migratedLegacySpawn && this.isChunkNearSession(cData.cx, cData.cz, dimension, session)) continue;

          const chunk = new Chunk(cData.cx, cData.cz);
          chunk.data.set(cData.data);
        
          if (cData.metadata) {
            for (const m of cData.metadata) {
              chunk.metadata.set(m.index, { ...m.metadata });
            }
          }
        
          if (dimension === 0) this.overworldChunks.set(`${chunk.cx},${chunk.cz}`, chunk);
          else if (dimension === 1) this.netherChunks.set(`${chunk.cx},${chunk.cz}`, chunk);
          else this.endChunks.set(`${chunk.cx},${chunk.cz}`, chunk);
        }
      }

      // Deserialise mobs
      this.mobs.clear();

      for (const dimension of [0, 1, 2] as const) {
        for (const mData of data.dimensions[dimension]?.mobs ?? []) {
          this.spawnMob(
            mData.type,
            mData.x,
            mData.y,
            mData.z,
            dimension,
            mData.isBaby,
            mData.isTamed,
            mData.isSitting,
            mData.isSheared,
            mData.isSaddled,
            mData.customName
          );
        }
      }

      if (migratedLegacySpawn) {
        session.y = this.findSafeYInLoadedWorld(session.x, session.z, session.dimension) + 2;
      }

      // Broadcast changes after chunks are ready so clients request regenerated safe-spawn chunks.
      this.sendTo(session, PacketType.S2C_JOIN_ACK, {
        playerId: session.id,
        seed: this.seed,
        x: session.x,
        y: session.y,
        z: session.z,
        gameMode: 'survival'
      });
      this.sendTo(session, PacketType.S2C_INVENTORY_SYNC, { slots: session.inventory, armor: session.armor, offhand: session.offhand });
      this.broadcast(PacketType.S2C_CHAT, { sender: 'System', text: 'Loaded world save.' });

    } catch (e) {
      console.error("Failed to load world save", e);
    }
  }

  private findSafeWorldSpawnPosition(): THREE.Vector3 {
    const maxRadius = 128;

    for (let radius = 0; radius <= maxRadius; radius += 4) {
      for (let dx = -radius; dx <= radius; dx += 4) {
        for (let dz = -radius; dz <= radius; dz += 4) {
          if (radius !== 0 && Math.abs(dx) !== radius && Math.abs(dz) !== radius) continue;

          const x = WORLD_SPAWN_X + dx;
          const z = WORLD_SPAWN_Z + dz;
          const y = this.worldGen.getTerrainHeight(x, z);
          if (y <= SEA_LEVEL + 1) continue;

          return new THREE.Vector3(x + 0.5, y + 2, z + 0.5);
        }
      }
    }

    const fallbackY = Math.max(this.worldGen.getTerrainHeight(WORLD_SPAWN_X, WORLD_SPAWN_Z) + 2, SEA_LEVEL + 2);
    return new THREE.Vector3(WORLD_SPAWN_X + 0.5, fallbackY, WORLD_SPAWN_Z + 0.5);
  }

  private shouldMigrateLegacySpawn(x: number, z: number, dimension: number): boolean {
    if (dimension !== 0) return false;

    const distanceFromOldSpawn = Math.hypot(x - WORLD_SPAWN_X, z - WORLD_SPAWN_Z);
    if (distanceFromOldSpawn > 16) return false;

    const terrainY = this.worldGen.getTerrainHeight(Math.floor(x), Math.floor(z));
    return terrainY <= SEA_LEVEL + 1;
  }

  private isChunkNearSession(cx: number, cz: number, dimension: number, session: PlayerSession): boolean {
    if (dimension !== 0) return false;

    const spawnChunkX = Math.floor(session.x / CHUNK_SIZE);
    const spawnChunkZ = Math.floor(session.z / CHUNK_SIZE);
    return Math.abs(cx - spawnChunkX) <= RENDER_DISTANCE + 1 && Math.abs(cz - spawnChunkZ) <= RENDER_DISTANCE + 1;
  }

  private isSavedSpawnColumnStale(
    chunks: { cx: number; cz: number; data: Uint16Array }[] | undefined,
    x: number,
    z: number,
    dimension: number
  ): boolean {
    if (!chunks || dimension !== 0) return false;
    if (Math.hypot(x - WORLD_SPAWN_X, z - WORLD_SPAWN_Z) > 32) return false;

    const wx = Math.floor(x);
    const wz = Math.floor(z);
    const expectedTerrainY = this.worldGen.getTerrainHeight(wx, wz);
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

  private isDamagedSpawnSave(x: number, y: number, z: number, health: number, dimension: number): boolean {
    if (dimension !== 0) return false;
    if (Math.hypot(x - WORLD_SPAWN_X, z - WORLD_SPAWN_Z) > 32) return false;
    return health <= 0 || y < SEA_LEVEL;
  }

  private findSafeYInLoadedWorld(x: number, z: number, dimension: number): number {
    const wx = Math.floor(x);
    const wz = Math.floor(z);
    const chunk = this.getOrGenerateChunk(
      Math.floor(wx / CHUNK_SIZE),
      Math.floor(wz / CHUNK_SIZE),
      dimension
    );
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

    for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
      const id = chunk.getBlock(lx, y, lz);
      if (BlockRegistry.isSolid(id) && !BlockRegistry.isFluid(id)) {
        return y;
      }
    }

    return Math.max(this.worldGen.getTerrainHeight(wx, wz), SEA_LEVEL + 1);
  }

  // --- Network message handling ---

  private handlePacket(playerId: string, packet: Packet) {
    const session = this.players.get(playerId);
    if (!session) return;

    switch (packet.type) {
      case PacketType.C2S_JOIN: {
        const requestedMode = packet.payload?.mode === 'creative' ? 'creative' : 'survival';
        session.gameMode = session.isOperator ? requestedMode : 'survival';
        session.flying = false;
        this.sendTo(session, PacketType.S2C_JOIN_ACK, {
          playerId: session.id,
          seed: this.seed,
          x: session.x,
          y: session.y,
          z: session.z,
          gameMode: session.gameMode,
        });
        break;
      }

      case PacketType.C2S_PLAYER_MOVE: {
        const intent = parseServerMoveIntent(packet.payload);
        const invalidY = !intent || intent.y < -64 || intent.y > WORLD_HEIGHT + 64;
        const flightSpoof = intent ? isSurvivalFlightSpoof(intent, session.gameMode === 'creative') : true;
        const tooFast = intent ? isMoveTooFast(session, intent) : true;
        if (!intent || invalidY || flightSpoof || tooFast) {
          this.sendTo(session, PacketType.S2C_POSITION_CORRECTION, {
            x: session.x, y: session.y, z: session.z,
            yaw: session.yaw, pitch: session.pitch,
          });
          break;
        }

        session.descending = isDescendingAirborne(
          { x: session.x, y: session.y, z: session.z, onGround: session.onGround, sprinting: session.sprinting },
          intent,
        );
        session.x = intent.x;
        session.y = intent.y;
        session.z = intent.z;
        session.yaw = intent.yaw;
        session.pitch = intent.pitch;
        session.onGround = intent.onGround;
        session.sprinting = intent.sprinting && session.hunger > 6 && !session.flying;
        session.flying = session.gameMode === 'creative' && intent.flying;

        this.broadcastExcept(playerId, PacketType.S2C_PLAYER_MOVE, {
          playerId,
          x: session.x,
          y: session.y,
          z: session.z,
          yaw: session.yaw,
          pitch: session.pitch,
          flying: session.flying,
          onGround: session.onGround,
          sprinting: session.sprinting,
        });
        break;
      }

      case PacketType.C2S_CHUNK_REQUEST: {
        const { cx, cz } = packet.payload;
        if (!Number.isInteger(cx) || !Number.isInteger(cz)) break;
        const playerCx = Math.floor(session.x / CHUNK_SIZE);
        const playerCz = Math.floor(session.z / CHUNK_SIZE);
        if (Math.abs(cx - playerCx) > RENDER_DISTANCE + 2 || Math.abs(cz - playerCz) > RENDER_DISTANCE + 2) break;
        const chunk = this.getOrGenerateChunk(cx, cz, session.dimension);
        
        // Serialize block metadata
        const metadataArray = Array.from(chunk.metadata.entries()).map(([index, meta]) => {
          const lz = index % CHUNK_SIZE;
          const ly = Math.floor(index / (CHUNK_SIZE * CHUNK_SIZE));
          const lx = Math.floor((index % (CHUNK_SIZE * CHUNK_SIZE)) / CHUNK_SIZE);
          return { x: lx, y: ly, z: lz, ...meta };
        });

        this.sendTo(session, PacketType.S2C_CHUNK_DATA, {
          cx,
          cz,
          blocks: compressBlocks(chunk.data),
          metadata: metadataArray,
          dimension: session.dimension
        });
        break;
      }

      case PacketType.C2S_BLOCK_BREAK: {
        const { x, y, z } = packet.payload;
        if (!isValidBlockCoordinate(x) || !isValidWorldY(y, WORLD_HEIGHT) || !isValidBlockCoordinate(z)) break;
        if (!isBlockActionInReach(session, x, y, z, session.gameMode)) break;
        const blockId = this.getBlock(x, y, z, session.dimension);
        if (blockId === 0) break;

        this.setBlock(x, y, z, 0, session.dimension);
        const tool = session.inventory[session.selectedSlot];
        if (tool && ItemRegistry.isTool(tool.id)) {
          session.inventory[session.selectedSlot] = damageDurableStack(tool, 1, 'tool');
          this.syncPlayerInventory(session);
        }
        this.broadcastDimension(session.dimension, PacketType.S2C_BLOCK_UPDATE, {
          x, y, z, blockId: 0, dimension: session.dimension
        });
        this.broadcastDimension(session.dimension, PacketType.S2C_SOUND, { type: 'break', x, y, z });
        break;
      }

      case PacketType.C2S_BLOCK_PLACE: {
        const { x, y, z, blockId, facing, targetX, targetY, targetZ, targetFace } = packet.payload;
        const validFace = (value: unknown): value is 'north' | 'south' | 'east' | 'west' | 'up' | 'down' =>
          value === 'north' || value === 'south' || value === 'east' || value === 'west' || value === 'up' || value === 'down';
        const held = session.inventory[session.selectedSlot];

        const hasAuthoritativeTarget =
          isValidBlockCoordinate(targetX)
          && isValidWorldY(targetY, WORLD_HEIGHT)
          && isValidBlockCoordinate(targetZ)
          && validFace(targetFace);

        if (hasAuthoritativeTarget) {
          if (!held || held.count <= 0) break;
          if (!isBlockActionInReach(session, targetX, targetY, targetZ, session.gameMode)) break;
          const item = ItemRegistry.get(held.id);
          if (!item) break;
          const targetBlockId = this.getBlock(targetX, targetY, targetZ, session.dimension);
          const targetBlock = BlockRegistry.get(targetBlockId);
          if (!targetBlock) break;

          const decision = planBlockPlacement({
            item,
            target: {
              position: { x: targetX, y: targetY, z: targetZ },
              face: targetFace,
              blockId: targetBlockId,
              block: targetBlock,
              heldItem: held,
            },
            placeBlockId: ItemRegistry.getPlaceBlockId(held.id),
            playerOccupiedCells: [
              { x: Math.floor(session.x), y: Math.floor(session.y), z: Math.floor(session.z) },
              { x: Math.floor(session.x), y: Math.floor(session.y + 1.5), z: Math.floor(session.z) },
            ],
          }, {
            getBlock: ({ x: bx, y: by, z: bz }) => this.getBlock(bx, by, bz, session.dimension),
            getBlockMetadata: ({ x: bx, y: by, z: bz }) => this.getBlockMetadata(bx, by, bz, session.dimension),
          });
          if (!decision.ok) break;

          const { plan } = decision;
          if (
            !isValidBlockCoordinate(x)
            || !isValidWorldY(y, WORLD_HEIGHT)
            || !isValidBlockCoordinate(z)
            || x !== plan.position.x
            || y !== plan.position.y
            || z !== plan.position.z
            || blockId !== plan.blockId
          ) {
            break;
          }

          const playerFacing = horizontalFacingFromYaw(session.yaw);
          let hinge: 'left' | 'right' = 'left';
          if (plan.kind === 'door') {
            const left = getDoorSidePosition(plan.position.x, plan.position.z, playerFacing, 'left');
            const right = getDoorSidePosition(plan.position.x, plan.position.z, playerFacing, 'right');
            const leftMeta = this.getBlockMetadata(left.x, plan.position.y, left.z, session.dimension);
            const rightMeta = this.getBlockMetadata(right.x, plan.position.y, right.z, session.dimension);
            const leftBlock = this.getBlock(left.x, plan.position.y, left.z, session.dimension);
            const rightBlock = this.getBlock(right.x, plan.position.y, right.z, session.dimension);
            hinge = resolveDoorHinge(
              plan.position.x,
              plan.position.z,
              playerFacing,
              session.x,
              session.z,
              !!BlockRegistry.get(leftBlock)?.name.endsWith('door') && !BlockRegistry.get(leftBlock)?.name.includes('trapdoor') && leftMeta?.facing === playerFacing,
              !!BlockRegistry.get(rightBlock)?.name.endsWith('door') && !BlockRegistry.get(rightBlock)?.name.includes('trapdoor') && rightMeta?.facing === playerFacing,
            );
          }

          const cells = createServerPlacementCells(plan, session.yaw, hinge);
          if (cells.some((cell) => !isValidWorldY(cell.position.y, WORLD_HEIGHT))) break;

          if (plan.kind === 'door') {
            if (!this.isSolidBlock(plan.position.x, plan.position.y - 1, plan.position.z, session.dimension)) break;
            if (cells.some((cell) => this.getBlock(cell.position.x, cell.position.y, cell.position.z, session.dimension) !== 0)) break;
          } else if (plan.kind === 'bed') {
            if (cells.some((cell) => !this.isSolidBlock(cell.position.x, cell.position.y - 1, cell.position.z, session.dimension))) break;
            if (cells.some((cell) => this.getBlock(cell.position.x, cell.position.y, cell.position.z, session.dimension) !== 0)) break;
          } else if (plan.kind === 'slab') {
            const current = this.getBlock(plan.position.x, plan.position.y, plan.position.z, session.dimension);
            const placeBlockId = ItemRegistry.getPlaceBlockId(held.id);
            if (current !== 0 && current !== placeBlockId) break;
          } else {
            const current = this.getBlock(plan.position.x, plan.position.y, plan.position.z, session.dimension);
            const currentName = BlockRegistry.get(current)?.name;
            if (current !== 0 && !isPlacementReplaceableBlockName(currentName)) break;
          }

          for (const cell of cells) {
            let metadata = cell.metadata;
            const block = BlockRegistry.get(cell.blockId);
            if (block && isSignBlockName(block.name)) {
              metadata = isWallSignBlockName(block.name)
                ? createDefaultSignMetadata({ facing: plan.facing })
                : createDefaultSignMetadata({ rotation: signRotationFromYaw(session.yaw) });
            } else if (!metadata && validFace(plan.facing)) {
              metadata = { facing: plan.facing };
            }
            this.setBlock(cell.position.x, cell.position.y, cell.position.z, cell.blockId, session.dimension, metadata);
            this.broadcastDimension(session.dimension, PacketType.S2C_BLOCK_UPDATE, {
              x: cell.position.x,
              y: cell.position.y,
              z: cell.position.z,
              blockId: cell.blockId,
              metadata,
              dimension: session.dimension,
            });
          }

          if (session.gameMode !== 'creative') {
            session.inventory[session.selectedSlot] = consumeHeldStack(held);
            this.syncPlayerInventory(session);
          }
          this.broadcastDimension(session.dimension, PacketType.S2C_SOUND, {
            type: 'place',
            x: plan.position.x,
            y: plan.position.y,
            z: plan.position.z,
          });
          break;
        }

        // Legacy clients can still place simple exact-mapped blocks.
        if (!isValidBlockCoordinate(x) || !isValidWorldY(y, WORLD_HEIGHT) || !isValidBlockCoordinate(z)) break;
        if (!Number.isInteger(blockId) || blockId <= 0) break;
        if (!isBlockActionInReach(session, x, y, z, session.gameMode)) break;
        if (this.getBlock(x, y, z, session.dimension) !== 0) break;
        if (!canPlaceHeldBlock(held, blockId)) break;
        const validFacing = validFace(facing);
        const meta = validFacing ? { facing } : null;
        this.setBlock(x, y, z, blockId, session.dimension, meta);
        if (session.gameMode !== 'creative') {
          session.inventory[session.selectedSlot] = consumeHeldStack(held!);
          this.syncPlayerInventory(session);
        }
        this.broadcastDimension(session.dimension, PacketType.S2C_BLOCK_UPDATE, {
          x, y, z, blockId, metadata: meta, dimension: session.dimension
        });
        this.broadcastDimension(session.dimension, PacketType.S2C_SOUND, { type: 'place', x, y, z });
        break;
      }

      case PacketType.C2S_CHAT: {
        const text = typeof packet.payload?.text === 'string' ? packet.payload.text.slice(0, 256) : '';
        if (!text) break;
        if (text.startsWith('/')) {
          this.executeCommand(session, text);
        } else {
          this.broadcastDimension(session.dimension, PacketType.S2C_CHAT, {
            sender: session.username,
            text
          });
        }
        break;
      }

      case PacketType.C2S_HELD_ITEM_CHANGE: {
        const { slot } = packet.payload;
        if (isValidHotbarSlot(slot)) session.selectedSlot = slot;
        break;
      }

      case PacketType.C2S_INVENTORY_CLICK: {
        // A client-provided slot snapshot cannot prove where an item came from.
        // Reject direct overwrites until an explicit server-validated transaction
        // protocol is used; return the canonical server inventory instead.
        this.syncPlayerInventory(session);
        break;
      }

      case PacketType.C2S_INTERACT_BLOCK: {
        const { x, y, z } = packet.payload;
        if (!isValidBlockCoordinate(x) || !isValidWorldY(y, WORLD_HEIGHT) || !isValidBlockCoordinate(z)) break;
        if (!isBlockActionInReach(session, x, y, z, session.gameMode)) break;
        const blockId = this.getBlock(x, y, z, session.dimension);
        // Chest or Furnace interaction sounds
        if ((blockId & 0x3FF) === 54) { // Chest
          this.broadcastDimension(session.dimension, PacketType.S2C_SOUND, { type: 'chest_open', x, y, z });
        }
        break;
      }

      case PacketType.C2S_SIGN_UPDATE: {
        const intent = parseServerSignUpdate(packet.payload);
        if (!intent) break;
        if (!isValidWorldY(intent.y, WORLD_HEIGHT)) break;
        if (!isBlockActionInReach(session, intent.x, intent.y, intent.z, session.gameMode)) break;
        const blockId = this.getBlock(intent.x, intent.y, intent.z, session.dimension);
        const block = BlockRegistry.get(blockId);
        if (!block || !isSignBlockName(block.name)) break;
        const metadata = createDefaultSignMetadata(
          this.getBlockMetadata(intent.x, intent.y, intent.z, session.dimension),
        );
        if (metadata.signWaxed) break;
        const side = getSignSideForPlayer(
          block.name,
          metadata,
          intent.x,
          intent.z,
          session.x,
          session.z,
        );
        const nextMetadata = setSignTextForSide(metadata, side, intent.lines);
        this.setBlock(intent.x, intent.y, intent.z, blockId, session.dimension, nextMetadata);
        this.broadcastServerBlockUpdate(intent.x, intent.y, intent.z, blockId, session.dimension, nextMetadata);
        break;
      }

      case PacketType.C2S_VEHICLE_INTERACT: {
        const intent = parseServerVehicleInteraction(packet.payload);
        if (!intent) break;
        const vehicle = this.vehicles.get(intent.vehicleId);
        if (!vehicle || vehicle.dimension !== session.dimension) break;
        if (!isEntityAttackInReach(session, vehicle.position, session.gameMode)) break;

        if (intent.action === 'mount') {
          if (session.ridingVehicleId !== undefined || vehicle.riderId) break;
          vehicle.riderId = session.id;
          session.ridingVehicleId = vehicle.id;
          vehicle.input = createIdleServerVehicleInput(vehicle.id);
          this.broadcastDimension(vehicle.dimension, PacketType.S2C_VEHICLE_RIDER, {
            vehicleId: vehicle.id,
            riderId: session.id,
          });
          break;
        }

        if (intent.action === 'dismount') {
          if (vehicle.riderId !== session.id || session.ridingVehicleId !== vehicle.id) break;
          vehicle.riderId = undefined;
          session.ridingVehicleId = undefined;
          vehicle.input = createIdleServerVehicleInput(vehicle.id);
          this.broadcastDimension(vehicle.dimension, PacketType.S2C_VEHICLE_RIDER, {
            vehicleId: vehicle.id,
            riderId: null,
          });
          break;
        }

        if (intent.action === 'open_container') {
          if (vehicle.type !== 'chest_boat' || !vehicle.inventory) break;
          this.closeServerContainer(session);
          session.openContainer = { source: 'vehicle', vehicleId: vehicle.id, cursor: null };
          this.sendOpenContainerState(session);
          break;
        }

        if (intent.action === 'attack') {
          this.destroyServerVehicle(vehicle);
        }
        break;
      }

      case PacketType.C2S_VEHICLE_INPUT: {
        const intent = parseServerVehicleInput(packet.payload);
        if (!intent) break;
        const vehicle = this.vehicles.get(intent.vehicleId);
        if (!vehicle || vehicle.dimension !== session.dimension) break;
        if (vehicle.riderId !== session.id || session.ridingVehicleId !== vehicle.id) break;
        vehicle.input = intent;
        break;
      }

      case PacketType.C2S_MOB_INTERACT: {
        const intent = parseServerMobRideInteraction(packet.payload);
        if (!intent) break;
        const mob = this.mobs.get(intent.mobId);
        if (!mob || mob.dimension !== session.dimension || mob.health <= 0) break;
        if (!isEntityAttackInReach(session, mob.position, session.gameMode)) break;
        if (!canMountMob(mob.type, !!mob.isBaby, !!mob.isTamed)) break;

        if (intent.action === 'mount') {
          if (session.ridingVehicleId !== undefined || session.ridingMobId !== undefined || mob.riderId) break;
          if (mob.type === 'horse' && !mob.isTamed) {
            mob.isTamed = shouldTameEntity(this.seed, this.gameTick, mob.id, 0, 0.2);
            this.broadcastDimension(mob.dimension, PacketType.S2C_MOB_STATE, {
              id: mob.id,
              health: mob.health,
              hurtTimer: mob.hurtTimer,
              isTamed: mob.isTamed,
            });
          }
          mob.riderId = session.id;
          mob.riderInput = createIdleServerMobRideInput(mob.id);
          session.ridingMobId = mob.id;
          this.broadcastDimension(mob.dimension, PacketType.S2C_MOB_RIDER, {
            mobId: mob.id,
            riderId: session.id,
          });
          break;
        }

        if (mob.riderId !== session.id || session.ridingMobId !== mob.id) break;
        mob.riderId = undefined;
        mob.riderInput = createIdleServerMobRideInput(mob.id);
        session.ridingMobId = undefined;
        this.broadcastDimension(mob.dimension, PacketType.S2C_MOB_RIDER, {
          mobId: mob.id,
          riderId: null,
        });
        break;
      }

      case PacketType.C2S_MOB_INPUT: {
        const intent = parseServerMobRideInput(packet.payload);
        if (!intent) break;
        const mob = this.mobs.get(intent.mobId);
        if (!mob || mob.dimension !== session.dimension) break;
        if (mob.riderId !== session.id || session.ridingMobId !== mob.id) break;
        mob.riderInput = intent;
        break;
      }

      case PacketType.C2S_INTERACT_ENTITY: {
        const intent = parseEntityAttackIntent(packet.payload);
        if (!intent) break;

        const held = session.inventory[session.selectedSlot];
        const profile = getServerMeleeProfile(held);
        const attackStrength = getAttackStrength(session.lastAttackTick, this.gameTick, profile.cooldownTicks);
        const feetBlock = this.getBlock(Math.floor(session.x), Math.floor(session.y), Math.floor(session.z), session.dimension);
        const critical = isServerCriticalHit(attackStrength, {
          descending: session.descending,
          onGround: session.onGround,
          sprinting: session.sprinting,
          flying: session.flying,
          inWater: BlockRegistry.isFluid(feetBlock),
        });
        const damage = getServerMeleeDamage(held, session.lastAttackTick, this.gameTick, critical);
        const knockback = getServerKnockbackPlan(held, attackStrength, session.sprinting);

        if (typeof intent.entityId === 'number') {
          const mob = this.mobs.get(intent.entityId);
          if (!mob || mob.health <= 0 || mob.dimension !== session.dimension) break;
          if (!isEntityAttackInReach(session, mob.position, session.gameMode)) break;

          session.lastAttackTick = this.gameTick;
          mob.health -= damage;
          mob.hurtTimer = 0.5;
          this.applyMeleeKnockbackToMob(session, mob, knockback.strength);
          if (knockback.sprintKnockback) session.sprinting = false;
          this.damageHeldMeleeItem(session, profile.durabilityCost);
          this.broadcastDimension(session.dimension, PacketType.S2C_MOB_STATE, {
            id: mob.id,
            health: mob.health,
            hurtTimer: mob.hurtTimer
          });
          this.broadcastDimension(session.dimension, PacketType.S2C_SOUND, {
            type: critical ? 'critical_hit' : 'hit', x: mob.position.x, y: mob.position.y, z: mob.position.z
          });
          if (mob.health <= 0) this.handleMobDeath(mob);
          break;
        }

        const target = this.players.get(intent.entityId);
        if (!target || target.id === session.id || target.dimension !== session.dimension) break;
        if (!isEntityAttackInReach(session, target, session.gameMode)) break;

        session.lastAttackTick = this.gameTick;
        this.damageHeldMeleeItem(session, profile.durabilityCost);
        const applied = this.applyServerDamageToPlayer(
          target,
          damage,
          'mob',
          new THREE.Vector3(session.x, session.y + 1.62, session.z),
          profile.isAxe,
        );
        if (applied > 0) {
          const resistance = getNetheriteKnockbackResistance(target.armor);
          this.applyMeleeKnockbackToPlayer(session, target, applyKnockbackResistance(knockback.strength, resistance));
        }
        // Java 26.3 RC3 (MC-311799): sprint-hitting another player no longer
        // slows/cancels sprint on the attacker. Mob hits keep their legacy path.
        break;
      }

      case PacketType.C2S_ITEM_USE: {
        const intent = parseServerItemUseIntent(packet.payload);
        if (!intent) break;
        const held = session.inventory[session.selectedSlot];
        if (!isValidServerItemUseForHeldStack(intent, held)) break;

        if (intent.kind === 'block') {
          this.handleServerBlockItemUse(session, intent, held!);
        } else {
          this.handleServerEntityItemUse(session, intent.entityId, held!);
        }
        break;
      }

      // P5.1: server-authoritative item actions (bow release / throwables).
      case PacketType.C2S_ITEM_ACTION: {
        const request = parseItemAction(packet.payload);
        if (!request) break;
        const held = session.inventory[session.selectedSlot];
        if (!isValidItemActionForHeldStack(request, held)) break;

        const origin = new THREE.Vector3(session.x, session.y + 1.6, session.z);
        const dir = new THREE.Vector3(request.direction.x, request.direction.y, request.direction.z);

        if (request.action === 'bow_release') {
          if (session.gameMode !== 'creative') {
            const ammoSlot = session.inventory.findIndex((slot) => slot && (slot.id & 0x3FF) === 262);
            if (ammoSlot < 0) break;
            const ammo = session.inventory[ammoSlot]!;
            ammo.count -= 1;
            if (ammo.count <= 0) session.inventory[ammoSlot] = null;
          }

          const params = getBowReleaseParams(request.power ?? 0, getServerBowPowerLevel(held));
          if (session.gameMode !== 'creative') {
            session.inventory[session.selectedSlot] = damageDurableStack(held, 1, 'tool');
          }
          this.spawnProjectile(session, 'arrow', origin, dir.multiplyScalar(params.speed), {
            damage: params.damage,
            velocityY: 0.5,
          });
          this.syncPlayerInventory(session);
          this.broadcastDimension(session.dimension, PacketType.S2C_SOUND, {
            type: 'bow_shoot', x: origin.x, y: origin.y, z: origin.z
          });
          break;
        }

        if (request.action === 'ender_eye_throw') {
          if (session.dimension !== 0) break;
          const target = findEnderEyeTarget(this.seed, session.x, session.z);
          const targetPosition = new THREE.Vector3(target.x, target.y, target.z);
          const eyeDirection = targetPosition.sub(origin);
          eyeDirection.y = 0;
          if (eyeDirection.lengthSq() <= 1e-9) break;
          eyeDirection.normalize();
          const velocity = eyeDirection.multiplyScalar(12);
          velocity.y = 4;
          this.spawnProjectile(session, 'eye_of_ender', origin, velocity, { damage: 0 });
          if (session.gameMode !== 'creative') {
            session.inventory[session.selectedSlot] = consumeOne(held!);
          }
          this.syncPlayerInventory(session);
          break;
        }

        const type = getThrowableProjectileType(held!.id);
        if (!type) break;
        const potionEffect = type === 'potion' ? held?.potion?.effect : undefined;
        const speed = type === 'firework_rocket' ? 18 : 15;
        const velocityY = type === 'firework_rocket' ? 4.5 : 2.5;
        this.spawnProjectile(session, type, origin, dir.multiplyScalar(speed), {
          damage: type === 'experience_bottle' ? 0 : type === 'trident' ? 9 : type === 'firework_rocket' ? 5 : 1,
          velocityY,
          potionEffect,
        });
        if (session.gameMode !== 'creative') {
          if (type === 'trident') {
            session.inventory[session.selectedSlot] = damageDurableStack(held, 1, 'tool');
          } else {
            session.inventory[session.selectedSlot] = consumeOne(held!);
          }
        }
        this.syncPlayerInventory(session);
        break;
      }

      case PacketType.C2S_FISHING_ACTION: {
        const request = parseServerFishingAction(packet.payload);
        if (!request) break;
        const held = session.inventory[session.selectedSlot];
        const heldName = held ? ItemRegistry.get(held.id)?.name : undefined;
        if (!held || held.id !== request.itemId || heldName !== 'fishing_rod') break;

        const existing = this.fishingStates.get(session.id);
        if (request.action === 'cast') {
          if (existing) break;
          const origin = new THREE.Vector3(session.x, session.y + 1.6, session.z);
          const velocity = new THREE.Vector3(
            request.direction.x,
            request.direction.y,
            request.direction.z,
          ).multiplyScalar(14);
          velocity.y += 2.2;
          const state: ServerFishingState = {
            position: origin,
            velocity,
            phase: 'flying',
            waitSeconds: 0,
            hookedSeconds: 0,
            dimension: session.dimension,
          };
          this.fishingStates.set(session.id, state);
          this.sendFishingState(session, state);
          break;
        }

        if (!existing) break;
        if (existing.phase === 'hooked') {
          const lootId = rollServerFishingLoot(Math.random);
          this.spawnDroppedStack(
            { id: lootId, count: 1 },
            existing.position.x,
            existing.position.y + 0.2,
            existing.position.z,
            existing.dimension,
            0.1,
          );
          this.addServerXp(session, rollServerFishingXp(Math.random));
          this.damageServerHeldTool(session, held);
          this.broadcastDimension(existing.dimension, PacketType.S2C_SOUND, {
            type: 'pickup', x: existing.position.x, y: existing.position.y, z: existing.position.z,
          });
        } else if (existing.phase === 'waiting' && !Number.isFinite(existing.waitSeconds)) {
          this.damageServerHeldTool(session, held);
          const afterFirstDamage = session.inventory[session.selectedSlot];
          if (afterFirstDamage) this.damageServerHeldTool(session, afterFirstDamage);
        }
        this.fishingStates.delete(session.id);
        this.sendFishingState(session, null);
        break;
      }

      // P5.2: client uploads its simulated state so server pushes stay convergent.
      case PacketType.C2S_PLAYER_STATE: {
        const clamped = clampPlayerState(packet.payload);
        session.isBlocking = packet.payload?.blocking === true;
        session.health = session.healthAuthorityLockSeconds > 0
          ? Math.min(session.health, clamped.health)
          : clamped.health;
        session.hunger = clamped.hunger;
        session.oxygen = clamped.oxygen;
        break;
      }

      // P5.2: server-validated consumable use.
      case PacketType.C2S_ITEM_CONSUME: {
        const { slot, itemId } = packet.payload;
        if (!Number.isInteger(slot) || slot < 0 || slot >= session.inventory.length) break;
        const stack = session.inventory[slot];
        if (validateConsume(stack, itemId)) {
          const remainderItemId = getDefaultUseRemainderItemId(itemId);
          const outcome = consumeOneWithRemainder(stack!, remainderItemId);
          session.inventory[slot] = outcome.stack;
          if (outcome.remainder) {
            const insertion = insertItemStackIntoSlots(session.inventory, outcome.remainder);
            if (insertion.remaining) {
              this.spawnDroppedStack(
                insertion.remaining,
                session.x,
                session.y + 0.5,
                session.z,
                session.dimension,
                0,
              );
            }
          }
          this.sendTo(session, PacketType.S2C_INVENTORY_SYNC, {
            slots: session.inventory,
            armor: session.armor,
            offhand: session.offhand,
          });
        }
        break;
      }

      // P5.3: authoritative container transaction session.
      case PacketType.C2S_CONTAINER_OPEN: {
        const { x, y, z } = packet.payload;
        if (!isValidBlockCoordinate(x) || !isValidWorldY(y, WORLD_HEIGHT) || !isValidBlockCoordinate(z)) break;
        if (!isBlockActionInReach(session, x, y, z, session.gameMode)) break;
        const blockId = this.getBlock(x, y, z, session.dimension);
        const name = BlockRegistry.get(blockId)?.name ?? '';
        const kind = name.includes('hopper') ? 'hopper' : (name.includes('chest') || name.includes('barrel') ? 'chest' : null);
        if (!kind) break;
        this.closeServerContainer(session);
        const key = this.dimensionContainerKey(session.dimension, x, y, z);
        if (!this.containerData.has(key)) this.containerData.set(key, createContainerSlots(kind));
        session.openContainer = { source: 'block', x, y, z, key, cursor: null };
        this.sendOpenContainerState(session);
        break;
      }

      case PacketType.C2S_CONTAINER_CLICK: {
        const intent = parseContainerClickIntent(packet.payload);
        const open = session.openContainer;
        if (!intent || !open) break;
        if (!this.isOpenContainerInReach(session, open)) {
          this.closeServerContainer(session);
          break;
        }
        const slots = this.getOpenContainerSlots(open);
        if (!slots) break;
        const next = applyServerContainerClick({
          containerSlots: slots,
          playerSlots: session.inventory,
          cursor: open.cursor,
        }, intent);
        if (!next) {
          this.sendOpenContainerState(session);
          break;
        }
        this.setOpenContainerSlots(open, next.containerSlots);
        session.inventory = next.playerSlots;
        open.cursor = next.cursor;
        this.syncPlayerInventory(session);
        this.sendOpenContainerState(session);
        break;
      }

      case PacketType.C2S_CONTAINER_CLOSE: {
        this.closeServerContainer(session);
        break;
      }

      case PacketType.C2S_CONTAINER_UPDATE: {
        // Legacy whole-container snapshots are never authoritative. A stale or
        // malicious client receives the canonical server state instead.
        this.sendOpenContainerState(session);
        break;
      }
    }
  }

  private applyServerHeldReplacement(session: PlayerSession, held: ItemStack, replacementItemId: number) {
    const result = replaceOneHeldItem(held, replacementItemId, session.gameMode === 'creative');
    session.inventory[session.selectedSlot] = result.held;
    if (result.remainder) {
      const insertion = insertItemStackIntoSlots(session.inventory, result.remainder);
      if (insertion.remaining) {
        this.spawnDroppedStack(
          insertion.remaining,
          session.x,
          session.y + 0.5,
          session.z,
          session.dimension,
          0,
        );
      }
    }
    this.syncPlayerInventory(session);
  }

  private damageServerHeldTool(session: PlayerSession, held: ItemStack) {
    if (session.gameMode === 'creative') return;
    session.inventory[session.selectedSlot] = damageDurableStack(held, 1, 'tool');
    this.syncPlayerInventory(session);
  }

  private broadcastServerBlockUpdate(x: number, y: number, z: number, blockId: number, dimension: number, metadata?: BlockMetadata | null) {
    this.broadcastDimension(dimension, PacketType.S2C_BLOCK_UPDATE, {
      x, y, z, blockId, metadata: metadata ?? null, dimension,
    });
  }

  private isServerWaterNearby(x: number, y: number, z: number, dimension: number): boolean {
    for (let dx = -4; dx <= 4; dx++) {
      for (let dy = 0; dy <= 1; dy++) {
        for (let dz = -4; dz <= 4; dz++) {
          const id = this.getBlock(x + dx, y + dy, z + dz, dimension) & 0x3ff;
          if (id === 8 || id === 9) return true;
        }
      }
    }
    return false;
  }

  private consumeServerHeldItem(session: PlayerSession, held: ItemStack) {
    if (session.gameMode === 'creative') return;
    session.inventory[session.selectedSlot] = consumeHeldStack(held);
    this.syncPlayerInventory(session);
  }

  private handleServerBlockItemUse(session: PlayerSession, intent: ServerBlockItemUseIntent, held: ItemStack): boolean {
    if (!isValidWorldY(intent.y, WORLD_HEIGHT)) return false;
    if (!isBlockActionInReach(session, intent.x, intent.y, intent.z, session.gameMode)) return false;

    const item = ItemRegistry.get(held.id);
    const itemName = item?.name ?? '';
    const targetBlockId = this.getBlock(intent.x, intent.y, intent.z, session.dimension);
    const targetBlock = BlockRegistry.get(targetBlockId);
    if (!targetBlock) return false;

    const spawnEggMobType = spawnEggMobTypeForItemName(itemName);
    if (spawnEggMobType) {
      const place = adjacentBlockPosition(intent.x, intent.y, intent.z, intent.face);
      if (!isValidWorldY(place.y, WORLD_HEIGHT)) return false;
      if (this.isSolidBlock(place.x, place.y, place.z, session.dimension)) return false;
      this.spawnMob(spawnEggMobType, place.x + 0.5, place.y, place.z + 0.5, session.dimension);
      this.consumeServerHeldItem(session, held);
      this.broadcastDimension(session.dimension, PacketType.S2C_SOUND, {
        type: 'place', x: place.x, y: place.y, z: place.z,
      });
      return true;
    }

    if (itemName === 'bucket') {
      const filledName = bucketFillItemName(targetBlock.name);
      if (!filledName) return false;
      const filledBucket = ItemRegistry.getByName(filledName);
      if (!filledBucket) return false;

      this.setBlock(intent.x, intent.y, intent.z, 0, session.dimension);
      this.broadcastServerBlockUpdate(intent.x, intent.y, intent.z, 0, session.dimension);
      this.applyServerHeldReplacement(session, held, filledBucket.id);
      this.broadcastDimension(session.dimension, PacketType.S2C_SOUND, {
        type: 'pickup', x: intent.x, y: intent.y, z: intent.z,
      });
      return true;
    }

    const bucketBlockName = bucketPlacedBlockName(itemName);
    if (bucketBlockName) {
      const place = adjacentBlockPosition(intent.x, intent.y, intent.z, intent.face);
      if (!isValidWorldY(place.y, WORLD_HEIGHT)) return false;
      const currentId = this.getBlock(place.x, place.y, place.z, session.dimension);
      const currentName = BlockRegistry.get(currentId)?.name;
      const replaceable = currentId === 0
        || BlockRegistry.isFluid(currentId)
        || isPlacementReplaceableBlockName(currentName);
      if (!replaceable) return false;

      const placedBlock = BlockRegistry.getByName(bucketBlockName);
      const emptyBucket = ItemRegistry.getByName('bucket');
      if (!placedBlock || !emptyBucket) return false;
      const metadata = bucketBlockName === 'powder_snow' ? null : { fluidLevel: 8 };
      this.setBlock(place.x, place.y, place.z, placedBlock.id, session.dimension, metadata);
      this.broadcastServerBlockUpdate(place.x, place.y, place.z, placedBlock.id, session.dimension, metadata);
      this.applyServerHeldReplacement(session, held, emptyBucket.id);
      this.broadcastDimension(session.dimension, PacketType.S2C_SOUND, {
        type: 'place', x: place.x, y: place.y, z: place.z,
      });
      return true;
    }

    if (isSignBlockName(targetBlock.name) && isServerSignStylingItemName(itemName)) {
      const metadata = this.getBlockMetadata(intent.x, intent.y, intent.z, session.dimension);
      const side = getSignSideForPlayer(
        targetBlock.name,
        metadata,
        intent.x,
        intent.z,
        session.x,
        session.z,
      );
      const result = applySignInteraction(metadata, itemName, side);
      if (!result.consumeItem) return false;
      this.setBlock(intent.x, intent.y, intent.z, targetBlockId, session.dimension, result.metadata);
      this.broadcastServerBlockUpdate(intent.x, intent.y, intent.z, targetBlockId, session.dimension, result.metadata);
      this.consumeServerHeldItem(session, held);
      return true;
    }

    const itemOnBlockKind = serverItemOnBlockKind(itemName);
    if (itemOnBlockKind === 'shovel') {
      if (intent.face !== 'up') return false;
      if (!resolveShovelPathTargetName(targetBlock.name)) return false;
      if (intent.y + 1 >= WORLD_HEIGHT || this.getBlock(intent.x, intent.y + 1, intent.z, session.dimension) !== 0) return false;
      const path = BlockRegistry.getByName('dirt_path') ?? BlockRegistry.getByName('grass_path');
      if (!path) return false;
      this.setBlock(intent.x, intent.y, intent.z, path.id, session.dimension, null);
      this.broadcastServerBlockUpdate(intent.x, intent.y, intent.z, path.id, session.dimension, null);
      this.damageServerHeldTool(session, held);
      this.broadcastDimension(session.dimension, PacketType.S2C_SOUND, {
        type: 'place', x: intent.x, y: intent.y, z: intent.z,
      });
      return true;
    }

    if (itemOnBlockKind === 'axe') {
      const strippedName = resolveAxeStrippedBlockName(targetBlock.name);
      if (!strippedName) return false;
      const stripped = BlockRegistry.getByName(strippedName);
      if (!stripped) return false;
      const metadata = this.getBlockMetadata(intent.x, intent.y, intent.z, session.dimension) ?? null;
      this.setBlock(intent.x, intent.y, intent.z, stripped.id, session.dimension, metadata);
      this.broadcastServerBlockUpdate(intent.x, intent.y, intent.z, stripped.id, session.dimension, metadata);
      this.damageServerHeldTool(session, held);
      this.broadcastDimension(session.dimension, PacketType.S2C_SOUND, {
        type: 'place', x: intent.x, y: intent.y, z: intent.z,
      });
      return true;
    }

    if (itemOnBlockKind === 'hoe') {
      if (intent.face === 'down') return false;
      if (!resolveHoeFarmlandTargetName(targetBlock.name)) return false;
      if (intent.y + 1 >= WORLD_HEIGHT || this.getBlock(intent.x, intent.y + 1, intent.z, session.dimension) !== 0) return false;
      const farmland = BlockRegistry.getByName('farmland');
      if (!farmland) return false;
      const moisture = this.isServerWaterNearby(intent.x, intent.y, intent.z, session.dimension) ? 7 : 0;
      const packedFarmland = (moisture << 10) | farmland.id;
      this.setBlock(intent.x, intent.y, intent.z, packedFarmland, session.dimension, null);
      this.broadcastServerBlockUpdate(intent.x, intent.y, intent.z, packedFarmland, session.dimension, null);
      this.damageServerHeldTool(session, held);
      this.broadcastDimension(session.dimension, PacketType.S2C_SOUND, {
        type: 'place', x: intent.x, y: intent.y, z: intent.z,
      });
      return true;
    }

    if (itemOnBlockKind === 'fire_charge') {
      if (targetBlock.name === 'tnt') {
        this.setBlock(intent.x, intent.y, intent.z, 0, session.dimension);
        this.broadcastServerBlockUpdate(intent.x, intent.y, intent.z, 0, session.dimension);
        const id = this.nextEntityId++;
        this.primedTnt.set(id, {
          id,
          position: new THREE.Vector3(intent.x + 0.5, intent.y + 0.5, intent.z + 0.5),
          fuseSeconds: SERVER_TNT_FUSE_SECONDS,
          dimension: session.dimension,
        });
        this.consumeServerHeldItem(session, held);
        this.broadcastDimension(session.dimension, PacketType.S2C_SOUND, {
          type: 'place', x: intent.x, y: intent.y, z: intent.z,
        });
        return true;
      }

      const place = adjacentBlockPosition(intent.x, intent.y, intent.z, intent.face);
      if (!isValidWorldY(place.y, WORLD_HEIGHT) || this.getBlock(place.x, place.y, place.z, session.dimension) !== 0) return false;
      const portalUpdates: Array<{ x: number; y: number; z: number; id: number }> = [];
      const activated = this.dimensionGen.findAndActivatePortalFrame(
        (x, y, z) => this.getBlock(x, y, z, session.dimension),
        (x, y, z, id) => {
          this.setBlock(x, y, z, id, session.dimension);
          portalUpdates.push({ x, y, z, id });
        },
        place.x,
        place.y,
        place.z,
      );
      if (activated) {
        for (const update of portalUpdates) {
          this.broadcastServerBlockUpdate(update.x, update.y, update.z, update.id, session.dimension);
        }
        this.consumeServerHeldItem(session, held);
        return true;
      }

      const fire = BlockRegistry.getByName('fire');
      if (!fire) return false;
      this.setBlock(place.x, place.y, place.z, fire.id, session.dimension);
      this.broadcastServerBlockUpdate(place.x, place.y, place.z, fire.id, session.dimension);
      this.consumeServerHeldItem(session, held);
      this.broadcastDimension(session.dimension, PacketType.S2C_SOUND, {
        type: 'place', x: place.x, y: place.y, z: place.z,
      });
      return true;
    }

    if (itemOnBlockKind === 'ender_eye') {
      if ((targetBlockId & 0x3ff) !== END_PORTAL_FRAME_BLOCK_ID) return false;
      const filledFrame = fillEndPortalFrameBlock(targetBlockId);
      if (filledFrame === null) return false;
      this.setBlock(intent.x, intent.y, intent.z, filledFrame, session.dimension);
      this.broadcastServerBlockUpdate(intent.x, intent.y, intent.z, filledFrame, session.dimension);
      this.consumeServerHeldItem(session, held);

      const center = findCompleteEndPortalCenter(
        (x, y, z) => this.getBlock(x, y, z, session.dimension),
        intent.x,
        intent.y,
        intent.z,
      );
      if (center) {
        for (const cell of getEndPortalInteriorCells(center.x, center.y, center.z)) {
          this.setBlock(cell.x, cell.y, cell.z, END_PORTAL_BLOCK_ID, session.dimension);
          this.broadcastServerBlockUpdate(cell.x, cell.y, cell.z, END_PORTAL_BLOCK_ID, session.dimension);
        }
      }
      this.broadcastDimension(session.dimension, PacketType.S2C_SOUND, {
        type: 'place', x: intent.x, y: intent.y, z: intent.z,
      });
      return true;
    }

    if (itemOnBlockKind === 'bone_meal') {
      if (targetBlock.name === 'shelf_mushroom') {
        const metadata = this.getBlockMetadata(intent.x, intent.y, intent.z, session.dimension);
        if (metadata?.shelfMushroomSize === 'large') return false;
        const nextMetadata: BlockMetadata = { ...metadata, shelfMushroomSize: 'large' };
        this.setBlock(intent.x, intent.y, intent.z, targetBlockId, session.dimension, nextMetadata);
        this.broadcastServerBlockUpdate(intent.x, intent.y, intent.z, targetBlockId, session.dimension, nextMetadata);
        if (session.gameMode !== 'creative') {
          session.inventory[session.selectedSlot] = consumeHeldStack(held);
          this.syncPlayerInventory(session);
        }
        this.broadcastDimension(session.dimension, PacketType.S2C_SOUND, {
          type: 'place', x: intent.x, y: intent.y, z: intent.z,
        });
        return true;
      }

      if (targetBlock.name !== 'red_shrub') return false;
      const start = Math.floor(coordinateRandom(
        this.seed,
        intent.x,
        this.gameTick + 2630,
        intent.z,
      ) * 8);
      for (const offset of rotateBoneMealSpreadOffsets26_3(start)) {
        const nx = intent.x + offset.x;
        const nz = intent.z + offset.z;
        if (this.getBlock(nx, intent.y, nz, session.dimension) !== 0) continue;
        if (!this.isSolidBlock(nx, intent.y - 1, nz, session.dimension)) continue;
        this.setBlock(nx, intent.y, nz, targetBlockId, session.dimension, null);
        this.broadcastServerBlockUpdate(nx, intent.y, nz, targetBlockId, session.dimension, null);
        if (session.gameMode !== 'creative') {
          session.inventory[session.selectedSlot] = consumeHeldStack(held);
          this.syncPlayerInventory(session);
        }
        this.broadcastDimension(session.dimension, PacketType.S2C_SOUND, {
          type: 'place', x: nx, y: intent.y, z: nz,
        });
        return true;
      }
      return false;
    }

    if (itemName === 'shears' && targetBlock.name === 'pumpkin') {
      const carved = BlockRegistry.getByName('carved_pumpkin');
      const seeds = ItemRegistry.getByName('pumpkin_seeds');
      if (!carved || !seeds) return false;
      const metadata: BlockMetadata = { facing: horizontalFacingFromYaw(session.yaw) };
      this.setBlock(intent.x, intent.y, intent.z, carved.id, session.dimension, metadata);
      this.broadcastServerBlockUpdate(intent.x, intent.y, intent.z, carved.id, session.dimension, metadata);
      this.spawnDroppedItem(seeds.id, 4, intent.x + 0.5, intent.y + 0.8, intent.z + 0.5, session.dimension, 0.5);
      this.damageServerHeldTool(session, held);
      this.broadcastDimension(session.dimension, PacketType.S2C_SOUND, {
        type: 'place', x: intent.x, y: intent.y, z: intent.z,
      });
      return true;
    }

    if (isMinecartItemName(itemName)) {
      if (!BlockRegistry.isRail(targetBlockId)) return false;
      const vehicle: ServerVehicle = {
        id: this.nextEntityId++,
        type: 'minecart',
        position: new THREE.Vector3(intent.x + 0.5, intent.y + 0.05, intent.z + 0.5),
        velocity: new THREE.Vector3(),
        rotationY: session.yaw,
        speed: 0,
        sourceItemId: held.id,
        dimension: session.dimension,
        inventory: null,
        input: createIdleServerVehicleInput(this.nextEntityId - 1),
      };
      this.vehicles.set(vehicle.id, vehicle);
      this.broadcastDimension(session.dimension, PacketType.S2C_VEHICLE_SPAWN, {
        id: vehicle.id,
        type: vehicle.type,
        sourceItemId: vehicle.sourceItemId,
        x: vehicle.position.x,
        y: vehicle.position.y,
        z: vehicle.position.z,
        rotationY: vehicle.rotationY,
        riderId: null,
        dimension: vehicle.dimension,
      });
      this.consumeServerHeldItem(session, held);
      this.broadcastDimension(session.dimension, PacketType.S2C_SOUND, {
        type: 'place', x: intent.x, y: intent.y, z: intent.z,
      });
      return true;
    }

    const vehicleType = vehicleTypeForBoatItemName(itemName);
    if (vehicleType) {
      const place = adjacentBlockPosition(intent.x, intent.y, intent.z, intent.face);
      if (!isValidWorldY(place.y, WORLD_HEIGHT)) return false;
      if (this.isSolidBlock(place.x, place.y, place.z, session.dimension)) return false;
      const vehicle: ServerVehicle = {
        id: this.nextEntityId++,
        type: vehicleType,
        position: new THREE.Vector3(place.x + 0.5, place.y + 0.2, place.z + 0.5),
        velocity: new THREE.Vector3(),
        rotationY: session.yaw,
        speed: 0,
        sourceItemId: held.id,
        dimension: session.dimension,
        inventory: vehicleType === 'chest_boat' ? createContainerSlots('chest') : null,
        input: createIdleServerVehicleInput(this.nextEntityId - 1),
      };
      this.vehicles.set(vehicle.id, vehicle);
      this.broadcastDimension(session.dimension, PacketType.S2C_VEHICLE_SPAWN, {
        id: vehicle.id,
        type: vehicle.type,
        sourceItemId: vehicle.sourceItemId,
        x: vehicle.position.x,
        y: vehicle.position.y,
        z: vehicle.position.z,
        rotationY: vehicle.rotationY,
        riderId: null,
        dimension: vehicle.dimension,
      });
      if (session.gameMode !== 'creative') {
        session.inventory[session.selectedSlot] = consumeHeldStack(held);
        this.syncPlayerInventory(session);
      }
      this.broadcastDimension(session.dimension, PacketType.S2C_SOUND, {
        type: 'place', x: place.x, y: place.y, z: place.z,
      });
      return true;
    }

    if (itemName === 'flint_and_steel') {
      if (targetBlock.name === 'tnt') {
        this.setBlock(intent.x, intent.y, intent.z, 0, session.dimension);
        this.broadcastServerBlockUpdate(intent.x, intent.y, intent.z, 0, session.dimension);
        const id = this.nextEntityId++;
        this.primedTnt.set(id, {
          id,
          position: new THREE.Vector3(intent.x + 0.5, intent.y + 0.5, intent.z + 0.5),
          fuseSeconds: SERVER_TNT_FUSE_SECONDS,
          dimension: session.dimension,
        });
        this.damageServerHeldTool(session, held);
        this.broadcastDimension(session.dimension, PacketType.S2C_SOUND, {
          type: 'place', x: intent.x, y: intent.y, z: intent.z,
        });
        return true;
      }

      const place = adjacentBlockPosition(intent.x, intent.y, intent.z, intent.face);
      if (!isValidWorldY(place.y, WORLD_HEIGHT) || this.getBlock(place.x, place.y, place.z, session.dimension) !== 0) return false;

      const portalUpdates: Array<{ x: number; y: number; z: number; id: number }> = [];
      const activated = this.dimensionGen.findAndActivatePortalFrame(
        (x, y, z) => this.getBlock(x, y, z, session.dimension),
        (x, y, z, id) => {
          this.setBlock(x, y, z, id, session.dimension);
          portalUpdates.push({ x, y, z, id });
        },
        place.x,
        place.y,
        place.z,
      );
      if (activated) {
        for (const update of portalUpdates) {
          this.broadcastServerBlockUpdate(update.x, update.y, update.z, update.id, session.dimension);
        }
        this.damageServerHeldTool(session, held);
        return true;
      }

      const fire = BlockRegistry.getByName('fire');
      if (!fire) return false;
      this.setBlock(place.x, place.y, place.z, fire.id, session.dimension);
      this.broadcastServerBlockUpdate(place.x, place.y, place.z, fire.id, session.dimension);
      this.damageServerHeldTool(session, held);
      this.broadcastDimension(session.dimension, PacketType.S2C_SOUND, {
        type: 'place', x: place.x, y: place.y, z: place.z,
      });
      return true;
    }

    return false;
  }

  private handleServerEntityItemUse(session: PlayerSession, entityId: number, held: ItemStack): boolean {
    const itemName = ItemRegistry.get(held.id)?.name;
    const mob = this.mobs.get(entityId);
    if (!itemName || !mob || mob.dimension !== session.dimension || mob.health <= 0) return false;
    if (!isEntityAttackInReach(session, mob.position, session.gameMode)) return false;

    if (itemName === 'name_tag') {
      const customName = getNameTagLabel(held);
      if (!customName) return false;
      mob.customName = customName;
      this.consumeServerHeldItem(session, held);
      this.broadcastDimension(session.dimension, PacketType.S2C_MOB_STATE, {
        id: mob.id,
        health: mob.health,
        hurtTimer: mob.hurtTimer,
        customName,
      });
      this.broadcastDimension(session.dimension, PacketType.S2C_SOUND, {
        type: 'place', x: mob.position.x, y: mob.position.y, z: mob.position.z,
      });
      return true;
    }

    if (itemName === 'saddle') {
      if (!canApplySaddle(mob.type, !!mob.isBaby, !!mob.isTamed, !!mob.isSaddled)) return false;
      mob.isSaddled = true;
      this.consumeServerHeldItem(session, held);
      this.broadcastDimension(session.dimension, PacketType.S2C_MOB_STATE, {
        id: mob.id,
        health: mob.health,
        hurtTimer: mob.hurtTimer,
        isSaddled: true,
      });
      this.broadcastDimension(session.dimension, PacketType.S2C_SOUND, {
        type: 'place', x: mob.position.x, y: mob.position.y, z: mob.position.z,
      });
      return true;
    }

    if (itemName !== 'shears' || mob.type !== 'sheep') return false;
    if (mob.isBaby || mob.isSheared) return false;

    mob.isSheared = true;
    const woolCount = 1 + Math.floor(Math.random() * 3);
    this.spawnDroppedItem(
      35,
      woolCount,
      mob.position.x,
      mob.position.y + 0.7,
      mob.position.z,
      mob.dimension,
      0.5,
    );
    this.damageServerHeldTool(session, held);
    this.broadcastDimension(session.dimension, PacketType.S2C_MOB_STATE, {
      id: mob.id,
      health: mob.health,
      hurtTimer: mob.hurtTimer,
      isSheared: true,
    });
    this.broadcastDimension(session.dimension, PacketType.S2C_SOUND, {
      type: 'break', x: mob.position.x, y: mob.position.y, z: mob.position.z,
    });
    return true;
  }

  private destroyServerVehicle(vehicle: ServerVehicle) {
    for (const player of this.players.values()) {
      if (player.openContainer?.source === 'vehicle' && player.openContainer.vehicleId === vehicle.id) {
        this.closeServerContainer(player);
      }
      if (player.ridingVehicleId === vehicle.id) {
        player.ridingVehicleId = undefined;
      }
    }
    if (vehicle.riderId) {
      this.broadcastDimension(vehicle.dimension, PacketType.S2C_VEHICLE_RIDER, {
        vehicleId: vehicle.id,
        riderId: null,
      });
    }
    if (vehicle.inventory) {
      for (const stack of vehicle.inventory) {
        if (!stack) continue;
        this.spawnDroppedStack(
          stack,
          vehicle.position.x,
          vehicle.position.y + 0.35,
          vehicle.position.z,
          vehicle.dimension,
          0.5,
        );
      }
    }
    this.spawnDroppedStack(
      { id: vehicle.sourceItemId, count: 1 },
      vehicle.position.x,
      vehicle.position.y + 0.25,
      vehicle.position.z,
      vehicle.dimension,
      0.5,
    );
    this.vehicles.delete(vehicle.id);
    this.broadcastDimension(vehicle.dimension, PacketType.S2C_VEHICLE_DESPAWN, {
      id: vehicle.id,
      dimension: vehicle.dimension,
    });
  }

  private tickServerMinecartPhysics(vehicle: ServerVehicle, dt: number) {
    const cx = Math.floor(vehicle.position.x);
    const cy = Math.floor(vehicle.position.y);
    const cz = Math.floor(vehicle.position.z);
    const block = this.getBlock(cx, cy, cz, vehicle.dimension);

    if (BlockRegistry.isRail(block)) {
      const meta = (block >> 10) & 0xf;
      const baseBlockId = block & 0x3ff;
      const powered = baseBlockId === 27;
      const northSouth = meta === 0 || meta === 4 || meta === 5;

      if (northSouth) {
        vehicle.position.x += (cx + 0.5 - vehicle.position.x) * Math.min(1, dt * 15);
        vehicle.rotationY = 0;
      } else {
        vehicle.position.z += (cz + 0.5 - vehicle.position.z) * Math.min(1, dt * 15);
        vehicle.rotationY = Math.PI / 2;
      }

      let acceleration = 0;
      if (powered) acceleration = 12;
      else if (vehicle.riderId) {
        if (vehicle.input.forward && !vehicle.input.back) acceleration = 4;
        else if (vehicle.input.back && !vehicle.input.forward) acceleration = -4;
      }

      const speedLimit = powered ? 10 : 6;
      if (northSouth) {
        vehicle.velocity.x = 0;
        let direction = Math.sign(vehicle.velocity.z);
        if (direction === 0 && vehicle.riderId) {
          direction = vehicle.input.forward ? 1 : vehicle.input.back ? -1 : 0;
        }
        vehicle.velocity.z += direction * acceleration * dt;
        vehicle.velocity.z *= Math.pow(powered ? 0.99 : 0.92, dt * 10);
        vehicle.velocity.z = THREE.MathUtils.clamp(vehicle.velocity.z, -speedLimit, speedLimit);
      } else {
        vehicle.velocity.z = 0;
        let direction = Math.sign(vehicle.velocity.x);
        if (direction === 0 && vehicle.riderId) {
          direction = vehicle.input.forward ? 1 : vehicle.input.back ? -1 : 0;
        }
        vehicle.velocity.x += direction * acceleration * dt;
        vehicle.velocity.x *= Math.pow(powered ? 0.99 : 0.92, dt * 10);
        vehicle.velocity.x = THREE.MathUtils.clamp(vehicle.velocity.x, -speedLimit, speedLimit);
      }

      vehicle.position.y = cy + 0.05;
      vehicle.velocity.y = 0;
      vehicle.position.addScaledVector(vehicle.velocity, dt);
      vehicle.speed = Math.hypot(vehicle.velocity.x, vehicle.velocity.z);
      return;
    }

    vehicle.velocity.y -= 18 * dt;
    vehicle.velocity.x *= Math.pow(0.5, dt * 10);
    vehicle.velocity.z *= Math.pow(0.5, dt * 10);
    const previous = vehicle.position.clone();
    vehicle.position.addScaledVector(vehicle.velocity, dt);
    if (this.isSolidBlock(
      Math.floor(vehicle.position.x),
      Math.floor(vehicle.position.y),
      Math.floor(vehicle.position.z),
      vehicle.dimension,
    )) {
      vehicle.position.copy(previous);
      vehicle.velocity.set(0, 0, 0);
    }
    vehicle.speed = Math.hypot(vehicle.velocity.x, vehicle.velocity.z);
  }

  private tickServerVehicles(dt: number) {
    for (const vehicle of this.vehicles.values()) {
      if (vehicle.type === 'minecart') {
        this.tickServerMinecartPhysics(vehicle, dt);
      } else {
        const bx = Math.floor(vehicle.position.x);
        const by = Math.floor(vehicle.position.y);
        const bz = Math.floor(vehicle.position.z);
        const current = this.getBlock(bx, by, bz, vehicle.dimension);
        const below = this.getBlock(bx, Math.max(0, by - 1), bz, vehicle.dimension);
        const inWater = BlockRegistry.isWater(current) || BlockRegistry.isWater(below);

        if (inWater) {
          const surfaceY = Math.floor(vehicle.position.y) + 0.9;
          vehicle.velocity.y += (surfaceY - vehicle.position.y) * Math.min(1, dt * 10) * 5;
          vehicle.velocity.y *= Math.pow(0.7, dt * 10);
        } else {
          vehicle.velocity.y -= 18 * dt;
        }

        if (vehicle.riderId) {
          const input = vehicle.input;
          let speedTarget = 0;
          let rotationSpeed = 0;
          if (input.forward && !input.back) speedTarget = inWater ? 6.5 : 1.5;
          else if (input.back && !input.forward) speedTarget = inWater ? -3 : -0.8;
          if (input.left && !input.right) rotationSpeed = 2;
          else if (input.right && !input.left) rotationSpeed = -2;
          vehicle.rotationY += rotationSpeed * dt;
          vehicle.speed += (speedTarget - vehicle.speed) * Math.min(1, dt * (inWater ? 3 : 5));
          vehicle.velocity.x = Math.sin(vehicle.rotationY) * vehicle.speed;
          vehicle.velocity.z = Math.cos(vehicle.rotationY) * vehicle.speed;
        } else {
          const friction = inWater ? 0.95 : 0.8;
          vehicle.velocity.x *= Math.pow(friction, dt * 10);
          vehicle.velocity.z *= Math.pow(friction, dt * 10);
          vehicle.speed = Math.hypot(vehicle.velocity.x, vehicle.velocity.z);
        }

        const previous = vehicle.position.clone();
        vehicle.position.addScaledVector(vehicle.velocity, dt);
        const nx = Math.floor(vehicle.position.x);
        const ny = Math.floor(vehicle.position.y + 0.1);
        const nz = Math.floor(vehicle.position.z);
        if (this.isSolidBlock(nx, ny, nz, vehicle.dimension)) {
          vehicle.position.x = previous.x;
          vehicle.position.z = previous.z;
          vehicle.velocity.x = 0;
          vehicle.velocity.z = 0;
          vehicle.speed = 0;
        }
      }

      if (vehicle.riderId) {
        const rider = this.players.get(vehicle.riderId);
        if (!rider || rider.dimension !== vehicle.dimension) {
          vehicle.riderId = undefined;
          vehicle.input = createIdleServerVehicleInput(vehicle.id);
        } else {
          rider.x = vehicle.position.x;
          rider.y = vehicle.position.y + (vehicle.type === 'minecart' ? 0.35 : 0.55);
          rider.z = vehicle.position.z;
        }
      }

      this.broadcastDimension(vehicle.dimension, PacketType.S2C_VEHICLE_UPDATE, {
        id: vehicle.id,
        x: vehicle.position.x,
        y: vehicle.position.y,
        z: vehicle.position.z,
        rotationY: vehicle.rotationY,
        riderId: vehicle.riderId ?? null,
        dimension: vehicle.dimension,
      });
    }
  }

  private tickServerFishing(dt: number) {
    for (const [playerId, state] of this.fishingStates) {
      const player = this.players.get(playerId);
      if (!player || player.dimension !== state.dimension) {
        this.fishingStates.delete(playerId);
        if (player) this.sendFishingState(player, null);
        continue;
      }

      if (state.phase === 'flying') {
        state.velocity.y -= 12 * dt;
        const next = state.position.clone().addScaledVector(state.velocity, dt);
        const bx = Math.floor(next.x);
        const by = Math.floor(next.y);
        const bz = Math.floor(next.z);
        const block = this.getBlock(bx, by, bz, state.dimension);

        if (BlockRegistry.isWater(block)) {
          state.position.set(next.x, by + 0.85, next.z);
          state.velocity.set(0, 0, 0);
          state.phase = 'waiting';
          state.waitSeconds = getServerFishingWaitSeconds(Math.random);
        } else if (this.isSolidBlock(bx, by, bz, state.dimension)) {
          state.position.copy(next);
          state.velocity.set(0, 0, 0);
          state.phase = 'waiting';
          state.waitSeconds = Number.POSITIVE_INFINITY;
        } else {
          state.position.copy(next);
        }
      } else if (state.phase === 'waiting' && Number.isFinite(state.waitSeconds)) {
        state.waitSeconds -= dt;
        if (state.waitSeconds <= 0) {
          state.phase = 'hooked';
          state.hookedSeconds = SERVER_FISHING_HOOKED_SECONDS;
        }
      } else if (state.phase === 'hooked') {
        state.hookedSeconds -= dt;
        if (state.hookedSeconds <= 0) {
          state.phase = 'waiting';
          state.waitSeconds = getServerFishingWaitSeconds(Math.random);
        }
      }

      this.sendFishingState(player, state);
    }
  }

  private tickPrimedTnt(dt: number) {
    for (const tnt of Array.from(this.primedTnt.values())) {
      tnt.fuseSeconds -= dt;
      if (tnt.fuseSeconds > 0) continue;
      this.primedTnt.delete(tnt.id);
      this.triggerExplosion(tnt.position, 4, tnt.dimension);
    }
  }

  // --- Commands ---

  private executeCommand(session: PlayerSession, cmdText: string) {
    if (!canExecuteServerCommand(cmdText, session.isOperator)) {
      this.sendTo(session, PacketType.S2C_CHAT, { sender: 'System', text: 'You do not have permission to use that command.' });
      return;
    }
    const parts = cmdText.substring(1).trim().split(/\s+/);
    const label = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (label) {
      case 'tp': {
        if (args.length >= 3) {
          const x = parseFloat(args[0]);
          const y = parseFloat(args[1]);
          const z = parseFloat(args[2]);
          session.x = x; session.y = y; session.z = z;
          
          this.sendTo(session, PacketType.S2C_CHAT, { sender: 'System', text: `Teleported to ${x} ${y} ${z}` });
          // Update player position on client
          this.sendTo(session, PacketType.S2C_JOIN_ACK, {
            playerId: session.id,
            seed: this.seed,
            x, y, z,
            gameMode: 'survival'
          });
        }
        break;
      }

      case 'setblock': {
        // /setblock <x> <y> <z> <blockId> — server-authoritative block edit.
        if (args.length >= 4) {
          const x = parseInt(args[0]);
          const y = parseInt(args[1]);
          const z = parseInt(args[2]);
          const blockId = parseInt(args[3]);
          if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z) && Number.isFinite(blockId)) {
            this.setBlock(x, y, z, blockId, session.dimension);
            this.broadcast(PacketType.S2C_BLOCK_UPDATE, { x, y, z, blockId, dimension: session.dimension });
            this.sendTo(session, PacketType.S2C_CHAT, { sender: 'System', text: `Set block at ${x} ${y} ${z} to ${blockId}` });
          }
        }
        break;
      }

      case 'give': {
        if (args.length >= 1) {
          const itemId = parseInt(args[0]);
          const def = ItemRegistry.get(itemId);
          const count = def ? validateGiveCount(args[1], def.maxStackSize) : null;
          if (!def || count === null) {
            this.sendTo(session, PacketType.S2C_CHAT, { sender: 'System', text: 'Invalid /give item or amount (maximum 100 stacks).' });
            break;
          }

          const result = applyGiveToInventory(session.inventory, itemId, count, def.maxStackSize);
          session.inventory = result.slots;
          let remainder = result.remainder;
          while (remainder > 0) {
            const dropped = Math.min(remainder, def.maxStackSize);
            this.spawnDroppedStack({ id: itemId, count: dropped }, session.x, session.y + 0.5, session.z, session.dimension, 0);
            remainder -= dropped;
          }
          this.syncPlayerInventory(session);
          this.sendTo(session, PacketType.S2C_CHAT, { sender: 'System', text: `Gave ${count} of ${itemId}` });
        }
        break;
      }

      case 'time': {
        if (args[0] === 'set' && args[1]) {
          const presets: Record<string, number> = { day: 1000, noon: 6000, night: 13000, midnight: 18000 };
          const raw = presets[args[1]] ?? Number(args[1]);
          if (Number.isFinite(raw)) {
            const ticks = ((Math.floor(raw) % 24000) + 24000) % 24000;
            const nextTime = ticks / 24000;
            if (Math.abs(nextTime - this.gameTime) <= Number.EPSILON) {
              this.sendTo(session, PacketType.S2C_CHAT, { sender: 'System', text: `Time already equals ${args[1]}` });
              break;
            }
            this.gameTime = nextTime;
            this.broadcast(PacketType.S2C_TIME, { gameTime: this.gameTime });
            this.sendSystemMessage(`Set time to ${args[1]}`);
          }
        }
        break;
      }

      case 'weather': {
        if (isValidWeatherArgument(args[0])) {
          const w = args[0];
          this.weatherType = w;
          this.weatherIntensity = w === 'clear' ? 0 : 0.8;
          this.broadcast(PacketType.S2C_WEATHER, { type: this.weatherType, intensity: this.weatherIntensity });
          this.sendSystemMessage(`Set weather to ${w}`);
        }
        break;
      }

      default:
        this.sendTo(session, PacketType.S2C_CHAT, { sender: 'System', text: `Unknown command: ${label}` });
        break;
    }
  }



  private dimensionContainerKey(dimension: number, x: number, y: number, z: number): string {
    return `${dimension}:${containerKey(x, y, z)}`;
  }

  private getOpenContainerSlots(open: OpenServerContainer): (ItemStack | null)[] | null {
    if (open.source === 'block') return this.containerData.get(open.key) ?? null;
    return this.vehicles.get(open.vehicleId)?.inventory ?? null;
  }

  private setOpenContainerSlots(open: OpenServerContainer, slots: (ItemStack | null)[]) {
    if (open.source === 'block') {
      this.containerData.set(open.key, slots);
      return;
    }
    const vehicle = this.vehicles.get(open.vehicleId);
    if (vehicle?.type === 'chest_boat') vehicle.inventory = slots;
  }

  private isOpenContainerInReach(player: PlayerSession, open: OpenServerContainer): boolean {
    if (open.source === 'block') {
      return isBlockActionInReach(player, open.x, open.y, open.z, player.gameMode);
    }
    const vehicle = this.vehicles.get(open.vehicleId);
    return !!vehicle
      && vehicle.dimension === player.dimension
      && isEntityAttackInReach(player, vehicle.position, player.gameMode);
  }

  private sendOpenContainerState(player: PlayerSession) {
    const open = player.openContainer;
    if (!open) return;
    const slots = this.getOpenContainerSlots(open) ?? [];
    this.sendTo(player, PacketType.S2C_CONTAINER_DATA, open.source === 'block'
      ? {
          source: 'block',
          x: open.x,
          y: open.y,
          z: open.z,
          slots,
          cursor: open.cursor,
        }
      : {
          source: 'vehicle',
          vehicleId: open.vehicleId,
          slots,
          cursor: open.cursor,
        });
  }

  private closeServerContainer(player: PlayerSession) {
    const open = player.openContainer;
    if (!open) return;
    const slots = this.getOpenContainerSlots(open) ?? [];
    const next = returnContainerCursorToInventory({
      containerSlots: slots,
      playerSlots: player.inventory,
      cursor: open.cursor,
    });
    this.setOpenContainerSlots(open, next.containerSlots);
    player.inventory = next.playerSlots;
    if (next.cursor) {
      this.spawnDroppedStack(next.cursor, player.x, player.y + 0.5, player.z, player.dimension);
    }
    player.openContainer = undefined;
    this.syncPlayerInventory(player);
  }

  private applyMeleeKnockbackToMob(attacker: PlayerSession, target: ServerMob, strength: number) {
    if (strength <= 0) return;
    const dx = target.position.x - attacker.x;
    const dz = target.position.z - attacker.z;
    const length = Math.hypot(dx, dz);
    if (length <= 1e-9) return;
    const scale = 0.5 * strength / length;
    target.velocity.x = target.velocity.x * 0.5 + dx * scale;
    target.velocity.z = target.velocity.z * 0.5 + dz * scale;
    target.velocity.y = Math.min(0.4, target.velocity.y * 0.5 + 0.4);
  }

  private applyMeleeKnockbackToPlayer(attacker: PlayerSession, target: PlayerSession, strength: number) {
    if (strength <= 0) return;
    const dx = target.x - attacker.x;
    const dz = target.z - attacker.z;
    const length = Math.hypot(dx, dz);
    if (length <= 1e-9) return;
    this.sendTo(target, PacketType.S2C_PLAYER_VELOCITY, {
      x: dx / length * 0.5 * strength,
      y: 0.4,
      z: dz / length * 0.5 * strength,
    });
  }

  private syncPlayerInventory(player: PlayerSession) {
    this.sendTo(player, PacketType.S2C_INVENTORY_SYNC, {
      slots: player.inventory,
      armor: player.armor,
      offhand: player.offhand,
    });
  }

  private syncPlayerState(player: PlayerSession) {
    const nextRequirement = this.getXpRequirement(player.xpLevel);
    this.sendTo(player, PacketType.S2C_PLAYER_STATE, {
      health: player.health,
      hunger: player.hunger,
      oxygen: player.oxygen,
      level: player.xpLevel,
      xpProgress: nextRequirement > 0 ? player.xpCurrent / nextRequirement : 0,
    });
  }

  private addServerXp(player: PlayerSession, amount: number) {
    let remaining = Math.max(0, Math.floor(amount));
    while (remaining > 0) {
      const required = this.getXpRequirement(player.xpLevel);
      const needed = required - player.xpCurrent;
      const added = Math.min(remaining, needed);
      player.xpCurrent += added;
      remaining -= added;
      if (player.xpCurrent >= required) {
        player.xpCurrent = 0;
        player.xpLevel += 1;
      }
    }
    player.xpProgress = player.xpCurrent / this.getXpRequirement(player.xpLevel);
    this.syncPlayerState(player);
  }

  private sendFishingState(player: PlayerSession, state: ServerFishingState | null) {
    this.sendTo(player, PacketType.S2C_FISHING_STATE, state ? {
      active: true,
      x: state.position.x,
      y: state.position.y,
      z: state.position.z,
      phase: state.phase,
    } : { active: false });
  }

  private getXpRequirement(level: number): number {
    if (level < 15) return 7 + 2 * level;
    if (level < 30) return 37 + 5 * (level - 15);
    return 112 + 9 * (level - 30);
  }

  private getBlockingShieldSlot(player: PlayerSession): { kind: 'offhand' | 'hotbar'; index: number; stack: ItemStack } | null {
    const offhand = player.offhand;
    if (offhand && ItemRegistry.get(offhand.id)?.name === 'shield') {
      return { kind: 'offhand', index: -1, stack: offhand };
    }
    const held = player.inventory[player.selectedSlot];
    if (held && ItemRegistry.get(held.id)?.name === 'shield') {
      return { kind: 'hotbar', index: player.selectedSlot, stack: held };
    }
    return null;
  }

  private setBlockingShieldStack(
    player: PlayerSession,
    slot: { kind: 'offhand' | 'hotbar'; index: number },
    stack: ItemStack | null,
  ) {
    if (slot.kind === 'offhand') player.offhand = stack;
    else player.inventory[slot.index] = stack;
  }

  private damageHeldMeleeItem(player: PlayerSession, amount: number) {
    if (amount <= 0) return;
    const held = player.inventory[player.selectedSlot];
    if (!held) return;
    player.inventory[player.selectedSlot] = damageDurableStack(held, amount, 'tool');
    this.syncPlayerInventory(player);
  }

  private applyServerDamageToPlayer(
    player: PlayerSession,
    rawDamage: number,
    kind: PlayerDamageKind,
    source: THREE.Vector3,
    isAxeHit = false,
  ): number {
    if (!Number.isFinite(rawDamage) || rawDamage <= 0 || player.health <= 0) return 0;

    const shieldSlot = this.getBlockingShieldSlot(player);
    if (shieldSlot) {
      const shieldResult = resolveServerShieldBlock(
        rawDamage,
        kind,
        {
          isBlocking: player.isBlocking,
          usingSeconds: player.shieldUseSeconds,
          disabledSeconds: player.shieldDisabledSeconds,
          x: player.x,
          z: player.z,
          yaw: player.yaw,
        },
        source.x,
        source.z,
        isAxeHit,
      );
      if (shieldResult.blocked) {
        if (shieldResult.durabilityDamage > 0) {
          this.setBlockingShieldStack(
            player,
            shieldSlot,
            damageDurableStack(shieldSlot.stack, shieldResult.durabilityDamage, 'tool'),
          );
        }
        if (shieldResult.disableSeconds > 0) {
          player.shieldDisabledSeconds = Math.max(player.shieldDisabledSeconds, shieldResult.disableSeconds);
          player.shieldUseSeconds = 0;
        }
        this.syncPlayerInventory(player);
        return 0;
      }
    }

    const hurt = resolveHurtDamage(player.hurtCooldown, rawDamage);
    player.hurtCooldown = hurt.next;
    if (!hurt.accepted || hurt.appliedDamage <= 0) return 0;

    const mitigated = mitigateServerPlayerDamage(hurt.appliedDamage, kind, player.armor);
    player.armor = damageServerArmorForHit(player.armor, hurt.appliedDamage, kind);
    player.health = Math.max(0, player.health - mitigated);
    player.healthAuthorityLockSeconds = Math.max(player.healthAuthorityLockSeconds, 1);
    this.syncPlayerInventory(player);
    this.syncPlayerState(player);
    this.broadcastDimension(player.dimension, PacketType.S2C_SOUND, {
      type: 'hurt', x: player.x, y: player.y, z: player.z
    });
    return mitigated;
  }

  // --- World interaction ---

  private getOrGenerateChunk(cx: number, cz: number, dimension: number): Chunk {
    const key = `${cx},${cz}`;
    const chunks = this.getDimensionChunks(dimension);
    let chunk = chunks.get(key);

    if (!chunk) {
      chunk = new Chunk(cx, cz);
      if (dimension === 0) {
        this.worldGen.generateChunk(chunk);
      } else if (dimension === 1) {
        this.dimensionGen.generateNetherChunk(chunk);
      } else {
        this.dimensionGen.generateEndChunk(chunk);
      }
      chunks.set(key, chunk);
    }
    return chunk;
  }

  private getDimensionChunks(dimension: number): Map<string, Chunk> {
    if (dimension === 1) return this.netherChunks;
    if (dimension === 2) return this.endChunks;
    return this.overworldChunks;
  }

  getBlock(x: number, y: number, z: number, dimension: number): number {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.getOrGenerateChunk(cx, cz, dimension);
    
    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return chunk.getBlock(lx, y, lz);
  }

  getBlockMetadata(x: number, y: number, z: number, dimension: number): BlockMetadata | undefined {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.getOrGenerateChunk(cx, cz, dimension);
    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return chunk.getBlockMeta(lx, y, lz);
  }

  setBlock(x: number, y: number, z: number, id: number, dimension: number, metadata: BlockMetadata | null = null) {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.getOrGenerateChunk(cx, cz, dimension);
    
    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    
    chunk.setBlock(lx, y, lz, id);
    if (metadata) {
      chunk.setBlockMeta(lx, y, lz, metadata);
    }
  }

  isSolidBlock(x: number, y: number, z: number, dimension: number): boolean {
    if (y < 0 || y >= WORLD_HEIGHT) return false;
    const id = this.getBlock(x, y, z, dimension);
    return BlockRegistry.isSolid(id);
  }

  // --- Entity Spawning & Ticking ---

  spawnMob(
    type: MobType,
    x: number,
    y: number,
    z: number,
    dimension: number,
    isBaby = false,
    isTamed = false,
    isSitting = false,
    isSheared = false,
    isSaddled = false,
    customName?: string,
  ): ServerMob {
    const id = this.nextEntityId++;
    const mob: ServerMob = {
      id,
      type,
      position: new THREE.Vector3(x, y, z),
      velocity: new THREE.Vector3(0, 0, 0),
      yaw: Math.random() * Math.PI * 2,
      pitch: 0,
      health: MOB_DEFS[type]?.health || 20,
      maxHealth: MOB_DEFS[type]?.health || 20,
      hurtTimer: 0,
      onGround: false,
      aiState: 'wander',
      wanderTarget: null,
      wanderTimer: 0,
      despawnTimer: 0,
      fuseTimer: -1,
      shootTimer: 0,
      dimension,
      isBaby,
      isTamed,
      isSitting,
      isSaddled,
      customName: typeof customName === 'string' && customName.trim() ? customName.trim().slice(0, 50) : undefined,
      isSheared,
      riderInput: createIdleServerMobRideInput(id)
    };

    this.mobs.set(id, mob);

    // Broadcast spawn
    this.broadcast(PacketType.S2C_MOB_SPAWN, {
      id,
      type,
      x, y, z,
      yaw: mob.yaw,
      pitch: mob.pitch,
      health: mob.health,
      isBaby,
      isTamed,
      isSitting,
      isSaddled,
      customName: mob.customName,
      isSheared,
      riderId: null
    });

    return mob;
  }

  private handleMobDeath(mob: ServerMob) {
    if (mob.riderId) {
      const rider = this.players.get(mob.riderId);
      if (rider?.ridingMobId === mob.id) rider.ridingMobId = undefined;
      this.broadcastDimension(mob.dimension, PacketType.S2C_MOB_RIDER, { mobId: mob.id, riderId: null });
    }
    this.mobs.delete(mob.id);
    this.broadcast(PacketType.S2C_MOB_DESPAWN, { id: mob.id });
    
    // Spawn drops
    const drops = MOB_DEFS[mob.type]?.drops || [];
    for (const d of drops) {
      if (Math.random() <= d.chance) {
        this.spawnDroppedItem(
          d.id,
          d.count,
          mob.position.x,
          mob.position.y + 0.5,
          mob.position.z,
          mob.dimension
        );
      }
    }

    // Give XP
    const xpDrop = MOB_DEFS[mob.type]?.xpDrop || 0;
    if (xpDrop > 0) {
      // Find nearest player
      let nearest: PlayerSession | null = null;
      let minDist = 16;
      for (const p of this.players.values()) {
        if (p.dimension === mob.dimension) {
          const dist = mob.position.distanceTo(new THREE.Vector3(p.x, p.y, p.z));
          if (dist < minDist) {
            minDist = dist;
            nearest = p;
          }
        }
      }

      if (nearest) {
        nearest.xpCurrent += xpDrop;
        // Level up check
        const nextReq = 7 + nearest.xpLevel * 7;
        if (nearest.xpCurrent >= nextReq) {
          nearest.xpCurrent -= nextReq;
          nearest.xpLevel++;
          this.broadcast(PacketType.S2C_SOUND, { type: 'xp', x: nearest.x, y: nearest.y, z: nearest.z });
        }
        
        this.sendTo(nearest, PacketType.S2C_PLAYER_STATE, {
          health: nearest.health,
          hunger: nearest.hunger,
          oxygen: nearest.oxygen,
          level: nearest.xpLevel,
          xpProgress: nearest.xpCurrent / (7 + nearest.xpLevel * 7)
        });
      }
    }
  }

  /** P5.3 — serialize the overworld + world state to a JSON snapshot. */
  async saveWorld(path: string) {
    const chunks = Array.from(this.overworldChunks.values()).map((chunk) => ({
      cx: chunk.cx,
      cz: chunk.cz,
      data: Array.from(chunk.data),
      metadata: Array.from(chunk.metadata.entries()).map(([index, meta]) => ({ index, metadata: { ...meta } })),
    }));
    const containers = Array.from(this.containerData.entries()).map(([key, slots]) => ({
      key,
      slots: slots.map((slot) => (slot ? { ...slot } : null)),
    }));
    const snapshot = {
      version: 1,
      gameTime: this.gameTime,
      weatherType: this.weatherType,
      weatherIntensity: this.weatherIntensity,
      chunks,
      containers,
    };
    const { writeFileSync } = await import('node:fs');
    writeFileSync(path, JSON.stringify(snapshot), 'utf8');
  }

  /** P5.3 — restore a JSON snapshot created by saveWorld. */
  async loadWorld(path: string) {
    const { existsSync, readFileSync } = await import('node:fs');
    if (!existsSync(path)) return;
    const snapshot = JSON.parse(readFileSync(path, 'utf8'));
    if (snapshot.version !== 1) return;
    this.gameTime = snapshot.gameTime ?? this.gameTime;
    this.weatherType = snapshot.weatherType ?? this.weatherType;
    this.weatherIntensity = snapshot.weatherIntensity ?? this.weatherIntensity;
    for (const c of snapshot.chunks ?? []) {
      const chunk = new Chunk(c.cx, c.cz);
      chunk.data.set(c.data);
      for (const m of c.metadata ?? []) chunk.metadata.set(m.index, { ...m.metadata });
      this.overworldChunks.set(`${c.cx},${c.cz}`, chunk);
    }
    for (const container of snapshot.containers ?? []) {
      this.containerData.set(container.key, container.slots);
    }
  }

  getWorldStats() {
    return { chunks: this.overworldChunks.size, containers: this.containerData.size, players: this.players.size };
  }

  /** P5.2 — drop equipment, respawn in the Overworld, and sync canonical state. */
  private handlePlayerDeath(player: PlayerSession) {
    player.dead = true;
    const deathX = player.x;
    const deathY = player.y;
    const deathZ = player.z;
    const deathDimension = player.dimension;
    this.closeServerContainer(player);
    const deathXp = getDeathXpDrop(player.xpLevel);
    // Drop inventory in the world.
    for (let i = 0; i < 36; i++) {
      const stack = player.inventory[i];
      if (stack) {
        if (shouldDropStackOnDeath(stack)) {
          this.spawnDroppedStack(stack, player.x, player.y, player.z, player.dimension);
        }
        player.inventory[i] = null;
      }
    }
    for (let i = 0; i < player.armor.length; i++) {
      const stack = player.armor[i];
      if (stack) {
        if (shouldDropStackOnDeath(stack)) {
          this.spawnDroppedStack(stack, player.x, player.y, player.z, player.dimension);
        }
        player.armor[i] = null;
      }
    }
    if (player.offhand) {
      if (shouldDropStackOnDeath(player.offhand)) {
        this.spawnDroppedStack(player.offhand, player.x, player.y, player.z, player.dimension);
      }
      player.offhand = null;
    }
    const spawn = this.findSafeWorldSpawnPosition();
    player.x = spawn.x;
    player.y = spawn.y;
    player.z = spawn.z;
    player.dimension = 0;
    player.health = 20;
    player.hunger = 20;
    player.oxygen = 15;
    const resetXp = resetXpAfterDeath({ level: player.xpLevel, current: player.xpCurrent, progress: player.xpProgress });
    player.xpLevel = resetXp.level;
    player.xpCurrent = resetXp.current;
    player.xpProgress = resetXp.progress;
    if (deathXp > 0) {
      this.broadcastDimension(deathDimension, PacketType.S2C_SOUND, {
        type: 'xp_drop', amount: deathXp, x: deathX, y: deathY, z: deathZ,
      });
    }
    player.isBlocking = false;
    player.shieldUseSeconds = 0;
    player.shieldDisabledSeconds = 0;
    player.hurtCooldown = createHurtCooldownState();
    player.healthAuthorityLockSeconds = 0;
    player.lastAttackTick = null;
    player.onGround = false;
    player.sprinting = false;
    player.descending = false;
    player.flying = false;
    player.dead = false;

    this.syncPlayerInventory(player);
    this.syncPlayerState(player);
    this.sendTo(player, PacketType.S2C_JOIN_ACK, {
      playerId: player.id,
      seed: this.seed,
      x: player.x,
      y: player.y,
      z: player.z,
      gameMode: 'survival',
    });
    this.broadcastDimension(deathDimension, PacketType.S2C_SOUND, {
      type: 'death', x: deathX, y: deathY, z: deathZ
    });
  }

  spawnDroppedStack(
    stack: ItemStack,
    x: number,
    y: number,
    z: number,
    dimension: number,
    pickupDelay = ITEM_ENTITY_DEFAULT_PICKUP_DELAY_SECONDS,
  ): ServerDroppedItem {
    const ownedStack = cloneItemStack(stack)!;
    const maxStack = ItemRegistry.getMaxStackSize(ownedStack.id);
    ownedStack.count = Math.max(1, Math.min(maxStack, Math.floor(ownedStack.count)));

    const id = this.nextEntityId++;
    const item: ServerDroppedItem = {
      id,
      stack: ownedStack,
      position: new THREE.Vector3(x, y, z),
      velocity: new THREE.Vector3((Math.random() - 0.5) * 2, 3, (Math.random() - 0.5) * 2),
      age: 0,
      pickupDelay: Math.max(0, pickupDelay),
      dimension,
    };

    this.droppedItems.set(id, item);
    this.broadcastDimension(dimension, PacketType.S2C_DROPPED_ITEM_SPAWN, {
      id,
      stack: cloneItemStack(item.stack),
      itemId: item.stack.id,
      count: item.stack.count,
      x, y, z,
      pickupDelay: item.pickupDelay,
      age: item.age,
      dimension,
    });
    return item;
  }

  spawnDroppedItem(
    itemId: number,
    count: number,
    x: number,
    y: number,
    z: number,
    dimension: number,
    pickupDelay = ITEM_ENTITY_DEFAULT_PICKUP_DELAY_SECONDS,
  ): ServerDroppedItem {
    return this.spawnDroppedStack({ id: itemId, count }, x, y, z, dimension, pickupDelay);
  }


  // --- Main Tick (20Hz) ---

  private tick() {
    const dt = 0.05; // 50ms
    this.gameTick += 1;
    for (const player of this.players.values()) {
      player.hurtCooldown = tickHurtCooldown(player.hurtCooldown, dt);
      player.shieldDisabledSeconds = Math.max(0, player.shieldDisabledSeconds - dt);
      player.healthAuthorityLockSeconds = Math.max(0, player.healthAuthorityLockSeconds - dt);
      if (player.isBlocking && player.shieldDisabledSeconds <= 0 && this.getBlockingShieldSlot(player)) {
        player.shieldUseSeconds += dt;
      } else {
        player.shieldUseSeconds = 0;
      }
    }

    // Time cycle increment
    this.gameTime = (this.gameTime + dt / 600) % 1; // 10 mins full day length
    if (Math.random() < 0.001) {
      // Periodic weather triggers
      this.weatherType = Math.random() < 0.15 ? 'rain' : 'clear';
      this.weatherIntensity = this.weatherType === 'clear' ? 0 : 0.8;
      this.broadcast(PacketType.S2C_WEATHER, { type: this.weatherType, intensity: this.weatherIntensity });
    }
    // P5.2: server-authoritative death — drop inventory and respawn.
    for (const player of this.players.values()) {
      if (player.health <= 0 && !player.dead) {
        this.handlePlayerDeath(player);
      }
    }


    if (Math.random() < 0.02) {
      this.broadcast(PacketType.S2C_TIME, { gameTime: this.gameTime });
    }

    // Tick mobs
    this.tickMobs(dt);

    // Tick dropped items
    this.tickDroppedItems(dt);

    // Tick projectiles
    this.tickProjectiles(dt);

    // Tick server-authoritative Boats / Chest Boats / Minecarts.
    this.tickServerVehicles(dt);

    // Tick server-authoritative fishing bobbers.
    this.tickServerFishing(dt);

    // Tick primed TNT created by server-authoritative Flint and Steel use.
    this.tickPrimedTnt(dt);

    // Dynamic Mob Spawner
    if (this.mobs.size < 30 && Math.random() < 0.15) {
      this.attemptMobSpawning();
    }
  }

  private tickMobs(dt: number) {
    for (const mob of this.mobs.values()) {
      // Simple gravity and physics
      mob.velocity.y -= 18.0 * dt; // gravity
      mob.position.addScaledVector(mob.velocity, dt);

      // Block collision check
      const mx = Math.floor(mob.position.x);
      const my = Math.floor(mob.position.y);
      const mz = Math.floor(mob.position.z);
      
      const isSolidBelow = this.isSolidBlock(mx, my - 1, mz, mob.dimension);
      if (isSolidBelow && mob.position.y - my < 0.1) {
        mob.position.y = my;
        mob.velocity.y = 0;
        mob.onGround = true;
      } else {
        mob.onGround = false;
      }

      // Pathfinding & AI logic
      mob.wanderTimer -= dt;
      
      // Target finding
      let chaseTarget: PlayerSession | null = null;
      let minChaseDist = 16;
      
      if (MOB_DEFS[mob.type]?.hostile) {
        for (const player of this.players.values()) {
          if (player.dimension === mob.dimension) {
            const dist = mob.position.distanceTo(new THREE.Vector3(player.x, player.y, player.z));
            if (dist < minChaseDist) {
              minChaseDist = dist;
              chaseTarget = player;
            }
          }
        }
      }

      if (chaseTarget) {
        mob.aiState = 'chase';
        // Steer towards target
        const diff = new THREE.Vector3(chaseTarget.x - mob.position.x, 0, chaseTarget.z - mob.position.z);
        if (diff.lengthSq() > 0.01) {
          diff.normalize();
          const speed = MOB_DEFS[mob.type]?.speed || 2.0;
          mob.velocity.x = diff.x * speed;
          mob.velocity.z = diff.z * speed;
          mob.yaw = Math.atan2(-diff.x, -diff.z);
          
          // Jump over obstacles
          const lookAheadX = Math.floor(mob.position.x + diff.x * 0.7);
          const lookAheadZ = Math.floor(mob.position.z + diff.z * 0.7);
          if (this.isSolidBlock(lookAheadX, my, lookAheadZ, mob.dimension) && mob.onGround) {
            mob.velocity.y = 6.0; // Jump
          }
        }

        // Action attack check
        const distToPlayer = mob.position.distanceTo(new THREE.Vector3(chaseTarget.x, chaseTarget.y, chaseTarget.z));
        if (distToPlayer < 1.6) {
          if (mob.type === 'creeper') {
            if (mob.fuseTimer === -1) {
              mob.fuseTimer = 0;
              this.broadcast(PacketType.S2C_MOB_STATE, { id: mob.id, fuseTimer: 1 });
              this.broadcast(PacketType.S2C_SOUND, { type: 'fuse', x: mob.position.x, y: mob.position.y, z: mob.position.z });
            }
          } else {
            // Standard hit attack
            mob.shootTimer -= dt;
            if (mob.shootTimer <= 0) {
              mob.shootTimer = 1.5; // Cooldown
              this.applyServerDamageToPlayer(
                chaseTarget,
                MOB_DEFS[mob.type]?.damage || 2,
                'mob',
                mob.position,
                false,
              );
            }
          }
        }
      } else {
        // Wandering mode
        mob.aiState = 'wander';
        if (mob.wanderTimer <= 0) {
          mob.wanderTimer = 3 + Math.random() * 5;
          mob.yaw = Math.random() * Math.PI * 2;
          mob.wanderTarget = mob.position.clone().add(new THREE.Vector3(
            (Math.random() - 0.5) * 8,
            0,
            (Math.random() - 0.5) * 8
          ));
        }

        if (mob.wanderTarget) {
          const diff = new THREE.Vector3(mob.wanderTarget.x - mob.position.x, 0, mob.wanderTarget.z - mob.position.z);
          const speed = (MOB_DEFS[mob.type]?.speed || 2.0) * 0.5;
          if (diff.lengthSq() > 0.5) {
            diff.normalize();
            mob.velocity.x = diff.x * speed;
            mob.velocity.z = diff.z * speed;
          } else {
            mob.velocity.x = 0;
            mob.velocity.z = 0;
          }
        }
      }

      // Creeper Explosion ticking
      if (mob.type === 'creeper' && mob.fuseTimer >= 0) {
        mob.fuseTimer += dt;
        if (mob.fuseTimer >= 1.5) { // 1.5s fuse
          this.triggerExplosion(mob.position, 4.0, mob.dimension);
          this.mobs.delete(mob.id);
          this.broadcast(PacketType.S2C_MOB_DESPAWN, { id: mob.id });
          continue;
        }
      }

      // Broadcast move updates
      this.broadcast(PacketType.S2C_MOB_MOVE, {
        id: mob.id,
        x: mob.position.x,
        y: mob.position.y,
        z: mob.position.z,
        yaw: mob.yaw,
        pitch: mob.pitch
      });
    }
  }

  private triggerExplosion(pos: THREE.Vector3, radius: number, dimension: number) {
    const rx = Math.floor(pos.x);
    const ry = Math.floor(pos.y);
    const rz = Math.floor(pos.z);
    
    // Break blocks within radius
    const intRadius = Math.ceil(radius);
    for (let dx = -intRadius; dx <= intRadius; dx++) {
      for (let dy = -intRadius; dy <= intRadius; dy++) {
        for (let dz = -intRadius; dz <= intRadius; dz++) {
          if (dx*dx + dy*dy + dz*dz <= radius*radius) {
            const wx = rx + dx;
            const wy = ry + dy;
            const wz = rz + dz;
            if (wy >= 0 && wy < WORLD_HEIGHT) {
              const blockId = this.getBlock(wx, wy, wz, dimension);
              if (blockId !== 0 && (blockId & 0x3FF) !== 7) { // Cannot break bedrock (7)
                this.setBlock(wx, wy, wz, 0, dimension);
                this.broadcast(PacketType.S2C_BLOCK_UPDATE, { x: wx, y: wy, z: wz, blockId: 0, dimension });
                
                // Spawn dropped block item sometimes
                if (Math.random() < 0.3) {
                  this.spawnDroppedItem(blockId & 0x3FF, 1, wx + 0.5, wy + 0.5, wz + 0.5, dimension);
                }
              }
            }
          }
        }
      }
    }

    // Damage players and mobs near explosion
    for (const player of this.players.values()) {
      if (player.dimension === dimension) {
        const pPos = new THREE.Vector3(player.x, player.y, player.z);
        const dist = pos.distanceTo(pPos);
        if (dist < radius * 1.5) {
          const dmg = Math.round(15 * (1 - dist / (radius * 1.5)));
          if (dmg > 0) {
            this.applyServerDamageToPlayer(player, dmg, 'explosion', pos, false);
          }
        }
      }
    }

    this.broadcast(PacketType.S2C_PARTICLE, { type: 'explosion', x: pos.x, y: pos.y, z: pos.z });
    this.broadcast(PacketType.S2C_SOUND, { type: 'explode', x: pos.x, y: pos.y, z: pos.z });
  }

  private broadcastDroppedItemUpdate(item: ServerDroppedItem) {
    this.broadcastDimension(item.dimension, PacketType.S2C_DROPPED_ITEM_UPDATE, {
      id: item.id,
      stack: cloneItemStack(item.stack),
      itemId: item.stack.id,
      count: item.stack.count,
      pickupDelay: item.pickupDelay,
      age: item.age,
    });
  }

  private despawnDroppedItem(item: ServerDroppedItem) {
    this.droppedItems.delete(item.id);
    this.broadcastDimension(item.dimension, PacketType.S2C_DROPPED_ITEM_DESPAWN, { id: item.id });
  }

  private mergeServerDroppedItems() {
    const list = Array.from(this.droppedItems.values());
    for (let i = 0; i < list.length; i++) {
      const receiver = list[i];
      if (!this.droppedItems.has(receiver.id)) continue;

      for (let j = i + 1; j < list.length; j++) {
        const donor = list[j];
        if (!this.droppedItems.has(donor.id) || donor.dimension !== receiver.dimension) continue;
        if (!canItemEntityPositionsMerge(receiver.position, donor.position)) continue;

        const transferred = mergeItemEntityStacks(receiver.stack, donor.stack);
        if (transferred <= 0) continue;
        receiver.pickupDelay = Math.max(receiver.pickupDelay, donor.pickupDelay);
        receiver.age = Math.min(receiver.age, donor.age);
        this.broadcastDroppedItemUpdate(receiver);

        if (donor.stack.count <= 0) {
          this.despawnDroppedItem(donor);
        } else {
          this.broadcastDroppedItemUpdate(donor);
        }
      }
    }
  }

  private tickDroppedItems(dt: number) {
    for (const item of Array.from(this.droppedItems.values())) {
      item.age += dt;
      item.pickupDelay = Math.max(0, item.pickupDelay - dt);
      if (item.age >= ITEM_ENTITY_DESPAWN_SECONDS) {
        this.despawnDroppedItem(item);
        continue;
      }

      // Server-authoritative item physics. Keep the same Java gravity constant
      // used by the client presentation path.
      item.velocity.y -= 16 * dt;
      item.position.addScaledVector(item.velocity, dt);

      const ix = Math.floor(item.position.x);
      const iy = Math.floor(item.position.y);
      const iz = Math.floor(item.position.z);
      const isSolidBelow = this.isSolidBlock(ix, iy, iz, item.dimension);
      if (isSolidBelow) {
        item.position.y = iy + 1.05;
        item.velocity.set(0, 0, 0);
      }

      this.broadcastDimension(item.dimension, PacketType.S2C_DROPPED_ITEM_MOVE, {
        id: item.id,
        x: item.position.x,
        y: item.position.y,
        z: item.position.z,
      });

      if (item.pickupDelay > 0) continue;

      for (const player of this.players.values()) {
        if (player.dimension !== item.dimension) continue;
        if (!isWithinItemPickupBounds(item.position, { x: player.x, y: player.y, z: player.z })) continue;

        const result = insertItemStackIntoSlots(player.inventory, item.stack);
        if (result.inserted <= 0) continue;

        if (result.remaining) {
          item.stack = result.remaining;
          this.broadcastDroppedItemUpdate(item);
        } else {
          this.despawnDroppedItem(item);
        }

        this.broadcastDimension(item.dimension, PacketType.S2C_SOUND, {
          type: 'pickup', x: player.x, y: player.y, z: player.z,
        });
        this.syncPlayerInventory(player);
        break;
      }
    }

    this.droppedItemMergeTimer += dt;
    if (this.droppedItemMergeTimer >= ITEM_ENTITY_MERGE_INTERVAL_SECONDS) {
      this.droppedItemMergeTimer -= ITEM_ENTITY_MERGE_INTERVAL_SECONDS;
      this.mergeServerDroppedItems();
    }
  }


  /** P5.1 — create a server-authoritative projectile and broadcast it. */
  private spawnProjectile(
    owner: PlayerSession,
    type: ServerProjectile['type'],
    position: THREE.Vector3,
    velocity: THREE.Vector3,
    extra?: { damage?: number; velocityY?: number; potionEffect?: PotionEffectData },
  ) {
    const id = this.nextProjectileId++;
    const vel = velocity.clone();
    vel.y += extra?.velocityY ?? 0;
    const projectile: ServerProjectile = {
      id,
      type,
      position: position.clone(),
      velocity: vel,
      ownerId: owner.id,
      age: 0,
      dimension: owner.dimension,
      damage: extra?.damage ?? 4,
      potionEffect: extra?.potionEffect,
    };
    this.projectiles.set(id, projectile);
    this.broadcastDimension(projectile.dimension, PacketType.S2C_PROJECTILE_SPAWN, {
      id,
      type,
      x: projectile.position.x,
      y: projectile.position.y,
      z: projectile.position.z,
      dirX: projectile.velocity.x,
      dirY: projectile.velocity.y,
      dirZ: projectile.velocity.z,
      damage: projectile.damage,
      ownerId: owner.id,
    });
  }

  private resolveExperienceBottleImpact(proj: ServerProjectile): boolean {
    if (proj.type !== 'experience_bottle') return false;

    const owner = proj.ownerId ? this.players.get(proj.ownerId) : undefined;
    if (owner && owner.dimension === proj.dimension) {
      this.addServerXp(owner, rollXp(EXPERIENCE_BOTTLE_XP_RANGE, Math.random));
    }
    this.broadcastDimension(proj.dimension, PacketType.S2C_SOUND, {
      type: 'pickup', x: proj.position.x, y: proj.position.y, z: proj.position.z,
    });
    this.projectiles.delete(proj.id);
    this.broadcastDimension(proj.dimension, PacketType.S2C_PROJECTILE_DESPAWN, { id: proj.id });
    return true;
  }

  private resolveEnderPearlImpact(proj: ServerProjectile): boolean {
    if (proj.type !== 'ender_pearl') return false;
    const behavior = getProjectileImpactBehavior('ender_pearl');

    const owner = proj.ownerId ? this.players.get(proj.ownerId) : undefined;
    if (owner && owner.dimension === proj.dimension) {
      owner.x = proj.position.x;
      owner.y = proj.position.y;
      owner.z = proj.position.z;
      owner.onGround = false;
      owner.descending = false;
      owner.sprinting = false;

      this.sendTo(owner, PacketType.S2C_POSITION_CORRECTION, {
        x: owner.x, y: owner.y, z: owner.z, yaw: owner.yaw, pitch: owner.pitch,
      });
      if (behavior.resetsOwnerMomentum) {
        this.sendTo(owner, PacketType.S2C_PLAYER_VELOCITY, { x: 0, y: 0, z: 0 });
      }
      if (behavior.ownerDamage > 0) {
        this.applyServerDamageToPlayer(owner, behavior.ownerDamage, 'fall', proj.position, false);
      }
      this.broadcastDimension(owner.dimension, PacketType.S2C_PLAYER_MOVE, {
        id: owner.id, x: owner.x, y: owner.y, z: owner.z, yaw: owner.yaw, pitch: owner.pitch,
      });
      this.broadcastDimension(owner.dimension, PacketType.S2C_SOUND, {
        type: 'ender_pearl_teleport', x: owner.x, y: owner.y, z: owner.z,
      });
    }

    this.projectiles.delete(proj.id);
    this.broadcastDimension(proj.dimension, PacketType.S2C_PROJECTILE_DESPAWN, { id: proj.id });
    return true;
  }

  private tickProjectiles(dt: number) {
    for (const proj of this.projectiles.values()) {
      proj.age += dt;
      const maxAge = proj.type === 'firework_rocket' ? 1.6 : proj.type === 'eye_of_ender' ? 3.5 : 30;
      if (proj.age > maxAge) {
        this.projectiles.delete(proj.id);
        this.broadcastDimension(proj.dimension, PacketType.S2C_PROJECTILE_DESPAWN, { id: proj.id });
        if (proj.type === 'firework_rocket') {
          this.broadcastDimension(proj.dimension, PacketType.S2C_SOUND, {
            type: 'explode', x: proj.position.x, y: proj.position.y, z: proj.position.z,
          });
        } else if (proj.type === 'eye_of_ender') {
          const shattered = shouldEnderEyeShatter(this.seed, proj.id, proj.position.x, proj.position.z);
          if (!shattered) {
            this.spawnDroppedStack(
              { id: 381, count: 1 },
              proj.position.x,
              proj.position.y,
              proj.position.z,
              proj.dimension,
              0.5,
            );
          } else {
            this.broadcastDimension(proj.dimension, PacketType.S2C_SOUND, {
              type: 'break', x: proj.position.x, y: proj.position.y, z: proj.position.z,
            });
          }
        }
        continue;
      }

      if (proj.type === 'eye_of_ender') {
        if (proj.age > 2.5) {
          proj.velocity.multiplyScalar(Math.max(0, 1 - dt * 8));
        } else {
          proj.velocity.y = Math.max(0, proj.velocity.y - dt * 3);
        }
        proj.position.addScaledVector(proj.velocity, dt);
        this.broadcastDimension(proj.dimension, PacketType.S2C_PROJECTILE_MOVE, {
          id: proj.id,
          x: proj.position.x,
          y: proj.position.y,
          z: proj.position.z,
        });
        continue;
      }

      if (proj.type !== 'firework_rocket') {
        proj.velocity.y -= 9.8 * dt;
      }
      proj.position.addScaledVector(proj.velocity, dt);

      // Hit detection
      const px = Math.floor(proj.position.x);
      const py = Math.floor(proj.position.y);
      const pz = Math.floor(proj.position.z);
      
      const hitBlock = this.isSolidBlock(px, py, pz, proj.dimension);
      if (hitBlock) {
        if (this.resolveExperienceBottleImpact(proj)) continue;
        if (this.resolveEnderPearlImpact(proj)) continue;
        this.projectiles.delete(proj.id);
        this.broadcastDimension(proj.dimension, PacketType.S2C_PROJECTILE_DESPAWN, { id: proj.id });
        this.broadcastDimension(proj.dimension, PacketType.S2C_SOUND, { type: 'bow_hit', x: proj.position.x, y: proj.position.y, z: proj.position.z });
        continue;
      }

      // Check player hits
      let hitSomeone = false;
      for (const player of this.players.values()) {
        if (player.dimension === proj.dimension && player.id !== proj.ownerId) {
          const pPos = new THREE.Vector3(player.x, player.y + 0.9, player.z);
          if (proj.position.distanceTo(pPos) < 1.0) {
            if (this.resolveExperienceBottleImpact(proj)) {
              hitSomeone = true;
              break;
            }
            if (this.resolveEnderPearlImpact(proj)) {
              hitSomeone = true;
              break;
            }
            this.applyServerDamageToPlayer(player, proj.damage, 'projectile', proj.position, false);
            this.projectiles.delete(proj.id);
            this.broadcastDimension(proj.dimension, PacketType.S2C_PROJECTILE_DESPAWN, { id: proj.id });
            hitSomeone = true;
            break;
          }
        }
      }

      if (hitSomeone) continue;

      // Check mob hits
      for (const mob of this.mobs.values()) {
        if (mob.dimension === proj.dimension) {
          const mPos = new THREE.Vector3(mob.position.x, mob.position.y + 0.8, mob.position.z);
          if (proj.position.distanceTo(mPos) < 0.8) {
            if (this.resolveExperienceBottleImpact(proj)) {
              hitSomeone = true;
              break;
            }
            if (this.resolveEnderPearlImpact(proj)) {
              hitSomeone = true;
              break;
            }
            mob.health -= proj.damage;
            mob.hurtTimer = 0.5;
            this.broadcast(PacketType.S2C_MOB_STATE, {
              id: mob.id,
              health: mob.health,
              hurtTimer: mob.hurtTimer
            });
            this.broadcast(PacketType.S2C_SOUND, { type: 'hit', x: mob.position.x, y: mob.position.y, z: mob.position.z });
            
            if (mob.health <= 0) {
              this.handleMobDeath(mob);
            }
            this.projectiles.delete(proj.id);
            this.broadcastDimension(proj.dimension, PacketType.S2C_PROJECTILE_DESPAWN, { id: proj.id });
            hitSomeone = true;
            break;
          }
        }
      }

      if (hitSomeone) continue;

      // Broadcast movement updates
      this.broadcastDimension(proj.dimension, PacketType.S2C_PROJECTILE_MOVE, {
        id: proj.id,
        x: proj.position.x,
        y: proj.position.y,
        z: proj.position.z
      });
    }
  }

  private attemptMobSpawning() {
    if (this.players.size === 0) return;
    
    // Choose random player to spawn around
    const playerArray = Array.from(this.players.values());
    const randomPlayer = playerArray[Math.floor(Math.random() * playerArray.length)];
    
    const rx = randomPlayer.x + (Math.random() - 0.5) * 48;
    const rz = randomPlayer.z + (Math.random() - 0.5) * 48;
    const ry = this.worldGen.getTerrainHeight(rx, rz) + 1.0;

    // Solid ground check
    const isSolid = this.isSolidBlock(Math.floor(rx), Math.floor(ry - 1), Math.floor(rz), randomPlayer.dimension);
    const isAir = !this.isSolidBlock(Math.floor(rx), Math.floor(ry), Math.floor(rz), randomPlayer.dimension);
    
    if (isSolid && isAir) {
      // Pick random mob type
      const types: MobType[] = ['zombie', 'skeleton', 'creeper', 'cow', 'pig', 'sheep', 'chicken'];
      const picked = types[Math.floor(Math.random() * types.length)];
      
      this.spawnMob(picked, rx, ry, rz, randomPlayer.dimension);
    }
  }

  // --- Network utilities ---

  private sendTo(session: PlayerSession, type: PacketType, payload: any) {
    if (session.socket.readyState === 1) { // OPEN
      session.socket.send(JSON.stringify({ type, payload }));
    }
  }

  private broadcast(type: PacketType, payload: any) {
    const packetStr = JSON.stringify({ type, payload });
    for (const player of this.players.values()) {
      if (player.socket.readyState === 1) {
        player.socket.send(packetStr);
      }
    }
  }

  private broadcastDimension(dimension: number, type: PacketType, payload: any) {
    const packetStr = JSON.stringify({ type, payload });
    for (const player of this.players.values()) {
      if (player.dimension === dimension && player.socket.readyState === 1) {
        player.socket.send(packetStr);
      }
    }
  }

  private broadcastExcept(excludePlayerId: string, type: PacketType, payload: any) {
    const packetStr = JSON.stringify({ type, payload });
    for (const player of this.players.values()) {
      if (player.id !== excludePlayerId && player.socket.readyState === 1) {
        player.socket.send(packetStr);
      }
    }
  }

  private sendSystemMessage(text: string) {
    this.broadcast(PacketType.S2C_CHAT, {
      sender: 'System',
      text
    });
  }
}
