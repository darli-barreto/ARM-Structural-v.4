import type { Vector3D } from '../core/model/Geometry';

export const KERNEL_CONTRACT_VERSION = 1 as const;

export const KERNEL_UNITS = {
  length: 'm',
  force: 'N',
  stress: 'Pa',
  moment: 'N*m',
  mass: 'kg',
} as const;

export const KERNEL_AXES = {
  handedness: 'right-handed',
  plan: ['x', 'z'],
  vertical: 'y',
  positiveRotation: 'right-hand-rule',
} as const;

export const KERNEL_DOF_ORDER = ['ux', 'uy', 'uz', 'rx', 'ry', 'rz'] as const;

export const KERNEL_TOLERANCES = {
  geometryEpsilonM: 1e-9,
  minimumElementLengthM: 1e-3,
  defaultConnectionToleranceM: 1e-3,
  maximumCoordinateM: 1e6,
  maximumDimensionM: 1e4,
} as const;

export type KernelErrorCode =
  | 'KERNEL_NON_FINITE'
  | 'KERNEL_NOT_POSITIVE'
  | 'KERNEL_SEGMENT_TOO_SHORT'
  | 'KERNEL_OUT_OF_RANGE'
  | 'KERNEL_DEGENERATE_MESH'
  | 'KERNEL_UNSUPPORTED_VERSION'
  | 'KERNEL_INVALID_REQUEST'
  | 'KERNEL_SINGULAR_SYSTEM'
  | 'KERNEL_NUMERICAL_FAILURE';

export class KernelContractError extends Error {
  constructor(
    public readonly code: KernelErrorCode,
    public readonly field: string,
  ) {
    super(`${code}: ${field}`);
    this.name = 'KernelContractError';
  }
}

export function assertKernelPoint(point: Vector3D, field: string): void {
  if (!point || ![point.x, point.y, point.z].every(Number.isFinite)) {
    throw new KernelContractError('KERNEL_NON_FINITE', field);
  }
  if ([point.x, point.y, point.z].some(value => Math.abs(value) > KERNEL_TOLERANCES.maximumCoordinateM)) {
    throw new KernelContractError('KERNEL_OUT_OF_RANGE', field);
  }
}

export function assertKernelPositive(value: number, field: string): void {
  if (!Number.isFinite(value)) {
    throw new KernelContractError('KERNEL_NON_FINITE', field);
  }
  if (value <= 0) {
    throw new KernelContractError('KERNEL_NOT_POSITIVE', field);
  }
  if (value < KERNEL_TOLERANCES.geometryEpsilonM || value > KERNEL_TOLERANCES.maximumDimensionM) {
    throw new KernelContractError('KERNEL_OUT_OF_RANGE', field);
  }
}

export function assertKernelSegment(start: Vector3D, end: Vector3D, field: string): void {
  assertKernelPoint(start, `${field}.start`);
  assertKernelPoint(end, `${field}.end`);
  const length = Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z);
  if (length < KERNEL_TOLERANCES.minimumElementLengthM) {
    throw new KernelContractError('KERNEL_SEGMENT_TOO_SHORT', field);
  }
  if (length > KERNEL_TOLERANCES.maximumDimensionM) {
    throw new KernelContractError('KERNEL_OUT_OF_RANGE', field);
  }
}

/** Explicit conversions at the legacy application (kN/MPa) to SI kernel boundary. */
export function kernelForceN(forceKn: number): number {
  if (!Number.isFinite(forceKn) || !Number.isFinite(forceKn * 1_000)) {
    throw new KernelContractError('KERNEL_NON_FINITE', 'forceKn');
  }
  return forceKn * 1_000;
}

export function kernelStressPa(stressMpa: number): number {
  if (!Number.isFinite(stressMpa) || !Number.isFinite(stressMpa * 1_000_000)) {
    throw new KernelContractError('KERNEL_NON_FINITE', 'stressMpa');
  }
  return stressMpa * 1_000_000;
}

export function kernelMomentNm(momentKnm: number): number {
  if (!Number.isFinite(momentKnm) || !Number.isFinite(momentKnm * 1_000)) {
    throw new KernelContractError('KERNEL_NON_FINITE', 'momentKnm');
  }
  return momentKnm * 1_000;
}
