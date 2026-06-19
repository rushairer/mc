import * as THREE from 'three';
import { BlockRegistry } from '../world/BlockRegistry';

export type VehicleType = 'boat' | 'minecart';

export class Vehicle {
  id: number;
  type: VehicleType;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotationY = 0;
  mesh: THREE.Mesh | THREE.Group;
  width = 1.3;
  height = 0.6;
  isRidden = false;
  speed = 0;

  constructor(id: number, type: VehicleType, position: THREE.Vector3, mesh: THREE.Mesh | THREE.Group) {
    this.id = id;
    this.type = type;
    this.position = position.clone();
    this.velocity = new THREE.Vector3();
    this.mesh = mesh;
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.mesh);
    this.mesh.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }
}

export class VehicleSystem {
  vehicles: Map<number, Vehicle> = new Map();
  private scene: THREE.Scene;
  private nextId = 1;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  spawnVehicle(type: VehicleType, position: THREE.Vector3): Vehicle {
    const mesh = type === 'boat' ? this.createBoatMesh() : this.createMinecartMesh();
    mesh.position.copy(position);
    this.scene.add(mesh);

    const vehicle = new Vehicle(this.nextId++, type, position, mesh);
    this.vehicles.set(vehicle.id, vehicle);
    return vehicle;
  }

  removeVehicle(id: number) {
    const vehicle = this.vehicles.get(id);
    if (vehicle) {
      vehicle.dispose(this.scene);
      this.vehicles.delete(id);
    }
  }

  getVehicleInRay(origin: THREE.Vector3, direction: THREE.Vector3, range: number): Vehicle | null {
    const ray = new THREE.Ray(origin, direction);
    let nearest: Vehicle | null = null;
    let minDist = range;

    for (const vehicle of this.vehicles.values()) {
      const box = new THREE.Box3(
        new THREE.Vector3(vehicle.position.x - vehicle.width/2, vehicle.position.y, vehicle.position.z - vehicle.width/2),
        new THREE.Vector3(vehicle.position.x + vehicle.width/2, vehicle.position.y + vehicle.height, vehicle.position.z + vehicle.width/2)
      );
      const intersect = new THREE.Vector3();
      if (ray.intersectBox(box, intersect)) {
        const d = origin.distanceTo(intersect);
        if (d < minDist) {
          minDist = d;
          nearest = vehicle;
        }
      }
    }
    return nearest;
  }

  update(
    dt: number,
    getBlock: (x: number, y: number, z: number) => number,
    isSolidBlock: (x: number, y: number, z: number) => boolean,
    inputKeys: { w: boolean; s: boolean; a: boolean; d: boolean }
  ) {
    for (const vehicle of this.vehicles.values()) {
      if (vehicle.type === 'boat') {
        this.updateBoatPhysics(vehicle, dt, getBlock, isSolidBlock, inputKeys);
      } else {
        this.updateMinecartPhysics(vehicle, dt, getBlock, isSolidBlock, inputKeys);
      }
      vehicle.mesh.position.copy(vehicle.position);
      vehicle.mesh.rotation.y = vehicle.rotationY;
    }
  }

