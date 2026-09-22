import * as THREE from 'three';
import { Viewer } from './core/Viewer';
import { GridSystem } from './core/GridSystem';
import { LevelSystem } from './core/LevelSystem';
import { WasmBridge } from './kernel/WasmBridge';
import { SnappingManager } from './tools/SnappingManager';
import { StructuralManager } from './tools/StructuralManager';
import { ManagedElement, ColumnDefinition, SlabDefinition, Vector3D } from './tools/structural/types';
import { SelectionManager } from './tools/SelectionManager';
import { GripManager } from './tools/structural/GripManager';
import { ModificationTools } from './tools/structural/ModificationTools';
import { PlacementPreview } from './tools/PlacementPreview';
import { GridDrawingManager } from './tools/GridDrawingManager';
import { LevelDrawingManager } from './tools/LevelDrawingManager';
import { HeaderRibbon } from './ui/HeaderRibbon';
import { ContextualSubheader } from './ui/ContextualSubheader';
import { Sidebar } from './ui/Sidebar';
import { ViewTabsBar } from './ui/ViewTabsBar';
import { FooterStatusBar } from './ui/FooterStatusBar';
import { LEVELS, LEVELS_Y } from './config/structural.config';
import { DIMENSIONS } from './config/dimensions.config';
import { BimDatabase } from './core/database/BimDatabase';
import { BimCategory } from './core/database/BimDatabaseTypes';
import { ScheduleModal } from './ui/ScheduleModal';
import { SelectByIdModal } from './ui/SelectByIdModal';
import { MongoInspectorModal } from './ui/MongoInspectorModal';
import { ContourEditor } from './ui/ContourEditor';
import { applyGeometry } from './tools/structural/ElementGeometry';
import { ProjectController } from './ui/ProjectController';
import { AnalysisPanel } from './ui/AnalysisPanel';
import { DualModelController } from './ui/DualModelController';
import { ExamplesModal } from './ui/ExamplesModal';
import { createExampleProject, examples } from './core/model/ExampleProjects';

