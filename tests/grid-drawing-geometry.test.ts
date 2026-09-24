import { expect, test } from 'bun:test';
import * as THREE from 'three';
import {
  applyOrtho,
  calculateArcCenterEnds,
  calculateArcStartEndRadius,
  calculateOffsetLine,
  distanceToSegment,
  generateNextGridName,
} from '../src/tools/GridDrawingGeometry';

test('constrains orthogonal drawing to the dominant axis without mutating inputs', () => {
  const origin = new THREE.Vector2(0, 0);
  const target = new THREE.Vector2(5, 2);
  expect(applyOrtho(origin, target).toArray()).toEqual([5, 0]);
  expect(applyOrtho(origin, new THREE.Vector2(2, 5)).toArray()).toEqual([0, 5]);
  expect(target.toArray()).toEqual([5, 2]);
});

test('offsets a line toward the cursor and returns independent points', () => {
  const start = new THREE.Vector2(0, 0);
  const end = new THREE.Vector2(10, 0);
  const offset = calculateOffsetLine(start, end, new THREE.Vector2(2, 1), 2);
  expect(offset.p1.toArray()).toEqual([0, 2]);
  expect(offset.p2.toArray()).toEqual([10, 2]);
  expect(offset.p1).not.toBe(start);
});

test('arc solvers preserve radius and sweep direction rules', () => {
  const byRadius = calculateArcStartEndRadius(
    new THREE.Vector2(0, 0), new THREE.Vector2(10, 0), new THREE.Vector2(5, 5), 0,
  );
  expect(byRadius?.radius).toBeCloseTo(5);
  expect(byRadius?.clockwise).toBe(false);

  const byCenter = calculateArcCenterEnds(
    new THREE.Vector2(0, 0), new THREE.Vector2(1, 0), new THREE.Vector2(0, 1), 0,
  );
  expect(byCenter?.radius).toBe(1);
  expect(byCenter?.clockwise).toBe(false);
  expect(calculateArcStartEndRadius(new THREE.Vector2(), new THREE.Vector2(0.1, 0), new THREE.Vector2(1, 1), 0)).toBeNull();
});

test('measures segment distance and generates deterministic grid names', () => {
  expect(distanceToSegment(new THREE.Vector2(4, 3), new THREE.Vector2(0, 0), new THREE.Vector2(10, 0))).toBe(3);
  expect(generateNextGridName(new THREE.Vector2(0, 0), new THREE.Vector2(0, 10), ['1', '3'])).toBe('4');
  expect(generateNextGridName(new THREE.Vector2(0, 0), new THREE.Vector2(10, 0), ['A', 'C'])).toBe('B');
  expect(generateNextGridName(new THREE.Vector2(0, 0), new THREE.Vector2(10, 0), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''))).toBe('G27');
});
