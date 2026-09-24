import * as THREE from 'three';
import type { Viewer } from '../../core/Viewer';
import type { GridSystem } from '../../core/GridSystem';
import type { LevelSystem } from '../../core/LevelSystem';
import type { PlacementPreview } from '../../tools/PlacementPreview';
import type { SelectionManager } from '../../tools/SelectionManager';
import type { ManagedElement } from '../../tools/structural/types';
import type { Sidebar } from '../sidebar/SidebarController';
import type { FooterStatusBar } from '../footer-status/FooterStatusController';

interface StructuralElementFocusDependencies {
  viewer: Viewer;
  gridSystem: GridSystem;
  levelSystem: LevelSystem;
  preview: PlacementPreview;
  selection: SelectionManager;
  sidebar: Sidebar;
  footer: FooterStatusBar;
  setSelectionTool: () => void;
}

export class StructuralElementFocusController {
  constructor(private readonly deps: StructuralElementFocusDependencies) {}

  public focus(element: ManagedElement): void {
    this.deps.setSelectionTool();
    this.deps.preview.hide();
    this.deps.gridSystem.selectGrid(null);
    this.deps.levelSystem.selectLevel(null);

    this.deps.viewer.viewManager.openView('view-3d');
    const view = this.deps.viewer.viewManager.views.get('view-3d') || this.deps.viewer.viewManager.getActiveView();
    view.modelMode = 'physical';

    element.mesh.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(element.mesh);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z, 2.5);
    const distance = Math.max(maxDimension * 2.8, 10);

    if (view.controls) {
      view.controls.target.copy(center);
      view.camera.position.set(
        center.x + distance * 0.75,
        center.y + distance * 0.65,
        center.z + distance * 0.75,
      );
      view.camera.lookAt(center);
      view.controls.update();
    }

    this.deps.selection.select(element);
    this.deps.sidebar.showElementProperties(element);
    const idText = element.elementId ? `(ID: ${element.elementId})` : '';
    this.deps.footer.setMessage(`Elemento ${element.id} ${idText} enfocado y resaltado en 3D.`);
  }
}
