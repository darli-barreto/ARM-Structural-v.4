import { expect, test } from 'bun:test';
import { RibbonToolActivationController } from '../src/features/ribbon/RibbonToolActivationController';
import type { RibbonToolActivationDependencies } from '../src/features/ribbon/RibbonToolActivationController';

function createDependencies(initialViewType: string) {
  const calls: unknown[] = [];
  let activeView = { id: 'view-3d', type: initialViewType, title: '3D' };
  const dependencies = {
    viewer: {
      viewManager: {
        views: new Map(),
        getActiveView: () => activeView,
        getAllViews: () => [
          { id: 'plan-L1', type: 'plan', title: 'Planta 1' },
          { id: 'elev-north', type: 'elevation', title: 'Alzado norte' },
        ],
        openView: (id: string) => {
          calls.push(['open-view', id]);
          activeView = id === 'elev-north'
            ? { id, type: 'elevation', title: 'Alzado norte' }
            : { id, type: 'plan', title: 'Planta 1' };
        },
      },
    },
    snapping: { activeLevelIdx: 0, enabled: false },
    contextualBar: {
      currentOffset: 1.25,
      isChain: true,
      levelDrawMode: 'line',
      levelOffset: 0.5,
      levelMakePlanView: true,
      updateForTool: (...args: unknown[]) => calls.push(['context-tool', ...args]),
    },
    gridDrawingManager: {
      activate: () => calls.push('grid-activate'),
      deactivate: () => calls.push('grid-deactivate'),
      setOffset: (offset: number) => calls.push(['grid-offset', offset]),
      setChain: (chain: boolean) => calls.push(['grid-chain', chain]),
    },
    levelDrawingManager: {
      activate: () => calls.push('level-activate'),
      deactivate: () => calls.push('level-deactivate'),
      setMode: (mode: string) => calls.push(['level-mode', mode]),
      setOffset: (offset: number) => calls.push(['level-offset', offset]),
      setMakePlanView: (makePlan: boolean) => calls.push(['level-plan', makePlan]),
    },
    gridSystem: {
      selectGrid: (id: string | null) => calls.push(['grid-select', id]),
      clearHighlight: () => calls.push('clear-highlight'),
      hideGuideLine: () => calls.push('hide-guide'),
    },
    levelSystem: {
      getLevels: () => [{ id: 'L1', name: 'Nivel 1' }],
      selectLevel: (id: string | null) => calls.push(['level-select', id]),
    },
    selection: {
      clearSelection: () => calls.push('clear-selection'),
      clearHover: () => calls.push('clear-hover'),
    },
    preview: { hide: () => calls.push('hide-preview') },
    footer: { setMessage: (message: string) => calls.push(['status', message]) },
  } as unknown as RibbonToolActivationDependencies;

  return { calls, dependencies };
}

test('activa rejillas en planta y aplica el desfase configurado', () => {
  const { calls, dependencies } = createDependencies('3d');
  new RibbonToolActivationController(dependencies).activate('grid');

  expect(calls).toContainEqual(['open-view', 'plan-L1']);
  expect(calls).toContain('grid-activate');
  expect(calls).toContainEqual(['grid-offset', 1.25]);
  expect(calls).toContainEqual(['grid-chain', true]);
  expect(calls).toContain('level-deactivate');
  expect(dependencies.snapping.enabled).toBe(false);
});

test('activa niveles en alzado y limpia referencias al volver a selección', () => {
  const { calls, dependencies } = createDependencies('plan');
  const controller = new RibbonToolActivationController(dependencies);
  controller.activate('level');

  expect(calls).toContainEqual(['open-view', 'elev-north']);
  expect(calls).toContain('level-activate');
  expect(calls).toContainEqual(['level-mode', 'line']);

  calls.length = 0;
  controller.activate('select');
  expect(calls).toContain('grid-deactivate');
  expect(calls).toContain('level-deactivate');
  expect(calls).toContain('clear-highlight');
  expect(calls).toContain('hide-guide');
  expect(dependencies.snapping.enabled).toBe(false);
});
