import * as THREE from 'three';
import {
  GRAVITY, JUMP_VELOCITY, WALK_SPEED, SPRINT_SPEED,
  PLAYER_WIDTH, PLAYER_HEIGHT, PLAYER_EYE_HEIGHT, MAX_REACH
} from '../constants';
import { ChunkManager } from '../world/ChunkManager';
import { BlockRegistry } from '../world/BlockRegistry';
import { ItemRegistry } from '../items/ItemRegistry';

export class Player {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  yaw = 0;
  pitch = 0;
  onGround = false;
  selectedSlot = 0;
  health = 20;
  hunger = 20;
  saturation = 20;
  oxygen = 15.0; // oxygen in seconds (15 seconds max)
  flying = false;
  mesh: THREE.Group;

  private halfWidth = PLAYER_WIDTH / 2;
  swingProgress = 0;
  private lastHeldItemId = -1;

  startSwing() {
    if (this.swingProgress === 0) {
      this.swingProgress = 0.01;
    }
  }

  constructor(spawnX: number, spawnY: number, spawnZ: number) {
    this.position = new THREE.Vector3(spawnX, spawnY, spawnZ);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.mesh = this.createMesh();
  }

  get eyePosition(): THREE.Vector3 {
    return new THREE.Vector3(
      this.position.x,
      this.position.y + PLAYER_EYE_HEIGHT,
      this.position.z
    );
  }

  get forward(): THREE.Vector3 {
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    dir.applyAxisAngle(new THREE.Vector3(1, 0, 0), this.pitch);
    return dir.normalize();
  }

