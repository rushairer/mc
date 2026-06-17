import * as THREE from 'three';
import { BlockRegistry } from '../world/BlockRegistry';

export type MobType = 'zombie' | 'skeleton' | 'creeper' | 'spider' | 'cow' | 'pig' | 'sheep' | 'chicken';

export interface MobDef {
  type: MobType;
  health: number;
  speed: number;
  damage: number;
  hostile: boolean;
  width: number;
  height: number;
  bodyColor: number;
  headColor?: number;
  eyeColor?: number;
  xpDrop: number;
  drops: { id: number; count: number; chance: number }[];
}

const MOB_DEFS: Record<MobType, MobDef> = {
  zombie:   { type: 'zombie',   health: 20, speed: 2.0, damage: 3, hostile: true,  width: 0.6, height: 1.8, bodyColor: 0x2E8B57, headColor: 0x2E8B57, eyeColor: 0x000000, xpDrop: 5,  drops: [{ id: 105, count: 1, chance: 0.5 }, { id: 101, count: 1, chance: 0.3 }] },
  skeleton: { type: 'skeleton', health: 20, speed: 2.5, damage: 2, hostile: true,  width: 0.6, height: 1.8, bodyColor: 0xC8C8C8, headColor: 0xC8C8C8, eyeColor: 0x333333, xpDrop: 5,  drops: [{ id: 100, count: 1, chance: 0.8 }, { id: 106, count: 1, chance: 0.2 }] },
  creeper:  { type: 'creeper',  health: 20, speed: 2.2, damage: 0, hostile: true,  width: 0.6, height: 1.7, bodyColor: 0x4CAF50, headColor: 0x4CAF50, eyeColor: 0x000000, xpDrop: 5,  drops: [{ id: 111, count: 1, chance: 0.6 }] },
  spider:   { type: 'spider',   health: 16, speed: 3.0, damage: 2, hostile: true,  width: 1.4, height: 0.8, bodyColor: 0x4A3728, headColor: 0x6B4E3D, eyeColor: 0xFF0000, xpDrop: 5,  drops: [{ id: 107, count: 1, chance: 0.85 }] },
  cow:      { type: 'cow',      health: 10, speed: 1.5, damage: 0, hostile: false, width: 0.9, height: 1.4, bodyColor: 0x8B4513, headColor: 0x6B3410, xpDrop: 3,  drops: [{ id: 173, count: 2, chance: 1.0 }, { id: 16, count: 1, chance: 0.4 }] },
  pig:      { type: 'pig',      health: 10, speed: 1.8, damage: 0, hostile: false, width: 0.7, height: 0.9, bodyColor: 0xFFB6C1, headColor: 0xFF9999, xpDrop: 3,  drops: [{ id: 174, count: 2, chance: 1.0 }] },
  sheep:    { type: 'sheep',    health: 8,  speed: 1.5, damage: 0, hostile: false, width: 0.8, height: 1.3, bodyColor: 0xE8E8E8, headColor: 0xD0D0D0, xpDrop: 3,  drops: [{ id: 16, count: 2, chance: 1.0 }] },
  chicken:  { type: 'chicken',  health: 4,  speed: 2.0, damage: 0, hostile: false, width: 0.4, height: 0.7, bodyColor: 0xFFFFFF, headColor: 0xFF0000, xpDrop: 3,  drops: [{ id: 177, count: 1, chance: 0.5 }] },
};

const WATER_ID = 13;
const LAVA_ID = 14;
const MOB_MAX_AIR = 15.0;
const MOB_DROWN_INTERVAL = 1.5;
const WATER_LOOKAHEAD = 0.9;
const WATER_ESCAPE_RADIUS = 6;

