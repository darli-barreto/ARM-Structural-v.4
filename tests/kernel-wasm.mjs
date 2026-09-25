import '../structural_kernel/tests/wasm.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initSync, solve_frame2d_v1 } from '../structural_kernel/pkg/structural_kernel.js';
import { benchmarkModel } from '../src/core/analysis/Benchmarks.ts';
import { solveFrame } from '../src/core/analysis/Solver.ts';
import { compareFrame2dResults, toFrame2dKernelInput } from '../src/core/analysis/KernelAdapter.ts';

initSync({ module: readFileSync(new URL('../structural_kernel/pkg/structural_kernel_bg.wasm', import.meta.url)) });
const parityModels = [
  ['cantilever', benchmarkModel('cantilever')],
  ['supported', benchmarkModel('supported')],
  ['inclined-cantilever', (() => {
    const model = benchmarkModel('cantilever');
    model.nodes[1].x = 2;
    model.nodes[1].y = 3;
    model.nodes[1].fx = 4;
    model.nodes[1].fy = -5;
    model.nodes[1].moment = -2;
    model.members[0].weight = 4;
    return model;
  })()],
  ['two-element-beam', (() => {
    const model = benchmarkModel('supported');
    model.nodes.push({ id: 'N3', x: 3, y: 0, support: 'free', fx: 0, fy: 0, moment: 0 });
    const member = model.members[0];
    model.members = [
      { ...member, id: 'B1-L', end: 'N3' },
      { ...member, id: 'B1-R', start: 'N3' },
    ];
    return model;
  })()],
];

for (const [caseName, model] of parityModels) {
  const factors = { dead: 1, live: 1, nodal: 1 };
  const input = {
    ...toFrame2dKernelInput(model, factors),
    requestId: `parity-${caseName}`,
    revision: model.revision,
  };
  const reference = solveFrame(model, factors, `Parity ${caseName}`);
  const kernel = JSON.parse(solve_frame2d_v1(JSON.stringify(input)));
  const report = compareFrame2dResults(model, factors, reference, kernel);
  const failures = [...report.rows, ...report.memberRows, ...report.diagramRows, ...report.deformationRows]
    .filter(row => !row.passed);
  assert.equal(report.passed, true, `${caseName}: ${JSON.stringify(failures, null, 2)}`);
  assert.equal(report.diagramRows.length, reference.members.length * 21 * 3);
  assert.equal(report.deformationAvailable, true);
  assert.equal(report.deformationRows.length, reference.members.length * 21 * 2);
  assert.equal(report.deformationPassed, true);
  for (const member of kernel.members) {
    assert.equal(member.deformedShape.stationsM.length, 21);
    assert.equal(member.deformedShape.globalDxM.length, 21);
    assert.equal(member.deformedShape.globalDyM.length, 21);
    assert.ok([...member.deformedShape.stationsM, ...member.deformedShape.globalDxM,
      ...member.deformedShape.globalDyM].every(Number.isFinite));
    const sourceMember = model.members.find(item => item.id === member.id);
    const start = kernel.nodes.find(node => node.id === sourceMember.start);
    const end = kernel.nodes.find(node => node.id === sourceMember.end);
    assert.ok(Math.abs(member.deformedShape.globalDxM[0] - start.uxM) < 1e-10);
    assert.ok(Math.abs(member.deformedShape.globalDyM[0] - start.uyM) < 1e-10);
    assert.ok(Math.abs(member.deformedShape.globalDxM.at(-1) - end.uxM) < 1e-10);
    assert.ok(Math.abs(member.deformedShape.globalDyM.at(-1) - end.uyM) < 1e-10);
  }
}

console.log('Application integration: TS/Rust nodal, force, diagram and Timoshenko curve parity passed.');
