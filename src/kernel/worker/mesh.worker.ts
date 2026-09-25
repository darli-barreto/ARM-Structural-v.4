/// <reference lib="webworker" />
import type { MeshRequest, WorkerResponse } from './protocol';
import { loadKernel } from './KernelLoader';

const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.onmessage = async ({ data }: MessageEvent<MeshRequest>) => {
  try {
    const module = await loadKernel();
    const mesh = module.execute_mesh_v1(JSON.stringify(data));
    try {
      const result = {
        version: 1 as const, requestId: data.requestId, elementId: data.elementId, revision: data.revision,
        positions: mesh.positions(), normals: mesh.normals(), indices: mesh.indices(), volume: mesh.volume(),
      };
      const response: WorkerResponse = { ok: true, result };
      scope.postMessage(response, [result.positions.buffer, result.normals.buffer, result.indices.buffer]);
    } finally {
      mesh.free();
    }
  } catch (error) {
    let code = 'KERNEL_EXECUTION_FAILED';
    let field = 'worker';
    if (error instanceof Error && error.message === 'KERNEL_UNSUPPORTED_VERSION') code = error.message;
    if (typeof error === 'string') {
      try {
        const parsed: unknown = JSON.parse(error);
        if (parsed && typeof parsed === 'object' && 'code' in parsed && 'field' in parsed
            && typeof parsed.code === 'string' && typeof parsed.field === 'string') {
          code = parsed.code;
          field = parsed.field;
        }
      } catch { /* Non-contract errors remain generic. */ }
    }
    scope.postMessage({ ok: false, requestId: data.requestId, code, field } satisfies WorkerResponse);
  }
};
