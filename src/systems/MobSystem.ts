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
    hurtPlayer: (damage: number, knockback: THREE.Vector3) => void,
    isSolidBlock?: (x: number, y: number, z: number) => boolean,
    gameMode: 'survival' | 'creative' = 'survival'
  ) {
    // Update existing mobs
    for (const [id, mob] of this.mobs) {
      mob.update(dt, playerPos, getBlock, hurtPlayer, isSolidBlock, gameMode);

      if (mob.isDead()) {
        this.removeMob(id);
      }
    }

    // Spawn new mobs
    this.spawnTimer += dt;
    if (this.spawnTimer >= SPAWN_INTERVAL && this.mobs.size < MAX_MOBS) {
      this.spawnTimer = 0;
      this.trySpawn(playerPos, isNight, getBlock);
    }
  }

  private trySpawn(playerPos: THREE.Vector3, isNight: boolean, getBlock: (x: number, y: number, z: number) => number) {
    // Random position around player
    const angle = Math.random() * Math.PI * 2;
    const dist = 16 + Math.random() * (SPAWN_RANGE - 16);
    const wx = Math.floor(playerPos.x + Math.cos(angle) * dist);
    const wz = Math.floor(playerPos.z + Math.sin(angle) * dist);

    // Find surface Y
    let surfaceY = -1;
    for (let y = 255; y >= 0; y--) {
      const block = getBlock(wx, y, wz);
      if (block !== 0 && block !== 13 && block !== 14) {
        surfaceY = y + 1;
        break;
      }
    }

    if (surfaceY < 1 || surfaceY > 250) return;

    // Check spawn space (2 blocks of air above surface)
    const space1 = getBlock(wx, surfaceY, wz);
    const space2 = getBlock(wx, surfaceY + 1, wz);
    if (space1 !== 0 || space2 !== 0) return;

    // Determine light level (simplified: check if exposed to sky)
    let lightLevel = 15;
    for (let y = 255; y > surfaceY; y--) {
      if (getBlock(wx, y, wz) !== 0) {
        lightLevel = 0;
        break;
      }
    }

    let mobType: MobType;

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

    this.spawnMob(mobType, wx, surfaceY, wz);
  }

  spawnMob(type: MobType, x: number, y: number, z: number): Mob {
    const mob = new Mob(type, x, y, z);
    this.mobs.set(mob.id, mob);
    this.scene.add(mob.mesh);
    return mob;
  }

  private removeMob(id: number) {
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
      const hw = mob.def.width / 2;
      const box = new THREE.Box3(
        new THREE.Vector3(mob.position.x - hw, mob.position.y, mob.position.z - hw),
        new THREE.Vector3(mob.position.x + hw, mob.position.y + mob.def.height, mob.position.z + hw)
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
      return { hit: true, mob: closestMob };
    }

    return { hit: false };
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
