import * as THREE from 'three';
import { validateDefinition } from '../../core/model/Geometry';
import { edgeNormal, slideEdge, translateDefinition } from '../../core/model/GeometryEditing';
import type { WasmBridge } from '../../kernel/WasmBridge';
import { applyGeometry } from './ElementGeometry';
import type { GripHandleData } from './StructuralGripRenderer';
import type { ManagedElement, StructuralDefinition, Vector3D } from './types';

export interface GripGeometryUpdateInput {
  element: ManagedElement;
  initialDefinition: StructuralDefinition;
  grip: GripHandleData;
  snappedPoint: Vector3D;
  delta: Vector3D;
  hitPoint: Vector3D;
}

export type GripGeometryUpdateResult =
  | { status: 'applied'; badgeText: string; gripPosition: Vector3D; guideDirection?: Vector3D }
  | { status: 'rejected'; message: string; guideDirection?: Vector3D };

export class GripGeometryEditor {
  constructor(private readonly wasm: WasmBridge) {}

  public update(input: GripGeometryUpdateInput): GripGeometryUpdateResult {
    const { element, initialDefinition, grip, delta, hitPoint } = input;
    let { x, y, z } = input.snappedPoint;

    if (grip.gripType === 'move' || grip.gripType === 'slab_edge_mid') {
      return this.updateMoveOrEdge(input, { x, y, z });
    }

    element.definition = structuredClone(initialDefinition);
    const definition = element.definition;
    let badgeText = '';

    if (definition.type === 'beam') {
      if (grip.gripType === 'linear_start') definition.startPoint = { x, y, z };
      else if (grip.gripType === 'linear_end') definition.endPoint = { x, y, z };

      const start = new THREE.Vector3(definition.startPoint.x, definition.startPoint.y, definition.startPoint.z);
      const end = new THREE.Vector3(definition.endPoint.x, definition.endPoint.y, definition.endPoint.z);
      badgeText = `Longitud L: ${start.distanceTo(end).toFixed(2)} m`;
      const meshData = this.wasm.createArbitraryBeam(definition.startPoint, definition.endPoint, definition.width, definition.height);
      this.applyLiveGeometry(element, meshData.geometry);
    } else if (definition.type === 'column') {
      if (definition.columnStyle === 'slanted') {
        if (grip.gripType === 'col_base') definition.basePoint = { x, y, z };
        else if (grip.gripType === 'col_top') definition.topPoint = { x, y, z };

        const base = new THREE.Vector3(definition.basePoint.x, definition.basePoint.y, definition.basePoint.z);
        const top = new THREE.Vector3(definition.topPoint.x, definition.topPoint.y, definition.topPoint.z);
        badgeText = `Longitud Inclinada: ${base.distanceTo(top).toFixed(2)} m (ΔY: ${(top.y - base.y).toFixed(2)}m)`;
        const meshData = this.wasm.createSlantedColumn(definition.basePoint, definition.topPoint, definition.width, definition.depth);
        this.applyLiveGeometry(element, meshData.geometry);
      } else {
        if (grip.gripType === 'col_top') {
          definition.topPoint.y = Math.max(definition.basePoint.y + 0.5, y);
          const height = definition.topPoint.y - definition.basePoint.y;
          badgeText = `Altura h: ${height.toFixed(2)} m (Cota Sup: ${definition.topPoint.y >= 0 ? '+' : ''}${definition.topPoint.y.toFixed(2)}m)`;
        } else if (grip.gripType === 'col_base') {
          definition.basePoint.y = Math.min(definition.topPoint.y - 0.5, y);
          const height = definition.topPoint.y - definition.basePoint.y;
          badgeText = `Altura h: ${height.toFixed(2)} m (Cota Base: ${definition.basePoint.y >= 0 ? '+' : ''}${definition.basePoint.y.toFixed(2)}m)`;
        }
        const meshData = this.wasm.createColumn(
          definition.basePoint.x,
          definition.basePoint.z,
          definition.basePoint.y,
          definition.topPoint.y,
          definition.width,
          definition.depth,
        );
        this.applyLiveGeometry(element, meshData.geometry);
      }
    } else if (definition.type === 'slab') {
      if (grip.gripType === 'slab_vertex' && grip.index !== undefined) {
        definition.boundary[grip.index] = { x, y: definition.elevationY, z };
        badgeText = `Vértice ${grip.index + 1}: (${x.toFixed(2)}m, ${z.toFixed(2)}m)`;
      } else if (
        grip.gripType === 'void_vertex' && grip.voidIndex !== undefined &&
        grip.index !== undefined && definition.voids
      ) {
        definition.voids[grip.voidIndex][grip.index] = { x, y: definition.elevationY, z };
        badgeText = `Hueco Interior - Vértice ${grip.index + 1}`;
      }

      const meshData = this.wasm.createPolygonSlab(definition.boundary, definition.voids, definition.thickness, definition.elevationY);
      this.applyLiveGeometry(element, meshData.geometry);
    } else {
      const halfWidth = Math.max(0.5, Math.abs(x - definition.center.x));
      const halfLength = Math.max(0.5, Math.abs(z - definition.center.z));
      definition.width = halfWidth * 2;
      definition.length = halfLength * 2;
      badgeText = `Cimentación: ${definition.width.toFixed(2)}m × ${definition.length.toFixed(2)}m`;
      const meshData = this.wasm.createFooting(
        definition.center.x,
        definition.center.y,
        definition.center.z,
        definition.width,
        definition.length,
        definition.height,
      );
      this.applyLiveGeometry(element, meshData.geometry);
    }

    return {
      status: 'applied',
      badgeText,
      gripPosition: { x, y: y + (element.type === 'column' ? 0.16 : 0.05), z },
    };
  }

