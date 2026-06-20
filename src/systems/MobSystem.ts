import * as THREE from 'three';
import { Mob, type MobType, MOB_DEFS } from '../entities/Mob';
import { CHUNK_SIZE, RENDER_DISTANCE } from '../constants';
import { BlockRegistry } from '../world/BlockRegistry';
import { VillageSystem, type VillagerProfession } from './VillageSystem';
import type { WorldGen } from '../world/WorldGen';
import { BiomeType } from '../world/WorldGen';
import type { SerializedMob } from './SaveSystem';
import type { EndGenerator } from '../world/EndGenerator';

const MAX_MOBS = 40;
const SPAWN_INTERVAL = 2.0; // seconds between spawn attempts
const SPAWN_RANGE = 24;     // blocks from player to attempt spawning
const DESPAWN_RANGE = 80;
const BREEDABLE_TYPES = new Set<MobType>(['cow', 'pig', 'sheep', 'chicken', 'horse', 'wolf', 'cat']);
const BABY_GROW_SECONDS = 240;

export class MobSystem {
  mobs: Map<number, Mob> = new Map();
  public difficulty = 'normal';
  public doMobSpawning = true;
  private scene: THREE.Scene;
  private spawnTimer = 0;
  private spawnedVillages: Set<string> = new Set();
  private spawnedEndCities: Set<string> = new Set();
  private spawnedIllagerStructures: Set<string> = new Set();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  update(
    dt: number,
    playerPos: THREE.Vector3,
    isNight?: boolean,
    getBlock?: (x: number, y: number, z: number) => number,
    hurtPlayer?: (damage: number, knockback: THREE.Vector3, attacker?: Mob) => void,
    isSolidBlock?: (x: number, y: number, z: number) => boolean,
    gameMode: 'survival' | 'creative' = 'survival',
    onMobDeath?: (mob: Mob) => void,
    onMobShoot?: (origin: THREE.Vector3, direction: THREE.Vector3, type: 'arrow' | 'fireball' | 'potion' | 'shulker_bullet' | 'wither_skull') => void,
    dimension = 0,
    worldGen?: WorldGen,
    playerHeldItem = 0,
    onMobBreed?: (type: MobType, pos: THREE.Vector3) => void,
    playerLookDir?: THREE.Vector3,
    endGenerator?: EndGenerator
  ) {
    if (!getBlock || !hurtPlayer) return;

    // Peaceful difficulty check: clear hostile mobs
    if (this.difficulty === 'peaceful') {
      for (const [id, mob] of this.mobs) {
        if (mob.def.hostile) {
          this.removeMob(id);
        }
      }
    }

    // Target updates for Golems, Wolves, Creeper escape
    for (const [id, mob] of this.mobs) {
      if (mob.def.type === 'pillager') {
        mob.summonTimer = (mob.summonTimer ?? 0) - dt;
        if (mob.summonTimer <= 0 && mob.position.distanceTo(playerPos) < 16 && gameMode !== 'creative') {
          this.spawnMob('vex', mob.position.x + (Math.random() - 0.5) * 2, mob.position.y + 0.5, mob.position.z + (Math.random() - 0.5) * 2);
          mob.summonTimer = 12.0 + Math.random() * 8.0;
        }
      }

      if (mob.def.type === 'iron_golem') {
        if (mob.isAngry) {
          mob.targetPlayer = true;
          mob.targetMob = null;
        } else {
          mob.targetPlayer = false;
          let nearestHostile: Mob | null = null;
          let minDist = 16;
          for (const other of this.mobs.values()) {
            if (other.def.hostile && other.health > 0) {
              const dist = mob.position.distanceTo(other.position);
              if (dist < minDist) {
                minDist = dist;
                nearestHostile = other;
              }
            }
          }
          mob.targetMob = nearestHostile;
        }
      } else if (mob.def.type === 'wolf' && mob.isTamed && !mob.isSitting) {
        let nearestHostile: Mob | null = null;
        let minDist = 12;
        for (const other of this.mobs.values()) {
          if (other.def.hostile && other.health > 0) {
            const dist = playerPos.distanceTo(other.position);
            if (dist < minDist) {
              minDist = dist;
              nearestHostile = other;
            }
          }
        }
        mob.targetMob = nearestHostile;

        const distToPlayer = mob.position.distanceTo(playerPos);
        if (distToPlayer > 12) {
          mob.position.copy(playerPos).add(new THREE.Vector3((Math.random() - 0.5) * 2, 0.05, (Math.random() - 0.5) * 2));
          mob.velocity.set(0, 0, 0);
        }
      } else if (mob.def.type === 'cat' && mob.isTamed && !mob.isSitting) {
        const distToPlayer = mob.position.distanceTo(playerPos);
        if (distToPlayer > 12) {
          mob.position.copy(playerPos).add(new THREE.Vector3((Math.random() - 0.5) * 2, 0.05, (Math.random() - 0.5) * 2));
          mob.velocity.set(0, 0, 0);
        }
      } else if (mob.def.type === 'creeper') {
        let nearestCat: Mob | null = null;
        let minDist = 10;
        for (const other of this.mobs.values()) {
          if (other.def.type === 'cat' && other.health > 0) {
            const dist = mob.position.distanceTo(other.position);
            if (dist < minDist) {
              minDist = dist;
              nearestCat = other;
            }
          }
        }
        mob.runAwayFrom = nearestCat ? nearestCat.position : null;
      }

      mob.update(dt, playerPos, getBlock, hurtPlayer, isSolidBlock, gameMode, (origin, dir, type) => {
        if (onMobShoot) onMobShoot(origin, dir, type);
      }, playerHeldItem, playerLookDir);

      if (mob.isDead()) {
        if (onMobDeath) {
          onMobDeath(mob);
        }
        this.mobs.delete(id);
      }
    }

    // Breeding mates update
    const loveMobs = Array.from(this.mobs.values()).filter(m => this.canBreed(m));

    for (let i = 0; i < loveMobs.length; i++) {
      const mobA = loveMobs[i];
      for (let j = i + 1; j < loveMobs.length; j++) {
        const mobB = loveMobs[j];
        if (!this.canBreedTogether(mobA, mobB)) continue;

        const dist = mobA.position.distanceTo(mobB.position);
        if (dist < 2.0) {
          // Mate!
          mobA.loveTimer = 0;
          mobB.loveTimer = 0;
          mobA.breedCooldown = 300;
          mobB.breedCooldown = 300;

          const midPos = new THREE.Vector3()
            .addVectors(mobA.position, mobB.position)
            .multiplyScalar(0.5);

          // Spawn baby
          const baby = this.spawnMob(mobA.def.type, midPos.x, midPos.y, midPos.z);
          baby.isBaby = true;
          baby.babyAge = BABY_GROW_SECONDS;
          if ((mobA.def.type === 'wolf' || mobA.def.type === 'cat') && mobA.isTamed && mobB.isTamed) {
            baby.isTamed = true;
            baby.isSitting = false;
          }

          if (onMobBreed) {
            onMobBreed(mobA.def.type, midPos);
          }
        } else if (dist < 8.0) {
          // Attract towards each other
          const dirA = new THREE.Vector3().subVectors(mobB.position, mobA.position).normalize();
          mobA.velocity.x = dirA.x * mobA.def.speed * 0.7;
          mobA.velocity.z = dirA.z * mobA.def.speed * 0.7;

          const dirB = dirA.clone().negate();
          mobB.velocity.x = dirB.x * mobB.def.speed * 0.7;
          mobB.velocity.z = dirB.z * mobB.def.speed * 0.7;
        }
      }
    }

    // Spawn new mobs
    if (this.doMobSpawning && this.difficulty !== 'peaceful') {
      this.spawnTimer += dt;
      if (this.spawnTimer >= SPAWN_INTERVAL && this.mobs.size < MAX_MOBS && getBlock) {
        this.spawnTimer = 0;
        this.trySpawn(playerPos, isNight ?? false, getBlock, dimension, worldGen);
      }
    }

    if (dimension === 0 && worldGen && getBlock) {
      this.ensureVillageMobs(playerPos, worldGen, getBlock);
      this.ensureIllagerStructureMobs(playerPos, worldGen, getBlock);
    }

    if (dimension === 2 && endGenerator && getBlock) {
      this.ensureEndCityMobs(playerPos, endGenerator, getBlock);
    }
  }

