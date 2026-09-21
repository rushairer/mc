import { PacketType, Packet, decompressBlocks } from './NetworkProtocol';
import { MockWebSocket, createMockConnectionPair } from './MockWebSocket';
import { GameServer } from './GameServer';
import { Chunk } from '../world/Chunk';
import { ChunkManager } from '../world/ChunkManager';
import { CHUNK_SIZE } from '../constants';
import * as THREE from 'three';
import { isPaintingVariant } from '../entities/HangingEntityRules';

export class NetworkClient {
  private socket: any; // MockWebSocket or WebSocket
  private game: any;   // Game class instance
  isConnected = false;
  /** P5.4 — connection lifecycle status. */
  status: 'idle' | 'connecting' | 'connected' | 'disconnected' = 'idle';
  onStatusChange?: (status: 'connecting' | 'connected' | 'disconnected') => void;
  private localServer: GameServer | null = null;
  playerId: string | null = null;

  otherPlayers: Map<string, { username: string; mesh: THREE.Group; targetPos: THREE.Vector3; targetYaw: number; targetPitch: number }> = new Map();

  constructor(game: any) {
    this.game = game;
  }

  connect(url: string, username: string, gameMode: 'survival' | 'creative' = 'survival', slot: string = 'world_1') {
    this.disconnect();

    console.log(`Connecting to ${url} as ${username}...`);

    if (url === 'mock://local') {
      // Single-player mode: Spin up local server in-memory
      this.localServer = new GameServer();
      this.localServer.start();

      const { clientSocket, serverSocket } = createMockConnectionPair(url);
      this.socket = clientSocket;
      
      // Register client on local server
      this.localServer.addPlayer(serverSocket, username, true);
    } else {
      // Multiplayer mode: Connect via browser standard WebSocket
      const cleanUrl = `${url}?username=${encodeURIComponent(username)}`;
      this.socket = new WebSocket(cleanUrl);
    }

    this.setStatus('connecting');
    this.socket.onopen = () => {
      this.isConnected = true;
      this.setStatus('connected');
      console.log("Network client connected.");
      this.send(PacketType.C2S_JOIN, { username, mode: gameMode, slot });
    };

    this.socket.onmessage = (event: any) => {
      try {
        const packet: Packet = JSON.parse(event.data);
        this.handlePacket(packet);
      } catch (err) {
        console.error("Failed to parse packet S2C", err);
      }
    };

    this.socket.onclose = () => {
      this.isConnected = false;
      this.setStatus('disconnected');
      console.log("Network client disconnected.");
      this.clearOtherPlayers();
    };

    this.socket.onerror = (err: any) => {
      console.error("Network client connection error:", err);
    };
  }

  private setStatus(status: 'connecting' | 'connected' | 'disconnected') {
    this.status = status;
    this.onStatusChange?.(status);
  }

  getStatus() {
    return this.status;
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    if (this.localServer) {
      this.localServer.stop();
      this.localServer = null;
    }
    this.isConnected = false;
    this.clearOtherPlayers();
  }

  send(type: PacketType, payload: any) {
    if (this.socket && this.socket.readyState === 1) { // OPEN
      this.socket.send(JSON.stringify({ type, payload }));
    }
  }

  // --- S2C Message Handlers ---

