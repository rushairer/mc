import * as THREE from 'three';
import { Mob, type MobType, MOB_DEFS } from '../entities/Mob';
import { CHUNK_SIZE, RENDER_DISTANCE } from '../constants';
import { BlockRegistry } from '../world/BlockRegistry';

const MAX_MOBS = 40;
const SPAWN_INTERVAL = 2.0; // seconds between spawn attempts
const SPAWN_RANGE = 24;     // blocks from player to attempt spawning
const DESPAWN_RANGE = 80;

export class MobSystem {
  mobs: Map<number, Mob> = new Map();
  private scene: THREE.Scene;
  private spawnTimer = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  update(
    dt: number,
    playerPos: THREE.Vector3,
    isNight: boolean,
    getBlock: (x: number, y: number, z: number) => number,
    hurtPlayer: (damage: number, knockback: THREE.Vector3, attacker?: Mob) => void,
    isSolidBlock?: (x: number, y: number, z: number) => boolean,
    gameMode: 'survival' | 'creative' = 'survival',
    onMobDeath?: (mob: Mob) => void,
    onMobShoot?: (origin: THREE.Vector3, direction: THREE.Vector3, type: 'arrow' | 'fireball') => void,
    dimension = 0
  ) {
    // Update existing mobs
    for (const [id, mob] of this.mobs) {
      mob.update(dt, playerPos, getBlock, hurtPlayer, isSolidBlock, gameMode, onMobShoot);

      if (mob.isDead()) {
        if (onMobDeath) {
          onMobDeath(mob);
        }
        this.removeMob(id);
      }
    }

    // Spawn new mobs
    this.spawnTimer += dt;
    if (this.spawnTimer >= SPAWN_INTERVAL && this.mobs.size < MAX_MOBS) {
      this.spawnTimer = 0;
      this.trySpawn(playerPos, isNight, getBlock, dimension);
    }
  }

  private trySpawn(
    playerPos: THREE.Vector3,
    isNight: boolean,
    getBlock: (x: number, y: number, z: number) => number,
    dimension: number
  ) {
    // Random position around player
    const angle = Math.random() * Math.PI * 2;
    const dist = 16 + Math.random() * (SPAWN_RANGE - 16);
    const wx = Math.floor(playerPos.x + Math.cos(angle) * dist);
    const wz = Math.floor(playerPos.z + Math.sin(angle) * dist);

    // Find surface Y: search downward from 120 in Nether, skipping bedrock ceiling, otherwise search downward from 255.
    let surfaceY = -1;
    const startY = dimension === 1 ? 120 : 255;
    for (let y = startY; y >= 0; y--) {
      const block = getBlock(wx, y, wz);
      if (block !== 0 && !BlockRegistry.isFluid(block)) {
        if (dimension === 1 && (block & 0x3FF) === 7) {
          continue; // skip bedrock ceilings in the Nether
        }
        // Check spawn space (2 blocks of air above surface)
        const space1 = getBlock(wx, y + 1, wz);
        const space2 = getBlock(wx, y + 2, wz);
        if (space1 === 0 && space2 === 0) {
          surfaceY = y + 1;
          break;
        }
      }
    }

    if (surfaceY < 1 || surfaceY > 250) return;

    let mobType: MobType;

    if (dimension === 1) {
      // Nether: spawn Nether mobs
      const netherTypes: MobType[] = ['zombie_pigman', 'blaze', 'magma_cube', 'wither_skeleton'];
      const weights = [0.5, 0.2, 0.2, 0.1]; // pigman (50%), blaze (20%), magma cube (20%), wither skeleton (10%)
      
      const r = Math.random();
      let sum = 0;
      let selectedIdx = 0;
      for (let i = 0; i < weights.length; i++) {
        sum += weights[i];
        if (r < sum) {
          selectedIdx = i;
          break;
        }
      }
      mobType = netherTypes[selectedIdx];
    } else {
      // Overworld: daytime/nighttime check
      // Determine light level (exposed to sky)
      let lightLevel = 15;
      for (let y = 255; y > surfaceY; y--) {
        if (getBlock(wx, y, wz) !== 0) {
          lightLevel = 0;
          break;
        }
      }

      if (lightLevel >= 7 && !isNight) {
        // Daytime: passive mobs
        const passiveTypes: MobType[] = ['cow', 'pig', 'sheep', 'chicken'];
        mobType = passiveTypes[Math.floor(Math.random() * passiveTypes.length)];
      } else if (isNight || lightLevel < 7) {
        // Nighttime or dark: hostile mobs
        const hostileTypes: MobType[] = ['zombie', 'skeleton', 'creeper', 'spider'];
        mobType = hostileTypes[Math.floor(Math.random() * hostileTypes.length)];
      } else {
        return;
      }
    }

    if (mobType === 'magma_cube') {
      const r = Math.random();
      const size = r < 0.4 ? 1 : (r < 0.7 ? 2 : 3);
      this.spawnMob(mobType, wx, surfaceY, wz, size);
    } else {
      this.spawnMob(mobType, wx, surfaceY, wz);
    }
  }

