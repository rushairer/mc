import * as THREE from 'three';
import { BlockRegistry } from '../world/BlockRegistry';
import type { VillagerProfession } from '../systems/VillageSystem';

export type MobType = 'zombie' | 'skeleton' | 'creeper' | 'spider' | 'cow' | 'pig' | 'sheep' | 'chicken' | 'blaze' | 'zombie_pigman' | 'magma_cube' | 'wither_skeleton' | 'villager' | 'enderman' | 'witch' | 'iron_golem' | 'wolf' | 'cat' | 'horse' | 'shulker' | 'pillager' | 'wither' | 'guardian' | 'vex';

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
  zombie:   { type: 'zombie',   health: 20, speed: 2.0, damage: 3, hostile: true,  width: 0.6, height: 1.8, bodyColor: 0x2E8B57, headColor: 0x2E8B57, eyeColor: 0x000000, xpDrop: 5,  drops: [{ id: 367, count: 1, chance: 0.5 }, { id: 265, count: 1, chance: 0.3 }] },
  skeleton: { type: 'skeleton', health: 20, speed: 2.5, damage: 2, hostile: true,  width: 0.6, height: 1.8, bodyColor: 0xC8C8C8, headColor: 0xC8C8C8, eyeColor: 0x333333, xpDrop: 5,  drops: [{ id: 352, count: 1, chance: 0.8 }, { id: 262, count: 1, chance: 0.2 }] },
  creeper:  { type: 'creeper',  health: 20, speed: 2.2, damage: 0, hostile: true,  width: 0.6, height: 1.7, bodyColor: 0x4CAF50, headColor: 0x4CAF50, eyeColor: 0x000000, xpDrop: 5,  drops: [{ id: 289, count: 1, chance: 0.6 }] },
  spider:   { type: 'spider',   health: 16, speed: 3.0, damage: 2, hostile: true,  width: 1.4, height: 0.8, bodyColor: 0x4A3728, headColor: 0x6B4E3D, eyeColor: 0xFF0000, xpDrop: 5,  drops: [{ id: 287, count: 1, chance: 0.85 }] },
  cow:      { type: 'cow',      health: 10, speed: 1.5, damage: 0, hostile: false, width: 0.9, height: 1.4, bodyColor: 0x8B4513, headColor: 0x6B3410, xpDrop: 3,  drops: [{ id: 363, count: 2, chance: 1.0 }, { id: 334, count: 1, chance: 0.4 }] },
  pig:      { type: 'pig',      health: 10, speed: 1.8, damage: 0, hostile: false, width: 0.7, height: 0.9, bodyColor: 0xFFB6C1, headColor: 0xFF9999, xpDrop: 3,  drops: [{ id: 319, count: 2, chance: 1.0 }] },
  sheep:    { type: 'sheep',    health: 8,  speed: 1.5, damage: 0, hostile: false, width: 0.8, height: 1.3, bodyColor: 0xE8E8E8, headColor: 0xD0D0D0, xpDrop: 3,  drops: [{ id: 35, count: 2, chance: 1.0 }] },
  chicken:  { type: 'chicken',  health: 4,  speed: 2.0, damage: 0, hostile: false, width: 0.4, height: 0.7, bodyColor: 0xFFFFFF, headColor: 0xFF0000, xpDrop: 3,  drops: [{ id: 288, count: 1, chance: 0.7 }, { id: 344, count: 1, chance: 0.5 }] },
  blaze:           { type: 'blaze',           health: 20, speed: 1.8, damage: 4, hostile: true,  width: 0.6, height: 1.8, bodyColor: 0xFFAA00, headColor: 0xFFD700, eyeColor: 0x000000, xpDrop: 10, drops: [{ id: 369, count: 1, chance: 0.5 }] },
  zombie_pigman:   { type: 'zombie_pigman',   health: 20, speed: 2.3, damage: 5, hostile: false, width: 0.6, height: 1.8, bodyColor: 0xEA899A, headColor: 0x5D8A62, eyeColor: 0x000000, xpDrop: 5,  drops: [{ id: 367, count: 1, chance: 0.5 }, { id: 371, count: 1, chance: 0.3 }, { id: 266, count: 1, chance: 0.05 }] },
  magma_cube:      { type: 'magma_cube',      health: 16, speed: 1.5, damage: 4, hostile: true,  width: 1.2, height: 1.2, bodyColor: 0x260d0d, headColor: 0xFF5500, eyeColor: 0xFF5500, xpDrop: 4,  drops: [{ id: 378, count: 1, chance: 0.25 }] },
  wither_skeleton: { type: 'wither_skeleton', health: 20, speed: 2.5, damage: 4, hostile: true,  width: 0.7, height: 2.4, bodyColor: 0x242424, headColor: 0x242424, eyeColor: 0xFF0000, xpDrop: 5,  drops: [{ id: 352, count: 1, chance: 0.8 }, { id: 263, count: 1, chance: 0.3 }, { id: 1421, count: 1, chance: 0.025 }] },
  villager:        { type: 'villager',        health: 20, speed: 1.2, damage: 0, hostile: false, width: 0.6, height: 1.9, bodyColor: 0x8B5A2B, headColor: 0xC68642, eyeColor: 0x2B1608, xpDrop: 0,  drops: [] },
  
  enderman: { type: 'enderman', health: 40, speed: 3.0, damage: 7, hostile: false, width: 0.6, height: 2.9, bodyColor: 0x161616, headColor: 0x161616, eyeColor: 0xCC00CC, xpDrop: 5, drops: [{ id: 368, count: 1, chance: 0.4 }] },
  witch:    { type: 'witch',    health: 26, speed: 1.8, damage: 0, hostile: true,  width: 0.6, height: 1.9, bodyColor: 0x3c2e4c, headColor: 0xC68642, eyeColor: 0x4B382A, xpDrop: 5, drops: [{ id: 374, count: 1, chance: 0.3 }, { id: 348, count: 1, chance: 0.3 }] },
  iron_golem: { type: 'iron_golem', health: 100, speed: 1.5, damage: 15, hostile: false, width: 1.4, height: 2.7, bodyColor: 0xe2dbd6, headColor: 0xe2dbd6, eyeColor: 0xFF0000, xpDrop: 0, drops: [{ id: 265, count: 4, chance: 1.0 }, { id: 38, count: 2, chance: 0.5 }] },
  wolf:     { type: 'wolf',     health: 8,  speed: 2.0, damage: 4, hostile: false, width: 0.6, height: 0.85, bodyColor: 0xd7d3cc, headColor: 0xd7d3cc, eyeColor: 0x000000, xpDrop: 3, drops: [] },
  cat:      { type: 'cat',      health: 10, speed: 2.2, damage: 0, hostile: false, width: 0.5, height: 0.7, bodyColor: 0xdba15a, headColor: 0xdba15a, eyeColor: 0x00FF00, xpDrop: 3, drops: [{ id: 287, count: 1, chance: 0.5 }] },
  horse:    { type: 'horse',    health: 24, speed: 3.2, damage: 0, hostile: false, width: 1.3, height: 1.6, bodyColor: 0x825a3c, headColor: 0x825a3c, eyeColor: 0x000000, xpDrop: 2, drops: [{ id: 334, count: 1, chance: 0.5 }] },
  shulker:  { type: 'shulker',  health: 20, speed: 0.0, damage: 4, hostile: true, width: 0.9, height: 1.0, bodyColor: 0x9461a8, headColor: 0xb083c1, eyeColor: 0x111111, xpDrop: 5, drops: [{ id: 450, count: 1, chance: 0.5 }] },
  pillager: { type: 'pillager', health: 24, speed: 2.4, damage: 3, hostile: true, width: 0.6, height: 1.95, bodyColor: 0x4d5560, headColor: 0x9f8f7d, eyeColor: 0x235f86, xpDrop: 5, drops: [{ id: 262, count: 2, chance: 0.55 }, { id: 4094, count: 1, chance: 0.08 }, { id: 388, count: 1, chance: 0.08 }] },
  wither:   { type: 'wither',   health: 300, speed: 3.5, damage: 8, hostile: true, width: 0.9, height: 1.9, bodyColor: 0x141414, headColor: 0x141414, eyeColor: 0xFFFFFF, xpDrop: 50, drops: [{ id: 399, count: 1, chance: 1.0 }] },
  guardian: { type: 'guardian', health: 30,  speed: 2.0, damage: 6, hostile: true, width: 0.8, height: 0.8, bodyColor: 0x5c8c8c, headColor: 0x5c8c8c, eyeColor: 0xFF5500, xpDrop: 10, drops: [{ id: 409, count: 1, chance: 0.4 }] },
  vex:      { type: 'vex',      health: 14,  speed: 4.0, damage: 3, hostile: true, width: 0.4, height: 0.8, bodyColor: 0xbfd3ff, headColor: 0xbfd3ff, eyeColor: 0xFF0000, xpDrop: 3,  drops: [] },
};