  update(dt: number, input: { dx: number; dy: number; forward: boolean; back: boolean; left: boolean; right: boolean; jump: boolean; sprint: boolean; fly: boolean }, chunks: ChunkManager) {
    // Update swing progress
    if (this.swingProgress > 0) {
      this.swingProgress += dt * 5.0; // swing takes 0.2s
      if (this.swingProgress >= 1.0) {
        this.swingProgress = 0;
      }
    }

    // Mouse look
    const sensitivity = 0.002;
    this.yaw -= input.dx * sensitivity;
    this.pitch -= input.dy * sensitivity;
    this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));

    // Movement direction
    const moveDir = new THREE.Vector3(0, 0, 0);
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    if (input.forward) moveDir.add(forward);
    if (input.back) moveDir.sub(forward);
    if (input.right) moveDir.add(right);
    if (input.left) moveDir.sub(right);

    if (moveDir.lengthSq() > 0) moveDir.normalize();

    // Fly toggle
    if (input.fly) this.flying = !this.flying;

    const speed = input.sprint ? SPRINT_SPEED : WALK_SPEED;

    if (this.flying) {
      // Flying mode
      this.velocity.x = moveDir.x * speed * 2;
      this.velocity.z = moveDir.z * speed * 2;
      if (input.jump) this.velocity.y = speed * 1.5;
      else if (input.forward && input.jump) this.velocity.y = speed;
      else this.velocity.y *= 0.8;
    } else {
      // Fluid or Walking mode
      const px = Math.floor(this.position.x);
      const py = Math.floor(this.position.y);
      const pz = Math.floor(this.position.z);

      const footBlock = chunks.getBlock(px, py, pz);
      const bodyBlock = chunks.getBlock(px, py + 1, pz);
      const inFluid = footBlock === 13 || footBlock === 14 || bodyBlock === 13 || bodyBlock === 14;

      if (inFluid) {
        // Swimming mode
        this.velocity.x = moveDir.x * speed * 0.5;
        this.velocity.z = moveDir.z * speed * 0.5;

        if (input.jump) {
          // Swim up
          this.velocity.y = Math.min(2.0, this.velocity.y + 12 * dt);
        } else {
          // Slow drift down (buoyancy)
          this.velocity.y += GRAVITY * 0.15 * dt;
          this.velocity.y = Math.max(-1.5, this.velocity.y);
        }
      } else {
        // Walking mode
        this.velocity.x = moveDir.x * speed;
        this.velocity.z = moveDir.z * speed;

        // Gravity
        this.velocity.y += GRAVITY * dt;

        // Jump
        if (input.jump && this.onGround) {
          this.velocity.y = JUMP_VELOCITY;
          this.onGround = false;
        }
      }
    }

    // Apply velocity with collision
    this.moveWithCollision(dt, chunks);
  }

  resolveStuck(chunks: ChunkManager) {
    let limit = 0;
    while (this.checkCollision(chunks) && limit < 100) {
      this.position.y += 0.1;
      limit++;
    }
    if (limit > 0) {
      this.velocity.y = 0;
      this.onGround = true;
    }
  }

  private moveWithCollision(dt: number, chunks: ChunkManager) {
    // Move along each axis independently
    const hw = this.halfWidth;

    // X axis
    this.position.x += this.velocity.x * dt;
    if (this.checkCollision(chunks)) {
      this.position.x -= this.velocity.x * dt;
      this.velocity.x = 0;
    }

    // Y axis
    const prevY = this.position.y;
    this.position.y += this.velocity.y * dt;
    this.onGround = false;

    if (this.checkCollision(chunks)) {
      if (this.velocity.y < 0) {
        // Landing - snap to block top
        this.position.y = Math.floor(prevY) + 0.001;
        this.onGround = true;
      } else {
        this.position.y = prevY;
      }
      this.velocity.y = 0;
    }

    // Z axis
    this.position.z += this.velocity.z * dt;
    if (this.checkCollision(chunks)) {
      this.position.z -= this.velocity.z * dt;
      this.velocity.z = 0;
    }

    // Don't fall through world
    if (this.position.y < 0) {
      this.position.y = 0;
      this.velocity.y = 0;
      this.onGround = true;
    }
  }

  public checkCollision(chunks: ChunkManager): boolean {
    const hw = this.halfWidth;
    const minX = Math.floor(this.position.x - hw);
    const maxX = Math.floor(this.position.x + hw);
    const minY = Math.floor(this.position.y);
    const maxY = Math.floor(this.position.y + PLAYER_HEIGHT);
    const minZ = Math.floor(this.position.z - hw);
    const maxZ = Math.floor(this.position.z + hw);

    for (let bx = minX; bx <= maxX; bx++) {
      for (let by = minY; by <= maxY; by++) {
        for (let bz = minZ; bz <= maxZ; bz++) {
          const blockId = chunks.getBlock(bx, by, bz);
          if (blockId === 0) continue;
          if (!chunks.isSolidBlock(bx, by, bz)) continue;

          // AABB intersection
          if (
            this.position.x + hw > bx && this.position.x - hw < bx + 1 &&
            this.position.y + PLAYER_HEIGHT > by && this.position.y < by + 1 &&
            this.position.z + hw > bz && this.position.z - hw < bz + 1
          ) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Raycast from camera to find block in reach
   */
  raycast(chunks: ChunkManager): { blockPos: THREE.Vector3; faceNormal: THREE.Vector3 } | null {
    const origin = this.eyePosition;
    const dir = this.forward;

    const step = 0.05;
    const pos = origin.clone();
    let prevBlock = new THREE.Vector3(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z));

    for (let t = 0; t < MAX_REACH; t += step) {
      pos.copy(origin).addScaledVector(dir, t);

      const bx = Math.floor(pos.x);
      const by = Math.floor(pos.y);
      const bz = Math.floor(pos.z);

      if (bx === prevBlock.x && by === prevBlock.y && bz === prevBlock.z) continue;

      const blockId = chunks.getBlock(bx, by, bz);
      if (blockId !== 0 && BlockRegistry.isSolid(blockId)) {
        const faceNormal = new THREE.Vector3(
          prevBlock.x - bx,
          prevBlock.y - by,
          prevBlock.z - bz
        );

        return {
          blockPos: new THREE.Vector3(bx, by, bz),
          faceNormal: faceNormal,
        };
      }

      prevBlock.set(bx, by, bz);
    }

    return null;
  }

  private createMesh(): THREE.Group {
    const group = new THREE.Group();
    // Steve colors
    const skinColor = 0xFFCC99;
    const shirtColor = 0x008080; // cyan/teal shirt
    const pantsColor = 0x2244AA; // blue pants
    const hairColor = 0x553311; // brown hair

    // Head group
    const headGroup = new THREE.Group();
    headGroup.name = 'head';
    headGroup.position.set(0, 1.35, 0);

    const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    const headMat = new THREE.MeshLambertMaterial({ color: skinColor });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0, 0.2, 0);
    headGroup.add(head);

    // Hair cap
    const hairGeo = new THREE.BoxGeometry(0.42, 0.12, 0.42);
    const hairMat = new THREE.MeshLambertMaterial({ color: hairColor });
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.set(0, 0.35, 0.01);
    headGroup.add(hair);

    // Eyes
    const eyeGeo = new THREE.BoxGeometry(0.06, 0.03, 0.02);
    const eyeMat = new THREE.MeshLambertMaterial({ color: 0x0000FF });
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.1, 0.2, 0.201);
    eyeR.position.set(0.1, 0.2, 0.201);
    headGroup.add(eyeL, eyeR);

    group.add(headGroup);

    // Body
    const bodyGeo = new THREE.BoxGeometry(0.48, 0.6, 0.24);
    const bodyMat = new THREE.MeshLambertMaterial({ color: shirtColor });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(0, 1.05, 0);
    group.add(body);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.2, 0.75, 0.22);
    const legMat = new THREE.MeshLambertMaterial({ color: pantsColor });

    const legL = new THREE.Mesh(legGeo, legMat);
    legL.name = 'legL';
    legL.position.set(0.12, 0.375, 0);

    const legR = new THREE.Mesh(legGeo, legMat);
    legR.name = 'legR';
    legR.position.set(-0.12, 0.375, 0);

    group.add(legL, legR);

    // Arms
    const armGeo = new THREE.BoxGeometry(0.2, 0.6, 0.22);
    const armMat = new THREE.MeshLambertMaterial({ color: shirtColor });

    const armL = new THREE.Mesh(armGeo, armMat);
    armL.name = 'armL';
    armL.position.set(0.35, 1.05, 0);

    const armR = new THREE.Mesh(armGeo, armMat);
    armR.name = 'armR';
    armR.position.set(-0.35, 1.05, 0);

    const heldItemSlot = new THREE.Group();
    heldItemSlot.name = 'heldItemSlot';
    heldItemSlot.position.set(0, -0.38, 0.06);
    armR.add(heldItemSlot);

    group.add(armL, armR);

    return group;
  }

  updateHeldItem(itemId: number) {
    if (itemId === this.lastHeldItemId) return;
    this.lastHeldItemId = itemId;

    const armR = this.mesh.getObjectByName('armR');
    if (!armR) return;
    const slot = armR.getObjectByName('heldItemSlot');
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

    // Create new mesh
    const mesh = this.createHeldItemMesh(itemId);
    if (mesh) {
      slot.add(mesh);
    }
  }

  createHeldItemMesh(itemId: number): THREE.Object3D | null {
    const group = new THREE.Group();

    const getMaterialColor = (mat: string): number => {
      if (mat === 'diamond') return 0x5DECF5;
      if (mat === 'iron') return 0xD8D8D8;
      if (mat === 'gold') return 0xFFD700;
      if (mat === 'stone') return 0x777777;
      return 0x8B4513; // wood
    };

    const itemDef = ItemRegistry.get(itemId);
    if (!itemDef) return null;

    if (itemDef.category === 'block') {
      const geo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
      const color = this.getBlockColor(itemId);
      const mat = new THREE.MeshLambertMaterial({ color });
      const mesh = new THREE.Mesh(geo, mat);
      group.add(mesh);
    } else if (itemDef.category === 'tool' && itemDef.toolType) {
      const matColor = getMaterialColor(itemDef.toolMaterial ?? 'wood');

      // Handle/Stick
      const handleGeo = new THREE.BoxGeometry(0.03, 0.35, 0.03);
      const handleMat = new THREE.MeshLambertMaterial({ color: 0x5A3A1A });
      const handle = new THREE.Mesh(handleGeo, handleMat);
      group.add(handle);

      if (itemDef.toolType === 'sword') {
        // Blade
        const bladeGeo = new THREE.BoxGeometry(0.05, 0.35, 0.02);
        const bladeMat = new THREE.MeshLambertMaterial({ color: matColor });
        const blade = new THREE.Mesh(bladeGeo, bladeMat);
        blade.position.set(0, 0.25, 0);

        // Guard
        const guardGeo = new THREE.BoxGeometry(0.14, 0.03, 0.04);
        const guardMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
        const guard = new THREE.Mesh(guardGeo, guardMat);
        guard.position.set(0, 0.08, 0);

        group.add(blade, guard);
      } else if (itemDef.toolType === 'pickaxe') {
        const headGeo = new THREE.BoxGeometry(0.22, 0.04, 0.04);
        const headMat = new THREE.MeshLambertMaterial({ color: matColor });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.set(0, 0.16, 0);
        group.add(head);
      } else if (itemDef.toolType === 'axe') {
        const headGeo = new THREE.BoxGeometry(0.11, 0.10, 0.04);
        const headMat = new THREE.MeshLambertMaterial({ color: matColor });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.set(0.04, 0.13, 0);
        group.add(head);
      } else if (itemDef.toolType === 'shovel') {
        const headGeo = new THREE.BoxGeometry(0.07, 0.07, 0.03);
        const headMat = new THREE.MeshLambertMaterial({ color: matColor });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.set(0, 0.18, 0);
        group.add(head);
      }

      // Rotate tool to look natural in hand
      group.rotation.x = Math.PI / 3;
      group.rotation.y = -Math.PI / 4;
    } else {
      // Food or Material
      let color = 0x8B4513; // default stick/brown
      if (itemId === 101) color = 0x222222; // coal
      else if (itemId === 102 || itemId === 105) color = 0xD8D8D8; // iron
      else if (itemId === 103 || itemId === 106) color = 0xFFD700; // gold
      else if (itemId === 104) color = 0x5DECF5; // diamond
      else if (itemId === 170) color = 0xEE2222; // apple
      else if (itemId === 171) color = 0xD2B48C; // bread
      else if (itemId === 172 || itemId === 173 || itemId === 174 || itemId === 175) color = 0xA04040; // meat

      const geo = new THREE.BoxGeometry(0.09, 0.09, 0.09);
      const mat = new THREE.MeshLambertMaterial({ color });
      const mesh = new THREE.Mesh(geo, mat);
      group.add(mesh);
    }

    return group;
  }

  private getBlockColor(blockId: number): number {
    const colors: Record<number, number> = {
      1: 0x888888,   // stone
      2: 0x5B8C32,   // grass
      3: 0x8B6914,   // dirt
      4: 0x7A7A7A,   // cobblestone
      5: 0xBC9862,   // oak planks
      6: 0x6B511D,   // oak log
      7: 0x3A7D1A,   // leaves
      8: 0xE8D7A3,   // sand
      13: 0x2B4FA8,  // water
      14: 0xD84400,  // lava
      19: 0x9B4B3A,  // bricks
      24: 0xBC9862,  // crafting table
      25: 0x888888,  // furnace
      26: 0xCCEEFF,  // glass
      27: 0xF0F0F0,  // snow
      28: 0x96C8FF,  // ice
      29: 0x9EA4B0,  // clay
      30: 0xFFAA00,  // torch
      31: 0xCC0000,  // redstone wire
      32: 0x888888,  // repeater
      33: 0x888888,  // piston
      34: 0x666666,  // lever
      35: 0x1B0B2E,  // obsidian
    };
    return colors[blockId] ?? 0xAAAAAA;
  }
}
