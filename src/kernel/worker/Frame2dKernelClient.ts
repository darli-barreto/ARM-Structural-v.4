import type {
  Frame2dModelV1,
  Frame2dModelInputV1,
  Frame2dResultV1,
  Frame2dWorkerRequest,
  Frame2dWorkerResponse,
} from './frame2d.protocol';

export class Frame2dKernelError extends Error {
  constructor(public readonly code: string, public readonly field = 'worker') {
    super(`${code}: ${field}`);
    this.name = 'Frame2dKernelError';
  }
}

export interface Frame2dSolveOptions {
  revision: number;
  signal?: AbortSignal;
}

interface PendingRequest {
  model: Frame2dModelV1;
  resolve(result: Frame2dResultV1): void;
  reject(error: Error): void;
  cleanup(): void;
}

/** Opt-in 2D frame analysis. It does not replace the active application solver. */
export class Frame2dKernelClient {
  private worker: Worker | undefined;
  private readonly pending = new Map<string, PendingRequest>();
  private disposed = false;

  constructor(
    private readonly createWorker = () => new Worker(new URL('./frame2d.worker.ts', import.meta.url), { type: 'module' }),
    private readonly timeoutMs = 30_000,
  ) {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new RangeError('Invalid kernel timeout');
  }

  solve(model: Frame2dModelInputV1, options: Frame2dSolveOptions): Promise<Frame2dResultV1> {
    if (this.disposed) return Promise.reject(new Frame2dKernelError('KERNEL_DISPOSED'));
    if (options.signal?.aborted) return Promise.reject(new Frame2dKernelError('KERNEL_CANCELLED'));
    if (this.pending.size >= 8) return Promise.reject(new Frame2dKernelError('KERNEL_QUEUE_FULL'));
    if (!Number.isInteger(options.revision) || options.revision < 0 || options.revision > 0xffff_ffff
        || model.version !== 1 || !model.nodes.length || model.nodes.length > 500
        || !model.members.length || model.members.length > 5_000 || !allNumbersFinite(model)) {
      return Promise.reject(new Frame2dKernelError('KERNEL_INVALID_REQUEST', 'model'));
    }
    const requestId = crypto.randomUUID();
    const requestModel: Frame2dModelV1 = { ...model, requestId, revision: options.revision };
    if (new TextEncoder().encode(JSON.stringify(requestModel)).length > 2_000_000) {
      return Promise.reject(new Frame2dKernelError('KERNEL_INVALID_REQUEST', 'model'));
    }
    let worker: Worker;
    try { worker = this.getWorker(); }
    catch { return Promise.reject(new Frame2dKernelError('KERNEL_WORKER_UNAVAILABLE')); }
    return new Promise((resolve, reject) => {
      const abort = () => this.rejectOne(requestId, new Frame2dKernelError('KERNEL_CANCELLED'));
      const timer = setTimeout(() => this.reset(new Frame2dKernelError('KERNEL_TIMEOUT')), this.timeoutMs);
      this.pending.set(requestId, {
        model: requestModel, resolve, reject,
        cleanup: () => { clearTimeout(timer); options.signal?.removeEventListener('abort', abort); },
      });
      options.signal?.addEventListener('abort', abort, { once: true });
      try { worker.postMessage({ model: requestModel } satisfies Frame2dWorkerRequest); }
      catch { this.rejectOne(requestId, new Frame2dKernelError('KERNEL_INVALID_REQUEST')); }
    });
  }

  dispose(): void {
    this.disposed = true;
    this.reset(new Frame2dKernelError('KERNEL_DISPOSED'));
  }

