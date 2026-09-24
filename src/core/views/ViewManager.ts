import * as THREE from 'three';
import { BimView } from './BimView';

export type SplitLayout = 'single' | 'split-v' | 'split-h' | 'grid-4';

export class ViewManager {
  public views = new Map<string, BimView>();
  public activeViewId = 'view-3d';
  public layoutMode: SplitLayout = 'single';
  private container: HTMLElement;
  private rendererDom: HTMLElement;

  // Pestañas abiertas en el workspace (Estándar Revit: solo vistas abiertas explícitamente)
  public openTabIds: string[] = ['view-3d'];

  private onActiveViewChanged?: (view: BimView) => void;
  private onTabsUpdated?: (openViews: BimView[], activeId: string, allViews: BimView[]) => void;
  public onBeforeRenderView?: (view: BimView, scene: THREE.Scene) => void;
  public sceneForView?: (view:BimView)=>THREE.Scene;

  constructor(containerId: string, rendererDom: HTMLElement) {
    this.container = document.getElementById(containerId)!;
    this.rendererDom = rendererDom;
    this.initDefaultViews();
  }

  /**
   * Inicializa la plantilla por defecto estándar de Revit:
   * - Vista 3D: {3D} - Vista General
   * - Planos de planta: 1 solo nivel base Nivel 1 (0.00 m)
   * - Elevaciones: Las 4 cardinales (Norte, Sur, Este, Oeste)
   * - Workspace de pestañas: ÚNICAMENTE {3D} - Vista General abierta al inicio
   */
  public initDefaultViews(): void {
    // Limpiar vistas previas si existiesen
    this.views.forEach(v => v.dispose());
    this.views.clear();

    const defaultViews = [
      { id: 'view-3d', title: '{3D} - Vista General', type: '3d' as const },
      { id: 'plan-lvl-1', title: 'Planta - Nivel 1 (0.00 m)', type: 'plan' as const, level: 0 },
      { id: 'elev-north', title: 'Elevación Norte (Posterior)', type: 'elevation' as const },
      { id: 'elev-south', title: 'Elevación Sur (Frontal)', type: 'elevation' as const },
      { id: 'elev-east', title: 'Elevación Este (Lateral Derecha)', type: 'elevation' as const },
      { id: 'elev-west', title: 'Elevación Oeste (Lateral Izquierda)', type: 'elevation' as const },
    ];

    defaultViews.forEach(v => {
      const view = new BimView(v.id, v.title, v.type, this.container, this.rendererDom, v.level);
      this.views.set(v.id, view);

      view.domElement.addEventListener('pointerdown', () => {
        this.setActiveView(v.id);
      });
    });

    // Solo {3D} abierto en pestañas por defecto
    this.openTabIds = ['view-3d'];
    this.activeViewId = 'view-3d';
    this.setLayout('single');
  }

  public getActiveView(): BimView {
    return this.views.get(this.activeViewId) || this.views.get('view-3d') || this.views.values().next().value!;
  }

  public getActiveCamera(): THREE.Camera {
    return this.getActiveView().camera;
  }

  public getAllViews(): BimView[] {
    return Array.from(this.views.values());
  }

  public getOpenViews(): BimView[] {
    return this.openTabIds
      .map(id => this.views.get(id))
      .filter((v): v is BimView => v !== undefined);
  }

  public setActiveView(id: string): void {
    if (!this.views.has(id)) return;

    // Asegurar que la pestaña esté en openTabIds
    if (!this.openTabIds.includes(id)) {
      this.openTabIds.push(id);
    }

    this.activeViewId = id;
    this.updatePanelClasses();

    const active = this.getActiveView();
    if (this.onActiveViewChanged) this.onActiveViewChanged(active);
    if (this.onTabsUpdated) {
      this.onTabsUpdated(this.getOpenViews(), this.activeViewId, this.getAllViews());
    }
  }

