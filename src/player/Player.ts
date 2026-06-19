import * as THREE from 'three';
import {
  GRAVITY, JUMP_VELOCITY, WALK_SPEED, SPRINT_SPEED,
  PLAYER_WIDTH, PLAYER_HEIGHT, PLAYER_EYE_HEIGHT, MAX_REACH
} from '../constants';
import { ChunkManager } from '../world/ChunkManager';
import { BlockRegistry } from '../world/BlockRegistry';
import { ItemRegistry } from '../items/ItemRegistry';
import { VisualResolver } from '../visual/VisualResolver';

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
  speedMultiplier = 1;
  mesh: THREE.Group;

  private halfWidth = PLAYER_WIDTH / 2;
  swingProgress = 0;
  private lastHeldItemId = -1;
  private lastArmorIds = [-1, -1, -1, -1];

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
    const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    dir.applyEuler(euler);
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

    const speed = (input.sprint ? SPRINT_SPEED : WALK_SPEED) * this.speedMultiplier;

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
      const inFluid = BlockRegistry.isFluid(footBlock) || BlockRegistry.isFluid(bodyBlock);

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
        let currentSpeed = speed;
        const bx = Math.floor(this.position.x);
        const by = Math.floor(this.position.y - 0.1);
        const bz = Math.floor(this.position.z);
        const standBlockId = chunks.getBlock(bx, by, bz) & 0x3FF;
        if (standBlockId === 88) {
          currentSpeed *= 0.4;
        }
        
        this.velocity.x = moveDir.x * currentSpeed;
        this.velocity.z = moveDir.z * currentSpeed;

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
    const hw = this.halfWidth;

    // Detect doors/trapdoors the player is already colliding with to ignore them during this physics step (allows walking out)
    const ignoredBlocks = new Set<string>();
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
          const def = BlockRegistry.get(blockId);
          const isDoorOrTrapdoor = def && (def.name.endsWith('door') || def.name.includes('trapdoor'));
          if (isDoorOrTrapdoor) {
            if (chunks.isSolidBlock(bx, by, bz)) {
              if (
                this.position.x + hw > bx && this.position.x - hw < bx + 1 &&
                this.position.y + PLAYER_HEIGHT > by && this.position.y < by + 1 &&
                this.position.z + hw > bz && this.position.z - hw < bz + 1
              ) {
                ignoredBlocks.add(`${bx},${by},${bz}`);
              }
            }
          }
        }
      }
    }

    // X axis
    this.position.x += this.velocity.x * dt;
    if (this.checkCollision(chunks, ignoredBlocks)) {
      this.position.x -= this.velocity.x * dt;
      this.velocity.x = 0;
    }

    // Y axis
    const prevY = this.position.y;
    this.position.y += this.velocity.y * dt;
    this.onGround = false;

    if (this.checkCollision(chunks, ignoredBlocks)) {
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
    if (this.checkCollision(chunks, ignoredBlocks)) {
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

  public checkCollision(chunks: ChunkManager, ignoredBlocks?: Set<string>): boolean {
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
          if (ignoredBlocks && ignoredBlocks.has(`${bx},${by},${bz}`)) {
            continue;
          }
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
      if (blockId !== 0 && chunks.isSolidBlock(bx, by, bz)) {
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

    // Minecraft Steve head: 8x8x8 pixel cube with per-face coloring.
    // Face order in THREE.js BoxGeometry: +X(right), -X(left), +Y(top), -Y(bottom), +Z(front), -Z(back)
    const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const hairMat = new THREE.MeshLambertMaterial({ color: hairColor });
    const headSkinMat = new THREE.MeshLambertMaterial({ color: skinColor });
    const headMaterials = [
      hairMat,      // +X right side — hair
      hairMat,      // -X left side — hair
      hairMat,      // +Y top — hair
      headSkinMat,  // -Y bottom — skin (neck)
      headSkinMat,  // +Z front — face/skin
      hairMat,      // -Z back — hair
    ];
    const head = new THREE.Mesh(headGeo, headMaterials);
    head.position.set(0, 0.25, 0);
    headGroup.add(head);

    // Forehead fringe (bangs) — a thin strip on the upper front of the head
    // Positioned flush with the front face, covering the top ~2 pixels of the face
    const fringeGeo = new THREE.BoxGeometry(0.5, 0.12, 0.02);
    const fringeMat = new THREE.MeshLambertMaterial({ color: hairColor });
    const fringe = new THREE.Mesh(fringeGeo, fringeMat);
    fringe.name = 'bangs';
    fringe.position.set(0, 0.44, 0.26);
    headGroup.add(fringe);

    // Eyes
    const eyeGeo = new THREE.BoxGeometry(0.06, 0.03, 0.02);
    const eyeMat = new THREE.MeshLambertMaterial({ color: 0x0000FF });
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.1, 0.25, 0.251);
    eyeR.position.set(0.1, 0.25, 0.251);
    headGroup.add(eyeL, eyeR);

    group.add(headGroup);

    // Body
    const bodyGeo = new THREE.BoxGeometry(0.48, 0.6, 0.24);
    const bodyMat = new THREE.MeshLambertMaterial({ color: shirtColor });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.name = 'body';
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
    const mesh = this.createItemVisualMesh(itemId);
    if (mesh) {
      slot.add(mesh);
    }
  }

  updateArmorMesh(armor: (any | null)[]) {
    if (!armor || !Array.isArray(armor)) return;
    let changed = false;
    for (let i = 0; i < 4; i++) {
      const id = armor[i]?.id ?? 0;
      if (id !== this.lastArmorIds[i]) {
        changed = true;
        this.lastArmorIds[i] = id;
      }
    }
    if (!changed) return;

    this.removeArmorMeshes();

    // Keep bangs visible under the helmet (do not hide them)

    for (let i = 0; i < 4; i++) {
      const item = armor[i];
      if (!item) continue;

      const itemDef = ItemRegistry.get(item.id);
      if (!itemDef || itemDef.category !== 'armor') continue;

      const isIron = itemDef.name.startsWith('iron_');
      const color = isIron ? 0xd8d8d8 : 0x55ffff;
      const mat = new THREE.MeshLambertMaterial({ color });

      if (i === 0) { // Helmet — seamless shell with thick walls + front brow
        const head = this.mesh.getObjectByName('head');
        if (head) {
          const helmetGroup = new THREE.Group();
          helmetGroup.name = 'armor_helmet';
          helmetGroup.position.set(0, 0.25, 0); // Center relative to head cube

          const T = 0.04; // wall thickness

          // 1. Top plate (covers top of head + sides/back walls)
          const topGeo = new THREE.BoxGeometry(0.60, T, 0.60);
          const topPlate = new THREE.Mesh(topGeo, mat);
          topPlate.position.set(0, 0.28, 0);
          helmetGroup.add(topPlate);

          // 2. Side walls (left and right)
          const wallH = 0.42;
          const sideGeo = new THREE.BoxGeometry(T, wallH, 0.56);
          const wallY = 0.05;

          const sideL = new THREE.Mesh(sideGeo, mat);
          sideL.position.set(0.28, wallY, 0.02);
          helmetGroup.add(sideL);

          const sideR = new THREE.Mesh(sideGeo, mat);
          sideR.position.set(-0.28, wallY, 0.02);
          helmetGroup.add(sideR);

          // 3. Back wall
          const backGeo = new THREE.BoxGeometry(0.52, wallH, T);
          const backWall = new THREE.Mesh(backGeo, mat);
          backWall.position.set(0, wallY, -0.28);
          helmetGroup.add(backWall);

          // 4. Front forehead band (brow)
          const browGeo = new THREE.BoxGeometry(0.52, 0.14, T);
          const brow = new THREE.Mesh(browGeo, mat);
          brow.position.set(0, 0.19, 0.28);
          helmetGroup.add(brow);

          head.add(helmetGroup);
        }
      } else if (i === 1) { // Chestplate
        const body = this.mesh.getObjectByName('body');
        const armL = this.mesh.getObjectByName('armL');
        const armR = this.mesh.getObjectByName('armR');

        if (body) {
          const armorBodyGeo = new THREE.BoxGeometry(0.52, 0.62, 0.28);
          const armorBody = new THREE.Mesh(armorBodyGeo, mat);
          armorBody.name = 'armor_chestplate_body';
          armorBody.position.set(0, 0, 0);
          body.add(armorBody);
        }
        if (armL) {
          const armorArmLGeo = new THREE.BoxGeometry(0.24, 0.50, 0.26);
          const armorArmL = new THREE.Mesh(armorArmLGeo, mat);
          armorArmL.name = 'armor_chestplate_armL';
          armorArmL.position.set(0, 0, 0);
          armL.add(armorArmL);
        }
        if (armR) {
          const armorArmRGeo = new THREE.BoxGeometry(0.24, 0.50, 0.26);
          const armorArmR = new THREE.Mesh(armorArmRGeo, mat);
          armorArmR.name = 'armor_chestplate_armR';
          armorArmR.position.set(0, 0, 0);
          armR.add(armorArmR);
        }
      } else if (i === 2) { // Leggings
        const legL = this.mesh.getObjectByName('legL');
        const legR = this.mesh.getObjectByName('legR');
        if (legL) {
          const armorLegLGeo = new THREE.BoxGeometry(0.24, 0.60, 0.24);
          const armorLegL = new THREE.Mesh(armorLegLGeo, mat);
          armorLegL.name = 'armor_leggings_legL';
          armorLegL.position.set(0, 0.05, 0);
          legL.add(armorLegL);
        }
        if (legR) {
          const armorLegRGeo = new THREE.BoxGeometry(0.24, 0.60, 0.24);
          const armorLegR = new THREE.Mesh(armorLegRGeo, mat);
          armorLegR.name = 'armor_leggings_legR';
          armorLegR.position.set(0, 0.05, 0);
          legR.add(armorLegR);
        }
      } else if (i === 3) { // Boots
        const legL = this.mesh.getObjectByName('legL');
        const legR = this.mesh.getObjectByName('legR');
        if (legL) {
          const armorBootsLGeo = new THREE.BoxGeometry(0.24, 0.20, 0.24);
          const armorBootsL = new THREE.Mesh(armorBootsLGeo, mat);
          armorBootsL.name = 'armor_boots_legL';
          armorBootsL.position.set(0, -0.275, 0);
          legL.add(armorBootsL);
        }
        if (legR) {
          const armorBootsRGeo = new THREE.BoxGeometry(0.24, 0.20, 0.24);
          const armorBootsR = new THREE.Mesh(armorBootsRGeo, mat);
          armorBootsR.name = 'armor_boots_legR';
          armorBootsR.position.set(0, -0.275, 0);
          legR.add(armorBootsR);
        }
      }
    }
  }

  private removeArmorMeshes() {
    const toRemove: THREE.Object3D[] = [];
    this.mesh.traverse((obj) => {
      if (obj.name && obj.name.startsWith('armor_')) {
        toRemove.push(obj);
      }
    });
    for (const obj of toRemove) {
      const parent = obj.parent;
      if (parent) {
        parent.remove(obj);
        obj.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
      }
    }
  }

  createHeldItemMesh(itemId: number): THREE.Object3D | null {
    return this.createItemVisualMesh(itemId);
  }

  createItemVisualMesh(itemId: number): THREE.Object3D | null {
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

    if (VisualResolver.getItemVisualKind(itemId) === 'block') {
      const placeBlockId = ItemRegistry.getPlaceBlockId(itemId) ?? itemId;
      const geo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
      const color = this.getBlockColor(placeBlockId);
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
      const name = itemDef.name;
      if (name.includes('coal') || name.includes('charcoal')) color = 0x222222;
      else if (name.includes('iron_ingot') || name.includes('iron_nugget')) color = 0xD8D8D8;
      else if (name.includes('gold_ingot') || name.includes('gold_nugget')) color = 0xFFD700;
      else if (name.includes('diamond')) color = 0x5DECF5;
      else if (name.includes('apple')) color = 0xEE2222;
      else if (name.includes('bread')) color = 0xD2B48C;
      else if (name.includes('honey')) color = 0xE8A300;
      else if (name.includes('beef') || name.includes('porkchop') || name.includes('mutton') || name.includes('chicken') || name.includes('steak') || name.includes('meat') || name.includes('flesh')) color = 0xA04040;
      else if (name.includes('redstone')) color = 0xFF0000;
      else if (name.includes('arrow')) color = 0xE0E0E0;
      else if (name.includes('brick')) color = 0x9B4B3A;
      else if (name.includes('dye') || name.includes('lapis')) color = 0x2244AA;

      const geo = new THREE.BoxGeometry(0.11, 0.11, 0.015);
      const mat = new THREE.MeshLambertMaterial({ color });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.y = -Math.PI / 8;
      group.add(mesh);
    }

    return group;
  }

  private getBlockColor(blockId: number): number {
    const def = BlockRegistry.get(blockId);
    if (!def) return 0xAAAAAA;
    return VisualResolver.getBlockAverageColor(blockId);
  }

  private getLegacyBlockColor(blockId: number): number {
    const def = BlockRegistry.get(blockId);
    if (!def) return 0xAAAAAA;
    const name = def.name;

    if (name.includes('stone_brick')) return 0x7A7A7A;
    if (name.includes('stone') || name.includes('andesite') || name.includes('diorite') || name.includes('granite')) return 0x888888;
    if (name.includes('grass')) return 0x5B8C32;
    if (name.includes('dirt')) return 0x8B6914;
    if (name.includes('cobblestone')) return 0x7A7A7A;
    if (name.includes('planks') || name.includes('wood') || name === 'crafting_table' || name === 'chest') return 0xBC9862;
    if (name.includes('log')) return 0x6B511D;
    if (name.includes('leaves')) return 0x3A7D1A;
    if (name.includes('sandstone')) return 0xBD9A5F;
    if (name.includes('sand')) return 0xE8D7A3;
    if (name.includes('water')) return 0x2B4FA8;
    if (name.includes('lava')) return 0xD84400;
    if (name.includes('brick')) return 0x9B4B3A;
    if (name.includes('furnace')) return 0x888888;
    if (name.includes('glass')) return 0xCCEEFF;
    if (name.includes('snow')) return 0xF0F0F0;
    if (name.includes('ice')) return 0x96C8FF;
    if (name.includes('clay')) return 0x9EA4B0;
    if (name.includes('torch')) return 0xFFAA00;
    if (name.includes('wire') || name.includes('redstone')) return 0xCC0000;
    if (name.includes('repeater') || name.includes('piston') || name.includes('lever')) return 0x666666;
    if (name.includes('obsidian')) return 0x1B0B2E;

    return 0xAAAAAA;
  }
}
