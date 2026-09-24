import type {
  BimElementDocument,
  GroupedScheduleRow,
  ScheduleQueryOptions,
  ScheduleSummary,
} from './BimDatabaseTypes';

export interface ScheduleQueryResult {
  records: BimElementDocument[];
  groupedRecords?: GroupedScheduleRow[];
  summary: ScheduleSummary;
}

export function querySchedule(
  elements: Iterable<BimElementDocument>,
  options: ScheduleQueryOptions = {},
): ScheduleQueryResult {
  let list = Array.from(elements);

  if (options.category && options.category !== 'ALL') {
    list = list.filter(element => element.category === options.category);
  }
  if (options.levelName && options.levelName !== 'ALL') {
    list = list.filter(element => element.levelName === options.levelName);
  }
  if (options.sector && options.sector !== 'ALL') {
    list = list.filter(element => element.instanceParameters.sector === options.sector);
  }
  if (options.search) {
    const query = options.search.toLowerCase();
    list = list.filter(element =>
      element.elementId.toString().includes(query) ||
      element.uniqueId.toLowerCase().includes(query) ||
      element.instanceParameters.mark.toLowerCase().includes(query) ||
      element.familyType.toLowerCase().includes(query) ||
      element.categoryName.toLowerCase().includes(query) ||
      element.levelName.toLowerCase().includes(query),
    );
  }

  list.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    if (a.levelName !== b.levelName) return a.levelName.localeCompare(b.levelName);
    return a.elementId - b.elementId;
  });

  const summary = list.reduce<ScheduleSummary>((result, element) => {
    result.totalCount += 1;
    result.totalVolume += element.instanceParameters.volume;
    result.totalSurfaceArea += element.instanceParameters.surfaceArea;
    result.totalCost += element.instanceParameters.estimatedCost;
    return result;
  }, { totalCount: 0, totalVolume: 0, totalSurfaceArea: 0, totalCost: 0 });

  summary.totalVolume = Number(summary.totalVolume.toFixed(3));
  summary.totalSurfaceArea = Number(summary.totalSurfaceArea.toFixed(2));
  summary.totalCost = Number(summary.totalCost.toFixed(2));

  let groupedRecords: GroupedScheduleRow[] | undefined;
  if (options.groupByType) {
    const groups = new Map<string, GroupedScheduleRow>();
    list.forEach(element => {
      const key = `${element.typeId}:${element.instanceParameters.concreteStrength}`;
      let group = groups.get(key);
      if (!group) {
        group = {
          typeId: element.typeId,
          familyType: element.familyType,
          categoryName: element.categoryName,
          category: element.category,
          count: 0,
          levelNames: [],
          sectors: [],
          avgConcreteStrength: element.instanceParameters.concreteStrength,
          totalVolume: 0,
          totalSurfaceArea: 0,
          totalCost: 0,
          guids: [],
        };
        groups.set(key, group);
      }
      group.count += 1;
      group.totalVolume += element.instanceParameters.volume;
      group.totalSurfaceArea += element.instanceParameters.surfaceArea;
      group.totalCost += element.instanceParameters.estimatedCost;
      group.guids.push(element.uniqueId);
      if (!group.levelNames.includes(element.levelName)) group.levelNames.push(element.levelName);
      if (!group.sectors.includes(element.instanceParameters.sector)) group.sectors.push(element.instanceParameters.sector);
    });

    groupedRecords = Array.from(groups.values()).map(group => ({
      ...group,
      totalVolume: Number(group.totalVolume.toFixed(3)),
      totalSurfaceArea: Number(group.totalSurfaceArea.toFixed(2)),
      totalCost: Number(group.totalCost.toFixed(2)),
    }));
  }

  return { records: list, groupedRecords, summary };
}

export function exportScheduleCsv(records: BimElementDocument[]): string {
  const headers = [
    'Element ID', 'UniqueId (GUID)', 'Categoría', 'Familia', 'Tipo', 'Código / Marca',
    'Nivel Base', 'Sector', 'Fase', 'Longitud/Altura (m)', 'Volumen (m3)',
    'Encofrado (m2)', "f'c (kg/cm2)", 'Costo Est. ($)',
  ];
  const rows = records.map(element => [
    element.elementId,
    element.uniqueId,
    `"${element.categoryName}"`,
    `"${element.family}"`,
    `"${element.familyType}"`,
    `"${element.instanceParameters.mark}"`,
    `"${element.levelName}"`,
    `"${element.instanceParameters.sector}"`,
    `"${element.instanceParameters.phase}"`,
    (element.instanceParameters.height || element.instanceParameters.length || 0).toFixed(2),
    element.instanceParameters.volume.toFixed(3),
    element.instanceParameters.surfaceArea.toFixed(2),
    element.instanceParameters.concreteStrength,
    element.instanceParameters.estimatedCost.toFixed(2),
  ]);

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}
