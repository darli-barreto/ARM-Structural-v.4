import type { Vector3D } from '../../core/model/Geometry';

export type KernelGeometry =
  | { type: 'beam'; start: Vector3D; end: Vector3D; width: number; height: number }
  | { type: 'column'; x: number; z: number; bottom: number; top: number; width: number; depth: number }
  | { type: 'footing'; center: Vector3D; width: number; length: number; height: number }
  | { type: 'slab'; center: Vector3D; width: number; length: number; thickness: number };

export interface MeshRequest {
  version: 1;
  requestId: string;
  revision: number;
  elementId: string;
  element: KernelGeometry;
}

export interface KernelMeshResult {
  version: 1;
  requestId: string;
  elementId: string;
  revision: number;
  positions: Float64Array;
  normals: Float64Array;
  indices: Uint32Array;
  volume: number;
}

export type WorkerResponse =
  | { ok: true; result: KernelMeshResult }
  | { ok: false; requestId: string; code: string; field: string };

export interface WasmMesh {
  positions(): Float64Array;
  normals(): Float64Array;
  indices(): Uint32Array;
  volume(): number;
  free(): void;
}

export interface KernelModule {
  default(): Promise<unknown>;
  kernel_contract_version(): number;
  kernel_contract_units(): string;
  execute_mesh_v1(json: string): WasmMesh;
  solve_frame2d_v1(json: string): string;
}