  private createBoatMesh(): THREE.Group {
    const group = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.2, 0.7),
      new THREE.MeshLambertMaterial({ color: 0x8B5A2B })
    );
    base.position.y = 0.1;
    group.add(base);

    const sideMaterial = new THREE.MeshLambertMaterial({ color: 0x5C3317 });
    const left = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 0.1), sideMaterial);
    left.position.set(0, 0.3, 0.35);
    const right = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 0.1), sideMaterial);
    right.position.set(0, 0.3, -0.35);
    const front = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.6), sideMaterial);
    front.position.set(0.6, 0.3, 0);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.6), sideMaterial);
    back.position.set(-0.6, 0.3, 0);

    group.add(left, right, front, back);
    return group;
  }

  private createMinecartMesh(): THREE.Group {
    const group = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 0.15, 0.7),
      new THREE.MeshLambertMaterial({ color: 0x7f8c8d })
    );
    base.position.y = 0.085;
    group.add(base);

    const sideMaterial = new THREE.MeshLambertMaterial({ color: 0x95a5a6 });
    const left = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.35, 0.08), sideMaterial);
    left.position.set(0, 0.26, 0.31);
    const right = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.35, 0.08), sideMaterial);
    right.position.set(0, 0.26, -0.31);
    const front = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.54), sideMaterial);
    front.position.set(0.46, 0.26, 0);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.54), sideMaterial);
    back.position.set(-0.46, 0.26, 0);

    group.add(left, right, front, back);
    return group;
  }

  private updateBoatPhysics(
    boat: Vehicle,
    dt: number,
    getBlock: (x: number, y: number, z: number) => number,
    isSolidBlock: (x: number, y: number, z: number) => boolean,
    inputKeys: { w: boolean; s: boolean; a: boolean; d: boolean }
  ) {
    const bx = Math.floor(boat.position.x);
    const by = Math.floor(boat.position.y);
    const bz = Math.floor(boat.position.z);
    const currentBlock = getBlock(bx, by, bz);
    const blockBelow = getBlock(bx, Math.max(0, by - 1), bz);

    const isInWater = BlockRegistry.isWater(currentBlock) || BlockRegistry.isWater(blockBelow);

    if (isInWater) {
      const waterSurfaceY = Math.floor(boat.position.y) + 0.9;
      const dy = waterSurfaceY - boat.position.y;
      boat.velocity.y = THREE.MathUtils.lerp(boat.velocity.y, dy * 5.0, dt * 10);
    } else {
      boat.velocity.y -= 18.0 * dt;
    }

    if (boat.isRidden) {
      let speedTarget = 0;
      let rotSpeed = 0;

      if (inputKeys.w) speedTarget = isInWater ? 6.5 : 1.5;
      else if (inputKeys.s) speedTarget = isInWater ? -3.0 : -0.8;

      if (inputKeys.a) rotSpeed = 2.0;
      else if (inputKeys.d) rotSpeed = -2.0;

      boat.rotationY += rotSpeed * dt;
      boat.speed = THREE.MathUtils.lerp(boat.speed, speedTarget, dt * (isInWater ? 3.0 : 5.0));

      const dirX = Math.sin(boat.rotationY);
      const dirZ = Math.cos(boat.rotationY);
      boat.velocity.x = dirX * boat.speed;
      boat.velocity.z = dirZ * boat.speed;
    } else {
      const friction = isInWater ? 0.95 : 0.8;
      boat.velocity.x *= Math.pow(friction, dt * 10);
      boat.velocity.z *= Math.pow(friction, dt * 10);
      boat.speed = new THREE.Vector2(boat.velocity.x, boat.velocity.z).length();
    }

    const prevPos = boat.position.clone();
    boat.position.add(boat.velocity.clone().multiplyScalar(dt));

    const nextX = Math.floor(boat.position.x);
    const nextY = Math.floor(boat.position.y + 0.1);
    const nextZ = Math.floor(boat.position.z);

    if (isSolidBlock(nextX, nextY, nextZ)) {
      boat.position.x = prevPos.x;
      boat.position.z = prevPos.z;
      boat.velocity.x = 0;
      boat.velocity.z = 0;
      boat.speed = 0;
    }
  }

  private updateMinecartPhysics(
    cart: Vehicle,
    dt: number,
    getBlock: (x: number, y: number, z: number) => number,
    isSolidBlock: (x: number, y: number, z: number) => boolean,
    inputKeys: { w: boolean; s: boolean; a: boolean; d: boolean }
  ) {
    const cx = Math.floor(cart.position.x);
    const cy = Math.floor(cart.position.y);
    const cz = Math.floor(cart.position.z);
    const block = getBlock(cx, cy, cz);
    const isUnderRail = BlockRegistry.isRail(block);

    if (isUnderRail) {
      const meta = (block >> 10) & 0xF;
      const baseBlockId = block & 0x3FF;
      const isPowered = baseBlockId === 27;

      const isNS = (meta === 0 || meta === 4 || meta === 5);

      if (isNS) {
        cart.position.x = THREE.MathUtils.lerp(cart.position.x, cx + 0.5, dt * 15);
        cart.rotationY = 0;
      } else {
        cart.position.z = THREE.MathUtils.lerp(cart.position.z, cz + 0.5, dt * 15);
        cart.rotationY = Math.PI / 2;
      }

      let acceleration = 0;
      if (isPowered) {
        acceleration = 12.0;
      } else if (cart.isRidden) {
        if (inputKeys.w) acceleration = 4.0;
        else if (inputKeys.s) acceleration = -4.0;
      }

      const speedLimit = isPowered ? 10.0 : 6.0;
      if (isNS) {
        cart.velocity.x = 0;
        let dir = Math.sign(cart.velocity.z);
        if (dir === 0 && cart.isRidden) {
          dir = inputKeys.w ? 1 : (inputKeys.s ? -1 : 0);
        }
        cart.velocity.z += dir * acceleration * dt;
        const friction = isPowered ? 0.99 : 0.92;
        cart.velocity.z *= Math.pow(friction, dt * 10);
        cart.velocity.z = THREE.MathUtils.clamp(cart.velocity.z, -speedLimit, speedLimit);
      } else {
        cart.velocity.z = 0;
        let dir = Math.sign(cart.velocity.x);
        if (dir === 0 && cart.isRidden) {
          dir = inputKeys.w ? 1 : (inputKeys.s ? -1 : 0);
        }
        cart.velocity.x += dir * acceleration * dt;
        const friction = isPowered ? 0.99 : 0.92;
        cart.velocity.x *= Math.pow(friction, dt * 10);
        cart.velocity.x = THREE.MathUtils.clamp(cart.velocity.x, -speedLimit, speedLimit);
      }

      cart.position.y = cy + 0.05;
      cart.velocity.y = 0;
      cart.position.add(cart.velocity.clone().multiplyScalar(dt));
    } else {
      cart.velocity.y -= 18.0 * dt;
      cart.velocity.x *= Math.pow(0.5, dt * 10);
      cart.velocity.z *= Math.pow(0.5, dt * 10);

      const prevPos = cart.position.clone();
      cart.position.add(cart.velocity.clone().multiplyScalar(dt));
      if (isSolidBlock(Math.floor(cart.position.x), Math.floor(cart.position.y), Math.floor(cart.position.z))) {
        cart.position.copy(prevPos);
        cart.velocity.set(0, 0, 0);
      }
    }
  }

  dispose() {
    for (const vehicle of this.vehicles.values()) {
      vehicle.dispose(this.scene);
    }
    this.vehicles.clear();
  }
}