  private getWorker(): Worker {
    if (!this.worker) {
      const worker = this.createWorker();
      worker.onmessage = ({ data }: MessageEvent<Frame2dWorkerResponse>) => {
        if (this.worker !== worker) return;
        if (!data || typeof data !== 'object' || typeof data.ok !== 'boolean'
            || (data.ok ? !data.result || typeof data.result.requestId !== 'string' : typeof data.requestId !== 'string')) {
          this.reset(new Frame2dKernelError('KERNEL_INVALID_RESPONSE'));
          return;
        }
        const requestId = data.ok ? data.result.requestId : data.requestId;
        const pending = this.pending.get(requestId);
        if (!pending) return;
        if (!data.ok) return this.rejectOne(requestId, new Frame2dKernelError(data.code, data.field));
        if (!isValidResult(data.result, pending.model)) {
          return this.rejectOne(requestId, new Frame2dKernelError('KERNEL_INVALID_RESPONSE'));
        }
        pending.cleanup();
        this.pending.delete(requestId);
        pending.resolve(data.result);
      };
      worker.onerror = () => { if (this.worker === worker) this.reset(new Frame2dKernelError('KERNEL_WORKER_FAILED')); };
      worker.onmessageerror = () => { if (this.worker === worker) this.reset(new Frame2dKernelError('KERNEL_INVALID_RESPONSE')); };
      this.worker = worker;
    }
    return this.worker;
  }

  private rejectOne(requestId: string, error: Error): void {
    const request = this.pending.get(requestId);
    if (!request) return;
    request.cleanup();
    this.pending.delete(requestId);
    request.reject(error);
  }

  private reset(error: Error): void {
    this.worker?.terminate();
    this.worker = undefined;
    for (const requestId of this.pending.keys()) this.rejectOne(requestId, error);
  }
}

function allNumbersFinite(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (value && typeof value === 'object') return Object.values(value).every(allNumbersFinite);
  return true;
}

function isValidResult(value: unknown, model: Frame2dModelV1): value is Frame2dResultV1 {
  if (!isRecord(value) || !Array.isArray(value.nodes) || !Array.isArray(value.members)
      || value.version !== 1 || value.requestId !== model.requestId || value.revision !== model.revision
      || value.nodes.length !== model.nodes.length || value.members.length !== model.members.length) return false;
  if (value.diagnostics !== undefined) {
    const diagnostics = value.diagnostics;
    if (!isRecord(diagnostics) || !Number.isInteger(diagnostics.freeDofs)
        || (diagnostics.freeDofs as number) < 0 || (diagnostics.freeDofs as number) > 3 * model.nodes.length
        || ![diagnostics.maxComponentwiseBackwardError, diagnostics.maxResidualToleranceRatio]
          .every(entry => typeof entry === 'number' && Number.isFinite(entry) && entry >= 0)
        || (diagnostics.maxResidualToleranceRatio as number) > 1) return false;
    const condition = diagnostics.scaledConditionEstimate;
    if (condition !== undefined && (diagnostics.freeDofs === 0
      ? condition !== null
      : typeof condition !== 'number' || !Number.isFinite(condition) || condition < 1)) return false;
  }
  return value.nodes.every((node, index) => isRecord(node) && node.id === model.nodes[index].id
      && [node.uxM, node.uyM, node.rzRad, node.reactionFxN, node.reactionFyN, node.reactionMzNm].every(Number.isFinite))
    && value.members.every((member, index) => {
      if (!isRecord(member) || member.id !== model.members[index].id
          || !Array.isArray(member.localEndForces) || member.localEndForces.length !== 6
          || !member.localEndForces.every(Number.isFinite)) return false;
      if (member.deformedShape === undefined) return true;
      const start = model.nodes.find(node => node.id === model.members[index].startNode)?.position;
      const end = model.nodes.find(node => node.id === model.members[index].endNode)?.position;
      if (!start || !end) return false;
      return isValidDeformedShape(member.deformedShape, Math.hypot(end.x - start.x, end.y - start.y));
    });
}

function isValidDeformedShape(value: unknown, memberLength: number): boolean {
  if (!isRecord(value) || !Array.isArray(value.stationsM) || value.stationsM.length < 2
      || value.stationsM.length > 1_001 || !Array.isArray(value.globalDxM)
      || !Array.isArray(value.globalDyM) || value.globalDxM.length !== value.stationsM.length
      || value.globalDyM.length !== value.stationsM.length
      || !value.stationsM.every(Number.isFinite) || !value.globalDxM.every(Number.isFinite)
      || !value.globalDyM.every(Number.isFinite)) return false;
  const tolerance = 1e-9 * Math.max(1, memberLength);
  if (Math.abs(value.stationsM[0]) > tolerance
      || Math.abs(value.stationsM.at(-1)! - memberLength) > tolerance) return false;
  return value.stationsM.every((station, index, stations) =>
    station >= -tolerance && station <= memberLength + tolerance && (index === 0 || station > stations[index - 1]));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
