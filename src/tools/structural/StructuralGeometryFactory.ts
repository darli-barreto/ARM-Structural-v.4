import * as THREE from 'three';
import type { StructuralDefinition } from '../../core/model/Geometry';
import type { WasmBridge } from '../../kernel/WasmBridge';

export function createStructuralGeometry(
  definition: StructuralDefinition,
  wasm: WasmBridge,
): { geometry: THREE.BufferGeometry; volume: number } {
  switch (definition.type) {
    case 'beam': {
      const mesh = wasm.createArbitraryBeam(definition.startPoint, definition.endPoint, definition.width, definition.height);
      return { geometry: mesh.geometry, volume: mesh.volume };
    }
    case 'column': {
      const mesh = definition.columnStyle === 'slanted'
        ? wasm.createSlantedColumn(definition.basePoint, definition.topPoint, definition.width, definition.depth)
        : wasm.createColumn(definition.basePoint.x, definition.basePoint.z, definition.basePoint.y, definition.topPoint.y, definition.width, definition.depth);
      return { geometry: mesh.geometry, volume: mesh.volume };
    }
    case 'slab': {
      const mesh = wasm.createPolygonSlab(definition.boundary, definition.voids, definition.thickness, definition.elevationY);
      return { geometry: mesh.geometry, volume: mesh.volume };
    }
    case 'footing': {
      const mesh = wasm.createFooting(definition.center.x, definition.center.y, definition.center.z, definition.width, definition.length, definition.height);
      return { geometry: mesh.geometry, volume: mesh.volume };
    }
  }
}
