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
    this.renderer.shadowMap.enabled = false;
    container.appendChild(this.renderer.domElement);

    this.scene.fog = new THREE.Fog(0x87CEEB, this.fogNear, this.fogFar);

    // Ambient light (base)
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(this.ambientLight);

    // Sun directional light
    this.sunLight = new THREE.DirectionalLight(0xfff5e6, 0.8);
    this.sunLight.position.set(100, 200, 100);
    this.scene.add(this.sunLight);

    // Moon directional light (dim blue)
    this.moonLight = new THREE.DirectionalLight(0x8888ff, 0.0);
    this.moonLight.position.set(-100, 200, -100);
    this.scene.add(this.moonLight);

    window.addEventListener('resize', this.onResize);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  add(obj: THREE.Object3D) {
    this.scene.add(obj);
  }

  remove(obj: THREE.Object3D) {
    this.scene.remove(obj);
  }

  setTimeOfDay(t: number) {
    // t: 0..1 cycle
    // 0.0 = sunrise, 0.25 = noon, 0.5 = sunset, 0.75 = midnight

    // Sun angle
    const sunAngle = t * Math.PI * 2;
    const sunY = Math.sin(sunAngle);
    const sunBrightness = Math.max(0, sunY);

    // Sky color gradient
    const dayColor = new THREE.Color(0.53, 0.81, 0.92);
    const sunsetColor = new THREE.Color(0.95, 0.55, 0.35);
    const nightColor = new THREE.Color(0.05, 0.05, 0.15);

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

    this.scene.background = skyColor;
    if (this.scene.fog) {
      (this.scene.fog as THREE.Fog).color.copy(skyColor);
    }

    // Ambient light intensity
    const ambientIntensity = 0.1 + sunBrightness * 0.5;
    this.ambientLight.intensity = ambientIntensity;

    // Sun light
    this.sunLight.intensity = sunBrightness * 0.8;
    this.sunLight.position.set(
      Math.cos(sunAngle) * 200,
      Math.sin(sunAngle) * 200 + 50,
      100
    );

    // Moon light (active at night)
    const moonBrightness = Math.max(0, -sunY);
    this.moonLight.intensity = moonBrightness * 0.15;

    // Tint ambient during sunset/sunrise
    if (sunBrightness > 0 && sunBrightness < 0.4) {
      this.ambientLight.color.setHex(0xffcc88);
    } else if (moonBrightness > 0) {
      this.ambientLight.color.setHex(0x6666aa);
    } else {
      this.ambientLight.color.setHex(0xffffff);
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
    this.renderer.dispose();
  }
}
