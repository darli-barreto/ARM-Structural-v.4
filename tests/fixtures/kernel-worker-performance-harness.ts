import { Frame2dKernelClient } from '../../src/kernel/worker/Frame2dKernelClient';
import type { Frame2dModelInputV1 } from '../../src/kernel/worker/frame2d.protocol';

interface CaseResult {
  nodes: number;
  members: number;
  inputBytes: number;
  outputBytes: number;
  inputSha256: string;
  outputSha256: string;
  firstRoundTripMs: number;
  warmRoundTripsMs: number[];
  warmMedianMs: number;
  maxRafGapMs: number;
  diagnostics: unknown;
}

declare global { interface Window { kernelWorkerPerformance?: { status: string; result?: unknown; error?: string } } }

const sizes = [[4, 5], [10, 10], [10, 25], [20, 25]];
const client = new Frame2dKernelClient(() => new Worker('/frame2d.worker.js', { type: 'module' }), 120_000);
const encoder = new TextEncoder();
const digest = async (value: string): Promise<string> => Array.from(
  new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))),
  byte => byte.toString(16).padStart(2, '0'),
).join('');
const numericalResult = (result: Awaited<ReturnType<Frame2dKernelClient['solve']>>) => {
  const { requestId: _requestId, revision: _revision, ...values } = result;
  return JSON.stringify(values);
};

function createGrid(columns: number, rows: number): Frame2dModelInputV1 {
  const nodes: Frame2dModelInputV1['nodes'] = [];
  const members: Frame2dModelInputV1['members'] = [];
  const id = (x: number, y: number) => `N${y * columns + x}`;
  const add = (startNode: string, endNode: string) => members.push({
    id: `M${members.length}`, startNode, endNode,
    material: { elasticModulusPa: 30e9, shearModulusPa: 12.5e9 },
    section: { areaM2: 0.06, inertiaM4: 0.00045, shearCorrection: 5 / 6 },
  });
  for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
    nodes.push({ id: id(x, y), position: { x: x * 5, y: y * 3 },
      restraint: { ux: y === 0, uy: y === 0, rz: y === 0 },
      load: { fx: y ? 10 : 0, fy: y ? -100 : 0, mz: 0 } });
    if (y) add(id(x, y - 1), id(x, y));
    if (y && x) add(id(x - 1, y), id(x, y));
  }
  return { version: 1, nodes, members };
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

async function runCase(columns: number, rows: number, index: number): Promise<CaseResult> {
  const model = createGrid(columns, rows);
  const input = JSON.stringify(model);
  const inputHash = await digest(input);
  const frameGaps: number[] = [];
  let lastFrame = performance.now();
  let active = true;
  const frame = (now: number) => {
    if (!active) return;
    frameGaps.push(now - lastFrame);
    lastFrame = now;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  const solve = async (revision: number) => {
    const start = performance.now();
    const result = await client.solve(model, { revision });
    return { result, elapsed: performance.now() - start };
  };
  try {
    const first = await solve(index * 10);
    const firstJson = numericalResult(first.result);
    const outputHash = await digest(firstJson);
    if (first.result.nodes.length !== model.nodes.length || first.result.members.length !== model.members.length
      || first.result.diagnostics?.maxResidualToleranceRatio === undefined
      || first.result.diagnostics.maxResidualToleranceRatio > 1) throw new Error(`Invalid response for ${model.nodes.length} nodes`);
    const warm: number[] = [];
    for (let repeat = 0; repeat < 6; repeat++) {
      const next = await solve(index * 10 + repeat + 1);
      if (await digest(numericalResult(next.result)) !== outputHash) throw new Error('Nondeterministic Worker response');
      warm.push(next.elapsed);
    }
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    return { nodes: model.nodes.length, members: model.members.length,
      inputBytes: encoder.encode(input).byteLength, outputBytes: encoder.encode(firstJson).byteLength,
      inputSha256: inputHash, outputSha256: outputHash, firstRoundTripMs: first.elapsed,
      warmRoundTripsMs: warm, warmMedianMs: median(warm), maxRafGapMs: Math.max(0, ...frameGaps),
      diagnostics: first.result.diagnostics };
  } finally { active = false; }
}

async function runSoak(): Promise<Record<string, unknown>> {
  const model = createGrid(20, 25);
  const durations: number[] = [];
  const gaps: number[] = [];
  const baseline = await digest(numericalResult(await client.solve(model, { revision: 1000 })));
  let lastFrame = performance.now(), active = true;
  const frame = (now: number) => {
    if (!active) return;
    gaps.push(now - lastFrame);
    lastFrame = now;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  try {
    for (let index = 0; index < 60; index++) {
      const start = performance.now();
      const result = await client.solve(model, { revision: 1001 + index });
      durations.push(performance.now() - start);
      if (result.diagnostics?.maxResidualToleranceRatio === undefined
        || result.diagnostics.maxResidualToleranceRatio > 1
        || await digest(numericalResult(result)) !== baseline) throw new Error(`Soak response ${index} failed`);
    }
  } finally { active = false; }
  const batches = [0, 1, 2, 3, 4, 5].map(batch => durations.slice(batch * 10, batch * 10 + 10));
  const batchMedians = batches.map(median);
  const sorted = [...durations].sort((a, b) => a - b);
  return { requestCount: durations.length, deterministic: true, batchMediansMs: batchMedians,
    overallMedianMs: median(durations), p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
    firstBatchMedianMs: batchMedians[0], lastBatchMedianMs: batchMedians.at(-1),
    lastToFirstMedianRatio: batchMedians[0] ? batchMedians.at(-1)! / batchMedians[0] : null,
    maxRafGapMs: Math.max(0, ...gaps),
    transferredResponseBytesPerRequest: 1_262_488 };
}

async function run(): Promise<void> {
  const cases = [];
  for (const [index, [columns, rows]] of sizes.entries()) cases.push(await runCase(columns, rows, index));
  window.kernelWorkerPerformance = { status: 'done', result: { userAgent: navigator.userAgent, cases,
    soak: await runSoak(),
    frameMetric: 'Maximum requestAnimationFrame interval during each batch, including browser scheduling noise.' } };
}

window.kernelWorkerPerformance = { status: 'running' };
void run().catch(error => { window.kernelWorkerPerformance = { status: 'error', error: String(error) }; })
  .finally(() => client.dispose());
