import * as THREE from 'three';

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

const MAX_PARTICLES = 200;

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
      p.velocity.y -= 12 * dt; // gravity
      p.mesh.position.addScaledVector(p.velocity, dt);

      // Fade out
      const alpha = Math.max(0, p.life / p.maxLife);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = alpha;

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        (p.mesh.material as THREE.MeshBasicMaterial).dispose();
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
      });
    }
  }

  /** Spawn damage/hit particles (red). */
  spawnDamageParticles(x: number, y: number, z: number, count: number = 5) {
    this.spawnBlockBreak(x, y, z, 0xff0000, count);
  }

  /** Spawn mob death particles. */
  spawnDeathParticles(x: number, y: number, z: number, color: number) {
    this.spawnBlockBreak(x, y + 0.5, z, color, 15);
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
