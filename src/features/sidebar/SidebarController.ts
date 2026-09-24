import { ManagedElement } from '../../tools/structural/types';
import { ViewManager } from '../../core/views/ViewManager';
import { GridElement } from '../../config/structural.config';
import { Level } from '../../core/level/types/LevelTypes';
import { LevelQuickGenerator } from '../../core/level/generator/LevelQuickGenerator';
import { BimDatabase } from '../../core/database/BimDatabase';
import { BimCategory, BimGridDocument, BimLevelDocument } from '../../core/database/BimDatabaseTypes';
import { requestSidebarTab } from './SidebarNavigationBridge';
import { OPEN_PROJECT_VIEW_EVENT } from '../project-browser/ProjectBrowserBridge';
import { projectBrowserStore } from '../project-browser/ProjectBrowserStore';
import {
  SIDEBAR_PROPERTIES_ACTION_EVENT,
  type ElementPropertiesAction,
  levelPropertiesFromModel,
  sidebarPropertiesStore,
  type SidebarPropertiesAction,
} from '../properties/SidebarPropertiesStore';

export class Sidebar {
  private currentElement: ManagedElement | null = null;
  private currentGrid: GridElement | null = null;
  private currentLevel: Level | null = null;
  private gridActions: { onUpdate: (grid: GridElement) => void; onDelete: (id: string) => void } | null = null;
  private levelActions: { onUpdate: (level: Level) => void; onDelete: (id: string) => void } | null = null;
  private unsubscribeDatabase: (() => void) | null = null;
  private openProjectView = (event: Event) => {
    const viewId = (event as CustomEvent<string>).detail;
    if (viewId) this.viewManager.openView(viewId);
  };
  private handlePropertiesAction = (event: Event) => {
    const action = (event as CustomEvent<SidebarPropertiesAction>).detail;
    if (action.type.startsWith('grid-')) this.applyGridPropertiesAction(action as Extract<SidebarPropertiesAction, { id: string }>);
    else if (action.type.startsWith('level-')) this.applyLevelPropertiesAction(action as Extract<SidebarPropertiesAction, { id: string }>);
    else this.applyElementPropertiesAction(action as ElementPropertiesAction);
  };

  constructor(
    private viewManager: ViewManager,
    private onDeleteRequested: (element: ManagedElement) => void,
    private onOpenSchedule?: (category: BimCategory | 'ALL') => void
  ) {
    window.addEventListener(OPEN_PROJECT_VIEW_EVENT, this.openProjectView);
    window.addEventListener(SIDEBAR_PROPERTIES_ACTION_EVENT, this.handlePropertiesAction);
    this.showEmptyProperties();

    // Suscribirse a cambios en la base de datos BIM para refrescar la paleta si el elemento seleccionado cambia
    this.unsubscribeDatabase = BimDatabase.getInstance().subscribe(() => {
      if (this.currentElement) {
        this.publishElementProperties(this.currentElement);
      }
    });
  }

  public dispose(): void {
    window.removeEventListener(OPEN_PROJECT_VIEW_EVENT, this.openProjectView);
    window.removeEventListener(SIDEBAR_PROPERTIES_ACTION_EVENT, this.handlePropertiesAction);
    this.unsubscribeDatabase?.();
    this.unsubscribeDatabase = null;
  }

  /**
   * Sincroniza reactivamente el Navegador de Proyectos con los niveles del proyecto
   */
  public updateProjectBrowser(levels: Level[], activeViewId: string): void {
    projectBrowserStore.update(levels, this.viewManager.getAllViews(), activeViewId);
  }

  public showElementProperties(element: ManagedElement): void {
    this.currentElement = element;
    this.currentGrid = null;
    this.currentLevel = null;
    this.gridActions = null;
    this.levelActions = null;
    this.publishElementProperties(element);
    requestSidebarTab('properties');
  }