  public setLayout(mode: SplitLayout): void {
    this.layoutMode = mode;
    
    const layoutClasses = {
      'single': 'grid-cols-1 grid-rows-1',
      'split-v': 'grid-cols-2 grid-rows-1',
      'split-h': 'grid-cols-1 grid-rows-2',
      'grid-4': 'grid-cols-2 grid-rows-2',
    };

    this.container.className = `absolute top-8 left-0 right-0 bottom-0 w-full h-[calc(100%-2rem)] grid gap-0.5 bg-transparent pointer-events-none z-10 ${layoutClasses[mode]}`;
    this.updatePanelClasses();
  }

  /**
   * Abre una vista en el workspace de pestañas (Estándar Revit: doble clic en Navegador o clic en menú)
   */
  public openView(id: string): void {
    if (!this.views.has(id)) return;
    if (!this.openTabIds.includes(id)) {
      this.openTabIds.push(id);
    }
    this.setActiveView(id);
    if (this.layoutMode === 'single') {
      this.setLayout('single');
    }
  }

  /**
   * Cierra una pestaña abierta en el workspace (no elimina la vista del proyecto)
   */
  public closeTab(id: string): void {
    if (!this.openTabIds.includes(id)) return;

    // Mantener al menos una pestaña abierta
    if (this.openTabIds.length <= 1) {
      if (id !== 'view-3d' && this.views.has('view-3d')) {
        this.openTabIds = ['view-3d'];
        this.setActiveView('view-3d');
      }
      return;
    }

    const idx = this.openTabIds.indexOf(id);
    this.openTabIds.splice(idx, 1);

    if (this.activeViewId === id) {
      const nextId = this.openTabIds[Math.max(0, idx - 1)] || this.openTabIds[0];
      this.setActiveView(nextId);
    } else {
      this.updatePanelClasses();
      if (this.onTabsUpdated) {
        this.onTabsUpdated(this.getOpenViews(), this.activeViewId, this.getAllViews());
      }
    }
  }

  /**
   * Cierra todas las pestañas excepto la especificada
   */
  public closeOtherTabs(keepId: string): void {
    if (!this.views.has(keepId)) return;
    this.openTabIds = [keepId];
    this.setActiveView(keepId);
  }

  /**
   * Restablece las pestañas abiertas a solo la vista {3D}
   */
  public closeAllTabs(): void {
    if (this.views.has('view-3d')) {
      this.openTabIds = ['view-3d'];
      this.setActiveView('view-3d');
    }
  }

  /**
   * Sincroniza las vistas de plano asociadas con los niveles BIM creados.
   * Regla Revit: NO abre pestañas automáticamente para todas las vistas creadas en lote.
   * Solo registra las vistas para que estén disponibles en el Navegador de Proyectos.
   */
  public syncPlanViews(levels: { id: string; name: string; elevation: number; hasPlanView?: boolean }[]): void {
    const validPlanIds = new Set<string>();

    levels.forEach((lvl, idx) => {
      if (lvl.hasPlanView === false) return;
      const viewId = `plan-${lvl.id || idx}`;
      validPlanIds.add(viewId);

      const sign = lvl.elevation >= 0 ? '+' : '';
      const formattedElev = `${sign}${lvl.elevation.toFixed(2)}m`;
      const cleanName = lvl.name.split('(')[0].trim();
      const title = `Planta - ${cleanName} (${formattedElev})`;

      if (!this.views.has(viewId)) {
        const newView = new BimView(viewId, title, 'plan', this.container, this.rendererDom, idx);
        this.views.set(viewId, newView);
        newView.domElement.addEventListener('pointerdown', () => {
          this.setActiveView(viewId);
        });
      } else {
        const existing = this.views.get(viewId)!;
        existing.title = title;
        existing.titleSpan.textContent = title;
      }
    });

    // Eliminar planos de planta cuyos niveles hayan sido borrados
    this.views.forEach((v, id) => {
      if (v.type === 'plan' && !validPlanIds.has(id) && id !== 'plan-lvl-1' && !id.startsWith('dual-')) {
        v.dispose();
        this.views.delete(id);
        this.openTabIds = this.openTabIds.filter(tabId => tabId !== id);
      }
    });

    // Si la vista activa fue eliminada, cambiar a una válida
    if (!this.views.has(this.activeViewId)) {
      const fallbackId = this.openTabIds[0] || 'view-3d';
      this.setActiveView(fallbackId);
    } else {
      this.updatePanelClasses();
      if (this.onTabsUpdated) {
        this.onTabsUpdated(this.getOpenViews(), this.activeViewId, this.getAllViews());
      }
    }
  }

