import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { Beam2D, DofID, LinearStaticSolver } from 'ts-fem';
import { initSync, solve_frame2d_v1 } from '../structural_kernel/pkg/structural_kernel.js';
import { benchmarkModel } from '../src/core/analysis/Benchmarks.ts';
import { createExampleProject } from '../src/core/model/ExampleProjects.ts';
import { assembleFrameLoads } from '../src/core/analysis/Loads.ts';
import { compareFrame2dResults, toFrame2dKernelInput } from '../src/core/analysis/KernelAdapter.ts';
import { solveFrame } from '../src/core/analysis/Solver.ts';

const wasm = readFileSync(new URL('../structural_kernel/pkg/structural_kernel_bg.wasm', import.meta.url));
initSync({ module: wasm });
const factors = { dead: 1, live: 1, nodal: 1 };

function assembleTsSystem(model) {
  const loads = assembleFrameLoads(model, factors);
  const solver = new LinearStaticSolver();
  const domain = solver.domain;
  const dofs = [DofID.Dx, DofID.Dz, DofID.Ry];
  for (const node of model.nodes) {
    const restrained = node.support === 'fixed' ? dofs
      : node.support === 'pinned' ? [DofID.Dx, DofID.Dz]
      : node.support === 'roller' ? [DofID.Dz] : [];
    domain.createNode(node.id, [node.x, 0, node.y], restrained);
  }
  for (const member of model.members) {
    const elastic = member.elasticModulusMPa * 1000;
    domain.createMaterial(member.id, { e: elastic,
      g: elastic / (2 * (1 + member.poisson)), alpha: 0, d: 0 });
    domain.createCrossSection(member.id, { a: member.area, iy: member.inertia,
      iz: member.inertia, dyz: 0, h: member.height, k: 5 / 6, j: 1 });
    domain.createBeam2D(member.id, [member.start, member.end], member.id, member.id,
      [member.releaseStart, member.releaseEnd]);
  }
  const loadCase = solver.loadCases[0];
  for (const node of loads.nodes) {
    loadCase.createNodalLoad(node.id, { [DofID.Dx]: node.fx,
      [DofID.Dz]: node.fy, [DofID.Ry]: node.moment });
  }
  for (const member of loads.members) {
    loadCase.createBeamElementUniformEdgeLoad(member.id, [0, -member.lineLoad], false);
  }
  solver.generateCodeNumbers();
  solver.assemble();
  return solver;
}

function check(name, model) {
  const reference = solveFrame(model, factors, name);
  const input = { ...toFrame2dKernelInput(model, factors), requestId: name,
    revision: model.revision };
  const rust = JSON.parse(solve_frame2d_v1(JSON.stringify(input)));
  const parity = compareFrame2dResults(model, factors, reference, rust);
  assert.equal(parity.passed, true, `${name}: solver response parity failed`);
  const solver = assembleTsSystem(model);
  assert.equal(solver.neq, rust.diagnostics.freeDofs,
    `${name}: free-degree count differs`);
  const nodeResult = new Map(rust.nodes.map(node => [node.id, node]));
  const order = [DofID.Dx, DofID.Dz, DofID.Ry];
  const displacement = Array(solver.neq + solver.pneq).fill(0);
  const reactions = Array(solver.neq + solver.pneq).fill(0);
  for (const node of model.nodes) {
    const result = nodeResult.get(node.id);
    assert.ok(result, `${name}: missing node ${node.id}`);
    const codes = solver.nodeCodeNumbers.get(node.id);
    const values = [result.uxM, result.uyM, -result.rzRad];
    const forces = [result.reactionFxN / 1000,
      result.reactionFyN / 1000, -result.reactionMzNm / 1000];
    order.forEach((dof, index) => {
      displacement[codes[dof]] = values[index];
      reactions[codes[dof]] = forces[index];
    });
  }

  const count = displacement.length;
  let nonzeros = 0, maxSkew = 0, maxFreeResidualRatio = 0, maxReactionError = 0;
  for (let row = 0; row < count; row++) {
    let internal = 0, scale = 0;
    for (let col = 0; col < count; col++) {
      const stiffness = Number(solver.k.get([row, col]));
      assert.ok(Number.isFinite(stiffness), `${name}: non-finite stiffness`);
      if (stiffness !== 0) nonzeros++;
      const skew = Math.abs(stiffness - Number(solver.k.get([col, row])));
      maxSkew = Math.max(maxSkew, skew);
      const term = stiffness * displacement[col];
      internal += term;
      scale += Math.abs(term);
    }
    const applied = Number(solver.f.get([row, 0]));
    const residual = internal - applied;
    const tolerance = 1e-7 + 1e-9 * (scale + Math.abs(applied));
    if (row < solver.neq) {
      maxFreeResidualRatio = Math.max(maxFreeResidualRatio, Math.abs(residual) / tolerance);
      assert.ok(Math.abs(residual) <= tolerance,
        `${name}: free equation ${row} residual ${residual} exceeds ${tolerance}`);
    } else {
      const error = Math.abs(residual - reactions[row]);
      maxReactionError = Math.max(maxReactionError, error);
      assert.ok(error <= tolerance,
        `${name}: reaction equation ${row} error ${error} exceeds ${tolerance}`);
    }
  }
  assert.ok(maxSkew <= 1e-6, `${name}: assembled matrix is not symmetric`);
  return { name, nodes: model.nodes.length, members: model.members.length,
    freeDofs: solver.neq, restrainedDofs: solver.pneq, matrixNonzeros: nonzeros,
    maxSkew, maxFreeResidualRatio, maxReactionError,
    responseChecks: parity.rows.length + parity.memberRows.length + parity.diagramRows.length,
    deformationChecks: parity.deformationRows.length };
}

