import * as THREE from 'three';
import { LEVELS_Y } from '../../config/structural.config';
import type { GridSystem } from '../../core/GridSystem';
import type { LevelSystem } from '../../core/LevelSystem';
import type { Viewer } from '../../core/Viewer';
import type { BimView } from '../../core/views/BimView';
import type { FooterStatusBar } from '../footer-status/FooterStatusController';
import type { Sidebar } from '../sidebar/SidebarController';
import type { SelectionManager } from '../../tools/SelectionManager';
import type { ToolType } from '../../config/structural.config';
import { DatumInlineEditController } from './DatumInlineEditController';

export class DatumInteractionController {
  private raycaster = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private planePoint = new THREE.Vector3();
  private inlineEditController: DatumInlineEditController;

  constructor(
    private viewer: Viewer,
    private gridSystem: GridSystem,
    private levelSystem: LevelSystem,
    private selection: SelectionManager,
    private sidebar: Sidebar,
    private footer: FooterStatusBar,
    private updateRibbonLevelSelector: () => void,
    private getActiveTool: () => ToolType,
    private setCursor: (cursor: string) => void = cursor => { document.body.style.cursor = cursor; },
  ) {
    this.inlineEditController = new DatumInlineEditController(
      this.viewer,
      this.gridSystem,
      this.levelSystem,
      this.sidebar,
      this.footer,
      this.updateRibbonLevelSelector,
      this.raycaster,
      (event, view) => this.isInsideView(event, view),
      (event, view, raycaster) => this.setRay(event, view, raycaster),
    );
  }

  public handlePointerDown(event: PointerEvent, activeView: BimView, raycaster: THREE.Raycaster): void {
    if (activeView.type === 'elevation' || activeView.type === '3d') {
      const elbowHits = raycaster.intersectObjects(this.levelSystem.elbowGrips.map(grip => grip.mesh));
      if (elbowHits.length) {
        const data = elbowHits[0].object.userData as { levelId: string; end: 'start' | 'end' };
        if (data) {
          this.levelSystem.startElbowDrag(data.levelId, data.end);
          this.footer.setMessage('Arrastrando codo de nivel (Ajuste de altura del quiebre activo)');
          event.stopPropagation();
          return;
        }
      }

      const gripHits = raycaster.intersectObjects(this.levelSystem.grips.map(grip => grip.mesh));
      if (gripHits.length) {
        const data = gripHits[0].object.userData as { levelId: string; end: 'start' | 'end' };
        if (data) {
          this.levelSystem.startGripDrag(data.levelId, data.end);
          this.footer.setMessage('Arrastrando extremo de nivel (Ajuste de longitud activo)');
          event.stopPropagation();
        }
      }
      return;
    }

    if (activeView.type !== 'plan') return;

    const elbowHits = raycaster.intersectObjects(this.gridSystem.elbowGrips.map(grip => grip.mesh));
    if (elbowHits.length) {
      const data = elbowHits[0].object.userData as { gridId: string; end: 'start' | 'end' };
      if (data) {
        this.gridSystem.startElbowDrag(data.gridId, data.end);
        this.footer.setMessage('Arrastrando codo de rejilla (Ajuste lateral paramétrico activo)');
        event.stopPropagation();
        return;
      }
    }

    const gripHits = raycaster.intersectObjects(this.gridSystem.gripHandles.map(grip => grip.mesh));
    if (gripHits.length) {
      const data = gripHits[0].object.userData as { gridId: string; end: 'start' | 'end' };
      if (data) {
        this.gridSystem.startGripDrag(data.gridId, data.end);
        this.footer.setMessage('Arrastrando extremo de rejilla (Ajuste grupal de alineación activo)');
        event.stopPropagation();
      }
    }
  }

  public handlePointerMove(event: PointerEvent): boolean {
    if (this.levelSystem.isDraggingGrip) {
      const point = this.getElevationPlaneIntersection(event);
      if (point) this.levelSystem.updateGripDrag(point);
      return true;
    }
    if (this.levelSystem.isDraggingElbowGrip) {
      const point = this.getElevationPlaneIntersection(event);
      if (point) this.levelSystem.updateElbowDrag(point);
      return true;
    }
    if (this.gridSystem.isDraggingGrip) {
      const point = this.getPlaneIntersection(event);
      if (point) this.gridSystem.updateGripDrag({ x: point.x, z: point.y });
      return true;
    }
    if (this.gridSystem.isDraggingElbowGrip) {
      const point = this.getPlaneIntersection(event);
      if (point) this.gridSystem.updateElbowDrag({ x: point.x, z: point.y });
      return true;
    }
    return false;
  }

