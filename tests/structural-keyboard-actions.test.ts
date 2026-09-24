import { expect, test } from 'bun:test';
import { createStructuralKeyboardActions } from '../src/features/application/StructuralKeyboardActions';
import type { ManagedElement } from '../src/tools/structural/types';

interface TestState {
  isDragging: boolean;
  isAlignActive: boolean;
  isArrayActive: boolean;
  gridId: string | null;
  levelId: string | null;
  selectedElement: ManagedElement | null;
}

function createActions(state: TestState, calls: unknown[]) {
  return createStructuralKeyboardActions({
    ribbon: { setTool: tool => calls.push(['tool', tool]) } as never,
    preview: { hide: () => calls.push('hide-preview') } as never,
    gridSystem: {
      get selectedGridId() { return state.gridId; },
      clearHighlight: () => calls.push('clear-grid-highlight'),
      hideGuideLine: () => calls.push('hide-grid-guide'),
      selectGrid: id => calls.push(['select-grid', id]),
      deleteGrid: id => calls.push(['delete-grid', id]),
    } as never,
    levelSystem: {
      get selectedLevelId() { return state.levelId; },
      getLevels: () => [{ id: 'level-1', name: 'Nivel 1' }],
      selectLevel: id => calls.push(['select-level', id]),
      deleteLevel: id => calls.push(['delete-level', id]),
    } as never,
    selection: {
      get selectedElement() { return state.selectedElement; },
      clearSelection: () => calls.push('clear-selection'),
    } as never,
    sidebar: { showEmptyProperties: () => calls.push('empty-properties') } as never,
    footer: { setMessage: message => calls.push(['message', message]) } as never,
    gridDrawingManager: { cancelCurrentDraw: () => calls.push('cancel-grid-draw') } as never,
    levelDrawingManager: { cancelCurrentDraw: () => calls.push('cancel-level-draw') } as never,
    modificationTools: {
      get isAlignActive() { return state.isAlignActive; },
      get isArrayActive() { return state.isArrayActive; },
      cancelAlign: () => calls.push('cancel-align'),
      cancelArray: () => calls.push('cancel-array'),
      startAlign: item => calls.push(['start-align', item]),
      startArray: item => calls.push(['start-array', item]),
    } as never,
    gripManager: {
      get isDragging() { return state.isDragging; },
      clearGrips: () => calls.push('clear-grips'),
    } as never,
    contextualBar: {
      updateForSelectedElement: (...args: unknown[]) => calls.push(['update-context', ...args]),
      renderAlignBar: message => calls.push(['align-bar', message]),
      renderArrayBar: item => calls.push(['array-bar', item]),
    } as never,
    structural: { removeElement: item => calls.push(['remove-element', item]) } as never,
    snapping: { activeLevelIdx: 0 } as never,
    cancelStructuralDrag: () => calls.push('cancel-structural-drag'),
    updateRibbonLevelSelector: () => calls.push('update-level-selector'),
  } as never);
}

test('Escape prioriza arrastre, alineación y matriz antes de limpiar el modo', () => {
  const calls: unknown[] = [];
  const selectedElement = { id: 'column-1' } as ManagedElement;
  const state: TestState = {
    isDragging: true,
    isAlignActive: true,
    isArrayActive: true,
    gridId: null,
    levelId: null,
    selectedElement,
  };
  const actions = createActions(state, calls);

  actions.escape();
  expect(calls).toEqual(['cancel-structural-drag']);
  state.isDragging = false;
  actions.escape();
  expect(calls.slice(1)).toEqual([
    'cancel-align', ['update-context', selectedElement, 'Nivel 1'], ['message', 'Alineación cancelada.'],
  ]);
  state.isAlignActive = false;
  actions.escape();
  expect(calls.slice(4)).toEqual([
    'cancel-array', ['update-context', selectedElement, 'Nivel 1'], ['message', 'Matriz cancelada.'],
  ]);

  state.isArrayActive = false;
  state.selectedElement = null;
  calls.splice(0);
  actions.escape();
  expect(calls).toEqual([
    'cancel-grid-draw', 'cancel-level-draw', 'clear-grips', ['tool', 'select'], 'hide-preview',
    'clear-grid-highlight', 'hide-grid-guide', ['select-grid', null], ['select-level', null],
    'clear-selection', 'empty-properties', ['message', 'Modo Selección | Listo'],
  ]);
});

test('atajos AL/AR y Suprimir conservan la prioridad de selección', () => {
  const calls: unknown[] = [];
  const selectedElement = { id: 'beam-1' } as ManagedElement;
  const state: TestState = {
    isDragging: false,
    isAlignActive: false,
    isArrayActive: false,
    gridId: 'grid-1',
    levelId: 'level-1',
    selectedElement,
  };
  const actions = createActions(state, calls);

  actions.alignShortcut();
  actions.arrayShortcut();
  expect(calls).toEqual([
    ['start-align', selectedElement], ['align-bar', 'Paso 1: Selecciona una rejilla, nivel o arista de referencia'],
    ['start-array', selectedElement], ['array-bar', selectedElement],
  ]);

  calls.splice(0);
  actions.deleteSelection();
  expect(calls).toEqual([['delete-grid', 'grid-1'], 'empty-properties', ['message', 'Rejilla grid-1 eliminada.']]);
  state.gridId = null;
  calls.splice(0);
  actions.deleteSelection();
  expect(calls).toEqual([
    ['delete-level', 'level-1'], 'update-level-selector', 'empty-properties', ['message', 'Nivel level-1 eliminado.'],
  ]);
  state.levelId = null;
  calls.splice(0);
  actions.deleteSelection();
  expect(calls).toEqual([
    ['remove-element', selectedElement], 'clear-selection', 'empty-properties', ['message', 'Elemento eliminado.'],
  ]);
});
