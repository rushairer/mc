import * as THREE from 'three';
import { Dimension } from '../world/DimensionGenerator';
import { EnderDragon, ENDER_DRAGON_MAX_HEALTH } from '../entities/EnderDragon';

export interface DragonState {
  active: boolean;
  defeated: boolean;
  health: number;
  maxHealth: number;
}

const CRYSTAL_POSITIONS = [
  new THREE.Vector3(38, 98, 0),
  new THREE.Vector3(-34, 103, 16),
  new THREE.Vector3(12, 93, -42),
  new THREE.Vector3(-48, 107, -28),
  new THREE.Vector3(55, 104, 34),
  new THREE.Vector3(-5, 100, 58),
  new THREE.Vector3(72, 111, -18),
  new THREE.Vector3(-70, 106, 46),
];

export class EnderDragonSystem {
  dragon: EnderDragon | null = null;
  defeated = false;
  private scene: THREE.Scene;
  private healPulse = 0;
  private deathHandled = false;
  private contactCooldown = 0;
  private pendingHealth: number | undefined;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  setDefeated(defeated: boolean) {
    this.defeated = defeated;
    if (defeated) this.pendingHealth = undefined;
    if (defeated) {
      this.removeDragon();
    }
  }

  restore(defeated: boolean, health?: number) {
    this.defeated = defeated;
    this.deathHandled = defeated;
    this.pendingHealth = health;
    this.removeDragon();
  }

  update(
    dt: number,
    dimension: number,
    playerPos: THREE.Vector3,
    getBlock: (x: number, y: number, z: number) => number,
    hurtPlayer: (damage: number, knockback: THREE.Vector3) => void,
    onDeath: (dragon: EnderDragon) => void
  ) {
    if (dimension !== Dimension.End) {
      this.removeDragon();
      return;
    }

    if (!this.dragon && !this.defeated) {
      this.dragon = new EnderDragon(0, 88, -34, this.pendingHealth ?? ENDER_DRAGON_MAX_HEALTH);
      this.pendingHealth = undefined;
      this.scene.add(this.dragon.mesh);
      this.deathHandled = false;
    }

    if (!this.dragon) return;
    if (this.dragon.dead) {
      this.handleDeath(onDeath);
      return;
    }

    this.contactCooldown = Math.max(0, this.contactCooldown - dt);
    this.dragon.update(dt, playerPos);
    this.healFromCrystals(dt, getBlock);

    const playerDist = this.dragon.position.distanceTo(playerPos.clone().add(new THREE.Vector3(0, 1.0, 0)));
    if (playerDist < 4.5 && this.contactCooldown <= 0) {
      const knockback = new THREE.Vector3().subVectors(playerPos, this.dragon.position).normalize();
      knockback.y = 1.1;
      knockback.multiplyScalar(6);
      hurtPlayer(8, knockback);
      this.contactCooldown = 2.2;
    }

    if (this.dragon.dead && !this.deathHandled) {
      this.handleDeath(onDeath);
    }
  }

  attack(origin: THREE.Vector3, direction: THREE.Vector3, damage: number, range: number): boolean {
    if (!this.dragon || this.dragon.dead) return false;
    if (!this.dragon.intersectsRay(origin, direction, range)) return false;

    const knockback = direction.clone().normalize().multiplyScalar(3);
    knockback.y = 1;
    this.dragon.takeDamage(damage, knockback);
    return true;
  }

  hitByProjectile(position: THREE.Vector3, damage: number, velocity: THREE.Vector3): boolean {
    if (!this.dragon || this.dragon.dead || !this.dragon.containsPoint(position)) return false;
    const knockback = velocity.clone().normalize().multiplyScalar(2);
    knockback.y = 0.8;
    this.dragon.takeDamage(damage, knockback);
    return true;
  }

  getState(): DragonState {
    return {
      active: !!this.dragon && !this.dragon.dead,
      defeated: this.defeated,
      health: this.dragon?.health ?? 0,
      maxHealth: ENDER_DRAGON_MAX_HEALTH,
    };
  }

  getHealthForSave(): number | undefined {
    if (!this.dragon || this.dragon.dead) return undefined;
    return this.dragon.health;
  }

  dispose() {
    this.removeDragon();
  }

  private healFromCrystals(dt: number, getBlock: (x: number, y: number, z: number) => number) {
    if (!this.dragon) return;
    this.healPulse += dt;
    if (this.healPulse < 0.5) return;
    this.healPulse = 0;

    for (const crystal of CRYSTAL_POSITIONS) {
      const glass = getBlock(Math.floor(crystal.x), Math.floor(crystal.y), Math.floor(crystal.z)) & 0x3FF;
      const fire = getBlock(Math.floor(crystal.x), Math.floor(crystal.y - 1), Math.floor(crystal.z)) & 0x3FF;
      if (glass !== 20 && fire !== 51) continue;
      if (this.dragon.position.distanceTo(crystal) < 35) {
        this.dragon.heal(1);
        break;
      }
    }
  }

  private removeDragon() {
    if (!this.dragon) return;
    this.scene.remove(this.dragon.mesh);
    this.dragon.dispose();
    this.dragon = null;
  }

  private handleDeath(onDeath: (dragon: EnderDragon) => void) {
    if (!this.dragon || this.deathHandled) return;
    this.deathHandled = true;
    this.defeated = true;
    onDeath(this.dragon);
    this.removeDragon();
  }
}
