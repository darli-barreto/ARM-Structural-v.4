import type { BimElementDocument, BimGridDocument, BimLevelDocument, BimTypeParameters } from './BimDatabaseTypes';

export interface BimDatabaseExportSnapshot {
  elements: Iterable<BimElementDocument>;
  grids: Iterable<BimGridDocument>;
  levels: Iterable<BimLevelDocument>;
  types: Iterable<[string, BimTypeParameters]>;
}

export function exportMongoDump(snapshot: BimDatabaseExportSnapshot, exportedAt = new Date()): string {
  const elements = Array.from(snapshot.elements);
  const grids = Array.from(snapshot.grids);
  const levels = Array.from(snapshot.levels);
  const types = Array.from(snapshot.types);
  const dump = {
    database: 'bim_structural_db',
    exportedAt: exportedAt.toISOString(),
    version: '2.0.0',
    schemaStandard: 'OpenBIM IFC4 / Autodesk Revit Schema',
    collections: {
      elements,
      grids,
      levels,
      types: types.map(([key, value]) => ({ _id: key, ...value })),
    },
    stats: {
      totalElements: elements.length,
      totalGrids: grids.length,
      totalLevels: levels.length,
      totalTypes: types.length,
      totalVolume: Number(elements.reduce((sum, element) => sum + element.instanceParameters.volume, 0).toFixed(3)),
      totalSurfaceArea: Number(elements.reduce((sum, element) => sum + element.instanceParameters.surfaceArea, 0).toFixed(2)),
      totalEstimatedCost: Number(elements.reduce((sum, element) => sum + element.instanceParameters.estimatedCost, 0).toFixed(2)),
    },
  };

  return JSON.stringify(dump, null, 2);
}