export class Mob {
  id: number;
  def: MobDef;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  health: number;
  mesh: THREE.Group;
  onGround = false;
  targetPlayer = false;
  attackCooldown = 0;
  hurtTimer = 0;
  aiState: 'idle' | 'wander' | 'chase' = 'idle';
  wanderTarget: THREE.Vector3 | null = null;
  wanderTimer = 0;
  despawnTimer = 0;
  private halfWidth: number;
  private air = MOB_MAX_AIR;
  private drownTimer = 0;

  static nextId = 1;

  constructor(type: MobType, x: number, y: number, z: number) {
    this.id = Mob.nextId++;
    this.def = MOB_DEFS[type];
    this.position = new THREE.Vector3(x, y, z);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.health = this.def.health;
    this.halfWidth = this.def.width / 2;
    this.mesh = this.createMesh();
    this.mesh.position.set(x, y, z);
  }

  private createMesh(): THREE.Group {
    const group = new THREE.Group();
    const type = this.def.type;
    const bodyColor = this.def.bodyColor;
    const headColor = this.def.headColor ?? bodyColor;

    if (type === 'zombie' || type === 'skeleton') {
      // Humanoid
      const isZombie = type === 'zombie';
      const skinColor = isZombie ? 0x2E8B57 : 0xC8C8C8;
      const clothesColor = isZombie ? 0x008080 : 0xC8C8C8;

      // Body
      const bodyGeo = new THREE.BoxGeometry(0.48, 0.6, 0.24);
      const bodyMat = new THREE.MeshLambertMaterial({ color: clothesColor });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 1.05;
      group.add(body);

      // Head
      const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
      const headMat = new THREE.MeshLambertMaterial({ color: skinColor });
      const head = new THREE.Mesh(headGeo, headMat);
      head.name = 'head';
      head.position.set(0, 1.55, 0);
      group.add(head);

      // Eyes
      const eyeGeo = new THREE.BoxGeometry(0.06, 0.03, 0.02);
      const eyeMat = new THREE.MeshLambertMaterial({ color: isZombie ? 0x000000 : 0x333333 });
      const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
      const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
      eyeL.position.set(-0.1, 1.55, 0.201);
      eyeR.position.set(0.1, 1.55, 0.201);
      group.add(eyeL, eyeR);

      // Legs
      const legGeo = new THREE.BoxGeometry(0.2, 0.75, 0.2);
      const legMat = new THREE.MeshLambertMaterial({ color: clothesColor });
      const legL = new THREE.Mesh(legGeo, legMat);
      legL.name = 'legL';
      legL.position.set(-0.12, 0.375, 0);
      const legR = new THREE.Mesh(legGeo, legMat);
      legR.name = 'legR';
      legR.position.set(0.12, 0.375, 0);
      group.add(legL, legR);

      // Arms (pointing forward)
      const armGeo = new THREE.BoxGeometry(0.2, 0.6, 0.2);
      const armMat = new THREE.MeshLambertMaterial({ color: skinColor });
      const armL = new THREE.Mesh(armGeo, armMat);
      armL.position.set(-0.34, 1.05, 0.2);
      armL.rotation.x = -Math.PI / 2; // Point forward
      const armR = new THREE.Mesh(armGeo, armMat);
      armR.position.set(0.34, 1.05, 0.2);
      armR.rotation.x = -Math.PI / 2;
      group.add(armL, armR);

    } else if (type === 'creeper') {
      // Creeper
      // Body
      const bodyGeo = new THREE.BoxGeometry(0.4, 0.7, 0.2);
      const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.65;
      group.add(body);

      // Head
      const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
      const headMat = new THREE.MeshLambertMaterial({ color: bodyColor });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.set(0, 1.2, 0);
      group.add(head);

      // Eyes
      const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.02);
      const eyeMat = new THREE.MeshLambertMaterial({ color: 0x000000 });
      const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
      const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
      eyeL.position.set(-0.1, 1.2, 0.201);
      eyeR.position.set(0.1, 1.2, 0.201);
      group.add(eyeL, eyeR);

      // 4 Legs
      const legGeo = new THREE.BoxGeometry(0.16, 0.3, 0.16);
      const legMat = new THREE.MeshLambertMaterial({ color: bodyColor });
      const legFL = new THREE.Mesh(legGeo, legMat);
      legFL.name = 'legFL';
      legFL.position.set(-0.12, 0.15, 0.12);
      const legFR = new THREE.Mesh(legGeo, legMat);
      legFR.name = 'legFR';
      legFR.position.set(0.12, 0.15, 0.12);
      const legBL = new THREE.Mesh(legGeo, legMat);
      legBL.name = 'legBL';
      legBL.position.set(-0.12, 0.15, -0.12);
      const legBR = new THREE.Mesh(legGeo, legMat);
      legBR.name = 'legBR';
      legBR.position.set(0.12, 0.15, -0.12);
      group.add(legFL, legFR, legBL, legBR);

    } else if (type === 'spider') {
      // Spider
      // Body/Thorax
      const bodyGeo = new THREE.BoxGeometry(0.5, 0.4, 0.7);
      const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.3;
      group.add(body);

      // Head
      const headGeo = new THREE.BoxGeometry(0.4, 0.3, 0.3);
      const headMat = new THREE.MeshLambertMaterial({ color: headColor });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.set(0, 0.35, 0.45);
      group.add(head);

      // Eyes (Red)
      const eyeGeo = new THREE.BoxGeometry(0.06, 0.06, 0.02);
      const eyeMat = new THREE.MeshLambertMaterial({ color: 0xFF0000 });
      const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
      const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
      eyeL.position.set(-0.1, 0.35, 0.601);
      eyeR.position.set(0.1, 0.35, 0.601);
      group.add(eyeL, eyeR);

      // 4 pairs of legs (8 legs) extending sideways
      const legGeo = new THREE.BoxGeometry(0.4, 0.08, 0.08);
      const legMat = new THREE.MeshLambertMaterial({ color: bodyColor });

      const legFL = new THREE.Mesh(legGeo, legMat);
      legFL.name = 'legFL';
      legFL.position.set(-0.4, 0.3, 0.2);
      legFL.rotation.z = Math.PI / 6;

      const legFR = new THREE.Mesh(legGeo, legMat);
      legFR.name = 'legFR';
      legFR.position.set(0.4, 0.3, 0.2);
      legFR.rotation.z = -Math.PI / 6;

      const legBL = new THREE.Mesh(legGeo, legMat);
      legBL.name = 'legBL';
      legBL.position.set(-0.4, 0.3, -0.2);
      legBL.rotation.z = Math.PI / 6;

      const legBR = new THREE.Mesh(legGeo, legMat);
      legBR.name = 'legBR';
      legBR.position.set(0.4, 0.3, -0.2);
      legBR.rotation.z = -Math.PI / 6;

      group.add(legFL, legFR, legBL, legBR);

    } else if (type === 'cow') {
      // Cow (Horizontal body, head w/ horns)
      // Body
      const bodyGeo = new THREE.BoxGeometry(0.6, 0.6, 1.0);
      const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.7;
      group.add(body);

      // Head
      const headGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
      const headMat = new THREE.MeshLambertMaterial({ color: headColor });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.set(0, 0.95, 0.55);
      group.add(head);

      // Horns
      const hornGeo = new THREE.BoxGeometry(0.06, 0.15, 0.06);
      const hornMat = new THREE.MeshLambertMaterial({ color: 0xEEEEEE });
      const hornL = new THREE.Mesh(hornGeo, hornMat);
      hornL.position.set(-0.16, 1.15, 0.5);
      const hornR = new THREE.Mesh(hornGeo, hornMat);
      hornR.position.set(0.16, 1.15, 0.5);
      group.add(hornL, hornR);

      // Legs
      const legGeo = new THREE.BoxGeometry(0.16, 0.55, 0.16);
      const legMat = new THREE.MeshLambertMaterial({ color: bodyColor });
      const legFL = new THREE.Mesh(legGeo, legMat);
      legFL.name = 'legFL';
      legFL.position.set(-0.2, 0.275, 0.35);
      const legFR = new THREE.Mesh(legGeo, legMat);
      legFR.name = 'legFR';
      legFR.position.set(0.2, 0.275, 0.35);
      const legBL = new THREE.Mesh(legGeo, legMat);
      legBL.name = 'legBL';
      legBL.position.set(-0.2, 0.275, -0.35);
      const legBR = new THREE.Mesh(legGeo, legMat);
      legBR.name = 'legBR';
      legBR.position.set(0.2, 0.275, -0.35);
      group.add(legFL, legFR, legBL, legBR);

    } else if (type === 'pig') {
      // Pig (Horizontal pink body, snout)
      // Body
      const bodyGeo = new THREE.BoxGeometry(0.5, 0.5, 0.8);
      const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.45;
      group.add(body);

      // Head
      const headGeo = new THREE.BoxGeometry(0.32, 0.32, 0.32);
      const headMat = new THREE.MeshLambertMaterial({ color: headColor });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.set(0, 0.6, 0.45);
      group.add(head);

      // Snout
      const snoutGeo = new THREE.BoxGeometry(0.15, 0.1, 0.08);
      const snoutMat = new THREE.MeshLambertMaterial({ color: 0xFF8888 });
      const snout = new THREE.Mesh(snoutGeo, snoutMat);
      snout.position.set(0, 0.52, 0.62);
      group.add(snout);

      // Legs
      const legGeo = new THREE.BoxGeometry(0.12, 0.3, 0.12);
      const legMat = new THREE.MeshLambertMaterial({ color: bodyColor });
      const legFL = new THREE.Mesh(legGeo, legMat);
      legFL.name = 'legFL';
      legFL.position.set(-0.16, 0.15, 0.25);
      const legFR = new THREE.Mesh(legGeo, legMat);
      legFR.name = 'legFR';
      legFR.position.set(0.16, 0.15, 0.25);
      const legBL = new THREE.Mesh(legGeo, legMat);
      legBL.name = 'legBL';
      legBL.position.set(-0.16, 0.15, -0.25);
      const legBR = new THREE.Mesh(legGeo, legMat);
      legBR.name = 'legBR';
      legBR.position.set(0.16, 0.15, -0.25);
      group.add(legFL, legFR, legBL, legBR);

    } else if (type === 'sheep') {
      // Sheep (Horizontal fluffy body)
      // Body (Wool)
      const bodyGeo = new THREE.BoxGeometry(0.6, 0.6, 0.9);
      const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.6;
      group.add(body);

      // Head
      const headGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
      const headMat = new THREE.MeshLambertMaterial({ color: headColor });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.set(0, 0.8, 0.5);
      group.add(head);

      // Legs
      const legGeo = new THREE.BoxGeometry(0.14, 0.45, 0.14);
      const legMat = new THREE.MeshLambertMaterial({ color: headColor });
      const legFL = new THREE.Mesh(legGeo, legMat);
      legFL.name = 'legFL';
      legFL.position.set(-0.18, 0.225, 0.3);
      const legFR = new THREE.Mesh(legGeo, legMat);
      legFR.name = 'legFR';
      legFR.position.set(0.18, 0.225, 0.3);
      const legBL = new THREE.Mesh(legGeo, legMat);
      legBL.name = 'legBL';
      legBL.position.set(-0.18, 0.225, -0.3);
      const legBR = new THREE.Mesh(legGeo, legMat);
      legBR.name = 'legBR';
      legBR.position.set(0.18, 0.225, -0.3);
      group.add(legFL, legFR, legBL, legBR);

    } else if (type === 'chicken') {
      // Chicken (Small body, wings, beak, 2 legs)
      // Body
      const bodyGeo = new THREE.BoxGeometry(0.3, 0.3, 0.4);
      const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.4;
      group.add(body);

      // Head
      const headGeo = new THREE.BoxGeometry(0.2, 0.25, 0.2);
      const headMat = new THREE.MeshLambertMaterial({ color: bodyColor });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.set(0, 0.6, 0.15);
      group.add(head);

      // Beak (Red)
      const beakGeo = new THREE.BoxGeometry(0.08, 0.06, 0.1);
      const beakMat = new THREE.MeshLambertMaterial({ color: 0xFF5555 });
      const beak = new THREE.Mesh(beakGeo, beakMat);
      beak.position.set(0, 0.58, 0.27);
      group.add(beak);

      // Wings
      const wingGeo = new THREE.BoxGeometry(0.04, 0.2, 0.25);
      const wingMat = new THREE.MeshLambertMaterial({ color: bodyColor });
      const wingL = new THREE.Mesh(wingGeo, wingMat);
      wingL.position.set(-0.17, 0.4, 0);
      const wingR = new THREE.Mesh(wingGeo, wingMat);
      wingR.position.set(0.17, 0.4, 0);
      group.add(wingL, wingR);

      // Legs (Yellow)
      const legGeo = new THREE.BoxGeometry(0.05, 0.25, 0.05);
      const legMat = new THREE.MeshLambertMaterial({ color: 0xFFAA00 });
      const legL = new THREE.Mesh(legGeo, legMat);
      legL.name = 'legL';
      legL.position.set(-0.08, 0.125, 0);
      const legR = new THREE.Mesh(legGeo, legMat);
      legR.name = 'legR';
      legR.position.set(0.08, 0.125, 0);
      group.add(legL, legR);
    }

