import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type ViewType = '3d' | 'plan' | 'elevation';

export class BimView {
  public modelMode:'physical'|'analytical'='physical';
  public camera: THREE.Camera;
  public controls: OrbitControls;
  public domElement: HTMLElement;
  public titleSpan: HTMLElement;
  public frustumSize = 36;

  constructor(
    public id: string,
    public title: string,
    public type: ViewType,
    domContainer: HTMLElement,
    _rendererDom: HTMLElement,
    public levelIndex = 0
  ) {
    // CORREGIDO: w-full h-full min-h-0 min-w-0 para forzar a que ocupe todo el espacio vertical del Grid
    this.domElement = document.createElement('div');
    this.domElement.id = `viewport-${id}`;
    this.domElement.setAttribute('role', 'tabpanel');
    this.domElement.setAttribute('aria-labelledby', `view-tab-${id}`);
    this.domElement.className = 'h-full w-full relative flex flex-col w-full h-full min-h-0 min-w-0 bg-transparent border border-white/10 overflow-hidden pointer-events-auto transition-all';
    this.domElement.dataset.viewId = id;

    // Header del Viewport (h-6 = 24px, shrink-0 para que no se aplaste)
    const header = document.createElement('div');
    header.className = 'view-panel-header h-6 shrink-0 bg-slate-900/85 border-b border-white/10 flex items-center px-2 text-[11px] text-slate-400 backdrop-blur select-none z-5';
    header.innerHTML = `<span class="view-panel-title">${this.getIcon()} ${this.title}</span>`;
    this.domElement.appendChild(header);
    this.titleSpan = header.querySelector('.view-panel-title')!;

    // Contenedor interno que garantiza el 100% de la altura restante
    const viewContent = document.createElement('div');
    viewContent.className = 'view-panel-content flex-1 w-full h-full min-h-0 pointer-events-auto';
    this.domElement.appendChild(viewContent);

    domContainer.appendChild(this.domElement);

    if (this.type === '3d') {
      this.camera = new THREE.PerspectiveCamera(50, 1, 0.5, 500);
      this.camera.position.set(26, 24, 30);
      this.controls = new OrbitControls(this.camera, this.domElement);
      this.controls.enableDamping = true;
      this.controls.target.set(0, 7, 0);
    } else if (this.type === 'plan') {
      this.camera = new THREE.OrthographicCamera(-18, 18, 18, -18, 0.1, 500);
      this.camera.position.set(0, 100, 0);
      this.camera.up.set(0, 0, -1);
      this.controls = new OrbitControls(this.camera, this.domElement);
      this.controls.enableRotate = false;
      this.controls.enableDamping = true;
      this.controls.target.set(0, 0, 0);
    } else {
      this.camera = new THREE.OrthographicCamera(-18, 18, 18, -18, 0.1, 500);
      if (this.id === 'elev-east') {
        this.camera.position.set(80, 8.75, 0);
        this.controls = new OrbitControls(this.camera, this.domElement);
        this.controls.target.set(0, 8.75, 0);
      } else if (this.id === 'elev-west') {
        this.camera.position.set(-80, 8.75, 0);
        this.controls = new OrbitControls(this.camera, this.domElement);
        this.controls.target.set(0, 8.75, 0);
      } else if (this.id === 'elev-north') {
        this.camera.position.set(0, 8.75, -80);
        this.controls = new OrbitControls(this.camera, this.domElement);
        this.controls.target.set(0, 8.75, 0);
      } else {
        // elev-south (Frontal por defecto)
        this.camera.position.set(0, 8.75, 80);
        this.controls = new OrbitControls(this.camera, this.domElement);
        this.controls.target.set(0, 8.75, 0);
      }
      this.controls.enableRotate = false;
      this.controls.enableDamping = true;
    }
  }

  public updateProjection(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    const aspect = width / height;

    if (this.camera instanceof THREE.PerspectiveCamera) {
      this.camera.aspect = aspect;
      // Preserve horizontal framing when a viewport becomes portrait or narrowly split.
      this.camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(25)) / Math.min(1, aspect)));
      this.camera.updateProjectionMatrix();
    } else if (this.camera instanceof THREE.OrthographicCamera) {
      const h = this.frustumSize / 2;
      const w = h * aspect;
      this.camera.left = -w;
      this.camera.right = w;
      this.camera.top = h;
      this.camera.bottom = -h;
      this.camera.updateProjectionMatrix();
    }
  }

  public dispose(): void {
    this.controls.dispose();
    this.domElement.remove();
  }

  private getIcon(): string {
    switch (this.type) {
      case '3d': return '🧊';
      case 'plan': return '📐';
      case 'elevation': return '🏛️';
    }
  }
}

export default BimView;
