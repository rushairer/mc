import * as THREE from 'three';
import { PacketType, Packet, compressBlocks } from './NetworkProtocol';
import { getBowReleaseParams, parseItemAction } from './ItemActionRules';
import { clampPlayerState, consumeOne, validateConsume } from './PlayerStateRules';
import { applyContainerClick, containerKey, createContainerSlots, validateContainerClick, validateContainerSlots } from './ContainerRules';
import type { PotionEffectData } from '../systems/PotionEffect';

import { WorldGen } from '../world/WorldGen';
import { Dimension, DimensionGenerator } from '../world/DimensionGenerator';
import { Chunk } from '../world/Chunk';
import { BlockRegistry } from '../world/BlockRegistry';
import { ItemRegistry } from '../items/ItemRegistry';
import { MOB_DEFS, Mob, type MobType } from '../entities/Mob';
import { CHUNK_SIZE, RENDER_DISTANCE, SEA_LEVEL, WORLD_HEIGHT } from '../constants';
import type { ItemStack, BlockMetadata } from '../types';
import { SAVE_SCHEMA_VERSION, SaveSystem, type SaveData } from '../systems/SaveSystem';

const WORLD_SPAWN_X = 8;
const WORLD_SPAWN_Z = 8;

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
  isAngry?: boolean;
  angerTimer?: number;
}

interface ServerDroppedItem {
  id: number;
  itemId: number;
  count: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  age: number;
  dimension: number;
}

