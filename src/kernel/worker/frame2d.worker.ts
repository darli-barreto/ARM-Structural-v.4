/// <reference lib="webworker" />
import { loadKernel } from './KernelLoader';
import type { Frame2dWorkerRequest, Frame2dWorkerResponse, Frame2dResultV1, KernelFrameModule } from './frame2d.protocol';

const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.onmessage = async ({ data }: MessageEvent<Frame2dWorkerRequest>) => {
  const requestId = data?.model?.requestId ?? '';
  try {
    const module = await loadKernel() as KernelFrameModule;
    const result = JSON.parse(module.solve_frame2d_v1(JSON.stringify(data.model))) as Frame2dResultV1;
    scope.postMessage({ ok: true, result } satisfies Frame2dWorkerResponse);
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
      } catch { /* Non-contract failures remain generic. */ }
    }
    scope.postMessage({ ok: false, requestId, code, field } satisfies Frame2dWorkerResponse);
  }
};