  public handleHover(event: PointerEvent, activeView: BimView, raycaster: THREE.Raycaster, structuralElementHovered: boolean): boolean {
    if (this.getActiveTool() !== 'select') {
      this.clearHover();
      return false;
    }
    if (structuralElementHovered) {
      this.clearHover();
      return true;
    }

    if (activeView.type === 'plan') {
      if (!this.isInsideView(event, activeView)) {
        this.gridSystem.setHoveredGrid(null);
        this.setCursor('default');
        return false;
      }
      this.setRay(event, activeView, raycaster);
      const controls = [
        ...this.gridSystem.gripHandles.map(grip => grip.mesh),
        ...this.gridSystem.elbowGrips.map(grip => grip.mesh),
        ...this.gridSystem.elbowToggles.map(toggle => toggle.mesh),
        ...this.gridSystem.toggleBoxes.map(toggle => toggle.mesh),
      ];
      const controlHit = raycaster.intersectObjects(controls).length > 0;
      const hit = raycaster.intersectObjects([...this.gridSystem.gridHitMeshes, ...this.gridSystem.bubbleSprites])[0];
      if (controlHit || hit) {
        if (hit && !controlHit) this.gridSystem.setHoveredGrid((hit.object.userData?.gridId as string) || null);
        this.setCursor('pointer');
        return false;
      }
      raycaster.params.Line = { threshold: 0.8 };
      const lineHit = raycaster.intersectObjects(this.gridSystem.getLineMeshes())[0];
      if (lineHit) {
        this.gridSystem.setHoveredGrid(lineHit.object.name);
        this.setCursor('pointer');
      } else {
        this.gridSystem.setHoveredGrid(null);
        this.setCursor('default');
      }
      return false;
    }

    if (activeView.type === 'elevation' || activeView.type === '3d') {
      if (!this.isInsideView(event, activeView)) {
        this.levelSystem.setHoveredLevel(null);
        this.setCursor('default');
        return false;
      }
      this.setRay(event, activeView, raycaster);
      const controls = [
        ...this.levelSystem.elbowToggles.map(toggle => toggle.mesh),
        ...this.levelSystem.bubbleToggles.map(toggle => toggle.mesh),
        ...this.levelSystem.grips.map(grip => grip.mesh),
        ...this.levelSystem.elbowGrips.map(grip => grip.mesh),
      ];
      const controlHit = raycaster.intersectObjects(controls).length > 0;
      const hit = raycaster.intersectObjects([
        ...this.levelSystem.levelHitMeshes,
        ...this.levelSystem.headsGroup.children,
      ])[0];
      if (controlHit || hit) {
        if (hit && !controlHit) this.levelSystem.setHoveredLevel((hit.object.userData?.levelId as string) || null);
        this.setCursor('pointer');
        return false;
      }
      raycaster.params.Line = { threshold: 1.0 };
      const lineHit = raycaster.intersectObjects(this.levelSystem.getLineMeshes())[0];
      if (lineHit) {
        const id = (lineHit.object.userData?.levelId as string) || lineHit.object.name || null;
        this.levelSystem.setHoveredLevel(id);
        this.setCursor('pointer');
      } else {
        this.levelSystem.setHoveredLevel(null);
        this.setCursor('default');
      }
      return false;
    }

    this.clearHover();
    this.setCursor('default');
    return false;
  }

  public handlePointerUp(): void {
    if (this.levelSystem.isDraggingGrip) {
      this.levelSystem.endGripDrag();
      this.footer.setMessage('Longitud de nivel ajustada.');
    }
    if (this.levelSystem.isDraggingElbowGrip) {
      this.levelSystem.endElbowDrag();
      this.footer.setMessage('Codo de nivel ajustado.');
    }
    if (this.gridSystem.isDraggingGrip) {
      this.gridSystem.endGripDrag();
      this.footer.setMessage('Alineación de rejilla completada.');
    }
    if (this.gridSystem.isDraggingElbowGrip) {
      this.gridSystem.endElbowDrag();
      this.footer.setMessage('Codo de rejilla ajustado.');
    }
  }

