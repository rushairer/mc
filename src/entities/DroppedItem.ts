import * as THREE from 'three';

export class DroppedItem {
  static nextId = 1;
  id: number;
  itemId: number;
  count: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  mesh: THREE.Object3D;
  age = 0;
  pickupDelay: number;
  onGround = false;

  constructor(
    itemId: number,
    count: number,
    x: number,
    y: number,
    z: number,
    velocity: THREE.Vector3 = new THREE.Vector3(0, 0, 0),
    pickupDelay = 1.0,
    createMesh: (itemId: number) => THREE.Object3D | null
  ) {
    this.id = DroppedItem.nextId++;
    this.itemId = itemId;
    this.count = count;
    this.position = new THREE.Vector3(x, y, z);
    this.velocity = velocity.clone();
    this.pickupDelay = pickupDelay;

    // Create mesh container
    this.mesh = new THREE.Group();
    
    // Generate inner mesh using custom builder
    const innerMesh = createMesh(itemId);
    if (innerMesh) {
      // Scale down so it looks like a small dropped item
      innerMesh.scale.set(0.4, 0.4, 0.4);
      
      // Center the inner mesh inside the group
      innerMesh.position.set(0, 0.1, 0);
      this.mesh.add(innerMesh);
    } else {
      // Fallback placeholder box
      const geo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
      const mat = new THREE.MeshLambertMaterial({ color: 0x888888 });
      const placeholder = new THREE.Mesh(geo, mat);
      placeholder.position.set(0, 0.1, 0);
      this.mesh.add(placeholder);
    }
    
    this.mesh.position.copy(this.position);
  }

  update(
    dt: number,
    isSolidBlock: (x: number, y: number, z: number) => boolean
  ) {
    this.age += dt;
    if (this.pickupDelay > 0) {
      this.pickupDelay -= dt;
    }

    // Apply gravity
    if (!this.onGround) {
      this.velocity.y -= 16 * dt; // gravity deceleration
    }

    // Slow horizontal speed (friction)
    const drag = this.onGround ? 0.75 : 0.98;
    this.velocity.x *= drag;
    this.velocity.z *= drag;

    // Apply velocity with collision detection
    const prevY = this.position.y;
    this.onGround = false;

    // Move X
    this.position.x += this.velocity.x * dt;
    if (this.checkCollision(this.position.x, this.position.y, this.position.z, isSolidBlock)) {
      this.position.x -= this.velocity.x * dt;
      this.velocity.x = 0;
    }

    // Move Y
    this.position.y += this.velocity.y * dt;
    if (this.checkCollision(this.position.x, this.position.y, this.position.z, isSolidBlock)) {
      if (this.velocity.y < 0) {
        // Rest on top of block
        this.position.y = Math.floor(prevY) + 0.001;
        this.onGround = true;
      } else {
        this.position.y = prevY;
      }
      this.velocity.y = 0;
    }

    // Move Z
    this.position.z += this.velocity.z * dt;
    if (this.checkCollision(this.position.x, this.position.y, this.position.z, isSolidBlock)) {
      this.position.z -= this.velocity.z * dt;
      this.velocity.z = 0;
    }

    // Don't fall through world
    if (this.position.y < 0) {
      this.position.y = 0;
      this.velocity.y = 0;
      this.onGround = true;
    }

    // Update mesh position with float animation
    const floatOffset = Math.sin(this.age * 3.5) * 0.04;
    this.mesh.position.copy(this.position);
    this.mesh.position.y += floatOffset;

    // Rotate mesh
    this.mesh.rotation.y += 1.5 * dt;
  }

  private checkCollision(
    x: number,
    y: number,
    z: number,
    isSolidBlock: (x: number, y: number, z: number) => boolean
  ): boolean {
    const radius = 0.15;
    const height = 0.25;
    const points = [
      new THREE.Vector3(x, y, z),
      new THREE.Vector3(x - radius, y, z - radius),
      new THREE.Vector3(x + radius, y, z - radius),
      new THREE.Vector3(x - radius, y, z + radius),
      new THREE.Vector3(x + radius, y, z + radius),
      new THREE.Vector3(x, y + height, z),
      new THREE.Vector3(x - radius, y + height, z - radius),
      new THREE.Vector3(x + radius, y + height, z - radius),
      new THREE.Vector3(x - radius, y + height, z + radius),
      new THREE.Vector3(x + radius, y + height, z + radius),
    ];

    for (const pt of points) {
      if (isSolidBlock(Math.floor(pt.x), Math.floor(pt.y), Math.floor(pt.z))) {
        return true;
      }
    }
    return false;
  }

  dispose() {
    this.mesh.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
  }
}
