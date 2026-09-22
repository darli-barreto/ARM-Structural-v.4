import * as THREE from 'three';
import type { StructuralDefinition } from '../../core/model/Geometry';
export type { Vector3D, ColumnDefinition, BeamDefinition, SlabDefinition, FootingDefinition, StructuralDefinition } from '../../core/model/Geometry';
import { BimElementDocument } from '../../core/database/BimDatabaseTypes';

export type ElementCategory = 'footing' | 'column' | 'beam' | 'slab';

import type { Vector3D } from '../../core/model/Geometry';

export interface ManagedElement {
  id: string; // Legacy ID (ej. COL-001)
  elementId?: number; // Revit Element ID numérico secuencial (ej. 100042)
  uniqueId?: string; // Revit UniqueId / GUID de 128-bit (MongoDB _id)
  bimDoc?: BimElementDocument; // Documento relacional BSON completo
  mesh: THREE.Mesh;
  line: THREE.LineSegments;
  type: ElementCategory;
  volume: number;
  levelName: string;
  dimensions: string;
  definition: StructuralDefinition;
}

export interface MetricsUpdate {
  count: number;
  volume: number;
  durationMs: number;
}

export interface AlignReference {
  type: 'grid' | 'element_edge' | 'level' | 'element_face';
  label: string;
  point: Vector3D;
  direction?: Vector3D; // Vector directriz de la línea o normal del plano
  axis?: 'X' | 'Z' | 'Y';
  coordinate?: number;
}

export interface ArrayOptions {
  type: 'linear' | 'radial';
  count: number;
  spacingMethod: 'second' | 'last'; // Mover al 2º elemento vs Mover al último
  delta?: Vector3D;
  center?: Vector3D; // Centro para matriz radial
  angleDegrees?: number; // Ángulo total para matriz radial
}
