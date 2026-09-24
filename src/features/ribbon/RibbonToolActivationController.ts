import { LEVELS, type ToolType } from '../../config/structural.config';
import { ContextualSubheader } from '../datum/ContextualSubheaderController';
import { GridSystem } from '../../core/GridSystem';
import { LevelSystem } from '../../core/LevelSystem';
import { Viewer } from '../../core/Viewer';
import { GridDrawingManager } from '../../tools/GridDrawingManager';
import { LevelDrawingManager } from '../../tools/LevelDrawingManager';
import { PlacementPreview } from '../../tools/PlacementPreview';
import { SelectionManager } from '../../tools/SelectionManager';
import { SnappingManager } from '../../tools/SnappingManager';
import { FooterStatusBar } from '../footer-status/FooterStatusController';

export interface RibbonToolActivationDependencies {
  viewer: Viewer;
  snapping: SnappingManager;
  contextualBar: ContextualSubheader;
  gridDrawingManager: GridDrawingManager;
  levelDrawingManager: LevelDrawingManager;
  gridSystem: GridSystem;
  levelSystem: LevelSystem;
  selection: SelectionManager;
  preview: PlacementPreview;
  footer: FooterStatusBar;
}

export class RibbonToolActivationController {
  constructor(private readonly dependencies: RibbonToolActivationDependencies) {}

  public activate(tool: ToolType): void {
    const deps = this.dependencies;
    deps.snapping.enabled = tool !== 'select' && tool !== 'grid' && tool !== 'level';
    const levelName = LEVELS[deps.snapping.activeLevelIdx]?.name || 'Nivel Activo';
    deps.contextualBar.updateForTool(tool, levelName);

    if (tool === 'grid') {
      const activeView = deps.viewer.viewManager.getActiveView();
      if (activeView.type !== 'plan') {
        const levels = deps.levelSystem.getLevels();
        const activeLevel = levels[deps.snapping.activeLevelIdx] || levels[0];
        let targetPlanId = activeLevel ? `plan-${activeLevel.id}` : 'plan-lvl-1';
        if (!deps.viewer.viewManager.views.has(targetPlanId)) {
          const firstPlan = deps.viewer.viewManager.getAllViews().find(view => view.type === 'plan');
          targetPlanId = firstPlan ? firstPlan.id : 'plan-lvl-1';
        }
        deps.viewer.viewManager.openView(targetPlanId);
        const planView = deps.viewer.viewManager.getActiveView();
        deps.footer.setMessage(`Abriendo vista de planta (${planView.title}) para colocar rejillas.`);
      }
      deps.gridDrawingManager.activate();
      deps.gridDrawingManager.setOffset(deps.contextualBar.currentOffset);
      deps.gridDrawingManager.setChain(deps.contextualBar.isChain);
      deps.levelDrawingManager.deactivate();
      deps.selection.clearSelection();
      deps.preview.hide();
      deps.footer.setMessage('Herramienta Rejilla activa: Clic en planta para trazar ejes.');
      return;
    }

    if (tool === 'level') {
      deps.gridDrawingManager.deactivate();
      deps.preview.hide();
      deps.selection.clearSelection();
      deps.gridSystem.selectGrid(null);
      const activeView = deps.viewer.viewManager.getActiveView();
      if (activeView.type !== 'elevation') {
        let targetElevationId = 'elev-south';
        if (!deps.viewer.viewManager.views.has(targetElevationId)) {
          const firstElevation = deps.viewer.viewManager.getAllViews().find(view => view.type === 'elevation');
          targetElevationId = firstElevation ? firstElevation.id : 'elev-south';
        }
        deps.viewer.viewManager.openView(targetElevationId);
        const elevationView = deps.viewer.viewManager.getActiveView();
        deps.footer.setMessage(`Abriendo vista de alzado (${elevationView.title}) para trazar niveles.`);
      } else {
        deps.footer.setMessage('Herramienta Nivel activa (LL): Haz 2 clics para trazar un nivel o usa Quick Generate.');
      }
      deps.levelDrawingManager.activate();
      deps.levelDrawingManager.setMode(deps.contextualBar.levelDrawMode);
      deps.levelDrawingManager.setOffset(deps.contextualBar.levelOffset);
      deps.levelDrawingManager.setMakePlanView(deps.contextualBar.levelMakePlanView);
      return;
    }

    deps.gridDrawingManager.deactivate();
    deps.levelDrawingManager.deactivate();
    if (tool === 'select') {
      deps.preview.hide();
      deps.gridSystem.clearHighlight();
      deps.gridSystem.hideGuideLine();
      deps.footer.setMessage('Listo | Modo Selección');
      return;
    }

    deps.selection.clearSelection();
    deps.selection.clearHover();
    deps.gridSystem.selectGrid(null);
    deps.levelSystem.selectLevel(null);
    deps.footer.setMessage(`Herramienta activa: ${tool.toUpperCase()} (Previsualización activa)`);
  }
}
