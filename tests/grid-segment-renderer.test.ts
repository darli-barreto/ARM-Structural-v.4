import { expect, test } from 'bun:test';
import * as THREE from 'three';
import { GridSegmentRenderer } from '../src/core/grid/rendering/GridSegmentRenderer';

test('crea hitboxes y resaltes para segmentos con el paso indicado', () => {
  const hits = new THREE.Group();
  const highlights = new THREE.Group();
  const renderer = new GridSegmentRenderer(hits, highlights);
  const points = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(2, 0, 0),
    new THREE.Vector3(3, 0, 0),
    new THREE.Vector3(4, 0, 0),
  ];

  const result = renderer.renderInteractiveSegments(points, 2, 'G-1', 3, true, false);

  expect(result.hitMeshes).toHaveLength(2);
  expect(result.highlightMeshes).toHaveLength(2);
  expect(result.hitMeshes[0].userData).toEqual({ isGridLineHit: true, gridId: 'G-1' });
  expect(result.hitMeshes[0].position.y).toBeGreaterThan(3);
  expect(result.highlightMeshes.every(mesh => mesh.visible)).toBe(true);
  expect(hits.children).toHaveLength(2);
  expect(highlights.children).toHaveLength(2);
});
