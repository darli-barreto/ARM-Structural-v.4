import type { GridSystem } from '../../core/GridSystem';
import type { LevelSystem } from '../../core/LevelSystem';
import type { BimGridDocument, BimLevelDocument } from '../../core/database/BimDatabaseTypes';
import type { Viewer } from '../../core/Viewer';
import type { StructuralManager } from '../../tools/StructuralManager';
import type { ManagedElement } from '../../tools/structural/types';
import type { SelectionManager } from '../../tools/SelectionManager';
import type { Sidebar } from '../sidebar/SidebarController';
import type { FooterStatusBar } from '../footer-status/FooterStatusController';
import { SCHEDULE_ACTION_EVENT, type ScheduleAction } from '../quantification/ScheduleBridge';
import { SELECT_BY_ID_RESULT_EVENT } from '../select-by-id/SelectByIdBridge';
import type { SelectByIdResult } from '../select-by-id/SelectByIdTypes';

interface ApplicationReferenceEventDependencies {
  viewer: Viewer;
  gridSystem: GridSystem;
  levelSystem: LevelSystem;
  structural: StructuralManager;
  selection: SelectionManager;
  sidebar: Sidebar;
  footer: FooterStatusBar;
  updateRibbonLevelSelector: () => void;
  focusAndSelectElementIn3D: (element: ManagedElement) => void;
}

export class ApplicationReferenceEventController {
  constructor(private readonly deps: ApplicationReferenceEventDependencies) {}

  public attach(target: EventTarget, signal: AbortSignal): void {
    target.addEventListener(SCHEDULE_ACTION_EVENT, this.handleScheduleAction, { signal });
    target.addEventListener(SELECT_BY_ID_RESULT_EVENT, this.handleSelectByIdResult, { signal });
  }

  private handleScheduleAction = (event: Event): void => {
    const action = (event as CustomEvent<ScheduleAction>).detail;
    const element = this.deps.structural.registry.findById(action.id);
    if (action.type === 'select') {
      if (element) this.deps.focusAndSelectElementIn3D(element);
      else this.deps.footer.setMessage(`Elemento ${action.id} no encontrado en el modelo.`);
      return;
    }
    if (element) {
      this.deps.structural.removeElement(element);
      this.deps.selection.clearSelection();
      this.deps.sidebar.showEmptyProperties();
      this.deps.footer.setMessage(`Elemento ${element.id} suprimido del modelo.`);
    }
  };

  private handleSelectByIdResult = (event: Event): void => {
    const result = (event as CustomEvent<SelectByIdResult>).detail;
    if (result.type === 'element') {
      const element =
        this.deps.structural.registry.findById(result.doc.uniqueId) ||
        this.deps.structural.registry.findById(result.doc.elementId);
      if (element) this.deps.focusAndSelectElementIn3D(element);
      return;
    }

    if (result.type === 'grid') {
      const gridDoc = result.doc as BimGridDocument;
      const planView = this.deps.viewer.viewManager.getAllViews().find(view => view.type === 'plan');
      if (planView) this.deps.viewer.viewManager.openView(planView.id);
      this.deps.gridSystem.selectGrid(result.doc.uniqueId);
      const selectedGrid = this.deps.gridSystem.getSelectedGrid();
      if (selectedGrid) {
        this.deps.sidebar.showGridProperties(
          selectedGrid,
          () => this.deps.gridSystem.rebuildSystem(),
          id => this.deps.gridSystem.deleteGrid(id),
        );
      }
      this.deps.footer.setMessage(`Rejilla ${gridDoc.name} seleccionada por ID.`);
      return;
    }

    const levelDoc = result.doc as BimLevelDocument;
    const elevationView =
      this.deps.viewer.viewManager.getAllViews().find(view => view.type === 'elevation') ||
      this.deps.viewer.viewManager.views.get('view-3d');
    if (elevationView) this.deps.viewer.viewManager.openView(elevationView.id);
    this.deps.levelSystem.selectLevel(result.doc.uniqueId);
    const selectedLevel = this.deps.levelSystem.getSelectedLevel();
    if (selectedLevel) {
      this.deps.sidebar.showLevelProperties(
        selectedLevel,
        () => {
          this.deps.levelSystem.rebuildMeshes();
          this.deps.updateRibbonLevelSelector();
        },
        id => {
          this.deps.levelSystem.deleteLevel(id);
          this.deps.updateRibbonLevelSelector();
        },
      );
    }
    this.deps.footer.setMessage(`Nivel ${levelDoc.name} seleccionado por ID.`);
  };
}