async function bootstrap() {
  const viewer = new Viewer();
  // 1. ESCENA LIMPIA: El sistema de grillas inicia vacío
  const gridSystem = new GridSystem(viewer.scene);
  // 2. Sistema de Niveles visible en 3D
  const levelSystem = new LevelSystem(viewer.scene);

  const footer = new FooterStatusBar();
  const preview = new PlacementPreview(viewer.scene);

  const wasm = new WasmBridge();
  await wasm.init();

  const structural = new StructuralManager(viewer.scene, wasm, metrics => {
    footer.updateMetrics(metrics.count, metrics.volume, metrics.durationMs, 60);
  });

  viewer.setFpsCallback(fps => {
    footer.updateMetrics(structural.elementCount, structural.totalVolume, 0, fps);
  });

  const snapping = new SnappingManager(viewer.scene, () => viewer.viewManager.getActiveView());

  let scheduleModal: ScheduleModal;
  let selectByIdModal: SelectByIdModal;
  let mongoInspectorModal: MongoInspectorModal;

  const sidebar = new Sidebar(
    viewer.viewManager,
    (element) => {
      structural.removeElement(element);
      selection.clearSelection();
    },
    (cat) => {
      scheduleModal.open(cat);
    }
  );

  // Función unificada para enfocar, abrir la vista 3D y resaltar un elemento estructural
  const focusAndSelectElementIn3D = (el: ManagedElement) => {
    // 1. Conmutar a la herramienta de selección y limpiar previsualizaciones/estados de dibujo
    if (ribbon) ribbon.setTool('select');
    if (preview) preview.hide();
    gridSystem.selectGrid(null);
    levelSystem.selectLevel(null);

    // 2. Conmutar y abrir la vista 3D general {3D} (si el usuario está en planta o alzado, lo lleva a 3D)
    viewer.viewManager.openView('view-3d');
    const view3d = viewer.viewManager.views.get('view-3d') || viewer.viewManager.getActiveView();
    view3d.modelMode='physical';

    // 3. Forzar actualización de transformaciones en la escena
    el.mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(el.mesh);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    // 4. Calcular el encuadre isométrico 3D óptimo enfocado en el centro del elemento
    const maxDim = Math.max(size.x, size.y, size.z, 2.5);
    const distance = Math.max(maxDim * 2.8, 10.0);

    if (view3d && view3d.controls) {
      view3d.controls.target.copy(center);
      view3d.camera.position.set(
        center.x + distance * 0.75,
        center.y + distance * 0.65,
        center.z + distance * 0.75
      );
      view3d.camera.lookAt(center);
      view3d.controls.update();
    }

    // 5. Resaltar con la malla volumétrica translúcida y caja perimetral cian eléctrico
    selection.select(el);

    // 6. Mostrar panel de propiedades con toda la data BIM del ejemplar
    sidebar.showElementProperties(el);

    const idText = el.elementId ? `(ID: ${el.elementId})` : '';
    footer.setMessage(`Elemento ${el.id} ${idText} enfocado y resaltado en 3D.`);
  };

  // Inicialización de herramientas BIM / Base de Datos Relacional Orientada a Objetos
  scheduleModal = new ScheduleModal(
    (elementIdOrGuid) => {
      const el = structural.registry.findById(elementIdOrGuid);
      if (el) {
        focusAndSelectElementIn3D(el);
      } else {
        footer.setMessage(`Elemento ${elementIdOrGuid} no encontrado en el modelo.`);
      }
    },
    (idToDelete) => {
      const el = structural.registry.findById(idToDelete);
      if (el) {
        structural.removeElement(el);
        selection.clearSelection();
        sidebar.showEmptyProperties();
        footer.setMessage(`Elemento ${el.id} suprimido del modelo.`);
      }
    }
  );

  selectByIdModal = new SelectByIdModal((result) => {
    if (result.type === 'element') {
      const el =
        structural.registry.findById(result.doc.uniqueId) ||
        structural.registry.findById(result.doc.elementId);
      if (el) {
        focusAndSelectElementIn3D(el);
      }
    } else if (result.type === 'grid') {
      const gridDoc = result.doc as import('./core/database/BimDatabaseTypes').BimGridDocument;
      const planView = viewer.viewManager.getAllViews().find(v => v.type === 'plan');
      if (planView) viewer.viewManager.openView(planView.id);
      gridSystem.selectGrid(result.doc.uniqueId);
      const selGrid = gridSystem.getSelectedGrid();
      if (selGrid) {
        sidebar.showGridProperties(
          selGrid,
          () => gridSystem.rebuildSystem(),
          (id) => gridSystem.deleteGrid(id)
        );
      }
      footer.setMessage(`Rejilla ${gridDoc.name} seleccionada por ID.`);
    } else if (result.type === 'level') {
      const lvlDoc = result.doc as import('./core/database/BimDatabaseTypes').BimLevelDocument;
      const elevView =
        viewer.viewManager.getAllViews().find(v => v.type === 'elevation') ||
        viewer.viewManager.views.get('view-3d');
      if (elevView) viewer.viewManager.openView(elevView.id);
      levelSystem.selectLevel(result.doc.uniqueId);
      const selLvl = levelSystem.getSelectedLevel();
      if (selLvl) {
        sidebar.showLevelProperties(
          selLvl,
          (updated) => {
            levelSystem.rebuildMeshes();
            updateRibbonLevelSelector();
          },
          (id) => {
            levelSystem.deleteLevel(id);
            updateRibbonLevelSelector();
          }
        );
      }
      footer.setMessage(`Nivel ${lvlDoc.name} seleccionado por ID.`);
    }
  });

  mongoInspectorModal = new MongoInspectorModal();

  // Enlazar botones de la interfaz de usuario con modales BIM
  document.getElementById('btn-open-schedule')?.addEventListener('click', () => scheduleModal.open('ALL'));
  document.getElementById('btn-open-schedule-view')?.addEventListener('click', () => scheduleModal.open('ALL'));
  document.getElementById('btn-select-by-id')?.addEventListener('click', () => selectByIdModal.open());
  document.getElementById('btn-open-mongo-inspector')?.addEventListener('click', () => mongoInspectorModal.open());
  document.getElementById('btn-export-csv-direct')?.addEventListener('click', () => {
    BimDatabase.getInstance().downloadCsvExport();
    footer.setMessage('Exportación de metrados CSV generada y descargada.');
  });
  document.getElementById('btn-export-json-direct')?.addEventListener('click', () => {
    BimDatabase.getInstance().downloadMongoDump();
    footer.setMessage('Dump BSON/JSON de la BD BIM descargado.');
  });

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

  const tabsBar = new ViewTabsBar(viewer.viewManager);
  viewer.viewManager.setCallbacks(
    (activeView) => {
      footer.setMessage(`Vista activa: ${activeView.title}`);
      sidebar.updateProjectBrowser(levelSystem.getLevels(), activeView.id);
    },
    (views, activeId) => tabsBar.renderTabs(views, activeId)
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

  // Helper para mantener sincronizado el selector de niveles del ribbon superior
  const updateRibbonLevelSelector = () => {
    const sel = document.getElementById('ribbon-level-select') as HTMLSelectElement;
    if (!sel) return;
    const currentLevels = levelSystem.getLevels();
    sel.innerHTML = '';

    if (currentLevels.length === 0) {
      const opt = document.createElement('option');
      opt.value = '-1';
      opt.textContent = '(Sin niveles - Usa Quick Generate o Dibuja)';
      sel.appendChild(opt);
      return;
    }

    currentLevels.forEach((lvl, idx) => {
      const opt = document.createElement('option');
      opt.value = idx.toString();
      const sign = lvl.elevation >= 0 ? '+' : '';
      opt.textContent = `${lvl.name} (${sign}${lvl.elevation.toFixed(2)}m)`;
      if (idx === snapping.activeLevelIdx) {
        opt.selected = true;
      }
      sel.appendChild(opt);
    });
    if (snapping.activeLevelIdx >= currentLevels.length) {
      snapping.activeLevelIdx = Math.max(0, currentLevels.length - 1);
    }
  };

  // Subheader Contextual
  contextualBar = new ContextualSubheader({
    onDrawModeChange: (mode) => {
      gridDrawingManager.setMode(mode);
      footer.setMessage(`Modo dibujo rejilla Revit: ${mode.toUpperCase()}`);
    },
    onOffsetChange: (offset) => {
      gridDrawingManager.setOffset(offset);
      footer.setMessage(`Desfase (Offset): ${offset.toFixed(2)}m`);
    },
    onChainChange: (chain) => {
      gridDrawingManager.setChain(chain);
      footer.setMessage(`Cadena: ${chain ? 'Activada' : 'Desactivada'}`);
    },
    onFilletRadiusChange: (radius) => {
      gridDrawingManager.setFilletRadius(radius);
    },
    onApplyTemplate: (template) => {
      gridSystem.applyTemplate(template);
      footer.setMessage(`Plantilla de rejilla aplicada: ${template}`);
    },
    onQuickGenerate: (h, v, countX, countZ) => {
      gridSystem.quickGenerate(h, v, countX || 5, countZ || 5);
      footer.setMessage(`Rejilla generada: ${h}m × ${v}m (${countX || 5}x${countZ || 5} ejes)`);
    },
    // Acciones de Niveles (Niveles Revit)
    onLevelDrawModeChange: (mode) => {
      levelDrawingManager.setMode(mode);
      footer.setMessage(`Modo colocación nivel: ${mode === 'line' ? 'Línea (2 clics horizontal en alzado)' : 'Pick Line (Desfase desde nivel existente)'}`);
    },
    onLevelOffsetChange: (offset) => {
      levelDrawingManager.setOffset(offset);
      footer.setMessage(`Desfase de nivel: ${offset.toFixed(2)}m`);
    },
    onLevelMakePlanViewChange: (makePlan) => {
      levelDrawingManager.setMakePlanView(makePlan);
      footer.setMessage(`Crear vista de plano de planta asociada: ${makePlan ? 'Activado' : 'Desactivado'}`);
    },
    onApplyLevelTemplate: (template) => {
      const generated = levelSystem.applyTemplate(template);
      updateRibbonLevelSelector();
      viewer.viewManager.syncPlanViews(generated);
      footer.setMessage(`Plantilla de niveles aplicada: ${template.toUpperCase()} (${generated.length} niveles generados)`);
    },
    onQuickGenerateLevels: (config) => {
      const generated = levelSystem.quickGenerate(config);
      updateRibbonLevelSelector();
      if (config.createPlanViews) {
        viewer.viewManager.syncPlanViews(generated);
      }
      footer.setMessage(`⚡ Quick Generate completado: Torre de ${generated.length} niveles generada con éxito.`);
    },
    onAtGrid: () => {
      const tool = ribbon.activeTool;
      if (tool !== 'select' && tool !== 'grid') {
        if (!gridSystem.hasGrids()) {
          gridSystem.loadDefaultTestGrid();
        }
        structural.placeAtGridIntersections(tool, snapping.activeLevelIdx);
        footer.setMessage(`Colocados ${tool.toUpperCase()} en todas las intersecciones.`);
      }
    },
    onCancel: () => {
      ribbon.setTool('select');
    },
    onClearSelection: () => {
      selection.clearSelection();
      gripManager?.clearGrips();
      gridSystem.selectGrid(null);
      levelSystem.selectLevel(null);
      sidebar.showEmptyProperties();
      footer.setMessage('Selección limpiada.');
    },
    onDeleteSelected: () => {
      if (gridSystem.selectedGridId) {
        const id = gridSystem.selectedGridId;
        gridSystem.deleteGrid(id);
        sidebar.showEmptyProperties();
        footer.setMessage(`Rejilla ${id} eliminada.`);
      } else if (levelSystem.selectedLevelId) {
        const id = levelSystem.selectedLevelId;
        levelSystem.deleteLevel(id);
        updateRibbonLevelSelector();
        sidebar.showEmptyProperties();
        footer.setMessage(`Nivel ${id} eliminado.`);
      } else if (selection.selectedElement) {
        gripManager?.clearGrips();
        structural.removeElement(selection.selectedElement);
        selection.clearSelection();
        sidebar.showEmptyProperties();
        footer.setMessage('Elemento estructural eliminado.');
      } else {
        footer.setMessage('No hay ningún elemento seleccionado para eliminar.');
      }
    },
    onToggleGrid: () => {
      const mode = gridSystem.toggleQuick();
      footer.setMessage(`Visibilidad de rejilla: ${mode.toUpperCase()}`);
    },
    // HERRAMIENTAS REVIT AVANZADAS: ALINEAR (AL) Y MATRIZ (AR)
    onStartAlign: () => {
      if (!selection.selectedElement) {
        footer.setMessage('Selecciona primero un elemento estructural para alinear (AL).');
        return;
      }
      modificationTools.startAlign(selection.selectedElement);
      contextualBar.renderAlignBar('Paso 1: Selecciona una rejilla, nivel o arista de referencia');
    },
    onCancelAlign: () => {
      modificationTools.cancelAlign();
      if (selection.selectedElement) {
        const activeLvl = levelSystem.getLevels()[snapping.activeLevelIdx]?.name || 'Nivel Activo';
        contextualBar.updateForSelectedElement(selection.selectedElement, activeLvl);
      } else {
        const activeLvl = levelSystem.getLevels()[snapping.activeLevelIdx]?.name || 'Nivel Activo';
        contextualBar.updateForTool(ribbon.activeTool, activeLvl);
      }
    },
    onStartArray: () => {
      if (!selection.selectedElement) {
        footer.setMessage('Selecciona primero un elemento para crear una matriz (AR).');
        return;
      }
      modificationTools.startArray(selection.selectedElement);
      contextualBar.renderArrayBar(selection.selectedElement);
    },
    onExecuteArray: (options) => {
      if (!selection.selectedElement) return;
      const copies = modificationTools.executeArray(selection.selectedElement, options);
      const activeLvl = levelSystem.getLevels()[snapping.activeLevelIdx]?.name || 'Nivel Activo';
      contextualBar.updateForSelectedElement(selection.selectedElement, activeLvl);
      footer.setMessage(`Matriz Revit ejecutada: ${copies.length} copias generadas en la base de datos.`);
    },
    onCancelArray: () => {
      modificationTools.cancelArray();
      if (selection.selectedElement) {
        const activeLvl = levelSystem.getLevels()[snapping.activeLevelIdx]?.name || 'Nivel Activo';
        contextualBar.updateForSelectedElement(selection.selectedElement, activeLvl);
      } else {
        const activeLvl = levelSystem.getLevels()[snapping.activeLevelIdx]?.name || 'Nivel Activo';
        contextualBar.updateForTool(ribbon.activeTool, activeLvl);
      }
    },
    onToggleColumnStyle: () => {
      const el = selection.selectedElement;
      if (el && el.type === 'column') {
        const def = gripManager.ensureDefinition(el) as ColumnDefinition;
        const isSlanted = def.columnStyle === 'slanted';
        def.columnStyle = isSlanted ? 'vertical' : 'slanted';
        if (def.columnStyle === 'slanted') {
          def.topPoint.x = def.basePoint.x + 1.5;
        } else {
          def.topPoint.x = def.basePoint.x;
          def.topPoint.z = def.basePoint.z;
        }
        const meshData = def.columnStyle === 'slanted'
          ? wasm.createSlantedColumn(def.basePoint, def.topPoint, def.width, def.depth)
          : wasm.createColumn(def.basePoint.x, def.basePoint.z, def.basePoint.y, def.topPoint.y, def.width, def.depth);
        el.mesh.geometry.dispose();
        el.mesh.geometry = meshData.geometry;
        el.line.geometry.dispose();
        el.line.geometry = new THREE.EdgesGeometry(meshData.geometry, 20);
        el.dimensions = `${def.width.toFixed(2)}m × ${def.depth.toFixed(2)}m (${def.columnStyle === 'slanted' ? 'Inclinada 3D' : 'Vertical'})`;
        el.volume = meshData.volume;
        if(el.uniqueId)BimDatabase.getInstance().updateGeometry(el.uniqueId,def);
        gripManager.updateGripsForElement(el);
        selection.refreshHighlight();
        sidebar.showElementProperties(el);
        const activeLvl = levelSystem.getLevels()[snapping.activeLevelIdx]?.name || 'Nivel Activo';
        contextualBar.updateForSelectedElement(el, activeLvl);
        footer.setMessage(`Columna conmutada a estilo: ${def.columnStyle.toUpperCase()}`);
        structural.updateMetrics();
      }
    },
    onStartSketchMode: () => {
      const el = selection.selectedElement;
      if (el) contourEditor.open(el);
    },
    onAddVoidSketch: () => {
      const el = selection.selectedElement;
      if (el && el.type === 'slab') contourEditor.open(el, true);
    },
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

  // Ribbon superior
  let ribbon: HeaderRibbon;
  ribbon = new HeaderRibbon(
    (tool) => {
      snapping.enabled = tool !== 'select' && tool !== 'grid' && tool !== 'level';
      const levelName = LEVELS[snapping.activeLevelIdx]?.name || 'Nivel Activo';

      contextualBar.updateForTool(tool, levelName);

      if (tool === 'grid') {
        // En Revit, las rejillas se dibujan en vistas de planta (Floor Plans)
        const activeView = viewer.viewManager.getActiveView();
        if (activeView.type !== 'plan') {
          const levels = levelSystem.getLevels();
          const activeLevel = levels[snapping.activeLevelIdx] || levels[0];
          let targetPlanId = activeLevel ? `plan-${activeLevel.id}` : 'plan-lvl-1';
          if (!viewer.viewManager.views.has(targetPlanId)) {
            const firstPlan = viewer.viewManager.getAllViews().find(v => v.type === 'plan');
            targetPlanId = firstPlan ? firstPlan.id : 'plan-lvl-1';
          }
          viewer.viewManager.openView(targetPlanId);
          const newActiveView = viewer.viewManager.getActiveView();
          footer.setMessage(`Abriendo vista de planta (${newActiveView.title}) para colocar rejillas.`);
        }
        gridDrawingManager.activate();
        gridDrawingManager.setOffset(contextualBar.currentOffset);
        gridDrawingManager.setChain(contextualBar.isChain);
        levelDrawingManager.deactivate();
        selection.clearSelection();
        preview.hide();
        footer.setMessage('Herramienta Rejilla activa: Clic en planta para trazar ejes.');
      } else if (tool === 'level') {
        gridDrawingManager.deactivate();
        preview.hide();
        selection.clearSelection();
        gridSystem.selectGrid(null);
        // En Revit, los niveles se crean exclusivamente en vistas ortográficas de alzado o sección
        const activeView = viewer.viewManager.getActiveView();
        if (activeView.type !== 'elevation') {
          let targetElevId = 'elev-south';
          if (!viewer.viewManager.views.has(targetElevId)) {
            const firstElev = viewer.viewManager.getAllViews().find(v => v.type === 'elevation');
            targetElevId = firstElev ? firstElev.id : 'elev-south';
          }
          viewer.viewManager.openView(targetElevId);
          const newActiveView = viewer.viewManager.getActiveView();
          footer.setMessage(`Abriendo vista de alzado (${newActiveView.title}) para trazar niveles.`);
        } else {
          footer.setMessage('Herramienta Nivel activa (LL): Haz 2 clics para trazar un nivel o usa Quick Generate.');
        }
        levelDrawingManager.activate();
        levelDrawingManager.setMode(contextualBar.levelDrawMode);
        levelDrawingManager.setOffset(contextualBar.levelOffset);
        levelDrawingManager.setMakePlanView(contextualBar.levelMakePlanView);
      } else {
        gridDrawingManager.deactivate();
        levelDrawingManager.deactivate();
        if (tool === 'select') {
          preview.hide();
          gridSystem.clearHighlight();
          gridSystem.hideGuideLine();
          footer.setMessage('Listo | Modo Selección');
        } else {
          selection.clearSelection();
          selection.clearHover();
          gridSystem.selectGrid(null);
          levelSystem.selectLevel(null);
          footer.setMessage(`Herramienta activa: ${tool.toUpperCase()} (Previsualización activa)`);
        }
      }
    },
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
      examplesModal.open();
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
      snapping.activeLevelIdx = levelIdx;
      gridSystem.setActiveLevel(levelIdx);
      contextualBar.updateForTool(ribbon.activeTool, LEVELS[levelIdx]?.name || '');
    }
  );

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

  // Utilidad de proyección en el plano XZ de la vista activa
  const raycaster = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const intersectPoint = new THREE.Vector3();

  function getPlaneIntersection(e: MouseEvent): THREE.Vector2 | null {
    const activeView = viewer.viewManager.getActiveView();
    if (!activeView) return null;
    const rect = activeView.domElement.getBoundingClientRect();
    if (
      e.clientX < rect.left || e.clientX > rect.right ||
      e.clientY < rect.top || e.clientY > rect.bottom
    ) {
      return null;
    }
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(mouse, activeView.camera);
    const elev = LEVELS_Y[gridSystem.activeLevelIdx] || 0;
    plane.constant = -elev;
    if (raycaster.ray.intersectPlane(plane, intersectPoint)) {
      return new THREE.Vector2(intersectPoint.x, intersectPoint.z);
    }
    return null;
  }

  function getElevationPlaneIntersection(e: MouseEvent): THREE.Vector3 | null {
    const activeView = viewer.viewManager.getActiveView();
    if (!activeView) return null;
    const rect = activeView.domElement.getBoundingClientRect();
    if (
      e.clientX < rect.left || e.clientX > rect.right ||
      e.clientY < rect.top || e.clientY > rect.bottom
    ) {
      return null;
    }
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(mouse, activeView.camera);

    let viewPlane: THREE.Plane;
    if (activeView.id === 'elev-east') {
      viewPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
    } else if (activeView.type === 'elevation' || activeView.id === 'elev-south') {
      viewPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    } else if (activeView.type === '3d') {
      const camDir = new THREE.Vector3();
      activeView.camera.getWorldDirection(camDir);
      camDir.y = 0;
      if (camDir.lengthSq() < 0.001) camDir.set(0, 0, -1);
      camDir.normalize();
      viewPlane = new THREE.Plane(camDir.clone().negate(), 0);
    } else {
      viewPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    }

    const pt = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(viewPlane, pt)) {
      return pt;
    }
    return null;
  }

  // Pointerdown: Detección de agarre de Grip para redimensionamiento grupal alineado y codos
  window.addEventListener('pointerdown', (e) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('#app-header') ||
      target.closest('#app-sidebar') ||
      target.closest('#view-tabs-bar') ||
      target.closest('#app-footer') ||
      target.closest('.view-panel-header')
    ) {
      return;
    }

    const activeView = viewer.viewManager.getActiveView();
    if (!activeView) return;

    const rect = activeView.domElement.getBoundingClientRect();
    if (
      e.clientX < rect.left || e.clientX > rect.right ||
      e.clientY < rect.top || e.clientY > rect.bottom
    ) {
      return;
    }

    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(mouse, activeView.camera);

    // 0. MANIPULADORES DIRECTOS REVIT: Comprobar agarre de Grip interactivo en elementos estructurales
    const gripHit = gripManager?.testPointerIntersection(e);
    if (gripHit) {
      const started = gripManager.startDrag(gripHit, e);
      if (started) {
        if (activeView.controls) activeView.controls.enabled = false;
        const gripType = (gripHit.userData?.gripType || 'control') as string;
        footer.setMessage(`Arrastrando Grip ${gripType.toUpperCase()} en ${selection.selectedElement?.id || 'elemento'}`);
        e.stopPropagation();
        return;
      }
    }

    // Si estamos en Alzado o 3D, verificar agarre de grips y codos de NIVELES
    if (activeView.type === 'elevation' || activeView.type === '3d') {
      // 1. Verificar si se hizo clic en un Grip de Codo de Nivel (Elbow Grip)
      const lvlElbowMeshes = levelSystem.elbowGrips.map(g => g.mesh);
      const lvlElbowHits = raycaster.intersectObjects(lvlElbowMeshes);
      if (lvlElbowHits.length > 0) {
        const hitData = lvlElbowHits[0].object.userData as { levelId: string; end: 'start' | 'end' };
        if (hitData) {
          levelSystem.startElbowDrag(hitData.levelId, hitData.end);
          footer.setMessage('Arrastrando codo de nivel (Ajuste de altura del quiebre activo)');
          e.stopPropagation();
          return;
        }
      }

      // 2. Verificar si se hizo clic en un Grip estándar de Nivel (alargar / achicar nivel)
      const lvlGripMeshes = levelSystem.grips.map(g => g.mesh);
      const lvlGripHits = raycaster.intersectObjects(lvlGripMeshes);
      if (lvlGripHits.length > 0) {
        const hitData = lvlGripHits[0].object.userData as { levelId: string; end: 'start' | 'end' };
        if (hitData) {
          levelSystem.startGripDrag(hitData.levelId, hitData.end);
          footer.setMessage('Arrastrando extremo de nivel (Ajuste de longitud activo)');
          e.stopPropagation();
          return;
        }
      }
      return;
    }

    if (activeView.type !== 'plan') return;

    // 1. Verificar si se hizo clic en un Grip de Codo de Rejilla (Elbow Grip)
    const elbowGripMeshes = gridSystem.elbowGrips.map(g => g.mesh);
    const elbowHits = raycaster.intersectObjects(elbowGripMeshes);
    if (elbowHits.length > 0) {
      const hitElbow = elbowHits[0].object;
      const elbowData = hitElbow.userData as { gridId: string; end: 'start' | 'end' };
      if (elbowData) {
        gridSystem.startElbowDrag(elbowData.gridId, elbowData.end);
        footer.setMessage('Arrastrando codo de rejilla (Ajuste lateral paramétrico activo)');
        e.stopPropagation();
        return;
      }
    }

    // 2. Verificar si se hizo clic en un Grip estándar de alineación
    const gripMeshes = gridSystem.gripHandles.map(g => g.mesh);
    const gripHits = raycaster.intersectObjects(gripMeshes);
    if (gripHits.length > 0) {
      const hitGrip = gripHits[0].object;
      const gripData = hitGrip.userData as { gridId: string; end: 'start' | 'end' };
      if (gripData) {
        gridSystem.startGripDrag(gripData.gridId, gripData.end);
        footer.setMessage('Arrastrando extremo de rejilla (Ajuste grupal de alineación activo)');
        e.stopPropagation();
        return;
      }
    }
  });

  // Pointermove
  window.addEventListener('pointermove', (e) => {
    // 0. MANIPULADORES DIRECTOS REVIT: Arrastre interactivo de Grip de elemento estructural
    if (gripManager?.isDragging) {
      gripManager.updateDrag(
        e,
        gridSystem.getGridX(),
        gridSystem.getGridZ(),
        levelSystem.getLevels().map(l => l.elevation)
      );
      selection.refreshHighlight();
      return;
    }

    if (gripManager?.testPointerIntersection(e)) {
      document.body.style.cursor = 'crosshair';
      return;
    }

    // 0.1 Arrastre de Grips de Niveles (alargar / achicar y mover codos)
    if (levelSystem.isDraggingGrip) {
      const pt = getElevationPlaneIntersection(e);
      if (pt) {
        levelSystem.updateGripDrag(pt);
      }
      return;
    }

    if (levelSystem.isDraggingElbowGrip) {
      const pt = getElevationPlaneIntersection(e);
      if (pt) {
        levelSystem.updateElbowDrag(pt);
      }
      return;
    }

    // 1. Arrastre de Grip estándar de Rejilla
    if (gridSystem.isDraggingGrip) {
      const pt = getPlaneIntersection(e);
      if (pt) {
        gridSystem.updateGripDrag({ x: pt.x, z: pt.y });
      }
      return;
    }

    // 1.1 Arrastre de Grip de Codo de Rejilla
    if (gridSystem.isDraggingElbowGrip) {
      const pt = getPlaneIntersection(e);
      if (pt) {
        gridSystem.updateElbowDrag({ x: pt.x, z: pt.y });
      }
      return;
    }

    // 2. Modo Dibujo de Rejilla
    if (ribbon.activeTool === 'grid') {
      gridDrawingManager.handlePointerMove(e);
      return;
    }

    // 2.1 Modo Dibujo de Nivel
    if (ribbon.activeTool === 'level') {
      levelDrawingManager.handlePointerMove(e);
      return;
    }

    // 3. Selección y Snapping Estructural
    selection.handlePointerMove(e);

    // 4. Hover y previsualización de Rejillas y Niveles en modo Selección
    if (ribbon.activeTool === 'select') {
      // Prioridad Estándar Revit: Si el cursor está sobre un elemento estructural (viga, columna, zapata, losa),
      // no se resalta la rejilla ni el nivel subyacente.
      if (selection.hoveredElement) {
        gridSystem.setHoveredGrid(null);
        levelSystem.setHoveredLevel(null);
        return;
      }

      const activeView = viewer.viewManager.getActiveView();
      if (activeView.type === 'plan') {
        const rect = activeView.domElement.getBoundingClientRect();
        if (
          e.clientX >= rect.left && e.clientX <= rect.right &&
          e.clientY >= rect.top && e.clientY <= rect.bottom
        ) {
          const mouse = new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1
          );
          raycaster.setFromCamera(mouse, activeView.camera);

          // Controles interactivos (Grips, Codos, Checkboxes)
          const gripMeshes = gridSystem.gripHandles.map(g => g.mesh);
          const elbowGripMeshes = gridSystem.elbowGrips.map(g => g.mesh);
          const elbowToggleMeshes = gridSystem.elbowToggles.map(t => t.mesh);
          const toggleMeshes = gridSystem.toggleBoxes.map(t => t.mesh);
          const controlHits = raycaster.intersectObjects([
            ...gripMeshes,
            ...elbowGripMeshes,
            ...elbowToggleMeshes,
            ...toggleMeshes,
          ]);

          const hitMeshes = gridSystem.gridHitMeshes;
          const bubbleSprites = gridSystem.bubbleSprites;
          const hits = raycaster.intersectObjects([...hitMeshes, ...bubbleSprites]);

          if (controlHits.length > 0) {
            document.body.style.cursor = 'pointer';
          } else if (hits.length > 0) {
            const hId = hits[0].object.userData?.gridId || null;
            gridSystem.setHoveredGrid(hId);
            document.body.style.cursor = 'pointer';
          } else {
            // Detección directa de raycast sobre las líneas dasheadas
            const gridLines = gridSystem.getLineMeshes();
            raycaster.params.Line = { threshold: 0.8 };
            const lineHits = raycaster.intersectObjects(gridLines);
            if (lineHits.length > 0) {
              gridSystem.setHoveredGrid(lineHits[0].object.name);
              document.body.style.cursor = 'pointer';
            } else {
              gridSystem.setHoveredGrid(null);
              if (!selection.hoveredElement) {
                document.body.style.cursor = 'default';
              }
            }
          }
        } else {
          gridSystem.setHoveredGrid(null);
          if (!selection.hoveredElement) {
            document.body.style.cursor = 'default';
          }
        }
      } else if (activeView.type === 'elevation' || activeView.type === '3d') {
        const rect = activeView.domElement.getBoundingClientRect();
        if (
          e.clientX >= rect.left && e.clientX <= rect.right &&
          e.clientY >= rect.top && e.clientY <= rect.bottom
        ) {
          const mouse = new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1
          );
          raycaster.setFromCamera(mouse, activeView.camera);

          // Controles de codo, grips y burbuja de niveles
          const lvlGripMeshes = levelSystem.grips.map(g => g.mesh);
          const lvlElbowGripMeshes = levelSystem.elbowGrips.map(g => g.mesh);
          const lvlToggleMeshes = [
            ...levelSystem.elbowToggles.map(t => t.mesh),
            ...levelSystem.bubbleToggles.map(t => t.mesh),
            ...lvlGripMeshes,
            ...lvlElbowGripMeshes,
          ];
          const controlHits = raycaster.intersectObjects(lvlToggleMeshes);

          const lvlHits = raycaster.intersectObjects([
            ...levelSystem.levelHitMeshes,
            ...levelSystem.headsGroup.children,
          ]);
          if (controlHits.length > 0) {
            document.body.style.cursor = 'pointer';
          } else if (lvlHits.length > 0) {
            const hId = lvlHits[0].object.userData?.levelId || null;
            levelSystem.setHoveredLevel(hId);
            document.body.style.cursor = 'pointer';
          } else {
            // Detección directa de raycast sobre las líneas dasheadas de niveles
            const lvlLines = levelSystem.getLineMeshes();
            raycaster.params.Line = { threshold: 1.0 };
            const lineHits = raycaster.intersectObjects(lvlLines);
            if (lineHits.length > 0) {
              const hId = lineHits[0].object.userData?.levelId || lineHits[0].object.name || null;
              levelSystem.setHoveredLevel(hId);
              document.body.style.cursor = 'pointer';
            } else {
              levelSystem.setHoveredLevel(null);
              if (!selection.hoveredElement) {
                document.body.style.cursor = 'default';
              }
            }
          }
        } else {
          levelSystem.setHoveredLevel(null);
          if (!selection.hoveredElement) {
            document.body.style.cursor = 'default';
          }
        }
      } else {
        gridSystem.setHoveredGrid(null);
        levelSystem.setHoveredLevel(null);
        if (!selection.hoveredElement) {
          document.body.style.cursor = 'default';
        }
      }
    } else {
      gridSystem.setHoveredGrid(null);
      levelSystem.setHoveredLevel(null);
    }

    if (snapping.currentSnappedPosition && ribbon.activeTool !== 'select') {
      const { x, z } = snapping.currentSnappedPosition;
      footer.setCoordinates(x, z, snapping.activeLevelIdx * 3.5);

      gridSystem.highlightAxes(x, z);
      gridSystem.hideGuideLine();
      preview.update(
        ribbon.activeTool,
        x,
        z,
        snapping.activeLevelIdx,
        gridSystem.getGridX(),
        gridSystem.getGridZ()
      );
    } else {
      gridSystem.clearHighlight();
      gridSystem.hideGuideLine();
      preview.hide();
    }
  });

  // Pointerup
  const cancelStructuralDrag=()=>{
    if(!gripManager?.isDragging)return;
    gripManager.cancelDrag();
    const view=viewer.viewManager.getActiveView();if(view)view.controls.enabled=true;
    selection.refreshHighlight();
    if(selection.selectedElement)sidebar.showElementProperties(selection.selectedElement);
  };
  window.addEventListener('pointercancel',cancelStructuralDrag);
  window.addEventListener('blur',cancelStructuralDrag);
  window.addEventListener('pointerup', () => {
    // 0. Finalizar arrastre de Grip Estructural
    if (gripManager?.isDragging) {
      gripManager.endDrag();
      const activeView = viewer.viewManager.getActiveView();
      if (activeView && activeView.controls) activeView.controls.enabled = true;
      selection.refreshHighlight();
      if (selection.selectedElement) {
        sidebar.showElementProperties(selection.selectedElement);
      }
    }

    // 0.1 Finalizar arrastre de Grip o Codo de Nivel
    if (levelSystem.isDraggingGrip) {
      levelSystem.endGripDrag();
      footer.setMessage('Longitud de nivel ajustada.');
    }
    if (levelSystem.isDraggingElbowGrip) {
      levelSystem.endElbowDrag();
      footer.setMessage('Codo de nivel ajustado.');
    }

    // 1. Finalizar arrastre de Grip o Codo de Rejilla
    if (gridSystem.isDraggingGrip) {
      gridSystem.endGripDrag();
      footer.setMessage('Alineación de rejilla completada.');
    }
    if (gridSystem.isDraggingElbowGrip) {
      gridSystem.endElbowDrag();
      footer.setMessage('Codo de rejilla ajustado.');
    }
  });

  // Doble clic para edición interactiva del nombre de la burbuja (Revit inline rename)
  window.addEventListener('dblclick', (e) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('#app-header') ||
      target.closest('#app-sidebar') ||
      target.closest('#view-tabs-bar') ||
      target.closest('#app-footer') ||
      target.closest('.view-panel-header') ||
      target.id === 'grid-inline-bubble-input'
    ) {
      return;
    }

    const activeView = viewer.viewManager.getActiveView();
    if (!activeView) return;

    const rect = activeView.domElement.getBoundingClientRect();
    if (
      e.clientX < rect.left || e.clientX > rect.right ||
      e.clientY < rect.top || e.clientY > rect.bottom
    ) {
      return;
    }

    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(mouse, activeView.camera);

    // B. Doble clic en cabezal de Nivel (Edición In-Place de Nombre y Cota en Alzados y 3D)
    if (activeView.type === 'elevation' || activeView.type === '3d') {
      const bubbleMeshes = levelSystem.bubbleHits.map(b => b.mesh);
      const hits = raycaster.intersectObjects(bubbleMeshes);
      if (hits.length > 0) {
        const hitData = hits[0].object.userData as { levelId?: string; end?: 'start' | 'end' };
        if (hitData?.levelId) {
          const hitBubble = levelSystem.bubbleHits.find(b => b.mesh === hits[0].object);
          const worldPos = hitBubble ? hitBubble.worldPos : hits[0].point;
          levelSystem.openInlineEditor(
            hitData.levelId,
            worldPos,
            activeView.camera,
            activeView.domElement,
            () => {
              updateRibbonLevelSelector();
              const selLvl = levelSystem.getSelectedLevel();
              if (selLvl) {
                sidebar.showLevelProperties(
                  selLvl,
                  () => {
                    levelSystem.rebuildMeshes();
                    updateRibbonLevelSelector();
                  },
                  (id) => {
                    levelSystem.deleteLevel(id);
                    updateRibbonLevelSelector();
                  }
                );
              }
              footer.setMessage('Nivel actualizado correctamente.');
            },
            (warning) => footer.setMessage(warning)
          );
          e.stopPropagation();
          return;
        }
      }
      return;
    }

    if (activeView.type !== 'plan') return;

    const bubbleMeshes = gridSystem.bubbleHits.map(b => b.mesh);
    const bubbleSprites = gridSystem.bubbleSprites;
    const hits = raycaster.intersectObjects([...bubbleMeshes, ...bubbleSprites]);

    let targetGridId: string | null = null;
    let targetEnd: 'start' | 'end' | undefined = undefined;

    if (hits.length > 0) {
      const hitObj = hits[0].object;
      const uData = hitObj.userData as { gridId?: string; end?: 'start' | 'end' };
      if (uData?.gridId) {
        targetGridId = uData.gridId;
        targetEnd = uData.end;
      }
    }

    // Si no golpeó directamente una burbuja, verificar si golpeó cerca de una burbuja o en la grilla
    if (!targetGridId) {
      const allGridHits = raycaster.intersectObjects(gridSystem.gridHitMeshes);
      if (allGridHits.length > 0) {
        const hitData = allGridHits[0].object.userData as { gridId?: string; end?: 'start' | 'end'; isBubbleHit?: boolean };
        if (hitData?.gridId && hitData.isBubbleHit) {
          targetGridId = hitData.gridId;
          targetEnd = hitData.end;
        } else if (hitData?.gridId) {
          const hitPoint = allGridHits[0].point;
          const nearestBubble = gridSystem.bubbleHits
            .filter(b => b.gridId === hitData.gridId)
            .sort((a, b) => a.worldPos.distanceTo(hitPoint) - b.worldPos.distanceTo(hitPoint))[0];
          if (nearestBubble && nearestBubble.worldPos.distanceTo(hitPoint) < DIMENSIONS.grid.bubbleDoubleClickMaxDist) {
            targetGridId = nearestBubble.gridId;
            targetEnd = nearestBubble.end;
          }
        }
      }
    }

    if (targetGridId) {
      const opened = gridSystem.openBubbleRename(
        targetGridId,
        targetEnd,
        activeView.camera,
        activeView.domElement,
        (warning) => {
          footer.setMessage(warning);
        }
      );
      if (opened) {
        gridSystem.selectGrid(targetGridId);
        const selGrid = gridSystem.getSelectedGrid();
        if (selGrid) {
          sidebar.showGridProperties(
            selGrid,
            () => gridSystem.rebuildSystem(),
            (id) => gridSystem.deleteGrid(id)
          );
        }
        footer.setMessage('Editando identificador de burbuja. Escribe el nuevo nombre y presiona Enter.');
        e.stopPropagation();
      }
    }
  });

  // Clic en escena
  window.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('#app-header') ||
      target.closest('#app-sidebar') ||
      target.closest('#view-tabs-bar') ||
      target.closest('#app-footer') ||
      target.closest('.view-panel-header')
    ) {
      return;
    }

    const activeView = viewer.viewManager.getActiveView();
    if (!activeView) return;

    // 0. MODO MODIFICAR: HERRAMIENTA ALINEAR (ALIGN - AL)
    if (modificationTools?.isAlignActive) {
      const rect = activeView.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(mouse, activeView.camera);

      if (modificationTools.alignStep === 'pick_reference') {
        // 1. Rejilla
        const gridHits = raycaster.intersectObjects(gridSystem.gridHitMeshes);
        if (gridHits.length > 0) {
          const gId = gridHits[0].object.userData?.gridId as string;
          const grid = gridSystem.elements.find(g => g.id === gId);
          if (grid) {
            const isX = Math.abs(grid.start.x - grid.end.x) < 0.1;
            modificationTools.setReference({
              type: 'grid',
              label: `Eje de Rejilla ${grid.name}`,
              point: { x: grid.start.x, y: 0, z: grid.start.z },
              axis: isX ? 'X' : 'Z',
              coordinate: isX ? grid.start.x : grid.start.z,
            });
            contextualBar.renderAlignBar(`Referencia fija: Eje ${grid.name}. Paso 2: Clic en elemento a alinear.`);
            return;
          }
        }
        // 2. Nivel
        const lvlHits = raycaster.intersectObjects(levelSystem.levelHitMeshes);
        if (lvlHits.length > 0) {
          const lId = lvlHits[0].object.userData?.levelId as string;
          const lvl = levelSystem.getLevels().find(l => l.id === lId);
          if (lvl) {
            modificationTools.setReference({
              type: 'level',
              label: `Nivel ${lvl.name}`,
              point: { x: 0, y: lvl.elevation, z: 0 },
              axis: 'Y',
              coordinate: lvl.elevation,
            });
            contextualBar.renderAlignBar(`Referencia fija: Nivel ${lvl.name}. Paso 2: Clic en elemento a alinear.`);
            return;
          }
        }
        // 3. Arista o cara de elemento estructural
        const elemHits = raycaster.intersectObjects(structural.registry.getMeshes(), true);
        if (elemHits.length > 0) {
          const pt = elemHits[0].point;
          modificationTools.setReference({
            type: 'element_edge',
            label: `Punto de referencia`,
            point: { x: pt.x, y: pt.y, z: pt.z },
            axis: 'X',
            coordinate: pt.x,
          });
          contextualBar.renderAlignBar(`Referencia fija: X=${pt.x.toFixed(2)}m. Paso 2: Clic en elemento a alinear.`);
          return;
        }
      } else if (modificationTools.alignStep === 'pick_target') {
        const elemHits = raycaster.intersectObjects(structural.registry.getMeshes(), true);
        if (elemHits.length > 0) {
          const obj = elemHits[0].object;
          const mesh = (obj instanceof THREE.Mesh ? obj : (obj.parent instanceof THREE.Mesh ? obj.parent : null));
          if (mesh) {
            const elem = structural.registry.findByMesh(mesh);
            if (elem) {
              gripManager.ensureDefinition(elem);
              modificationTools.alignElement(elem);
              selection.select(elem);
              gripManager.updateGripsForElement(elem);
              const activeLvl = levelSystem.getLevels()[snapping.activeLevelIdx]?.name || 'Nivel Activo';
              contextualBar.updateForSelectedElement(elem, activeLvl);
              modificationTools.cancelAlign();
              return;
            }
          }
        }
      }
    }

    // 1. Si está en modo dibujo de rejilla
    if (ribbon.activeTool === 'grid') {
      const handled = gridDrawingManager.handlePointerClick(e);
      if (handled) return;
    }

    // 1.1 Si está en modo dibujo de nivel
    if (ribbon.activeTool === 'level') {
      const handled = levelDrawingManager.handlePointerClick(e);
      if (handled) {
        updateRibbonLevelSelector();
        return;
      }
    }

    // 2. Toggles interactivos de Burbujas y Codos (Checkbox y Elbows de Rejillas y Niveles)
    if (activeView.type === 'plan') {
      const rect = activeView.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(mouse, activeView.camera);

      // A. Comprobar si se hizo clic en una casilla (checkbox) de burbuja
      const toggleMeshes = gridSystem.toggleBoxes.map(t => t.mesh);
      const toggleHits = raycaster.intersectObjects(toggleMeshes);
      if (toggleHits.length > 0) {
        const hitToggle = toggleHits[0].object;
        const toggleData = hitToggle.userData as { gridId: string; end: 'start' | 'end' };
        if (toggleData) {
          gridSystem.toggleBubble(toggleData.gridId, toggleData.end);
          const grid = gridSystem.getSelectedGrid();
          if (grid) {
            sidebar.showGridProperties(
              grid,
              (updated) => {
                gridSystem.rebuildSystem();
              },
              (id) => {
                gridSystem.deleteGrid(id);
              }
            );
          }
          footer.setMessage(`Burbuja de rejilla ${toggleData.end === 'start' ? 'inicial' : 'final'} alternada.`);
          return;
        }
      }

      // A.2 Comprobar si se hizo clic en un icono de Codo (Elbow Toggle Icon estilo Revit)
      const elbowToggleMeshes = gridSystem.elbowToggles.map(t => t.mesh);
      const elbowHits = raycaster.intersectObjects(elbowToggleMeshes);
      if (elbowHits.length > 0) {
        const hitElbow = elbowHits[0].object;
        const elbowData = hitElbow.userData as { gridId: string; end: 'start' | 'end' };
        if (elbowData) {
          gridSystem.toggleElbow(elbowData.gridId, elbowData.end);
          const grid = gridSystem.getSelectedGrid();
          if (grid) {
            sidebar.showGridProperties(
              grid,
              (updated) => {
                gridSystem.rebuildSystem();
              },
              (id) => {
                gridSystem.deleteGrid(id);
              }
            );
          }
          footer.setMessage(`Codo de rejilla ${elbowData.end === 'start' ? 'inicial' : 'final'} alternado.`);
          return;
        }
      }
    } else if (activeView.type === 'elevation' || activeView.type === '3d') {
      const rect = activeView.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(mouse, activeView.camera);

      // A. Clic en Checkbox de Cabezal de Nivel
      const toggleMeshes = levelSystem.bubbleToggles.map(t => t.mesh);
      const toggleHits = raycaster.intersectObjects(toggleMeshes);
      if (toggleHits.length > 0) {
        const hitToggle = toggleHits[0].object;
        const toggleData = hitToggle.userData as { levelId: string; end: 'start' | 'end' };
        if (toggleData) {
          levelSystem.toggleBubble(toggleData.levelId, toggleData.end);
          const lvl = levelSystem.getSelectedLevel();
          if (lvl) {
            sidebar.showLevelProperties(
              lvl,
              (updated) => {
                levelSystem.rebuildMeshes();
                updateRibbonLevelSelector();
              },
              (id) => {
                levelSystem.deleteLevel(id);
                updateRibbonLevelSelector();
              }
            );
          }
          footer.setMessage(`Cabezal de nivel ${toggleData.end === 'start' ? 'inicial' : 'final'} alternado.`);
          return;
        }
      }

      // A.2 Clic en Icono de Codo (Elbow) de Nivel
      const elbowToggleMeshes = levelSystem.elbowToggles.map(t => t.mesh);
      const elbowHits = raycaster.intersectObjects(elbowToggleMeshes);
      if (elbowHits.length > 0) {
        const hitElbow = elbowHits[0].object;
        const elbowData = hitElbow.userData as { levelId: string; end: 'start' | 'end' };
        if (elbowData) {
          levelSystem.toggleElbow(elbowData.levelId, elbowData.end);
          const lvl = levelSystem.getSelectedLevel();
          if (lvl) {
            sidebar.showLevelProperties(
              lvl,
              (updated) => {
                levelSystem.rebuildMeshes();
                updateRibbonLevelSelector();
              },
              (id) => {
                levelSystem.deleteLevel(id);
                updateRibbonLevelSelector();
              }
            );
          }
          footer.setMessage(`Codo de nivel ${elbowData.end === 'start' ? 'inicial' : 'final'} alternado.`);
          return;
        }
      }
    }

    // 3. PRIORIDAD REVIT MODEL-FIRST: Selección de Elementos Estructurales
    // Si el usuario hace clic sobre una viga, columna, losa o zapata, el elemento del modelo
    // tiene prioridad absoluta sobre las líneas o planos de referencia subyacentes (rejillas o niveles).
    if (ribbon.activeTool === 'select') {
      const didSelect = selection.handlePointerClick(e);
      if (didSelect) {
        gridSystem.selectGrid(null);
        levelSystem.selectLevel(null);
        return;
      }
    }

    // 4. SELECCIÓN DE ELEMENTOS DE REFERENCIA (DATUM: REJILLAS Y NIVELES)
    // Solo se evalúa si el usuario NO hizo clic sobre ningún elemento estructural del modelo.
    if (ribbon.activeTool === 'select') {
      const rect = activeView.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(mouse, activeView.camera);

      // 4.1 Comprobar si se hizo clic en una línea de rejilla o burbuja (solo en vistas de planta)
      if (activeView.type === 'plan') {
        const hitMeshes = gridSystem.gridHitMeshes;
        const meshHits = raycaster.intersectObjects(hitMeshes);
        let selectedGridId: string | null = null;

        if (meshHits.length > 0) {
          selectedGridId = (meshHits[0].object.userData?.gridId as string) || null;
        } else {
          const gridLines = gridSystem.getLineMeshes();
          raycaster.params.Line = { threshold: 0.6 };
          const lineHits = raycaster.intersectObjects(gridLines);
          if (lineHits.length > 0) {
            selectedGridId = lineHits[0].object.name;
          }
        }

        if (selectedGridId) {
          gridSystem.selectGrid(selectedGridId);
          levelSystem.selectLevel(null);
          selection.clearSelection();

          const selGrid = gridSystem.getSelectedGrid();
          if (selGrid) {
            sidebar.showGridProperties(
              selGrid,
              (updated) => {
                gridSystem.rebuildSystem();
              },
              (id) => {
                gridSystem.deleteGrid(id);
              }
            );
            footer.setMessage(`Rejilla seleccionada: Eje ${selGrid.name}. Arrastra los círculos en los extremos para alinear.`);
          }
          return;
        }
      }

      // 4.2 Comprobar si se hizo clic en un Nivel (en vistas de alzado o 3D)
      if (activeView.type === 'elevation' || activeView.type === '3d') {
        const lvlHits = raycaster.intersectObjects([
          ...levelSystem.levelHitMeshes,
          ...levelSystem.headsGroup.children,
        ]);
        let selectedLvlId: string | null = null;

        if (lvlHits.length > 0) {
          selectedLvlId = (lvlHits[0].object.userData?.levelId as string) || null;
        } else {
          const lvlLines = levelSystem.getLineMeshes();
          raycaster.params.Line = { threshold: 1.0 };
          const lineHits = raycaster.intersectObjects(lvlLines);
          if (lineHits.length > 0) {
            selectedLvlId = (lineHits[0].object.userData?.levelId as string) || lineHits[0].object.name || null;
          }
        }

        if (selectedLvlId) {
          levelSystem.selectLevel(selectedLvlId);
          gridSystem.selectGrid(null);
          selection.clearSelection();

          const selLvl = levelSystem.getSelectedLevel();
          if (selLvl) {
            sidebar.showLevelProperties(
              selLvl,
              (updated) => {
                levelSystem.rebuildMeshes();
                updateRibbonLevelSelector();
              },
              (id) => {
                levelSystem.deleteLevel(id);
                updateRibbonLevelSelector();
              }
            );
            footer.setMessage(`Nivel seleccionado: ${selLvl.name}. Arrastra los círculos en los extremos para alargar/achicar, o el punto morado para mover el codo.`);
          }
          return;
        }
      }

      // 4.3 Clic en espacio vacío en modo Selección: Deseleccionar todo
      selection.clearSelection();
      gridSystem.selectGrid(null);
      levelSystem.selectLevel(null);
      sidebar.showEmptyProperties();
      return;
    }

    // 5. Colocación de Elementos Estructurales
    if (snapping.currentSnappedPosition) {
      structural.placeSingle(
        ribbon.activeTool,
        snapping.currentSnappedPosition.x,
        snapping.currentSnappedPosition.z,
        snapping.activeLevelIdx
      );
      footer.setMessage(`${ribbon.activeTool.toUpperCase()} colocado en el modelo.`);
    }
  });

  // Atajos de teclado
  let keySeq = '';
  let keySeqTimer: ReturnType<typeof setTimeout> | null = null;
  const analysisPanel = new AnalysisPanel(id => {
    const el=structural.registry.findById(id);if(el)focusAndSelectElementIn3D(el);
  });
  new DualModelController(viewer,structural.registry,selection,analysisPanel,()=>{ribbon.setTool('select');preview.hide();gripManager.clearGrips();});
  const projectController = new ProjectController(structural, levelSystem, gridSystem, wasm, () => {
    selection.clearSelection();gripManager.clearGrips();
    viewer.viewManager.syncPlanViews(levelSystem.getLevels());
    sidebar.updateProjectBrowser(levelSystem.getLevels(),viewer.viewManager.activeViewId);
    updateRibbonLevelSelector();
  }, () => analysisPanel.open(), () => analysisPanel.getSetup(), setup => analysisPanel.restoreSetup(setup));
  await projectController.init();
  const examplesModal=new ExamplesModal(async(id,analyze)=>{
    if(!await projectController.loadExample(createExampleProject(id)))return false;
    ribbon.setTool('select');preview.hide();gridSystem.selectGrid(null);levelSystem.selectLevel(null);
    snapping.activeLevelIdx=0;gridSystem.setActiveLevel(0);sidebar.showEmptyProperties();
    viewer.viewManager.openView('view-3d');
    const view=viewer.viewManager.views.get('view-3d')!;
    const box=new THREE.Box3();structural.registry.getAll().forEach(el=>box.expandByObject(el.mesh));
    const center=box.getCenter(new THREE.Vector3()),radius=Math.max(box.getSize(new THREE.Vector3()).length()/2,3);
    const distance=radius/Math.sin(THREE.MathUtils.degToRad(25))*1.15;
    view.controls.target.copy(center);view.camera.position.copy(center).add(new THREE.Vector3(1,.8,1).normalize().multiplyScalar(distance));view.camera.lookAt(center);view.controls.update();
    footer.setMessage(`${examples.find(e=>e.id===id)!.name}: ${structural.elementCount} elementos / ejemplo no certificado.`);
    if(analyze)setTimeout(()=>analysisPanel.open(),0);
    return true;
  });

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key.toLowerCase() === 'i') {
        e.preventDefault();
        selectByIdModal.open();
        return;
      }
      if (e.key.toLowerCase() === 'm' && e.shiftKey) {
        e.preventDefault();
        mongoInspectorModal.open();
        return;
      }
      if (e.key.toLowerCase() === 's' && e.shiftKey) {
        e.preventDefault();
        scheduleModal.open('ALL');
        return;
      }
    }

    if (e.key === 'Escape') {
      if(gripManager?.isDragging){cancelStructuralDrag();return;}
      if (modificationTools?.isAlignActive) {
        modificationTools.cancelAlign();
        if (selection.selectedElement) {
          const activeLvl = levelSystem.getLevels()[snapping.activeLevelIdx]?.name || 'Nivel Activo';
          contextualBar.updateForSelectedElement(selection.selectedElement, activeLvl);
        }
        footer.setMessage('Alineación cancelada.');
        return;
      }
      if (modificationTools?.isArrayActive) {
        modificationTools.cancelArray();
        if (selection.selectedElement) {
          const activeLvl = levelSystem.getLevels()[snapping.activeLevelIdx]?.name || 'Nivel Activo';
          contextualBar.updateForSelectedElement(selection.selectedElement, activeLvl);
        }
        footer.setMessage('Matriz cancelada.');
        return;
      }
      gridDrawingManager.cancelCurrentDraw();
      levelDrawingManager.cancelCurrentDraw();
      gripManager?.clearGrips();
      ribbon.setTool('select');
      preview.hide();
      gridSystem.clearHighlight();
      gridSystem.hideGuideLine();
      gridSystem.selectGrid(null);
      levelSystem.selectLevel(null);
      selection.clearSelection();
      sidebar.showEmptyProperties();
      footer.setMessage('Modo Selección | Listo');
    }
    const activeEl = document.activeElement;
    const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');
    if (!isTyping && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const k = e.key.toUpperCase();
      if (k.length === 1 && k >= 'A' && k <= 'Z') {
        keySeq += k;
        if (keySeqTimer) clearTimeout(keySeqTimer);
        keySeqTimer = setTimeout(() => { keySeq = ''; }, 1200);

        if (keySeq.endsWith('AL')) {
          keySeq = '';
          if (selection.selectedElement) {
            modificationTools.startAlign(selection.selectedElement);
            contextualBar.renderAlignBar('Paso 1: Selecciona una rejilla, nivel o arista de referencia');
          } else {
            footer.setMessage('Atajo Revit AL: Selecciona primero un elemento estructural para alinear.');
          }
        } else if (keySeq.endsWith('AR')) {
          keySeq = '';
          if (selection.selectedElement) {
            modificationTools.startArray(selection.selectedElement);
            contextualBar.renderArrayBar(selection.selectedElement);
          } else {
            footer.setMessage('Atajo Revit AR: Selecciona primero un elemento para crear una matriz.');
          }
        }
      }

      if (e.key.toLowerCase() === 'l') {
        ribbon.setTool('level');
      } else if (e.key.toLowerCase() === 'g') {
        ribbon.setTool('grid');
      }
    }
    if ((e.key === 'Delete' || e.key === 'Backspace')) {
      if (gridSystem.selectedGridId) {
        const id = gridSystem.selectedGridId;
        gridSystem.deleteGrid(id);
        sidebar.showEmptyProperties();
        footer.setMessage(`Rejilla ${id} eliminada.`);
      } else if (levelSystem.selectedLevelId) {
        const id = levelSystem.selectedLevelId;
        levelSystem.deleteLevel(id);
        updateRibbonLevelSelector();
        sidebar.showEmptyProperties();
        footer.setMessage(`Nivel ${id} eliminado.`);
      } else if (selection.selectedElement) {
        structural.removeElement(selection.selectedElement);
        selection.clearSelection();
        sidebar.showEmptyProperties();
        footer.setMessage('Elemento eliminado.');
      }
    }
  });
}

bootstrap();
