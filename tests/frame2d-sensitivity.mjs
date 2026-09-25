import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initSync, solve_frame2d_v1 } from '../structural_kernel/pkg/structural_kernel.js';
import { benchmarkModel } from '../src/core/analysis/Benchmarks.ts';
import { solveFrame } from '../src/core/analysis/Solver.ts';
import { compareFrame2dResults, toFrame2dKernelInput } from '../src/core/analysis/KernelAdapter.ts';

initSync({ module: readFileSync(new URL('../structural_kernel/pkg/structural_kernel_bg.wasm', import.meta.url)) });
const factors = { dead: 1, live: 1, nodal: 1 };
const base = benchmarkModel('cantilever');
base.nodes[1].fy = -0.01;
const stiffness = base.members[0];
const length = base.nodes[1].x;
const force = base.nodes[1].fy;
const EI = stiffness.elasticModulusMPa * 1000 * stiffness.inertia;
const shearRigidity = (5 / 6) * stiffness.elasticModulusMPa * 1000 * stiffness.area / (2 * (1 + stiffness.poisson));
const bending = force * length ** 3 / (3 * EI);
const shear = force * length / shearRigidity;
let solves = 0;
let parityChecks = 0;

function near(actual, expected, tolerance, label) {
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
    `${label}: actual=${actual}, expected=${expected}, tolerance=${tolerance}`);
}

function solve(name, model) {
  const arm = solveFrame(model, factors, name);
  const input = { ...toFrame2dKernelInput(model, factors), requestId: name, revision: model.revision };
  const rust = JSON.parse(solve_frame2d_v1(JSON.stringify(input)));
  const parity = compareFrame2dResults(model, factors, arm, rust);
  assert.equal(parity.passed, true, `${name}: complete ARM/Rust parity`);
  assert.ok(rust.diagnostics.maxResidualToleranceRatio <= 1);
  assert.ok(Number.isFinite(rust.diagnostics.scaledConditionEstimate));
  const [a, tip] = model.nodes;
  const member = model.members[0];
  const L = tip.x - a.x;
  const E = member.elasticModulusMPa * 1000;
  const S = (5 / 6) * E * member.area / (2 * (1 + member.poisson));
  const expected = tip.fy * (L ** 3 / (3 * E * member.inertia) + L / S);
  for (const value of [arm.nodes[1].uy, rust.nodes[1].uyM]) near(value, expected, 1e-12, `${name}: analytical deflection`);
  near(arm.nodes[0].ry, -tip.fy, 1e-10, `${name}: ARM reaction`);
  near(rust.nodes[0].reactionFyN / 1000, -tip.fy, 1e-10, `${name}: Rust reaction`);
  solves++;
  parityChecks += parity.rows.length + parity.memberRows.length + parity.diagramRows.length + parity.deformationRows.length;
  return { arm: arm.nodes[1].uy, rust: rust.nodes[1].uyM, condition: rust.diagnostics.scaledConditionEstimate };
}

const baseline = solve('sensitivity-baseline', base);
const parameters = [
  { name: 'load', derivative: bending + shear, conditionInvariant: true,
    perturb: (model, factor) => { model.nodes[1].fy *= factor; } },
  { name: 'elastic-modulus', derivative: -(bending + shear), conditionInvariant: true,
    perturb: (model, factor) => { model.members[0].elasticModulusMPa *= factor; } },
  { name: 'inertia', derivative: -bending, conditionInvariant: false,
    perturb: (model, factor) => { model.members[0].inertia *= factor; } },
  { name: 'length', derivative: 3 * bending + shear, conditionInvariant: false,
    perturb: (model, factor) => { model.nodes[1].x *= factor; } },
];

const checks = [];
for (const parameter of parameters) {
  for (const epsilon of [1e-3, 1e-5]) {
    const plus = structuredClone(base);
    const minus = structuredClone(base);
    parameter.perturb(plus, 1 + epsilon);
    parameter.perturb(minus, 1 - epsilon);
    const upper = solve(`${parameter.name}-plus-${epsilon}`, plus);
    const lower = solve(`${parameter.name}-minus-${epsilon}`, minus);
    const derivatives = {};
    for (const engine of ['arm', 'rust']) {
      // Derivative with respect to a fractional parameter change, not an SI increment.
      const derivative = (upper[engine] - lower[engine]) / (2 * epsilon);
      const tolerance = 2 * epsilon ** 2 * Math.abs(parameter.derivative) + 1e-12;
      near(derivative, parameter.derivative, tolerance, `${parameter.name}/${engine}: sensitivity`);
      derivatives[engine] = derivative;
    }
    if (parameter.conditionInvariant) {
      near(upper.condition, baseline.condition, 1e-8, `${parameter.name}: condition +`);
      near(lower.condition, baseline.condition, 1e-8, `${parameter.name}: condition -`);
    }
    checks.push({ parameter: parameter.name, epsilon,
      expectedDerivativeM: parameter.derivative, ...derivatives,
      conditionMinus: lower.condition, conditionPlus: upper.condition });
  }
}

console.log(JSON.stringify({ sensitivity: checks, totals: { models: solves, parityChecks,
  independentDerivativeChecks: checks.length * 2 },
  scope: 'Linear Timoshenko cantilever, small perturbations; not nonlinear, seismic or general stability qualification.' }, null, 2));