  private handlePacket(packet: Packet) {
    switch (packet.type) {
      case PacketType.S2C_JOIN_ACK: {
        const { playerId, seed, x, y, z } = packet.payload;
        this.playerId = playerId;
        this.game.seed = seed;
        this.game.player.position.set(x, y, z);
        this.game.player.velocity.set(0, 0, 0);
        this.game.chunks.unloadAllMeshes();
        this.game.chunks.chunks.clear();
        console.log(`Joined game. PlayerID: ${playerId}, Seed: ${seed}`);
        break;
      }

      case PacketType.S2C_CHUNK_DATA: {
        const { cx, cz, blocks, metadata, dimension } = packet.payload;
        if (dimension !== this.game.chunks.currentDimension) return;

        const key = ChunkManager.key(cx, cz);
        let chunk = this.game.chunks.chunks.get(key);
        if (!chunk) {
          chunk = new Chunk(cx, cz);
          this.game.chunks.chunks.set(key, chunk);
        }

        // Decompress blocks RLE
        const decompressed = decompressBlocks(blocks, CHUNK_SIZE * CHUNK_SIZE * 256);
        chunk.data.set(decompressed);

        // Load block metadata
        chunk.metadata.clear();
        if (metadata) {
          for (const m of metadata) {
            const idx = chunk.getIndex(m.x, m.y, m.z);
            const { x, y, z, ...meta } = m;
            chunk.metadata.set(idx, meta);
          }
        }

        chunk.dirty = true;
        this.game.chunks.computeChunkLight(chunk);
        break;
      }

      case PacketType.S2C_BLOCK_UPDATE: {
        const { x, y, z, blockId, metadata, dimension } = packet.payload;
        if (dimension !== this.game.chunks.currentDimension) return;
        
        this.game.chunks.setBlock(x, y, z, blockId);
        if (metadata) {
          const cx = Math.floor(x / CHUNK_SIZE);
          const cz = Math.floor(z / CHUNK_SIZE);
          const chunk = this.game.chunks.getChunk(cx, cz);
          if (chunk) {
            const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
            const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
            chunk.setBlockMeta(lx, y, lz, metadata);
          }
        }
        break;
      }

      case PacketType.S2C_PLAYER_JOIN: {
        const { playerId, username, x, y, z } = packet.payload;
        if (playerId === this.playerId) return;

        console.log(`Other player joined: ${username} (${playerId})`);
        const mesh = this.createPlayerMesh(username);
        mesh.position.set(x, y, z);
        this.game.renderer.scene.add(mesh);
        
        this.otherPlayers.set(playerId, {
          username,
          mesh,
          targetPos: new THREE.Vector3(x, y, z),
          targetYaw: 0,
          targetPitch: 0
        });
        break;
      }

      case PacketType.S2C_PLAYER_LEAVE: {
        const { playerId } = packet.payload;
        const player = this.otherPlayers.get(playerId);
        if (player) {
          console.log(`Other player left: ${player.username}`);
          this.game.renderer.scene.remove(player.mesh);
          this.otherPlayers.delete(playerId);
        }
        break;
      }

      case PacketType.S2C_PLAYER_MOVE: {
        const { playerId, x, y, z, yaw, pitch } = packet.payload;
        const player = this.otherPlayers.get(playerId);
        if (player) {
          player.targetPos.set(x, y, z);
          player.targetYaw = yaw;
          player.targetPitch = pitch;
        }
        break;
      }

      case PacketType.S2C_POSITION_CORRECTION: {
        const { x, y, z, yaw, pitch } = packet.payload;
        this.game.player.position.set(x, y, z);
        this.game.player.velocity.set(0, 0, 0);
        if (Number.isFinite(yaw)) this.game.player.yaw = yaw;
        if (Number.isFinite(pitch)) this.game.player.pitch = pitch;
        break;
      }

      case PacketType.S2C_PLAYER_VELOCITY: {
        const { x, y, z } = packet.payload;
        if ([x, y, z].every(Number.isFinite)) {
          this.game.player.velocity.add(new THREE.Vector3(x, y, z));
        }
        break;
      }

      case PacketType.S2C_PLAYER_STATE: {
        const { health, hunger, oxygen, level, xpProgress } = packet.payload;
        this.game.player.health = health;
        this.game.player.hunger = hunger;
        this.game.player.oxygen = oxygen;
        this.game.xp.setProgress(level, xpProgress);
        this.game.notifyState();
        break;
      }

      case PacketType.S2C_MOB_SPAWN: {
        const {
          id, type, x, y, z, yaw, pitch, health,
          isBaby, isTamed, isSitting, isSaddled, customName,
          armorStandEquipment, hangingFace, itemFrameItem, itemFrameRotation,
          paintingVariant, leashHolderId, isSheared, riderId,
        } = packet.payload;
        // Spawns mob client-side
        const mob = this.game.mobs.spawnMob(type, x, y, z);
        if (mob) {
          // Re-key it with server-provided ID to keep them in sync
          this.game.mobs.mobs.delete(mob.id);
          mob.id = id;
          this.game.mobs.mobs.set(id, mob);
          
          mob.health = health;
          mob.yaw = Number.isFinite(yaw) ? yaw : 0;
          mob.pitch = Number.isFinite(pitch) ? pitch : 0;
          mob.mesh.rotation.y = mob.yaw;
          if (isBaby) mob.isBaby = true;
          if (isTamed) mob.isTamed = true;
          if (isSitting) mob.isSitting = true;
          if (isSaddled) mob.isSaddled = true;
          if (typeof customName === 'string' && customName.trim()) mob.customName = customName.trim().slice(0, 50);
          if (type === 'armor_stand' && Array.isArray(armorStandEquipment)) {
            mob.setArmorStandEquipmentSnapshot(armorStandEquipment);
          }
          if ((type === 'item_frame' || type === 'painting') && hangingFace) {
            mob.setHangingFace(hangingFace);
          }
          if (type === 'item_frame') {
            mob.setItemFrameState(itemFrameItem ?? null, itemFrameRotation ?? 0);
          } else if (type === 'painting' && isPaintingVariant(paintingVariant)) {
            mob.setPaintingVariant(paintingVariant);
          }
          mob.leashHolderId = typeof leashHolderId === 'string' && leashHolderId ? leashHolderId : null;
          if (isSheared) mob.isSheared = true;
          if (riderId !== undefined) this.game.applyServerMobRider(id, riderId ?? null);
        }
        break;
      }

      case PacketType.S2C_MOB_MOVE: {
        const { id, x, y, z, yaw, pitch } = packet.payload;
        const mob = this.game.mobs.mobs.get(id);
        if (mob) {
          // Set target position for interpolation
          mob.position.set(x, y, z);
          mob.yaw = yaw;
          mob.pitch = pitch;
          if (mob.mesh) {
            mob.mesh.position.set(x, y, z);
            mob.mesh.rotation.y = yaw;
          }
        }
        break;
      }

      case PacketType.S2C_MOB_DESPAWN: {
        const { id } = packet.payload;
        const mob = this.game.mobs.mobs.get(id);
        if (this.game.riddenMob?.id === id) this.game.riddenMob = null;
        if (mob) {
          if (mob.mesh) {
            this.game.renderer.scene.remove(mob.mesh);
          }
          this.game.mobs.mobs.delete(id);
        }
        break;
      }

      case PacketType.S2C_MOB_STATE: {
        const {
          id, health, hurtTimer, fuseTimer, isTamed, isSitting, isSaddled,
          customName, armorStandEquipment, itemFrameItem, itemFrameRotation,
          leashHolderId, isSheared,
        } = packet.payload;
        const mob = this.game.mobs.mobs.get(id);
        if (mob) {
          if (health !== undefined) mob.health = health;
          if (hurtTimer !== undefined) mob.hurtTimer = hurtTimer;
          if (fuseTimer !== undefined) mob.fuseTimer = fuseTimer;
          if (isTamed !== undefined) mob.isTamed = !!isTamed;
          if (isSitting !== undefined) mob.isSitting = !!isSitting;
          if (isSaddled !== undefined) mob.isSaddled = !!isSaddled;
          if (customName !== undefined) mob.customName = typeof customName === 'string' && customName.trim() ? customName.trim().slice(0, 50) : null;
          if (mob.def.type === 'armor_stand' && Array.isArray(armorStandEquipment)) {
            mob.setArmorStandEquipmentSnapshot(armorStandEquipment);
          }
          if (mob.def.type === 'item_frame' && (itemFrameItem !== undefined || itemFrameRotation !== undefined)) {
            mob.setItemFrameState(
              itemFrameItem === undefined ? mob.itemFrameItem : itemFrameItem,
              itemFrameRotation === undefined ? mob.itemFrameRotation : itemFrameRotation,
            );
          }
          if (leashHolderId !== undefined) {
            mob.leashHolderId = typeof leashHolderId === 'string' && leashHolderId ? leashHolderId : null;
          }
          if (isSheared !== undefined) mob.isSheared = !!isSheared;
        }
        break;
      }

      case PacketType.S2C_MOB_RIDER: {
        const { mobId, riderId } = packet.payload;
        this.game.applyServerMobRider(mobId, riderId ?? null);
        break;
      }

      case PacketType.S2C_VEHICLE_SPAWN: {
        const { id, type, sourceItemId, x, y, z, rotationY, riderId, dimension } = packet.payload;
        if (dimension !== this.game.chunks.currentDimension) return;
        if (type !== 'boat' && type !== 'chest_boat' && type !== 'minecart') break;
        const existing = this.game.vehicles.vehicles.get(id);
        if (existing) this.game.vehicles.removeVehicle(id);
        const vehicle = this.game.vehicles.spawnVehicle(
          type,
          new THREE.Vector3(x, y, z),
          sourceItemId,
        );
        this.game.vehicles.vehicles.delete(vehicle.id);
        vehicle.id = id;
        if (Number.isFinite(rotationY)) {
          vehicle.rotationY = rotationY;
          vehicle.mesh.rotation.y = rotationY;
        }
        this.game.vehicles.vehicles.set(id, vehicle);
        if (riderId !== undefined) this.game.applyServerVehicleRider(id, riderId);
        break;
      }

      case PacketType.S2C_VEHICLE_UPDATE: {
        const { id, x, y, z, rotationY, riderId } = packet.payload;
        const vehicle = this.game.vehicles.vehicles.get(id);
        if (vehicle) {
          vehicle.position.set(x, y, z);
          vehicle.mesh.position.copy(vehicle.position);
          if (Number.isFinite(rotationY)) {
            vehicle.rotationY = rotationY;
            vehicle.mesh.rotation.y = rotationY;
          }
          if (riderId !== undefined) this.game.applyServerVehicleRider(id, riderId);
        }
        break;
      }

      case PacketType.S2C_VEHICLE_RIDER: {
        const { vehicleId, riderId } = packet.payload;
        this.game.applyServerVehicleRider(vehicleId, riderId ?? null);
        break;
      }

      case PacketType.S2C_VEHICLE_DESPAWN: {
        this.game.handleServerVehicleDespawn(packet.payload.id);
        break;
      }

      case PacketType.S2C_DROPPED_ITEM_SPAWN: {
        const { id, stack, itemId, count, x, y, z, pickupDelay, age } = packet.payload;
        const authoritativeStack = stack ?? { id: itemId, count };
        const spawned = this.game.droppedItems.spawnStack(
          authoritativeStack,
          new THREE.Vector3(x, y, z),
          new THREE.Vector3(0, 0, 0),
          Number.isFinite(pickupDelay) ? pickupDelay : 0.5,
        );
        this.game.droppedItems.items.delete(spawned.id);
        spawned.id = id;
        if (Number.isFinite(age)) spawned.age = age;
        this.game.droppedItems.items.set(id, spawned);
        break;
      }

      case PacketType.S2C_DROPPED_ITEM_UPDATE: {
        const { id, stack, itemId, count, pickupDelay, age } = packet.payload;
        const item = this.game.droppedItems.items.get(id);
        if (item) {
          item.setStack(stack ?? { id: itemId ?? item.itemId, count: count ?? item.count });
          if (Number.isFinite(pickupDelay)) item.pickupDelay = pickupDelay;
          if (Number.isFinite(age)) item.age = age;
        }
        break;
      }

      case PacketType.S2C_DROPPED_ITEM_MOVE: {
        const { id, x, y, z } = packet.payload;
        const item = this.game.droppedItems.items.get(id);
        if (item) {
          item.position.set(x, y, z);
          if (item.mesh) {
            item.mesh.position.set(x, y, z);
          }
        }
        break;
      }

      case PacketType.S2C_DROPPED_ITEM_DESPAWN: {
        const { id } = packet.payload;
        this.game.droppedItems.removeItem(id);
        break;
      }

      case PacketType.S2C_PROJECTILE_SPAWN: {
        const { id, type, x, y, z, dirX, dirY, dirZ, damage, potionEffect } = packet.payload;
        // P5.1: spawn with the server's velocity/damage (was zero-velocity).
        this.game.projectiles.spawnServerProjectile(
          type,
          new THREE.Vector3(x, y, z),
          new THREE.Vector3(dirX ?? 0, dirY ?? 0, dirZ ?? 0),
          damage ?? 4,
          potionEffect,
        );
        const list = Array.from(this.game.projectiles.projectiles.values());
        if (list.length > 0) {
          const newest = list[list.length - 1] as any;
          this.game.projectiles.projectiles.delete(newest.id);
          newest.id = id;
          this.game.projectiles.projectiles.set(id, newest);
        }
        break;
      }

      case PacketType.S2C_PROJECTILE_MOVE: {
        const { id, x, y, z } = packet.payload;
        const proj = this.game.projectiles.projectiles.get(id);
        if (proj) {
          proj.position.set(x, y, z);
          if (proj.mesh) {
            proj.mesh.position.set(x, y, z);
          }
        }
        break;
      }

      case PacketType.S2C_PROJECTILE_DESPAWN: {
        const { id } = packet.payload;
        const proj = this.game.projectiles.projectiles.get(id);
        if (proj) {
          if (proj.mesh) this.game.renderer.scene.remove(proj.mesh);
          this.game.projectiles.projectiles.delete(id);
        }
        break;
      }

      case PacketType.S2C_CHAT: {
        const { sender, text } = packet.payload;
        const formatted = `<${sender}> ${text}`;
        this.game.addChatMessage(formatted);
        break;
      }

      case PacketType.S2C_FISHING_STATE: {
        this.game.applyServerFishingState(packet.payload);
        break;
      }

      case PacketType.S2C_CONTAINER_DATA: {
        const { source, vehicleId, x, y, z, slots, cursor } = packet.payload;
        this.game.applyServerContainerData(
          x,
          y,
          z,
          slots,
          cursor ?? null,
          source === 'vehicle' ? 'vehicle' : 'block',
          vehicleId,
        );
        break;
      }

      case PacketType.S2C_WEATHER: {
        const { type, intensity } = packet.payload;
        this.game.weather.setWeatherType(type);
        break;
      }

      case PacketType.S2C_TIME: {
        const { gameTime } = packet.payload;
        this.game.gameTime = gameTime;
        break;
      }

      case PacketType.S2C_SOUND: {
        const { type } = packet.payload;
        if (type === 'break') this.game.sound.playBlockBreak(1);
        else if (type === 'place') this.game.sound.playBlockPlace(1);
        else if (type === 'hurt') this.game.sound.playHurt();
        else if (type === 'hit') this.game.sound.playMobHurt();
        else if (type === 'pickup') this.game.sound.playPickup();
        else if (type === 'xp') this.game.sound.playXP();
        else if (type === 'explode') this.game.sound.playExplosion();
        else if (type === 'mace_smash') this.game.sound.playMaceSmash(false);
        else if (type === 'mace_smash_heavy') this.game.sound.playMaceSmash(true);
        else if (type === 'wind_charge_throw') this.game.sound.playWindChargeThrow();
        else if (type === 'wind_burst') this.game.sound.playWindBurst();
        break;
      }

      case PacketType.S2C_INVENTORY_SYNC: {
        const { slots, armor, offhand } = packet.payload;
        for (let i = 0; i < 36; i++) {
          this.game.inventory.setSlot(i, slots[i]);
        }
        for (let i = 0; i < 4; i++) {
          this.game.inventory.setArmorSlot(i, armor[i]);
        }
        this.game.inventory.setOffhand(offhand ?? null);
        this.game.notifyState();
        break;
      }
    }
  }