    return group;
  }

  update(
    dt: number,
    playerPos: THREE.Vector3,
    getBlock: (x: number, y: number, z: number) => number,
    hurtPlayer: (damage: number, knockback: THREE.Vector3) => void,
    isSolidBlock?: (x: number, y: number, z: number) => boolean,
    gameMode: 'survival' | 'creative' = 'survival'
  ) {
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    this.despawnTimer += dt;

    // Despawn after 5 minutes if far from player
    const distToPlayer = this.position.distanceTo(playerPos);
    if (distToPlayer > 128 && this.despawnTimer > 300) {
      this.health = 0;
      return;
    }

    const fluidState = this.getFluidState(getBlock);

    // AI
    this.updateAI(dt, playerPos, getBlock, fluidState.inWater, gameMode);

    // Drowning: like vanilla land mobs, only the head/eyes being in water consumes air.
    if (fluidState.headInWater) {
      this.air = Math.max(0, this.air - dt);
      if (this.air <= 0) {
        this.drownTimer += dt;
        if (this.drownTimer >= MOB_DROWN_INTERVAL) {
          this.takeDamage(2);
          this.drownTimer = 0;
        }
      }
    } else {
      this.air = Math.min(MOB_MAX_AIR, this.air + dt * 7.5);
      this.drownTimer = 0;
    }

    if (fluidState.inWater || fluidState.inLava) {
      if (fluidState.headInWater) {
        this.velocity.y = Math.min(1.15, this.velocity.y + 7 * dt);
      } else {
        this.velocity.y = Math.min(0.45, this.velocity.y + 1.8 * dt);
      }

      // Fluids slow mobs down instead of becoming a runnable surface.
      this.velocity.x *= 0.55;
      this.velocity.z *= 0.55;
    } else {
      // Physics - gravity
      if (!this.onGround) {
        this.velocity.y += -28 * dt;
      }
    }

    // Apply velocity with collision
    this.moveWithCollision(dt, getBlock, isSolidBlock);

    // Hostile mob attacks player
    if (this.def.hostile && distToPlayer < 1.8 && this.attackCooldown <= 0 && gameMode !== 'creative') {
      const knockback = new THREE.Vector3()
        .subVectors(playerPos, this.position)
        .normalize()
        .multiplyScalar(4);
      knockback.y = 3;
      hurtPlayer(this.def.damage, knockback);
      this.attackCooldown = 1.0;
    }

    // Update mesh position
    this.mesh.position.copy(this.position);

    // Rotate mesh towards movement direction
    const horizontalSpeed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);
    if (horizontalSpeed > 0.1) {
      const angle = Math.atan2(this.velocity.x, this.velocity.z);
      this.mesh.rotation.y = angle;
    }

    // Leg swing animation
    const time = Date.now() * 0.01 * this.def.speed;
    const isMoving = horizontalSpeed > 0.1;
    const swingAngle = isMoving ? Math.sin(time) * 0.6 : 0;

    const legL = this.mesh.getObjectByName('legL');
    const legR = this.mesh.getObjectByName('legR');
    const legFL = this.mesh.getObjectByName('legFL');
    const legFR = this.mesh.getObjectByName('legFR');
    const legBL = this.mesh.getObjectByName('legBL');
    const legBR = this.mesh.getObjectByName('legBR');

    if (legL) legL.rotation.x = swingAngle;
    if (legR) legR.rotation.x = -swingAngle;
    if (legFL) legFL.rotation.x = swingAngle;
    if (legFR) legFR.rotation.x = -swingAngle;
    if (legBL) legBL.rotation.x = -swingAngle;
    if (legBR) legBR.rotation.x = swingAngle;

    // Flash red when hurt
    if (this.hurtTimer > 0) {
      this.mesh.traverse(child => {
        if (child instanceof THREE.Mesh && child.material && 'emissive' in child.material) {
          (child.material as any).emissive.setHex(0xff3333);
        }
      });
    } else {
      this.mesh.traverse(child => {
        if (child instanceof THREE.Mesh && child.material && 'emissive' in child.material) {
          (child.material as any).emissive.setHex(0x000000);
        }
      });
    }
  }

  private updateAI(
    dt: number,
    playerPos: THREE.Vector3,
    getBlock: (x: number, y: number, z: number) => number,
    inWater: boolean,
    gameMode: 'survival' | 'creative' = 'survival'
  ) {
    const distToPlayer = this.position.distanceTo(playerPos);

    if (inWater) {
      const escapeDir = this.findWaterEscapeDirection(getBlock);
      if (escapeDir) {
        this.aiState = 'wander';
        this.velocity.x = escapeDir.x * this.def.speed * 0.45;
        this.velocity.z = escapeDir.z * this.def.speed * 0.45;
      } else {
        this.velocity.x *= 0.6;
        this.velocity.z *= 0.6;
      }
      return;
    }

    if (this.def.hostile) {
      // Hostile: chase player within 16 blocks (survival only)
      if (distToPlayer < 16 && gameMode !== 'creative') {
        this.aiState = 'chase';
        const dir = new THREE.Vector3().subVectors(playerPos, this.position);
        dir.y = 0;
        dir.normalize();

        if (this.shouldAvoidFluidStep(dir, getBlock)) {
          this.velocity.x *= 0.35;
          this.velocity.z *= 0.35;
          this.wanderTarget = null;
          return;
        }

        this.velocity.x = dir.x * this.def.speed;
        this.velocity.z = dir.z * this.def.speed;

        // Jump over obstacles
        const ahead = this.position.clone().add(dir.multiplyScalar(1));
        const blockAhead = getBlock(
          Math.floor(ahead.x),
          Math.floor(ahead.y),
          Math.floor(ahead.z)
        );
        if (blockAhead !== 0 && this.onGround) {
          this.velocity.y = 8;
          this.onGround = false;
        }
      } else {
        this.wander(dt, getBlock);
      }
    } else {
      // Passive: wander randomly
      this.wander(dt, getBlock);
    }
  }

  private wander(dt: number, getBlock: (x: number, y: number, z: number) => number) {
    this.wanderTimer -= dt;
    if (this.wanderTimer <= 0) {
      this.wanderTimer = 2 + Math.random() * 4;
      const angle = Math.random() * Math.PI * 2;
      const dist = 3 + Math.random() * 5;
      this.wanderTarget = new THREE.Vector3(
        this.position.x + Math.cos(angle) * dist,
        this.position.y,
        this.position.z + Math.sin(angle) * dist
      );
    }

    if (this.wanderTarget) {
      const dir = new THREE.Vector3().subVectors(this.wanderTarget, this.position);
      dir.y = 0;
      const dist = dir.length();
      if (dist < 0.5) {
        this.wanderTarget = null;
        this.velocity.x *= 0.8;
        this.velocity.z *= 0.8;
      } else {
        dir.normalize();
        if (this.shouldAvoidFluidStep(dir, getBlock)) {
          this.wanderTarget = null;
          this.velocity.x *= 0.35;
          this.velocity.z *= 0.35;
          return;
        }
        this.velocity.x = dir.x * this.def.speed * 0.5;
        this.velocity.z = dir.z * this.def.speed * 0.5;
      }
    } else {
      this.velocity.x *= 0.9;
      this.velocity.z *= 0.9;
    }
  }

  private getFluidState(getBlock: (x: number, y: number, z: number) => number) {
    const mx = Math.floor(this.position.x);
    const mz = Math.floor(this.position.z);
    const footY = Math.floor(this.position.y);
    const bodyY = Math.floor(this.position.y + Math.min(1, this.def.height * 0.55));
    const headY = Math.floor(this.position.y + this.def.height * 0.9);

    const footBlock = getBlock(mx, footY, mz);
    const bodyBlock = getBlock(mx, bodyY, mz);
    const headBlock = getBlock(mx, headY, mz);

    return {
      inWater: footBlock === WATER_ID || bodyBlock === WATER_ID || headBlock === WATER_ID,
      headInWater: headBlock === WATER_ID,
      inLava: footBlock === LAVA_ID || bodyBlock === LAVA_ID || headBlock === LAVA_ID,
    };
  }

  private shouldAvoidFluidStep(
    dir: THREE.Vector3,
    getBlock: (x: number, y: number, z: number) => number
  ): boolean {
    const aheadX = Math.floor(this.position.x + dir.x * WATER_LOOKAHEAD);
    const aheadZ = Math.floor(this.position.z + dir.z * WATER_LOOKAHEAD);
    const footY = Math.floor(this.position.y);

    return (
      this.isFluid(getBlock(aheadX, footY, aheadZ)) ||
      this.isFluid(getBlock(aheadX, footY - 1, aheadZ)) ||
      this.isFluid(getBlock(aheadX, footY + 1, aheadZ))
    );
  }

  private findWaterEscapeDirection(getBlock: (x: number, y: number, z: number) => number): THREE.Vector3 | null {
    const baseX = Math.floor(this.position.x);
    const baseY = Math.floor(this.position.y);
    const baseZ = Math.floor(this.position.z);

    let best: THREE.Vector3 | null = null;
    let bestDistSq = Infinity;

    for (let r = 1; r <= WATER_ESCAPE_RADIUS; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;

          const x = baseX + dx;
          const z = baseZ + dz;
          const footBlock = getBlock(x, baseY, z);
          const bodyBlock = getBlock(x, baseY + 1, z);
          const belowBlock = getBlock(x, baseY - 1, z);

          if (footBlock !== 0 || bodyBlock !== 0) continue;
          if (this.isFluid(belowBlock) || !BlockRegistry.isSolid(belowBlock)) continue;

          const distSq = dx * dx + dz * dz;
          if (distSq < bestDistSq) {
            bestDistSq = distSq;
            best = new THREE.Vector3(dx, 0, dz).normalize();
          }
        }
      }

      if (best) return best;
    }

    return null;
  }

  private isFluid(blockId: number): boolean {
    return blockId === WATER_ID || blockId === LAVA_ID;
  }

  private moveWithCollision(
    dt: number,
    getBlock: (x: number, y: number, z: number) => number,
    isSolidBlock?: (x: number, y: number, z: number) => boolean
  ) {
    const hw = this.halfWidth;

    // Detect doors/trapdoors the mob is already colliding with to ignore them during this physics step (allows walking out)
    const ignoredBlocks = new Set<string>();
    const minX = Math.floor(this.position.x - hw);
    const maxX = Math.floor(this.position.x + hw);
    const minY = Math.floor(this.position.y);
    const maxY = Math.floor(this.position.y + this.def.height);
    const minZ = Math.floor(this.position.z - hw);
    const maxZ = Math.floor(this.position.z + hw);

    for (let bx = minX; bx <= maxX; bx++) {
      for (let by = minY; by <= maxY; by++) {
        for (let bz = minZ; bz <= maxZ; bz++) {
          const blockId = getBlock(bx, by, bz);
          if (blockId === 37 || blockId === 38 || blockId === 39 || blockId === 40) {
            const isSolid = isSolidBlock ? isSolidBlock(bx, by, bz) : true;
            if (isSolid) {
              if (
                this.position.x + hw > bx && this.position.x - hw < bx + 1 &&
                this.position.y + this.def.height > by && this.position.y < by + 1 &&
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
    if (this.checkCollision(getBlock, isSolidBlock, ignoredBlocks)) {
      this.position.x -= this.velocity.x * dt;
      this.velocity.x = 0;
    }

    // Y axis
    const prevY = this.position.y;
    this.position.y += this.velocity.y * dt;
    this.onGround = false;

    if (this.checkCollision(getBlock, isSolidBlock, ignoredBlocks)) {
      if (this.velocity.y < 0) {
        this.position.y = Math.floor(prevY) + 0.001;
        this.onGround = true;
      } else {
        this.position.y = prevY;
      }
      this.velocity.y = 0;
    }

    // Z axis
    this.position.z += this.velocity.z * dt;
    if (this.checkCollision(getBlock, isSolidBlock, ignoredBlocks)) {
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

  public checkCollision(
    getBlock: (x: number, y: number, z: number) => number,
    isSolidBlock?: (x: number, y: number, z: number) => boolean,
    ignoredBlocks?: Set<string>
  ): boolean {
    const hw = this.halfWidth;
    const minX = Math.floor(this.position.x - hw);
    const maxX = Math.floor(this.position.x + hw);
    const minY = Math.floor(this.position.y);
    const maxY = Math.floor(this.position.y + this.def.height);
    const minZ = Math.floor(this.position.z - hw);
    const maxZ = Math.floor(this.position.z + hw);

    for (let bx = minX; bx <= maxX; bx++) {
      for (let by = minY; by <= maxY; by++) {
        for (let bz = minZ; bz <= maxZ; bz++) {
          if (ignoredBlocks && ignoredBlocks.has(`${bx},${by},${bz}`)) {
            continue;
          }
          const blockId = getBlock(bx, by, bz);
          if (blockId === 0) continue;
          
          if (isSolidBlock) {
            if (!isSolidBlock(bx, by, bz)) continue;
          } else {
            if (blockId === 13 || blockId === 14) continue; // fallback
          }

          if (
            this.position.x + hw > bx && this.position.x - hw < bx + 1 &&
            this.position.y + this.def.height > by && this.position.y < by + 1 &&
            this.position.z + hw > bz && this.position.z - hw < bz + 1
          ) {
            return true;
          }
        }
      }
    }
    return false;
  }

  takeDamage(amount: number, knockbackDir?: THREE.Vector3) {
    this.health -= amount;
    this.hurtTimer = 0.3;
    if (knockbackDir) {
      this.velocity.x += knockbackDir.x;
      this.velocity.y += knockbackDir.y;
      this.velocity.z += knockbackDir.z;
    }
  }

  isDead(): boolean {
    return this.health <= 0;
  }

  dispose() {
    this.mesh.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    });
  }
}

export { MOB_DEFS };
