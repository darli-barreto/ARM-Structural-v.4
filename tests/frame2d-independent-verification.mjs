import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initSync, solve_frame2d_v1 } from '../structural_kernel/pkg/structural_kernel.js';
import { benchmarkModel } from '../src/core/analysis/Benchmarks.ts';
import { solveFrame } from '../src/core/analysis/Solver.ts';
import { compareFrame2dResults, toFrame2dKernelInput } from '../src/core/analysis/KernelAdapter.ts';
import { portalForceReference, treeForceReference } from './fixtures/portal-force-reference.mjs';

initSync({ module: readFileSync(new URL('../structural_kernel/pkg/structural_kernel_bg.wasm', import.meta.url)) });

const factors = { dead: 1, live: 1, nodal: 1 };
const E = 30e6; // kN/m2
const A = 0.06; // m2
const I = 0.00045; // m4
const GA = (5 / 6) * E * A / (2 * 1.2); // kN
const EI = E * I; // kN m2
const cases = [];

function near(actual, expected, tolerance, label) {
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
    `${label}: ${actual} versus ${expected} (tolerance ${tolerance})`);
}

function verify(name, model, check) {
  const arm = solveFrame(model, factors, name);
  const input = { ...toFrame2dKernelInput(model, factors), requestId: name, revision: model.revision };
  const rust = JSON.parse(solve_frame2d_v1(JSON.stringify(input)));
  assert.ok(rust.diagnostics, `${name}: WASM must include numerical diagnostics`);
  if (rust.diagnostics.freeDofs === 0) assert.equal(rust.diagnostics.scaledConditionEstimate, null);
  else assert.ok(Number.isFinite(rust.diagnostics.scaledConditionEstimate)
    && rust.diagnostics.scaledConditionEstimate >= 1, `${name}: scaled condition estimate`);
  assert.ok(Number.isFinite(rust.diagnostics.maxComponentwiseBackwardError)
    && rust.diagnostics.maxComponentwiseBackwardError >= 0,
    `${name}: invalid backward error ${rust.diagnostics.maxComponentwiseBackwardError}`);
  // Symmetric axial cases have theoretically zero lateral equations: roundoff/roundoff
  // is not a useful accuracy gate there. Keep the raw value and the absolute residual gate.
  const backwardLimit = name.endsWith('-symmetric-axial') ? 0.01 : 1e-10;
  assert.ok(rust.diagnostics.maxComponentwiseBackwardError <= backwardLimit,
    `${name}: backward error regression ${rust.diagnostics.maxComponentwiseBackwardError}`);
  assert.ok(Number.isFinite(rust.diagnostics.maxResidualToleranceRatio)
    && rust.diagnostics.maxResidualToleranceRatio <= 1, `${name}: residual acceptance`);
  const parity = compareFrame2dResults(model, factors, arm, rust);
  const failures = [...parity.rows, ...parity.memberRows, ...parity.diagramRows, ...parity.deformationRows]
    .filter(row => !row.passed);
  assert.equal(parity.passed, true, `${name}: ${JSON.stringify(failures.slice(0, 8), null, 2)}`);
  check({
    arm: {
      nodes: Object.fromEntries(arm.nodes.map(node => [node.id, node])),
      members: Object.fromEntries(arm.members.map(member => [member.id, member])),
    },
    rust: {
      nodes: Object.fromEntries(rust.nodes.map(node => [node.id, {
        ux: node.uxM, uy: node.uyM, rotation: -node.rzRad,
        rx: node.reactionFxN / 1000, ry: node.reactionFyN / 1000,
        rm: -node.reactionMzNm / 1000,
      }])),
      members: Object.fromEntries(rust.members.map(member => [member.id, member])),
    },
  });
  cases.push({ name, diagnostics: rust.diagnostics,
    responseChecks: parity.rows.length + parity.memberRows.length + parity.diagramRows.length,
    deformationChecks: parity.deformationRows.length });
}

{
  const model = benchmarkModel('cantilever');
  model.nodes[1].fy = 0;
  model.nodes[1].fx = 12;
  verify('axial-cantilever', model, ({ arm, rust }) => {
    const expected = 12 * 3 / (E * A);
    for (const engine of [arm, rust]) {
      near(engine.nodes.N2.ux, expected, 1e-12, 'axial tip ux');
      near(engine.nodes.N1.rx, -12, 1e-8, 'axial base reaction');
      near(engine.nodes.N2.uy, 0, 1e-12, 'axial tip uy');
    }
  });
}