  private updatePanelClasses(): void {
    const openViews = this.getOpenViews();
    const openIds = new Set(this.openTabIds);

    this.views.forEach(v => {
      const isActive = v.id === this.activeViewId;

      v.domElement.classList.toggle('border-sky-400', isActive);
      v.domElement.classList.toggle('ring-1', isActive);
      v.domElement.classList.toggle('ring-sky-400', isActive);
      v.domElement.classList.toggle('border-white/10', !isActive);

      v.titleSpan.classList.toggle('text-sky-400', isActive);
      v.titleSpan.classList.toggle('font-semibold', isActive);

      if (this.layoutMode === 'single') {
        v.domElement.style.display = isActive ? 'flex' : 'none';
      } else if (this.layoutMode === 'split-v' || this.layoutMode === 'split-h') {
        // En split, mostrar la vista activa y la anterior o siguiente abierta
        const otherOpen = this.openTabIds.find(id => id !== this.activeViewId) || 'view-3d';
        const isVisible = (v.id === this.activeViewId || v.id === otherOpen) && openIds.has(v.id);
        v.domElement.style.display = isVisible ? 'flex' : 'none';
      } else {
        // En grid 4, mostrar hasta 4 pestañas abiertas
        const isVisible = this.openTabIds.slice(0, 4).includes(v.id);
        v.domElement.style.display = isVisible ? 'flex' : 'none';
      }
    });
  }

  public setCallbacks(
    onActiveViewChanged: (view: BimView) => void,
    onTabsUpdated: (openViews: BimView[], activeId: string, allViews: BimView[]) => void
  ): void {
    this.onActiveViewChanged = onActiveViewChanged;
    this.onTabsUpdated = onTabsUpdated;
    this.onTabsUpdated(this.getOpenViews(), this.activeViewId, this.getAllViews());
  }

  public renderViewports(renderer: THREE.WebGLRenderer, scene: THREE.Scene): void {
    const containerRect = this.container.getBoundingClientRect();
    if (containerRect.width <= 0 || containerRect.height <= 0) return;

    const canvasSize = renderer.getSize(new THREE.Vector2());
    if (Math.abs(canvasSize.x - containerRect.width) > 1 || Math.abs(canvasSize.y - containerRect.height) > 1) {
      renderer.setSize(containerRect.width, containerRect.height);
    }

    renderer.setScissorTest(false);
    renderer.clear();
    renderer.setScissorTest(true);

    this.views.forEach(view => {
      if (view.domElement.style.display === 'none') return;

      const rect = view.domElement.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const left = rect.left - containerRect.left;
      const bottom = containerRect.bottom - rect.bottom;

      if (width <= 0 || height <= 0) return;

      if (this.onBeforeRenderView) {
        this.onBeforeRenderView(view, scene);
      }

      view.updateProjection(width, height);
      view.controls.update();

      renderer.setViewport(left, bottom, width, height);
      renderer.setScissor(left, bottom, width, height);
      renderer.render(this.sceneForView?.(view)||scene, view.camera);
    });
  }

  public dispose(): void {
    this.views.forEach(view => view.dispose());
    this.views.clear();
    this.openTabIds = [];
    this.onActiveViewChanged = undefined;
    this.onTabsUpdated = undefined;
    this.onBeforeRenderView = undefined;
    this.sceneForView = undefined;
    this.container.replaceChildren();
  }
}

export default ViewManager;
