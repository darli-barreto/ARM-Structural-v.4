import { describe, expect, test } from 'bun:test';
import { benchmarkModel } from '../src/core/analysis/Benchmarks';
import { toFrame2dKernelInput } from '../src/core/analysis/KernelAdapter';

describe('ARM analysis to Structural Kernel adapter', () => {
  test('maps supports and factored gravity loads to the versioned SI contract', () => {
    const model = benchmarkModel('supported');
    const input = toFrame2dKernelInput(model, { dead: 1.7, live: 1.6, nodal: 1.5 });

    expect(input.version).toBe(1);
    expect(input.nodes[0].restraint).toEqual({ ux: true, uy: true, rz: false });
    expect(input.nodes[1].restraint).toEqual({ ux: false, uy: true, rz: false });
    expect(input.members[0].material).toEqual({
      elasticModulusPa: 25_000_000_000,
      shearModulusPa: 25_000_000_000 / 2.4,
    });
    expect(input.members[0].uniformLoad).toEqual({ fxNPerM: 0, fyNPerM: -17_000 });
  });

  test('maps application clockwise nodal moment to kernel counter-clockwise SI', () => {
    const model = benchmarkModel('cantilever');
    model.nodes[1].moment = 2.5;
    const input = toFrame2dKernelInput(model, { dead: 1, live: 1, nodal: 2 });

    expect(input.nodes[1].load).toEqual({ fx: 0, fy: -20_000, mz: -5_000 });
    expect(input.members[0].uniformLoad).toEqual({ fxNPerM: 0, fyNPerM: 0 });
  });
});
