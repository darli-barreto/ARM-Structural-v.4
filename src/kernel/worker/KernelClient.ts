import type { KernelGeometry, KernelMeshResult, MeshRequest, WorkerResponse } from './protocol';

export class KernelExecutionError extends Error {
  constructor(public readonly code: string, public readonly field = 'worker') {
    super(`${code}: ${field}`);
    this.name = 'KernelExecutionError';
  }
}

interface PendingRequest {
  elementId: string;
  revision: number;
  resolve(result: KernelMeshResult): void;
  reject(error: Error): void;
  cleanup(): void;
}

export interface MeshOptions {
  elementId: string;
  revision: number;
  signal?: AbortSignal;
}

/** Explicit opt-in geometry backend; it does not replace the active FEM solver. */
export class KernelClient {
  private worker: Worker | undefined;
  private readonly pending = new Map<string, PendingRequest>();
  private disposed = false;

  constructor(
    private readonly createWorker = () => new Worker(new URL('./mesh.worker.ts', import.meta.url), { type: 'module' }),
    private readonly timeoutMs = 30_000,
  ) {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new RangeError('Invalid kernel timeout');
  }

  mesh(element: KernelGeometry, options: MeshOptions): Promise<KernelMeshResult> {
    if (this.disposed) return Promise.reject(new KernelExecutionError('KERNEL_DISPOSED'));
    if (options.signal?.aborted) return Promise.reject(new KernelExecutionError('KERNEL_CANCELLED'));
    if (this.pending.size >= 128) return Promise.reject(new KernelExecutionError('KERNEL_QUEUE_FULL'));
    if (!Number.isInteger(options.revision) || options.revision < 0 || options.revision > 0xffff_ffff) {
      return Promise.reject(new KernelExecutionError('KERNEL_INVALID_REQUEST', 'revision'));
    }
    if (!options.elementId.trim() || new TextEncoder().encode(options.elementId).length > 256) {
      return Promise.reject(new KernelExecutionError('KERNEL_INVALID_REQUEST', 'elementId'));
    }
    // JSON would silently turn NaN/Infinity into null. Fail before serialization.
    if (!allNumbersFinite(element)) return Promise.reject(new KernelExecutionError('KERNEL_NON_FINITE', 'element'));
    let worker: Worker;
    try { worker = this.getWorker(); }
    catch { return Promise.reject(new KernelExecutionError('KERNEL_WORKER_UNAVAILABLE')); }
    const requestId = crypto.randomUUID();
    const request: MeshRequest = { version: 1, requestId, elementId: options.elementId, revision: options.revision, element };
    return new Promise((resolve, reject) => {
      const abort = () => this.rejectOne(requestId, new KernelExecutionError('KERNEL_CANCELLED'));
      const timer = setTimeout(() => this.reset(new KernelExecutionError('KERNEL_TIMEOUT')), this.timeoutMs);
      this.pending.set(requestId, {
        elementId: options.elementId, revision: options.revision, resolve, reject,
        cleanup: () => { clearTimeout(timer); options.signal?.removeEventListener('abort', abort); },
      });
      options.signal?.addEventListener('abort', abort, { once: true });
      try { worker.postMessage(request); }
      catch { this.rejectOne(requestId, new KernelExecutionError('KERNEL_INVALID_REQUEST')); }
    });
  }

  dispose(): void {
    this.disposed = true;
    this.reset(new KernelExecutionError('KERNEL_DISPOSED'));
  }

  private getWorker(): Worker {
    if (!this.worker) {
      const worker = this.createWorker();
      worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
        if (this.worker !== worker) return;
        if (!data || typeof data !== 'object' || typeof data.ok !== 'boolean'
            || (data.ok ? !data.result || typeof data.result.requestId !== 'string' : typeof data.requestId !== 'string')) {
          this.reset(new KernelExecutionError('KERNEL_INVALID_RESPONSE'));
          return;
        }
        const id = data.ok ? data.result.requestId : data.requestId;
        const pending = this.pending.get(id);
        if (!pending) return; // Cancelled jobs may still finish inside synchronous WASM.
        if (!data.ok) return this.rejectOne(id, new KernelExecutionError(data.code, data.field));
        const result = data.result;
        if (result.version !== 1 || result.elementId !== pending.elementId || result.revision !== pending.revision
            || !(result.positions instanceof Float64Array) || !(result.normals instanceof Float64Array)
            || !(result.indices instanceof Uint32Array) || result.positions.length !== 72
            || result.normals.length !== 72 || result.indices.length !== 36
            || !result.positions.every(Number.isFinite) || !result.normals.every(Number.isFinite)
            || result.indices.some(index => index >= 24) || !Number.isFinite(result.volume) || result.volume <= 0) {
          return this.rejectOne(id, new KernelExecutionError('KERNEL_INVALID_RESPONSE'));
        }
        pending.cleanup();
        this.pending.delete(id);
        pending.resolve(result);
      };
      worker.onerror = () => { if (this.worker === worker) this.reset(new KernelExecutionError('KERNEL_WORKER_FAILED')); };
      worker.onmessageerror = () => { if (this.worker === worker) this.reset(new KernelExecutionError('KERNEL_INVALID_RESPONSE')); };
      this.worker = worker;
    }
    return this.worker;
  }

  private rejectOne(id: string, error: Error): void {
    const request = this.pending.get(id);
    if (!request) return;
    request.cleanup();
    this.pending.delete(id);
    request.reject(error);
  }

  private reset(error: Error): void {
    this.worker?.terminate();
    this.worker = undefined;
    for (const id of this.pending.keys()) this.rejectOne(id, error);
  }
}

function allNumbersFinite(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (value && typeof value === 'object') return Object.values(value).every(allNumbersFinite);
  return true;
}
