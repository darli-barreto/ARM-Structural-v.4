import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { initSync, solve_frame2d_v1 } from '../structural_kernel/pkg/structural_kernel.js';
import { benchmarkModel } from '../src/core/analysis/Benchmarks.ts';
import { solveFrame } from '../src/core/analysis/Solver.ts';
import { compareFrame2dResults, toFrame2dKernelInput } from '../src/core/analysis/KernelAdapter.ts';
import { portalForceReference } from './fixtures/portal-force-reference.mjs';

const wasm = readFileSync(new URL('../structural_kernel/pkg/structural_kernel_bg.wasm', import.meta.url));
initSync({ module: wasm });
const factors = { dead: 1, live: 1, nodal: 1 };
const sha256 = value => createHash('sha256').update(value).digest('hex');
const cases = [];

function near(actual, expected, label, absoluteTolerance = 1e-7) {
  assert.ok(Math.abs(actual - expected) <= absoluteTolerance,
    `${label}: expected ${expected}, received ${actual}`);
}

function evaluate(id, model, independent) {
  const originalLog = console.log;
  let ts;
  try {
    console.log = () => {};
    ts = solveFrame(model, factors, id);
  } finally { console.log = originalLog; }
  const rustInput = { ...toFrame2dKernelInput(model, factors), requestId: id,
    revision: model.revision };
  const rust = JSON.parse(solve_frame2d_v1(JSON.stringify(rustInput)));
  const parity = compareFrame2dResults(model, factors, ts, rust);
  assert.equal(parity.passed, true, `${id}: TS/Rust parity failed`);
  const normalizedRust = rust.nodes.map(node => ({ id: node.id, uxMm: node.uxM * 1000,
    uyMm: node.uyM * 1000, rotationMrad: -node.rzRad * 1000,
    rxKN: node.reactionFxN / 1000, ryKN: node.reactionFyN / 1000,
    rmKNM: -node.reactionMzNm / 1000 }));
  const tsNode = nodeId => ts.nodes.find(node => node.id === nodeId);
  if (id === 'EX-01-cantilever') {
    near(tsNode('N1').ry, independent.reactionVerticalKN, `${id} reaction`);
    near(Math.abs(tsNode('N1').rm), independent.fixedMomentMagnitudeKNM, `${id} base moment`);
    near(tsNode('N2').uy * 1000,
      independent.bendingTipDeflectionMm + independent.shearTipDeflectionMm, `${id} tip`);
  } else if (id === 'EX-02-supported-uniform' || id === 'EX-03-fixed-uniform') {
    near(tsNode('N1').ry, independent.reactionEachKN, `${id} left reaction`);
    near(tsNode('N2').ry, independent.reactionEachKN, `${id} right reaction`);
    near(Math.abs(ts.members[0].moment[10]), independent.momentMidKNM, `${id} mid moment`);
    near(ts.members[0].deflectionY[10] * 1000,
      independent.bendingMidDeflectionMm + independent.shearMidDeflectionMm,
      `${id} mid deflection`);
    if (id === 'EX-03-fixed-uniform') {
      near(Math.abs(tsNode('N1').rm), independent.fixedMomentMagnitudeKNM, `${id} left fixed moment`);
      near(Math.abs(tsNode('N2').rm), independent.fixedMomentMagnitudeKNM, `${id} right fixed moment`);
    }
  } else if (id === 'EX-04-inclined-cantilever') {
    near(tsNode('N2').ux * 1000, independent.tipUxMm, `${id} ux`);
    near(tsNode('N2').uy * 1000, independent.tipUyMm, `${id} uy`);
    near(tsNode('N1').rx, independent.baseReactionFxKN, `${id} rx`);
    near(tsNode('N1').ry, independent.baseReactionFyKN, `${id} ry`);
    near(Math.abs(tsNode('N1').rm), independent.baseMomentMagnitudeKNM, `${id} moment`);
  } else if (id === 'EX-05-lateral-portal') {
    for (const [index, nodeId] of ['P1', 'P2'].entries()) {
      near(tsNode(nodeId).ux * 1000, independent.topNodeDisplacementsMm[index].ux,
        `${id} ${nodeId} ux`);
      near(tsNode(nodeId).uy * 1000, independent.topNodeDisplacementsMm[index].uy,
        `${id} ${nodeId} uy`);
    }
    for (const [nodeId, reaction] of [['P0', independent.baseReactions.left],
      ['P3', independent.baseReactions.right]]) {
      near(tsNode(nodeId).rx, reaction[0], `${id} ${nodeId} rx`);
      near(tsNode(nodeId).ry, reaction[1], `${id} ${nodeId} ry`);
      near(Math.abs(tsNode(nodeId).rm), reaction[2], `${id} ${nodeId} moment magnitude`);
    }
  }
  cases.push({ id, inputSha256: sha256(JSON.stringify({ model, factors })),
    nodes: model.nodes.length, members: model.members.length, independent,
    ts: { nodes: ts.nodes.map(node => ({ id: node.id, uxMm: node.ux * 1000,
      uyMm: node.uy * 1000, rotationMrad: node.rotation * 1000,
      rxKN: node.rx, ryKN: node.ry, rmKNM: node.rm })),
    members: ts.members.map(member => ({ id: member.id,
      endForces: member.endForces, midMomentKNM: member.moment[10],
      midDeflectionMm: member.deflectionY[10] * 1000 })) },
    rust: { nodes: normalizedRust, members: rust.members.map(member => ({ id: member.id,
      endForcesN: member.localEndForces,
      midDeflectionMm: member.deformedShape.globalDyM[10] * 1000 })),
      diagnostics: rust.diagnostics },
    parity: { responseChecks: parity.rows.length + parity.memberRows.length + parity.diagramRows.length,
      deformationChecks: parity.deformationRows.length,
      maxResponseError: parity.maximumAbsoluteError,
      maxDeformationErrorM: parity.maximumDeformationErrorM } });
}

