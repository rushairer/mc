import * as THREE from 'three';

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
  zombie:   { type: 'zombie',   health: 20, speed: 2.0, damage: 3, hostile: true,  width: 0.6, height: 1.8, bodyColor: 0x2E8B57, headColor: 0x2E8B57, eyeColor: 0x000000, xpDrop: 5,  drops: [{ id: 9, count: 1, chance: 0.1 }] },
  skeleton: { type: 'skeleton', health: 20, speed: 2.5, damage: 2, hostile: true,  width: 0.6, height: 1.8, bodyColor: 0xC8C8C8, headColor: 0xC8C8C8, eyeColor: 0x333333, xpDrop: 5,  drops: [{ id: 100, count: 1, chance: 0.2 }] },
  creeper:  { type: 'creeper',  health: 20, speed: 2.2, damage: 0, hostile: true,  width: 0.6, height: 1.7, bodyColor: 0x4CAF50, headColor: 0x4CAF50, eyeColor: 0x000000, xpDrop: 5,  drops: [{ id: 107, count: 1, chance: 0.2 }] },
  spider:   { type: 'spider',   health: 16, speed: 3.0, damage: 2, hostile: true,  width: 1.4, height: 0.8, bodyColor: 0x4A3728, headColor: 0x6B4E3D, eyeColor: 0xFF0000, xpDrop: 5,  drops: [{ id: 107, count: 1, chance: 0.3 }] },
  cow:      { type: 'cow',      health: 10, speed: 1.5, damage: 0, hostile: false, width: 0.9, height: 1.4, bodyColor: 0x8B4513, headColor: 0x6B3410, xpDrop: 3,  drops: [{ id: 173, count: 1, chance: 1.0 }, { id: 16, count: 1, chance: 0.5 }] },
  pig:      { type: 'pig',      health: 10, speed: 1.8, damage: 0, hostile: false, width: 0.7, height: 0.9, bodyColor: 0xFFB6C1, headColor: 0xFF9999, xpDrop: 3,  drops: [{ id: 174, count: 1, chance: 1.0 }] },
  sheep:    { type: 'sheep',    health: 8,  speed: 1.5, damage: 0, hostile: false, width: 0.8, height: 1.3, bodyColor: 0xE8E8E8, headColor: 0xD0D0D0, xpDrop: 3,  drops: [{ id: 16, count: 1, chance: 1.0 }] },
  chicken:  { type: 'chicken',  health: 4,  speed: 2.0, damage: 0, hostile: false, width: 0.4, height: 0.7, bodyColor: 0xFFFFFF, headColor: 0xFF0000, xpDrop: 3,  drops: [] },
};

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
    const hw = this.def.width / 2;
    const hh = this.def.height;

    // Body
    const bodyGeo = new THREE.BoxGeometry(this.def.width, hh * 0.6, this.def.width * 0.8);
    const bodyMat = new THREE.MeshLambertMaterial({ color: this.def.bodyColor });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = hh * 0.3;
    group.add(body);

    // Head
    const headSize = hw * 1.2;
    const headGeo = new THREE.BoxGeometry(headSize, headSize, headSize);
    const headMat = new THREE.MeshLambertMaterial({
      color: this.def.headColor ?? this.def.bodyColor,
    });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = hh * 0.6 + headSize * 0.5;
    group.add(head);

    // Eyes
    if (this.def.eyeColor !== undefined) {
      const eyeGeo = new THREE.BoxGeometry(0.12, 0.12, 0.05);
      const eyeMat = new THREE.MeshLambertMaterial({ color: this.def.eyeColor });
      const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
      const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
      eyeL.position.set(-headSize * 0.25, hh * 0.6 + headSize * 0.6, headSize * 0.5);
      eyeR.position.set(headSize * 0.25, hh * 0.6 + headSize * 0.6, headSize * 0.5);
      group.add(eyeL, eyeR);
    }

    // Legs (4 small boxes)
    const legGeo = new THREE.BoxGeometry(hw * 0.4, hh * 0.35, hw * 0.4);
    const legMat = new THREE.MeshLambertMaterial({ color: this.def.bodyColor });
    const legPositions = [
      [-hw * 0.4, 0, -hw * 0.3],
      [hw * 0.4, 0, -hw * 0.3],
      [-hw * 0.4, 0, hw * 0.3],
      [hw * 0.4, 0, hw * 0.3],
    ];
    for (const [lx, ly, lz] of legPositions) {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(lx, ly + hh * 0.17, lz);
      group.add(leg);
    }

    return group;
  }

  update(
    dt: number,
    playerPos: THREE.Vector3,
    getBlock: (x: number, y: number, z: number) => number,
    hurtPlayer: (damage: number, knockback: THREE.Vector3) => void
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

    // AI
    this.updateAI(dt, playerPos, getBlock);

    // Physics - gravity
    if (!this.onGround) {
      this.velocity.y += -28 * dt;
    }

    // Apply velocity with collision
    this.moveWithCollision(dt, getBlock);

    // Hostile mob attacks player
    if (this.def.hostile && distToPlayer < 1.8 && this.attackCooldown <= 0) {
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

    // Flash red when hurt
    if (this.hurtTimer > 0) {
      this.mesh.children.forEach(child => {
        if (child instanceof THREE.Mesh) {
          (child.material as THREE.MeshLambertMaterial).emissive.setHex(0xff3333);
        }
      });
    } else {
      this.mesh.children.forEach(child => {
        if (child instanceof THREE.Mesh) {
          (child.material as THREE.MeshLambertMaterial).emissive.setHex(0x000000);
        }
      });
    }
  }

  private updateAI(dt: number, playerPos: THREE.Vector3, getBlock: (x: number, y: number, z: number) => number) {
    const distToPlayer = this.position.distanceTo(playerPos);

    if (this.def.hostile) {
      // Hostile: chase player within 16 blocks
      if (distToPlayer < 16) {
        this.aiState = 'chase';
        const dir = new THREE.Vector3().subVectors(playerPos, this.position);
        dir.y = 0;
        dir.normalize();
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
        this.velocity.x = dir.x * this.def.speed * 0.5;
        this.velocity.z = dir.z * this.def.speed * 0.5;
      }
    } else {
      this.velocity.x *= 0.9;
      this.velocity.z *= 0.9;
    }
  }

  private moveWithCollision(dt: number, getBlock: (x: number, y: number, z: number) => number) {
    // X axis
    this.position.x += this.velocity.x * dt;
    if (this.checkCollision(getBlock)) {
      this.position.x -= this.velocity.x * dt;
      this.velocity.x = 0;
    }

    // Y axis
    const prevY = this.position.y;
    this.position.y += this.velocity.y * dt;
    this.onGround = false;

    if (this.checkCollision(getBlock)) {
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
    if (this.checkCollision(getBlock)) {
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

  private checkCollision(getBlock: (x: number, y: number, z: number) => number): boolean {
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
          const blockId = getBlock(bx, by, bz);
          if (blockId === 0) continue;
          if (blockId === 13 || blockId === 14) continue; // water/lava - not solid for mobs

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
