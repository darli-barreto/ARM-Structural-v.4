import type { BimGridDocument, BimLevelDocument } from './BimDatabaseTypes';

type DatumChangeAction = 'insert' | 'update' | 'delete';
type DatumDocument = BimGridDocument | BimLevelDocument;

export interface GridSyncInput {
  id: string;
  name: string;
  geomType: 'line' | 'arc';
  start: { x: number; z: number };
  end: { x: number; z: number };
  length?: number;
  showStartBubble?: boolean;
  showEndBubble?: boolean;
  isLocked?: boolean;
}

export interface LevelSyncInput {
  id: string;
  name: string;
  elevation: number;
  hasPlanView?: boolean;
}

export class BimDatumRepository {
  private grids = new Map<string, BimGridDocument>();
  private gridRuntimeIdMap = new Map<string, string>();
  private gridElementIdMap = new Map<number, string>();
  private levels = new Map<string, BimLevelDocument>();
  private levelRuntimeIdMap = new Map<string, string>();
  private levelElementIdMap = new Map<number, string>();

  constructor(
    private allocateElementId: () => number,
    private createGuid: () => string,
    private notify: (action: DatumChangeAction, document: DatumDocument) => void,
  ) {}

  public syncGrid(grid: GridSyncInput): BimGridDocument {
    const existingGuid = this.gridRuntimeIdMap.get(grid.id);
    const now = new Date().toISOString();
    const length = grid.length || Number(Math.hypot(grid.end.x - grid.start.x, grid.end.z - grid.start.z).toFixed(2));

    if (existingGuid && this.grids.has(existingGuid)) {
      const document = this.grids.get(existingGuid)!;
      document.name = grid.name;
      document.geomType = grid.geomType;
      document.start = { x: grid.start.x, y: 0, z: grid.start.z };
      document.end = { x: grid.end.x, y: 0, z: grid.end.z };
      document.length = length;
      document.showStartBubble = grid.showStartBubble !== false;
      document.showEndBubble = grid.showEndBubble !== false;
      document.isLocked = grid.isLocked !== false;
      document.metadata.updatedAt = now;
      document.metadata.version += 1;
      this.notify('update', document);
      return document;
    }

    const guid = this.createGuid();
    const elementId = this.allocateElementId();
    const document: BimGridDocument = {
      _id: guid,
      elementId,
      uniqueId: guid,
      category: 'OST_Grids',
      categoryName: 'Rejillas',
      family: 'Rejilla Estándar Circular 6.5mm',
      name: grid.name,
      geomType: grid.geomType,
      start: { x: grid.start.x, y: 0, z: grid.start.z },
      end: { x: grid.end.x, y: 0, z: grid.end.z },
      length,
      showStartBubble: grid.showStartBubble !== false,
      showEndBubble: grid.showEndBubble !== false,
      isLocked: grid.isLocked !== false,
      metadata: {
        createdAt: now,
        updatedAt: now,
        version: 1,
        software: 'Autodesk Revit Compatible BIM Engine v2026',
        ifcEntity: 'IfcGrid',
      },
    };
    this.grids.set(guid, document);
    this.gridRuntimeIdMap.set(grid.id, guid);
    this.gridElementIdMap.set(elementId, guid);
    this.notify('insert', document);
    return document;
  }

  public deleteGrid(gridId: string): boolean {
    const guid = this.gridRuntimeIdMap.get(gridId);
    if (!guid) return false;
    const document = this.grids.get(guid);
    if (!document) return false;
    this.grids.delete(guid);
    this.gridRuntimeIdMap.delete(gridId);
    this.gridElementIdMap.delete(document.elementId);
    this.notify('delete', document);
    return true;
  }

  public clearGrids(): void {
    this.grids.clear();
    this.gridRuntimeIdMap.clear();
    this.gridElementIdMap.clear();
  }

  public getAllGrids(): BimGridDocument[] { return Array.from(this.grids.values()); }
  public getGridByElementId(elementId: number): BimGridDocument | undefined {
    const guid = this.gridElementIdMap.get(elementId);
    return guid ? this.grids.get(guid) : undefined;
  }
  public getGridByGuid(guid: string): BimGridDocument | undefined { return this.grids.get(guid); }
  public getGridByRuntimeId(id: string): BimGridDocument | undefined {
    const guid = this.gridRuntimeIdMap.get(id);
    return guid ? this.grids.get(guid) : undefined;
  }

  public syncLevel(level: LevelSyncInput): BimLevelDocument {
    const existingGuid = this.levelRuntimeIdMap.get(level.id);
    const now = new Date().toISOString();
    if (existingGuid && this.levels.has(existingGuid)) {
      const document = this.levels.get(existingGuid)!;
      document.name = level.name;
      document.elevation = level.elevation;
      document.hasFloorPlan = level.hasPlanView !== false;
      document.metadata.updatedAt = now;
      document.metadata.version += 1;
      this.notify('update', document);
      return document;
    }

    const guid = this.createGuid();
    const elementId = this.allocateElementId();
    const document: BimLevelDocument = {
      _id: guid,
      elementId,
      uniqueId: guid,
      category: 'OST_Levels',
      categoryName: 'Niveles',
      family: 'Nivel con Cota 8mm',
      name: level.name,
      elevation: level.elevation,
      hasFloorPlan: level.hasPlanView !== false,
      metadata: {
        createdAt: now,
        updatedAt: now,
        version: 1,
        software: 'Autodesk Revit Compatible BIM Engine v2026',
        ifcEntity: 'IfcBuildingStorey',
      },
    };
    this.levels.set(guid, document);
    this.levelRuntimeIdMap.set(level.id, guid);
    this.levelElementIdMap.set(elementId, guid);
    this.notify('insert', document);
    return document;
  }

  public deleteLevel(levelId: string): boolean {
    const guid = this.levelRuntimeIdMap.get(levelId);
    if (!guid) return false;
    const document = this.levels.get(guid);
    if (!document) return false;
    this.levels.delete(guid);
    this.levelRuntimeIdMap.delete(levelId);
    this.levelElementIdMap.delete(document.elementId);
    this.notify('delete', document);
    return true;
  }

  public clearLevels(): void {
    this.levels.clear();
    this.levelRuntimeIdMap.clear();
    this.levelElementIdMap.clear();
  }

  public getAllLevels(): BimLevelDocument[] { return Array.from(this.levels.values()); }
  public getLevelByElementId(elementId: number): BimLevelDocument | undefined {
    const guid = this.levelElementIdMap.get(elementId);
    return guid ? this.levels.get(guid) : undefined;
  }
  public getLevelByGuid(guid: string): BimLevelDocument | undefined { return this.levels.get(guid); }
  public getLevelByRuntimeId(id: string): BimLevelDocument | undefined {
    const guid = this.levelRuntimeIdMap.get(id);
    return guid ? this.levels.get(guid) : undefined;
  }
}
