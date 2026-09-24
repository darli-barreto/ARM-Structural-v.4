import { test, expect } from 'bun:test';
import * as THREE from 'three';
import { DatumInteractionController } from '../src/features/datum/DatumInteractionController';
import type { GridSystem } from '../src/core/GridSystem';
import type { LevelSystem } from '../src/core/LevelSystem';
import type { Viewer } from '../src/core/Viewer';
import type { Sidebar } from '../src/features/sidebar/SidebarController';
import type { FooterStatusBar } from '../src/features/footer-status/FooterStatusController';
import type { BimView } from '../src/core/views/BimView';

test('inicia el grip de codo del datum de planta antes que el grip recto', () => {
  const calls: unknown[] = [];
  const elbowMesh = { userData: { gridId: 'G-1', end: 'end' } };
  const grid = {
    elbowGrips: [{ mesh: elbowMesh }],
    gripHandles: [{ mesh: {} }],
    startElbowDrag: (...args: unknown[]) => calls.push(['elbow', ...args]),
    startGripDrag: (...args: unknown[]) => calls.push(['grip', ...args]),
  } as unknown as GridSystem;
  const levels = { elbowGrips: [], grips: [] } as unknown as LevelSystem;
  const messages: string[] = [];
  const controller = new DatumInteractionController({} as Viewer, grid, levels, {} as never, {} as Sidebar, { setMessage: message => messages.push(message) } as FooterStatusBar, () => {}, () => 'select');
  let raycastCount = 0;
  const raycaster = { intersectObjects: () => raycastCount++ === 0 ? [{ object: elbowMesh }] : [] } as unknown as THREE.Raycaster;
  let stopped = false;
  controller.handlePointerDown({ stopPropagation: () => { stopped = true; } } as PointerEvent, { type: 'plan' } as BimView, raycaster);

  expect(calls).toEqual([['elbow', 'G-1', 'end']]);
  expect(messages).toEqual(['Arrastrando codo de rejilla (Ajuste lateral paramétrico activo)']);
  expect(stopped).toBe(true);
});

test('finaliza ediciones de niveles y rejillas en el orden de interacción', () => {
  const calls: unknown[] = [];
  const grid = {
    isDraggingGrip: true,
    isDraggingElbowGrip: true,
    endGripDrag: () => calls.push('grid-grip'),
    endElbowDrag: () => calls.push('grid-elbow'),
  } as unknown as GridSystem;
  const levels = {
    isDraggingGrip: true,
    isDraggingElbowGrip: true,
    endGripDrag: () => calls.push('level-grip'),
    endElbowDrag: () => calls.push('level-elbow'),
  } as unknown as LevelSystem;
  const controller = new DatumInteractionController({} as Viewer, grid, levels, {} as never, {} as Sidebar, { setMessage: message => calls.push(message) } as FooterStatusBar, () => {}, () => 'select');
  controller.handlePointerUp();

  expect(calls).toEqual([
    'level-grip', 'Longitud de nivel ajustada.',
    'level-elbow', 'Codo de nivel ajustado.',
    'grid-grip', 'Alineación de rejilla completada.',
    'grid-elbow', 'Codo de rejilla ajustado.',
  ]);
});

test('un clic en el control de burbuja alterna el datum sin seguir a la selección de escena', () => {
  const calls: unknown[] = [];
  const grid = {
    toggleBoxes: [{ mesh: { userData: { gridId: 'G-2', end: 'start' } } }],
    elbowToggles: [],
    toggleBubble: (...args: unknown[]) => calls.push(['toggle', ...args]),
    getSelectedGrid: () => null,
  } as unknown as GridSystem;
  const controller = new DatumInteractionController(
    {} as Viewer, grid, {} as LevelSystem, {} as never, {} as Sidebar,
    { setMessage: message => calls.push(message) } as FooterStatusBar,
    () => {}, () => 'select',
  );
  const view = {
    type: 'plan', camera: {},
    domElement: { getBoundingClientRect: () => ({ left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 }) },
  } as unknown as BimView;
  const raycaster = {
    setFromCamera: () => {},
    intersectObjects: () => [{ object: grid.toggleBoxes[0].mesh }],
  } as unknown as THREE.Raycaster;

  expect(controller.handleControlClick({ clientX: 50, clientY: 50 } as MouseEvent, view, raycaster)).toBe(true);
  expect(calls).toEqual([['toggle', 'G-2', 'start'], 'Burbuja de rejilla inicial alternada.']);
});

