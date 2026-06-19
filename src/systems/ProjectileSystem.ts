import * as THREE from 'three';
import { BlockRegistry } from '../world/BlockRegistry';

export type ProjectileType = 'arrow' | 'snowball' | 'egg' | 'fireball';

export interface Projectile {
  id: number;
  type: ProjectileType;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  damage: number;
  fromPlayer: boolean;
  lifetime: number;
  mesh: THREE.Mesh;
  inGround: boolean;
}

const ARROW_GRAVITY = -12;
const ARROW_SPEED = 30;
const ARROW_LIFETIME = 30; // seconds
const ARROW_DAMAGE = 6; // base arrow damage

export class ProjectileSystem {
  projectiles: Map<number, Projectile> = new Map();
  private scene: THREE.Scene;
  private nextId = 1;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  shootArrow(origin: THREE.Vector3, direction: THREE.Vector3, fromPlayer: boolean, damage: number = ARROW_DAMAGE) {
    const mesh = this.createArrowMesh();
    const vel = direction.clone().normalize().multiplyScalar(ARROW_SPEED);
    // Add slight upward arc
    vel.y += 0.5;

    const arrow: Projectile = {
      id: this.nextId++,
      type: 'arrow',
      position: origin.clone(),
      velocity: vel,
      damage,
      fromPlayer,
      lifetime: ARROW_LIFETIME,
      mesh,
      inGround: false,
    };

    mesh.position.copy(origin);
    this.scene.add(mesh);
    this.projectiles.set(arrow.id, arrow);
  }

  shootFireball(origin: THREE.Vector3, direction: THREE.Vector3, fromPlayer: boolean, damage: number = 4) {
    const mesh = this.createFireballMesh();
    const vel = direction.clone().normalize().multiplyScalar(15);

    const fireball: Projectile = {
      id: this.nextId++,
      type: 'fireball',
      position: origin.clone(),
      velocity: vel,
      damage,
      fromPlayer,
      lifetime: 10,
      mesh,
      inGround: false,
    };

    mesh.position.copy(origin);
    this.scene.add(mesh);
    this.projectiles.set(fireball.id, fireball);
  }

  private createFireballMesh(): THREE.Mesh {
    const geo = new THREE.BoxGeometry(0.25, 0.25, 0.25);
    const mat = new THREE.MeshLambertMaterial({
      color: 0xFF5500,
      emissive: 0xFF2200,
    });
    const mesh = new THREE.Mesh(geo, mat);
    return mesh;
  }

  update(
    dt: number,
    getBlock: (x: number, y: number, z: number) => number,
    hitPlayer: (damage: number, knockback: THREE.Vector3) => void,
    hitMob: (mobId: number, damage: number, knockback: THREE.Vector3) => void,
    getMobs: () => { id: number; position: THREE.Vector3; width: number; height: number }[],
    playerPos: THREE.Vector3,
    playerWidth: number,
    playerHeight: number
  ) {
    const toRemove: number[] = [];

    for (const [id, proj] of this.projectiles) {
      proj.lifetime -= dt;
      if (proj.lifetime <= 0) {
        toRemove.push(id);
        continue;
      }

      if (proj.inGround) continue;

      // Apply gravity
      if (proj.type === 'arrow') {
        proj.velocity.y += ARROW_GRAVITY * dt;
      }

      // Move
      const newPos = proj.position.clone().add(proj.velocity.clone().multiplyScalar(dt));
      const prevPos = proj.position.clone();

      // Block collision check
      const steps = Math.ceil(proj.velocity.length() * dt * 2);
      let hitBlock = false;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const checkPos = new THREE.Vector3().lerpVectors(prevPos, newPos, t);
        const bx = Math.floor(checkPos.x);
        const by = Math.floor(checkPos.y);
        const bz = Math.floor(checkPos.z);
        const block = getBlock(bx, by, bz);
        if (block !== 0 && !BlockRegistry.isFluid(block)) {
          proj.position.copy(checkPos);
          proj.inGround = true;
          hitBlock = true;
          break;
        }
      }

      if (!hitBlock) {
        proj.position.copy(newPos);
      }

      // Player collision (arrows from mobs)
      if (!proj.fromPlayer) {
        const distToPlayer = proj.position.distanceTo(playerPos);
        if (distToPlayer < playerWidth + 0.3 &&
            proj.position.y > playerPos.y &&
            proj.position.y < playerPos.y + playerHeight) {
          const kb = proj.velocity.clone().normalize().multiplyScalar(2);
          kb.y = 1;
          hitPlayer(proj.damage, kb);
          toRemove.push(id);
          continue;
        }
      }

      // Mob collision (arrows from player)
      if (proj.fromPlayer) {
        for (const mob of getMobs()) {
          const dist = proj.position.distanceTo(mob.position);
          if (dist < mob.width + 0.3 &&
              proj.position.y > mob.position.y &&
              proj.position.y < mob.position.y + mob.height) {
            const kb = proj.velocity.clone().normalize().multiplyScalar(2);
            kb.y = 1;
            hitMob(mob.id, proj.damage, kb);
            toRemove.push(id);
            break;
          }
        }
      }

      // Update mesh
      proj.mesh.position.copy(proj.position);
      if (proj.velocity.length() > 0.1) {
        const dir = proj.velocity.clone().normalize();
        proj.mesh.lookAt(proj.position.clone().add(dir));
      }

      // Ground arrows disappear after 60s
      if (proj.inGround) {
        proj.lifetime = Math.min(proj.lifetime, 60);
      }

      // Out of world
      if (proj.position.y < -10) {
        toRemove.push(id);
      }
    }

    // Remove dead projectiles
    for (const id of toRemove) {
      const proj = this.projectiles.get(id);
      if (proj) {
        this.scene.remove(proj.mesh);
        proj.mesh.geometry.dispose();
        this.projectiles.delete(id);
      }
    }
  }

  private createArrowMesh(): THREE.Mesh {
    // Simple arrow: thin elongated box
    const geo = new THREE.BoxGeometry(0.05, 0.05, 0.5);
    const mat = new THREE.MeshLambertMaterial({ color: 0x8B6914 });
    const mesh = new THREE.Mesh(geo, mat);
    return mesh;
  }

  dispose() {
    for (const proj of this.projectiles.values()) {
      this.scene.remove(proj.mesh);
      proj.mesh.geometry.dispose();
    }
    this.projectiles.clear();
  }
}
