import { expect, test } from 'bun:test';
import { createSelectionContextualActions } from '../src/features/application/contextualActions/SelectionContextualActions';
import { createStructuralEditContextualActions } from '../src/features/application/contextualActions/StructuralEditContextualActions';

test('acciones de selección conservan el flujo de rejilla y sincronizan el selector al borrar un nivel', () => {
  const calls: unknown[] = [];
  let activeTool = 'select';
  let selectedLevelId: string | null = 'LV-02';
  const actions = createSelectionContextualActions({
    gridSystem: {
      selectedGridId: null,
      hasGrids: () => false,
      loadDefaultTestGrid: () => calls.push('default-grid'),
      deleteGrid: (id: string) => calls.push(['delete-grid', id]),
      selectGrid: (id: string | null) => calls.push(['select-grid', id]),
      toggleQuick: () => 'visible',
    } as never,
    levelSystem: {
      get selectedLevelId() { return selectedLevelId; },
      deleteLevel: (id: string) => { calls.push(['delete-level', id]); selectedLevelId = null; },
      selectLevel: (id: string | null) => calls.push(['select-level', id]),
    } as never,
    footer: { setMessage: (message: string) => calls.push(['message', message]) } as never,
    structural: { placeAtGridIntersections: (...args: unknown[]) => calls.push(['place', ...args]) } as never,
    selection: { selectedElement: null, clearSelection: () => calls.push('clear-selection') } as never,
    sidebar: { showEmptyProperties: () => calls.push('empty-properties') } as never,
    snapping: { activeLevelIdx: 2 } as never,
    getGripManager: () => ({ clearGrips: () => calls.push('clear-grips') }) as never,
    updateRibbonLevelSelector: () => calls.push('refresh-level-selector'),
    getActiveTool: () => activeTool as never,
    setTool: tool => calls.push(['set-tool', tool]),
  });

  actions.onAtGrid?.();
  expect(calls).toEqual([]);

  activeTool = 'beam';
  actions.onAtGrid?.();
  expect(calls).toContain('default-grid');
  expect(calls).toContainEqual(['place', 'beam', 2]);

  calls.length = 0;
  actions.onDeleteSelected?.();
  expect(calls).toEqual([
    ['delete-level', 'LV-02'],
    'refresh-level-selector',
    'empty-properties',
    ['message', 'Nivel LV-02 eliminado.'],
  ]);
});

test('acciones estructurales usan los gestores y la barra disponibles al invocarse', () => {
  const calls: unknown[] = [];
  const selectedElement = { id: 'V-01' };
  let tools: { startAlign: (element: unknown) => void; cancelAlign: () => void } | undefined;
  let bar: { renderAlignBar: (text: string) => void; updateForSelectedElement: (element: unknown, level: string) => void } | undefined;
  const actions = createStructuralEditContextualActions({
    selection: { selectedElement } as never,
    footer: { setMessage: (message: string) => calls.push(['message', message]) } as never,
    getModificationTools: () => tools as never,
    levelSystem: { getLevels: () => [{ name: 'Nivel 3' }] } as never,
    snapping: { activeLevelIdx: 0 } as never,
    getContextualBar: () => bar as never,
    getActiveTool: () => 'beam' as never,
    getGripManager: () => ({} as never),
    wasm: {} as never,
    structural: {} as never,
    sidebar: {} as never,
    contourEditor: {} as never,
    updateElementGeometry: () => {},
  });

  tools = {
    startAlign: element => calls.push(['start-align', element]),
    cancelAlign: () => calls.push('cancel-align'),
  };
  bar = {
    renderAlignBar: text => calls.push(['align-bar', text]),
    updateForSelectedElement: (element, level) => calls.push(['selected', element, level]),
  };

  actions.onStartAlign?.();
  actions.onCancelAlign?.();
  expect(calls).toEqual([
    ['start-align', selectedElement],
    ['align-bar', 'Paso 1: Selecciona una rejilla, nivel o arista de referencia'],
    'cancel-align',
    ['selected', selectedElement, 'Nivel 3'],
  ]);
});
