import type { StructuralDefinition, Vector3D } from '../../core/model/Geometry';

export function translateDefinition(source: StructuralDefinition, delta: Vector3D): StructuralDefinition {
  const definition = structuredClone(source);
  const translatePoint = (point: Vector3D) => {
    point.x += delta.x;
    point.y += delta.y;
    point.z += delta.z;
  };

  switch (definition.type) {
    case 'beam':
      translatePoint(definition.startPoint);
      translatePoint(definition.endPoint);
      break;
    case 'column':
      translatePoint(definition.basePoint);
      translatePoint(definition.topPoint);
      break;
    case 'slab':
      definition.elevationY += delta.y;
      definition.boundary.forEach(translatePoint);
      definition.voids?.forEach(ring => ring.forEach(translatePoint));
      break;
    case 'footing':
      translatePoint(definition.center);
      break;
  }
  return definition;
}

export function rotateDefinitionAroundCenter(
  source: StructuralDefinition,
  center: Vector3D,
  angleRadians: number,
): StructuralDefinition {
  const definition = structuredClone(source);
  const cosine = Math.cos(angleRadians);
  const sine = Math.sin(angleRadians);
  const rotatePoint = (point: Vector3D) => {
    const relativeX = point.x - center.x;
    const relativeZ = point.z - center.z;
    point.x = center.x + relativeX * cosine - relativeZ * sine;
    point.z = center.z + relativeX * sine + relativeZ * cosine;
  };

  switch (definition.type) {
    case 'beam':
      rotatePoint(definition.startPoint);
      rotatePoint(definition.endPoint);
      break;
    case 'column':
      rotatePoint(definition.basePoint);
      rotatePoint(definition.topPoint);
      break;
    case 'slab':
      definition.boundary.forEach(rotatePoint);
      definition.voids?.forEach(ring => ring.forEach(rotatePoint));
      break;
    case 'footing':
      rotatePoint(definition.center);
      break;
  }
  return definition;
}