{
  const model = benchmarkModel('cantilever');
  model.nodes[1].fy = 0;
  model.nodes[1].moment = 8; // clockwise in the application plane
  verify('end-couple-cantilever', model, ({ arm, rust }) => {
    for (const engine of [arm, rust]) {
      near(engine.nodes.N2.rotation, 8 * 3 / EI, 1e-11, 'tip rotation');
      near(engine.nodes.N2.uy, -8 * 3 ** 2 / (2 * EI), 1e-11, 'tip deflection');
      near(engine.nodes.N1.rm, -8, 1e-8, 'base moment reaction');
      near(engine.nodes.N1.ry, 0, 1e-8, 'base shear reaction');
    }
  });
}

{
  const model = benchmarkModel('supported');
  model.members[0].dead = 0;
  model.nodes.push({ id: 'N3', x: 3, y: 0, support: 'free', fx: 0, fy: -10, moment: 0 });
  const member = model.members[0];
  model.members = [{ ...member, id: 'B1-L', end: 'N3' }, { ...member, id: 'B1-R', start: 'N3' }];
  const bending = member.elasticModulusMPa * 1000 * member.inertia;
  const shear = (5 / 6) * member.elasticModulusMPa * 1000 * member.area / (2 * (1 + member.poisson));
  verify('simply-supported-midpoint-force', model, ({ arm, rust }) => {
    const expected = -10 * 6 ** 3 / (48 * bending) - 10 * 6 / (4 * shear);
    for (const engine of [arm, rust]) {
      near(engine.nodes.N3.uy, expected, 1e-11, 'midspan Timoshenko deflection');
      near(engine.nodes.N1.ry, 5, 1e-8, 'left reaction');
      near(engine.nodes.N2.ry, 5, 1e-8, 'right reaction');
    }
    near(Math.max(...arm.members['B1-L'].moment.map(Math.abs)), 15, 1e-8, 'midspan moment');
  });
}

{
  const model = benchmarkModel('supported');
  model.nodes[0].support = 'fixed';
  model.nodes[1].support = 'fixed';
  const member = model.members[0];
  const bending = member.elasticModulusMPa * 1000 * member.inertia;
  const shear = (5 / 6) * member.elasticModulusMPa * 1000 * member.area / (2 * (1 + member.poisson));
  verify('fixed-fixed-uniform', model, ({ arm, rust }) => {
    const expectedMid = -10 * 6 ** 4 / (384 * bending) - 10 * 6 ** 2 / (8 * shear);
    for (const engine of [arm, rust]) {
      near(engine.nodes.N1.ry, 30, 1e-8, 'left reaction');
      near(engine.nodes.N2.ry, 30, 1e-8, 'right reaction');
      near(Math.abs(engine.nodes.N1.rm), 30, 1e-8, 'left fixed-end moment');
      near(Math.abs(engine.nodes.N2.rm), 30, 1e-8, 'right fixed-end moment');
    }
    near(arm.members.B1.deflectionY[10], expectedMid, 1e-11, 'midspan Timoshenko deflection');
    near(rust.members.B1.deformedShape.globalDyM[10], expectedMid, 1e-11, 'Rust midspan Timoshenko deflection');
  });
}

{
  const model = benchmarkModel('cantilever');
  model.nodes[1].x = 3;
  model.nodes[1].y = 4;
  model.nodes[1].fx = 4;
  model.nodes[1].fy = -5;
  verify('inclined-cantilever-global-force', model, ({ arm, rust }) => {
    const localAxial = 0.6 * 4 + 0.8 * -5;
    const localShear = -0.8 * 4 + 0.6 * -5;
    const localU = localAxial * 5 / (E * A);
    const localV = localShear * (5 ** 3 / (3 * EI) + 5 / GA);
    for (const engine of [arm, rust]) {
      near(engine.nodes.N2.ux, 0.6 * localU - 0.8 * localV, 1e-11, 'inclined tip ux');
      near(engine.nodes.N2.uy, 0.8 * localU + 0.6 * localV, 1e-11, 'inclined tip uy');
      near(engine.nodes.N1.rx, -4, 1e-8, 'inclined base rx');
      near(engine.nodes.N1.ry, 5, 1e-8, 'inclined base ry');
      near(engine.nodes.N1.rm, -31, 1e-8, 'inclined base moment');
    }
  });
}