test('selecciona una rejilla después de que la selección estructural cede el clic', () => {
  const calls: unknown[] = [];
  const selectedGrid = { id: 'G-3', name: 'A' };
  const grid = {
    gridHitMeshes: [{}],
    selectGrid: id => calls.push(['grid', id]),
    getSelectedGrid: () => selectedGrid,
  } as unknown as GridSystem;
  const levels = { selectLevel: id => calls.push(['level', id]) } as unknown as LevelSystem;
  const controller = new DatumInteractionController(
    {} as Viewer, grid, levels, { clearSelection: () => calls.push('clear') } as never,
    { showGridProperties: item => calls.push(['properties', item]) } as unknown as Sidebar,
    { setMessage: message => calls.push(message) } as FooterStatusBar,
    () => {}, () => 'select',
  );
  const view = {
    type: 'plan', camera: {},
    domElement: { getBoundingClientRect: () => ({ left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 }) },
  } as unknown as BimView;
  const raycaster = {
    setFromCamera: () => {},
    intersectObjects: () => [{ object: { userData: { gridId: 'G-3' } } }],
  } as unknown as THREE.Raycaster;

  expect(controller.handleReferenceSelectionClick({ clientX: 50, clientY: 50 } as MouseEvent, view, raycaster)).toBe(true);
  expect(calls).toEqual([
    ['grid', 'G-3'], ['level', null], 'clear', ['properties', selectedGrid],
    'Rejilla seleccionada: Eje A. Arrastra los círculos en los extremos para alinear.',
  ]);
});

test('un elemento estructural bajo el cursor limpia el hover de datums y conserva prioridad', () => {
  const calls: unknown[] = [];
  const grid = { setHoveredGrid: id => calls.push(['grid', id]) } as unknown as GridSystem;
  const levels = { setHoveredLevel: id => calls.push(['level', id]) } as unknown as LevelSystem;
  const controller = new DatumInteractionController(
    {} as Viewer, grid, levels, {} as never, {} as Sidebar, {} as FooterStatusBar,
    () => {}, () => 'select', cursor => calls.push(['cursor', cursor]),
  );
  const raycaster = { intersectObjects: () => { throw new Error('no debe hacer raycast'); } } as unknown as THREE.Raycaster;

  expect(controller.handleHover({} as PointerEvent, { type: 'plan' } as BimView, raycaster, true)).toBe(true);
  expect(calls).toEqual([['grid', null], ['level', null]]);
});

test('hover en planta resalta la rejilla golpeada y cambia el cursor', () => {
  const calls: unknown[] = [];
  const gridMesh = { userData: { gridId: 'G-4' } };
  const grid = {
    gripHandles: [], elbowGrips: [], elbowToggles: [], toggleBoxes: [],
    gridHitMeshes: [gridMesh], bubbleSprites: [],
    setHoveredGrid: id => calls.push(['grid', id]),
  } as unknown as GridSystem;
  const levels = { setHoveredLevel: id => calls.push(['level', id]) } as unknown as LevelSystem;
  const controller = new DatumInteractionController(
    {} as Viewer, grid, levels, {} as never, {} as Sidebar, {} as FooterStatusBar,
    () => {}, () => 'select', cursor => calls.push(['cursor', cursor]),
  );
  const view = {
    type: 'plan', camera: {},
    domElement: { getBoundingClientRect: () => ({ left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 }) },
  } as unknown as BimView;
  let hitIndex = 0;
  const raycaster = {
    setFromCamera: () => {},
    intersectObjects: () => hitIndex++ === 0 ? [] : [{ object: gridMesh }],
  } as unknown as THREE.Raycaster;

  expect(controller.handleHover({ clientX: 50, clientY: 50 } as PointerEvent, view, raycaster, false)).toBe(false);
  expect(calls).toEqual([['grid', 'G-4'], ['cursor', 'pointer']]);
});