  getOtherPlayerInRay(origin: THREE.Vector3, direction: THREE.Vector3, reach: number): string | null {
    const ray = new THREE.Ray(origin, direction.clone().normalize());
    let closestId: string | null = null;
    let closestDistance = reach;
    for (const [id, player] of this.otherPlayers.entries()) {
      const pos = player.mesh.position;
      const box = new THREE.Box3(
        new THREE.Vector3(pos.x - 0.3, pos.y, pos.z - 0.3),
        new THREE.Vector3(pos.x + 0.3, pos.y + 1.8, pos.z + 0.3),
      );
      const hit = new THREE.Vector3();
      if (ray.intersectBox(box, hit)) {
        const distance = hit.distanceTo(origin);
        if (distance <= closestDistance) {
          closestDistance = distance;
          closestId = id;
        }
      }
    }
    return closestId;
  }

  // --- Interpolation helper for other players ---

  update(dt: number) {
    // Interpolate positions of other players for smooth visuals
    for (const player of this.otherPlayers.values()) {
      player.mesh.position.lerp(player.targetPos, 0.25);
      
      // Head and body orientation
      player.mesh.rotation.y = player.targetYaw;
      const head = player.mesh.getObjectByName('head');
      if (head) {
        head.rotation.x = player.targetPitch;
      }
    }
  }

  private clearOtherPlayers() {
    for (const player of this.otherPlayers.values()) {
      this.game.renderer.scene.remove(player.mesh);
    }
    this.otherPlayers.clear();
  }

  // --- Visual Player Mesh creation ---

  private createPlayerMesh(username: string): THREE.Group {
    const group = new THREE.Group();
    group.name = 'otherPlayer';

    // Player body
    const bodyGeo = new THREE.BoxGeometry(0.6, 1.8, 0.4);
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x008080 }); // teal shirt
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 0.9;
    group.add(bodyMesh);

    // Player head
    const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const headMat = new THREE.MeshLambertMaterial({ color: 0xffcc99 }); // skin tone
    const headMesh = new THREE.Mesh(headGeo, headMat);
    headMesh.name = 'head';
    headMesh.position.set(0, 1.8 + 0.25, 0);
    group.add(headMesh);

    // Username tag banner above head
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(0, 0, 256, 64);
      ctx.font = '24px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(username, 128, 40);
    }

    const canvasTex = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: canvasTex, depthWrite: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(1.5, 0.375, 1);
    sprite.position.set(0, 2.4, 0);
    group.add(sprite);

    return group;
  }
}
