import { describe, expect, test } from 'bun:test';
import { Frame2dKernelClient } from '../src/kernel/worker/Frame2dKernelClient';
import type { Frame2dResultV1, Frame2dWorkerRequest, Frame2dWorkerResponse } from '../src/kernel/worker/frame2d.protocol';

class FakeWorker {
  onmessage: ((event: MessageEvent<Frame2dWorkerResponse>) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  requests: Frame2dWorkerRequest[] = [];
  terminated = false;

  postMessage(request: Frame2dWorkerRequest) { this.requests.push(request); }
  terminate() { this.terminated = true; }

  answer(deformedShape?: Frame2dResultV1['members'][number]['deformedShape'], diagnostics?: Frame2dResultV1['diagnostics']) {
    const { model } = this.requests[0];
    this.onmessage?.({ data: { ok: true, result: {
      version: 1,
      requestId: model.requestId,
      revision: model.revision,
      ...(diagnostics ? { diagnostics } : {}),
      nodes: model.nodes.map(node => ({ id: node.id, uxM: 0, uyM: 0, rzRad: 0, reactionFxN: 0, reactionFyN: 0, reactionMzNm: 0 })),
      members: model.members.map(member => ({
        id: member.id,
        localEndForces: [0, 0, 0, 0, 0, 0],
        ...(deformedShape ? { deformedShape } : {}),
      })),
    } } } as MessageEvent<Frame2dWorkerResponse>);
  }
}

const model = {
  version: 1 as const,
  nodes: [
    { id: 'base', position: { x: 0, y: 0 }, restraint: { ux: true, uy: true, rz: true } },
    { id: 'tip', position: { x: 3, y: 0 }, restraint: { ux: false, uy: false, rz: false } },
  ],
  members: [{
    id: 'beam', startNode: 'base', endNode: 'tip',
    material: { elasticModulusPa: 30e9, shearModulusPa: 12.5e9 },
    section: { areaM2: 0.06, inertiaM4: 0.00045, shearCorrection: 5 / 6 },
  }],
};

describe('2D frame kernel worker client', () => {
  test('preserves numerical diagnostics from the worker', async () => {
    const worker = new FakeWorker();
    const client = new Frame2dKernelClient(() => worker as unknown as Worker);
    const promise = client.solve(model, { revision: 4 });
    const diagnostics = { freeDofs: 3, scaledConditionEstimate: 14,
      maxComponentwiseBackwardError: 1e-15, maxResidualToleranceRatio: 0.01 };
    worker.answer(undefined, diagnostics);
    expect((await promise).diagnostics).toEqual(diagnostics);
    client.dispose();
  });

  test('rejects malformed or out-of-tolerance diagnostics', async () => {
    for (const invalid of [
      { freeDofs: 7 }, { freeDofs: -1 }, { freeDofs: 1.5 },
      { maxComponentwiseBackwardError: NaN }, { maxComponentwiseBackwardError: -1 },
      { maxResidualToleranceRatio: Infinity }, { maxResidualToleranceRatio: 1.01 },
      { scaledConditionEstimate: NaN }, { scaledConditionEstimate: 0.5 },
      { scaledConditionEstimate: null }, { freeDofs: 0, scaledConditionEstimate: 1 },
    ]) {
      const worker = new FakeWorker();
      const client = new Frame2dKernelClient(() => worker as unknown as Worker);
      const promise = client.solve(model, { revision: 4 });
      worker.answer(undefined, { freeDofs: 3, maxComponentwiseBackwardError: 0,
        maxResidualToleranceRatio: 0, ...invalid });
      await expect(promise).rejects.toThrow('KERNEL_INVALID_RESPONSE');
      client.dispose();
    }
  });

  test('correlates a result to model IDs and revision', async () => {
    const worker = new FakeWorker();
    const client = new Frame2dKernelClient(() => worker as unknown as Worker);
    const promise = client.solve(model, { revision: 4 });
    worker.answer();
    const result = await promise;
    expect(result.revision).toBe(4);
    expect(result.nodes.map(node => node.id)).toEqual(['base', 'tip']);
    expect(result.members[0].localEndForces).toHaveLength(6);
    client.dispose();
    expect(worker.terminated).toBe(true);
  });

  test('cancels pending analysis and ignores a late response', async () => {
    const worker = new FakeWorker();
    const client = new Frame2dKernelClient(() => worker as unknown as Worker);
    const controller = new AbortController();
    const promise = client.solve(model, { revision: 1, signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toThrow('KERNEL_CANCELLED');
    worker.answer();
    client.dispose();
  });

  test('rejects non-finite models before starting a worker', async () => {
    const worker = new FakeWorker();
    const client = new Frame2dKernelClient(() => worker as unknown as Worker);
    const invalid = structuredClone(model);
    invalid.members[0].material.elasticModulusPa = Number.NaN;
    await expect(client.solve(invalid, { revision: 0 })).rejects.toThrow('KERNEL_INVALID_REQUEST');
    expect(worker.requests).toHaveLength(0);
    client.dispose();
  });

  test('rejects deformed-shape stations outside the member length', async () => {
    const worker = new FakeWorker();
    const client = new Frame2dKernelClient(() => worker as unknown as Worker);
    const promise = client.solve(model, { revision: 2 });
    worker.answer({ stationsM: [0, 2], globalDxM: [0, 0], globalDyM: [0, 0] });
    await expect(promise).rejects.toThrow('KERNEL_INVALID_RESPONSE');
    client.dispose();
  });
});
