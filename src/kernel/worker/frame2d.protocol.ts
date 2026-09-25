export interface Frame2dModelV1 {
  version: 1;
  requestId: string;
  revision: number;
  nodes: Frame2dNode[];
  members: Frame2dMember[];
}

export type Frame2dModelInputV1 = Omit<Frame2dModelV1, 'requestId' | 'revision'>;

export interface Frame2dNode {
  id: string;
  position: { x: number; y: number };
  restraint: { ux: boolean; uy: boolean; rz: boolean };
  load?: { fx: number; fy: number; mz: number };
}

export interface Frame2dMember {
  id: string;
  startNode: string;
  endNode: string;
  material: { elasticModulusPa: number; shearModulusPa: number };
  section: { areaM2: number; inertiaM4: number; shearCorrection: number };
  releases?: { startRotation: boolean; endRotation: boolean };
  uniformLoad?: { fxNPerM: number; fyNPerM: number };
}

export interface Frame2dResultV1 {
  version: 1;
  requestId: string;
  revision: number;
  /** Optional for compatibility with older v1 WASM artifacts. Not a condition estimate. */
  diagnostics?: {
    freeDofs: number;
    /** Estimate for diagonally scaled stiffness; null for no free equations. May underestimate. */
    scaledConditionEstimate?: number | null;
    maxComponentwiseBackwardError: number;
    maxResidualToleranceRatio: number;
  };
  nodes: Array<{
    id: string;
    uxM: number;
    uyM: number;
    rzRad: number;
    reactionFxN: number;
    reactionFyN: number;
    reactionMzNm: number;
  }>;
  members: Array<{
    id: string;
    localEndForces: [number, number, number, number, number, number];
    deformedShape?: {
      stationsM: number[];
      globalDxM: number[];
      globalDyM: number[];
    };
  }>;
}

export type Frame2dWorkerRequest = { model: Frame2dModelV1 };
export type Frame2dWorkerResponse =
  | { ok: true; result: Frame2dResultV1 }
  | { ok: false; requestId: string; code: string; field: string };

export interface KernelFrameModule {
  solve_frame2d_v1(json: string): string;
}
