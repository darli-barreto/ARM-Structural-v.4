import { expect, test } from 'bun:test';
import * as THREE from 'three';
import { StructuralAlignmentController } from '../src/features/model-editing/StructuralAlignmentController';
import type { GridSystem } from '../src/core/GridSystem';
import type { LevelSystem } from '../src/core/LevelSystem';
import type { BimView } from '../src/core/views/BimView';
import type { SnappingManager } from '../src/tools/SnappingManager';
import type { StructuralManager } from '../src/tools/StructuralManager';
import type { SelectionManager } from '../src/tools/SelectionManager';
import type { GripManager } from '../src/tools/structural/GripManager';
import type { ModificationTools } from '../src/tools/structural/ModificationTools';
import type { ContextualSubheader } from '../src/features/datum/ContextualSubheaderController';

test('alinea en dos pasos y toma un eje como referencia ortogonal', () => {
  const calls: unknown[] = [];
  const hitObject = { userData: { gridId: 'grid-x' } };
  const grid = {
    gridHitMeshes: [hitObject],
    elements: [{ id: 'grid-x', name: 'A', start: { x: 3, z: 0 }, end: { x: 3, z: 10 } }],
  } as unknown as GridSystem;
  const modifications = {
    isAlignActive: true,
    alignStep: 'pick_reference',
    setReference: reference => calls.push(['reference', reference]),
  } as unknown as ModificationTools;
  const controller = new StructuralAlignmentController(
    grid, {} as LevelSystem, {} as StructuralManager, modifications, {} as GripManager,
    {} as SelectionManager, {} as SnappingManager,
    { renderAlignBar: message => calls.push(['prompt', message]) } as unknown as ContextualSubheader,
  );
  const view = {
    camera: {},
    domElement: { getBoundingClientRect: () => ({ left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 }) },
  } as unknown as BimView;
  const raycaster = {
    setFromCamera: () => {},
    intersectObjects: () => [{ object: hitObject }],
  } as unknown as THREE.Raycaster;

  expect(controller.handleClick({ clientX: 50, clientY: 50 } as MouseEvent, view, raycaster)).toBe(true);
  expect(calls).toEqual([
    ['reference', {
      type: 'grid', label: 'Eje de Rejilla A', point: { x: 3, y: 0, z: 0 }, axis: 'X', coordinate: 3,
    }],
    ['prompt', 'Referencia fija: Eje A. Paso 2: Clic en elemento a alinear.'],
  ]);
});

test('ignora clicks de la herramienta cuando el modo alinear no está activo', () => {
  const controller = new StructuralAlignmentController(
    {} as GridSystem, {} as LevelSystem, {} as StructuralManager,
    { isAlignActive: false } as ModificationTools, {} as GripManager,
    {} as SelectionManager, {} as SnappingManager, {} as ContextualSubheader,
  );
  expect(controller.handleClick({} as MouseEvent, {} as BimView, {} as THREE.Raycaster)).toBe(false);
});
