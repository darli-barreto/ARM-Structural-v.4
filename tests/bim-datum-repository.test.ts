import { expect, test } from 'bun:test';
import { BimDatabase } from '../src/core/database/BimDatabase';

test('BimDatabase mantiene su fachada de rejillas/niveles con búsqueda, revisión y eventos', () => {
  const database = BimDatabase.getInstance();
  const changes: string[] = [];
  const unsubscribe = database.subscribe(action => changes.push(action));
  const gridId = '__repository_grid__';
  const levelId = '__repository_level__';

  try {
    const grid = database.syncGrid({
      id: gridId,
      name: 'GX',
      geomType: 'line',
      start: { x: 0, z: 0 },
      end: { x: 8, z: 0 },
    });
    const level = database.syncLevel({ id: levelId, name: 'Nivel repo', elevation: 3.5 });
    expect(database.searchAnyById(gridId)).toMatchObject({ type: 'grid', doc: { uniqueId: grid.uniqueId } });
    expect(database.searchAnyById(String(grid.elementId))).toMatchObject({ type: 'grid', doc: { uniqueId: grid.uniqueId } });
    expect(database.searchAnyById(levelId)).toMatchObject({ type: 'level', doc: { uniqueId: level.uniqueId } });
    expect(database.searchAnyById(level.uniqueId)).toMatchObject({ type: 'level', doc: { elementId: level.elementId } });

    const updatedGrid = database.syncGrid({
      id: gridId,
      name: 'GX2',
      geomType: 'line',
      start: { x: 0, z: 1 },
      end: { x: 9, z: 1 },
    });
    const updatedLevel = database.syncLevel({ id: levelId, name: 'Nivel repo 2', elevation: 4 });
    expect(updatedGrid.elementId).toBe(grid.elementId);
    expect(updatedGrid.metadata.version).toBe(2);
    expect(updatedLevel.elementId).toBe(level.elementId);
    expect(updatedLevel.metadata.version).toBe(2);
    expect(database.getGridByGuid(grid.uniqueId)?.name).toBe('GX2');
    expect(database.getLevelByElementId(level.elementId)?.name).toBe('Nivel repo 2');

    expect(database.deleteGrid(gridId)).toBe(true);
    expect(database.deleteLevel(levelId)).toBe(true);
    expect(database.searchAnyById(gridId)).toBeUndefined();
    expect(database.searchAnyById(levelId)).toBeUndefined();
    expect(changes).toEqual(['insert', 'insert', 'update', 'update', 'delete', 'delete']);
  } finally {
    unsubscribe();
    database.deleteGrid(gridId);
    database.deleteLevel(levelId);
  }
});
