import * as THREE from 'three';
import type { GridSystem } from '../../core/GridSystem';
import type { LevelSystem } from '../../core/LevelSystem';
import type { Viewer } from '../../core/Viewer';
import type { BimView } from '../../core/views/BimView';
import type { SelectionManager } from '../../tools/SelectionManager';
import type { GripManager } from '../../tools/structural/GripManager';
import type { Sidebar } from '../sidebar/SidebarController';
import type { FooterStatusBar } from '../footer-status/FooterStatusController';

export type StructuralGripPointerMoveResult = 'dragging' | 'hovering' | 'none';

export class StructuralGripInteractionController {
  constructor(
    private viewer: Viewer,
    private gripManager: GripManager,
    private gridSystem: GridSystem,
    private levelSystem: LevelSystem,
    private selection: SelectionManager,
    private sidebar: Sidebar,
    private footer: FooterStatusBar,
  ) {}

  public handlePointerDown(event: PointerEvent, activeView: BimView, raycaster: THREE.Raycaster): boolean {
    if (this.isUiTarget(event.target) || !this.isInsideView(event, activeView)) return false;

    const rect = activeView.domElement.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    ), activeView.camera);

    const gripHit = this.gripManager.testPointerIntersection(event);
    if (!gripHit || !this.gripManager.startDrag(gripHit, event)) return false;

    if (activeView.controls) activeView.controls.enabled = false;
    const gripType = (gripHit.userData?.gripType || 'control') as string;
    this.footer.setMessage(`Arrastrando Grip ${gripType.toUpperCase()} en ${this.selection.selectedElement?.id || 'elemento'}`);
    event.stopPropagation();
    return true;
  }

  public handlePointerMove(event: PointerEvent): StructuralGripPointerMoveResult {
    if (this.gripManager.isDragging) {
      this.gripManager.updateDrag(
        event,
        this.gridSystem.getGridX(),
        this.gridSystem.getGridZ(),
        this.levelSystem.getLevels().map(level => level.elevation),
      );
      this.selection.refreshHighlight();
      return 'dragging';
    }

    if (!this.gripManager.testPointerIntersection(event)) return 'none';
    document.body.style.cursor = 'crosshair';
    return 'hovering';
  }

  public handlePointerUp(): void {
    if (!this.gripManager.isDragging) return;
    this.gripManager.endDrag();
    const activeView = this.viewer.viewManager.getActiveView();
    if (activeView?.controls) activeView.controls.enabled = true;
    this.refreshSelection();
  }

  public cancelDrag(): void {
    if (!this.gripManager.isDragging) return;
    this.gripManager.cancelDrag();
    const activeView = this.viewer.viewManager.getActiveView();
    if (activeView) activeView.controls.enabled = true;
    this.refreshSelection();
  }

  private refreshSelection(): void {
    this.selection.refreshHighlight();
    if (this.selection.selectedElement) this.sidebar.showElementProperties(this.selection.selectedElement);
  }

  private isInsideView(event: MouseEvent, view: BimView): boolean {
    const rect = view.domElement.getBoundingClientRect();
    return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
  }

  private isUiTarget(target: EventTarget | null): boolean {
    return typeof HTMLElement !== 'undefined' && target instanceof HTMLElement && Boolean(target.closest('#app-header, #app-sidebar, #view-tabs-bar, #app-footer, .view-panel-header'));
  }
}
