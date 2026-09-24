import * as THREE from 'three';
import type { ToolType } from '../../../config/structural.config';
import type { LevelSystem } from '../../../core/LevelSystem';
import type { WasmBridge } from '../../../kernel/WasmBridge';
import type { SelectionManager } from '../../../tools/SelectionManager';
import type { StructuralManager } from '../../../tools/StructuralManager';
import type { ModificationTools } from '../../../tools/structural/ModificationTools';
import type { ColumnDefinition, ArrayOptions } from '../../../tools/structural/types';
import type { GripManager } from '../../../tools/structural/GripManager';
import type { SnappingManager } from '../../../tools/SnappingManager';
import type { Sidebar } from '../../sidebar/SidebarController';
import type { FooterStatusBar } from '../../footer-status/FooterStatusController';
import type { ContourEditor } from '../../model-editing/ContourEditor';
import type { ContextualActions } from '../../datum/ContextualSubheaderController';
import type { ContextualSubheader } from '../../datum/ContextualSubheaderController';

interface StructuralEditContextualActionDependencies {
  selection: SelectionManager;
  footer: FooterStatusBar;
  getModificationTools: () => ModificationTools;
  levelSystem: LevelSystem;
  snapping: SnappingManager;
  getContextualBar: () => ContextualSubheader;
  getActiveTool: () => ToolType;
  getGripManager: () => GripManager;
  wasm: WasmBridge;
  structural: StructuralManager;
  sidebar: Sidebar;
  contourEditor: ContourEditor;
  updateElementGeometry: (uniqueId: string, definition: ColumnDefinition) => void;
}

export function createStructuralEditContextualActions(
  deps: StructuralEditContextualActionDependencies,
): ContextualActions {
  const activeLevelName = () => deps.levelSystem.getLevels()[deps.snapping.activeLevelIdx]?.name || 'Nivel Activo';
  const contextualBar = () => deps.getContextualBar();

  return {
    onStartAlign: () => {
      const element = deps.selection.selectedElement;
      if (!element) {
        deps.footer.setMessage('Selecciona primero un elemento estructural para alinear (AL).');
        return;
      }
      deps.getModificationTools().startAlign(element);
      contextualBar().renderAlignBar('Paso 1: Selecciona una rejilla, nivel o arista de referencia');
    },
    onCancelAlign: () => {
      deps.getModificationTools().cancelAlign();
      const element = deps.selection.selectedElement;
      if (element) contextualBar().updateForSelectedElement(element, activeLevelName());
      else contextualBar().updateForTool(deps.getActiveTool(), activeLevelName());
    },
    onStartArray: () => {
      const element = deps.selection.selectedElement;
      if (!element) {
        deps.footer.setMessage('Selecciona primero un elemento para crear una matriz (AR).');
        return;
      }
      deps.getModificationTools().startArray(element);
      contextualBar().renderArrayBar(element);
    },
    onExecuteArray: (options: ArrayOptions) => {
      const element = deps.selection.selectedElement;
      if (!element) return;
      const copies = deps.getModificationTools().executeArray(element, options);
      contextualBar().updateForSelectedElement(element, activeLevelName());
      deps.footer.setMessage(`Matriz Revit ejecutada: ${copies.length} copias generadas en la base de datos.`);
    },
    onCancelArray: () => {
      deps.getModificationTools().cancelArray();
      const element = deps.selection.selectedElement;
      if (element) contextualBar().updateForSelectedElement(element, activeLevelName());
      else contextualBar().updateForTool(deps.getActiveTool(), activeLevelName());
    },
    onToggleColumnStyle: () => {
      const element = deps.selection.selectedElement;
      if (!element || element.type !== 'column') return;

      const gripManager = deps.getGripManager();
      const definition = gripManager.ensureDefinition(element) as ColumnDefinition;
      const isSlanted = definition.columnStyle === 'slanted';
      definition.columnStyle = isSlanted ? 'vertical' : 'slanted';
      if (definition.columnStyle === 'slanted') {
        definition.topPoint.x = definition.basePoint.x + 1.5;
      } else {
        definition.topPoint.x = definition.basePoint.x;
        definition.topPoint.z = definition.basePoint.z;
      }

      const meshData = definition.columnStyle === 'slanted'
        ? deps.wasm.createSlantedColumn(definition.basePoint, definition.topPoint, definition.width, definition.depth)
        : deps.wasm.createColumn(
          definition.basePoint.x,
          definition.basePoint.z,
          definition.basePoint.y,
          definition.topPoint.y,
          definition.width,
          definition.depth,
        );

      element.mesh.geometry.dispose();
      element.mesh.geometry = meshData.geometry;
      element.line.geometry.dispose();
      element.line.geometry = new THREE.EdgesGeometry(meshData.geometry, 20);
      element.dimensions = `${definition.width.toFixed(2)}m × ${definition.depth.toFixed(2)}m (${definition.columnStyle === 'slanted' ? 'Inclinada 3D' : 'Vertical'})`;
      element.volume = meshData.volume;
      if (element.uniqueId) deps.updateElementGeometry(element.uniqueId, definition);
      gripManager.updateGripsForElement(element);
      deps.selection.refreshHighlight();
      deps.sidebar.showElementProperties(element);
      contextualBar().updateForSelectedElement(element, activeLevelName());
      deps.footer.setMessage(`Columna conmutada a estilo: ${definition.columnStyle.toUpperCase()}`);
      deps.structural.updateMetrics();
    },
    onStartSketchMode: () => {
      const element = deps.selection.selectedElement;
      if (element) deps.contourEditor.open(element);
    },
    onAddVoidSketch: () => {
      const element = deps.selection.selectedElement;
      if (element?.type === 'slab') deps.contourEditor.open(element, true);
    },
  };
}
