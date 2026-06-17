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
import { ParticleSystem } from '../systems/ParticleSystem';
import { FluidSystem } from '../systems/FluidSystem';
import { WeatherSystem } from '../systems/WeatherSystem';
import { SoundSystem } from '../systems/SoundSystem';
import { SaveSystem, type SaveData } from '../systems/SaveSystem';
import { RedstoneSystem } from '../systems/RedstoneSystem';
import { CHUNK_SIZE } from '../constants';
import type { BlockFacing, BlockMetadata, ItemStack } from '../types';

export type UIType = 'none' | 'inventory' | 'furnace' | 'crafting_table' | 'chest' | 'death';

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
  private lightScanTimer = 0;
  private perspectiveMode: 'first' | 'third' = 'first';
  private container: HTMLElement;
  private fpArmGroup!: THREE.Group;
  private fpLastHeldItemId = -1;
  private openChestPos: THREE.Vector3 | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
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
    this.weather = new WeatherSystem(this.renderer.scene);
    this.sound = new SoundSystem();
    this.redstone = new RedstoneSystem();

    // Default hotbar (Starter Kit)
    this.inventory.setSlot(0, { id: 130, count: 1 });  // Stone Sword
    this.inventory.setSlot(1, { id: 132, count: 1 });  // Stone Pickaxe
    this.inventory.setSlot(2, { id: 133, count: 1 });  // Stone Axe
    this.inventory.setSlot(3, { id: 172, count: 32 }); // Steak (Food)
    this.inventory.setSlot(4, { id: 6, count: 64 });   // Oak Log
    this.inventory.setSlot(5, { id: 5, count: 64 });   // Oak Planks
    this.inventory.setSlot(6, { id: 24, count: 4 });   // Crafting Table
    this.inventory.setSlot(7, { id: 36, count: 4 });   // Chest
    this.inventory.setSlot(8, { id: 30, count: 64 });  // Torch


    // Spawn
    const spawnX = 8;
    const spawnZ = 8;
    const spawnY = this.chunks.getWorldGen().getTerrainHeight(spawnX, spawnZ) + 3;
    this.player = new Player(spawnX, spawnY, spawnZ);
    this.chunks.update(spawnX, spawnZ);
    this.player.resolveStuck(this.chunks);
    this.renderer.scene.add(this.player.mesh);

    // Pointer lock
    this.container.addEventListener('click', this.handleContainerClick);

    this.createHighlight();
    this.loadGame();

    this.fpArmGroup = this.createFpArm();
    this.renderer.camera.add(this.fpArmGroup);

    this.running = true;
    this.animate();
  }

  private handleContainerClick = () => {
    if (!this.input.locked && this.openUI === 'none') {
      this.input.requestLock();
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
    const mesh = this.player.createHeldItemMesh(itemId);
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
          // Align tool handle inside hand, point diagonal forward/up-left, tilted at 60 deg (lowered to y = -0.56)
          slot.position.set(0.02, -0.56, -0.05);
          slot.rotation.set(0, 0, 0);
          mesh.rotation.set(-Math.PI / 4, 0, Math.PI / 4); // First person custom rotation (tilted inward towards center crosshair)
        } else {
          // Material / Food (lowered to y = -0.58)
          slot.position.set(0.02, -0.58, -0.08);
          slot.rotation.set(Math.PI / 6, Math.PI / 4, 0);
          mesh.rotation.set(0, 0, 0);
        }
      }
    }
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

  closeUI() {
    if (this.openUI === 'chest') {
      this.openChestPos = null;
    }
    this.openUI = 'none';
  }

  respawn() {
    const safePos = this.findSafeRespawnPosition();

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

      // Avoid water (13) and lava (14)
      if (surfaceBlockId === 13 || surfaceBlockId === 14 || belowBlockId === 13 || belowBlockId === 14) {
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

    // Game time (day/night cycle)
    this.gameTime = (this.gameTime + dt / DAY_LENGTH) % 1;
    this.renderer.setTimeOfDay(this.gameTime);

    // Underwater fog and background override
    const headBlock = this.chunks.getBlock(
      Math.floor(this.player.position.x),
      Math.floor(this.player.position.y + 1.62),
      Math.floor(this.player.position.z)
    );
    const isUnderwater = headBlock === 13;

    if (isUnderwater) {
      const waterFogColor = new THREE.Color(0x3F76E4);
      this.renderer.scene.background = waterFogColor;
      if (this.renderer.scene.fog) {
        const fog = this.renderer.scene.fog as THREE.Fog;
        fog.color.copy(waterFogColor);
        fog.near = 0;
        fog.far = 36;
      }
    } else {
      if (this.renderer.scene.fog) {
        const fog = this.renderer.scene.fog as THREE.Fog;
        fog.near = this.renderer.fogNear;
        fog.far = this.renderer.fogFar;
      }
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
    if (this.input.isKeyDown('e')) {
      this.openInventoryUI();
      this.input.keys.delete('e');
      this.renderer.render();
      this.notifyState();
      return;
    }

    // Consume scroll input (disabled to prevent accidental triggers on trackpads)
    this.input.consumeScroll();

    // Number keys 1-9
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
      sprint: this.input.isKeyDown('control') || this.input.isKeyDown('shift'),
      fly: false,
    }, this.chunks);

    // Mob system
    const isNight = this.isNight();
    this.mobs.update(dt, this.player.position, isNight,
      (x, y, z) => this.chunks.getBlock(x, y, z),
      (damage, knockback) => {
        this.player.health = Math.max(0, this.player.health - damage);
        this.player.velocity.add(knockback);
        this.damageFlashTimer = 0.3;
        this.sound.playHurt();
        this.particles.spawnDamageParticles(
          this.player.position.x,
          this.player.position.y + 1,
          this.player.position.z
        );
      },
      (x, y, z) => this.chunks.isSolidBlock(x, y, z)
    );

    // Resolve collisions (mob-mob, player-mob)
    this.resolveCollisions();

    // Collect mob drops from dead mobs
    this.collectMobDrops();

    if (this.input.isMouseDown(0) || this.input.isMouseDown(2)) {
      this.player.startSwing();
    }

    // F key → fly toggle
    if (this.input.isKeyDown('f')) {
      this.player.flying = !this.player.flying;
      this.input.keys.delete('f');
    }

    // F5 key → perspective toggle
    if (this.input.isKeyDown('f5')) {
      this.perspectiveMode = this.perspectiveMode === 'first' ? 'third' : 'first';
      this.input.keys.delete('f5');
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
        head.rotation.x = this.player.pitch;
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
        if (blockId !== 0 && BlockRegistry.isSolid(blockId)) {
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
    const selectedItemId = this.inventory.getSlot(this.player.selectedSlot)?.id ?? 0;
    const isHoldingSword = ItemRegistry.isTool(selectedItemId) &&
      ItemRegistry.get(selectedItemId)?.toolType === 'sword';
    const isHoldingTool = ItemRegistry.isTool(selectedItemId);
    const attackDamage = isHoldingTool
      ? (ItemRegistry.get(selectedItemId)?.damage ?? 1)
      : 1;

    if (this.input.isMouseDown(0) && this.swordSwingTimer <= 0) {
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
        const breakTime = ItemRegistry.getBreakTime(
          this.chunks.getBlock(bp.x, bp.y, bp.z),
          selectedItemId
        );

        if (this.breakingBlockPos && this.breakingBlockPos.equals(bp)) {
          this.breakProgress += dt / Math.max(breakTime, 0.05);
        } else {
          this.breakingBlockPos = bp.clone();
          this.breakProgress = dt / Math.max(breakTime, 0.05);
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

          // Drop item
          if (isDoor) {
            this.inventory.addItem(37, 1);
          } else {
            const dropId = ItemRegistry.getBlockDropItem(blockId);
            if (dropId > 0) {
              this.inventory.addItem(dropId, 1);
            }
          }

          // Damage tool
          const heldItemStack = this.inventory.getSlot(this.player.selectedSlot);
          if (heldItemStack && ItemRegistry.isTool(heldItemStack.id)) {
            this.inventory.damageTool(this.player.selectedSlot);
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
    } else {
      this.breakProgress = 0;
      this.breakingBlockPos = null;
      this.lastFrameWasBreaking = false;
    }

    // ─── Right click: place block / interact ───
    if (this.input.isMouseDown(2) && this.placeCooldown <= 0) {
      if (this.targetBlock) {
        const { blockPos, faceNormal } = this.targetBlock;
        const targetId = this.chunks.getBlock(blockPos.x, blockPos.y, blockPos.z);

        // Right-click furnace
        if (targetId === 25) {
          this.openFurnaceUI();
          this.placeCooldown = 0.5;
        } else if (targetId === 24) {
          this.openCraftingTableUI();
          this.placeCooldown = 0.5;
        } else if (targetId === 36) {
          this.openChestUI(blockPos.x, blockPos.y, blockPos.z);
          this.placeCooldown = 0.5;
        } else if (this.isDoorBlock(targetId)) {
          this.toggleDoor(blockPos.x, blockPos.y, blockPos.z);
          this.sound.playLever();
          this.placeCooldown = 0.25;
        } else if (this.isTrapdoorBlock(targetId)) {
          this.toggleTrapdoor(blockPos.x, blockPos.y, blockPos.z);
          this.sound.playLever();
          this.placeCooldown = 0.25;
        } else if (targetId === 34) {
          const powered = this.redstone.toggleLever(blockPos.x, blockPos.y, blockPos.z);
          this.updateRedstoneMetadata(blockPos.x, blockPos.y, blockPos.z, {
            powered,
            signal: powered ? 15 : 0,
          });
          this.sound.playLever();
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
              const blockId = ItemRegistry.isBlock(slot.id) ? slot.id : 0;
              if (blockId > 0) {
                let facing: BlockFacing = 'north';
                if (faceNormal.x > 0) facing = 'east';
                else if (faceNormal.x < 0) facing = 'west';
                else if (faceNormal.y > 0) facing = 'up';
                else if (faceNormal.y < 0) facing = 'down';
                else if (faceNormal.z > 0) facing = 'south';
                else if (faceNormal.z < 0) facing = 'north';

                if (blockId === 37) {
                  const placed = this.placeDoor(placePos.x, placePos.y, placePos.z);
                  if (placed) {
                    this.sound.playBlockPlace();
                    this.inventory.removeFromSlot(this.player.selectedSlot);
                    this.placeCooldown = 0.25;
                  }
                } else {
                  this.chunks.setBlock(placePos.x, placePos.y, placePos.z, blockId);
                  this.sound.playBlockPlace();
                  this.inventory.removeFromSlot(this.player.selectedSlot);
                  this.placeCooldown = 0.25;

                  // Register redstone component if it is one
                  this.setPlacedBlockMetadata(placePos.x, placePos.y, placePos.z, blockId, facing);

                  // If placing water/lava, start fluid simulation
                  if (blockId === 13 || blockId === 14) {
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
    const pointingAtInteractive = this.targetBlock && (targetBlockId === 25 || targetBlockId === 24 || targetBlockId === 34 || targetBlockId === 36 || this.isDoorBlock(targetBlockId) || this.isTrapdoorBlock(targetBlockId));

    if (this.input.isMouseDown(2) && isHoldingFood && !pointingAtInteractive && this.player.hunger < 20) {
      this.eatingTimer += dt;
      this.chewSoundTimer += dt;

      if (this.chewSoundTimer >= 0.25) {
        this.chewSoundTimer = 0;
        this.sound.playEat();

        let foodColor = 0xC0A080;
        if (foodSlotStack.id === 170) foodColor = 0xFF0000;
        else if (foodSlotStack.id === 172 || foodSlotStack.id === 173) foodColor = 0xA04040;

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
    const isMoving = (this.input.isKeyDown('w') || this.input.isKeyDown('s') || this.input.isKeyDown('a') || this.input.isKeyDown('d')) && !this.player.flying;
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

    this.survival.update(dt, this.player, (x, y, z) => this.chunks.getBlock(x, y, z), (dmg) => {
      this.player.health = Math.max(0, this.player.health - dmg);
      this.damageFlashTimer = 0.3;
      this.sound.playHurt();
    });

    // Death check
    if (this.player.health <= 0) {
      this.openUI = 'death';
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
      (x, y, z, id) => this.chunks.setBlock(x, y, z, id)
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

  private collectMobDrops() {
    // Check for dead mobs and drop XP/items
    for (const mob of this.mobs.mobs.values()) {
      if (mob.isDead()) {
        this.sound.playMobDeath();
        // Spawn death particles
        this.particles.spawnDeathParticles(
          mob.position.x,
          mob.position.y,
          mob.position.z,
          mob.def.bodyColor
        );

        // Drop items
        for (const drop of mob.def.drops) {
          if (Math.random() < drop.chance) {
            this.inventory.addItem(drop.id, drop.count);
          }
        }
      }
    }
  }

  private checkFluidAdjacency(x: number, y: number, z: number) {
    const dirs: [number, number, number][] = [[0,1,0],[0,-1,0],[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]];
    for (const [dx, dy, dz] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      const nz = z + dz;
      const nb = this.chunks.getBlock(nx, ny, nz);
      if (nb === 13 || nb === 14) {
        this.fluids.addSource(nx, ny, nz, nb);
      }
    }
  }

  private getBlockParticleColor(blockId: number): number {
    const colors: Record<number, number> = {
      1: 0x888888,   // stone
      2: 0x5B8C32,   // grass
      3: 0x8B6914,   // dirt
      4: 0x7A7A7A,   // cobblestone
      5: 0xBC9862,   // oak planks
      6: 0x6B511D,   // oak log
      7: 0x3A7D1A,   // leaves
      8: 0xE8D7A3,   // sand
      19: 0x9B4B3A,  // bricks
      26: 0xCCEEFF,  // glass
    };
    return colors[blockId] ?? 0xAAAAAA;
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

  private notifyState() {
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
    const isUnderwater = headBlock === 13;

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
        data: new Uint8Array(chunk.data),
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

      this.player.position.set(data.player.x, data.player.y, data.player.z);
      this.player.yaw = data.player.yaw;
      this.player.pitch = data.player.pitch;
      this.player.health = data.player.health;
      this.player.hunger = data.player.hunger;
      this.player.flying = data.player.flying;

      if (data.inventory) {
        this.inventory.fromJSON(data.inventory.slots);
        if (data.inventory.armor) {
          this.inventory.armor = data.inventory.armor;
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

    if (blockId === 36) {
      this.chunks.setBlockMeta(x, y, z, {
        facing,
        containerType: 'chest',
        inventory: new Array(27).fill(null),
      }, true);
      return;
    }

    if (blockId === 39) {
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
    if (blockId === 30) return 'torch';
    if (blockId === 31) return 'wire';
    if (blockId === 32) return 'repeater';
    if (blockId === 33) return 'piston';
    if (blockId === 34) return 'lever';
    return null;
  }

  private usesFacingMetadata(blockId: number): boolean {
    return blockId === 24 || blockId === 25 || blockId === 36 || blockId === 39 || blockId === 40;
  }

  private isDoorBlock(blockId: number): boolean {
    return blockId === 37 || blockId === 38;
  }

  private isTrapdoorBlock(blockId: number): boolean {
    return blockId === 39 || blockId === 40;
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

  private placeDoor(x: number, y: number, z: number): boolean {
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
    this.chunks.setBlock(x, y, z, 37);
    this.chunks.setBlockMeta(x, y, z, {
      facing,
      doorHalf: 'lower',
      hinge,
      open: false,
    }, true);

    this.chunks.setBlock(x, y + 1, z, 37);
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
    const blockId = open ? 38 : 37;

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
    const facing = meta?.facing ?? 'north';
    const nextBlockId = open ? 40 : 39;

    this.chunks.setBlock(x, y, z, nextBlockId);
    this.chunks.setBlockMeta(x, y, z, {
      ...meta,
      facing,
      open,
    }, true);
  }

  private ensureChestMetadata(x: number, y: number, z: number): BlockMetadata | null {
    if (this.chunks.getBlock(x, y, z) !== 36) return null;

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

  private updateDynamicLighting() {
    const lightPositions: THREE.Vector3[] = [];
    const px = Math.floor(this.player.position.x);
    const py = Math.floor(this.player.position.y);
    const pz = Math.floor(this.player.position.z);
    const radius = 12;

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dz = -radius; dz <= radius; dz++) {
          const blockId = this.chunks.getBlock(px + dx, py + dy, pz + dz);
          // Torch (30) or Lava (14)
          if (blockId === 30 || blockId === 14) {
            lightPositions.push(new THREE.Vector3(px + dx + 0.5, py + dy + 0.5, pz + dz + 0.5));
          }
        }
      }
    }

    // Sort by distance to player
    lightPositions.sort((a, b) => a.distanceToSquared(this.player.position) - b.distanceToSquared(this.player.position));
    this.renderer.updateTorchLights(lightPositions.slice(0, 4));
  }

  getItemIconStyle(itemId: number, iconSize: number = 32): any {
    let key = 'stone';
    if (itemId >= 1 && itemId <= 99) {
      const block = BlockRegistry.get(itemId);
      if (block) {
        // Liquids, torches, repeaters, doors, redstone and levers remain 2D
        if (itemId === 13 || itemId === 14 || itemId === 30 || itemId === 31 || itemId === 32 || itemId === 34 || itemId === 37 || itemId === 38 || itemId === 39 || itemId === 40) {
          if (itemId === 37 || itemId === 38) key = 'oak_door_closed';
          else if (itemId === 39 || itemId === 40) key = 'oak_trapdoor_closed';
          else if (itemId === 31) key = 'redstone';
          else key = block.textureKey;
        } else {
          // All other solid blocks get beautiful 3D isometric icons
          key = `${block.name}_icon`;
        }
      }
    } else {
      const item = ItemRegistry.get(itemId);
      if (item) key = item.name;
    }
    return this.atlas.getIconStyle(key, iconSize);
  }

  dispose() {
    this.running = false;
    this.container.removeEventListener('click', this.handleContainerClick);
    this.saveGame();
    this.mobs.dispose();
    this.particles.dispose();
    this.weather.dispose();
    this.sound.dispose();
    this.redstone.dispose();
    this.input.dispose();
    this.renderer.dispose();
  }
}
