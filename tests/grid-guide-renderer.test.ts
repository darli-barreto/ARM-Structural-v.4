import { expect, test } from 'bun:test';
import * as THREE from 'three';
import type { GridElement } from '../src/config/structural.config';
import { GridGuideRenderer } from '../src/core/grid/rendering/GridGuideRenderer';

test('crea y limpia guias de alineacion y de cursor en sus grupos', () => {
  const alignmentGroup = new THREE.Group();
  const guidesGroup = new THREE.Group();
  const renderer = new GridGuideRenderer(alignmentGroup, guidesGroup);
  const main = {
    id: 'g1', geomType: 'line', start: { x: 1, z: 0 }, end: { x: 1, z: 8 },
  } as GridElement;
  const elements = [
    main,
    { id: 'g2', geomType: 'line', start: { x: 4, z: 0 }, end: { x: 4, z: 8 } } as GridElement,
  ];

  renderer.showAlignmentGuide(
    main,
    'start',
    [{ gridId: 'g1', end: 'start', originalCoord: 1 }, { gridId: 'g2', end: 'start', originalCoord: 4 }],
    elements,
    0
  );
  expect(alignmentGroup.children).toHaveLength(1);
  const line = alignmentGroup.children[0] as THREE.Line;
  expect(line.geometry.getAttribute('position').count).toBe(2);

  renderer.showGuideLine(2, null, 0);
  expect(guidesGroup.children).toHaveLength(1);
  renderer.showGuideLine(null, 3, 0);
  expect(guidesGroup.children).toHaveLength(1);

  renderer.clearAlignmentGuide();
  renderer.hideGuideLine();
  expect(alignmentGroup.children).toHaveLength(0);
  expect(guidesGroup.children).toHaveLength(0);
});