  private canBreed(mob: Mob): boolean {
    if (!BREEDABLE_TYPES.has(mob.def.type)) return false;
    if (mob.health <= 0 || mob.isBaby || mob.loveTimer <= 0 || mob.breedCooldown > 0) return false;
    if ((mob.def.type === 'wolf' || mob.def.type === 'cat') && !mob.isTamed) return false;
    return true;
  }

  private canBreedTogether(mobA: Mob, mobB: Mob): boolean {
    if (mobA.def.type !== mobB.def.type) return false;
    if (!this.canBreed(mobA) || !this.canBreed(mobB)) return false;
    if ((mobA.def.type === 'wolf' || mobA.def.type === 'cat') && (!mobA.isTamed || !mobB.isTamed)) return false;
    return true;
  }

  private trySpawn(
    playerPos: THREE.Vector3,
    isNight: boolean,
    getBlock: (x: number, y: number, z: number) => number,
    dimension: number,
    worldGen?: WorldGen
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

      const biome = worldGen ? worldGen.getBiome(wx, wz) : null;

      if (biome === BiomeType.Ocean) {
        mobType = 'guardian';
      } else if (lightLevel >= 7 && !isNight) {
        // Daytime: passive mobs
        const passiveTypes: MobType[] = ['cow', 'pig', 'sheep', 'chicken'];
        if (biome === BiomeType.Jungle) {
          passiveTypes.push('cat');
        } else if (biome === BiomeType.Forest) {
          passiveTypes.push('wolf');
        } else if (biome === BiomeType.Plains || biome === BiomeType.Badlands) {
          passiveTypes.push('horse');
        }
        mobType = passiveTypes[Math.floor(Math.random() * passiveTypes.length)];
      } else if (isNight || lightLevel < 7) {
        // Nighttime or dark: hostile mobs
        const hostileTypes: MobType[] = ['zombie', 'skeleton', 'creeper', 'spider', 'enderman'];
        if (biome === BiomeType.Swamp) {
          hostileTypes.push('witch', 'witch');
        } else {
          hostileTypes.push('witch');
        }
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

  spawnMob(type: MobType, x: number, y: number, z: number, size?: number, profession?: VillagerProfession): Mob {
    const mob = new Mob(type, x, y, z, size, profession);
    if (this.difficulty === 'peaceful' && mob.def.hostile) {
      return mob; // Return but don't add to map/scene so it gets discarded
    }
    this.mobs.set(mob.id, mob);
    this.scene.add(mob.mesh);
    return mob;
  }

  serialize(dimension: number): SerializedMob[] {
    return Array.from(this.mobs.values())
      .filter(mob => mob.health > 0)
      .map(mob => ({
        type: mob.def.type,
        x: mob.position.x,
        y: mob.position.y,
        z: mob.position.z,
        health: mob.health,
        size: mob.def.type === 'magma_cube' ? mob.size : undefined,
        dimension,
        villagerProfession: mob.def.type === 'villager' ? mob.villagerProfession : undefined,
        isBaby: mob.isBaby,
        babyAge: mob.babyAge,
        loveTimer: mob.loveTimer,
        breedCooldown: mob.breedCooldown,
        isTamed: mob.isTamed,
        isSitting: mob.isSitting,
        isAngry: mob.isAngry,
        angerTimer: mob.angerTimer,
      }));
  }

  restore(savedMobs: SerializedMob[] | undefined, dimension: number) {
    this.dispose();
    if (!savedMobs) return;

    for (const saved of savedMobs) {
      if (saved.dimension !== undefined && saved.dimension !== dimension) continue;
      if (!MOB_DEFS[saved.type]) continue;

      const profession = this.isVillagerProfession(saved.villagerProfession)
        ? saved.villagerProfession
        : undefined;
      const mob = this.spawnMob(saved.type, saved.x, saved.y, saved.z, saved.size, profession);
      mob.isBaby = !!saved.isBaby;
      mob.babyAge = Math.max(0, saved.babyAge ?? 0);
      mob.loveTimer = Math.max(0, saved.loveTimer ?? 0);
      mob.breedCooldown = Math.max(0, saved.breedCooldown ?? 0);
      mob.isTamed = !!saved.isTamed;
      mob.isSitting = !!saved.isSitting;
      mob.isAngry = !!saved.isAngry;
      mob.angerTimer = Math.max(0, saved.angerTimer ?? 0);
      mob.isRidden = false;
      mob.targetMob = null;
      const maxHealth = mob.def.type === 'wolf' && mob.isTamed ? 20 : mob.health;
      mob.health = Math.max(0, Math.min(saved.health, maxHealth));
      mob.mesh.position.copy(mob.position);
    }
  }

  private isVillagerProfession(value: unknown): value is VillagerProfession {
    return value === 'farmer' || value === 'librarian' || value === 'toolsmith' || value === 'cleric';
  }

  private ensureVillageMobs(
    playerPos: THREE.Vector3,
    worldGen: WorldGen,
    getBlock: (x: number, y: number, z: number) => number
  ) {
    const villages = VillageSystem.getNearbyVillages(worldGen, playerPos.x, playerPos.z, 96);
    for (const village of villages) {
      if (this.spawnedVillages.has(village.id)) continue;
      for (const point of village.spawnPoints) {
        const x = Math.floor(point.x);
        const y = Math.floor(point.y);
        const z = Math.floor(point.z);
        if (getBlock(x, y, z) !== 0 || getBlock(x, y + 1, z) !== 0) continue;
        this.spawnMob('villager', point.x, point.y, point.z, undefined, village.profession);
      }
      this.spawnedVillages.add(village.id);
    }
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

  getMobInRay(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    reach: number,
    types?: MobType[]
  ): Mob | null {
    const ray = new THREE.Raycaster(origin, direction, 0, reach);
    const allowed = types ? new Set(types) : null;
    let closestMob: Mob | null = null;
    let closestDist = reach;

    for (const mob of this.mobs.values()) {
      if (allowed && !allowed.has(mob.def.type)) continue;

      const hw = mob.width / 2;
      const box = new THREE.Box3(
        new THREE.Vector3(mob.position.x - hw, mob.position.y, mob.position.z - hw),
        new THREE.Vector3(mob.position.x + hw, mob.position.y + mob.height, mob.position.z + hw)
      );

      const intersection = new THREE.Vector3();
      if (ray.ray.intersectBox(box, intersection)) {
        const dist = intersection.distanceTo(origin);
        if (dist < closestDist) {
          closestDist = dist;
          closestMob = mob;
        }
      }
    }

    return closestMob;
  }

  dispose() {
    for (const mob of this.mobs.values()) {
      this.scene.remove(mob.mesh);
      mob.dispose();
    }
    this.mobs.clear();
    this.spawnedVillages.clear();
    this.spawnedEndCities.clear();
    this.spawnedIllagerStructures.clear();
  }

  private ensureIllagerStructureMobs(
    playerPos: THREE.Vector3,
    worldGen: WorldGen,
    getBlock: (x: number, y: number, z: number) => number
  ) {
    const spawns = worldGen.getNearbyIllagerStructureSpawns(playerPos.x, playerPos.z, 96);
    for (const spawn of spawns) {
      if (this.spawnedIllagerStructures.has(spawn.id)) continue;

      const offsets = spawn.type === 'woodland_mansion'
        ? [[-3, 0, -3], [3, 0, 3], [0, 5, 2]]
        : [[-2, 0, -2], [2, 4, 2], [0, 12, 0]];

      for (const [dx, dy, dz] of offsets) {
        const x = Math.floor(spawn.x + dx);
        const y = Math.floor(spawn.y + dy);
        const z = Math.floor(spawn.z + dz);
        if (getBlock(x, y, z) !== 0 || getBlock(x, y + 1, z) !== 0) continue;
        if (getBlock(x, y - 1, z) === 0) continue;
        this.spawnMob('pillager', x + 0.5, y, z + 0.5);
      }

      this.spawnedIllagerStructures.add(spawn.id);
    }
  }

  private ensureEndCityMobs(
    playerPos: THREE.Vector3,
    endGenerator: EndGenerator,
    getBlock: (x: number, y: number, z: number) => number
  ) {
    const spawns = endGenerator.getNearbyShulkerSpawns(playerPos.x, playerPos.z, 96);
    for (const spawn of spawns) {
      if (this.spawnedEndCities.has(spawn.id)) continue;

      const x = Math.floor(spawn.x);
      const y = Math.floor(spawn.y);
      const z = Math.floor(spawn.z);
      const existing = Array.from(this.mobs.values()).some((mob) =>
        mob.def.type === 'shulker' && mob.position.distanceTo(new THREE.Vector3(spawn.x + 0.5, spawn.y, spawn.z + 0.5)) < 2.2
      );
      if (existing) {
        this.spawnedEndCities.add(spawn.id);
        continue;
      }
      if (getBlock(x, y, z) !== 0 || getBlock(x, y + 1, z) !== 0) continue;
      if (getBlock(x, y - 1, z) === 0) continue;

      this.spawnMob('shulker', spawn.x + 0.5, spawn.y, spawn.z + 0.5);
      this.spawnedEndCities.add(spawn.id);
    }
  }
}
