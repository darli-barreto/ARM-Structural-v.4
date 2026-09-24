import * as THREE from 'three';

export interface ArcDrawingData {
  start: THREE.Vector2;
  end: THREE.Vector2;
  center: THREE.Vector2;
  radius: number;
  startAngle: number;
  endAngle: number;
  clockwise: boolean;
}

export function applyOrtho(origin: THREE.Vector2, target: THREE.Vector2): THREE.Vector2 {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  return Math.abs(dx) >= Math.abs(dy)
    ? new THREE.Vector2(target.x, origin.y)
    : new THREE.Vector2(origin.x, target.y);
}

export function calculateOffsetLine(
  start: THREE.Vector2,
  end: THREE.Vector2,
  cursor: THREE.Vector2,
  offset: number,
): { p1: THREE.Vector2; p2: THREE.Vector2 } {
  if (offset <= 0) return { p1: start.clone(), p2: end.clone() };
  const direction = new THREE.Vector2().subVectors(end, start);
  const length = direction.length();
  if (length < 0.001) return { p1: start.clone(), p2: end.clone() };
  direction.normalize();
  const normal = new THREE.Vector2(-direction.y, direction.x);
  const side = new THREE.Vector2().subVectors(cursor, start).dot(normal) >= 0 ? 1 : -1;
  const offsetVector = normal.multiplyScalar(side * offset);
  return {
    p1: new THREE.Vector2().addVectors(start, offsetVector),
    p2: new THREE.Vector2().addVectors(end, offsetVector),
  };
}

export function calculateArcStartEndRadius(
  start: THREE.Vector2,
  end: THREE.Vector2,
  cursor: THREE.Vector2,
  offset: number,
): ArcDrawingData | null {
  const chord = new THREE.Vector2().subVectors(end, start);
  const chordLength = chord.length();
  if (chordLength < 0.5) return null;

  const midpoint = new THREE.Vector2().addVectors(start, end).multiplyScalar(0.5);
  const chordDirection = chord.normalize();
  const chordNormal = new THREE.Vector2(-chordDirection.y, chordDirection.x);
  const cursorFromMidpoint = new THREE.Vector2().subVectors(cursor, midpoint);
  let sagitta = cursorFromMidpoint.dot(chordNormal);
  if (Math.abs(sagitta) < 0.08) sagitta = 0.08 * (sagitta >= 0 ? 1 : -1);

  const absSagitta = Math.abs(sagitta);
  let radius = absSagitta / 2 + (chordLength * chordLength) / (8 * absSagitta);
  const centerSign = sagitta >= 0 ? 1 : -1;
  const center = new THREE.Vector2().addVectors(
    midpoint,
    chordNormal.clone().multiplyScalar(-centerSign * (radius - absSagitta)),
  );

  if (offset > 0) {
    if (cursor.distanceTo(center) > radius) radius += offset;
    else radius = Math.max(1, radius - offset);
  }

  return {
    start,
    end,
    center,
    radius,
    startAngle: Math.atan2(start.y - center.y, start.x - center.x),
    endAngle: Math.atan2(end.y - center.y, end.x - center.x),
    clockwise: sagitta < 0,
  };
}

export function calculateArcCenterEnds(
  center: THREE.Vector2,
  start: THREE.Vector2,
  end: THREE.Vector2,
  offset: number,
): ArcDrawingData | null {
  let radius = center.distanceTo(start);
  if (radius < 0.5) return null;
  if (offset > 0) {
    if (center.distanceTo(end) > radius) radius += offset;
    else radius = Math.max(1, radius - offset);
  }

  const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
  const endAngle = Math.atan2(end.y - center.y, end.x - center.x);
  let difference = endAngle - startAngle;
  while (difference < -Math.PI) difference += Math.PI * 2;
  while (difference > Math.PI) difference -= Math.PI * 2;
  return { start, end, center, radius, startAngle, endAngle, clockwise: difference < 0 };
}

export function distanceToSegment(point: THREE.Vector2, start: THREE.Vector2, end: THREE.Vector2): number {
  const segment = new THREE.Vector2().subVectors(end, start);
  const pointFromStart = new THREE.Vector2().subVectors(point, start);
  const lengthSquared = segment.lengthSq();
  if (lengthSquared === 0) return pointFromStart.length();
  const ratio = THREE.MathUtils.clamp(pointFromStart.dot(segment) / lengthSquared, 0, 1);
  return point.distanceTo(start.clone().add(segment.multiplyScalar(ratio)));
}

export function generateNextGridName(start: THREE.Vector2, end: THREE.Vector2, names: string[]): string {
  const isVertical = Math.abs(start.x - end.x) < Math.abs(start.y - end.y);
  if (isVertical) {
    const numbers = names.map(name => parseInt(name)).filter(value => !Number.isNaN(value));
    return (numbers.length ? Math.max(...numbers) + 1 : 1).toString();
  }

  const existing = new Set(names.map(name => name.toUpperCase()));
  for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    if (!existing.has(letter)) return letter;
  }
  return `G${names.length + 1}`;
}
