import { Viewer } from './core/Viewer';
import { GridSystem } from './core/GridSystem';
import { LevelSystem } from './core/LevelSystem';
import { WasmBridge } from './kernel/WasmBridge';
import { SnappingManager } from './tools/SnappingManager';
import { StructuralManager } from './tools/StructuralManager';
import type { ManagedElement } from './tools/structural/types';
import { SelectionManager } from './tools/SelectionManager';
import { GripManager } from './tools/structural/GripManager';
import { ModificationTools } from './tools/structural/ModificationTools';
import { PlacementPreview } from './tools/PlacementPreview';
import { GridDrawingManager } from './tools/GridDrawingManager';
import { LevelDrawingManager } from './tools/LevelDrawingManager';
import { HeaderRibbon } from './features/ribbon/HeaderRibbonController';
import { ribbonLevelStore } from './features/ribbon/RibbonLevelStore';
import { ContextualSubheader } from './features/datum/ContextualSubheaderController';
import { Sidebar } from './features/sidebar/SidebarController';
import { publishViewTabs } from './features/workspace/ViewTabsBridge';
import { FooterStatusBar } from './features/footer-status/FooterStatusController';
import { LEVELS } from './config/structural.config';
import { BimDatabase } from './core/database/BimDatabase';
import { requestOpenProjectSchedule } from './features/project-browser/ProjectBrowserBridge';
import { requestOpenSelectById } from './features/select-by-id/SelectByIdBridge';
import { requestOpenMongoInspector } from './features/data-inspector/MongoInspectorBridge';
import { ContourEditor } from './features/model-editing/ContourEditor';
import { applyGeometry } from './tools/structural/ElementGeometry';
import type { StructuralApplicationDisposer } from './features/application/StructuralApplicationLifecycle';
import { CanvasInteractionController } from './features/application/CanvasInteractionController';
import { KeyboardController } from './features/keyboard/KeyboardController';
import { DatumInteractionController } from './features/datum/DatumInteractionController';
import { StructuralGripInteractionController } from './features/model-editing/StructuralGripInteractionController';
import { StructuralPlacementController } from './features/model-editing/StructuralPlacementController';
import { StructuralAlignmentController } from './features/model-editing/StructuralAlignmentController';
import { RibbonCommandController } from './features/ribbon/RibbonCommandController';
import { RibbonToolActivationController } from './features/ribbon/RibbonToolActivationController';
import { createDatumContextualActions } from './features/application/contextualActions/DatumContextualActions';
import { createSelectionContextualActions } from './features/application/contextualActions/SelectionContextualActions';
import { createStructuralEditContextualActions } from './features/application/contextualActions/StructuralEditContextualActions';
import { ApplicationReferenceEventController } from './features/application/ApplicationReferenceEventController';
import { createStructuralKeyboardActions } from './features/application/StructuralKeyboardActions';
import { StructuralElementFocusController } from './features/application/StructuralElementFocusController';
import { ApplicationProjectSession } from './features/application/ApplicationProjectSession';

