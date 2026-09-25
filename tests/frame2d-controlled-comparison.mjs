import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { initSync, solve_frame2d_v1 } from '../structural_kernel/pkg/structural_kernel.js';
import { createExampleProject } from '../src/core/model/ExampleProjects.ts';
import { solveFrame } from '../src/core/analysis/Solver.ts';
import { compareFrame2dResults, toFrame2dKernelInput } from '../src/core/analysis/KernelAdapter.ts';

const wasm = readFileSync(new URL('../structural_kernel/pkg/structural_kernel_bg.wasm', import.meta.url));
initSync({ module: wasm });
const digest = value => createHash('sha256').update(value).digest('hex');
const summarize = samples => {
  const sorted = [...samples].sort((a, b) => a - b);
  return { medianMs: (sorted[7] + sorted[8]) / 2, p95Ms: sorted[15],
    minMs: sorted[0], maxMs: sorted.at(-1), samplesMs: samples };
};

const originalLog = console.log;
const cases = [];
try {
  // ts-fem logs every solve; exclude this diagnostic output from both timed APIs.
  console.log = () => {};
  for (const id of ['cantilever', 'supported', 'office-8']) {
    const { analysis } = createExampleProject(id);
    assert.ok(analysis, `${id}: missing analysis model`);
    const { model, factors, caseName } = analysis;
    const kernelInput = JSON.stringify({ ...toFrame2dKernelInput(model, factors),
      requestId: `controlled-${id}`, revision: model.revision });
    const runTs = () => solveFrame(model, factors, caseName);
    const runRust = () => JSON.parse(solve_frame2d_v1(kernelInput));
    const reference = runTs();
    const kernel = runRust();
    const parity = compareFrame2dResults(model, factors, reference, kernel);
    assert.equal(parity.responsePassed, true, `${id}: response parity failed`);
    assert.equal(parity.deformationPassed, true, `${id}: deformation parity failed`);
    const referenceHash = digest(JSON.stringify(reference));
    const kernelHash = digest(JSON.stringify(kernel));

    for (let i = 0; i < 5; i++) { runTs(); runRust(); }
    const tsSamples = [], rustSamples = [];
    const measure = (run, samples) => {
      const started = performance.now();
      run();
      samples.push(performance.now() - started);
    };
    for (let i = 0; i < 16; i++) {
      if (i % 2 === 0) {
        measure(runTs, tsSamples);
        measure(runRust, rustSamples);
      } else {
        measure(runRust, rustSamples);
        measure(runTs, tsSamples);
      }
    }
    assert.equal(digest(JSON.stringify(runTs())), referenceHash, `${id}: TS result changed`);
    assert.equal(digest(JSON.stringify(runRust())), kernelHash, `${id}: Rust result changed`);
    cases.push({ id, nodes: model.nodes.length, members: model.members.length,
      responseChecks: parity.rows.length + parity.memberRows.length + parity.diagramRows.length,
      deformationChecks: parity.deformationRows.length,
      maximumAbsoluteError: parity.maximumAbsoluteError,
      maximumDeformationErrorM: parity.maximumDeformationErrorM,
      resultBytes: { ts: Buffer.byteLength(JSON.stringify(reference)), rust: Buffer.byteLength(JSON.stringify(kernel)) },
      ts: summarize(tsSamples), rust: summarize(rustSamples) });
  }
} finally {
  console.log = originalLog;
}

const report = { generatedAt: new Date().toISOString(), runtime: `Bun ${Bun.version}`,
  platform: process.platform, architecture: process.arch, cpu: os.cpus()[0]?.model,
  wasmSha256: digest(wasm), cases,
  scope: 'Paired, alternating full solver API calls on one canonical physical model per case. Rust input conversion is outside timing; Rust JSON parse/output is inside. TS includes model validation, load assembly, dense solve and 20-station recovery; Rust includes JSON input parse, sparse solve, condition estimation, output serialization and JS output parse. Console logging is disabled for both timed APIs. These are not identical matrix operations or a pure solver-algorithm speed comparison. Five warmups and 16 measured calls per engine; no timing acceptance thresholds.' };
mkdirSync(new URL('../test-results/', import.meta.url), { recursive: true });
writeFileSync(new URL('../test-results/frame2d-controlled-comparison.json', import.meta.url),
  JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report, cases: cases.map(({ ts, rust, ...rest }) => ({ ...rest,
  ts: { medianMs: ts.medianMs, p95Ms: ts.p95Ms },
  rust: { medianMs: rust.medianMs, p95Ms: rust.p95Ms } })) }, null, 2));
