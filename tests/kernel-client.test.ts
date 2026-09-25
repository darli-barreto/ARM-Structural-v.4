import { describe, expect, test } from 'bun:test';
import { KernelClient } from '../src/kernel/worker/KernelClient';
import type { MeshRequest, WorkerResponse } from '../src/kernel/worker/protocol';

class FakeWorker {
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  requests: MeshRequest[] = [];
  terminated = false;
  postMessage(request: MeshRequest) { this.requests.push(request); }
  terminate() { this.terminated = true; }
  answer(revision = this.requests[0].revision) {
    const request = this.requests[0];
    this.onmessage?.({ data: { ok: true, result: {
      version: 1, requestId: request.requestId, elementId: request.elementId, revision,
      positions: new Float64Array(72), normals: new Float64Array(72), indices: new Uint32Array(36), volume: 1,
    } } } as MessageEvent<WorkerResponse>);
  }
}
const element = { type: 'slab' as const, center: { x: 0, y: 0, z: 0 }, width: 4, length: 5, thickness: 0.2 };
const options = { elementId: 'slab-1', revision: 3 };
const factory = (worker: FakeWorker) => () => worker as unknown as Worker;

describe('Kernel worker lifecycle', () => {
  test('correlates results and disposes the worker', async () => {
    const worker = new FakeWorker();
    const client = new KernelClient(factory(worker));
    const promise = client.mesh(element, options);
    worker.answer();
    expect((await promise).revision).toBe(3);
    client.dispose();
    expect(worker.terminated).toBe(true);
    await expect(client.mesh(element, options)).rejects.toThrow('KERNEL_DISPOSED');
  });
  test('rejects mismatched revisions', async () => {
    const worker = new FakeWorker();
    const client = new KernelClient(factory(worker));
    const promise = client.mesh(element, options);
    worker.answer(99);
    await expect(promise).rejects.toThrow('KERNEL_INVALID_RESPONSE');
    client.dispose();
  });
  test('cancels pending work and ignores late messages', async () => {
    const worker = new FakeWorker();
    const client = new KernelClient(factory(worker));
    const controller = new AbortController();
    const promise = client.mesh(element, { ...options, signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toThrow('KERNEL_CANCELLED');
    worker.answer();
    client.dispose();
  });
  test('timeout terminates the worker and permits retry', async () => {
    const workers: FakeWorker[] = [];
    const client = new KernelClient(() => { const worker = new FakeWorker(); workers.push(worker); return worker as unknown as Worker; }, 10);
    await expect(client.mesh(element, options)).rejects.toThrow('KERNEL_TIMEOUT');
    expect(workers[0].terminated).toBe(true);
    const retry = client.mesh(element, options);
    workers[1].answer();
    expect((await retry).volume).toBe(1);
    client.dispose();
  });
  test('rejects every pending request on failure', async () => {
    const worker = new FakeWorker();
    const client = new KernelClient(factory(worker));
    const promises = [client.mesh(element, options), client.mesh(element, options)];
    worker.onerror?.();
    const results = await Promise.allSettled(promises);
    expect(results.every(result => result.status === 'rejected')).toBe(true);
    expect(worker.terminated).toBe(true);
    client.dispose();
  });
  test('validates values before worker creation', async () => {
    const worker = new FakeWorker();
    const client = new KernelClient(factory(worker));
    await expect(client.mesh({ ...element, width: NaN }, options)).rejects.toThrow('KERNEL_NON_FINITE');
    await expect(client.mesh(element, { ...options, revision: -1 })).rejects.toThrow('KERNEL_INVALID_REQUEST');
    expect(worker.requests).toHaveLength(0);
    client.dispose();
  });
});
