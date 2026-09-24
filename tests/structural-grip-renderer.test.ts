import { expect, test } from 'bun:test';
import * as THREE from 'three';
import type { ManagedElement } from '../src/tools/structural/types';
import { StructuralGripRenderer } from '../src/tools/structural/StructuralGripRenderer';

function element(definition: ManagedElement['definition']): ManagedElement {
  const geometry = new THREE.BoxGeometry(4, 0.2, 3);
  return {
    id: 'LOS-1',
    type: definition.type,
    mesh: new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()),
    line: new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial()),
    volume: 1,
    levelName: 'Nivel 1',
    dimensions: '',
    definition,
  };
}

test('renderer crea grips de contorno, borde, hueco y movimiento desde la definición paramétrica', () => {
  const renderer = new StructuralGripRenderer();
  const slab: ManagedElement['definition'] = {
    type: 'slab',
    boundary: [{ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }, { x: 4, y: 0, z: 3 }, { x: 0, y: 0, z: 3 }],
    voids: [[{ x: 1, y: 0, z: 1 }, { x: 2, y: 0, z: 1 }, { x: 2, y: 0, z: 2 }]],
    thickness: 0.2,
    elevationY: 0,
  };

  renderer.render(element(slab), slab);
  const grips = renderer.getMeshes();
  expect(grips).toHaveLength(15);
  expect(grips.filter(grip => grip.userData.gripType === 'slab_vertex')).toHaveLength(4);
  expect(grips.filter(grip => grip.userData.gripType === 'void_vertex')).toHaveLength(3);
  expect(grips.filter(grip => grip.userData.gripType === 'slab_edge_mid' && grip.userData.voidIndex === 0)).toHaveLength(3);
  expect(grips.at(-1)?.userData.gripType).toBe('move');

  renderer.clear();
  expect(renderer.group.children).toHaveLength(0);
  expect(renderer.getMeshes()).toHaveLength(0);
});
