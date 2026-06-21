import * as THREE from 'three';

export class Renderer {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  fogNear = 80;
  fogFar = 120;
  private ambientLight: THREE.AmbientLight;
  private sunLight: THREE.DirectionalLight;
  private moonLight: THREE.DirectionalLight;
  private torchLights: THREE.PointLight[] = [];

  // Sky and Cloud systems
  private currentDimension = 0; // Overworld = 0, Nether = 1, End = 2
  private timeOfDay = 0;
  private skyGroup!: THREE.Group;
  private sunMesh!: THREE.Mesh;
  private moonMesh!: THREE.Mesh;
  private sunTexture!: THREE.CanvasTexture;
  private moonTexture!: THREE.CanvasTexture;
  private stars!: THREE.Points;
  private starMaterial!: THREE.PointsMaterial;
  private cloudsMesh!: THREE.InstancedMesh;
  private cloudMaterial!: THREE.MeshBasicMaterial;
  private cloudDriftX = 0;
  private cloudActiveCells: [number, number][] = [];
  private lastT = 0;
  private dayCount = 0;
  private currentMoonPhase = 0;
  private clock = new THREE.Clock();

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB);

    this.camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      500
    );
    this.scene.add(this.camera);

    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene.fog = new THREE.Fog(0x87CEEB, this.fogNear, this.fogFar);

    // Ambient light (base)
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(this.ambientLight);

    // Sun directional light
    this.sunLight = new THREE.DirectionalLight(0xfff5e6, 0.8);
    this.sunLight.position.set(100, 200, 100);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 400;
    
    const d = 60;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    // Moon directional light (dim blue)
    this.moonLight = new THREE.DirectionalLight(0x8888ff, 0.0);
    this.moonLight.position.set(-100, 200, -100);
    this.moonLight.castShadow = true;
    this.moonLight.shadow.mapSize.width = 1024;
    this.moonLight.shadow.mapSize.height = 1024;
    this.moonLight.shadow.camera.near = 0.5;
    this.moonLight.shadow.camera.far = 400;
    this.moonLight.shadow.camera.left = -d;
    this.moonLight.shadow.camera.right = d;
    this.moonLight.shadow.camera.top = d;
    this.moonLight.shadow.camera.bottom = -d;
    this.moonLight.shadow.bias = -0.0005;
    
    this.scene.add(this.moonLight);
    this.scene.add(this.moonLight.target);

    // Torch point light pool (to illuminate entities near torches)
    for (let i = 0; i < 4; i++) {
      const pl = new THREE.PointLight(0xffaa44, 0.0, 15);
      this.scene.add(pl);
      this.torchLights.push(pl);
    }

    // Initialize sky and clouds
    this.initSky();

    window.addEventListener('resize', this.onResize);
  }

  setDimension(dim: number) {
    this.currentDimension = dim;
  }

  private createSunTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d')!;

    // Glow border
    ctx.fillStyle = 'rgba(255, 180, 50, 0.4)';
    ctx.fillRect(1, 1, 14, 14);

    // Sun core
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(3, 3, 10, 10);

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    return texture;
  }

  private createMoonTexture(phase: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillRect(0, 0, 16, 16);

    // Moon body color
    ctx.fillStyle = '#e5eff2';

    // Draw pixelated moon based on phase (0 to 7)
    for (let y = 2; y < 14; y++) {
      for (let x = 2; x < 14; x++) {
        let draw = false;
        const dx = x - 8;
        const dy = y - 8;
        const distSq = dx * dx + dy * dy;

        if (distSq <= 30) { // Circle
          switch (phase) {
            case 0: // Full Moon
              draw = true;
              break;
            case 1: // Waning Gibbous
              draw = (x < 12);
              break;
            case 2: // Last Quarter
              draw = (x <= 8);
              break;
            case 3: // Waning Crescent
              draw = (x <= 6 && x >= 3);
              break;
            case 4: // New Moon
              draw = false;
              break;
            case 5: // Waxing Crescent
              draw = (x >= 10 && x <= 13);
              break;
            case 6: // First Quarter
              draw = (x >= 8);
              break;
            case 7: // Waxing Gibbous
              draw = (x > 4);
              break;
          }
        }

        if (draw) {
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    return texture;
  }

  private updateMoonTexture() {
    if (this.moonTexture) {
      this.moonTexture.dispose();
    }
    this.moonTexture = this.createMoonTexture(this.currentMoonPhase);
    if (this.moonMesh && this.moonMesh.material) {
      (this.moonMesh.material as THREE.MeshBasicMaterial).map = this.moonTexture;
      (this.moonMesh.material as THREE.MeshBasicMaterial).needsUpdate = true;
    }
  }

  private initSky() {
    this.skyGroup = new THREE.Group();
    this.scene.add(this.skyGroup);

    // 1. Sun
    const sunGeo = new THREE.PlaneGeometry(40, 40);
    this.sunTexture = this.createSunTexture();
    const sunMat = new THREE.MeshBasicMaterial({
      map: this.sunTexture,
      transparent: true,
      fog: false,
      side: THREE.DoubleSide
    });
    this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
    this.sunMesh.position.set(400, 0, 100);
    this.sunMesh.lookAt(0, 0, 0);
    this.skyGroup.add(this.sunMesh);

    // 2. Moon
    const moonGeo = new THREE.PlaneGeometry(30, 30);
    this.moonTexture = this.createMoonTexture(this.currentMoonPhase);
    const moonMat = new THREE.MeshBasicMaterial({
      map: this.moonTexture,
      transparent: true,
      fog: false,
      side: THREE.DoubleSide
    });
    this.moonMesh = new THREE.Mesh(moonGeo, moonMat);
    this.moonMesh.position.set(-400, 0, -100);
    this.moonMesh.lookAt(0, 0, 0);
    this.skyGroup.add(this.moonMesh);

    // 3. Stars
    const starCount = 1000;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const radius = 390;

      starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3 + 2] = radius * Math.cos(phi);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    this.starMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.5,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0,
      fog: false
    });
    this.stars = new THREE.Points(starGeo, this.starMaterial);
    this.skyGroup.add(this.stars);

    // 4. Clouds (3D box clouds)
    const gridDim = 64;
    const cellSize = 12;
    const boxGeo = new THREE.BoxGeometry(cellSize, 4, cellSize);

    // Count active cloud cells based on procedural noise
    const activeCells: [number, number][] = [];
    for (let i = 0; i < gridDim; i++) {
      for (let j = 0; j < gridDim; j++) {
        const val =
          Math.sin(i * 0.15) * Math.cos(j * 0.15) +
          Math.sin(i * 0.05 + 1.2) * Math.cos(j * 0.08 + 0.7) * 0.6 +
          Math.sin(i * 0.3) * Math.cos(j * 0.3) * 0.2;
        if (val > 0.1) {
          activeCells.push([i, j]);
        }
      }
    }

    this.cloudMaterial = new THREE.MeshBasicMaterial({
      color: 0xf4fbff,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      fog: false
    });

    this.cloudsMesh = new THREE.InstancedMesh(boxGeo, this.cloudMaterial, activeCells.length);
    this.cloudActiveCells = activeCells;
    this.scene.add(this.cloudsMesh);
  }

  private updateSkyAndClouds(dt: number) {
    if (!this.skyGroup || !this.cloudsMesh) return;

    if (this.currentDimension !== 0) {
      this.skyGroup.visible = false;
      this.cloudsMesh.visible = false;
      return;
    }

    this.skyGroup.visible = true;
    this.cloudsMesh.visible = true;

    // Rotate sky group around Z axis to match day/night cycle
    this.skyGroup.position.copy(this.camera.position);
    const angle = this.timeOfDay * Math.PI * 2;
    this.skyGroup.rotation.set(0, 0, angle);

    // Star opacity based on time of day (dusk to dawn)
    const t = this.timeOfDay;
    let starOpacity = 0;
    if (t > 0.5 && t < 1.0) {
      if (t < 0.55) {
        starOpacity = (t - 0.5) / 0.05;
      } else if (t > 0.95) {
        starOpacity = (1.0 - t) / 0.05;
      } else {
        starOpacity = 1;
      }
    } else if (t >= 0.0 && t < 0.05) {
      starOpacity = (0.05 - t) / 0.05;
    }
    if (this.starMaterial) {
      this.starMaterial.opacity = starOpacity;
    }

    if (this.cloudMaterial) {
      const sunY = Math.sin(t * Math.PI * 2);
      const cloudBrightness = Math.max(0, sunY);
      const cloudDayColor = new THREE.Color(0xf4fbff);
      const cloudSunsetColor = new THREE.Color(0xffd6b0);
      const cloudNightColor = new THREE.Color(0x45506a);
      const cloudColor = cloudBrightness > 0
        ? new THREE.Color().lerpColors(cloudSunsetColor, cloudDayColor, Math.min(1, cloudBrightness / 0.35))
        : cloudNightColor;
      this.cloudMaterial.color.copy(cloudColor);
      this.cloudMaterial.opacity = THREE.MathUtils.lerp(0.42, 0.72, cloudBrightness);
    }

    // Cloud drift and wrapping around player camera horizontally
    this.cloudDriftX += 1.0 * dt;
    const camX = this.camera.position.x;
    const camZ = this.camera.position.z;
    const gridDim = 64;
    const cellSize = 12;
    const totalWidth = gridDim * cellSize;

    for (let k = 0; k < this.cloudActiveCells.length; k++) {
      const [i, j] = this.cloudActiveCells[k];

      let localX = i * cellSize + this.cloudDriftX;
      let relX = (localX - camX) % totalWidth;
      if (relX < -totalWidth / 2) relX += totalWidth;
      if (relX > totalWidth / 2) relX -= totalWidth;
      let worldX = camX + relX;

      let localZ = j * cellSize;
      let relZ = (localZ - camZ) % totalWidth;
      if (relZ < -totalWidth / 2) relZ += totalWidth;
      if (relZ > totalWidth / 2) relZ -= totalWidth;
      let worldZ = camZ + relZ;

      const matrix = new THREE.Matrix4();
      matrix.setPosition(worldX, 160, worldZ);
      this.cloudsMesh.setMatrixAt(k, matrix);
    }
    this.cloudsMesh.instanceMatrix.needsUpdate = true;
  }

  render() {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.updateSkyAndClouds(dt);
    this.renderer.render(this.scene, this.camera);
  }

  updateTorchLights(positions: THREE.Vector3[]) {
    for (let i = 0; i < 4; i++) {
      const light = this.torchLights[i];
      if (positions[i]) {
        light.position.copy(positions[i]);
        light.intensity = 2.5;
      } else {
        light.intensity = 0;
      }
    }
  }

  add(obj: THREE.Object3D) {
    this.scene.add(obj);
  }

  remove(obj: THREE.Object3D) {
    this.scene.remove(obj);
  }

  setTimeOfDay(t: number, lightningOpacity: number = 0) {
    this.timeOfDay = t;

    // Track day count & moon phase updates when timeOfDay wraps around
    if (t < 0.1 && this.lastT > 0.9) {
      this.dayCount++;
      const newPhase = this.dayCount % 8;
      if (newPhase !== this.currentMoonPhase) {
        this.currentMoonPhase = newPhase;
        this.updateMoonTexture();
      }
    }
    this.lastT = t;

    // Dimension Overrides
    if (this.currentDimension === 1) { // Nether
      const skyColor = new THREE.Color(0.12, 0.02, 0.02);
      this.scene.background = skyColor;
      if (this.scene.fog) {
        (this.scene.fog as THREE.Fog).color.copy(skyColor);
        (this.scene.fog as THREE.Fog).near = 15;
        (this.scene.fog as THREE.Fog).far = 45;
      }
      this.ambientLight.intensity = 0.35;
      this.ambientLight.color.setHex(0xff5533);
      this.sunLight.intensity = 0;
      this.moonLight.intensity = 0;
      return;
    }

    if (this.currentDimension === 2) { // End
      const skyColor = new THREE.Color(0.015, 0.005, 0.025);
      this.scene.background = skyColor;
      if (this.scene.fog) {
        (this.scene.fog as THREE.Fog).color.copy(skyColor);
        (this.scene.fog as THREE.Fog).near = 80;
        (this.scene.fog as THREE.Fog).far = 200;
      }
      this.ambientLight.intensity = 0.4;
      this.ambientLight.color.setHex(0xa888ff);
      this.sunLight.intensity = 0;
      this.moonLight.intensity = 0;
      return;
    }

    // t: 0..1 cycle
    // 0.0 = sunrise, 0.25 = noon, 0.5 = sunset, 0.75 = midnight

    // Sun angle
    const sunAngle = t * Math.PI * 2;
    const sunY = Math.sin(sunAngle);
    const sunBrightness = Math.max(0, sunY);

    // Sky color gradient
    const dayColor = new THREE.Color(0.53, 0.81, 0.92);
    const sunsetColor = new THREE.Color(0.95, 0.55, 0.35);
    const nightColor = new THREE.Color(0.003, 0.003, 0.01);

    let skyColor: THREE.Color;
    if (sunBrightness > 0.3) {
      // Daytime
      skyColor = dayColor.clone().multiplyScalar(sunBrightness);
    } else if (sunBrightness > 0) {
      // Sunrise/sunset
      const blend = sunBrightness / 0.3;
      skyColor = new THREE.Color().lerpColors(sunsetColor, dayColor, blend);
    } else {
      // Night
      skyColor = nightColor.clone();
    }

    if (lightningOpacity > 0) {
      const flashSkyColor = new THREE.Color(0xd0e0ff); // Light bluish-white
      skyColor.lerp(flashSkyColor, lightningOpacity * 0.9);
    }

    // Dynamic fog adjustment based on time of day
    // Day: near = 80, far = 120
    // Night: near = 15, far = 40 (hides distant sky/terrain)
    const nightFogFactor = sunY >= 0 ? 0 : -sunY;
    this.fogNear = 80 - nightFogFactor * 65;
    this.fogFar = 120 - nightFogFactor * 80;

    // During lightning flash, increase fog visibility far distance temporarily
    if (lightningOpacity > 0) {
      this.fogNear = THREE.MathUtils.lerp(this.fogNear, 80, lightningOpacity);
      this.fogFar = THREE.MathUtils.lerp(this.fogFar, 120, lightningOpacity);
    }

    this.scene.background = skyColor;
    if (this.scene.fog) {
      (this.scene.fog as THREE.Fog).color.copy(skyColor);
      (this.scene.fog as THREE.Fog).near = this.fogNear;
      (this.scene.fog as THREE.Fog).far = this.fogFar;
    }

    // Ambient light intensity
    let ambientIntensity = 0.03 + sunBrightness * 0.5;
    if (lightningOpacity > 0) {
      ambientIntensity = THREE.MathUtils.lerp(ambientIntensity, 1.2, lightningOpacity);
    }
    this.ambientLight.intensity = ambientIntensity;

    const camX = this.camera.position.x;
    const camY = this.camera.position.y;
    const camZ = this.camera.position.z;

    // Sun light
    this.sunLight.intensity = sunBrightness * 0.8;
    this.sunLight.position.set(
      camX + Math.cos(sunAngle) * 150,
      camY + Math.sin(sunAngle) * 150 + 50,
      camZ + 100
    );
    this.sunLight.target.position.set(camX, camY, camZ);
    this.sunLight.target.updateMatrixWorld();

    // Moon light (active at night)
    const moonBrightness = Math.max(0, -sunY);
    this.moonLight.intensity = moonBrightness * 0.08;
    this.moonLight.position.set(
      camX - Math.cos(sunAngle) * 150,
      camY - Math.sin(sunAngle) * 150 + 50,
      camZ - 100
    );
    this.moonLight.target.position.set(camX, camY, camZ);
    this.moonLight.target.updateMatrixWorld();

    // Tint ambient during sunset/sunrise
    if (sunBrightness > 0 && sunBrightness < 0.4) {
      this.ambientLight.color.setHex(0xffcc88);
    } else if (moonBrightness > 0) {
      this.ambientLight.color.setHex(0x111122);
    } else {
      this.ambientLight.color.setHex(0xffffff);
    }

    if (lightningOpacity > 0) {
      this.ambientLight.color.lerp(new THREE.Color(0xffffff), lightningOpacity);
    }
  }

  private onResize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  dispose() {
    window.removeEventListener('resize', this.onResize);
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }

    // Dispose sky & cloud resources
    if (this.sunTexture) this.sunTexture.dispose();
    if (this.moonTexture) this.moonTexture.dispose();
    if (this.cloudsMesh) {
      this.cloudsMesh.geometry.dispose();
      if (Array.isArray(this.cloudsMesh.material)) {
        this.cloudsMesh.material.forEach((m) => m.dispose());
      } else {
        this.cloudsMesh.material.dispose();
      }
    }
    if (this.skyGroup) {
      this.skyGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        } else if (child instanceof THREE.Points) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }

    this.renderer.dispose();
  }
}
