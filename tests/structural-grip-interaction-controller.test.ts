import { expect, test } from 'bun:test';
import * as THREE from 'three';
import { StructuralGripInteractionController } from '../src/features/model-editing/StructuralGripInteractionController';
import type { GridSystem } from '../src/core/GridSystem';
import type { LevelSystem } from '../src/core/LevelSystem';
import type { Viewer } from '../src/core/Viewer';
import type { BimView } from '../src/core/views/BimView';
import type { SelectionManager } from '../src/tools/SelectionManager';
import type { GripManager } from '../src/tools/structural/GripManager';
import type { Sidebar } from '../src/features/sidebar/SidebarController';
import type { FooterStatusBar } from '../src/features/footer-status/FooterStatusController';

test('inicia el grip dentro de la vista y bloquea los controles de cámara', () => {
  const mesh = { userData: { gripType: 'move' } } as THREE.Mesh;
  const calls: unknown[] = [];
  const controls = { enabled: true };
  const view = {
    domElement: { getBoundingClientRect: () => ({ left: 10, top: 20, right: 110, bottom: 120, width: 100, height: 100 }) },
    camera: {},
    controls,
  } as unknown as BimView;
  const grip = {
    isDragging: false,
    testPointerIntersection: () => mesh,
    startDrag: () => { calls.push('start'); return true; },
  } as unknown as GripManager;
  const selection = { selectedElement: { id: 'V-1' } } as unknown as SelectionManager;
  const footer = { setMessage: (message: string) => calls.push(message) } as FooterStatusBar;
  const controller = new StructuralGripInteractionController(
    { viewManager: { getActiveView: () => view } } as unknown as Viewer,
    grip,
    {} as GridSystem,
    {} as LevelSystem,
    selection,
    {} as Sidebar,
    footer,
  );
  const raycaster = { setFromCamera: (...args: unknown[]) => calls.push(['ray', ...args]) } as unknown as THREE.Raycaster;
  let stopped = false;
  const event = { target: null, clientX: 60, clientY: 70, stopPropagation: () => { stopped = true; } } as unknown as PointerEvent;

  expect(controller.handlePointerDown(event, view, raycaster)).toBe(true);
  expect(controls.enabled).toBe(false);
  expect(stopped).toBe(true);
  expect(calls).toContain('start');
  expect(calls).toContain('Arrastrando Grip MOVE en V-1');
  expect((calls.find(call => Array.isArray(call) && call[0] === 'ray') as unknown[])[1]).toEqual(new THREE.Vector2(0, 0));
});

test('actualiza el arrastre con ejes y elevaciones y finaliza restaurando la vista', () => {
  const calls: unknown[] = [];
  const view = { controls: { enabled: false } } as unknown as BimView;
  const grip = {
    isDragging: true,
    updateDrag: (...args: unknown[]) => calls.push(['update', ...args]),
    endDrag: () => { calls.push('end'); grip.isDragging = false; },
  } as unknown as GripManager;
  const selected = { id: 'C-1' };
  const controller = new StructuralGripInteractionController(
    { viewManager: { getActiveView: () => view } } as unknown as Viewer,
    grip,
    { getGridX: () => [0, 4], getGridZ: () => [0, 5] } as unknown as GridSystem,
    { getLevels: () => [{ elevation: 0 }, { elevation: 3.5 }] } as unknown as LevelSystem,
    { selectedElement: selected, refreshHighlight: () => calls.push('refresh') } as unknown as SelectionManager,
    { showElementProperties: element => calls.push(['properties', element]) } as unknown as Sidebar,
    {} as FooterStatusBar,
  );

  const event = { clientX: 25, clientY: 40 } as PointerEvent;
  expect(controller.handlePointerMove(event)).toBe('dragging');
  controller.handlePointerUp();

  expect(calls[0]).toEqual(['update', event, [0, 4], [0, 5], [0, 3.5]]);
  expect(calls.slice(1)).toEqual(['refresh', 'end', 'refresh', ['properties', selected]]);
  expect(view.controls.enabled).toBe(true);
});
