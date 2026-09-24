import { expect, test } from 'bun:test';
import { StructuralPlacementController } from '../src/features/model-editing/StructuralPlacementController';
import type { GridSystem } from '../src/core/GridSystem';
import type { PlacementPreview } from '../src/tools/PlacementPreview';
import type { SnappingManager } from '../src/tools/SnappingManager';
import type { StructuralManager } from '../src/tools/StructuralManager';
import type { FooterStatusBar } from '../src/features/footer-status/FooterStatusController';

test('actualiza feedback, ejes y previsualización desde la posición ajustada', () => {
  const calls: unknown[] = [];
  const snapping = { currentSnappedPosition: { x: 4, z: 8 }, activeLevelIdx: 2 } as SnappingManager;
  const grid = {
    highlightAxes: (...args: unknown[]) => calls.push(['axes', ...args]),
    hideGuideLine: () => calls.push('hide-guide'),
    getGridX: () => [0, 4, 8],
    getGridZ: () => [0, 4, 8],
  } as unknown as GridSystem;
  const preview = { update: (...args: unknown[]) => calls.push(['preview', ...args]) } as unknown as PlacementPreview;
  const footer = { setCoordinates: (...args: unknown[]) => calls.push(['coordinates', ...args]) } as FooterStatusBar;
  const controller = new StructuralPlacementController(snapping, grid, preview, {} as StructuralManager, footer, () => 'columna');

  controller.updatePreview();

  expect(calls).toEqual([
    ['coordinates', 4, 8, 7],
    ['axes', 4, 8],
    'hide-guide',
    ['preview', 'columna', 4, 8, 2, [0, 4, 8], [0, 4, 8]],
  ]);
});

test('limpia la previsualización al seleccionar y coloca solo cuando existe un snap', () => {
  const calls: unknown[] = [];
  const snapping = { currentSnappedPosition: null, activeLevelIdx: 1 } as { currentSnappedPosition: { x: number; z: number } | null; activeLevelIdx: number };
  const grid = {
    clearHighlight: () => calls.push('clear-highlight'),
    hideGuideLine: () => calls.push('hide-guide'),
  } as unknown as GridSystem;
  const preview = { hide: () => calls.push('hide-preview') } as unknown as PlacementPreview;
  const structural = { placeSingle: (...args: unknown[]) => calls.push(['place', ...args]) } as unknown as StructuralManager;
  const footer = { setMessage: message => calls.push(message) } as FooterStatusBar;
  let tool: 'select' | 'viga' = 'select';
  const controller = new StructuralPlacementController(snapping as SnappingManager, grid, preview, structural, footer, () => tool);

  controller.updatePreview();
  expect(controller.placeAtCurrentSnap()).toBe(false);
  snapping.currentSnappedPosition = { x: 12, z: 6 };
  tool = 'viga';
  expect(controller.placeAtCurrentSnap()).toBe(true);

  expect(calls).toEqual([
    'clear-highlight', 'hide-guide', 'hide-preview',
    ['place', 'viga', 12, 6, 1], 'VIGA colocado en el modelo.',
  ]);
});
