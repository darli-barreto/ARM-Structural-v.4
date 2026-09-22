import * as THREE from 'three';
import { ManagedElement } from '../tools/structural/types';
import { ElementRegistry } from '../tools/structural/ElementRegistry';
import { THEME } from '../config/theme.config';
import { DIMENSIONS } from '../config/dimensions.config';
import { BimView } from '../core/views/BimView';

export class SelectionManager {
  public pickOverride?: (event:MouseEvent)=>ManagedElement|null|undefined;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();

  public selectedElement: ManagedElement | null = null;
  public highlightOpacity=.45;
  public hoveredElement: ManagedElement | null = null;

  private selectionBox: THREE.BoxHelper | null = null;
  private selectionMesh: THREE.Mesh | null = null;
  private hoverBox: THREE.BoxHelper | null = null;

  constructor(
    private scene: THREE.Scene,
    private activeViewGetter: () => BimView,
    private registry: ElementRegistry,
    private onSelectionChanged: (element: ManagedElement | null) => void
  ) {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.clearSelection();
        this.clearHover();
      }
    });
  }

  private updateRaycaster(event: MouseEvent): boolean {
    const activeView = this.activeViewGetter();
    const rect = activeView.domElement.getBoundingClientRect();

    if (
      event.clientX < rect.left || event.clientX > rect.right ||
      event.clientY < rect.top || event.clientY > rect.bottom
    ) {
      return false;
    }

    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, activeView.camera);
    return true;
  }

  public handlePointerMove(event: MouseEvent): void {
    if(this.activeViewGetter().modelMode==='analytical'){this.clearHover();return;}
    if (this.isOverUI(event) || !this.updateRaycaster(event)) {
      this.clearHover();
      return;
    }

    const meshes = this.registry.getMeshes();
    this.raycaster.params.Line = { threshold: 0.25 };
    const intersects = this.raycaster.intersectObjects(meshes, true);

    for (const hit of intersects) {
      const obj = hit.object;
      const mesh = (obj instanceof THREE.Mesh ? obj : (obj.parent instanceof THREE.Mesh ? obj.parent : null));
      if (mesh) {
        const element = this.registry.findByMesh(mesh);
        if (element) {
          if (this.selectedElement === element) {
            this.clearHover();
            document.body.style.cursor = 'pointer';
            return;
          }

          if (this.hoveredElement !== element) {
            this.hoveredElement = element;
            this.updateHoverHighlight(element.mesh);
          }
          document.body.style.cursor = 'pointer';
          return;
        }
      }
    }

    this.clearHover();
  }

  public handlePointerClick(event: MouseEvent): boolean {
    if (this.isOverUI(event) || !this.updateRaycaster(event)) return false;
    const override=this.pickOverride?.(event);
    if(override!==undefined){if(override){this.select(override);return true;}return false;}

    const meshes = this.registry.getMeshes();
    this.raycaster.params.Line = { threshold: 0.25 };
    const intersects = this.raycaster.intersectObjects(meshes, true);

    for (const hit of intersects) {
      const obj = hit.object;
      const mesh = (obj instanceof THREE.Mesh ? obj : (obj.parent instanceof THREE.Mesh ? obj.parent : null));
      if (mesh) {
        const element = this.registry.findByMesh(mesh);
        if (element) {
          this.clearHover();
          this.select(element);
          return true;
        }
      }
    }

    return false;
  }

  public select(element: ManagedElement): void {
    this.clearHover();
    this.selectedElement = element;
    this.updateSelectionHighlight(element.mesh);
    this.onSelectionChanged(element);
  }

  public clearSelection(): void {
    if (this.selectionBox) {
      this.scene.remove(this.selectionBox);
      this.selectionBox.geometry.dispose();
      this.selectionBox = null;
    }
    if (this.selectionMesh) {
      this.scene.remove(this.selectionMesh);
      this.selectionMesh.geometry.dispose();
      if (Array.isArray(this.selectionMesh.material)) {
        this.selectionMesh.material.forEach(m => m.dispose());
      } else if (this.selectionMesh.material) {
        (this.selectionMesh.material as THREE.Material).dispose();
      }
      this.selectionMesh = null;
    }
    this.selectedElement = null;
    this.onSelectionChanged(null);
  }

  public clearHover(): void {
    if (this.hoverBox) {
      this.scene.remove(this.hoverBox);
      this.hoverBox.geometry.dispose();
      this.hoverBox = null;
    }
    if (this.hoveredElement) {
      this.hoveredElement = null;
      document.body.style.cursor = 'default';
    }
  }

  private updateHoverHighlight(mesh: THREE.Mesh): void {
    if (this.hoverBox) {
      this.scene.remove(this.hoverBox);
      this.hoverBox.geometry.dispose();
      this.hoverBox = null;
    }
    this.hoverBox = new THREE.BoxHelper(mesh, THEME.selection.hoverBox);
    const mat = this.hoverBox.material as THREE.LineBasicMaterial;
    mat.depthTest = false;
    this.hoverBox.renderOrder = DIMENSIONS.renderOrders.selectionHover;
    this.scene.add(this.hoverBox);
  }

  private updateSelectionHighlight(mesh: THREE.Mesh): void {
    if (this.selectionBox) {
      this.scene.remove(this.selectionBox);
      this.selectionBox.geometry.dispose();
      this.selectionBox = null;
    }
    if (this.selectionMesh) {
      this.scene.remove(this.selectionMesh);
      this.selectionMesh.geometry.dispose();
      if (Array.isArray(this.selectionMesh.material)) {
        this.selectionMesh.material.forEach(m => m.dispose());
      } else if (this.selectionMesh.material) {
        (this.selectionMesh.material as THREE.Material).dispose();
      }
      this.selectionMesh = null;
    }

    mesh.updateMatrixWorld(true);

    // 1. Caja perimetral 3D en cian eléctrico nítido
    this.selectionBox = new THREE.BoxHelper(mesh, THEME.selection.selectionBox);
    const mat = this.selectionBox.material as THREE.LineBasicMaterial;
    mat.depthTest = false;
    mat.depthWrite = false;
    mat.transparent = true;
    mat.opacity = 1.0;
    this.selectionBox.renderOrder = DIMENSIONS.renderOrders.selectionBox;
    this.selectionBox.update();
    this.scene.add(this.selectionBox);

    // 2. Malla volumétrica translúcida Revit-style que ilumina todo el elemento en 3D
    try {
      const highlightGeo = mesh.geometry.clone();
      const highlightMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: this.highlightOpacity,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      this.selectionMesh = new THREE.Mesh(highlightGeo, highlightMat);
      this.selectionMesh.position.copy(mesh.position);
      this.selectionMesh.rotation.copy(mesh.rotation);
      this.selectionMesh.scale.copy(mesh.scale);
      this.selectionMesh.matrixAutoUpdate = false;
      this.selectionMesh.matrix.copy(mesh.matrix);
      this.selectionMesh.matrixWorld.copy(mesh.matrixWorld);
      this.selectionMesh.renderOrder = 9999;
      this.scene.add(this.selectionMesh);
    } catch {
      // Si la geometría no se puede clonar directamente, se mantiene el BoxHelper
    }
  }

  public refreshHighlight(): void {
    if (this.selectedElement) {
      this.updateSelectionHighlight(this.selectedElement.mesh);
    }
  }

  private isOverUI(event: MouseEvent): boolean {
    const target = event.target as HTMLElement;
    return !!(
      target.closest('#app-header') ||
      target.closest('#app-sidebar') ||
      target.closest('#view-tabs-bar') ||
      target.closest('.view-panel-header') ||
      target.closest('#app-footer')
    );
  }
}
