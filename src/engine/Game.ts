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

export type UIType = 'none' | 'inventory' | 'furnace' | 'crafting_table';

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
  onGround: boolean;
  flying: boolean;
  openUI: UIType;
  inventory: Inventory;
  heldItemId: number;
  isNight: boolean;
}

export type GameStateListener = (state: GameState) => void;

const BIOME_NAMES = ['Plains', 'Desert', 'Mountains', 'Forest', 'Snow', 'Ocean'];
const DAY_LENGTH = 600; // 10 minutes in seconds

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
  private gameTime = 0.25; // start at sunrise (0=midnight, 0.25=sunrise, 0.5=noon, 0.75=sunset)
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

    // Default hotbar
    this.inventory.setSlot(0, { id: 2, count: 64 });
    this.inventory.setSlot(1, { id: 1, count: 64 });
    this.inventory.setSlot(2, { id: 5, count: 64 });
    this.inventory.setSlot(3, { id: 6, count: 64 });
    this.inventory.setSlot(4, { id: 4, count: 64 });
    this.inventory.setSlot(5, { id: 8, count: 64 });
    this.inventory.setSlot(6, { id: 30, count: 64 });
    this.inventory.setSlot(7, { id: 26, count: 64 });
    this.inventory.setSlot(8, { id: 7, count: 64 });

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
          mesh.rotation.set(Math.PI / 3, -Math.PI / 5, 0); // First person custom rotation (60 deg tilt forward)
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

    // UI open: skip game input
    if (this.openUI !== 'none') {
      this.particles.update(dt);
      this.mobs.update(dt, this.player.position,
        (x, y, z) => this.chunks.getBlock(x, y, z),
        () => {} // no mob attacks while UI open
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

    // Hotbar scroll
    const scroll = this.input.consumeScroll();
    if (scroll !== 0) {
      this.player.selectedSlot = ((this.player.selectedSlot + (scroll > 0 ? 1 : -1)) % 9 + 9) % 9;
    }

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
      sprint: this.input.isKeyDown('control'),
      fly: false,
    }, this.chunks);

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

          // Spawn break particles
          if (blockDef) {
            const blockColor = this.getBlockParticleColor(blockId);
            this.particles.spawnBlockBreak(bp.x, bp.y, bp.z, blockColor);
          }

          // Drop item
          const dropId = ItemRegistry.getBlockDropItem(blockId);
          if (dropId > 0) {
            this.inventory.addItem(dropId, 1);
          }

          // Damage tool
          const heldItemStack = this.inventory.getSlot(this.player.selectedSlot);
          if (heldItemStack && ItemRegistry.isTool(heldItemStack.id)) {
            this.inventory.damageTool(this.player.selectedSlot);
          }

          // Fluid check: if breaking a block next to water, trigger flow
          this.checkFluidAdjacency(bp.x, bp.y, bp.z);

          this.redstone.unregister(bp.x, bp.y, bp.z);
          this.chunks.setBlock(bp.x, bp.y, bp.z, 0);
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
        } else if (targetId === 34) {
          this.redstone.toggleLever(blockPos.x, blockPos.y, blockPos.z);
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
                this.chunks.setBlock(placePos.x, placePos.y, placePos.z, blockId);
                this.sound.playBlockPlace();
                this.inventory.removeFromSlot(this.player.selectedSlot);
                this.placeCooldown = 0.25;

                // Register redstone component if it is one
                let facing: 'north' | 'south' | 'east' | 'west' | 'up' | 'down' = 'north';
                if (faceNormal.x > 0) facing = 'east';
                else if (faceNormal.x < 0) facing = 'west';
                else if (faceNormal.y > 0) facing = 'up';
                else if (faceNormal.y < 0) facing = 'down';
                else if (faceNormal.z > 0) facing = 'south';
                else if (faceNormal.z < 0) facing = 'north';

                if (blockId === 30) this.redstone.register(placePos.x, placePos.y, placePos.z, 'torch', facing);
                else if (blockId === 31) this.redstone.register(placePos.x, placePos.y, placePos.z, 'wire', facing);
                else if (blockId === 32) this.redstone.register(placePos.x, placePos.y, placePos.z, 'repeater', facing);
                else if (blockId === 33) this.redstone.register(placePos.x, placePos.y, placePos.z, 'piston', facing);
                else if (blockId === 34) this.redstone.register(placePos.x, placePos.y, placePos.z, 'lever', facing);

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

    // ─── Food Eating ───
    const foodSlotStack = this.inventory.getSlot(this.player.selectedSlot);
    const isHoldingFood = foodSlotStack && ItemRegistry.isFood(foodSlotStack.id);
    const targetBlockId = this.targetBlock ? this.chunks.getBlock(this.targetBlock.blockPos.x, this.targetBlock.blockPos.y, this.targetBlock.blockPos.z) : 0;
    const pointingAtInteractive = this.targetBlock && (targetBlockId === 25 || targetBlockId === 24 || targetBlockId === 34);

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

    // Mob system
    this.mobs.update(dt, this.player.position,
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
      }
    );

    // Collect mob drops from dead mobs
    this.collectMobDrops();

    // Survival
    this.survival.update(dt, this.player, (x, y, z) => this.chunks.getBlock(x, y, z), (dmg) => {
      this.player.health = Math.max(0, this.player.health - dmg);
      this.damageFlashTimer = 0.3;
      this.sound.playHurt();
    });

    // Redstone simulation
    this.redstone.update(
      dt,
      (x, y, z) => this.chunks.getBlock(x, y, z),
      (x, y, z, id) => this.chunks.setBlock(x, y, z, id),
      (soundType) => {
        if (soundType === 'piston_extend') this.sound.playPistonExtend();
        else if (soundType === 'piston_retract') this.sound.playPistonRetract();
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
    const isNight = this.gameTime > 0.35 && this.gameTime < 0.75;
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

    const isNight = this.gameTime > 0.35 && this.gameTime < 0.75;

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
      onGround: this.player.onGround,
      flying: this.player.flying,
      openUI: this.openUI,
      inventory: this.inventory,
      heldItemId: selectedSlot?.id ?? 0,
      isNight,
    };

    for (const listener of this.stateListeners) {
      listener(state);
    }
  }

  private async saveGame() {
    const chunkData: { cx: number; cz: number; data: Uint8Array }[] = [];
    for (const [, chunk] of this.chunks.chunks) {
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

      this.chunks.update(this.player.position.x, this.player.position.z);
      this.player.resolveStuck(this.chunks);

      console.log('Game loaded from save');
    } catch (e) {
      console.warn('Load failed:', e);
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
        if (itemId === 2) key = 'grass_top';
        else if (itemId === 24) key = 'crafting_top';
        else if (itemId === 25) key = 'furnace_side';
        else if (itemId === 21) key = 'tnt_side';
        else key = block.textureKey;
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
