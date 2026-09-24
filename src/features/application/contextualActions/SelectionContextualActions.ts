import type { ToolType } from '../../../config/structural.config';
import { GridSystem } from '../../../core/GridSystem';
import { LevelSystem } from '../../../core/LevelSystem';
import { FooterStatusBar } from '../../footer-status/FooterStatusController';
import { ContextualActions } from '../../datum/ContextualSubheaderController';
import { StructuralManager } from '../../../tools/StructuralManager';
import { SelectionManager } from '../../../tools/SelectionManager';
import { Sidebar } from '../../sidebar/SidebarController';
import { SnappingManager } from '../../../tools/SnappingManager';
import { GripManager } from '../../../tools/structural/GripManager';

interface SelectionContextualActionDependencies {
  gridSystem: GridSystem;
  levelSystem: LevelSystem;
  footer: FooterStatusBar;
  structural: StructuralManager;
  selection: SelectionManager;
  sidebar: Sidebar;
  snapping: SnappingManager;
  getGripManager: () => GripManager;
  updateRibbonLevelSelector: () => void;
  getActiveTool: () => ToolType;
  setTool: (tool: ToolType) => void;
}

export function createSelectionContextualActions(deps: SelectionContextualActionDependencies): ContextualActions {
  return {
    onAtGrid: () => {
      const tool = deps.getActiveTool();
      if (tool === 'select' || tool === 'grid') return;
      if (!deps.gridSystem.hasGrids()) deps.gridSystem.loadDefaultTestGrid();
      deps.structural.placeAtGridIntersections(tool, deps.snapping.activeLevelIdx);
      deps.footer.setMessage(`Colocados ${tool.toUpperCase()} en todas las intersecciones.`);
    },
    onCancel: () => deps.setTool('select'),
    onClearSelection: () => {
      deps.selection.clearSelection();
      deps.getGripManager().clearGrips();
      deps.gridSystem.selectGrid(null);
      deps.levelSystem.selectLevel(null);
      deps.sidebar.showEmptyProperties();
      deps.footer.setMessage('Selección limpiada.');
    },
    onDeleteSelected: () => {
      if (deps.gridSystem.selectedGridId) {
        const id = deps.gridSystem.selectedGridId;
        deps.gridSystem.deleteGrid(id);
        deps.sidebar.showEmptyProperties();
        deps.footer.setMessage(`Rejilla ${id} eliminada.`);
      } else if (deps.levelSystem.selectedLevelId) {
        const id = deps.levelSystem.selectedLevelId;
        deps.levelSystem.deleteLevel(id);
        deps.updateRibbonLevelSelector();
        deps.sidebar.showEmptyProperties();
        deps.footer.setMessage(`Nivel ${id} eliminado.`);
      } else if (deps.selection.selectedElement) {
        deps.getGripManager().clearGrips();
        deps.structural.removeElement(deps.selection.selectedElement);
        deps.selection.clearSelection();
        deps.sidebar.showEmptyProperties();
        deps.footer.setMessage('Elemento estructural eliminado.');
      } else {
        deps.footer.setMessage('No hay ningún elemento seleccionado para eliminar.');
      }
    },
    onToggleGrid: () => {
      const mode = deps.gridSystem.toggleQuick();
      deps.footer.setMessage(`Visibilidad de rejilla: ${mode.toUpperCase()}`);
    },
  };
}
