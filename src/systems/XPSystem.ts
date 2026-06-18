import * as THREE from 'three';

export interface XPState {
  level: number;
  total: number;
  current: number;
  next: number;
  progress: number;
}

interface XPOrb {
  id: number;
  value: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  mesh: THREE.Mesh;
  age: number;
  pickupDelay: number;
}

const PICKUP_RADIUS = 5.5;
const TOUCH_RADIUS = 0.65;
const DESPAWN_TIME = 300;

export class XPSystem {
  private scene: THREE.Scene;
  private orbs: Map<number, XPOrb> = new Map();
  private nextOrbId = 1;
  private level = 0;
  private current = 0;
  private total = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  spawnXP(amount: number, position: THREE.Vector3) {
    let remaining = Math.max(0, Math.floor(amount));
    while (remaining > 0) {
      const value = this.splitOrbValue(remaining);
      remaining -= value;
      this.spawnOrb(value, position);
    }
  }

  update(
    dt: number,
    playerPos: THREE.Vector3,
    isSolidBlock: (x: number, y: number, z: number) => boolean,
    onPickup: () => void,
    onChange: () => void
  ) {
    const target = playerPos.clone().add(new THREE.Vector3(0, 0.9, 0));
    let changed = false;

    for (const [id, orb] of this.orbs) {
      orb.age += dt;
      orb.pickupDelay = Math.max(0, orb.pickupDelay - dt);

      if (orb.age >= DESPAWN_TIME) {
        this.removeOrb(id);
        continue;
      }

      orb.velocity.y -= 18 * dt;
      orb.position.addScaledVector(orb.velocity, dt);

      const bx = Math.floor(orb.position.x);
      const by = Math.floor(orb.position.y);
      const bz = Math.floor(orb.position.z);
      if (isSolidBlock(bx, by, bz)) {
        orb.position.y = by + 1.02;
        orb.velocity.y = Math.abs(orb.velocity.y) * 0.45;
        orb.velocity.x *= 0.7;
        orb.velocity.z *= 0.7;
      }

      orb.velocity.x *= Math.pow(0.98, dt * 60);
      orb.velocity.z *= Math.pow(0.98, dt * 60);

      if (orb.pickupDelay <= 0) {
        const dist = orb.position.distanceTo(target);
        if (dist < PICKUP_RADIUS) {
          const pullDir = new THREE.Vector3().subVectors(target, orb.position).normalize();
          const speed = Math.max(4.5, (PICKUP_RADIUS - dist) * 6.5);
          orb.position.addScaledVector(pullDir, speed * dt);

          if (dist < TOUCH_RADIUS) {
            this.addXP(orb.value);
            this.removeOrb(id);
            onPickup();
            changed = true;
            continue;
          }
        }
      }

      const pulse = 0.85 + Math.sin((orb.age * 8) + orb.id) * 0.12;
      orb.mesh.scale.setScalar(pulse);
      orb.mesh.rotation.y += dt * 3;
      orb.mesh.position.copy(orb.position);
    }

    if (changed) {
      onChange();
    }
  }

  addXP(amount: number) {
    let remaining = Math.max(0, Math.floor(amount));
    this.total += remaining;

    while (remaining > 0) {
      const needed = this.getXPForNextLevel(this.level) - this.current;
      const add = Math.min(remaining, needed);
      this.current += add;
      remaining -= add;

      if (this.current >= this.getXPForNextLevel(this.level)) {
        this.current = 0;
        this.level += 1;
      }
    }
  }

  setState(level: number, current: number, total: number) {
    this.level = Math.max(0, Math.floor(level));
    this.current = Math.max(0, Math.floor(current));
    this.total = Math.max(0, Math.floor(total));

    const next = this.getXPForNextLevel(this.level);
    if (this.current >= next) {
      this.current = next - 1;
    }
  }

  reset() {
    this.level = 0;
    this.current = 0;
    this.total = 0;
    for (const id of Array.from(this.orbs.keys())) {
      this.removeOrb(id);
    }
  }

  getState(): XPState {
    const next = this.getXPForNextLevel(this.level);
    return {
      level: this.level,
      total: this.total,
      current: this.current,
      next,
      progress: next > 0 ? this.current / next : 0,
    };
  }

  dispose() {
    this.reset();
  }

  private spawnOrb(value: number, position: THREE.Vector3) {
    const geometry = new THREE.SphereGeometry(0.14, 10, 8);
    const material = new THREE.MeshLambertMaterial({
      color: 0xbfff3f,
      emissive: 0x5f8f00,
      emissiveIntensity: 0.7,
    });
    const mesh = new THREE.Mesh(geometry, material);
    const spawnPos = position.clone().add(new THREE.Vector3(
      (Math.random() - 0.5) * 0.7,
      0.35 + Math.random() * 0.4,
      (Math.random() - 0.5) * 0.7
    ));
    mesh.position.copy(spawnPos);

    const orb: XPOrb = {
      id: this.nextOrbId++,
      value,
      position: spawnPos,
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 2.0,
        2.5 + Math.random() * 1.4,
        (Math.random() - 0.5) * 2.0
      ),
      mesh,
      age: 0,
      pickupDelay: 0.45,
    };

    this.orbs.set(orb.id, orb);
    this.scene.add(mesh);
  }

  private removeOrb(id: number) {
    const orb = this.orbs.get(id);
    if (!orb) return;
    this.scene.remove(orb.mesh);
    orb.mesh.geometry.dispose();
    if (Array.isArray(orb.mesh.material)) {
      orb.mesh.material.forEach((mat) => mat.dispose());
    } else {
      orb.mesh.material.dispose();
    }
    this.orbs.delete(id);
  }

  private splitOrbValue(remaining: number): number {
    if (remaining >= 11) return 11;
    if (remaining >= 7) return 7;
    if (remaining >= 3) return 3;
    return 1;
  }

  private getXPForNextLevel(level: number): number {
    if (level >= 30) return 112 + (level - 30) * 9;
    if (level >= 15) return 37 + (level - 15) * 5;
    return 7 + level * 2;
  }
}
