import { expect, test } from 'bun:test';
import * as THREE from 'three';
import { GridPickLineController } from '../src/tools/GridPickLineController';
import type { GridDrawingPreviewRenderer } from '../src/tools/GridDrawingPreviewRenderer';

test('Pick Line ordena aristas, cicla con Tab, previsualiza el desfase y crea el eje', () => {
  const calls: unknown[] = [];
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 2));
  mesh.updateMatrixWorld(true);
  const preview = {
    clear: () => calls.push('clear-preview'),
    renderPickedLine: (line: { p1: THREE.Vector2; p2: THREE.Vector2 }, elev: number, offset: number) => {
      calls.push(['preview', line.p1.toArray(), line.p2.toArray(), elev, offset]);
    },
  } as unknown as GridDrawingPreviewRenderer;
  const created: Array<{ start: { x: number; z: number }; end: { x: number; z: number }; name: string }> = [];
  const gridSystem = {
    elements: [],
    addGridElement: (grid: { start: { x: number; z: number }; end: { x: number; z: number }; name: string }) => created.push(grid),
  } as never;
  const messages: string[] = [];
  const controller = new GridPickLineController(
    { getMeshes: () => [mesh] } as never,
    gridSystem,
    preview,
    message => messages.push(message),
  );
  const cursor = new THREE.Vector2(0, 1.1);

  controller.updatePreview(cursor, 0.08, 0.5);
  expect(calls[0]).toEqual(['preview', [2, 1.5], [-2, 1.5], 0.08, 0.5]);

  controller.cycleCandidate();
  expect(messages[0]).toBe('Arista candidata cambiada [Tab] (2/4)');
  controller.updatePreview(cursor, 0.08, 0.5);
  expect(controller.placeGrid(cursor, 0.5)).toBe(true);
  expect(created).toHaveLength(1);
  expect(created[0]).toMatchObject({
    name: '1',
    start: { x: 1.5, z: -1 },
    end: { x: 1.5, z: 1 },
  });
  expect(messages[1]).toBe('Rejilla 1 creada desde referencia con desfase.');
});

test('Pick Line limpia preview si el cursor queda fuera del umbral de selección', () => {
  const calls: string[] = [];
  const controller = new GridPickLineController(
    { getMeshes: () => [] } as never,
    { elements: [] } as never,
    { clear: () => calls.push('clear') } as never,
    () => {},
  );

  controller.updatePreview(new THREE.Vector2(100, 100), 0.08, 0);
  expect(calls).toEqual(['clear']);
  expect(controller.placeGrid(new THREE.Vector2(100, 100), 0)).toBe(false);
});