async function bootstrap(): Promise<StructuralApplicationDisposer> {
  const appEvents = new AbortController();
  const footer = new FooterStatusBar();
  const wasm = new WasmBridge();
  await wasm.init();

  const viewer = new Viewer();
  // 1. ESCENA LIMPIA: El sistema de grillas inicia vacío
  const gridSystem = new GridSystem(viewer.scene);
  // 2. Sistema de Niveles visible en 3D
  const levelSystem = new LevelSystem(viewer.scene);
  const preview = new PlacementPreview(viewer.scene);

  const structural = new StructuralManager(viewer.scene, wasm, metrics => {
    footer.updateMetrics(metrics.count, metrics.volume, metrics.durationMs, 60);
  });

  viewer.setFpsCallback(fps => {
    footer.updateMetrics(structural.elementCount, structural.totalVolume, 0, fps);
  });

  const snapping = new SnappingManager(viewer.scene, () => viewer.viewManager.getActiveView());


  const sidebar = new Sidebar(
    viewer.viewManager,
    (element) => {
      structural.removeElement(element);
      selection.clearSelection();
    },
    (cat) => {
      requestOpenProjectSchedule(cat);
    }
  );

  let contextualBar: ContextualSubheader;
  let gripManager: GripManager;
  let modificationTools: ModificationTools;
  const contourEditor = new ContourEditor((el, definition) => {
    applyGeometry(el, definition, wasm);
    if (el.uniqueId) BimDatabase.getInstance().updateGeometry(el.uniqueId, definition);
    gripManager.updateGripsForElement(el);
    selection.refreshHighlight(); sidebar.showElementProperties(el);
    contextualBar.updateForSelectedElement(el, el.levelName);
    structural.updateMetrics(); footer.setMessage('Geometria y cantidades actualizadas.');
  });

  const selection = new SelectionManager(
    viewer.scene,
    () => viewer.viewManager.getActiveView(),
    structural.registry,
    (element) => {
      if (element) {
        gridSystem.selectGrid(null);
        levelSystem.selectLevel(null);
        sidebar.showElementProperties(element);
        gripManager?.updateGripsForElement(element);
        const activeLvl = levelSystem.getLevels()[snapping.activeLevelIdx]?.name || 'Nivel Activo';
        contextualBar?.updateForSelectedElement(element, activeLvl);
        footer.setMessage(`Elemento ${element.id} seleccionado. Usa los grips interactivos en pantalla, AL (Alinear) o AR (Matriz).`);
      } else {
        gripManager?.clearGrips();
        sidebar.showEmptyProperties();
        const activeLvl = levelSystem.getLevels()[snapping.activeLevelIdx]?.name || 'Nivel Activo';
        contextualBar?.updateForTool(ribbon ? ribbon.activeTool : 'select', activeLvl);
      }
    }
  );

  // Helper para mantener sincronizado el selector de niveles del ribbon superior
  const updateRibbonLevelSelector = () => {
    const currentLevels = levelSystem.getLevels();
    const selectedIndex = ribbonLevelStore.setLevels(currentLevels, snapping.activeLevelIdx);
    if (selectedIndex >= 0) snapping.activeLevelIdx = selectedIndex;
  };
  const elementFocus = new StructuralElementFocusController({
    viewer,
    gridSystem,
    levelSystem,
    preview,
    selection,
    sidebar,
    footer,
    setSelectionTool: () => { if (ribbon) ribbon.setTool('select'); },
  });
  const focusAndSelectElementIn3D = (element: ManagedElement) => elementFocus.focus(element);

  new ApplicationReferenceEventController({
    viewer,
    gridSystem,
    levelSystem,
    structural,
    selection,
    sidebar,
    footer,
    updateRibbonLevelSelector,
    focusAndSelectElementIn3D,
  }).attach(window, appEvents.signal);

  viewer.viewManager.setCallbacks(
    (activeView) => {
      footer.setMessage(`Vista activa: ${activeView.title}`);
      sidebar.updateProjectBrowser(levelSystem.getLevels(), activeView.id);
    },
    (views, activeId, allViews) => publishViewTabs(viewer.viewManager, views, activeId, allViews)
  );

  // Herramienta de Dibujo de Grillas Autodesk Revit Style
  const gridDrawingManager = new GridDrawingManager(
    viewer.scene,
    gridSystem,
    structural.registry,
    () => viewer.viewManager.getActiveView(),
    (msg) => footer.setMessage(msg)
  );

  // Herramienta de Dibujo de Niveles Autodesk Revit Style
  const levelDrawingManager = new LevelDrawingManager(
    viewer.scene,
    levelSystem,
    () => viewer.viewManager.getActiveView(),
    (msg) => footer.setMessage(msg)
  );

  // Sincronización reactiva del sistema de niveles con el gestor de vistas y navegador de proyectos
  levelSystem.onLevelsChanged = (levels) => {
    updateRibbonLevelSelector();
    viewer.viewManager.syncPlanViews(levels);
    sidebar.updateProjectBrowser(levels, viewer.viewManager.activeViewId);
  };

  // REGLAS DE VISIBILIDAD POR VISTA:
  // Grillas: Ocultas en vista 3D, visibles únicamente en vistas 2D de planta.
  // Niveles: Visibles en vista 3D y elevaciones.
  viewer.viewManager.onBeforeRenderView = (view) => {
    const isPlan = view.type === 'plan';
    gridSystem.group.visible = isPlan;
    gridDrawingManager.previewGroup.visible = isPlan;
    levelSystem.group.visible = (view.type === '3d' || view.type === 'elevation');
    levelDrawingManager.previewGroup.visible = (view.type === '3d' || view.type === 'elevation');
  };

  const datumInteractions = new DatumInteractionController(
    viewer, gridSystem, levelSystem, selection, sidebar, footer,
    updateRibbonLevelSelector, () => ribbon.activeTool,
  );

  // Subheader Contextual
  contextualBar = new ContextualSubheader({
    ...createDatumContextualActions({
      gridDrawingManager,
      gridSystem,
      levelDrawingManager,
      levelSystem,
      viewer,
      footer,
      updateRibbonLevelSelector,
    }),
    ...createSelectionContextualActions({
      gridSystem,
      levelSystem,
      footer,
      structural,
      selection,
      sidebar,
      snapping,
      getGripManager: () => gripManager,
      updateRibbonLevelSelector,
      getActiveTool: () => ribbon.activeTool,
      setTool: tool => ribbon.setTool(tool),
    }),
    ...createStructuralEditContextualActions({
      selection,
      footer,
      getModificationTools: () => modificationTools,
      levelSystem,
      snapping,
      getContextualBar: () => contextualBar,
      getActiveTool: () => ribbon.activeTool,
      getGripManager: () => gripManager,
      wasm,
      structural,
      sidebar,
      contourEditor,
      updateElementGeometry: (uniqueId, definition) => BimDatabase.getInstance().updateGeometry(uniqueId, definition),
    }),
  });

  // Instanciación de Administradores de Modificación Directa Revit
  gripManager = new GripManager(
    viewer.scene,
    wasm,
    structural.factory,
    () => viewer.viewManager.getActiveView(),
    (modifiedElement) => {
      if (modifiedElement.uniqueId && modifiedElement.definition) BimDatabase.getInstance().updateGeometry(modifiedElement.uniqueId, modifiedElement.definition);
      sidebar.showElementProperties(modifiedElement);
      selection.refreshHighlight();
      const activeLvl = levelSystem.getLevels()[snapping.activeLevelIdx]?.name || 'Nivel Activo';
      contextualBar.updateForSelectedElement(modifiedElement, activeLvl);
      structural.updateMetrics();
      footer.setMessage(`Elemento ${modifiedElement.id} modificado por Grip interactivo.`);
    },
    () => structural.currentStyle
  );
  const structuralGripInteractions = new StructuralGripInteractionController(
    viewer, gripManager, gridSystem, levelSystem, selection, sidebar, footer,
  );

  modificationTools = new ModificationTools(
    viewer.scene,
    wasm,
    structural.factory,
    structural.registry,
    () => structural.currentStyle,
    (msg) => footer.setMessage(msg),
    () => {
      structural.updateMetrics();
      if (selection.selectedElement) {
        sidebar.showElementProperties(selection.selectedElement);
        selection.refreshHighlight();
        gripManager.updateGripsForElement(selection.selectedElement);
      }
    }
  );
  const alignment = new StructuralAlignmentController(
    gridSystem, levelSystem, structural, modificationTools, gripManager,
    selection, snapping, contextualBar,
  );

  // Ribbon superior
  const ribbonToolActivation = new RibbonToolActivationController({
    viewer,
    snapping,
    contextualBar,
    gridDrawingManager,
    levelDrawingManager,
    gridSystem,
    levelSystem,
    selection,
    preview,
    footer,
  });
  let projectSession: ApplicationProjectSession | undefined;
  let ribbon: HeaderRibbon;
  ribbon = new HeaderRibbon(
    tool => ribbonToolActivation.activate(tool),
    () => {
      // At Grid
      const tool = ribbon.activeTool === 'select' ? 'columna' : ribbon.activeTool;
      if (tool !== 'grid') {
        if (!gridSystem.hasGrids()) {
          gridSystem.loadDefaultTestGrid();
        }
        structural.placeAtGridIntersections(tool, snapping.activeLevelIdx);
        footer.setMessage(`Generado en grilla: ${tool.toUpperCase()}`);
      }
    },
    () => {
      projectSession?.openExamples();
    },
    () => {
      structural.clear();
      gridSystem.clear();
      levelSystem.resetToDefault();
      viewer.viewManager.initDefaultViews();
      selection.clearSelection();
      sidebar.showEmptyProperties();
      sidebar.updateProjectBrowser(levelSystem.getLevels(), viewer.viewManager.activeViewId);
      footer.setMessage('Proyecto restablecido al estándar Revit por defecto (1 Vista 3D, 1 Nivel, 4 Alzados).');
    },
    (style) => structural.setVisualStyle(style, viewer, gridSystem),
    () => gridSystem.toggleQuick(),
    (levelIdx) => {
      ribbonLevelStore.setSelected(levelIdx);
      snapping.activeLevelIdx = levelIdx;
      gridSystem.setActiveLevel(levelIdx);
      contextualBar.updateForTool(ribbon.activeTool, LEVELS[levelIdx]?.name || '');
    }
  );

  const detachRibbonCommands = new RibbonCommandController(ribbon, {
    openSchedule: () => requestOpenProjectSchedule('ALL'),
    selectById: requestOpenSelectById,
    openMongoInspector: requestOpenMongoInspector,
    exportCsv: () => {
      BimDatabase.getInstance().downloadCsvExport();
      footer.setMessage('Exportación de metrados CSV generada y descargada.');
    },
    exportJson: () => {
      BimDatabase.getInstance().downloadMongoDump();
      footer.setMessage('Dump BSON/JSON de la BD BIM descargado.');
    },
  }).attach(window);

  updateRibbonLevelSelector();
  sidebar.updateProjectBrowser(levelSystem.getLevels(), viewer.viewManager.activeViewId);
  contextualBar.updateForTool('select', LEVELS[snapping.activeLevelIdx]?.name || 'Nivel 1 (0.00 m)');
  structural.setVisualStyle('hidden_line', viewer, gridSystem);

  // Sincronizar propiedades en barra lateral si se renombra un eje inline
  gridSystem.onGridRenamed = (updatedGrid) => {
    if (gridSystem.selectedGridId === updatedGrid.id) {
      sidebar.showGridProperties(
        updatedGrid,
        () => gridSystem.rebuildSystem(),
        (id) => gridSystem.deleteGrid(id)
      );
    }
  };

  const placement = new StructuralPlacementController(
    snapping, gridSystem, preview, structural, footer, () => ribbon.activeTool,
  );
  const cancelStructuralDrag = () => structuralGripInteractions.cancelDrag();
  new CanvasInteractionController({
    viewer,
    structuralGripInteractions,
    datumInteractions,
    gridDrawingManager,
    levelDrawingManager,
    selection,
    gridSystem,
    levelSystem,
    alignment,
    placement,
    getActiveTool: () => ribbon.activeTool,
    updateRibbonLevelSelector,
    cancelStructuralDrag,
  }).attach(window, appEvents.signal);

  projectSession = await ApplicationProjectSession.start({
    viewer,
    structural,
    selection,
    levels: levelSystem,
    grids: gridSystem,
    wasm,
    ribbon,
    preview,
    gripManager,
    snapping,
    sidebar,
    footer,
    updateRibbonLevelSelector,
    focusElementIn3D: focusAndSelectElementIn3D,
  });

  const keyboardController = new KeyboardController({
    openSelectById: requestOpenSelectById,
    openMongoInspector: requestOpenMongoInspector,
    openSchedule: () => requestOpenProjectSchedule('ALL'),
    ...createStructuralKeyboardActions({
      ribbon,
      preview,
      gridSystem,
      levelSystem,
      selection,
      sidebar,
      footer,
      gridDrawingManager,
      levelDrawingManager,
      modificationTools,
      gripManager,
      contextualBar,
      structural,
      snapping,
      cancelStructuralDrag,
      updateRibbonLevelSelector,
    }),
    isTyping: () => {
      const active = document.activeElement;
      return !!active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName);
    },
    setTool: tool => ribbon.setTool(tool),
  });
  const detachKeyboard = keyboardController.attach(window);
  return () => {
    appEvents.abort();
    detachRibbonCommands();
    detachKeyboard();
    projectSession?.dispose();
    selection.dispose();
    sidebar.dispose();
    gridDrawingManager.dispose();
    levelDrawingManager.dispose();
    snapping.dispose();
    viewer.dispose();
  };
}

export function startStructuralApplication(): Promise<StructuralApplicationDisposer> {
  return bootstrap();
}