  public handleControlClick(event: MouseEvent, activeView: BimView, raycaster: THREE.Raycaster): boolean {
    if (activeView.type === 'plan') {
      this.setRay(event, activeView, raycaster);
      const toggleHit = raycaster.intersectObjects(this.gridSystem.toggleBoxes.map(toggle => toggle.mesh))[0];
      if (toggleHit) {
        const data = toggleHit.object.userData as { gridId?: string; end?: 'start' | 'end' };
        if (data.gridId && data.end) {
          this.gridSystem.toggleBubble(data.gridId, data.end);
          this.showSelectedGridProperties();
          this.footer.setMessage(`Burbuja de rejilla ${data.end === 'start' ? 'inicial' : 'final'} alternada.`);
          return true;
        }
      }

      const elbowHit = raycaster.intersectObjects(this.gridSystem.elbowToggles.map(toggle => toggle.mesh))[0];
      if (elbowHit) {
        const data = elbowHit.object.userData as { gridId?: string; end?: 'start' | 'end' };
        if (data.gridId && data.end) {
          this.gridSystem.toggleElbow(data.gridId, data.end);
          this.showSelectedGridProperties();
          this.footer.setMessage(`Codo de rejilla ${data.end === 'start' ? 'inicial' : 'final'} alternado.`);
          return true;
        }
      }
    } else if (activeView.type === 'elevation' || activeView.type === '3d') {
      this.setRay(event, activeView, raycaster);
      const toggleHit = raycaster.intersectObjects(this.levelSystem.bubbleToggles.map(toggle => toggle.mesh))[0];
      if (toggleHit) {
        const data = toggleHit.object.userData as { levelId?: string; end?: 'start' | 'end' };
        if (data.levelId && data.end) {
          this.levelSystem.toggleBubble(data.levelId, data.end);
          this.showSelectedLevelProperties();
          this.footer.setMessage(`Cabezal de nivel ${data.end === 'start' ? 'inicial' : 'final'} alternado.`);
          return true;
        }
      }

      const elbowHit = raycaster.intersectObjects(this.levelSystem.elbowToggles.map(toggle => toggle.mesh))[0];
      if (elbowHit) {
        const data = elbowHit.object.userData as { levelId?: string; end?: 'start' | 'end' };
        if (data.levelId && data.end) {
          this.levelSystem.toggleElbow(data.levelId, data.end);
          this.showSelectedLevelProperties();
          this.footer.setMessage(`Codo de nivel ${data.end === 'start' ? 'inicial' : 'final'} alternado.`);
          return true;
        }
      }
    }
    return false;
  }

  public handleReferenceSelectionClick(event: MouseEvent, activeView: BimView, raycaster: THREE.Raycaster): boolean {
    if (this.getActiveTool() !== 'select') return false;
    this.setRay(event, activeView, raycaster);

    if (activeView.type === 'plan') {
      const meshHit = raycaster.intersectObjects(this.gridSystem.gridHitMeshes)[0];
      let gridId = (meshHit?.object.userData?.gridId as string) || null;
      if (!gridId) {
        raycaster.params.Line = { threshold: 0.6 };
        gridId = raycaster.intersectObjects(this.gridSystem.getLineMeshes())[0]?.object.name || null;
      }
      if (gridId) {
        this.gridSystem.selectGrid(gridId);
        this.levelSystem.selectLevel(null);
        this.selection.clearSelection();
        const selected = this.gridSystem.getSelectedGrid();
        if (selected) {
          this.showSelectedGridProperties();
          this.footer.setMessage(`Rejilla seleccionada: Eje ${selected.name}. Arrastra los círculos en los extremos para alinear.`);
        }
        return true;
      }
    }

    if (activeView.type === 'elevation' || activeView.type === '3d') {
      const levelHit = raycaster.intersectObjects([
        ...this.levelSystem.levelHitMeshes,
        ...this.levelSystem.headsGroup.children,
      ])[0];
      let levelId = (levelHit?.object.userData?.levelId as string) || null;
      if (!levelId) {
        raycaster.params.Line = { threshold: 1.0 };
        const lineHit = raycaster.intersectObjects(this.levelSystem.getLineMeshes())[0];
        levelId = (lineHit?.object.userData?.levelId as string) || lineHit?.object.name || null;
      }
      if (levelId) {
        this.levelSystem.selectLevel(levelId);
        this.gridSystem.selectGrid(null);
        this.selection.clearSelection();
        const selected = this.levelSystem.getSelectedLevel();
        if (selected) {
          this.showSelectedLevelProperties();
          this.footer.setMessage(`Nivel seleccionado: ${selected.name}. Arrastra los círculos en los extremos para alargar/achicar, o el punto morado para mover el codo.`);
        }
        return true;
      }
    }

    this.selection.clearSelection();
    this.gridSystem.selectGrid(null);
    this.levelSystem.selectLevel(null);
    this.sidebar.showEmptyProperties();
    return true;
  }

