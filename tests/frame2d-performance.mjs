import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { initSync, solve_frame2d_v1 } from '../structural_kernel/pkg/structural_kernel.js';

const wasmPath = new URL('../structural_kernel/pkg/structural_kernel_bg.wasm', import.meta.url);
const hash = value => createHash('sha256').update(value).digest('hex');
const sizes = [[4, 5], [10, 10], [10, 25], [20, 25]];

function grid(columns, rows) {
  const nodes = [], members = [];
  const id = (x, y) => `N${y * columns + x}`;
  const add = (a, b) => members.push({ id: `M${members.length}`, startNode: a, endNode: b,
    material: { elasticModulusPa: 30e9, shearModulusPa: 12.5e9 },
    section: { areaM2: 0.06, inertiaM4: 0.00045, shearCorrection: 5 / 6 } });
  for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
    nodes.push({ id: id(x, y), position: { x: x * 5, y: y * 3 },
      restraint: { ux: y === 0, uy: y === 0, rz: y === 0 },
      load: { fx: y ? 10 : 0, fy: y ? -100 : 0, mz: 0 } });
    if (y) add(id(x, y - 1), id(x, y));
    if (y && x) add(id(x - 1, y), id(x, y));
  }
  return { version: 1, requestId: `scale-${columns}-${rows}`, revision: 0, nodes, members };
}

function validate(model, result) {
  assert.equal(result.nodes.length, model.nodes.length);
  assert.equal(result.members.length, model.members.length);
  assert.ok(result.diagnostics.maxResidualToleranceRatio <= 1);
  assert.ok(Number.isFinite(result.diagnostics.scaledConditionEstimate));
  const sum = [0, 0, 0], scale = [0, 0, 0];
  model.nodes.forEach((node, i) => {
    const r = result.nodes[i];
    assert.equal(r.id, node.id);
    for (const value of Object.values(r).filter(v => typeof v === 'number')) assert.ok(Number.isFinite(value));
    const { x, y } = node.position;
    const terms = [r.reactionFxN + node.load.fx, r.reactionFyN + node.load.fy,
      r.reactionMzNm + node.load.mz + x * (r.reactionFyN + node.load.fy) - y * (r.reactionFxN + node.load.fx)];
    terms.forEach((v, j) => { sum[j] += v; scale[j] += Math.abs(v); });
  });
  sum.forEach((v, i) => assert.ok(Math.abs(v) <= 1e-5 + 1e-7 * scale[i], `Global balance ${i}: ${v}`));
  return sum;
}

if (process.argv[2] === '--case') {
  const [columns, rows] = sizes[Number(process.argv[3])];
  const bytes = readFileSync(wasmPath);
  const start = performance.now();
  const wasm = initSync({ module: bytes });
  const initMs = performance.now() - start;
  const model = grid(columns, rows), input = JSON.stringify(model);
  const memoryBefore = { ...process.memoryUsage(), wasmCapacityBytes: wasm.memory.buffer.byteLength };
  const times = [];
  let firstHash, balance, diagnostics, outputBytes;
  for (let run = 0; run < 8; run++) {
    const t = performance.now();
    const output = solve_frame2d_v1(input);
    times.push(performance.now() - t);
    const result = JSON.parse(output);
    balance = validate(model, result);
    diagnostics = result.diagnostics;
    const digest = hash(output);
    if (run === 0) firstHash = digest;
    else assert.equal(digest, firstHash, 'Repeated result must be deterministic');
    outputBytes = Buffer.byteLength(output);
  }
  const sorted = times.slice(1).sort((a, b) => a - b);
  console.log(JSON.stringify({ nodes: model.nodes.length, members: model.members.length,
    inputSha256: hash(input), outputSha256: firstHash, inputBytes: Buffer.byteLength(input), outputBytes,
    initMs, firstSolveMs: times[0], warmSamplesMs: times.slice(1), warmMedianMs: sorted[3],
    warmMinMs: sorted[0], warmMaxMs: sorted[6], memoryBefore,
    memoryAfter: { ...process.memoryUsage(), wasmCapacityBytes: wasm.memory.buffer.byteLength },
    peakProcessRssKiB: process.resourceUsage().maxRSS, diagnostics, globalBalance: balance }));
} else {
  const cases = sizes.map((_, index) => {
    const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--case', String(index)],
      { encoding: 'utf8', timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });
    assert.equal(child.error, undefined, child.error?.message);
    assert.equal(child.status, 0, child.stderr);
    return JSON.parse(child.stdout);
  });
  initSync({ module: readFileSync(wasmPath) });
  const tooManyNodes = grid(1, 501), tooManyMembers = grid(2, 2);
  tooManyMembers.members = Array.from({ length: 5001 }, (_, i) => ({ ...tooManyMembers.members[0], id: `M${i}` }));
  const rejections = [tooManyNodes, tooManyMembers].map(model => {
    let error;
    try { solve_frame2d_v1(JSON.stringify(model)); } catch (e) { error = String(e); }
    assert.ok(error, 'Over-limit model must be rejected');
    assert.deepEqual(JSON.parse(error), { code: 'KERNEL_INVALID_REQUEST', field: 'request' });
    return { nodes: model.nodes.length, members: model.members.length, error };
  });
  const report = { generatedAt: new Date().toISOString(), runtime: process.version,
    platform: `${process.platform}-${process.arch}`, cpu: os.cpus()[0]?.model,
    wasmSha256: hash(readFileSync(wasmPath)), cases, rejections,
    scope: 'Node WASM API including JSON encoding of output and numerical diagnostics; input serialization, output parsing and validation excluded from solve timing. Not browser Worker latency or isolated factorization timing.',
    memoryCaveat: 'WASM capacity is reserved linear memory, not live allocations. RSS is the whole process; snapshots are not allocation peaks. maxRSS includes runtime/init/validation. No forced GC. Seven warm samples are descriptive, not a statistical SLA.' };
  const directory = new URL('../test-results/', import.meta.url);
  mkdirSync(directory, { recursive: true });
  writeFileSync(new URL('frame2d-performance.json', directory), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