  private publishElementProperties(element: ManagedElement): void {
    const db = BimDatabase.getInstance();
    const doc = (element.uniqueId ? db.getByGuid(element.uniqueId) : undefined) || db.getByLegacyId(element.id);
    if (!doc) {
      this.showEmptyProperties();
      return;
    }

    const icons: Record<ManagedElement['type'], string> = {
      footing: '🧱',
      column: '🏛️',
      beam: '📏',
      slab: '🏠',
    };
    const params = doc.instanceParameters;
    sidebarPropertiesStore.setElement({
      id: doc.uniqueId,
      uniqueId: doc.uniqueId,
      elementId: String(doc.elementId),
      icon: icons[element.type],
      familyType: doc.familyType,
      categoryName: doc.categoryName,
      family: doc.family,
      ifcEntity: doc.metadata.ifcEntity,
      material: doc.typeParameters.defaultMaterial,
      unitCost: doc.typeParameters.unitCost,
      mark: params.mark,
      sector: params.sector,
      concreteStrength: params.concreteStrength,
      phase: params.phase,
      baseOffset: params.baseOffset,
      levelName: doc.levelName,
      dimensions: doc.geometry.dimensionsString,
      quantityState: params.quantityState ?? 'pending',
      volume: params.volume,
      grossVolume: params.grossVolume ?? params.volume,
      overlapVolume: params.overlapVolume ?? null,
      steelMass: params.steelMass ?? null,
      surfaceArea: params.surfaceArea,
      estimatedCost: params.estimatedCost,
      category: doc.category,
    });
  }

  private applyElementPropertiesAction(action: ElementPropertiesAction): void {
    const element = this.currentElement;
    if (!element || !element.uniqueId || action.id !== element.uniqueId) return;
    const db = BimDatabase.getInstance();
    const doc = db.getByGuid(element.uniqueId);
    if (!doc) return;

    switch (action.type) {
      case 'element-mark':
        if (action.value.trim()) db.updateInstanceParameters(doc.uniqueId, { mark: action.value.trim() });
        return;
      case 'element-sector':
        db.updateInstanceParameters(doc.uniqueId, { sector: action.value });
        return;
      case 'element-concrete-strength':
        db.updateInstanceParameters(doc.uniqueId, { concreteStrength: action.value });
        return;
      case 'element-phase':
        db.updateInstanceParameters(doc.uniqueId, { phase: action.value });
        return;
      case 'element-base-offset': {
        const value = Number.parseFloat(action.value);
        if (Number.isFinite(value)) db.updateInstanceParameters(doc.uniqueId, { baseOffset: value });
        return;
      }
      case 'element-open-schedule':
        this.onOpenSchedule?.(doc.category);
        return;
      case 'element-delete':
        this.onDeleteRequested(element);
        this.showEmptyProperties();
        return;
    }
  }

  private publishGridProperties(grid: GridElement): void {
    const db = BimDatabase.getInstance();
    const gridDoc = db.getGridByGuid(grid.id) || (db.searchAnyById(grid.id)?.doc as BimGridDocument | undefined);
    const length = grid.geomType === 'line'
      ? Math.hypot(grid.end.x - grid.start.x, grid.end.z - grid.start.z).toFixed(2)
      : ((grid.radius || 10) * Math.abs((grid.endAngle || Math.PI) - (grid.startAngle || 0))).toFixed(2);

    sidebarPropertiesStore.setGrid({
      id: grid.id,
      uniqueId: gridDoc?.uniqueId ?? null,
      elementId: String(gridDoc?.elementId || grid.id),
      name: grid.name,
      family: gridDoc?.family || 'Rejilla Estándar Circular 6.5mm',
      geomType: grid.geomType,
      length,
      radius: grid.radius ?? null,
      showStartBubble: grid.showStartBubble,
      showEndBubble: grid.showEndBubble,
      isLocked: grid.isLocked !== false,
      startElbowActive: Boolean(grid.startElbow?.active),
      endElbowActive: Boolean(grid.endElbow?.active),
    });
  }

  private publishLevelProperties(level: Level): void {
    const db = BimDatabase.getInstance();
    const levelDoc = db.getLevelByGuid(level.id) || (db.searchAnyById(level.id)?.doc as BimLevelDocument | undefined);
    sidebarPropertiesStore.setLevel(levelPropertiesFromModel(level, {
      uniqueId: levelDoc?.uniqueId ?? null,
      elementId: String(levelDoc?.elementId || level.id),
      formattedElevation: LevelQuickGenerator.formatElevation(level.elevation),
      family: levelDoc?.family || 'Nivel con Cota 8mm',
    }));
  }

