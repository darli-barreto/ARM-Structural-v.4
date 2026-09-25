import { describe, expect, test } from 'bun:test';
import {
  assertKernelPoint,
  assertKernelPositive,
  assertKernelSegment,
  KERNEL_AXES,
  KERNEL_CONTRACT_VERSION,
  KERNEL_DOF_ORDER,
  KERNEL_TOLERANCES,
  KERNEL_UNITS,
  KernelContractError,
  kernelForceN,
  kernelStressPa,
  kernelMomentNm,
} from '../src/kernel/KernelContract';

describe('Structural Kernel contract v1', () => {
  test('declares the canonical numerical conventions', () => {
    expect(KERNEL_CONTRACT_VERSION).toBe(1);
    expect(KERNEL_UNITS).toEqual({
      length: 'm',
      force: 'N',
      stress: 'Pa',
      moment: 'N*m',
      mass: 'kg',
    });
    expect(KERNEL_AXES.vertical).toBe('y');
    expect(KERNEL_AXES.plan).toEqual(['x', 'z']);
    expect(KERNEL_DOF_ORDER).toEqual(['ux', 'uy', 'uz', 'rx', 'ry', 'rz']);
  });

  test('accepts finite values and structural dimensions', () => {
    expect(() => assertKernelPoint({ x: -10, y: 3.5, z: 8 }, 'node')).not.toThrow();
    expect(() => assertKernelPositive(0.25, 'beam.width')).not.toThrow();
    expect(() => assertKernelSegment(
      { x: 0, y: 0, z: 0 },
      { x: 6, y: 0, z: 0 },
      'beam.axis',
    )).not.toThrow();
  });

  test('returns stable error codes for invalid inputs', () => {
    expect(() => assertKernelPositive(Number.NaN, 'beam.width')).toThrow(
      new KernelContractError('KERNEL_NON_FINITE', 'beam.width'),
    );
    expect(() => assertKernelPositive(0, 'beam.width')).toThrow(
      new KernelContractError('KERNEL_NOT_POSITIVE', 'beam.width'),
    );
    expect(() => assertKernelSegment(
      { x: 0, y: 0, z: 0 },
      { x: KERNEL_TOLERANCES.minimumElementLengthM / 2, y: 0, z: 0 },
      'beam.axis',
    )).toThrow(new KernelContractError('KERNEL_SEGMENT_TOO_SHORT', 'beam.axis'));
  });

  test('converts application engineering units to canonical SI explicitly', () => {
    expect(kernelForceN(32)).toBe(32_000);
    expect(kernelStressPa(25)).toBe(25_000_000);
    expect(kernelMomentNm(80)).toBe(80_000);
    expect(() => kernelForceN(Number.POSITIVE_INFINITY)).toThrow('KERNEL_NON_FINITE');
  });
});