  spawnMob(type: MobType, x: number, y: number, z: number, size?: number): Mob {
    const mob = new Mob(type, x, y, z, size);
    this.mobs.set(mob.id, mob);
    this.scene.add(mob.mesh);
    return mob;
  }

  removeMob(id: number) {
    const mob = this.mobs.get(id);
    if (mob) {
      this.scene.remove(mob.mesh);
      mob.dispose();
      this.mobs.delete(id);
    }
  }

  /** Player attacks mob via raycast. Returns true if hit. */
  playerAttackMob(
    playerPos: THREE.Vector3,
    direction: THREE.Vector3,
    damage: number,
    reach: number
  ): { hit: boolean; mob?: Mob } {
    const ray = new THREE.Raycaster(playerPos, direction, 0, reach);

    let closestMob: Mob | null = null;
    let closestDist = reach;

    for (const mob of this.mobs.values()) {
      // Simple AABB ray intersection
      const hw = mob.width / 2;
      const box = new THREE.Box3(
        new THREE.Vector3(mob.position.x - hw, mob.position.y, mob.position.z - hw),
        new THREE.Vector3(mob.position.x + hw, mob.position.y + mob.height, mob.position.z + hw)
      );

      const intersection = new THREE.Vector3();
      if (ray.ray.intersectBox(box, intersection)) {
        const dist = intersection.distanceTo(playerPos);
        if (dist < closestDist) {
          closestDist = dist;
          closestMob = mob;
        }
      }
    }

    if (closestMob) {
      const knockback = new THREE.Vector3()
        .subVectors(closestMob.position, playerPos)
        .normalize()
        .multiplyScalar(5);
      knockback.y = 4;
      closestMob.takeDamage(damage, knockback);
      if (closestMob.def.type === 'zombie_pigman') {
        this.makePigmenAngry(closestMob.position, 32);
      }
      return { hit: true, mob: closestMob };
    }

    return { hit: false };
  }

  makePigmenAngry(centerPos: THREE.Vector3, radius: number) {
    for (const mob of this.mobs.values()) {
      if (mob.def.type === 'zombie_pigman') {
        if (mob.position.distanceTo(centerPos) <= radius) {
          mob.isAngry = true;
          mob.angerTimer = 20.0; // Angered for 20 seconds
        }
      }
    }
  }

  getMobsNear(pos: THREE.Vector3, radius: number): Mob[] {
    const result: Mob[] = [];
    for (const mob of this.mobs.values()) {
      if (mob.position.distanceTo(pos) <= radius) {
        result.push(mob);
      }
    }
    return result;
  }

  dispose() {
    for (const mob of this.mobs.values()) {
      this.scene.remove(mob.mesh);
      mob.dispose();
    }
    this.mobs.clear();
  }
}
