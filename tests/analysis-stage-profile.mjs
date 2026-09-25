import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { initSync, solve_frame2d_v1 } from '../structural_kernel/pkg/structural_kernel.js';
import { createExampleProject } from '../src/core/model/ExampleProjects.ts';
import { solveFrame } from '../src/core/analysis/Solver.ts';
import { compareFrame2dResults, toFrame2dKernelInput } from '../src/core/analysis/KernelAdapter.ts';
import { assessAnalysisResult } from '../src/core/analysis/ResultAssessment.ts';

initSync({ module: readFileSync(new URL('../structural_kernel/pkg/structural_kernel_bg.wasm', import.meta.url)) });
const { analysis } = createExampleProject('office-8');
assert.ok(analysis);
const { model, factors, caseName } = analysis;
const reference = solveFrame(model, factors, caseName);
const kernel = JSON.parse(solve_frame2d_v1(JSON.stringify({
  ...toFrame2dKernelInput(model, factors), requestId: 'profile', revision: model.revision,
})));
const parity = compareFrame2dResults(model, factors, reference, kernel);

function measure(action) {
  for (let index = 0; index < 5; index++) action();
  const samples = [];
  for (let index = 0; index < 30; index++) {
    const start = performance.now();
    action();
    samples.push(performance.now() - start);
  }
  const sorted = [...samples].sort((a, b) => a - b);
  return { medianMs: (sorted[14] + sorted[15]) / 2, minMs: sorted[0], maxMs: sorted.at(-1), samplesMs: samples };
}

const stages = {
  cloneInputs: measure(() => { structuredClone(model); structuredClone(reference); }),
  prepareRustInput: measure(() => toFrame2dKernelInput(model, factors)),
  compareResults: measure(() => compareFrame2dResults(model, factors, reference, kernel)),
  cloneComparison: measure(() => structuredClone(parity)),
  assessResults: measure(() => assessAnalysisResult(model, reference, factors, undefined, parity)),
};
const report = { generatedAt: new Date().toISOString(), runtime: Bun.version,
  model: { nodes: model.nodes.length, members: model.members.length },
  comparisonRows: parity.rows.length + parity.memberRows.length + parity.diagramRows.length + parity.deformationRows.length,
  stages, scope: 'Bun microprofile of pure functions and structured clones for the office-8 example, 5 warmups and 30 samples each. Excludes browser React render, Worker transfer and browser scheduling. Stage medians are not additive to UI wall time.' };
mkdirSync(new URL('../test-results/', import.meta.url), { recursive: true });
writeFileSync(new URL('../test-results/analysis-stage-profile.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report, stages: Object.fromEntries(Object.entries(stages).map(([name, { medianMs, minMs, maxMs }]) =>
  [name, { medianMs, minMs, maxMs }])) }, null, 2));
