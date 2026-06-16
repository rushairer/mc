import * as THREE from 'three';

export type WeatherType = 'clear' | 'rain' | 'thunder';

const RAIN_COUNT = 800;
const SNOW_COUNT = 300;

export class WeatherSystem {
  private scene: THREE.Scene;
  private rainParticles: THREE.Points | null = null;
  private snowParticles: THREE.Points | null = null;
  private currentWeather: WeatherType = 'clear';
  private weatherTimer = 0;
  private weatherDuration = 0;
  private transitionTimer = 0;
  private rainIntensity = 0;
  private snowIntensity = 0;
  private lightningTimer = 0;
  private lightningFlash: THREE.Mesh | null = null;
  private ambientLight: THREE.AmbientLight | null = null;

  // Rain geometry
  private rainPositions: Float32Array;
  private rainVelocities: Float32Array;

  // Snow geometry
  private snowPositions: Float32Array;
  private snowVelocities: Float32Array;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Rain
    this.rainPositions = new Float32Array(RAIN_COUNT * 3);
    this.rainVelocities = new Float32Array(RAIN_COUNT);
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));
    const rainMat = new THREE.PointsMaterial({
      color: 0x9999ff,
      size: 0.1,
      transparent: true,
      opacity: 0.6,
    });
    this.rainParticles = new THREE.Points(rainGeo, rainMat);
    this.rainParticles.visible = false;
    this.scene.add(this.rainParticles);

    // Snow
    this.snowPositions = new Float32Array(SNOW_COUNT * 3);
    this.snowVelocities = new Float32Array(SNOW_COUNT);
    const snowGeo = new THREE.BufferGeometry();
    snowGeo.setAttribute('position', new THREE.BufferAttribute(this.snowPositions, 3));
    const snowMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.15,
      transparent: true,
      opacity: 0.8,
    });
    this.snowParticles = new THREE.Points(snowGeo, snowMat);
    this.snowParticles.visible = false;
    this.scene.add(this.snowParticles);

    // Lightning flash plane
    const flashGeo = new THREE.PlaneGeometry(1000, 1000);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.lightningFlash = new THREE.Mesh(flashGeo, flashMat);
    this.lightningFlash.position.y = 200;
    this.lightningFlash.visible = false;
    this.scene.add(this.lightningFlash);

    // Initialize positions
    this.initRain();
    this.initSnow();
  }

  private initRain() {
    for (let i = 0; i < RAIN_COUNT; i++) {
      const i3 = i * 3;
      this.rainPositions[i3] = (Math.random() - 0.5) * 60;
      this.rainPositions[i3 + 1] = Math.random() * 40;
      this.rainPositions[i3 + 2] = (Math.random() - 0.5) * 60;
      this.rainVelocities[i] = 12 + Math.random() * 8;
    }
  }

  private initSnow() {
    for (let i = 0; i < SNOW_COUNT; i++) {
      const i3 = i * 3;
      this.snowPositions[i3] = (Math.random() - 0.5) * 60;
      this.snowPositions[i3 + 1] = Math.random() * 40;
      this.snowPositions[i3 + 2] = (Math.random() - 0.5) * 60;
      this.snowVelocities[i] = 1 + Math.random() * 2;
    }
  }

  update(dt: number, playerPos: THREE.Vector3, isNight: boolean) {
    this.weatherTimer += dt;

    // Change weather periodically
    if (this.weatherTimer > this.weatherDuration) {
      this.weatherTimer = 0;
      this.weatherDuration = 60 + Math.random() * 180; // 1-5 minutes
      const rand = Math.random();
      if (rand < 0.4) {
        this.currentWeather = 'clear';
      } else if (rand < 0.75) {
        this.currentWeather = 'rain';
      } else {
        this.currentWeather = 'thunder';
      }
    }

    // Update rain
    if (this.currentWeather === 'rain' || this.currentWeather === 'thunder') {
      this.rainIntensity = Math.min(1, this.rainIntensity + dt * 0.5);
    } else {
      this.rainIntensity = Math.max(0, this.rainIntensity - dt * 0.3);
    }

    this.rainParticles!.visible = this.rainIntensity > 0.01;
    if (this.rainIntensity > 0.01) {
      (this.rainParticles!.material as THREE.PointsMaterial).opacity = this.rainIntensity * 0.6;
      this.updateRainPositions(dt, playerPos);
    }

    // Update snow (only in cold biomes or at night - simplified: just use snow for thunder)
    this.snowIntensity = 0;
    this.snowParticles!.visible = false;

    // Lightning
    if (this.currentWeather === 'thunder') {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.lightningTimer = 5 + Math.random() * 15;
        this.triggerLightning(playerPos);
      }
    }

    // Update lightning flash fade
    if (this.lightningFlash && this.lightningFlash.visible) {
      const mat = this.lightningFlash.material as THREE.MeshBasicMaterial;
      mat.opacity -= dt * 3;
      if (mat.opacity <= 0) {
        this.lightningFlash.visible = false;
      }
    }
  }

  private updateRainPositions(dt: number, playerPos: THREE.Vector3) {
    for (let i = 0; i < RAIN_COUNT; i++) {
      const i3 = i * 3;
      this.rainPositions[i3 + 1] -= this.rainVelocities[i] * dt;

      // Reset when below player
      if (this.rainPositions[i3 + 1] < playerPos.y - 10) {
        this.rainPositions[i3] = playerPos.x + (Math.random() - 0.5) * 60;
        this.rainPositions[i3 + 1] = playerPos.y + 20 + Math.random() * 20;
        this.rainPositions[i3 + 2] = playerPos.z + (Math.random() - 0.5) * 60;
      }
    }
    (this.rainParticles!.geometry as THREE.BufferGeometry).attributes.position.needsUpdate = true;
  }

  private triggerLightning(playerPos: THREE.Vector3) {
    // Flash
    if (this.lightningFlash) {
      this.lightningFlash.position.set(
        playerPos.x + (Math.random() - 0.5) * 100,
        200,
        playerPos.z + (Math.random() - 0.5) * 100
      );
      this.lightningFlash.visible = true;
      (this.lightningFlash.material as THREE.MeshBasicMaterial).opacity = 0.8;
    }
  }

  getCurrentWeather(): WeatherType {
    return this.currentWeather;
  }

  isRaining(): boolean {
    return this.rainIntensity > 0.1;
  }

  dispose() {
    if (this.rainParticles) {
      this.rainParticles.geometry.dispose();
      (this.rainParticles.material as THREE.Material).dispose();
      this.scene.remove(this.rainParticles);
    }
    if (this.snowParticles) {
      this.snowParticles.geometry.dispose();
      (this.snowParticles.material as THREE.Material).dispose();
      this.scene.remove(this.snowParticles);
    }
    if (this.lightningFlash) {
      this.lightningFlash.geometry.dispose();
      (this.lightningFlash.material as THREE.Material).dispose();
      this.scene.remove(this.lightningFlash);
    }
  }
}