  public handleDoubleClick(event: MouseEvent): void {
    this.inlineEditController.handleDoubleClick(event);
  }

  private getPlaneIntersection(event: MouseEvent): THREE.Vector2 | null {
    const activeView = this.viewer.viewManager.getActiveView();
    if (!activeView || !this.isInsideView(event, activeView)) return null;
    const rect = activeView.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(2 * (event.clientX - rect.left) / rect.width - 1, -2 * (event.clientY - rect.top) / rect.height + 1);
    this.raycaster.setFromCamera(mouse, activeView.camera);
    this.plane.constant = -(LEVELS_Y[this.gridSystem.activeLevelIdx] || 0);
    return this.raycaster.ray.intersectPlane(this.plane, this.planePoint)
      ? new THREE.Vector2(this.planePoint.x, this.planePoint.z)
      : null;
  }

  private getElevationPlaneIntersection(event: MouseEvent): THREE.Vector3 | null {
    const activeView = this.viewer.viewManager.getActiveView();
    if (!activeView || !this.isInsideView(event, activeView)) return null;
    const rect = activeView.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(2 * (event.clientX - rect.left) / rect.width - 1, -2 * (event.clientY - rect.top) / rect.height + 1);
    this.raycaster.setFromCamera(mouse, activeView.camera);

    let viewPlane: THREE.Plane;
    if (activeView.id === 'elev-east') viewPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
    else if (activeView.type === 'elevation' || activeView.id === 'elev-south') viewPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    else if (activeView.type === '3d') {
      const direction = new THREE.Vector3();
      activeView.camera.getWorldDirection(direction);
      direction.y = 0;
      if (direction.lengthSq() < 0.001) direction.set(0, 0, -1);
      direction.normalize();
      viewPlane = new THREE.Plane(direction.clone().negate(), 0);
    } else viewPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

    const point = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(viewPlane, point) ? point : null;
  }

  private setRay(event: MouseEvent, activeView: BimView, raycaster = this.raycaster): void {
    const rect = activeView.domElement.getBoundingClientRect();
    raycaster.setFromCamera(
      new THREE.Vector2(2 * (event.clientX - rect.left) / rect.width - 1, -2 * (event.clientY - rect.top) / rect.height + 1),
      activeView.camera,
    );
  }

  private showSelectedGridProperties(): void {
    const selected = this.gridSystem.getSelectedGrid();
    if (selected) this.sidebar.showGridProperties(selected, () => this.gridSystem.rebuildSystem(), id => this.gridSystem.deleteGrid(id));
  }

  private showSelectedLevelProperties(): void {
    const selected = this.levelSystem.getSelectedLevel();
    if (selected) this.sidebar.showLevelProperties(
      selected,
      () => { this.levelSystem.rebuildMeshes(); this.updateRibbonLevelSelector(); },
      id => { this.levelSystem.deleteLevel(id); this.updateRibbonLevelSelector(); },
    );
  }

  private isInsideView(event: MouseEvent, activeView: BimView): boolean {
    const rect = activeView.domElement.getBoundingClientRect();
    return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
  }

  private clearHover(): void {
    this.gridSystem.setHoveredGrid(null);
    this.levelSystem.setHoveredLevel(null);
  }

}