// Flexibility method: remove the redundant support, then impose zero displacement.
{
  const model = benchmarkModel('supported');
  const member = model.members[0];
  const bending = member.elasticModulusMPa * 1000 * member.inertia;
  const shear = (5 / 6) * member.elasticModulusMPa * 1000 * member.area / (2 * (1 + member.poisson));
  model.nodes.push({ id: 'N3', x: 3, y: 0, support: 'roller', fx: 0, fy: 0, moment: 0 });
  model.members = [{ ...member, id: 'left', end: 'N3' }, { ...member, id: 'right', start: 'N3' }];
  const middleReaction = (5 * 10 * 6 ** 4 / (384 * bending) + 10 * 6 ** 2 / (8 * shear))
    / (6 ** 3 / (48 * bending) + 6 / (4 * shear));
  verify('continuous-two-span-uniform', model, ({ arm, rust }) => {
    for (const engine of [arm, rust]) {
      near(engine.nodes.N3.ry, middleReaction, 1e-8, 'redundant middle reaction');
      near(engine.nodes.N1.ry, (60 - middleReaction) / 2, 1e-8, 'continuous left reaction');
      near(engine.nodes.N2.ry, (60 - middleReaction) / 2, 1e-8, 'continuous right reaction');
      near(engine.nodes.N3.rotation, 0, 1e-11, 'symmetric middle rotation');
    }
  });
}

{
  const model = benchmarkModel('supported');
  model.nodes.forEach(node => { node.support = 'fixed'; });
  model.members[0].releaseEnd = true;
  const member = model.members[0];
  const bending = member.elasticModulusMPa * 1000 * member.inertia;
  const shear = (5 / 6) * member.elasticModulusMPa * 1000 * member.area / (2 * (1 + member.poisson));
  const rightReaction = (10 * 6 ** 4 / (8 * bending) + 10 * 6 ** 2 / (2 * shear))
    / (6 ** 3 / (3 * bending) + 6 / shear);
  verify('propped-cantilever-end-release', model, ({ arm, rust }) => {
    for (const engine of [arm, rust]) {
      near(engine.nodes.N2.ry, rightReaction, 1e-8, 'prop reaction');
      near(engine.nodes.N1.ry, 60 - rightReaction, 1e-8, 'fixed reaction');
      near(engine.nodes.N1.rm, -180 + rightReaction * 6, 1e-8, 'fixed moment');
      near(engine.nodes.N2.rm, 0, 1e-8, 'released moment reaction');
    }
    near(arm.members.B1.endForces[5], 0, 1e-8, 'ARM released member moment');
    near(rust.members.B1.localEndForces[5] / 1000, 0, 1e-8, 'Rust released member moment');
  });
}

{
  const model = benchmarkModel('cantilever');
  model.nodes[1].x = 0;
  model.nodes[1].y = 4;
  model.nodes[1].fy = 0;
  model.nodes.push({ id: 'N3', x: 3, y: 4, support: 'free', fx: 0, fy: -10, moment: 0 });
  model.members.push({ ...model.members[0], id: 'beam', start: 'N2', end: 'N3' });
  verify('rigid-jointed-L-frame', model, ({ arm, rust }) => {
    const ux = 10 * 3 * 4 ** 2 / (2 * EI);
    const uy = -10 * 4 / (E * A) - 10 * 3 ** 2 * 4 / EI - 10 * 3 ** 3 / (3 * EI) - 10 * 3 / GA;
    for (const engine of [arm, rust]) {
      near(engine.nodes.N3.ux, ux, 1e-10, 'frame tip ux');
      near(engine.nodes.N3.uy, uy, 1e-10, 'frame tip uy');
      near(engine.nodes.N3.rotation, 10 * 3 * 4 / EI + 10 * 3 ** 2 / (2 * EI), 1e-10, 'frame tip rotation');
      near(engine.nodes.N1.ry, 10, 1e-8, 'frame base reaction');
      near(engine.nodes.N1.rm, -30, 1e-8, 'frame base moment');
    }
  });
}