  private updateMoveOrEdge(
    input: GripGeometryUpdateInput,
    snappedPoint: Vector3D,
  ): GripGeometryUpdateResult {
    const { element, initialDefinition, grip, delta, hitPoint } = input;
    const origin = grip.originalPoint;
    let candidate = structuredClone(initialDefinition);
    let guideDirection: Vector3D | undefined;

    try {
      if (grip.gripType === 'move') {
        candidate = translateDefinition(candidate, delta);
      } else if (candidate.type === 'slab') {
        const ring = grip.voidIndex === undefined ? candidate.boundary : candidate.voids![grip.voidIndex];
        const normal = edgeNormal(ring, grip.edgeStartIndex!);
        const raw = { x: hitPoint.x - origin.x, y: 0, z: hitPoint.z - origin.z };
        const amount = Math.round((raw.x * normal.x + raw.z * normal.z) * 100) / 100;
        const moved = slideEdge(ring, grip.edgeStartIndex!, {
          x: normal.x * amount,
          y: 0,
          z: normal.z * amount,
        });
        if (grip.voidIndex === undefined) candidate.boundary = moved;
        else candidate.voids![grip.voidIndex] = moved;
        snappedPoint.x = origin.x + normal.x * amount;
        snappedPoint.z = origin.z + normal.z * amount;
        guideDirection = normal;
      }

      validateDefinition(candidate);
      applyGeometry(element, candidate, this.wasm);
    } catch (error) {
      return { status: 'rejected', message: (error as Error).message, guideDirection };
    }

    const distance = Math.hypot(delta.x, delta.y, delta.z);
    return {
      status: 'applied',
      badgeText: grip.gripType === 'move' ? `Mover: ${distance.toFixed(2)} m` : 'Borde paralelo',
      gripPosition: { x: snappedPoint.x, y: snappedPoint.y + 0.05, z: snappedPoint.z },
      guideDirection,
    };
  }

  private applyLiveGeometry(element: ManagedElement, geometry: THREE.BufferGeometry): void {
    element.mesh.geometry.dispose();
    element.mesh.geometry = geometry;
    element.line.geometry.dispose();
    element.line.geometry = new THREE.EdgesGeometry(geometry, 20);
    element.mesh.updateMatrixWorld(true);
  }
}
