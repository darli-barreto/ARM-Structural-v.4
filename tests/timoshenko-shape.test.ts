import { expect, test } from 'bun:test';
import { benchmarkModel } from '../src/core/analysis/Benchmarks';
import { solveFrame } from '../src/core/analysis/Solver';
import { sampleTimoshenkoShape } from '../src/core/analysis/TimoshenkoShape';

const factors = { dead: 1, live: 1, nodal: 1 };

test('cantilever tip force follows the closed-form Timoshenko field at every station', () => {
  const model = benchmarkModel('cantilever');
  const result = solveFrame(model, factors, 'cantilever curve');
  const member = model.members[0];
  const curve = result.members[0];
  const length = 3;
  const load = -10_000;
  const ei = member.elasticModulusMPa * 1e6 * member.inertia;
  const shear = (5 / 6) * member.elasticModulusMPa * 1e6 * member.area / (2 * (1 + member.poisson));

  for (const [index, x] of curve.stations.entries()) {
    const expected = load * (length * x * x / 2 - x ** 3 / 6) / ei + load * x / shear;
    expect(Math.abs(curve.deflectionY[index] - expected)).toBeLessThan(1e-10);
    expect(Math.abs(curve.deflectionX[index])).toBeLessThan(1e-12);
  }
});

test('simply supported uniform load follows the closed-form bending and shear field', () => {
  const model = benchmarkModel('supported');
  const result = solveFrame(model, factors, 'supported curve');
  const member = model.members[0];
  const curve = result.members[0];
  const length = 6;
  const load = 10_000;
  const ei = member.elasticModulusMPa * 1e6 * member.inertia;
  const shear = (5 / 6) * member.elasticModulusMPa * 1e6 * member.area / (2 * (1 + member.poisson));

  for (const [index, x] of curve.stations.entries()) {
    const expected = -load * x * (length ** 3 - 2 * length * x * x + x ** 3) / (24 * ei)
      - load * x * (length - x) / (2 * shear);
    expect(Math.abs(curve.deflectionY[index] - expected)).toBeLessThan(1e-10);
    expect(Math.abs(curve.deflectionX[index])).toBeLessThan(1e-12);
  }
});

test('restrained axial member under uniform axial load has a parabolic field', () => {
  const length = 4;
  const ea = 2e9;
  const qx = 800;
  const stations = [0, 0.25, 1, 2, 3, 3.75, 4];
  const shape = sampleTimoshenkoShape({
    lengthM: length,
    axialRigidityN: ea,
    bendingRigidityNm2: 1e6,
    shearRigidityN: 1e8,
    endDisplacements: [0, 0, 0, 0, 0, 0],
    axialLoadNPerM: qx,
    transverseLoadNPerM: 0,
  }, stations);

  for (const [index, x] of stations.entries()) {
    expect(Math.abs(shape.axialM[index] - qx * x * (length - x) / (2 * ea))).toBeLessThan(1e-15);
    expect(shape.transverseM[index]).toBe(0);
  }
});
