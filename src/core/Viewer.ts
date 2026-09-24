import * as THREE from 'three';
import { THEME } from '../config/theme.config';
import { ViewManager } from './views/ViewManager';

export class Viewer {
  public scene: THREE.Scene;
  public renderer: THREE.WebGLRenderer;
  public viewManager!: ViewManager;
  
  private ambientLight!: THREE.AmbientLight;
  private hemiLight!: THREE.HemisphereLight;
  private dirLight!: THREE.DirectionalLight;

  private onFpsUpdate?: (fps: number) => void;
  private frames = 0;
  private lastTime = performance.now();
  private animationFrame: number | null = null;
  private resizeTimeout: ReturnType<typeof setTimeout> | null = null;
  private resizeHandler: (() => void) | null = null;
  private disposed = false;

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(THEME.viewport.background);

    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      powerPreference: 'high-performance',
      logarithmicDepthBuffer: false 
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const canvasContainer = document.getElementById('canvas-container')!;
    canvasContainer.appendChild(this.renderer.domElement);

    this.viewManager = new ViewManager('viewports-container', this.renderer.domElement);

    this.initLights();
    this.initResizeListener();
    this.startLoop();
  }

  private initLights(): void {
    this.ambientLight = new THREE.AmbientLight(THEME.lights.ambient, 0.85);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(THEME.lights.hemiSky, THEME.lights.hemiGround, 0.5);
    this.hemiLight.position.set(0, 50, 0);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(THEME.lights.directional, 1.2);
    this.dirLight.position.set(30, 60, 30);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(2048, 2048);
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 150;
    this.dirLight.shadow.bias = -0.0005;
    this.dirLight.shadow.normalBias = 0.02;
    this.scene.add(this.dirLight);
  }

  public setBackground(color: number): void {
    this.scene.background = new THREE.Color(color);
  }

  public configureLighting(mode: 'shaded' | 'flat'): void {
    if (mode === 'flat') {
      this.ambientLight.intensity = 1.0;
      this.dirLight.castShadow = false;
      this.hemiLight.intensity = 0.2;
    } else {
      this.ambientLight.intensity = 0.85;
      this.dirLight.castShadow = true;
      this.hemiLight.intensity = 0.5;
    }
  }

  private initResizeListener(): void {
    const resize = () => {
      if (this.disposed) return;
      const container = document.getElementById('viewports-container');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      this.renderer.setSize(rect.width, rect.height);
    };
    this.resizeHandler = resize;
    window.addEventListener('resize', resize);
    this.resizeTimeout = setTimeout(() => {
      this.resizeTimeout = null;
      resize();
    }, 100);
  }

  public setFpsCallback(cb: (fps: number) => void): void {
    this.onFpsUpdate = cb;
  }

  private startLoop(): void {
    const animate = () => {
      if (this.disposed) return;
      this.animationFrame = requestAnimationFrame(animate);
      this.viewManager.renderViewports(this.renderer, this.scene);
      
      this.frames++;
      const now = performance.now();
      if (now >= this.lastTime + 1000) {
        if (this.onFpsUpdate) this.onFpsUpdate(this.frames);
        this.frames = 0;
        this.lastTime = now;
      }
    };
    animate();
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.animationFrame !== null) cancelAnimationFrame(this.animationFrame);
    if (this.resizeTimeout !== null) clearTimeout(this.resizeTimeout);
    if (this.resizeHandler) window.removeEventListener('resize', this.resizeHandler);
    this.viewManager.dispose();

    const geometries = new Set<THREE.BufferGeometry>();
    const disposedMaterials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    this.scene.traverse(object => {
      const renderable = object as THREE.Object3D & { geometry?: THREE.BufferGeometry; material?: THREE.Material | THREE.Material[] };
      if (renderable.geometry) geometries.add(renderable.geometry);
      const materials = renderable.material ? (Array.isArray(renderable.material) ? renderable.material : [renderable.material]) : [];
      materials.forEach(material => {
        if (disposedMaterials.has(material)) return;
        disposedMaterials.add(material);
        Object.values(material).forEach(value => {
          if (value instanceof THREE.Texture) textures.add(value);
        });
      });
    });
    geometries.forEach(geometry => geometry.dispose());
    disposedMaterials.forEach(material => material.dispose());
    textures.forEach(texture => texture.dispose());
    this.scene.clear();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.onFpsUpdate = undefined;
  }
}

export default Viewer;
