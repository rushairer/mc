import * as THREE from 'three';
import {
  GRAVITY, JUMP_VELOCITY, WALK_SPEED, SPRINT_SPEED,
  PLAYER_WIDTH, PLAYER_HEIGHT, PLAYER_EYE_HEIGHT, MAX_REACH
} from '../constants';
import { ChunkManager } from '../world/ChunkManager';
import { BlockRegistry } from '../world/BlockRegistry';

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
  flying = false;
  mesh: THREE.Group;

  private halfWidth = PLAYER_WIDTH / 2;

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

    // Apply velocity with collision
    this.moveWithCollision(dt, chunks);
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

  private checkCollision(chunks: ChunkManager): boolean {
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
          if (!BlockRegistry.isSolid(blockId)) continue;

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
    legL.position.set(-0.12, 0.375, 0);

    const legR = new THREE.Mesh(legGeo, legMat);
    legR.name = 'legR';
    legR.position.set(0.12, 0.375, 0);

    group.add(legL, legR);

    // Arms
    const armGeo = new THREE.BoxGeometry(0.2, 0.6, 0.22);
    const armMat = new THREE.MeshLambertMaterial({ color: shirtColor });

    const armL = new THREE.Mesh(armGeo, armMat);
    armL.name = 'armL';
    armL.position.set(-0.35, 1.05, 0);

    const armR = new THREE.Mesh(armGeo, armMat);
    armR.name = 'armR';
    armR.position.set(0.35, 1.05, 0);

    group.add(armL, armR);

    return group;
  }
}