for (const length of [0.5, 3, 30]) {
  for (const segments of [1, 4, 12]) {
    const model = benchmarkModel('cantilever');
    const member = model.members[0];
    model.nodes = Array.from({ length: segments + 1 }, (_, index) => ({
      id: `N${index}`, x: length * index / segments, y: 0,
      support: index === 0 ? 'fixed' : 'free', fx: 0,
      fy: index === segments ? -0.01 : 0, moment: 0,
    }));
    model.members = Array.from({ length: segments }, (_, index) => ({
      ...member, id: `B${index}`, start: `N${index}`, end: `N${index + 1}`,
    }));
    verify(`cantilever-L${length}-mesh${segments}`, model, ({ arm, rust }) => {
      for (const engine of [arm, rust]) {
        near(engine.nodes[`N${segments}`].uy, -0.01 * (length ** 3 / (3 * EI) + length / GA), 1e-10, 'mesh tip displacement');
        near(engine.nodes.N0.ry, 0.01, 1e-8, 'mesh reaction');
        near(engine.nodes.N0.rm, -0.01 * length, 1e-8, 'mesh base moment');
      }
    });
  }
}

// Equal settlements at each floor leave the horizontal members undeformed.
for (const floors of [2, 8]) {
  const model = benchmarkModel('cantilever');
  const member = model.members[0];
  const height = 3;
  const load = 10;
  model.nodes = [];
  model.members = [];
  for (let floor = 0; floor <= floors; floor++) {
    for (let column = 0; column < 3; column++) {
      const id = `N${floor}-${column}`;
      model.nodes.push({ id, x: column * 5, y: floor * height,
        support: floor === 0 ? 'fixed' : 'free', fx: 0,
        fy: floor === 0 ? 0 : -load, moment: 0 });
      if (floor > 0) {
        model.members.push({ ...member, id: `C${floor}-${column}`,
          start: `N${floor - 1}-${column}`, end: id });
        if (column > 0) model.members.push({ ...member, id: `B${floor}-${column}`,
          start: `N${floor}-${column - 1}`, end: id });
      }
    }
  }
  verify(`multilevel-${floors}-symmetric-axial`, model, ({ arm, rust }) => {
    for (const engine of [arm, rust]) {
      for (let floor = 0; floor <= floors; floor++) {
        const shortening = -load * height / (E * A)
          * (floor * (floors + 1) - floor * (floor + 1) / 2);
        for (let column = 0; column < 3; column++) {
          const node = engine.nodes[`N${floor}-${column}`];
          near(node.uy, shortening, 1e-10, 'floor axial shortening');
          near(node.ux, 0, 1e-10, 'no lateral drift');
          near(node.rotation, 0, 1e-10, 'no floor rotation');
          if (floor === 0) near(node.ry, floors * load, 1e-7, 'column base reaction');
        }
      }
    }
  });
}

// Reduce the load with EI to keep displacements small while increasing stiffness contrast.
for (const ratio of [1e-2, 1e-4, 1e-6]) {
  const model = benchmarkModel('cantilever');
  model.members[0].inertia *= ratio;
  const force = 0.01 * ratio;
  model.nodes[1].fy = -force;
  verify(`low-bending-stiffness-${ratio}`, model, ({ arm, rust }) => {
    for (const engine of [arm, rust]) {
      near(engine.nodes.N2.uy, -force * (3 ** 3 / (3 * EI * ratio) + 3 / GA),
        1e-10, 'low stiffness tip displacement');
      near(engine.nodes.N1.ry, force, 1e-12, 'low stiffness reaction');
    }
  });
}

for (const [width, leftHeight, rightHeight] of [[5, 3, 3], [8, 4, 3], [3, 6, 6]]) {
  const model = benchmarkModel('cantilever');
  const member = model.members[0];
  const points = [[0, 0], [0, leftHeight], [width, rightHeight], [width, 0]];
  const loads = [[0, 0, 0], [5, 0, 0], [7, 0, 0], [0, 0, 0]];
  const reference = portalForceReference(points, loads, { EA: E * A, EI, shear: GA });
  model.nodes = points.map(([x, y], index) => ({ id: `P${index}`, x, y,
    support: index === 0 || index === 3 ? 'fixed' : 'free',
    fx: loads[index][0], fy: loads[index][1], moment: -loads[index][2] }));
  model.members = [0, 1, 2].map(index => ({ ...member, id: `M${index}`,
    start: `P${index}`, end: `P${index + 1}` }));
  verify(`lateral-portal-${width}-${leftHeight}-${rightHeight}`, model, ({ arm, rust }) => {
    for (const engine of [arm, rust]) {
      reference.displacements.forEach(([ux, uy, rz], index) => {
        const node = engine.nodes[`P${index}`];
        near(node.ux, ux, 1e-10, 'force-method ux');
        near(node.uy, uy, 1e-10, 'force-method uy');
        near(node.rotation, -rz, 1e-10, 'force-method rotation');
      });
      for (const [id, expected] of [['P0', reference.left], ['P3', reference.right]]) {
        near(engine.nodes[id].rx, expected[0], 1e-7, 'force-method rx');
        near(engine.nodes[id].ry, expected[1], 1e-7, 'force-method ry');
        near(engine.nodes[id].rm, -expected[2], 1e-7, 'force-method moment');
      }
    }
  });
}