interface ServerProjectile {
  id: number;
  type: 'arrow' | 'fireball' | 'shulker_bullet' | 'snowball' | 'egg' | 'ender_pearl' | 'potion' | 'trident';
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
  private projectiles: Map<number, ServerProjectile> = new Map();
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
      selectedSlot: 0
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
          isSitting: mob.isSitting
        });
      }
    }

    // Send active dropped items
    for (const item of this.droppedItems.values()) {
      if (item.dimension === session.dimension) {
        this.sendTo(session, PacketType.S2C_DROPPED_ITEM_SPAWN, {
          id: item.id,
          itemId: item.itemId,
          count: item.count,
          x: item.position.x,
          y: item.position.y,
          z: item.position.z
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
        isSitting: mob.isSitting
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
            mData.isSitting
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
      case PacketType.C2S_PLAYER_MOVE: {
        const { x, y, z, yaw, pitch, flying } = packet.payload;
        session.x = x;
        session.y = y;
        session.z = z;
        session.yaw = yaw;
        session.pitch = pitch;
        session.flying = flying;

        // Broadcast move packet to other players
        this.broadcastExcept(playerId, PacketType.S2C_PLAYER_MOVE, {
          playerId,
          x,
          y,
          z,
          yaw,
          pitch,
          flying
        });
        break;
      }

      case PacketType.C2S_CHUNK_REQUEST: {
        const { cx, cz } = packet.payload;
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
        this.setBlock(x, y, z, 0, session.dimension);
        // P5.2: damage the held tool server-side.
        const tool = session.inventory[session.selectedSlot];
        if (tool && tool.durability !== undefined) {
          tool.durability -= 1;
          if (tool.durability <= 0) session.inventory[session.selectedSlot] = null;
          this.sendTo(session, PacketType.S2C_INVENTORY_SYNC, {
            slots: session.inventory,
            armor: session.armor,
            offhand: session.offhand,
          });
        }
        this.broadcast(PacketType.S2C_BLOCK_UPDATE, { x, y, z, blockId: 0, dimension: session.dimension });
        this.broadcast(PacketType.S2C_SOUND, { type: 'break', x, y, z });
        break;
      }

      case PacketType.C2S_BLOCK_PLACE: {
        const { x, y, z, blockId, facing } = packet.payload;
        const meta = facing ? { facing } : null;
        this.setBlock(x, y, z, blockId, session.dimension, meta);
        this.broadcast(PacketType.S2C_BLOCK_UPDATE, { x, y, z, blockId, metadata: meta, dimension: session.dimension });
        this.broadcast(PacketType.S2C_SOUND, { type: 'place', x, y, z });
        break;
      }

      case PacketType.C2S_CHAT: {
        const { text } = packet.payload;
        if (text.startsWith('/')) {
          this.executeCommand(session, text);
        } else {
          this.broadcast(PacketType.S2C_CHAT, {
            sender: session.username,
            text
          });
        }
        break;
      }

      case PacketType.C2S_HELD_ITEM_CHANGE: {
        const { slot } = packet.payload;
        session.selectedSlot = slot;
        break;
      }

      case PacketType.C2S_INVENTORY_CLICK: {
        const { slotIndex, type, heldItem } = packet.payload;
        // Simple client-side inventory overwrite (can be made authoritative in future iterations)
        if (slotIndex >= 0 && slotIndex < 36) {
          session.inventory[slotIndex] = heldItem;
        } else if (slotIndex >= 100 && slotIndex < 104) {
          session.armor[slotIndex - 100] = heldItem;
        } else if (slotIndex === 200) {
          session.offhand = heldItem;
        }
        break;
      }

      case PacketType.C2S_INTERACT_BLOCK: {
        const { x, y, z } = packet.payload;
        const blockId = this.getBlock(x, y, z, session.dimension);
        // Chest or Furnace interaction sounds
        if ((blockId & 0x3FF) === 54) { // Chest
          this.broadcast(PacketType.S2C_SOUND, { type: 'chest_open', x, y, z });
        }
        break;
      }

      case PacketType.C2S_INTERACT_ENTITY: {
        const { entityId, type } = packet.payload;
        if (type === 'attack') {
          const mob = this.mobs.get(entityId);
          if (mob && mob.health > 0) {
            mob.health -= 5; // Default sword attack damage
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
          }
        }
        break;
      }

      // P5.1: server-authoritative item actions (bow release / throwables).
      case PacketType.C2S_ITEM_ACTION: {
        const request = parseItemAction(packet.payload);
        if (!request) break;
        const { action, itemId, power, damageBonus } = request;
        const payload = packet.payload as { dirX?: number; dirY?: number; dirZ?: number; potionEffect?: PotionEffectData };
        const origin = new THREE.Vector3(session.x, session.y + 1.6, session.z);
        const dir = new THREE.Vector3(
          payload.dirX ?? 0,
          payload.dirY ?? 0,
          payload.dirZ ?? -1,
        ).normalize();

        if (action === 'bow_release') {
          const ammoSlot = session.inventory.findIndex((slot) => slot && (slot.id & 0x3FF) === 262); // arrow
          if (ammoSlot < 0) break;
          const ammo = session.inventory[ammoSlot]!;
          ammo.count -= 1;
          if (ammo.count <= 0) session.inventory[ammoSlot] = null;
          // P5.2: server-authoritative bow durability.
          const bow = session.inventory[session.selectedSlot];
          if (bow) {
            bow.durability = (bow.durability ?? 100) - 1;
            if (bow.durability <= 0) session.inventory[session.selectedSlot] = null;
          }
          const params = getBowReleaseParams(power ?? 1, damageBonus ?? 0);
          this.spawnProjectile(session, 'arrow', origin, dir.multiplyScalar(params.speed), {
            damage: params.damage,
            velocityY: 0.5,
          });
          this.sendTo(session, PacketType.S2C_INVENTORY_SYNC, {
            slots: session.inventory,
            armor: session.armor,
            offhand: session.offhand,
          });
          this.broadcast(PacketType.S2C_SOUND, { type: 'bow_shoot', x: origin.x, y: origin.y, z: origin.z });
        } else if (action === 'throw') {
          const baseId = itemId & 0x3FF;
          const type = baseId === 332 ? 'snowball'
            : baseId === 344 ? 'egg'
              : baseId === 368 ? 'ender_pearl'
                : baseId === 373 ? 'potion'
                  : baseId === 505 ? 'trident'
                    : null;
          if (!type) break;
          this.spawnProjectile(session, type, origin, dir.multiplyScalar(15), {
            damage: type === 'trident' ? 9 : 1,
            velocityY: 2.5,
            potionEffect: payload.potionEffect,
          });
        }
        break;
      }

      // P5.2: client uploads its simulated state so server pushes stay convergent.
      case PacketType.C2S_PLAYER_STATE: {
        const clamped = clampPlayerState(packet.payload);
        session.health = clamped.health;
        session.hunger = clamped.hunger;
        session.oxygen = clamped.oxygen;
        break;
      }

      // P5.2: server-validated consumable use.
      case PacketType.C2S_ITEM_CONSUME: {
        const { slot, itemId } = packet.payload;
        const stack = session.inventory[slot];
        if (validateConsume(stack, itemId)) {
          const updated = consumeOne(stack!);
          session.inventory[slot] = updated;
          this.sendTo(session, PacketType.S2C_INVENTORY_SYNC, {
            slots: session.inventory,
            armor: session.armor,
            offhand: session.offhand,
          });
        }
        break;
      }

      // P5.3: container authority — the server owns chest contents.
      case PacketType.C2S_CONTAINER_OPEN: {
        const { x, y, z } = packet.payload;
        const blockId = this.getBlock(x, y, z, session.dimension);
        const base = blockId & 0x3FF;
        const name = BlockRegistry.get(blockId)?.name ?? 'chest';
        const key = containerKey(x, y, z);
        if (!this.containerData.has(key)) {
          this.containerData.set(key, createContainerSlots(name.includes('hopper') ? 'hopper' : 'chest'));
        }
        this.sendTo(session, PacketType.S2C_CONTAINER_DATA, {
          x, y, z, slots: this.containerData.get(key),
        });
        break;
      }

      case PacketType.C2S_CONTAINER_UPDATE: {
        const { x, y, z, slots } = packet.payload;
        const key = containerKey(x, y, z);
        const existing = this.containerData.get(key);
        if (!existing || !validateContainerSlots(slots, existing.length)) break;
        // Adopt the client's (optimistic) contents, server-validated per slot.
        const adopted = slots.map((slot: ItemStack | null) => (slot ? { ...slot } : null));
        this.containerData.set(key, adopted);
        this.sendTo(session, PacketType.S2C_CONTAINER_DATA, { x, y, z, slots: adopted });
        break;
      }
    }
  }

  // --- Commands ---

  private executeCommand(session: PlayerSession, cmdText: string) {
    const parts = cmdText.substring(1).split(' ');
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
          const count = args[1] ? parseInt(args[1]) : 64;
          
          // Find empty slot or matching slot
          let added = false;
          for (let i = 0; i < 36; i++) {
            const slot = session.inventory[i];
            if (!slot) {
              session.inventory[i] = { id: itemId, count };
              added = true;
              break;
            } else if (slot.id === itemId && slot.count + count <= 64) {
              slot.count += count;
              added = true;
              break;
            }
          }

          if (added) {
            this.sendTo(session, PacketType.S2C_INVENTORY_SYNC, { slots: session.inventory, armor: session.armor, offhand: session.offhand });
            this.sendTo(session, PacketType.S2C_CHAT, { sender: 'System', text: `Gave ${count} of ${itemId}` });
          } else {
            this.sendTo(session, PacketType.S2C_CHAT, { sender: 'System', text: `Inventory full.` });
          }
        }
        break;
      }

      case 'time': {
        if (args[0] === 'set' && args[1]) {
          let timeVal = 0.25;
          if (args[1] === 'day') timeVal = 0.25;
          else if (args[1] === 'night') timeVal = 0.75;
          else timeVal = parseFloat(args[1]) || 0;

          this.gameTime = timeVal;
          this.broadcast(PacketType.S2C_TIME, { gameTime: this.gameTime });
          this.sendSystemMessage(`Set time to ${args[1]}`);
        }
        break;
      }

      case 'weather': {
        if (args[0]) {
          const w = args[0] as 'clear' | 'rain' | 'thunder';
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

  spawnMob(type: MobType, x: number, y: number, z: number, dimension: number, isBaby = false, isTamed = false, isSitting = false): ServerMob {
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
      isSitting
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
      isSitting
    });

    return mob;
  }

  private handleMobDeath(mob: ServerMob) {
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

  /** P5.2 — drop the inventory to the world, respawn the player, sync. */
  private handlePlayerDeath(player: PlayerSession) {
    player.dead = true;
    // Drop inventory in the world.
    for (let i = 0; i < 36; i++) {
      const stack = player.inventory[i];
      if (stack) {
        this.spawnDroppedItem(stack.id, stack.count, player.x, player.y, player.z, player.dimension);
        player.inventory[i] = null;
      }
    }
    player.health = 20;
    player.hunger = 20;
    player.oxygen = 15;
    this.sendTo(player, PacketType.S2C_INVENTORY_SYNC, {
      slots: player.inventory,
      armor: player.armor,
      offhand: player.offhand,
    });
    this.sendTo(player, PacketType.S2C_PLAYER_STATE, {
      health: player.health,
      hunger: player.hunger,
      oxygen: player.oxygen,
      level: player.xpLevel,
      xpProgress: player.xpCurrent / (7 + player.xpLevel * 7),
    });
    this.broadcast(PacketType.S2C_SOUND, { type: 'death', x: player.x, y: player.y, z: player.z });
  }

  spawnDroppedItem(itemId: number, count: number, x: number, y: number, z: number, dimension: number): ServerDroppedItem {
    const id = this.nextEntityId++;
    const item: ServerDroppedItem = {
      id,
      itemId,
      count,
      position: new THREE.Vector3(x, y, z),
      velocity: new THREE.Vector3((Math.random() - 0.5) * 2, 3, (Math.random() - 0.5) * 2),
      age: 0,
      dimension
    };

    this.droppedItems.set(id, item);

    this.broadcast(PacketType.S2C_DROPPED_ITEM_SPAWN, {
      id,
      itemId,
      count,
      x, y, z
    });

    return item;
  }

  // --- Main Tick (20Hz) ---

  private tick() {
    const dt = 0.05; // 50ms

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
              chaseTarget.health = Math.max(0, chaseTarget.health - (MOB_DEFS[mob.type]?.damage || 2));
              this.broadcast(PacketType.S2C_SOUND, { type: 'hurt', x: chaseTarget.x, y: chaseTarget.y, z: chaseTarget.z });
              this.sendTo(chaseTarget, PacketType.S2C_PLAYER_STATE, {
                health: chaseTarget.health,
                hunger: chaseTarget.hunger,
                oxygen: chaseTarget.oxygen,
                level: chaseTarget.xpLevel,
                xpProgress: chaseTarget.xpCurrent / (7 + chaseTarget.xpLevel * 7)
              });
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
            player.health = Math.max(0, player.health - dmg);
            this.broadcast(PacketType.S2C_SOUND, { type: 'hurt', x: player.x, y: player.y, z: player.z });
            this.sendTo(player, PacketType.S2C_PLAYER_STATE, {
              health: player.health,
              hunger: player.hunger,
              oxygen: player.oxygen,
              level: player.xpLevel,
              xpProgress: player.xpCurrent / (7 + player.xpLevel * 7)
            });
          }
        }
      }
    }

    this.broadcast(PacketType.S2C_PARTICLE, { type: 'explosion', x: pos.x, y: pos.y, z: pos.z });
    this.broadcast(PacketType.S2C_SOUND, { type: 'explode', x: pos.x, y: pos.y, z: pos.z });
  }

  private tickDroppedItems(dt: number) {
    for (const item of this.droppedItems.values()) {
      item.age += dt;
      if (item.age > 300) { // Despawn after 5 mins
        this.droppedItems.delete(item.id);
        this.broadcast(PacketType.S2C_DROPPED_ITEM_DESPAWN, { id: item.id });
        continue;
      }

      // Simple physics: fall down
      item.velocity.y -= 9.8 * dt;
      item.position.addScaledVector(item.velocity, dt);
      
      const ix = Math.floor(item.position.x);
      const iy = Math.floor(item.position.y);
      const iz = Math.floor(item.position.z);
      
      const isSolidBelow = this.isSolidBlock(ix, iy, iz, item.dimension);
      if (isSolidBelow) {
        item.position.y = iy + 1.05;
        item.velocity.set(0, 0, 0); // resting on ground
      }

      // Hover movement broadcast
      this.broadcast(PacketType.S2C_DROPPED_ITEM_MOVE, {
        id: item.id,
        x: item.position.x,
        y: item.position.y,
        z: item.position.z
      });

      // Player magnetic pickup check
      for (const player of this.players.values()) {
        if (player.dimension === item.dimension) {
          const pPos = new THREE.Vector3(player.x, player.y + 0.8, player.z);
          const dist = item.position.distanceTo(pPos);
          
          if (dist < 1.6) {
            // Pickup item
            let added = false;
            for (let i = 0; i < 36; i++) {
              const slot = player.inventory[i];
              if (!slot) {
                player.inventory[i] = { id: item.itemId, count: item.count };
                added = true;
                break;
              } else if (slot.id === item.itemId && slot.count + item.count <= 64) {
                slot.count += item.count;
                added = true;
                break;
              }
            }

            if (added) {
              this.droppedItems.delete(item.id);
              this.broadcast(PacketType.S2C_DROPPED_ITEM_DESPAWN, { id: item.id });
              this.broadcast(PacketType.S2C_SOUND, { type: 'pickup', x: player.x, y: player.y, z: player.z });
              this.sendTo(player, PacketType.S2C_INVENTORY_SYNC, { slots: player.inventory, armor: player.armor, offhand: player.offhand });
              break;
            }
          }
        }
      }
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
    this.broadcast(PacketType.S2C_PROJECTILE_SPAWN, {
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

  private tickProjectiles(dt: number) {
    for (const proj of this.projectiles.values()) {
      proj.age += dt;
      if (proj.age > 30) { // Despawn after 30 seconds
        this.projectiles.delete(proj.id);
        this.broadcast(PacketType.S2C_PROJECTILE_DESPAWN, { id: proj.id });
        continue;
      }

      proj.velocity.y -= 9.8 * dt; // gravity
      proj.position.addScaledVector(proj.velocity, dt);

      // Hit detection
      const px = Math.floor(proj.position.x);
      const py = Math.floor(proj.position.y);
      const pz = Math.floor(proj.position.z);
      
      const hitBlock = this.isSolidBlock(px, py, pz, proj.dimension);
      if (hitBlock) {
        this.projectiles.delete(proj.id);
        this.broadcast(PacketType.S2C_PROJECTILE_DESPAWN, { id: proj.id });
        this.broadcast(PacketType.S2C_SOUND, { type: 'bow_hit', x: proj.position.x, y: proj.position.y, z: proj.position.z });
        continue;
      }

      // Check player hits
      let hitSomeone = false;
      for (const player of this.players.values()) {
        if (player.dimension === proj.dimension && player.id !== proj.ownerId) {
          const pPos = new THREE.Vector3(player.x, player.y + 0.9, player.z);
          if (proj.position.distanceTo(pPos) < 1.0) {
            player.health = Math.max(0, player.health - 3); // arrow damage
            this.broadcast(PacketType.S2C_SOUND, { type: 'hurt', x: player.x, y: player.y, z: player.z });
            this.sendTo(player, PacketType.S2C_PLAYER_STATE, {
              health: player.health,
              hunger: player.hunger,
              oxygen: player.oxygen,
              level: player.xpLevel,
              xpProgress: player.xpCurrent / (7 + player.xpLevel * 7)
            });
            this.projectiles.delete(proj.id);
            this.broadcast(PacketType.S2C_PROJECTILE_DESPAWN, { id: proj.id });
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
            mob.health -= 4;
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
            this.broadcast(PacketType.S2C_PROJECTILE_DESPAWN, { id: proj.id });
            hitSomeone = true;
            break;
          }
        }
      }

      if (hitSomeone) continue;

      // Broadcast movement updates
      this.broadcast(PacketType.S2C_PROJECTILE_MOVE, {
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
