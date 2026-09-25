import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { initSync, solve_frame2d_v1 } from '../structural_kernel/pkg/structural_kernel.js';
import { benchmarkModel } from '../src/core/analysis/Benchmarks.ts';
import { solveFrame } from '../src/core/analysis/Solver.ts';
import { compareFrame2dResults, toFrame2dKernelInput } from '../src/core/analysis/KernelAdapter.ts';

const factors = { dead: 1, live: 1, nodal: 1 };
const model = benchmarkModel('supported');
const wasm = readFileSync(new URL('../structural_kernel/pkg/structural_kernel_bg.wasm', import.meta.url));
initSync({ module: wasm });
const originalLog = console.log;
let ts;
try {
  console.log = () => {};
  ts = solveFrame(model, factors, 'Viga biapoyada q uniforme');
} finally { console.log = originalLog; }
const input = { ...toFrame2dKernelInput(model, factors),
  requestId: 'basic-beam-review', revision: model.revision };
const rust = JSON.parse(solve_frame2d_v1(JSON.stringify(input)));
const parity = compareFrame2dResults(model, factors, ts, rust);
assert.equal(parity.passed, true, 'TS/Rust parity failed');

const member = model.members[0];
const lengthM = model.nodes[1].x - model.nodes[0].x;
const loadKNPerM = member.dead;
const elasticKNPerM2 = member.elasticModulusMPa * 1000;
const shearKNPerM2 = elasticKNPerM2 / (2 * (1 + member.poisson));
const shearRigidityKN = (5 / 6) * shearKNPerM2 * member.area;
const bendingRigidityKNM2 = elasticKNPerM2 * member.inertia;
const bendingDeflectionM = 5 * loadKNPerM * lengthM ** 4 / (384 * bendingRigidityKNM2);
const shearDeflectionM = loadKNPerM * lengthM ** 2 / (8 * shearRigidityKN);
const expected = {
  totalLoadKN: loadKNPerM * lengthM,
  reactionLeftKN: loadKNPerM * lengthM / 2,
  reactionRightKN: loadKNPerM * lengthM / 2,
  momentMidKNM: loadKNPerM * lengthM ** 2 / 8,
  shearLeftKN: loadKNPerM * lengthM / 2,
  shearMidKN: 0,
  shearRightKN: -loadKNPerM * lengthM / 2,
  bendingDeflectionMidMm: -bendingDeflectionM * 1000,
  shearDeflectionMidMm: -shearDeflectionM * 1000,
  totalDeflectionMidMm: -(bendingDeflectionM + shearDeflectionM) * 1000,
};
const tsBar = ts.members[0];
const rustBar = rust.members[0];
assert.equal(tsBar.stations.length, 21);
assert.equal(rustBar.deformedShape.stationsM.length, 21);
const midpoint = 10;
const actual = {
  ts: {
    reactionLeftKN: ts.nodes[0].ry,
    reactionRightKN: ts.nodes[1].ry,
    momentMidKNM: Math.abs(tsBar.moment[midpoint]),
    deflectionMidMm: tsBar.deflectionY[midpoint] * 1000,
    equilibriumResidual: ts.residual,
  },
  rust: {
    reactionLeftKN: rust.nodes[0].reactionFyN / 1000,
    reactionRightKN: rust.nodes[1].reactionFyN / 1000,
    deflectionMidMm: rustBar.deformedShape.globalDyM[midpoint] * 1000,
    freeDofs: rust.diagnostics.freeDofs,
    maxResidualToleranceRatio: rust.diagnostics.maxResidualToleranceRatio,
  },
};
const near = (value, target, tolerance, label) => assert.ok(
  Number.isFinite(value) && Math.abs(value - target) <= tolerance,
  `${label}: ${value} versus ${target}, tolerance ${tolerance}`,
);
for (const engine of ['ts', 'rust']) {
  near(actual[engine].reactionLeftKN, expected.reactionLeftKN, 1e-7, `${engine} left reaction`);
  near(actual[engine].reactionRightKN, expected.reactionRightKN, 1e-7, `${engine} right reaction`);
  near(actual[engine].deflectionMidMm, expected.totalDeflectionMidMm, 1e-5,
    `${engine} midspan deflection`);
}
near(actual.ts.momentMidKNM, expected.momentMidKNM, 1e-7, 'TS midspan moment');
near(actual.ts.equilibriumResidual, 0, 1e-8, 'TS equilibrium residual');
assert.ok(actual.rust.maxResidualToleranceRatio <= 1);

const sha256 = value => createHash('sha256').update(value).digest('hex');
const report = {
  generatedAt: new Date().toISOString(),
  caseId: 'BAS-01',
  model: { lengthM, widthM: 0.3, heightM: 0.5, areaM2: member.area,
    inertiaM4: member.inertia, elasticModulusMPa: member.elasticModulusMPa,
    poisson: member.poisson, shearCorrection: 5 / 6,
    uniformLoadKNPerM: loadKNPerM, selfWeight: false,
    supports: { left: 'pinned', right: 'vertical roller' } },
  modelSha256: sha256(JSON.stringify({ model, factors })),
  wasmSha256: sha256(wasm),
  expected, actual,
  parity: { passed: parity.passed,
    responseChecks: parity.rows.length + parity.memberRows.length + parity.diagramRows.length,
    deformationChecks: parity.deformationRows.length,
    maximumDeformationErrorM: parity.maximumDeformationErrorM },
  scope: 'Linear elastic, first-order, single Timoshenko 2D member, uniform vertical dead load; no self-weight, seismic analysis, design checks or RNE compliance claim.',
};
mkdirSync(new URL('../test-results/', import.meta.url), { recursive: true });
writeFileSync(new URL('../test-results/basic-beam-review.json', import.meta.url),
  JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