for (const floors of [2, 4, 8]) {
  const model = benchmarkModel('cantilever');
  const member = model.members[0];
  const points = [];
  for (let floor = 0; floor <= floors; floor++) points.push([0, 3 * floor]);
  for (let floor = floors; floor >= 0; floor--) points.push([5, 3 * floor]);
  const physicalCount = points.length;
  const rightBase = physicalCount - 1;
  const edges = Array.from({ length: rightBase }, (_, index) => [index, index + 1]);
  const splits = [];
  for (let floor = 1; floor < floors; floor++) {
    const column = rightBase - floor;
    const tip = points.length;
    points.push([...points[column]]);
    edges.push([floor, tip]);
    splits.push([tip, column]);
  }
  const loads = points.map(([x, y], index) => [
    index < physicalCount ? (x === 0 ? 0.02 : 0.03) * y / 3 : 0, 0, 0,
  ]);
  const reference = treeForceReference(points, loads, edges, rightBase, splits,
    { EA: E * A, EI, shear: GA });
  const joined = new Map(splits);
  model.nodes = points.slice(0, physicalCount).map(([x, y], index) => ({
    id: `P${index}`, x, y, support: index === 0 || index === rightBase ? 'fixed' : 'free',
    fx: loads[index][0], fy: 0, moment: 0,
  }));
  model.members = edges.map(([start, end], index) => ({ ...member, id: `M${index}`,
    start: `P${start}`, end: `P${joined.get(end) ?? end}` }));
  verify(`lateral-multilevel-${floors}`, model, ({ arm, rust }) => {
    for (const engine of [arm, rust]) {
      reference.displacements.slice(0, physicalCount).forEach(([ux, uy, rz], index) => {
        near(engine.nodes[`P${index}`].ux, ux, 1e-9, 'multilevel ux');
        near(engine.nodes[`P${index}`].uy, uy, 1e-9, 'multilevel uy');
        near(engine.nodes[`P${index}`].rotation, -rz, 1e-9, 'multilevel rotation');
      });
      for (const [id, expected] of [['P0', reference.left], [`P${rightBase}`, reference.right]]) {
        near(engine.nodes[id].rx, expected[0], 1e-7, 'multilevel base rx');
        near(engine.nodes[id].ry, expected[1], 1e-7, 'multilevel base ry');
        near(engine.nodes[id].rm, -expected[2], 1e-7, 'multilevel base moment');
      }
    }
    reference.memberForces.forEach((forces, memberIndex) => forces.forEach((value, dof) => {
      near(rust.members[`M${memberIndex}`].localEndForces[dof] / 1000, value, 1e-7,
        'Rust multilevel member force');
      near(arm.members[`M${memberIndex}`].endForces[dof], dof % 3 === 2 ? -value : value,
        1e-7, 'ARM multilevel member force');
    }));
  });
}

const unsupported = toFrame2dKernelInput(benchmarkModel('cantilever'), factors);
unsupported.nodes.forEach(node => { node.restraint = { ux: false, uy: false, rz: false }; });
assert.throws(() => solve_frame2d_v1(JSON.stringify({ ...unsupported,
  requestId: 'unsupported', revision: 1 })),
  error => String(error).includes('KERNEL_SINGULAR_SYSTEM'),
  'An unsupported model must fail with the singular-system diagnostic');

console.log(JSON.stringify({ independentFrame2dVerification: cases,
  rejectionChecks: ['unsupported: KERNEL_SINGULAR_SYSTEM'],
  totals: { cases: cases.length,
    responseChecks: cases.reduce((sum, entry) => sum + entry.responseChecks, 0),
    deformationChecks: cases.reduce((sum, entry) => sum + entry.deformationChecks, 0) },
}, null, 2));