test('handleDoubleClick delega la edición inline de niveles y conserva sus callbacks', () => {
  const calls: unknown[] = [];
  const bubbleMesh = { userData: { levelId: 'L-1', end: 'start' } };
  const worldPos = new THREE.Vector3(-8, 3, 0);
  const selectedLevel = { id: 'L-1', name: 'Nivel 1' };
  const view = {
    type: 'elevation', camera: {},
    domElement: { getBoundingClientRect: () => ({ left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 }) },
  } as unknown as BimView;
  const levels = {
    bubbleHits: [{ mesh: bubbleMesh, worldPos }],
    openInlineEditor: (...args: unknown[]) => calls.push(['open', ...args]),
    getSelectedLevel: () => selectedLevel,
    rebuildMeshes: () => calls.push('rebuild-levels'),
    deleteLevel: id => calls.push(['delete-level', id]),
  } as unknown as LevelSystem;
  const controller = new DatumInteractionController(
    { viewManager: { getActiveView: () => view } } as unknown as Viewer,
    {} as GridSystem,
    levels,
    {} as never,
    { showLevelProperties: (...args: unknown[]) => calls.push(['properties', ...args]) } as unknown as Sidebar,
    { setMessage: message => calls.push(['message', message]) } as unknown as FooterStatusBar,
    () => calls.push('update-selector'),
    () => 'select',
  );
  const raycaster = (controller as unknown as { raycaster: THREE.Raycaster }).raycaster;
  raycaster.setFromCamera = () => {};
  raycaster.intersectObjects = () => [{ object: bubbleMesh, point: new THREE.Vector3(99, 99, 99) }];
  let stopped = false;

  controller.handleDoubleClick({
    target: { closest: () => null, id: '' }, clientX: 50, clientY: 50,
    stopPropagation: () => { stopped = true; },
  } as unknown as MouseEvent);

  const openCall = calls[0] as unknown[];
  expect(openCall.slice(0, 4)).toEqual(['open', 'L-1', worldPos, view.camera]);
  expect(openCall[4]).toBe(view.domElement);
  (openCall[5] as () => void)();
  expect(calls).toContain('update-selector');
  expect((calls.find(call => Array.isArray(call) && call[0] === 'properties') as unknown[])[1]).toBe(selectedLevel);
  expect(calls).toContainEqual(['message', 'Nivel actualizado correctamente.']);
  expect(stopped).toBe(true);
});

test('handleDoubleClick delega el renombrado inline de burbujas de rejilla', () => {
  const calls: unknown[] = [];
  const bubbleMesh = { userData: { gridId: 'G-5', end: 'end' } };
  const selectedGrid = { id: 'G-5', name: 'Eje A' };
  const view = {
    type: 'plan', camera: {},
    domElement: { getBoundingClientRect: () => ({ left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 }) },
  } as unknown as BimView;
  const grid = {
    bubbleHits: [{ mesh: bubbleMesh, gridId: 'G-5', end: 'end', worldPos: new THREE.Vector3(0, 0, 8) }],
    bubbleSprites: [], gridHitMeshes: [],
    openBubbleRename: (...args: unknown[]) => { calls.push(['open', ...args]); return true; },
    selectGrid: id => calls.push(['select', id]),
    getSelectedGrid: () => selectedGrid,
    rebuildSystem: () => calls.push('rebuild-grid'),
    deleteGrid: id => calls.push(['delete-grid', id]),
  } as unknown as GridSystem;
  const controller = new DatumInteractionController(
    { viewManager: { getActiveView: () => view } } as unknown as Viewer,
    grid,
    {} as LevelSystem,
    {} as never,
    { showGridProperties: (...args: unknown[]) => calls.push(['properties', ...args]) } as unknown as Sidebar,
    { setMessage: message => calls.push(['message', message]) } as unknown as FooterStatusBar,
    () => {},
    () => 'select',
  );
  const raycaster = (controller as unknown as { raycaster: THREE.Raycaster }).raycaster;
  raycaster.setFromCamera = () => {};
  raycaster.intersectObjects = () => [{ object: bubbleMesh }];
  let stopped = false;

  controller.handleDoubleClick({
    target: { closest: () => null, id: '' }, clientX: 50, clientY: 50,
    stopPropagation: () => { stopped = true; },
  } as unknown as MouseEvent);

  expect((calls[0] as unknown[]).slice(0, 4)).toEqual(['open', 'G-5', 'end', view.camera]);
  expect(calls).toContainEqual(['select', 'G-5']);
  expect((calls.find(call => Array.isArray(call) && call[0] === 'properties') as unknown[])[1]).toBe(selectedGrid);
  expect(calls).toContainEqual(['message', 'Editando identificador de burbuja. Escribe el nuevo nombre y presiona Enter.']);
  expect(stopped).toBe(true);
});
