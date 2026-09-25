import type { AnalysisModel, AnalysisResult } from '../../core/analysis/Model';

export interface AnalysisWorkerCallbacks {
  onSettled(): void;
  onResult(result: AnalysisResult): void;
  onError(message: string): void;
}

export interface AnalysisExecutor {
  run(
    model: AnalysisModel,
    factors: { dead: number; live: number; nodal: number },
    caseName: string,
    callbacks: AnalysisWorkerCallbacks,
  ): void;
  cancel(): void;
}

export class AnalysisWorkerClient implements AnalysisExecutor {
  private worker: Worker | null = null;

  public run(
    model: AnalysisModel,
    factors: { dead: number; live: number; nodal: number },
    caseName: string,
    callbacks: AnalysisWorkerCallbacks,
  ): void {
    this.cancel();
    const worker = new Worker(new URL('../../core/analysis/analysis.worker.ts', import.meta.url), { type: 'module' });
    this.worker = worker;

    const finish = () => {
      if (this.worker !== worker) return false;
      worker.terminate();
      this.worker = null;
      callbacks.onSettled();
      return true;
    };

    worker.onmessage = event => {
      if (!finish()) return;
      if (event.data.error) callbacks.onError(event.data.error);
      else callbacks.onResult(event.data.result);
    };
    worker.onerror = () => {
      if (!finish()) return;
      callbacks.onError('No se pudo ejecutar el motor de análisis.');
    };
    worker.postMessage({ model, factors, caseName });
  }

  public cancel(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}
