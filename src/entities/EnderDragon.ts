import * as THREE from 'three';

export const ENDER_DRAGON_MAX_HEALTH = 200;

export class EnderDragon {
  position: THREE.Vector3;
  velocity = new THREE.Vector3();
  mesh: THREE.Group;
  health = ENDER_DRAGON_MAX_HEALTH;
  hurtTimer = 0;
  attackCooldown = 0;
  flightTime = 0;
  diveTimer = 0;
  dead = false;

  readonly width = 10;
  readonly height = 4;

  private wingLeft!: THREE.Mesh;
  private wingRight!: THREE.Mesh;
  private bodyMaterial!: THREE.MeshLambertMaterial;
  private wingMaterial!: THREE.MeshLambertMaterial;
  private eyeMaterial!: THREE.MeshLambertMaterial;

  constructor(x: number, y: number, z: number, health = ENDER_DRAGON_MAX_HEALTH) {
    this.position = new THREE.Vector3(x, y, z);
    this.health = Math.max(1, Math.min(ENDER_DRAGON_MAX_HEALTH, health));
    this.mesh = this.createMesh();
    this.mesh.position.copy(this.position);
  }

  update(dt: number, playerPos: THREE.Vector3) {
    this.flightTime += dt;
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.diveTimer = Math.max(0, this.diveTimer - dt);

    const orbitRadius = 46 + Math.sin(this.flightTime * 0.17) * 10;
    const orbitSpeed = 0.18;
    const orbitTarget = new THREE.Vector3(
      Math.cos(this.flightTime * orbitSpeed) * orbitRadius,
      88 + Math.sin(this.flightTime * 0.42) * 10,
      Math.sin(this.flightTime * orbitSpeed) * orbitRadius
    );

    if (this.diveTimer <= 0 && this.attackCooldown <= 0 && this.position.distanceTo(playerPos) < 70) {
      this.diveTimer = 3.2;
      this.attackCooldown = 7.5;
    }

    const target = this.diveTimer > 0
      ? playerPos.clone().add(new THREE.Vector3(0, 3.0, 0))
      : orbitTarget;

    const desired = target.sub(this.position);
    if (desired.lengthSq() > 0.001) {
      desired.normalize().multiplyScalar(this.diveTimer > 0 ? 18 : 10);
      this.velocity.lerp(desired, Math.min(1, dt * 0.9));
    }

    this.position.addScaledVector(this.velocity, dt);
    this.position.y = THREE.MathUtils.clamp(this.position.y, 66, 112);

    const horizontalVelocity = new THREE.Vector3(this.velocity.x, 0, this.velocity.z);
    if (horizontalVelocity.lengthSq() > 0.001) {
      this.mesh.rotation.y = Math.atan2(horizontalVelocity.x, horizontalVelocity.z);
    }
    this.mesh.rotation.x = THREE.MathUtils.clamp(-this.velocity.y * 0.02, -0.35, 0.35);
    this.mesh.position.copy(this.position);

    const flap = Math.sin(this.flightTime * 7) * 0.55;
    this.wingLeft.rotation.z = -0.35 + flap;
    this.wingRight.rotation.z = 0.35 - flap;

    const hurtColor = this.hurtTimer > 0 ? 0x5a1f5f : 0x171019;
    this.bodyMaterial.color.setHex(hurtColor);
    this.wingMaterial.color.setHex(this.hurtTimer > 0 ? 0x3e1744 : 0x211326);
  }

  takeDamage(amount: number, knockback?: THREE.Vector3) {
    if (this.dead || amount <= 0) return;
    this.health = Math.max(0, this.health - amount);
    this.hurtTimer = 0.2;
    if (knockback) {
      this.velocity.addScaledVector(knockback, 0.35);
    }
    if (this.health <= 0) {
      this.dead = true;
    }
  }

  heal(amount: number) {
    if (this.dead || amount <= 0) return;
    this.health = Math.min(ENDER_DRAGON_MAX_HEALTH, this.health + amount);
  }

  intersectsRay(origin: THREE.Vector3, direction: THREE.Vector3, range: number): boolean {
    const toDragon = new THREE.Vector3().subVectors(this.position, origin);
    const along = toDragon.dot(direction);
    if (along < 0 || along > range) return false;
    const closest = origin.clone().addScaledVector(direction, along);
    const radius = this.width * 0.45;
    return closest.distanceTo(this.position) <= radius;
  }

  containsPoint(point: THREE.Vector3): boolean {
    const horizontal = new THREE.Vector2(point.x - this.position.x, point.z - this.position.z).length();
    const vertical = Math.abs(point.y - (this.position.y + 1.5));
    return horizontal <= this.width * 0.45 && vertical <= this.height;
  }

  dispose() {
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
      }
    });
    this.bodyMaterial.dispose();
    this.wingMaterial.dispose();
    this.eyeMaterial.dispose();
  }

  private createMesh(): THREE.Group {
    const group = new THREE.Group();
    this.bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x171019 });
    this.wingMaterial = new THREE.MeshLambertMaterial({ color: 0x211326, side: THREE.DoubleSide });
    this.eyeMaterial = new THREE.MeshLambertMaterial({ color: 0xd833ff, emissive: 0x551166 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(3.0, 2.0, 6.0), this.bodyMaterial);
    body.position.y = 1.4;
    group.add(body);

    const neck = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 2.2), this.bodyMaterial);
    neck.position.set(0, 1.8, -3.5);
    group.add(neck);

    const head = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 1.8), this.bodyMaterial);
    head.position.set(0, 1.9, -5.0);
    group.add(head);

    const eyeGeo = new THREE.BoxGeometry(0.22, 0.16, 0.04);
    const eyeL = new THREE.Mesh(eyeGeo, this.eyeMaterial);
    const eyeR = new THREE.Mesh(eyeGeo, this.eyeMaterial);
    eyeL.position.set(-0.45, 2.05, -5.92);
    eyeR.position.set(0.45, 2.05, -5.92);
    group.add(eyeL, eyeR);

    const tailGeo = new THREE.BoxGeometry(0.75, 0.75, 2.7);
    for (let i = 0; i < 3; i++) {
      const tail = new THREE.Mesh(tailGeo, this.bodyMaterial);
      tail.position.set(0, 1.25 - i * 0.08, 4.0 + i * 1.75);
      tail.scale.setScalar(1 - i * 0.18);
      group.add(tail);
    }

    const wingGeo = new THREE.BoxGeometry(5.5, 0.08, 3.0);
    this.wingLeft = new THREE.Mesh(wingGeo, this.wingMaterial);
    this.wingLeft.position.set(-3.9, 2.0, -0.6);
    this.wingLeft.rotation.z = -0.35;
    group.add(this.wingLeft);

    this.wingRight = new THREE.Mesh(wingGeo, this.wingMaterial);
    this.wingRight.position.set(3.9, 2.0, -0.6);
    this.wingRight.rotation.z = 0.35;
    group.add(this.wingRight);

    const legGeo = new THREE.BoxGeometry(0.55, 1.3, 0.55);
    for (const x of [-0.9, 0.9]) {
      for (const z of [-1.6, 1.5]) {
        const leg = new THREE.Mesh(legGeo, this.bodyMaterial);
        leg.position.set(x, 0.2, z);
        group.add(leg);
      }
    }

    group.name = 'ender-dragon';
    return group;
  }
}