{
  const model = benchmarkModel('cantilever');
  const bar = model.members[0];
  const elastic = bar.elasticModulusMPa * 1000;
  const shear = elastic / (2 * (1 + bar.poisson));
  const length = 3, pointLoad = 10, bendingRigidity = elastic * bar.inertia;
  const shearRigidity = (5 / 6) * shear * bar.area;
  evaluate('EX-01-cantilever', model, {
    reactionVerticalKN: pointLoad, fixedMomentMagnitudeKNM: pointLoad * length,
    bendingTipDeflectionMm: -pointLoad * length ** 3 / (3 * bendingRigidity) * 1000,
    shearTipDeflectionMm: -pointLoad * length / shearRigidity * 1000,
  });
}
{
  const model = benchmarkModel('supported');
  const bar = model.members[0];
  const elastic = bar.elasticModulusMPa * 1000;
  const shear = elastic / (2 * (1 + bar.poisson));
  const length = 6, load = 10, bendingRigidity = elastic * bar.inertia;
  const shearRigidity = (5 / 6) * shear * bar.area;
  evaluate('EX-02-supported-uniform', model, {
    reactionEachKN: load * length / 2, momentMidKNM: load * length ** 2 / 8,
    bendingMidDeflectionMm: -5 * load * length ** 4 / (384 * bendingRigidity) * 1000,
    shearMidDeflectionMm: -load * length ** 2 / (8 * shearRigidity) * 1000,
  });
}
{
  const model = benchmarkModel('supported');
  model.nodes[0].support = 'fixed';
  model.nodes[1].support = 'fixed';
  const bar = model.members[0];
  const elastic = bar.elasticModulusMPa * 1000;
  const shear = elastic / (2 * (1 + bar.poisson));
  const length = 6, load = 10, bendingRigidity = elastic * bar.inertia;
  const shearRigidity = (5 / 6) * shear * bar.area;
  evaluate('EX-03-fixed-uniform', model, {
    reactionEachKN: load * length / 2, fixedMomentMagnitudeKNM: load * length ** 2 / 12,
    momentMidKNM: load * length ** 2 / 24,
    bendingMidDeflectionMm: -load * length ** 4 / (384 * bendingRigidity) * 1000,
    shearMidDeflectionMm: -load * length ** 2 / (8 * shearRigidity) * 1000,
  });
}
{
  const model = benchmarkModel('cantilever');
  model.nodes[1].x = 3;
  model.nodes[1].y = 4;
  model.nodes[1].fx = 4;
  model.nodes[1].fy = -5;
  const bar = model.members[0];
  const elastic = bar.elasticModulusMPa * 1000;
  const shear = elastic / (2 * (1 + bar.poisson));
  const length = 5, axial = 0.6 * 4 + 0.8 * -5;
  const transverse = -0.8 * 4 + 0.6 * -5;
  const localU = axial * length / (elastic * bar.area);
  const localV = transverse * (length ** 3 / (3 * elastic * bar.inertia)
    + length / ((5 / 6) * shear * bar.area));
  evaluate('EX-04-inclined-cantilever', model, {
    localAxialForceKN: axial, localTransverseForceKN: transverse,
    tipUxMm: (0.6 * localU - 0.8 * localV) * 1000,
    tipUyMm: (0.8 * localU + 0.6 * localV) * 1000,
    baseReactionFxKN: -4, baseReactionFyKN: 5,
    baseMomentMagnitudeKNM: 31,
  });
}
{
  const model = benchmarkModel('cantilever');
  const bar = model.members[0];
  const points = [[0, 0], [0, 3], [5, 3], [5, 0]];
  const loads = [[0, 0, 0], [5, 0, 0], [7, 0, 0], [0, 0, 0]];
  const elastic = bar.elasticModulusMPa * 1000;
  const shear = elastic / (2 * (1 + bar.poisson));
  const reference = portalForceReference(points, loads, {
    EA: elastic * bar.area, EI: elastic * bar.inertia,
    shear: (5 / 6) * shear * bar.area,
  });
  model.nodes = points.map(([x, y], index) => ({ id: `P${index}`, x, y,
    support: index === 0 || index === 3 ? 'fixed' : 'free',
    fx: loads[index][0], fy: 0, moment: 0 }));
  model.members = [0, 1, 2].map(index => ({ ...bar, id: `M${index}`,
    start: `P${index}`, end: `P${index + 1}` }));
  evaluate('EX-05-lateral-portal', model, {
    method: 'force-method compatibility reference',
    topNodeDisplacementsMm: reference.displacements.slice(1, 3).map(([ux, uy, rz]) =>
      ({ ux: ux * 1000, uy: uy * 1000, rzMradClockwise: -rz * 1000 })),
    baseReactions: { left: reference.left, right: reference.right },
    memberEndForces: reference.memberForces,
  });
}

const report = { generatedAt: new Date().toISOString(), wasmSha256: sha256(wasm),
  factors, cases, scope: 'Five idealized linear elastic Timoshenko 2D cases. Independent closed-form references for EX-01 through EX-04 and force-method compatibility reference for EX-05. No seismic, strength-design or RNE compliance claim.' };
mkdirSync(new URL('../test-results/', import.meta.url), { recursive: true });
writeFileSync(new URL('../test-results/engineering-review-examples.json', import.meta.url),
  JSON.stringify(report, null, 2) + '\n');
console.log(`Verified ${cases.length} independent 2D examples; results: test-results/engineering-review-examples.json`);
