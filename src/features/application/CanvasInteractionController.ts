import * as THREE from 'three';
import { GridDrawingManager } from '../../tools/GridDrawingManager';
import { LevelDrawingManager } from '../../tools/LevelDrawingManager';
import { SelectionManager } from '../../tools/SelectionManager';
import { DatumInteractionController } from '../datum/DatumInteractionController';
import { StructuralAlignmentController } from '../model-editing/StructuralAlignmentController';
import { StructuralGripInteractionController } from '../model-editing/StructuralGripInteractionController';
import { StructuralPlacementController } from '../model-editing/StructuralPlacementController';
import { Viewer } from '../../core/Viewer';
import { GridSystem } from '../../core/GridSystem';
import { LevelSystem } from '../../core/LevelSystem';

export interface CanvasInteractionDependencies {
  viewer: Viewer;
  structuralGripInteractions: StructuralGripInteractionController;
  datumInteractions: DatumInteractionController;
  gridDrawingManager: GridDrawingManager;
  levelDrawingManager: LevelDrawingManager;
  selection: SelectionManager;
  gridSystem: GridSystem;
  levelSystem: LevelSystem;
  alignment: StructuralAlignmentController;
  placement: StructuralPlacementController;
  getActiveTool: () => string;
  updateRibbonLevelSelector: () => void;
  cancelStructuralDrag: () => void;
}

export class CanvasInteractionController {
  private readonly raycaster = new THREE.Raycaster();

  constructor(private readonly dependencies: CanvasInteractionDependencies) {}

  public attach(target: Window, signal: AbortSignal): void {
    target.addEventListener('pointerdown', event => this.handlePointerDown(event), { signal });
    target.addEventListener('pointermove', event => this.handlePointerMove(event), { signal });
    target.addEventListener('pointercancel', this.dependencies.cancelStructuralDrag, { signal });
    target.addEventListener('blur', this.dependencies.cancelStructuralDrag, { signal });
    target.addEventListener('pointerup', () => this.handlePointerUp(), { signal });
    target.addEventListener('dblclick', event => {
      this.dependencies.datumInteractions.handleDoubleClick(event);
    }, { signal });
    target.addEventListener('click', event => this.handleClick(event), { signal });
  }

  private handlePointerDown(event: PointerEvent): void {
    const activeView = this.dependencies.viewer.viewManager.getActiveView();
    if (!activeView) return;
    if (this.dependencies.structuralGripInteractions.handlePointerDown(event, activeView, this.raycaster)) return;
    this.dependencies.datumInteractions.handlePointerDown(event, activeView, this.raycaster);
  }

  private handlePointerMove(event: PointerEvent): void {
    const deps = this.dependencies;
    if (deps.structuralGripInteractions.handlePointerMove(event) !== 'none') return;
    if (deps.datumInteractions.handlePointerMove(event)) return;

    const activeTool = deps.getActiveTool();
    if (activeTool === 'grid') {
      deps.gridDrawingManager.handlePointerMove(event);
      return;
    }
    if (activeTool === 'level') {
      deps.levelDrawingManager.handlePointerMove(event);
      return;
    }

    deps.selection.handlePointerMove(event);
    const activeView = deps.viewer.viewManager.getActiveView();
    if (deps.datumInteractions.handleHover(event, activeView, this.raycaster, Boolean(deps.selection.hoveredElement))) return;
    deps.placement.updatePreview();
  }

  private handlePointerUp(): void {
    this.dependencies.structuralGripInteractions.handlePointerUp();
    this.dependencies.datumInteractions.handlePointerUp();
  }

  private handleClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (
      target.closest('#app-header') ||
      target.closest('#app-sidebar') ||
      target.closest('#view-tabs-bar') ||
      target.closest('#app-footer') ||
      target.closest('.view-panel-header')
    ) return;

    const deps = this.dependencies;
    const activeView = deps.viewer.viewManager.getActiveView();
    if (!activeView) return;
    if (deps.alignment.handleClick(event, activeView, this.raycaster)) return;

    const activeTool = deps.getActiveTool();
    if (activeTool === 'grid' && deps.gridDrawingManager.handlePointerClick(event)) return;
    if (activeTool === 'level' && deps.levelDrawingManager.handlePointerClick(event)) {
      deps.updateRibbonLevelSelector();
      return;
    }
    if (deps.datumInteractions.handleControlClick(event, activeView, this.raycaster)) return;

    if (activeTool === 'select' && deps.selection.handlePointerClick(event)) {
      deps.gridSystem.selectGrid(null);
      deps.levelSystem.selectLevel(null);
      return;
    }

    if (deps.datumInteractions.handleReferenceSelectionClick(event, activeView, this.raycaster)) return;
    deps.placement.placeAtCurrentSnap();
  }
}
