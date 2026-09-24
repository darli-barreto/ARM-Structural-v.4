import { expect, test } from 'bun:test';
import type { StructuralDefinition } from '../src/core/model/Geometry';
import { rotateDefinitionAroundCenter, translateDefinition } from '../src/tools/structural/StructuralDefinitionTransforms';

test('translations preserve the input definition and include slab voids', () => {
  const slab: StructuralDefinition = {
    type: 'slab',
    boundary: [{ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }, { x: 4, y: 0, z: 3 }],
    voids: [[{ x: 1, y: 0, z: 1 }, { x: 2, y: 0, z: 1 }, { x: 2, y: 0, z: 2 }]],
    thickness: 0.2,
    elevationY: 0,
  };
  const original = structuredClone(slab);
  const moved = translateDefinition(slab, { x: 2, y: 3, z: -1 });

  expect(slab).toEqual(original);
  expect(moved.type === 'slab' && moved.elevationY).toBe(3);
  expect(moved.type === 'slab' && moved.boundary[0]).toEqual({ x: 2, y: 3, z: -1 });
  expect(moved.type === 'slab' && moved.voids?.[0][0]).toEqual({ x: 3, y: 3, z: 0 });
});

test('radial copies rotate a beam in the XZ plane without altering the source', () => {
  const beam: StructuralDefinition = {
    type: 'beam',
    startPoint: { x: 1, y: 2, z: 0 },
    endPoint: { x: 2, y: 2, z: 0 },
    width: 0.3,
    height: 0.5,
  };
  const original = structuredClone(beam);
  const rotated = rotateDefinitionAroundCenter(beam, { x: 0, y: 0, z: 0 }, Math.PI / 2);

  expect(beam).toEqual(original);
  expect(rotated.type === 'beam' && rotated.startPoint.x).toBeCloseTo(0);
  expect(rotated.type === 'beam' && rotated.startPoint.z).toBeCloseTo(1);
  expect(rotated.type === 'beam' && rotated.startPoint.y).toBe(2);
});
