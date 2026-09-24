import { expect, test } from 'bun:test';
import { ApplicationReferenceEventController } from '../src/features/application/ApplicationReferenceEventController';
import type { GridSystem } from '../src/core/GridSystem';
import type { LevelSystem } from '../src/core/LevelSystem';
import type { Viewer } from '../src/core/Viewer';
import type { StructuralManager } from '../src/tools/StructuralManager';
import type { SelectionManager } from '../src/tools/SelectionManager';
import type { Sidebar } from '../src/features/sidebar/SidebarController';
import type { FooterStatusBar } from '../src/features/footer-status/FooterStatusController';
import { SCHEDULE_ACTION_EVENT } from '../src/features/quantification/ScheduleBridge';
import { SELECT_BY_ID_RESULT_EVENT } from '../src/features/select-by-id/SelectByIdBridge';
import type { SelectByIdResult } from '../src/features/select-by-id/SelectByIdTypes';
import type { ManagedElement } from '../src/tools/structural/types';

test('eventos de planilla delegan seleccionar, borrar y reportar referencias ausentes', () => {
  const calls: unknown[] = [];
  const element = { id: 'beam-1', elementId: 17 } as ManagedElement;
  const controller = new ApplicationReferenceEventController({
    viewer: {} as Viewer,
    gridSystem: {} as GridSystem,
    levelSystem: {} as LevelSystem,
    structural: {
      registry: { findById: id => id === 'beam-1' ? element : undefined },
      removeElement: item => calls.push(['remove', item]),
    } as unknown as StructuralManager,
    selection: { clearSelection: () => calls.push('clear-selection') } as unknown as SelectionManager,
    sidebar: { showEmptyProperties: () => calls.push('empty-properties') } as unknown as Sidebar,
    footer: { setMessage: message => calls.push(['message', message]) } as unknown as FooterStatusBar,
    updateRibbonLevelSelector: () => {},
    focusAndSelectElementIn3D: item => calls.push(['focus', item]),
  });
  const events = new EventTarget();
  const abort = new AbortController();
  controller.attach(events, abort.signal);

  events.dispatchEvent(new CustomEvent(SCHEDULE_ACTION_EVENT, { detail: { type: 'select', id: 'beam-1' } }));
  events.dispatchEvent(new CustomEvent(SCHEDULE_ACTION_EVENT, { detail: { type: 'select', id: 'missing' } }));
  events.dispatchEvent(new CustomEvent(SCHEDULE_ACTION_EVENT, { detail: { type: 'delete', id: 'beam-1' } }));

  expect(calls).toEqual([
    ['focus', element],
    ['message', 'Elemento missing no encontrado en el modelo.'],
    ['remove', element],
    'clear-selection',
    'empty-properties',
    ['message', 'Elemento beam-1 suprimido del modelo.'],
  ]);

  abort.abort();
  events.dispatchEvent(new CustomEvent(SCHEDULE_ACTION_EVENT, { detail: { type: 'select', id: 'beam-1' } }));
  expect(calls).toHaveLength(6);
});

test('seleccionar por ID abre la vista asociada y conserva callbacks de rejilla y nivel', () => {
  const calls: unknown[] = [];
  const structuralElement = { id: 'column-1', elementId: 51 } as ManagedElement;
  const planView = { id: 'plan-level-1', type: 'plan' };
  const elevationView = { id: 'elev-south', type: 'elevation' };
  const view3d = { id: 'view-3d', type: '3d' };
  const sidebar = {
    showGridProperties: (...args: unknown[]) => calls.push(['grid-properties', ...args]),
    showLevelProperties: (...args: unknown[]) => calls.push(['level-properties', ...args]),
  } as unknown as Sidebar;
  const controller = new ApplicationReferenceEventController({
    viewer: {
      viewManager: {
        getAllViews: () => [planView, elevationView],
        views: new Map([['view-3d', view3d]]),
        openView: id => calls.push(['open-view', id]),
      },
    } as unknown as Viewer,
    gridSystem: {
      selectGrid: id => calls.push(['select-grid', id]),
      getSelectedGrid: () => ({ id: 'grid-1', name: 'A' }),
      rebuildSystem: () => calls.push('rebuild-grid'),
      deleteGrid: id => calls.push(['delete-grid', id]),
    } as unknown as GridSystem,
    levelSystem: {
      selectLevel: id => calls.push(['select-level', id]),
      getSelectedLevel: () => ({ id: 'level-1', name: 'Nivel 1' }),
      rebuildMeshes: () => calls.push('rebuild-levels'),
      deleteLevel: id => calls.push(['delete-level', id]),
    } as unknown as LevelSystem,
    structural: {
      registry: {
        findById: id => id === 51 ? structuralElement : undefined,
      },
    } as unknown as StructuralManager,
    selection: {} as SelectionManager,
    sidebar,
    footer: { setMessage: message => calls.push(['message', message]) } as unknown as FooterStatusBar,
    updateRibbonLevelSelector: () => calls.push('update-level-selector'),
    focusAndSelectElementIn3D: element => calls.push(['focus', element]),
  });
  const events = new EventTarget();
  controller.attach(events, new AbortController().signal);

  events.dispatchEvent(new CustomEvent<SelectByIdResult>(SELECT_BY_ID_RESULT_EVENT, {
    detail: { type: 'element', doc: { uniqueId: 'stale-guid', elementId: 51 } as never },
  }));
  events.dispatchEvent(new CustomEvent<SelectByIdResult>(SELECT_BY_ID_RESULT_EVENT, {
    detail: { type: 'grid', doc: { uniqueId: 'grid-1', name: 'Rejilla A' } as never },
  }));
  events.dispatchEvent(new CustomEvent<SelectByIdResult>(SELECT_BY_ID_RESULT_EVENT, {
    detail: { type: 'level', doc: { uniqueId: 'level-1', name: 'Nivel 1' } as never },
  }));

  expect(calls.slice(0, 3)).toEqual([
    ['focus', structuralElement],
    ['open-view', 'plan-level-1'],
    ['select-grid', 'grid-1'],
  ]);
  expect(calls[4]).toEqual(['message', 'Rejilla Rejilla A seleccionada por ID.']);
  expect(calls.slice(5, 7)).toEqual([
    ['open-view', 'elev-south'],
    ['select-level', 'level-1'],
  ]);
  expect(calls[8]).toEqual(['message', 'Nivel Nivel 1 seleccionado por ID.']);

  const gridProperties = calls.find(call => Array.isArray(call) && call[0] === 'grid-properties') as unknown[];
  const levelProperties = calls.find(call => Array.isArray(call) && call[0] === 'level-properties') as unknown[];
  expect(gridProperties[1]).toEqual({ id: 'grid-1', name: 'A' });
  expect(typeof gridProperties[2]).toBe('function');
  expect(typeof gridProperties[3]).toBe('function');
  expect(levelProperties[1]).toEqual({ id: 'level-1', name: 'Nivel 1' });
  expect(typeof levelProperties[2]).toBe('function');
  expect(typeof levelProperties[3]).toBe('function');
  (gridProperties[2] as () => void)();
  (gridProperties[3] as (id: string) => void)('grid-1');
  (levelProperties[2] as () => void)();
  (levelProperties[3] as (id: string) => void)('level-1');
  expect(calls.slice(9)).toEqual([
    'rebuild-grid', ['delete-grid', 'grid-1'], 'rebuild-levels', 'update-level-selector',
    ['delete-level', 'level-1'], 'update-level-selector',
  ]);
});
