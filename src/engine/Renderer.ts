import * as THREE from 'three';
import { WORLD_HEIGHT } from '../constants';

export class Renderer {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  fogNear = 80;
  fogFar = 120;

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB);

    this.camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      500
    );

    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    this.scene.fog = new THREE.Fog(0x87CEEB, this.fogNear, this.fogFar);

    // ambient + directional light
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 0.8);
    sun.position.set(100, 200, 100);
    this.scene.add(sun);

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
    // t: 0..1, 0 = noon, 0.5 = midnight
    const dayBrightness = Math.cos(t * Math.PI * 2) * 0.5 + 0.5;
    const skyR = 0.53 * dayBrightness;
    const skyG = 0.81 * dayBrightness;
    const skyB = 0.92 * dayBrightness;
    const skyColor = new THREE.Color(skyR, skyG, skyB);
    this.scene.background = skyColor;
    if (this.scene.fog) {
      (this.scene.fog as THREE.Fog).color = skyColor;
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
    this.renderer.dispose();
  }
}