const portal = benchmarkModel('cantilever');
const member = portal.members[0];
portal.nodes = [[0, 0], [0, 3], [5, 3], [5, 0]].map(([x, y], index) => ({
  id: `P${index}`, x, y, support: index === 0 || index === 3 ? 'fixed' : 'free',
  fx: index === 1 ? 5 : index === 2 ? 7 : 0, fy: 0, moment: 0,
}));
portal.members = [0, 1, 2].map(index => ({ ...member, id: `M${index}`,
  start: `P${index}`, end: `P${index + 1}` }));
const inclined = benchmarkModel('cantilever');
inclined.nodes[1].x = 3;
inclined.nodes[1].y = 4;
inclined.nodes[1].fx = 4;
inclined.nodes[1].fy = -5;
const released = benchmarkModel('supported');
released.nodes.push({ id: 'N3', x: 3, y: 0, support: 'roller',
  fx: 0, fy: 0, moment: 0 });
const beam = released.members[0];
released.members = [
  { ...beam, id: 'left', end: 'N3', releaseEnd: true },
  { ...beam, id: 'right', start: 'N3' },
];
const heterogeneous = structuredClone(portal);
heterogeneous.members[0].elasticModulusMPa *= 0.7;
heterogeneous.members[0].inertia *= 0.4;
heterogeneous.nodes[1].moment = 2;
const office = createExampleProject('office-8').analysis?.model;
assert.ok(office);

const originalLog = console.log;
let cases;
try {
  console.log = () => {};
  cases = [
    check('cantilever', benchmarkModel('cantilever')),
    check('supported', benchmarkModel('supported')),
    check('inclined', inclined),
    check('portal', portal),
    check('released-continuous', released),
    check('heterogeneous-portal', heterogeneous),
    check('office-8', office),
  ];
} finally { console.log = originalLog; }

const report = { generatedAt: new Date().toISOString(), runtime: `Bun ${Bun.version}`,
  wasmSha256: createHash('sha256').update(wasm).digest('hex'), cases,
  scope: 'Cross-residual check: Rust nodal displacement is mapped to the ts-fem coordinate/sign convention, then evaluated against the TS-assembled full K and load vector. Free equations and restrained reactions are checked. This does not prove the two implementations assemble identical matrices; it checks their solutions against one assembled system. Uses the existing WASM artifact, not a fresh Rust build.' };
mkdirSync(new URL('../test-results/', import.meta.url), { recursive: true });
writeFileSync(new URL('../test-results/frame2d-cross-residual.json', import.meta.url),
  JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
