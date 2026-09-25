import type { KernelModule } from './protocol';

let kernelPromise: Promise<KernelModule> | undefined;

export function loadKernel(): Promise<KernelModule> {
  kernelPromise ??= (async () => {
    const url = '/vendor/structural-kernel/structural_kernel.js';
    const module: KernelModule = await import(/* webpackIgnore: true */ url);
    await module.default();
    if (module.kernel_contract_version() !== 1 || module.kernel_contract_units() !== 'length=m;force=N;stress=Pa;moment=N*m;mass=kg') {
      throw new Error('KERNEL_UNSUPPORTED_VERSION');
    }
    return module;
  })().catch(error => {
    kernelPromise = undefined;
    throw error;
  });
  return kernelPromise;
}
