import { expect, test } from 'bun:test';
import * as THREE from 'three';
import { GripGeometryEditor } from '../src/tools/structural/GripGeometryEditor';
import type { GripHandleData } from '../src/tools/structural/StructuralGripRenderer';
import type { ManagedElement } from '../src/tools/structural/types';
import type { WasmBridge } from '../src/kernel/WasmBridge';

function createElement(type: ManagedElement['type'], definition: ManagedElement['definition']): ManagedElement {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  return {
    id: 'element-1',
    type,
    mesh: new THREE.Mesh(geometry),
    line: new THREE.LineSegments(new THREE.EdgesGeometry(geometry)),
    volume: 0,
    dimensions: '',
    levelName: 'Nivel 1',
    definition,
  };
}

test('editor de grips modifica el extremo de viga y devuelve su feedback visual', () => {
  const calls: unknown[] = [];
  const wasm = {
    createArbitraryBeam: (...args: unknown[]) => {
      calls.push(args);
      return { geometry: new THREE.BoxGeometry(1, 1, 1) };
    },
  } as unknown as WasmBridge;
  const definition = {
    type: 'beam' as const,
    startPoint: { x: 0, y: 3.5, z: 0 },
    endPoint: { x: 5, y: 3.5, z: 0 },
    width: 0.3,
    height: 0.5,
  };
  const element = createElement('beam', definition);
  const editor = new GripGeometryEditor(wasm);

  const result = editor.update({
    element,
    initialDefinition: definition,
    grip: { elementId: element.id, gripType: 'linear_end', originalPoint: definition.endPoint },
    snappedPoint: { x: 6, y: 3.5, z: 0 },
    delta: { x: 1, y: 0, z: 0 },
    hitPoint: { x: 6, y: 3.5, z: 0 },
  });

  expect(element.definition.type === 'beam' && element.definition.endPoint.x).toBe(6);
  expect(calls).toHaveLength(1);
  expect(result).toMatchObject({
    status: 'applied',
    badgeText: 'Longitud L: 6.00 m',
    gripPosition: { x: 6, y: 3.55, z: 0 },
  });
});

test('el movimiento traslada contorno y huecos sin mutar la definición inicial', () => {
  const wasm = {
    createPolygonSlab: () => ({ geometry: new THREE.BoxGeometry(1, 1, 1) }),
  } as unknown as WasmBridge;
  const point = (x: number, z: number) => ({ x, y: 0, z });
  const definition = {
    type: 'slab' as const,
    boundary: [point(0, 0), point(6, 0), point(6, 4), point(0, 4)],
    voids: [[point(1, 1), point(2, 1), point(2, 2), point(1, 2)]],
    thickness: 0.2,
    elevationY: 0,
  };
  const element = createElement('slab', definition);
  const editor = new GripGeometryEditor(wasm);
  const grip: GripHandleData = {
    elementId: element.id,
    gripType: 'move',
    originalPoint: point(3, 2),
  };

  const result = editor.update({
    element,
    initialDefinition: definition,
    grip,
    snappedPoint: point(5, 5),
    delta: { x: 2, y: 0, z: 3 },
    hitPoint: point(5, 5),
  });

  expect(definition.boundary[0]).toEqual(point(0, 0));
  expect(definition.voids[0][0]).toEqual(point(1, 1));
  expect(element.definition.type === 'slab' && element.definition.boundary[0]).toEqual(point(2, 3));
  expect(element.definition.type === 'slab' && element.definition.voids?.[0][0]).toEqual(point(3, 4));
  expect(result).toMatchObject({ status: 'applied', badgeText: 'Mover: 3.61 m' });
});