  private applyGridPropertiesAction(action: SidebarPropertiesAction): void {
    const grid = this.currentGrid;
    const callbacks = this.gridActions;
    if (!grid || !callbacks || action.id !== grid.id) return;
    const db = BimDatabase.getInstance();
    const gridDoc = db.getGridByGuid(grid.id) || (db.searchAnyById(grid.id)?.doc as BimGridDocument | undefined);

    switch (action.type) {
      case 'grid-name':
        grid.name = action.value;
        if (gridDoc) gridDoc.name = grid.name;
        callbacks.onUpdate(grid);
        break;
      case 'grid-bubble':
        if (action.end === 'start') grid.showStartBubble = action.value;
        else grid.showEndBubble = action.value;
        callbacks.onUpdate(grid);
        break;
      case 'grid-lock':
        grid.isLocked = action.value;
        callbacks.onUpdate(grid);
        break;
      case 'grid-elbow': {
        const elbow = action.end === 'start' ? grid.startElbow : grid.endElbow;
        if (elbow) elbow.active = action.value;
        else if (action.end === 'start') grid.startElbow = { active: action.value, lateralOffset: -2.5, breakDistance: 4.0 };
        else grid.endElbow = { active: action.value, lateralOffset: -2.5, breakDistance: 4.0 };
        callbacks.onUpdate(grid);
        break;
      }
      case 'grid-delete':
        callbacks.onDelete(grid.id);
        this.showEmptyProperties();
        return;
      default:
        return;
    }
    this.publishGridProperties(grid);
  }

  private applyLevelPropertiesAction(action: SidebarPropertiesAction): void {
    const level = this.currentLevel;
    const callbacks = this.levelActions;
    if (!level || !callbacks || action.id !== level.id) return;
    const db = BimDatabase.getInstance();
    const levelDoc = db.getLevelByGuid(level.id) || (db.searchAnyById(level.id)?.doc as BimLevelDocument | undefined);

    switch (action.type) {
      case 'level-name': {
        const name = action.value.trim();
        if (!name) return;
        level.name = `${name} (${LevelQuickGenerator.formatElevation(level.elevation)})`;
        if (levelDoc) levelDoc.name = level.name;
        callbacks.onUpdate(level);
        break;
      }
      case 'level-elevation': {
        const value = Number.parseFloat(action.value);
        if (!Number.isFinite(value)) return;
        level.elevation = Number(value.toFixed(2));
        const name = level.name.split('(')[0]?.trim() || level.name;
        level.name = `${name} (${LevelQuickGenerator.formatElevation(level.elevation)})`;
        if (levelDoc) {
          levelDoc.elevation = level.elevation;
          levelDoc.name = level.name;
        }
        callbacks.onUpdate(level);
        break;
      }
      case 'level-bubble':
        if (action.end === 'start') level.showStartBubble = action.value;
        else level.showEndBubble = action.value;
        callbacks.onUpdate(level);
        break;
      case 'level-lock':
        level.isLocked = action.value;
        callbacks.onUpdate(level);
        break;
      case 'level-elbow': {
        const elbow = action.end === 'start' ? level.startElbow : level.endElbow;
        if (elbow) elbow.active = action.value;
        else if (action.end === 'start') level.startElbow = { active: action.value, verticalOffset: 0.8, breakDistance: 3.0 };
        else level.endElbow = { active: action.value, verticalOffset: 0.8, breakDistance: 3.0 };
        callbacks.onUpdate(level);
        break;
      }
      case 'level-delete':
        callbacks.onDelete(level.id);
        this.showEmptyProperties();
        return;
      default:
        return;
    }
    this.publishLevelProperties(level);
  }

  public showGridProperties(
    grid: GridElement,
    onUpdate: (updatedGrid: GridElement) => void,
    onDelete: (gridId: string) => void
  ): void {
    this.currentElement = null;
    this.currentGrid = grid;
    this.currentLevel = null;
    this.gridActions = { onUpdate, onDelete };
    this.levelActions = null;
    this.publishGridProperties(grid);
    requestSidebarTab('properties');
  }

  public showLevelProperties(
    level: Level,
    onUpdate: (updated: Level) => void,
    onDelete: (id: string) => void
  ): void {
    this.currentElement = null;
    this.currentGrid = null;
    this.currentLevel = level;
    this.gridActions = null;
    this.levelActions = { onUpdate, onDelete };
    this.publishLevelProperties(level);
    requestSidebarTab('properties');
  }

  public showEmptyProperties(): void {
    this.currentElement = null;
    this.currentGrid = null;
    this.currentLevel = null;
    this.gridActions = null;
    this.levelActions = null;
    sidebarPropertiesStore.setEmpty();
  }
}
