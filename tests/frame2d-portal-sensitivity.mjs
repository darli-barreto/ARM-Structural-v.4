import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initSync, solve_frame2d_v1 } from '../structural_kernel/pkg/structural_kernel.js';
import { benchmarkModel } from '../src/core/analysis/Benchmarks.ts';
import { solveFrame } from '../src/core/analysis/Solver.ts';
import { compareFrame2dResults, toFrame2dKernelInput } from '../src/core/analysis/KernelAdapter.ts';
import { portalForceReference } from './fixtures/portal-force-reference.mjs';

initSync({ module: readFileSync(new URL('../structural_kernel/pkg/structural_kernel_bg.wasm', import.meta.url)) });
const factors = { dead: 1, live: 1, nodal: 1 };
const points = [[0, 0], [0, 3], [5, 3], [5, 0]];
const loads = [[0, 0, 0], [5, 0, 0], [7, 0, 0], [0, 0, 0]];
const base = benchmarkModel('cantilever');
const section = base.members[0];
base.nodes = points.map(([x, y], i) => ({ id: `P${i}`, x, y,
  support: i === 0 || i === 3 ? 'fixed' : 'free', fx: loads[i][0], fy: 0, moment: 0 }));
base.members = [0, 1, 2].map(i => ({ ...section, id: `M${i}`, start: `P${i}`, end: `P${i + 1}` }));
let models = 0;
let parityChecks = 0;
const samples = [];

function near(actual, expected, absolute, label, relative = 0) {
  const tolerance = absolute + relative * Math.abs(expected);
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
    `${label}: ${actual} vs ${expected}, tolerance ${tolerance}`);
}

function run(model, name) {
  const memberRigidities = model.members.map(m => {
    const E = m.elasticModulusMPa * 1000;
    return { EA: E * m.area, EI: E * m.inertia, shear: (5 / 6) * E * m.area / (2 * (1 + m.poisson)) };
  });
  const reference = portalForceReference(points, loads, { memberRigidities });
  const arm = solveFrame(model, factors, name);
  const rust = JSON.parse(solve_frame2d_v1(JSON.stringify({ ...toFrame2dKernelInput(model, factors),
    requestId: name, revision: model.revision })));
  const parity = compareFrame2dResults(model, factors, arm, rust);
  assert.equal(parity.passed, true, `${name}: ARM/Rust parity`);
  reference.displacements.forEach(([ux, uy, rz], i) => {
    for (const [actual, expected] of [
      [arm.nodes[i].ux, ux], [arm.nodes[i].uy, uy], [arm.nodes[i].rotation, -rz],
      [rust.nodes[i].uxM, ux], [rust.nodes[i].uyM, uy], [rust.nodes[i].rzRad, rz],
    ]) near(actual, expected, 1e-10, `${name}: node ${i}`);
  });
  for (const [index, reaction] of [[0, reference.left], [3, reference.right]]) {
    const a = arm.nodes[index], r = rust.nodes[index];
    [a.rx, a.ry, -a.rm, r.reactionFxN / 1000, r.reactionFyN / 1000, r.reactionMzNm / 1000]
      .forEach((value, i) => near(value, reaction[i % 3], 1e-7, `${name}: reaction`));
  }
  reference.memberForces.forEach((forces, i) => forces.forEach((value, dof) => {
    near(rust.members[i].localEndForces[dof] / 1000, value, 1e-7, `${name}: Rust member force`);
    near(arm.members[i].endForces[dof], dof % 3 === 2 ? -value : value, 1e-7, `${name}: ARM member force`);
  }));
  assert.ok(rust.diagnostics.maxResidualToleranceRatio <= 1);
  models++;
  parityChecks += parity.rows.length + parity.memberRows.length + parity.diagramRows.length + parity.deformationRows.length;
  const result = {
    reference: [reference.displacements[2][0], reference.left[0]],
    arm: [arm.nodes[2].ux, arm.nodes[0].rx],
    rust: [rust.nodes[2].uxM, rust.nodes[0].reactionFxN / 1000],
  };
  samples.push({ name, roofUxM: result.reference[0], leftRxKN: result.reference[1],
    condition: rust.diagnostics.scaledConditionEstimate });
  return result;
}

run(base, 'baseline');
const sensitivities = [];
for (const property of ['elasticModulusMPa', 'inertia']) {
  let previous;
  for (const epsilon of [1e-3, 1e-5]) {
    const plus = structuredClone(base), minus = structuredClone(base);
    plus.members[0][property] *= 1 + epsilon;
    minus.members[0][property] *= 1 - epsilon;
    const upper = run(plus, `${property}-plus-${epsilon}`);
    const lower = run(minus, `${property}-minus-${epsilon}`);
    const derivatives = Object.fromEntries(['reference', 'arm', 'rust'].map(engine => [engine,
      upper[engine].map((value, i) => (value - lower[engine][i]) / (2 * epsilon))]));
    for (const engine of ['arm', 'rust']) {
      near(derivatives[engine][0], derivatives.reference[0], 1e-10, `${engine}: roof sensitivity`, 1e-6);
      near(derivatives[engine][1], derivatives.reference[1], 1e-7, `${engine}: reaction sensitivity`, 1e-6);
    }
    // Check that the two perturbation sizes resolve the same nonzero response derivative.
    assert.ok(Math.abs(derivatives.reference[0]) > 1e-6);
    assert.ok(Math.abs(derivatives.reference[1]) > 0.01);
    if (previous) derivatives.reference.forEach((value, i) =>
      near(value, previous[i], i === 0 ? 1e-10 : 1e-7, 'step convergence', 1e-5));
    previous = derivatives.reference;
    sensitivities.push({ property, epsilon, derivatives });
  }
}
console.log(JSON.stringify({ samples, sensitivities, totals: { models, parityChecks,
  derivativeComparisons: sensitivities.length * 4 },
  scope: 'One-storey rigid portal, left-column stiffness perturbations; independent force-method reference, not general building qualification.' }, null, 2));