const MOB_MAX_AIR = 15.0;
const MOB_DROWN_INTERVAL = 1.5;
const WATER_LOOKAHEAD = 0.9;
const WATER_ESCAPE_RADIUS = 6;
const WHEAT = 296;
const WHEAT_SEEDS = 295;
const PUMPKIN_SEEDS = 361;
const MELON_SEEDS = 362;
const BEETROOT_SEEDS = 458;
const CARROT = 391;
const POTATO = 392;
const BEETROOT = 434;
const GOLDEN_APPLE = 322;
const GOLDEN_CARROT = 396;
const RAW_FISH = 349;
const WOLF_FOODS = new Set([319, 320, 363, 364, 365, 366, 411, 412, 423, 424]);

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
  fuseTimer = -1; // -1 = not fusing, >=0 = counting down
  shootTimer = 0; // Skeleton arrow cooldown
  size = 1; // For magma_cube size (1, 2, or 3)
  isAngry = false; // For zombie_pigman neutrality pack anger
  angerTimer = 0;
  villagerProfession: VillagerProfession = 'farmer';
  halfWidth: number;
  air = MOB_MAX_AIR;
  drownTimer = 0;
  magmaCubeJumpTimer = 0;
  
  // Breeding & Growth state
  isBaby = false;
  babyAge = 0; // remaining seconds until adult
  loveTimer = 0; // remaining seconds in love mode
  breedCooldown = 0; // remaining seconds until can breed again

  // Tame & Riding state
  isTamed = false;
  isSitting = false;
  isRidden = false;
  targetMob: Mob | null = null;
  runAwayFrom: THREE.Vector3 | null = null;
  shouldTeleport = false;
  flopTimer = 0;
  laserCharge = 0;
  summonTimer = 0;
  deathTimer?: number;
  deathSoundPlayed?: boolean;
  swingTimer = 0;

  static nextId = 1;

  get width(): number {
    let w = this.def.type === 'magma_cube' ? this.def.width * (this.size / 3) : this.def.width;
    if (this.isBaby) w *= 0.5;
    return w;
  }

  get height(): number {
    let h = this.def.type === 'magma_cube' ? this.def.height * (this.size / 3) : this.def.height;
    if (this.isBaby) h *= 0.5;
    return h;
  }

  get damage(): number {
    if (this.def.type === 'magma_cube') {
      return this.size === 3 ? 4 : (this.size === 2 ? 2 : 0);
    }
    return this.def.damage;
  }

  get speed(): number {
    if (this.def.type === 'magma_cube') {
      return this.size === 3 ? 1.5 : (this.size === 2 ? 1.8 : 2.2);
    }
    return this.def.speed;
  }

  constructor(type: MobType, x: number, y: number, z: number, size = 3, profession: VillagerProfession = 'farmer') {
    this.id = Mob.nextId++;
    this.def = MOB_DEFS[type];
    this.size = type === 'magma_cube' ? size : 1;
    this.position = new THREE.Vector3(x, y, z);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.health = type === 'magma_cube' ? (size === 3 ? 16 : (size === 2 ? 4 : 1)) : this.def.health;
    this.villagerProfession = profession;
    this.halfWidth = this.width / 2;
    this.mesh = this.createMesh();
    this.mesh.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    if (type === 'magma_cube') {
      this.mesh.scale.setScalar(size / 3);
    }
    this.mesh.position.set(x, y, z);
  }

  private createMesh(): THREE.Group {
    const group = new THREE.Group();
    const type = this.def.type;
    const bodyColor = this.def.bodyColor;
    const headColor = this.def.headColor ?? bodyColor;

    if (type === 'zombie' || type === 'skeleton' || type === 'zombie_pigman' || type === 'wither_skeleton' || type === 'pillager') {
      // Humanoid
      const isZombie = type === 'zombie';
      const isPigman = type === 'zombie_pigman';
      const isWither = type === 'wither_skeleton';
      const isPillager = type === 'pillager';

      let skinColor = 0xC8C8C8;
      let clothesColor = 0xC8C8C8;

      if (isZombie) {
        skinColor = 0x2E8B57;
        clothesColor = 0x008080;
      } else if (isPigman) {
        skinColor = 0xEA899A; // pink skin
        clothesColor = 0x5D8A62; // green rotting flesh / loincloth
      } else if (isWither) {
        skinColor = 0x242424; // dark charcoal
        clothesColor = 0x242424;
      } else if (isPillager) {
        skinColor = 0x9f8f7d;
        clothesColor = 0x4d5560;
      }

      const scaleY = isWither ? 1.33 : 1.0;
      const scaleXZ = isWither ? 1.16 : 1.0;

      // Body
      const bodyGeo = new THREE.BoxGeometry(0.48 * scaleXZ, 0.6 * scaleY, 0.24 * scaleXZ);
      const bodyMat = new THREE.MeshLambertMaterial({ color: clothesColor });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 1.05 * scaleY;
      group.add(body);

      // Head
      const headGeo = new THREE.BoxGeometry(0.4 * scaleXZ, 0.4 * scaleY, 0.4 * scaleXZ);
      const headMat = new THREE.MeshLambertMaterial({ color: skinColor });
      const head = new THREE.Mesh(headGeo, headMat);
      head.name = 'head';
      head.position.set(0, 1.55 * scaleY, 0);
      group.add(head);

      // Snout for Pigman
      if (isPigman) {
        const snoutGeo = new THREE.BoxGeometry(0.12, 0.08, 0.06);
        const snoutMat = new THREE.MeshLambertMaterial({ color: 0xFF8888 });
        const snout = new THREE.Mesh(snoutGeo, snoutMat);
        snout.position.set(0, 1.51 * scaleY, 0.21 * scaleXZ);
        group.add(snout);
      }

      // Eyes
      const eyeGeo = new THREE.BoxGeometry(0.06 * scaleXZ, 0.03 * scaleY, 0.02);
      const eyeMat = new THREE.MeshLambertMaterial({ color: isWither ? 0xFF0000 : (isPillager ? 0x235f86 : (isZombie ? 0x000000 : 0x333333)) });
      const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
      const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
      eyeL.position.set(-0.1 * scaleXZ, 1.55 * scaleY, 0.201 * scaleXZ);
      eyeR.position.set(0.1 * scaleXZ, 1.55 * scaleY, 0.201 * scaleXZ);
      group.add(eyeL, eyeR);

      if (isPillager) {
        const browGeo = new THREE.BoxGeometry(0.12, 0.035, 0.025);
        const browMat = new THREE.MeshLambertMaterial({ color: 0x3c352d });
        const browL = new THREE.Mesh(browGeo, browMat);
        browL.position.set(-0.1, 1.64 * scaleY, 0.207 * scaleXZ);
        browL.rotation.z = -0.25;
        const browR = new THREE.Mesh(browGeo, browMat);
        browR.position.set(0.1, 1.64 * scaleY, 0.207 * scaleXZ);
        browR.rotation.z = 0.25;
        group.add(browL, browR);

        const crossbowMat = new THREE.MeshLambertMaterial({ color: 0x6b3f1d });
        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.08, 0.08), crossbowMat);
        stock.position.set(0, 1.08 * scaleY, 0.42 * scaleXZ);
        const bow = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.36, 0.06), crossbowMat);
        bow.position.set(0, 1.08 * scaleY, 0.48 * scaleXZ);
        group.add(stock, bow);
      }

      // Legs
      const legGeo = new THREE.BoxGeometry(0.2 * scaleXZ, 0.75 * scaleY, 0.2 * scaleXZ);
      const legMat = new THREE.MeshLambertMaterial({ color: clothesColor });
      const legL = new THREE.Mesh(legGeo, legMat);
      legL.name = 'legL';
      legL.position.set(-0.12 * scaleXZ, 0.375 * scaleY, 0);
      const legR = new THREE.Mesh(legGeo, legMat);
      legR.name = 'legR';
      legR.position.set(0.12 * scaleXZ, 0.375 * scaleY, 0);
      group.add(legL, legR);

      // Arms (pointing forward)
      const armGeo = new THREE.BoxGeometry(0.2 * scaleXZ, 0.6 * scaleY, 0.2 * scaleXZ);
      const armMat = new THREE.MeshLambertMaterial({ color: skinColor });
      const armL = new THREE.Mesh(armGeo, armMat);
      armL.name = 'armL';
      armL.position.set(-0.34 * scaleXZ, 1.05 * scaleY, 0.2 * scaleXZ);
      armL.rotation.x = -Math.PI / 2; // Point forward
      const armR = new THREE.Mesh(armGeo, armMat);
      armR.name = 'armR';
      armR.position.set(0.34 * scaleXZ, 1.05 * scaleY, 0.2 * scaleXZ);
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
    } else if (type === 'villager') {
      // Villager: tall robe, large nose, folded arms.
      const robeColors: Record<VillagerProfession, number> = {
        farmer: 0x8B6F2A,
        librarian: 0xB02020,
        toolsmith: 0x3C5068,
        cleric: 0x7A3FA0,
      };
      const robeColor = robeColors[this.villagerProfession] ?? 0x8B5A2B;

      const bodyGeo = new THREE.BoxGeometry(0.52, 0.85, 0.34);
      const bodyMat = new THREE.MeshLambertMaterial({ color: robeColor });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.86;
      group.add(body);

      const headGeo = new THREE.BoxGeometry(0.42, 0.42, 0.42);
      const headMat = new THREE.MeshLambertMaterial({ color: 0xC68642 });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.set(0, 1.52, 0);
      group.add(head);

      const noseGeo = new THREE.BoxGeometry(0.11, 0.13, 0.16);
      const noseMat = new THREE.MeshLambertMaterial({ color: 0xB8793D });
      const nose = new THREE.Mesh(noseGeo, noseMat);
      nose.position.set(0, 1.48, 0.28);
      group.add(nose);

      const eyeGeo = new THREE.BoxGeometry(0.055, 0.035, 0.02);
      const eyeMat = new THREE.MeshLambertMaterial({ color: 0x1A0E05 });
      const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
      const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
      eyeL.position.set(-0.1, 1.55, 0.215);
      eyeR.position.set(0.1, 1.55, 0.215);
      group.add(eyeL, eyeR);

      const armGeo = new THREE.BoxGeometry(0.18, 0.5, 0.16);
      const armMat = new THREE.MeshLambertMaterial({ color: 0xB8793D });
      const armL = new THREE.Mesh(armGeo, armMat);
      armL.position.set(-0.18, 0.98, 0.23);
      armL.rotation.z = -Math.PI / 5;
      armL.rotation.x = -Math.PI / 2;
      const armR = new THREE.Mesh(armGeo, armMat);
      armR.position.set(0.18, 0.98, 0.23);
      armR.rotation.z = Math.PI / 5;
      armR.rotation.x = -Math.PI / 2;
      group.add(armL, armR);

      const legGeo = new THREE.BoxGeometry(0.18, 0.55, 0.18);
      const legMat = new THREE.MeshLambertMaterial({ color: 0x3A2A1D });
      const legL = new THREE.Mesh(legGeo, legMat);
      legL.name = 'legL';
      legL.position.set(-0.1, 0.275, 0);
      const legR = new THREE.Mesh(legGeo, legMat);
      legR.name = 'legR';
      legR.position.set(0.1, 0.275, 0);
      group.add(legL, legR);
    } else if (type === 'blaze') {
      // Blaze: head + orbiting rods
      const headGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
      const headMat = new THREE.MeshLambertMaterial({ color: 0xFFD700, emissive: 0x332200 });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.set(0, 1.2, 0);
      group.add(head);

      const rodGeo = new THREE.BoxGeometry(0.08, 0.4, 0.08);
      const rodMat = new THREE.MeshLambertMaterial({ color: 0xFFAA00, emissive: 0x442200 });

      for (let i = 0; i < 6; i++) {
        const rod = new THREE.Mesh(rodGeo, rodMat);
        rod.name = `rod_${i}`;
        const angle = (i / 6) * Math.PI * 2;
        const radius = 0.35;
        rod.position.set(Math.cos(angle) * radius, 0.6 + (i % 3) * 0.3, Math.sin(angle) * radius);
        group.add(rod);
      }

    } else if (type === 'magma_cube') {
      // Magma Cube: dark red/black box + glowing orange eyes
      const bodyGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
      const bodyMat = new THREE.MeshLambertMaterial({ color: 0x260d0d });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.4;
      group.add(body);

      const eyeGeo = new THREE.BoxGeometry(0.15, 0.15, 0.02);
      const eyeMat = new THREE.MeshLambertMaterial({ color: 0xFF5500, emissive: 0xFF2200 });
      const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
      const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
      eyeL.position.set(-0.2, 0.45, 0.401);
      eyeR.position.set(0.2, 0.45, 0.401);
      group.add(eyeL, eyeR);
    } else if (type === 'enderman') {
      const bodyGeo = new THREE.BoxGeometry(0.3, 0.8, 0.16);
      const bodyMat = new THREE.MeshLambertMaterial({ color: 0x161616 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 1.8;
      group.add(body);

      const headGeo = new THREE.BoxGeometry(0.32, 0.32, 0.32);
      const headMat = new THREE.MeshLambertMaterial({ color: 0x161616 });
      const head = new THREE.Mesh(headGeo, headMat);
      head.name = 'head';
      head.position.set(0, 2.36, 0);
      group.add(head);

      const eyeGeo = new THREE.BoxGeometry(0.06, 0.02, 0.02);
      const eyeMat = new THREE.MeshLambertMaterial({ color: 0xcc00cc, emissive: 0x880088 });
      const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
      const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
      eyeL.position.set(-0.08, 2.36, 0.161);
      eyeR.position.set(0.08, 2.36, 0.161);
      group.add(eyeL, eyeR);

      const armGeo = new THREE.BoxGeometry(0.08, 1.4, 0.08);
      const armMat = new THREE.MeshLambertMaterial({ color: 0x161616 });
      const armL = new THREE.Mesh(armGeo, armMat);
      armL.name = 'armL';
      armL.position.set(-0.19, 1.5, 0);
      const armR = new THREE.Mesh(armGeo, armMat);
      armR.name = 'armR';
      armR.position.set(0.19, 1.5, 0);
      group.add(armL, armR);

      const legGeo = new THREE.BoxGeometry(0.08, 1.4, 0.08);
      const legMat = new THREE.MeshLambertMaterial({ color: 0x161616 });
      const legL = new THREE.Mesh(legGeo, legMat);
      legL.name = 'legL';
      legL.position.set(-0.08, 0.7, 0);
      const legR = new THREE.Mesh(legGeo, legMat);
      legR.name = 'legR';
      legR.position.set(0.08, 0.7, 0);
      group.add(legL, legR);
    } else if (type === 'witch') {
      const bodyGeo = new THREE.BoxGeometry(0.52, 0.85, 0.34);
      const bodyMat = new THREE.MeshLambertMaterial({ color: 0x3c2e4c });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.86;
      group.add(body);

      const headGeo = new THREE.BoxGeometry(0.42, 0.42, 0.42);
      const headMat = new THREE.MeshLambertMaterial({ color: 0xC68642 });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.set(0, 1.52, 0);
      group.add(head);

      const hatBaseGeo = new THREE.BoxGeometry(0.58, 0.04, 0.58);
      const hatBaseMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
      const hatBase = new THREE.Mesh(hatBaseGeo, hatBaseMat);
      hatBase.position.set(0, 1.74, 0);
      group.add(hatBase);

      const hatTopGeo = new THREE.BoxGeometry(0.3, 0.38, 0.3);
      const hatTop = new THREE.Mesh(hatTopGeo, hatBaseMat);
      hatTop.position.set(0, 1.95, 0);
      group.add(hatTop);

      const noseGeo = new THREE.BoxGeometry(0.11, 0.13, 0.16);
      const noseMat = new THREE.MeshLambertMaterial({ color: 0xB8793D });
      const nose = new THREE.Mesh(noseGeo, noseMat);
      nose.position.set(0, 1.48, 0.28);
      group.add(nose);

      const wartGeo = new THREE.BoxGeometry(0.04, 0.04, 0.04);
      const wartMat = new THREE.MeshLambertMaterial({ color: 0x00FF00 });
      const wart = new THREE.Mesh(wartGeo, wartMat);
      wart.position.set(0.04, 1.45, 0.36);
      group.add(wart);

      const legGeo = new THREE.BoxGeometry(0.18, 0.55, 0.18);
      const legMat = new THREE.MeshLambertMaterial({ color: 0x261b12 });
      const legL = new THREE.Mesh(legGeo, legMat);
      legL.name = 'legL';
      legL.position.set(-0.1, 0.275, 0);
      const legR = new THREE.Mesh(legGeo, legMat);
      legR.name = 'legR';
      legR.position.set(0.1, 0.275, 0);
      group.add(legL, legR);
    } else if (type === 'iron_golem') {
      const bodyGeo = new THREE.BoxGeometry(1.2, 0.9, 0.7);
      const bodyMat = new THREE.MeshLambertMaterial({ color: 0xe2dbd6 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 1.6;
      group.add(body);

      const headGeo = new THREE.BoxGeometry(0.4, 0.5, 0.4);
      const headMat = new THREE.MeshLambertMaterial({ color: 0xe2dbd6 });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.set(0, 2.3, 0);
      group.add(head);

      const noseGeo = new THREE.BoxGeometry(0.08, 0.2, 0.1);
      const noseMat = new THREE.MeshLambertMaterial({ color: 0xc4bcb5 });
      const nose = new THREE.Mesh(noseGeo, noseMat);
      nose.position.set(0, 2.2, 0.25);
      group.add(nose);

      const eyeGeo = new THREE.BoxGeometry(0.06, 0.04, 0.02);
      const eyeMat = new THREE.MeshLambertMaterial({ color: 0xFF0000 });
      const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
      const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
      eyeL.position.set(-0.1, 2.35, 0.201);
      eyeR.position.set(0.1, 2.35, 0.201);
      group.add(eyeL, eyeR);

      const armGeo = new THREE.BoxGeometry(0.25, 1.4, 0.25);
      const armMat = new THREE.MeshLambertMaterial({ color: 0xd6cfca });
      const armL = new THREE.Mesh(armGeo, armMat);
      armL.name = 'armL';
      armL.position.set(-0.725, 1.4, 0);
      const armR = new THREE.Mesh(armGeo, armMat);
      armR.name = 'armR';
      armR.position.set(0.725, 1.4, 0);
      group.add(armL, armR);

      const legGeo = new THREE.BoxGeometry(0.3, 1.0, 0.3);
      const legMat = new THREE.MeshLambertMaterial({ color: 0xc4bcb5 });
      const legL = new THREE.Mesh(legGeo, legMat);
      legL.name = 'legL';
      legL.position.set(-0.25, 0.5, 0);
      const legR = new THREE.Mesh(legGeo, legMat);
      legR.name = 'legR';
      legR.position.set(0.25, 0.5, 0);
      group.add(legL, legR);
    } else if (type === 'wolf') {
      const bodyGeo = new THREE.BoxGeometry(0.45, 0.45, 0.7);
      const bodyMat = new THREE.MeshLambertMaterial({ color: 0xd7d3cc });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.name = 'body';
      body.position.y = 0.45;
      group.add(body);

      const headGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
      const head = new THREE.Mesh(headGeo, bodyMat);
      head.name = 'head';
      head.position.set(0, 0.65, 0.35);
      group.add(head);

      const snoutGeo = new THREE.BoxGeometry(0.12, 0.12, 0.18);
      const snoutMat = new THREE.MeshLambertMaterial({ color: 0xc4c0b9 });
      const snout = new THREE.Mesh(snoutGeo, snoutMat);
      snout.position.set(0, 0.6, 0.55);
      group.add(snout);

      const collarGeo = new THREE.BoxGeometry(0.32, 0.08, 0.32);
      const collarMat = new THREE.MeshLambertMaterial({ color: 0xFF0000 });
      const collar = new THREE.Mesh(collarGeo, collarMat);
      collar.name = 'collar';
      collar.position.set(0, 0.6, 0.2);
      collar.visible = false;
      group.add(collar);

      const tailGeo = new THREE.BoxGeometry(0.1, 0.1, 0.3);
      const tail = new THREE.Mesh(tailGeo, bodyMat);
      tail.position.set(0, 0.55, -0.45);
      group.add(tail);

      const legGeo = new THREE.BoxGeometry(0.12, 0.35, 0.12);
      const legL = new THREE.Mesh(legGeo, bodyMat);
      legL.name = 'legL';
      legL.position.set(-0.16, 0.175, 0.2);
      const legR = new THREE.Mesh(legGeo, bodyMat);
      legR.name = 'legR';
      legR.position.set(0.16, 0.175, 0.2);
      const legBL = new THREE.Mesh(legGeo, bodyMat);
      legBL.name = 'legBL';
      legBL.position.set(-0.16, 0.175, -0.2);
      const legBR = new THREE.Mesh(legGeo, bodyMat);
      legBR.name = 'legBR';
      legBR.position.set(0.16, 0.175, -0.2);
      group.add(legL, legR, legBL, legBR);
    } else if (type === 'cat') {
      const bodyGeo = new THREE.BoxGeometry(0.3, 0.3, 0.5);
      const bodyMat = new THREE.MeshLambertMaterial({ color: 0xdba15a });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.name = 'body';
      body.position.y = 0.35;
      group.add(body);

      const headGeo = new THREE.BoxGeometry(0.24, 0.2, 0.22);
      const head = new THREE.Mesh(headGeo, bodyMat);
      head.name = 'head';
      head.position.set(0, 0.5, 0.25);
      group.add(head);

      const snoutGeo = new THREE.BoxGeometry(0.08, 0.06, 0.08);
      const snoutMat = new THREE.MeshLambertMaterial({ color: 0xffcc88 });
      const snout = new THREE.Mesh(snoutGeo, snoutMat);
      snout.position.set(0, 0.45, 0.38);
      group.add(snout);

      const tailGeo = new THREE.BoxGeometry(0.06, 0.06, 0.4);
      const tail = new THREE.Mesh(tailGeo, bodyMat);
      tail.position.set(0, 0.4, -0.4);
      tail.rotation.x = Math.PI / 4;
      group.add(tail);

      const legGeo = new THREE.BoxGeometry(0.08, 0.25, 0.08);
      const legL = new THREE.Mesh(legGeo, bodyMat);
      legL.name = 'legL';
      legL.position.set(-0.1, 0.125, 0.15);
      const legR = new THREE.Mesh(legGeo, bodyMat);
      legR.name = 'legR';
      legR.position.set(0.1, 0.125, 0.15);
      const legBL = new THREE.Mesh(legGeo, bodyMat);
      legBL.name = 'legBL';
      legBL.position.set(-0.1, 0.125, -0.15);
      const legBR = new THREE.Mesh(legGeo, bodyMat);
      legBR.name = 'legBR';
      legBR.position.set(0.1, 0.125, -0.15);
      group.add(legL, legR, legBL, legBR);
    } else if (type === 'horse') {
      const bodyGeo = new THREE.BoxGeometry(0.75, 0.75, 1.25);
      const bodyMat = new THREE.MeshLambertMaterial({ color: 0x825a3c });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.95;
      group.add(body);

      const neckGeo = new THREE.BoxGeometry(0.3, 0.7, 0.35);
      const neck = new THREE.Mesh(neckGeo, bodyMat);
      neck.position.set(0, 1.4, 0.45);
      neck.rotation.x = -Math.PI / 8;
      group.add(neck);

      const headGeo = new THREE.BoxGeometry(0.32, 0.32, 0.55);
      const head = new THREE.Mesh(headGeo, bodyMat);
      head.position.set(0, 1.7, 0.65);
      group.add(head);

      const earGeo = new THREE.BoxGeometry(0.06, 0.15, 0.08);
      const earL = new THREE.Mesh(earGeo, bodyMat);
      earL.position.set(-0.1, 1.9, 0.45);
      const earR = new THREE.Mesh(earGeo, bodyMat);
      earR.position.set(0.1, 1.9, 0.45);
      group.add(earL, earR);

      const legGeo = new THREE.BoxGeometry(0.18, 0.65, 0.18);
      const legL = new THREE.Mesh(legGeo, bodyMat);
      legL.name = 'legL';
      legL.position.set(-0.25, 0.325, 0.4);
      const legR = new THREE.Mesh(legGeo, bodyMat);
      legR.name = 'legR';
      legR.position.set(0.25, 0.325, 0.4);
      const legBL = new THREE.Mesh(legGeo, bodyMat);
      legBL.name = 'legBL';
      legBL.position.set(-0.25, 0.325, -0.4);
      const legBR = new THREE.Mesh(legGeo, bodyMat);
      legBR.name = 'legBR';
      legBR.position.set(0.25, 0.325, -0.4);
      group.add(legL, legR, legBL, legBR);
    } else if (type === 'shulker') {
      const shellMat = new THREE.MeshLambertMaterial({ color: bodyColor });
      const innerMat = new THREE.MeshLambertMaterial({ color: headColor });

      const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.45, 0.9), shellMat);
      base.position.y = 0.225;
      group.add(base);

      const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, 0.62), innerMat);
      body.position.y = 0.58;
      group.add(body);

      const lid = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.28, 0.95), shellMat);
      lid.name = 'shulker_lid';
      lid.position.y = 0.82;
      group.add(lid);

      const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.03);
      const eyeMat = new THREE.MeshLambertMaterial({ color: this.def.eyeColor ?? 0x111111 });
      const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
      const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
      eyeL.position.set(-0.16, 0.62, 0.33);
      eyeR.position.set(0.16, 0.62, 0.33);
      group.add(eyeL, eyeR);
    } else if (type === 'wither') {
      const witherMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
      const eyeMat = new THREE.MeshLambertMaterial({ color: 0xffffff });

      const headGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
      const head = new THREE.Mesh(headGeo, witherMat);
      head.name = 'head';
      head.position.set(0, 1.4, 0);
      group.add(head);

      const sideHeadGeo = new THREE.BoxGeometry(0.25, 0.25, 0.25);
      const headL = new THREE.Mesh(sideHeadGeo, witherMat);
      headL.position.set(-0.4, 1.3, 0);
      const headR = new THREE.Mesh(sideHeadGeo, witherMat);
      headR.position.set(0.4, 1.3, 0);
      group.add(headL, headR);

      const eyeGeo = new THREE.BoxGeometry(0.06, 0.03, 0.02);
      const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
      const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
      eyeL.position.set(-0.08, 1.42, 0.176);
      eyeR.position.set(0.08, 1.42, 0.176);
      group.add(eyeL, eyeR);

      const barGeo = new THREE.BoxGeometry(0.9, 0.12, 0.12);
      const bar = new THREE.Mesh(barGeo, witherMat);
      bar.position.set(0, 1.15, 0);
      group.add(bar);

      const spineGeo = new THREE.BoxGeometry(0.12, 0.6, 0.12);
      const spine = new THREE.Mesh(spineGeo, witherMat);
      spine.position.set(0, 0.8, 0);
      group.add(spine);

      const ribGeo = new THREE.BoxGeometry(0.45, 0.08, 0.12);
      const rib1 = new THREE.Mesh(ribGeo, witherMat);
      rib1.position.set(0, 0.95, 0);
      const rib2 = new THREE.Mesh(ribGeo, witherMat);
      rib2.position.set(0, 0.8, 0);
      const rib3 = new THREE.Mesh(ribGeo, witherMat);
      rib3.position.set(0, 0.65, 0);
      group.add(rib1, rib2, rib3);

    } else if (type === 'guardian') {
      const bodyMat = new THREE.MeshLambertMaterial({ color: 0x5c8c8c });
      const spikeMat = new THREE.MeshLambertMaterial({ color: 0xff5500 });
      const eyeMat = new THREE.MeshLambertMaterial({ color: 0xff0000 });

      const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), bodyMat);
      body.position.y = 0.5;
      group.add(body);

      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.05), eyeMat);
      eye.position.set(0, 0.5, 0.351);
      group.add(eye);

      const spikeGeo = new THREE.BoxGeometry(0.1, 0.25, 0.1);
      const spike1 = new THREE.Mesh(spikeGeo, spikeMat);
      spike1.position.set(-0.35, 0.75, 0);
      const spike2 = new THREE.Mesh(spikeGeo, spikeMat);
      spike2.position.set(0.35, 0.75, 0);
      const spike3 = new THREE.Mesh(spikeGeo, spikeMat);
      spike3.position.set(0, 0.85, 0);
      const spike4 = new THREE.Mesh(spikeGeo, spikeMat);
      spike4.position.set(0, 0.15, 0);
      group.add(spike1, spike2, spike3, spike4);

      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.35, 0.35), bodyMat);
      tail.position.set(0, 0.5, -0.45);
      group.add(tail);

      const laserGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const laserMat = new THREE.LineBasicMaterial({ color: 0xff00ff });
      const laser = new THREE.Line(laserGeo, laserMat);
      laser.name = 'laser';
      laser.visible = false;
      group.add(laser);

    } else if (type === 'vex') {
      const skinMat = new THREE.MeshLambertMaterial({ color: 0xbfd3ff });
      const clothesMat = new THREE.MeshLambertMaterial({ color: 0x6e7e8c });
      const wingMat = new THREE.MeshLambertMaterial({ color: 0xeeeeee, transparent: true, opacity: 0.7 });

      const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.1), clothesMat);
      body.position.y = 0.45;
      group.add(body);

      const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), skinMat);
      head.name = 'head';
      head.position.set(0, 0.7, 0);
      group.add(head);

      const eyeGeo = new THREE.BoxGeometry(0.03, 0.02, 0.01);
      const eyeMat = new THREE.MeshLambertMaterial({ color: 0xff0000 });
      const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
      const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
      eyeL.position.set(-0.05, 0.7, 0.101);
      eyeR.position.set(0.05, 0.7, 0.101);
      group.add(eyeL, eyeR);

      const wingGeo = new THREE.BoxGeometry(0.02, 0.2, 0.3);
      const wingL = new THREE.Mesh(wingGeo, wingMat);
      wingL.position.set(-0.15, 0.5, -0.15);
      wingL.rotation.y = -0.5;
      const wingR = new THREE.Mesh(wingGeo, wingMat);
      wingR.position.set(0.15, 0.5, -0.15);
      wingR.rotation.y = 0.5;
      group.add(wingL, wingR);

      const swordMat = new THREE.MeshLambertMaterial({ color: 0xdcdcdc });
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.03), swordMat);
      blade.position.set(0.2, 0.5, 0.1);
      blade.rotation.x = -Math.PI / 3;
      group.add(blade);
    }

    return group;
  }

  update(
    dt: number,
    playerPos: THREE.Vector3,
    getBlock: (x: number, y: number, z: number) => number,
    hurtPlayer: (damage: number, knockback: THREE.Vector3, attacker?: Mob) => void,
    isSolidBlock?: (x: number, y: number, z: number) => boolean,
    gameMode: 'survival' | 'creative' = 'survival',
    onShoot?: (origin: THREE.Vector3, direction: THREE.Vector3, type: 'arrow' | 'fireball' | 'potion' | 'shulker_bullet' | 'wither_skull') => void,
    playerHeldItem = 0,
    playerLookDir?: THREE.Vector3
  ) {
    if (this.health <= 0) {
      if (this.deathTimer === undefined) {
        this.deathTimer = 0.8;
        this.deathSoundPlayed = false;
      }
      this.deathTimer = Math.max(0, this.deathTimer - dt);

      // Stop horizontal movement, let gravity work if not on ground
      this.velocity.x = 0;
      this.velocity.z = 0;
      if (!this.onGround) {
        this.velocity.y += -28 * dt;
        this.moveWithCollision(dt, getBlock, isSolidBlock);
      } else {
        this.velocity.y = 0;
      }
      this.mesh.position.copy(this.position);

      // Roll sideways (90 degrees / PI/2) over 0.6 seconds
      const progress = Math.min(1.0, (0.8 - this.deathTimer) / 0.6);
      this.mesh.rotation.z = progress * (Math.PI / 2);

      // Fade out and red flash
      const dTimer = this.deathTimer ?? 0.8;
      this.mesh.traverse(child => {
        if (child instanceof THREE.Mesh) {
          if (child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(mat => {
              mat.transparent = true;
              mat.opacity = Math.max(0, dTimer / 0.8);
              if ('emissive' in mat) {
                mat.emissive.setHex(0xff3333);
              }
            });
          }
        }
      });
      return;
    }

    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    this.despawnTimer += dt;

    if (this.def.type === 'guardian') {
      const isHostile = this.def.hostile;
      const isAttacking = isHostile && gameMode !== 'creative' && this.position.distanceTo(playerPos) < 16;
      if (!isAttacking) {
        this.laserCharge = 0;
        const laser = this.mesh.getObjectByName('laser');
        if (laser) laser.visible = false;
      }
    }

    // Tick breeding timers
    this.loveTimer = Math.max(0, this.loveTimer - dt);
    this.breedCooldown = Math.max(0, this.breedCooldown - dt);
    if (this.isBaby) {
      this.babyAge = Math.max(0, this.babyAge - dt);
      if (this.babyAge <= 0) {
        this.isBaby = false;
      }
    }

    // Apply scaling
    if (this.isBaby) {
      this.mesh.scale.setScalar(0.5);
    } else if (this.def.type !== 'magma_cube') {
      this.mesh.scale.setScalar(1.0);
    }

    if (this.isAngry) {
      this.angerTimer = Math.max(0, this.angerTimer - dt);
      if (this.angerTimer <= 0) {
        this.isAngry = false;
      }
    }

    // Enderman aggro when looked at
    if (this.def.type === 'enderman' && playerLookDir && gameMode !== 'creative') {
      const toEnderman = new THREE.Vector3().subVectors(this.position, playerPos);
      const dist = toEnderman.length();
      if (dist < 20) {
        toEnderman.normalize();
        const dot = playerLookDir.dot(toEnderman);
        if (dot > 0.98) {
          this.isAngry = true;
          this.angerTimer = 30.0;
        }
      }
    }

    // Enderman random teleportation when angry
    if (this.def.type === 'enderman' && this.isAngry && Math.random() < 0.005) {
      this.shouldTeleport = true;
    }

    if (this.shouldTeleport) {
      this.shouldTeleport = false;
      this.teleportRandomly(getBlock);
    }

    // Wolf collar visibility
    if (this.def.type === 'wolf') {
      const collar = this.mesh.getObjectByName('collar');
      if (collar) {
        collar.visible = this.isTamed;
      }
    }

    // Despawn after 5 minutes if far from player
    const distToPlayer = this.position.distanceTo(playerPos);
    if (distToPlayer > 128 && this.despawnTimer > 300) {
      this.health = 0;
      return;
    }

    const fluidState = this.getFluidState(getBlock);

    // AI
    if (this.def.type === 'magma_cube') {
      this.updateMagmaCubeMovement(dt, playerPos, getBlock);
    } else {
      this.updateAI(dt, playerPos, getBlock, fluidState.inWater, gameMode, playerHeldItem);
    }

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
      if (this.def.type === 'blaze' || this.def.type === 'wither' || this.def.type === 'vex') {
        const hoverHeight = this.def.type === 'wither' ? 4.5 : (this.def.type === 'vex' ? 2.0 : 1.0);
        const targetY = playerPos.y + hoverHeight + Math.sin(Date.now() * 0.003) * 0.5;
        this.velocity.y = (targetY - this.position.y) * 1.5;
        this.velocity.y = Math.max(-3, Math.min(3, this.velocity.y));
        this.onGround = false;
      } else if (!this.onGround) {
        this.velocity.y += -28 * dt;
      }
    }

    // Apply velocity with collision
    this.moveWithCollision(dt, getBlock, isSolidBlock);

    // Hostile mob attacks player
    const isHostile = this.def.hostile || (this.def.type === 'zombie_pigman' && this.isAngry);
    if (isHostile && gameMode !== 'creative') {
      if (this.def.type === 'creeper') {
        // Creeper: start fuse when close, cancel when far
        if (distToPlayer < 3) {
          if (this.fuseTimer < 0) this.fuseTimer = 0;
          this.fuseTimer += dt;
          // Inflation animation
          const scale = 1 + this.fuseTimer * 0.4;
          this.mesh.scale.set(scale, scale, scale);
        } else {
          if (this.fuseTimer > 0) {
            // Reset fuse if player moves away
            this.fuseTimer = -1;
            this.mesh.scale.set(1, 1, 1);
          }
          if (distToPlayer < 1.8 && this.attackCooldown <= 0) {
            // Melee as fallback
            const knockback = new THREE.Vector3()
              .subVectors(playerPos, this.position)
              .normalize()
              .multiplyScalar(4);
            knockback.y = 3;
            hurtPlayer(this.damage, knockback, this);
            this.attackCooldown = 1.0;
            this.swingTimer = 0.4;
          }
        }
      } else if ((this.def.type === 'skeleton' || this.def.type === 'pillager') && onShoot) {
        // Skeletons and pillagers shoot arrows at player within 16 blocks.
        this.shootTimer = Math.max(0, this.shootTimer - dt);
        if (distToPlayer < 16 && this.shootTimer <= 0) {
          const dir = new THREE.Vector3().subVectors(playerPos, this.position);
          dir.y += 0.5; // Aim slightly up
          dir.normalize();
          const origin = this.position.clone();
          origin.y += this.height * 0.75;
          onShoot(origin, dir, 'arrow');
          this.shootTimer = this.def.type === 'pillager' ? 2.4 : 2.0;
          this.swingTimer = 0.4;
        }
        // Melee fallback
        if (distToPlayer < 1.8 && this.attackCooldown <= 0) {
          const knockback = new THREE.Vector3()
            .subVectors(playerPos, this.position)
            .normalize()
            .multiplyScalar(4);
          knockback.y = 3;
          hurtPlayer(this.damage, knockback, this);
          this.attackCooldown = 1.0;
          this.swingTimer = 0.4;
        }
      } else if (this.def.type === 'blaze' && onShoot) {
        // Blaze: shoot fireballs at player within 16 blocks
        this.shootTimer = Math.max(0, this.shootTimer - dt);
        if (distToPlayer < 16 && this.shootTimer <= 0) {
          const dir = new THREE.Vector3().subVectors(playerPos, this.position).normalize();
          const origin = this.position.clone();
          origin.y += this.height * 0.75;
          onShoot(origin, dir, 'fireball');
          this.shootTimer = 3.0; // 3 second cooldown
        }
        // Melee fallback
        if (distToPlayer < 1.8 && this.attackCooldown <= 0) {
          const knockback = new THREE.Vector3()
            .subVectors(playerPos, this.position)
            .normalize()
            .multiplyScalar(4);
          knockback.y = 3;
          hurtPlayer(this.damage, knockback, this);
          this.attackCooldown = 1.0;
          this.swingTimer = 0.4;
        }
      } else if (this.def.type === 'witch' && onShoot) {
        // Witch: throw splash potions within 12 blocks
        this.shootTimer = Math.max(0, this.shootTimer - dt);
        if (distToPlayer < 12 && this.shootTimer <= 0) {
          const dir = new THREE.Vector3().subVectors(playerPos, this.position);
          dir.y += 1.0;
          dir.normalize();
          const origin = this.position.clone();
          origin.y += this.height * 0.75;
          onShoot(origin, dir, 'potion');
          this.shootTimer = 3.0;
          this.swingTimer = 0.4;
        }
        // Melee fallback
        if (distToPlayer < 1.8 && this.attackCooldown <= 0) {
          const knockback = new THREE.Vector3()
            .subVectors(playerPos, this.position)
            .normalize()
            .multiplyScalar(2);
          knockback.y = 1;
          hurtPlayer(2, knockback, this);
          this.attackCooldown = 1.5;
          this.swingTimer = 0.4;
        }
      } else if (this.def.type === 'shulker' && onShoot) {
        this.shootTimer = Math.max(0, this.shootTimer - dt);
        if (distToPlayer < 18 && this.shootTimer <= 0) {
          const dir = new THREE.Vector3().subVectors(playerPos, this.position);
          dir.y += 0.75;
          dir.normalize();
          const origin = this.position.clone();
          origin.y += 0.75;
          onShoot(origin, dir, 'shulker_bullet');
          this.shootTimer = 3.5;
        }
      } else if (this.def.type === 'wither' && onShoot) {
        this.shootTimer = Math.max(0, this.shootTimer - dt);
        if (distToPlayer < 24 && this.shootTimer <= 0) {
          const dir = new THREE.Vector3().subVectors(playerPos, this.position).normalize();
          const origin = this.position.clone();
          origin.y += 1.2; // Head height
          onShoot(origin, dir, 'wither_skull');
          this.shootTimer = 2.0;
          this.swingTimer = 0.4;
        }
      } else if (this.def.type === 'guardian') {
        if (distToPlayer < 16) {
          this.laserCharge += dt;
          const laser = this.mesh.getObjectByName('laser') as THREE.Line;
          if (laser) {
            laser.visible = true;
            const localPlayerPos = playerPos.clone().sub(this.position);
            localPlayerPos.y += 0.8;
            const points = [new THREE.Vector3(0, 0.5, 0), localPlayerPos];
            laser.geometry.setFromPoints(points);
          }
          if (this.laserCharge >= 3.0) {
            const knockback = new THREE.Vector3().subVectors(playerPos, this.position).normalize().multiplyScalar(3.0);
            knockback.y = 2.0;
            hurtPlayer(this.damage, knockback, this);
            this.laserCharge = 0;
          }
        } else {
          this.laserCharge = 0;
          const laser = this.mesh.getObjectByName('laser');
          if (laser) laser.visible = false;
        }
      } else {
        // Generic melee attack (zombie, pigman, spider, magma_cube, iron_golem, wolf)
        const range = this.def.type === 'magma_cube' ? (this.width / 2 + 1.0) : 1.8;
        if (distToPlayer < range && this.attackCooldown <= 0) {
          const knockback = new THREE.Vector3()
            .subVectors(playerPos, this.position)
            .normalize()
            .multiplyScalar(4);
          knockback.y = 3;
          hurtPlayer(this.damage, knockback, this);
          this.attackCooldown = 1.0;
          this.swingTimer = 0.4;
        }
      }
    }

    // targetMob attack logic
    if (this.targetMob && this.targetMob.health > 0) {
      const distToMob = this.position.distanceTo(this.targetMob.position);
      const attackRange = (this.width + this.targetMob.width) / 2 + 1.0;
      if (distToMob < attackRange && this.attackCooldown <= 0) {
        const knockback = new THREE.Vector3()
          .subVectors(this.targetMob.position, this.position)
          .normalize()
          .multiplyScalar(4);
        knockback.y = 2.5;

        if (this.def.type === 'iron_golem') {
          knockback.y = 8.0;
          this.targetMob.velocity.y = 8.0;
        }

        this.targetMob.takeDamage(this.damage, knockback);
        this.attackCooldown = 1.0;
        this.swingTimer = 0.4;
      }
    }

    // Update mesh position
    this.mesh.position.copy(this.position);

    // Rotate mesh towards movement direction
    const horizontalSpeed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);
    if (horizontalSpeed > 0.1) {
      const angle = Math.atan2(this.velocity.x, this.velocity.z);
      this.mesh.rotation.y = angle;
    }

    // 1. Hurt flinch rotation (tilt mesh when hurt)
    if (this.hurtTimer > 0) {
      const flinchAngle = Math.sin((this.hurtTimer / 0.3) * Math.PI) * 0.15;
      this.mesh.rotation.z = flinchAngle;
      this.mesh.rotation.x = flinchAngle * 0.5;
    } else {
      this.mesh.rotation.z = 0;
      this.mesh.rotation.x = 0;
    }

    // 2. Golem/Humanoid Arm Swing Animation
    const armL = this.mesh.getObjectByName('armL');
    const armR = this.mesh.getObjectByName('armR');
    if (armL && armR) {
      if (this.swingTimer > 0) {
        const swing = Math.sin((this.swingTimer / 0.4) * Math.PI) * (Math.PI / 3);
        if (this.def.type === 'iron_golem') {
          armL.rotation.x = -swing;
          armR.rotation.x = -swing;
        } else {
          // Humanoid (Zombie, Skeleton, Pigman, Wither Skeleton, Pillager)
          armL.rotation.x = -Math.PI / 2 - swing;
          armR.rotation.x = -Math.PI / 2 - swing;
        }
      } else {
        if (this.def.type === 'iron_golem') {
          armL.rotation.x = 0;
          armR.rotation.x = 0;
        } else {
          // Humanoids default to pointing forward (Zombie etc. swing)
          armL.rotation.x = -Math.PI / 2;
          armR.rotation.x = -Math.PI / 2;
        }
      }
    }

    // 3. Sitting pose (wolf & cat)
    const body = this.mesh.getObjectByName('body');
    const head = this.mesh.getObjectByName('head');
    const legL = this.mesh.getObjectByName('legL');
    const legR = this.mesh.getObjectByName('legR');
    const legBL = this.mesh.getObjectByName('legBL');
    const legBR = this.mesh.getObjectByName('legBR');

    if (this.def.type === 'wolf' || this.def.type === 'cat') {
      if (this.isSitting) {
        if (body) body.position.y = this.def.type === 'wolf' ? 0.3 : 0.23;
        if (head) head.position.y = this.def.type === 'wolf' ? 0.5 : 0.38;
        if (legL) legL.rotation.x = -0.3;
        if (legR) legR.rotation.x = -0.3;
        if (legBL) legBL.rotation.x = -Math.PI / 2.5;
        if (legBR) legBR.rotation.x = -Math.PI / 2.5;
      } else {
        if (body) body.position.y = this.def.type === 'wolf' ? 0.45 : 0.35;
        if (head) head.position.y = this.def.type === 'wolf' ? 0.65 : 0.5;
      }
    }

    // 4. Head tilt when tamed and idle (wolf / cat)
    if ((this.def.type === 'wolf' || this.def.type === 'cat') && this.isTamed && !this.isAngry && horizontalSpeed < 0.1) {
      if (head) {
        head.rotation.z = Math.sin(Date.now() * 0.002) * 0.08;
      }
    } else {
      if (head && (this.def.type === 'wolf' || this.def.type === 'cat')) {
        head.rotation.z = 0;
      }
    }

    // 5. Angry Enderman Shaking
    if (this.def.type === 'enderman' && this.isAngry) {
      if (head) {
        head.position.x = (Math.random() - 0.5) * 0.04;
        head.position.z = (Math.random() - 0.5) * 0.04;
      }
    } else {
      if (head && this.def.type === 'enderman') {
        head.position.x = 0;
        head.position.z = 0;
      }
    }

    // Leg swing animation
    const time = Date.now() * 0.01 * this.def.speed;
    const isMoving = horizontalSpeed > 0.1;
    const swingAngle = isMoving ? Math.sin(time) * 0.6 : 0;

    const legFL = this.mesh.getObjectByName('legFL');
    const legFR = this.mesh.getObjectByName('legFR');

    if (!this.isSitting) {
      if (legL) legL.rotation.x = swingAngle;
      if (legR) legR.rotation.x = -swingAngle;
      if (legFL) legFL.rotation.x = swingAngle;
      if (legFR) legFR.rotation.x = -swingAngle;
      if (legBL) legBL.rotation.x = -swingAngle;
      if (legBR) legBR.rotation.x = swingAngle;
    }

    // Blaze orbiting rods animation
    if (this.def.type === 'blaze') {
      const time = Date.now() * 0.003;
      for (let i = 0; i < 6; i++) {
        const rod = this.mesh.getObjectByName(`rod_${i}`);
        if (rod) {
          const angle = (i / 6) * Math.PI * 2 + time;
          const radius = 0.35 + Math.sin(time + i) * 0.05;
          rod.position.x = Math.cos(angle) * radius;
          rod.position.z = Math.sin(angle) * radius;
          rod.rotation.y = time;
        }
      }
    }

    if (this.def.type === 'shulker') {
      const lid = this.mesh.getObjectByName('shulker_lid');
      if (lid) {
        lid.position.y = 0.82 + Math.max(0, Math.sin(Date.now() * 0.004)) * 0.12;
      }
    }

    // Magma Cube squish/stretch animation
    if (this.def.type === 'magma_cube') {
      const baseScale = this.size / 3;
      if (!this.onGround) {
        // Stretch in air
        this.mesh.scale.set(baseScale * 0.8, baseScale * 1.3, baseScale * 0.8);
      } else {
        // Squish when landing
        if (this.magmaCubeJumpTimer < 0.25) {
          this.mesh.scale.set(baseScale * 1.2, baseScale * 0.7, baseScale * 1.2);
        } else {
          this.mesh.scale.setScalar(baseScale);
        }
      }
    }

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

  isAttractedBy(itemId: number): boolean {
    const type = this.def.type;
    if (type === 'cow' || type === 'sheep') {
      return itemId === WHEAT;
    }
    if (type === 'pig') {
      return itemId === CARROT || itemId === POTATO || itemId === BEETROOT;
    }
    if (type === 'chicken') {
      return itemId === WHEAT_SEEDS || itemId === PUMPKIN_SEEDS || itemId === MELON_SEEDS || itemId === BEETROOT_SEEDS;
    }
    if (type === 'horse') {
      return itemId === GOLDEN_APPLE || itemId === GOLDEN_CARROT;
    }
    if (type === 'wolf') {
      return this.isTamed && WOLF_FOODS.has(itemId);
    }
    if (type === 'cat') {
      return this.isTamed && itemId === RAW_FISH;
    }
    return false;
  }

  canEnterLoveMode(itemId: number): boolean {
    return this.isAttractedBy(itemId) && !this.isBaby && this.loveTimer <= 0 && this.breedCooldown <= 0;
  }

  private updateAI(
    dt: number,
    playerPos: THREE.Vector3,
    getBlock: (x: number, y: number, z: number) => number,
    inWater: boolean,
    gameMode: 'survival' | 'creative' = 'survival',
    playerHeldItem = 0
  ) {
    const distToPlayer = this.position.distanceTo(playerPos);

    if (this.def.type === 'guardian' && !inWater) {
      this.aiState = 'wander';
      this.flopTimer = (this.flopTimer ?? 0) - dt;
      if (this.flopTimer <= 0) {
        this.velocity.y = 4.5;
        this.velocity.x = (Math.random() - 0.5) * 3.0;
        this.velocity.z = (Math.random() - 0.5) * 3.0;
        this.flopTimer = 1.0 + Math.random() * 1.5;
      }
      return;
    }

    if (inWater && this.def.type !== 'guardian') {
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

    if (this.isSitting) {
      this.velocity.x = 0;
      this.velocity.z = 0;
      this.wanderTarget = null;
      return;
    }

    if (this.isRidden) {
      this.wanderTarget = null;
      return;
    }

    if (this.def.type === 'shulker') {
      this.velocity.x = 0;
      this.velocity.z = 0;
      this.wanderTarget = null;
      if (distToPlayer < 24) {
        const dir = new THREE.Vector3().subVectors(playerPos, this.position);
        this.mesh.rotation.y = Math.atan2(dir.x, dir.z);
      }
      return;
    }

    if (this.runAwayFrom) {
      this.aiState = 'wander';
      const dir = new THREE.Vector3().subVectors(this.position, this.runAwayFrom);
      dir.y = 0;
      dir.normalize();
      this.velocity.x = dir.x * this.def.speed * 1.25;
      this.velocity.z = dir.z * this.def.speed * 1.25;
      this.mesh.rotation.y = Math.atan2(dir.x, dir.z);

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
      return;
    }

    let targetPos: THREE.Vector3 | null = null;
    let targetSpeed = this.def.speed;

    if (this.def.type === 'enderman' && this.isAngry) {
      if (distToPlayer < 24) {
        targetPos = playerPos;
        targetSpeed = this.def.speed * 1.4;
      }
    } else if (this.def.type === 'wolf' && this.isAngry) {
      if (distToPlayer < 16) {
        targetPos = playerPos;
      }
    } else if (this.targetMob && this.targetMob.health > 0) {
      targetPos = this.targetMob.position;
      targetSpeed = this.def.speed * 1.3;
    } else if (this.def.hostile) {
      if (distToPlayer < 16 && gameMode !== 'creative') {
        targetPos = playerPos;
      }
    } else if (this.def.type === 'wolf' && this.isTamed) {
      if (distToPlayer > 3) {
        targetPos = playerPos;
        targetSpeed = this.def.speed * 0.95;
      }
    } else if (this.def.type === 'cat' && this.isTamed) {
      if (distToPlayer > 3) {
        targetPos = playerPos;
        targetSpeed = this.def.speed * 0.95;
      }
    } else if (!this.def.hostile && this.isAttractedBy(playerHeldItem) && distToPlayer < 9) {
      targetPos = playerPos;
      targetSpeed = this.def.speed * (this.isBaby ? 1.15 : 0.9);
    }

    if (targetPos) {
      this.aiState = 'chase';
      const dir = new THREE.Vector3().subVectors(targetPos, this.position);
      dir.y = 0;
      const dist = dir.length();

      if ((this.def.type === 'wolf' || this.def.type === 'cat') && this.isTamed && !this.targetMob && dist < 2.5) {
        this.velocity.x *= 0.4;
        this.velocity.z *= 0.4;
        return;
      }

      dir.normalize();

      if (this.shouldAvoidFluidStep(dir, getBlock)) {
        this.velocity.x *= 0.35;
        this.velocity.z *= 0.35;
        this.wanderTarget = null;
        return;
      }

      this.velocity.x = dir.x * targetSpeed;
      this.velocity.z = dir.z * targetSpeed;

      this.mesh.rotation.y = Math.atan2(dir.x, dir.z);

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
      const isAttracted = playerHeldItem > 0 && this.isAttractedBy(playerHeldItem);
      if (isAttracted && distToPlayer < 8) {
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

        this.velocity.x = dir.x * this.def.speed * 0.8;
        this.velocity.z = dir.z * this.def.speed * 0.8;

        this.mesh.rotation.y = Math.atan2(dir.x, dir.z);

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
    const bodyY = Math.floor(this.position.y + Math.min(1, this.height * 0.55));
    const headY = Math.floor(this.position.y + this.height * 0.9);

    const footBlock = getBlock(mx, footY, mz);
    const bodyBlock = getBlock(mx, bodyY, mz);
    const headBlock = getBlock(mx, headY, mz);

    return {
      inWater: BlockRegistry.isWater(footBlock) || BlockRegistry.isWater(bodyBlock) || BlockRegistry.isWater(headBlock),
      headInWater: BlockRegistry.isWater(headBlock),
      inLava: BlockRegistry.isLava(footBlock) || BlockRegistry.isLava(bodyBlock) || BlockRegistry.isLava(headBlock),
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
    return BlockRegistry.isFluid(blockId);
  }

  private moveWithCollision(
    dt: number,
    getBlock: (x: number, y: number, z: number) => number,
    isSolidBlock?: (x: number, y: number, z: number) => boolean
  ) {
    if (this.def.type === 'vex') {
      this.position.x += this.velocity.x * dt;
      this.position.y += this.velocity.y * dt;
      this.position.z += this.velocity.z * dt;
      return;
    }

    const hw = this.halfWidth;

    // Detect doors/trapdoors the mob is already colliding with to ignore them during this physics step (allows walking out)
    const ignoredBlocks = new Set<string>();
    const minX = Math.floor(this.position.x - hw);
    const maxX = Math.floor(this.position.x + hw);
    const minY = Math.floor(this.position.y);
    const maxY = Math.floor(this.position.y + this.height);
    const minZ = Math.floor(this.position.z - hw);
    const maxZ = Math.floor(this.position.z + hw);

    for (let bx = minX; bx <= maxX; bx++) {
      for (let by = minY; by <= maxY; by++) {
        for (let bz = minZ; bz <= maxZ; bz++) {
          const blockId = getBlock(bx, by, bz);
          const def = BlockRegistry.get(blockId);
          const isDoorOrTrapdoor = def && (def.name.endsWith('door') || def.name.includes('trapdoor'));
          if (isDoorOrTrapdoor) {
            const isSolid = isSolidBlock ? isSolidBlock(bx, by, bz) : true;
            if (isSolid) {
              if (
                this.position.x + hw > bx && this.position.x - hw < bx + 1 &&
                this.position.y + this.height > by && this.position.y < by + 1 &&
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
    const maxY = Math.floor(this.position.y + this.height);
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
            if (BlockRegistry.isFluid(blockId)) continue; // fallback
          }

          if (
            this.position.x + hw > bx && this.position.x - hw < bx + 1 &&
            this.position.y + this.height > by && this.position.y < by + 1 &&
            this.position.z + hw > bz && this.position.z - hw < bz + 1
          ) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private updateMagmaCubeMovement(
    dt: number,
    playerPos: THREE.Vector3,
    getBlock: (x: number, y: number, z: number) => number
  ) {
    if (this.onGround) {
      this.velocity.x = 0;
      this.velocity.z = 0;
      
      this.magmaCubeJumpTimer += dt;
      const jumpInterval = 0.8 + Math.random() * 0.7;
      if (this.magmaCubeJumpTimer >= jumpInterval) {
        this.magmaCubeJumpTimer = 0;
        
        const distToPlayer = this.position.distanceTo(playerPos);
        const dir = new THREE.Vector3();
        if (distToPlayer < 16) {
          dir.subVectors(playerPos, this.position);
          dir.y = 0;
          dir.normalize();
        } else {
          const angle = Math.random() * Math.PI * 2;
          dir.set(Math.cos(angle), 0, Math.sin(angle));
        }
        
        const jumpHeight = this.size === 3 ? 7.5 : (this.size === 2 ? 6.0 : 4.5);
        this.velocity.y = jumpHeight;
        this.velocity.x = dir.x * this.speed * 1.5;
        this.velocity.z = dir.z * this.speed * 1.5;
        this.onGround = false;
      }
    }
  }

  teleportRandomly(getBlock: (x: number, y: number, z: number) => number) {
    for (let attempts = 0; attempts < 16; attempts++) {
      const dx = (Math.random() - 0.5) * 16;
      const dy = (Math.random() - 0.5) * 6;
      const dz = (Math.random() - 0.5) * 16;
      const tx = Math.floor(this.position.x + dx);
      const ty = Math.floor(this.position.y + dy);
      const tz = Math.floor(this.position.z + dz);
      
      if (ty >= 0 && ty < 254) {
        const foot = getBlock(tx, ty, tz);
        const body = getBlock(tx, ty + 1, tz);
        const head = getBlock(tx, ty + 2, tz);
        const below = getBlock(tx, ty - 1, tz);
        if (foot === 0 && body === 0 && head === 0 && below !== 0 && !BlockRegistry.isFluid(below)) {
          this.position.set(tx + 0.5, ty + 0.05, tz + 0.5);
          this.velocity.set(0, 0, 0);
          this.wanderTarget = null;
          break;
        }
      }
    }
  }

  takeDamage(amount: number, knockbackDir?: THREE.Vector3) {
    if (this.health <= 0) return;
    this.health -= amount;
    this.hurtTimer = 0.3;
    if (knockbackDir) {
      this.velocity.x += knockbackDir.x;
      this.velocity.y += knockbackDir.y;
      this.velocity.z += knockbackDir.z;
    }
    if (this.health <= 0 && this.deathTimer === undefined) {
      this.deathTimer = 0.8;
      this.deathSoundPlayed = false;
    }
    if (this.def.type === 'enderman') {
      this.isAngry = true;
      this.angerTimer = 45;
      this.shouldTeleport = true;
    }
    if (this.def.type === 'wolf' && !this.isTamed) {
      this.isAngry = true;
      this.angerTimer = 60;
    }
  }

  isDead(): boolean {
    return this.health <= 0 && (this.deathTimer !== undefined && this.deathTimer <= 0);
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
