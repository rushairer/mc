import * as THREE from 'three';

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  gravity?: number;
  type?: 'break' | 'flame' | 'smoke' | 'enchant' | 'xp';
}

const MAX_PARTICLES = 400; // Increased limit to support rich particle environments

export class ParticleSystem {
  private particles: Particle[] = [];
  private scene: THREE.Scene;
  private sharedGeo: THREE.BoxGeometry;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.sharedGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  }

  update(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;

      // Apply custom gravity/buoyancy based on particle type
      let gravityVal = 12; // standard gravity
      if (p.type === 'flame' || p.type === 'smoke' || p.type === 'enchant') {
        gravityVal = -0.5; // gentle upward drift (buoyancy)
      } else if (p.type === 'xp') {
        gravityVal = 2.0; // light gravity for experience orbs
      } else if (p.gravity !== undefined) {
        gravityVal = p.gravity;
      }

      p.velocity.y -= gravityVal * dt;
      p.mesh.position.addScaledVector(p.velocity, dt);

      // Fade out opacity over time
      const alpha = Math.max(0, p.life / p.maxLife);
      const mat = p.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = alpha;

      // Shrink size for flame, smoke, and glyphs
      if (p.type === 'flame' || p.type === 'smoke' || p.type === 'enchant') {
        const scale = alpha;
        p.mesh.scale.set(scale, scale, scale);
      }

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        mat.dispose();
        this.particles.splice(i, 1);
      }
    }
  }

  /** Spawn block-breaking particles at a position with a color. */
  spawnBlockBreak(x: number, y: number, z: number, color: number, count: number = 8) {
    if (this.particles.length + count > MAX_PARTICLES) return;

    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 1,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.sharedGeo, mat);
      mesh.position.set(
        x + 0.5 + (Math.random() - 0.5) * 0.8,
        y + 0.5 + (Math.random() - 0.5) * 0.8,
        z + 0.5 + (Math.random() - 0.5) * 0.8
      );
      this.scene.add(mesh);

      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 4,
          Math.random() * 5 + 1,
          (Math.random() - 0.5) * 4
        ),
        life: 0.4 + Math.random() * 0.3,
        maxLife: 0.7,
        type: 'break',
      });
    }

    // Spawn 2-3 smoke particles alongside block break for dust effect
    if (count >= 8) {
      this.spawnSmoke(x + 0.5, y + 0.5, z + 0.5, 2);
    }
  }

  /** Spawn damage/hit particles (red). */
  spawnDamageParticles(x: number, y: number, z: number, count: number = 5) {
    this.spawnBlockBreak(x, y, z, 0xff0000, count);
  }

  /** Spawn mob death particles. */
  spawnDeathParticles(x: number, y: number, z: number, color: number) {
    this.spawnBlockBreak(x, y + 0.5, z, color, 15);
    this.spawnSmoke(x, y + 0.5, z, 5);
  }

  /** Spawn flame particles (e.g. from torches, furnaces, spawners). */
  spawnFlame(x: number, y: number, z: number, count: number = 1) {
    if (this.particles.length + count > MAX_PARTICLES) return;

    const colors = [0xff9900, 0xff3300, 0xffbb00];

    for (let i = 0; i < count; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.sharedGeo, mat);
      mesh.scale.set(0.65, 0.65, 0.65);
      mesh.position.set(
        x + (Math.random() - 0.5) * 0.1,
        y + (Math.random() - 0.5) * 0.1,
        z + (Math.random() - 0.5) * 0.1
      );
      this.scene.add(mesh);

      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.25,
          0.6 + Math.random() * 0.4,
          (Math.random() - 0.5) * 0.25
        ),
        life: 0.35 + Math.random() * 0.2,
        maxLife: 0.55,
        type: 'flame',
      });
    }
  }

  /** Spawn smoke particles (e.g. from fire, ovens, torches, explosions). */
  spawnSmoke(x: number, y: number, z: number, count: number = 2) {
    if (this.particles.length + count > MAX_PARTICLES) return;

    const colors = [0x555555, 0x777777, 0x3c3c3c];

    for (let i = 0; i < count; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.sharedGeo, mat);
      mesh.scale.set(0.9, 0.9, 0.9);
      mesh.position.set(
        x + (Math.random() - 0.5) * 0.15,
        y + (Math.random() - 0.5) * 0.15,
        z + (Math.random() - 0.5) * 0.15
      );
      this.scene.add(mesh);

      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.3,
          0.4 + Math.random() * 0.4,
          (Math.random() - 0.5) * 0.3
        ),
        life: 0.55 + Math.random() * 0.35,
        maxLife: 0.9,
        type: 'smoke',
      });
    }
  }

  /** Spawn enchanting table glyph particles floating toward target. */
  spawnEnchantingGlyphs(startX: number, startY: number, startZ: number, targetX: number, targetY: number, targetZ: number, count: number = 1) {
    if (this.particles.length + count > MAX_PARTICLES) return;

    for (let i = 0; i < count; i++) {
      const color = Math.random() > 0.4 ? 0x00ccff : 0xaa00ff;
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.sharedGeo, mat);
      mesh.scale.set(0.5, 0.5, 0.5);
      mesh.position.set(startX, startY, startZ);
      this.scene.add(mesh);

      const dir = new THREE.Vector3(targetX - startX, targetY - startY, targetZ - startZ);
      const dist = dir.length();
      dir.normalize();

      this.particles.push({
        mesh,
        velocity: dir.multiplyScalar(dist * 1.6).add(new THREE.Vector3(
          (Math.random() - 0.5) * 0.4,
          (Math.random() - 0.5) * 0.4,
          (Math.random() - 0.5) * 0.4
        )),
        life: 0.55,
        maxLife: 0.55,
        type: 'enchant',
        gravity: 0,
      });
    }
  }

  /** Spawn experience particles (XP). */
  spawnXP(x: number, y: number, z: number, count: number = 2) {
    if (this.particles.length + count > MAX_PARTICLES) return;

    for (let i = 0; i < count; i++) {
      const color = Math.random() > 0.5 ? 0x7cff00 : 0xfffd00; // neon green or bright yellow
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.sharedGeo, mat);
      mesh.scale.set(0.4, 0.4, 0.4);
      mesh.position.set(
        x + (Math.random() - 0.5) * 0.3,
        y + (Math.random() - 0.5) * 0.3,
        z + (Math.random() - 0.5) * 0.3
      );
      this.scene.add(mesh);

      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 1.5,
          1.2 + Math.random() * 1.8,
          (Math.random() - 0.5) * 1.5
        ),
        life: 0.45 + Math.random() * 0.35,
        maxLife: 0.8,
        type: 'xp',
      });
    }
  }

  dispose() {
    for (const p of this.particles) {
      this.scene.remove(p.mesh);
      (p.mesh.material as THREE.MeshBasicMaterial).dispose();
    }
    this.particles = [];
    this.sharedGeo.dispose();
  }
}
