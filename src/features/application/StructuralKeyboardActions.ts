import type { GridSystem } from '../../core/GridSystem';
import type { LevelSystem } from '../../core/LevelSystem';
import type { PlacementPreview } from '../../tools/PlacementPreview';
import type { GridDrawingManager } from '../../tools/GridDrawingManager';
import type { LevelDrawingManager } from '../../tools/LevelDrawingManager';
import type { StructuralManager } from '../../tools/StructuralManager';
import type { GripManager } from '../../tools/structural/GripManager';
import type { ModificationTools } from '../../tools/structural/ModificationTools';
import type { SelectionManager } from '../../tools/SelectionManager';
import type { SnappingManager } from '../../tools/SnappingManager';
import type { ContextualSubheader } from '../datum/ContextualSubheaderController';
import type { FooterStatusBar } from '../footer-status/FooterStatusController';
import type { HeaderRibbon } from '../ribbon/HeaderRibbonController';
import type { Sidebar } from '../sidebar/SidebarController';
import type { KeyboardControllerActions } from '../keyboard/KeyboardController';

interface StructuralKeyboardActionDependencies {
  ribbon: HeaderRibbon;
  preview: PlacementPreview;
  gridSystem: GridSystem;
  levelSystem: LevelSystem;
  selection: SelectionManager;
  sidebar: Sidebar;
  footer: FooterStatusBar;
  gridDrawingManager: GridDrawingManager;
  levelDrawingManager: LevelDrawingManager;
  modificationTools: ModificationTools;
  gripManager: GripManager;
  contextualBar: ContextualSubheader;
  structural: StructuralManager;
  snapping: SnappingManager;
  cancelStructuralDrag: () => void;
  updateRibbonLevelSelector: () => void;
}

type StructuralKeyboardActions = Pick<KeyboardControllerActions, 'escape' | 'alignShortcut' | 'arrayShortcut' | 'deleteSelection'>;

export function createStructuralKeyboardActions(deps: StructuralKeyboardActionDependencies): StructuralKeyboardActions {
  return {
    escape: () => {
      if (deps.gripManager.isDragging) { deps.cancelStructuralDrag(); return; }
      if (deps.modificationTools.isAlignActive) {
        deps.modificationTools.cancelAlign();
        if (deps.selection.selectedElement) {
          const activeLevel = deps.levelSystem.getLevels()[deps.snapping.activeLevelIdx]?.name || 'Nivel Activo';
          deps.contextualBar.updateForSelectedElement(deps.selection.selectedElement, activeLevel);
        }
        deps.footer.setMessage('Alineación cancelada.');
        return;
      }
      if (deps.modificationTools.isArrayActive) {
        deps.modificationTools.cancelArray();
        if (deps.selection.selectedElement) {
          const activeLevel = deps.levelSystem.getLevels()[deps.snapping.activeLevelIdx]?.name || 'Nivel Activo';
          deps.contextualBar.updateForSelectedElement(deps.selection.selectedElement, activeLevel);
        }
        deps.footer.setMessage('Matriz cancelada.');
        return;
      }
      deps.gridDrawingManager.cancelCurrentDraw();
      deps.levelDrawingManager.cancelCurrentDraw();
      deps.gripManager.clearGrips();
      deps.ribbon.setTool('select');
      deps.preview.hide();
      deps.gridSystem.clearHighlight();
      deps.gridSystem.hideGuideLine();
      deps.gridSystem.selectGrid(null);
      deps.levelSystem.selectLevel(null);
      deps.selection.clearSelection();
      deps.sidebar.showEmptyProperties();
      deps.footer.setMessage('Modo Selección | Listo');
    },
    alignShortcut: () => {
      if (deps.selection.selectedElement) {
        deps.modificationTools.startAlign(deps.selection.selectedElement);
        deps.contextualBar.renderAlignBar('Paso 1: Selecciona una rejilla, nivel o arista de referencia');
      } else {
        deps.footer.setMessage('Atajo Revit AL: Selecciona primero un elemento estructural para alinear.');
      }
    },
    arrayShortcut: () => {
      if (deps.selection.selectedElement) {
        deps.modificationTools.startArray(deps.selection.selectedElement);
        deps.contextualBar.renderArrayBar(deps.selection.selectedElement);
      } else {
        deps.footer.setMessage('Atajo Revit AR: Selecciona primero un elemento para crear una matriz.');
      }
    },
    deleteSelection: () => {
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
        deps.structural.removeElement(deps.selection.selectedElement);
        deps.selection.clearSelection();
        deps.sidebar.showEmptyProperties();
        deps.footer.setMessage('Elemento eliminado.');
      }
    },
  };
}
