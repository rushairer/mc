import { PacketType, Packet, decompressBlocks } from './NetworkProtocol';
import { MockWebSocket, createMockConnectionPair } from './MockWebSocket';
import { GameServer } from './GameServer';
import { Chunk } from '../world/Chunk';
import { ChunkManager } from '../world/ChunkManager';
import { CHUNK_SIZE } from '../constants';
import * as THREE from 'three';

export class NetworkClient {
  private socket: any; // MockWebSocket or WebSocket
  private game: any;   // Game class instance
  isConnected = false;
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

    this.socket.onopen = () => {
      this.isConnected = true;
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
      console.log("Network client disconnected.");
      this.clearOtherPlayers();
    };

    this.socket.onerror = (err: any) => {
      console.error("Network client connection error:", err);
    };
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

      case PacketType.S2C_PLAYER_STATE: {
        const { health, hunger, oxygen, level, xpProgress } = packet.payload;
        this.game.player.health = health;
        this.game.player.hunger = hunger;
        this.game.player.oxygen = oxygen;
        this.game.gameState.health = health;
        this.game.gameState.hunger = hunger;
        this.game.gameState.oxygen = oxygen;
        this.game.gameState.xpLevel = level;
        this.game.gameState.xpProgress = xpProgress;
        break;
      }

      case PacketType.S2C_MOB_SPAWN: {
        const { id, type, x, y, z, yaw, pitch, health, isBaby, isTamed, isSitting } = packet.payload;
        // Spawns mob client-side
        const mob = this.game.mobs.spawnMob(type, x, y, z);
        if (mob) {
          // Re-key it with server-provided ID to keep them in sync
          this.game.mobs.mobs.delete(mob.id);
          mob.id = id;
          this.game.mobs.mobs.set(id, mob);
          
          mob.health = health;
          mob.yaw = yaw;
          mob.pitch = pitch;
          if (isBaby) mob.isBaby = true;
          if (isTamed) mob.isTamed = true;
          if (isSitting) mob.isSitting = true;
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
        if (mob) {
          if (mob.mesh) {
            this.game.renderer.scene.remove(mob.mesh);
          }
          this.game.mobs.mobs.delete(id);
        }
        break;
      }

      case PacketType.S2C_MOB_STATE: {
        const { id, health, hurtTimer, fuseTimer } = packet.payload;
        const mob = this.game.mobs.mobs.get(id);
        if (mob) {
          mob.health = health;
          mob.hurtTimer = hurtTimer;
          if (fuseTimer !== undefined) mob.fuseTimer = fuseTimer;
        }
        break;
      }

      case PacketType.S2C_DROPPED_ITEM_SPAWN: {
        const { id, itemId, count, x, y, z } = packet.payload;
        this.game.droppedItems.spawnItem(itemId, count, new THREE.Vector3(x, y, z), new THREE.Vector3(0, 0, 0));
        // Find newest spawned item in DroppedItemSystem and sync its server ID
        const list = Array.from(this.game.droppedItems.items.values());
        if (list.length > 0) {
          const newest = list[list.length - 1] as any;
          this.game.droppedItems.items.delete(newest.id);
          newest.id = id;
          this.game.droppedItems.items.set(id, newest);
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
        this.game.droppedItems.removeDroppedItem(id);
        break;
      }

      case PacketType.S2C_PROJECTILE_SPAWN: {
        const { id, type, x, y, z } = packet.payload;
        this.game.projectiles.spawnProjectile(type, new THREE.Vector3(x, y, z), new THREE.Vector3(0, 0, 0));
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
        const { type, x, y, z } = packet.payload;
        if (type === 'break') this.game.sound.playBreak(1);
        else if (type === 'place') this.game.sound.playPlace(1);
        else if (type === 'hurt') this.game.sound.playHurt();
        else if (type === 'hit') this.game.sound.playHit();
        else if (type === 'pickup') this.game.sound.playPickup();
        else if (type === 'xp') this.game.sound.playXP();
        else if (type === 'explode') this.game.sound.playExplode();
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
