import * as THREE from 'three';
import { BlockRegistry } from '../world/BlockRegistry';

export type ProjectileType = 'arrow' | 'snowball' | 'egg' | 'fireball' | 'potion' | 'shulker_bullet' | 'eye_of_ender' | 'wither_skull';

export interface Projectile {
  id: number;
  type: ProjectileType;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  damage: number;
  fromPlayer: boolean;
  lifetime: number;
  mesh: THREE.Mesh | THREE.Group;
  inGround: boolean;
  targetPos?: THREE.Vector3;
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

  createPotionMesh(color: string = '#8a2be2'): THREE.Mesh {
    const geo = new THREE.BoxGeometry(0.25, 0.35, 0.25);
    const mat = new THREE.MeshLambertMaterial({ color: color });
    return new THREE.Mesh(geo, mat);
  }

  shootPotion(origin: THREE.Vector3, direction: THREE.Vector3, fromPlayer: boolean, damage: number = 2) {
    const mesh = this.createPotionMesh();
    const vel = direction.clone().normalize().multiplyScalar(15);
    vel.y += 2.5; // Throw arch

    const potion: Projectile = {
      id: this.nextId++,
      type: 'potion',
      position: origin.clone(),
      velocity: vel,
      damage,
      fromPlayer,
      lifetime: 0,
      mesh,
      inGround: false
    };

    this.projectiles.set(potion.id, potion);
    this.scene.add(mesh);
    mesh.position.copy(potion.position);
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

  shootWitherSkull(origin: THREE.Vector3, direction: THREE.Vector3, fromPlayer: boolean, damage: number = 8) {
    const mesh = this.createWitherSkullMesh();
    const vel = direction.clone().normalize().multiplyScalar(16);

    const skull: Projectile = {
      id: this.nextId++,
      type: 'wither_skull',
      position: origin.clone(),
      velocity: vel,
      damage,
      fromPlayer,
      lifetime: 10,
      mesh,
      inGround: false
    };

    mesh.position.copy(origin);
    this.scene.add(mesh);
    this.projectiles.set(skull.id, skull);
  }

  shootShulkerBullet(origin: THREE.Vector3, direction: THREE.Vector3, fromPlayer: boolean, damage: number = 4) {
    const mesh = this.createShulkerBulletMesh();
    const vel = direction.clone().normalize().multiplyScalar(9);

    const bullet: Projectile = {
      id: this.nextId++,
      type: 'shulker_bullet',
      position: origin.clone(),
      velocity: vel,
      damage,
      fromPlayer,
      lifetime: 12,
      mesh,
      inGround: false,
    };

    mesh.position.copy(origin);
    this.scene.add(mesh);
    this.projectiles.set(bullet.id, bullet);
  }

  shootEnderEye(origin: THREE.Vector3, targetPos: THREE.Vector3) {
    const mesh = this.createEnderEyeMesh();
    // Compute horizontal direction towards stronghold
    const dir = new THREE.Vector3().subVectors(targetPos, origin);
    dir.y = 0;
    dir.normalize();

    // Initial speed and upward rise
    const speed = 12;
    const vel = dir.clone().multiplyScalar(speed);
    vel.y = 4.0; // rises up

    const eye: Projectile = {
      id: this.nextId++,
      type: 'eye_of_ender',
      position: origin.clone(),
      velocity: vel,
      damage: 0,
      fromPlayer: true,
      lifetime: 3.5, // 3.5s lifetime
      mesh,
      inGround: false,
      targetPos: targetPos.clone(),
    };

    mesh.position.copy(origin);
    this.scene.add(mesh);
    this.projectiles.set(eye.id, eye);
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

  private createShulkerBulletMesh(): THREE.Group {
    const group = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.22, 0.22),
      new THREE.MeshLambertMaterial({ color: 0xd8b7ff, emissive: 0x553377 })
    );
    const ring = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.08, 0.34),
      new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x442266 })
    );
    group.add(core, ring);
    return group;
  }

  private createEnderEyeMesh(): THREE.Mesh {
    const geo = new THREE.SphereGeometry(0.18, 8, 8);
    const mat = new THREE.MeshLambertMaterial({
      color: 0x1E5E4A,
      emissive: 0x0A2B20,
    });
    return new THREE.Mesh(geo, mat);
  }

  private createWitherSkullMesh(): THREE.Mesh {
    const geo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const mat = new THREE.MeshLambertMaterial({ color: 0x141414 });
    return new THREE.Mesh(geo, mat);
  }

  update(
    dt: number,
    getBlock: (x: number, y: number, z: number) => number,
    hitPlayer: (damage: number, knockback: THREE.Vector3, type: ProjectileType) => void,
    hitMob: (mobId: number, damage: number, knockback: THREE.Vector3) => void,
    getMobs: () => { id: number; position: THREE.Vector3; width: number; height: number }[],
    playerPos: THREE.Vector3,
    playerWidth: number,
    playerHeight: number,
    onPotionSplash?: (pos: THREE.Vector3, fromPlayer: boolean, damage: number) => void,
    onEnderEyeComplete?: (pos: THREE.Vector3, shattered: boolean) => void,
    onEnderEyeUpdate?: (pos: THREE.Vector3) => void
  ) {
    const toRemove: number[] = [];

    for (const [id, proj] of this.projectiles) {
      if (proj.lifetime <= dt) {
        if (proj.type === 'eye_of_ender' && onEnderEyeComplete) {
          const shattered = Math.random() < 0.33;
          onEnderEyeComplete(proj.position, shattered);
        }
      }

      proj.lifetime -= dt;
      if (proj.lifetime <= 0) {
        toRemove.push(id);
        continue;
      }

      if (proj.inGround) continue;

      // Apply gravity / Ender Eye movement
      if (proj.type === 'arrow' || proj.type === 'potion') {
        proj.velocity.y += ARROW_GRAVITY * dt;
      } else if (proj.type === 'eye_of_ender') {
        if (proj.lifetime > 1.5) {
          // Slow down vertical rise to level off
          proj.velocity.y = Math.max(0, proj.velocity.y - dt * 3.0);
          if (onEnderEyeUpdate) {
            onEnderEyeUpdate(proj.position);
          }
        } else {
          // Hover phase: stop moving
          proj.velocity.set(0, 0, 0);
        }
      }

      // Move
      const newPos = proj.position.clone().add(proj.velocity.clone().multiplyScalar(dt));
      const prevPos = proj.position.clone();

      // Block collision check
      const steps = Math.ceil(proj.velocity.length() * dt * 2);
      let hitBlock = false;
      if (proj.type !== 'eye_of_ender') {
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const checkPos = new THREE.Vector3().lerpVectors(prevPos, newPos, t);
          const bx = Math.floor(checkPos.x);
          const by = Math.floor(checkPos.y);
          const bz = Math.floor(checkPos.z);
          const block = getBlock(bx, by, bz);
          if (block !== 0 && !BlockRegistry.isFluid(block)) {
            proj.position.copy(checkPos);
            if (proj.type === 'potion') {
              if (onPotionSplash) {
                onPotionSplash(proj.position, proj.fromPlayer, proj.damage);
              }
            } else {
              proj.inGround = true;
            }
            hitBlock = true;
            break;
          }
        }
      }

      if (hitBlock && proj.type === 'potion') {
        toRemove.push(id);
        continue;
      }

      if (!hitBlock) {
        proj.position.copy(newPos);
      }

      // Player collision (arrows/potions from mobs)
      if (!proj.fromPlayer && proj.type !== 'eye_of_ender') {
        const distToPlayer = proj.position.distanceTo(playerPos);
        if (distToPlayer < playerWidth + 0.3 &&
            proj.position.y > playerPos.y &&
            proj.position.y < playerPos.y + playerHeight) {
          if (proj.type === 'potion') {
            if (onPotionSplash) {
              onPotionSplash(proj.position, proj.fromPlayer, proj.damage);
            }
          } else {
            const kb = proj.velocity.clone().normalize().multiplyScalar(2);
            kb.y = 1;
            hitPlayer(proj.damage, kb, proj.type);
          }
          toRemove.push(id);
          continue;
        }
      }

      // Mob collision (arrows/potions from player or other mobs)
      if (proj.fromPlayer && proj.type !== 'eye_of_ender') {
        let hit = false;
        for (const mob of getMobs()) {
          const dist = proj.position.distanceTo(mob.position);
          if (dist < mob.width + 0.3 &&
              proj.position.y > mob.position.y &&
              proj.position.y < mob.position.y + mob.height) {
            if (proj.type === 'potion') {
              if (onPotionSplash) {
                onPotionSplash(proj.position, proj.fromPlayer, proj.damage);
              }
            } else {
              const kb = proj.velocity.clone().normalize().multiplyScalar(2);
              kb.y = 1;
              hitMob(mob.id, proj.damage, kb);
            }
            toRemove.push(id);
            hit = true;
            break;
          }
        }
        if (hit) continue;
      }

      // Update mesh
      proj.mesh.position.copy(proj.position);
      if (proj.type === 'shulker_bullet') {
        proj.mesh.rotation.x += dt * 4;
        proj.mesh.rotation.y += dt * 5;
      }
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
      this.removeProjectile(id);
    }
  }

  removeProjectile(id: number) {
    const proj = this.projectiles.get(id);
    if (!proj) return;
    this.scene.remove(proj.mesh);
    if (proj.mesh instanceof THREE.Mesh) {
      proj.mesh.geometry.dispose();
    } else {
      proj.mesh.traverse(child => {
        if (child instanceof THREE.Mesh) child.geometry.dispose();
      });
    }
    this.projectiles.delete(id);
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
      if (proj.mesh instanceof THREE.Mesh) {
        proj.mesh.geometry.dispose();
      } else {
        proj.mesh.traverse(child => {
          if (child instanceof THREE.Mesh) child.geometry.dispose();
        });
      }
    }
    this.projectiles.clear();
  }
}
