import { Frame2dKernelClient, Frame2dKernelError } from '../../src/kernel/worker/Frame2dKernelClient';
import type { Frame2dModelInputV1 } from '../../src/kernel/worker/frame2d.protocol';

interface Probe {
  status: 'running' | 'done' | 'error';
  cantilever?: { tipM: number; reactionN: number; stations: number; midpointM: number };
  supported?: { midpointM: number; reactionsN: [number, number]; stations: number };
    singularCode?: string;
    diagnostics?: { freeDofs: number; maxComponentwiseBackwardError: number; maxResidualToleranceRatio: number };
  cancellationCode?: string;
  error?: string;
}

declare global {
  interface Window { kernelWorkerProbe: Probe }
}

const material = { elasticModulusPa: 30e9, shearModulusPa: 12.5e9 };
const section = { areaM2: 0.06, inertiaM4: 0.00045, shearCorrection: 5 / 6 };
const cantilever: Frame2dModelInputV1 = {
  version: 1,
  nodes: [
    { id: 'base', position: { x: 0, y: 0 }, restraint: { ux: true, uy: true, rz: true } },
    { id: 'tip', position: { x: 3, y: 0 }, restraint: { ux: false, uy: false, rz: false },
      load: { fx: 0, fy: -10_000, mz: 0 } },
  ],
  members: [{ id: 'cantilever', startNode: 'base', endNode: 'tip', material, section }],
};
const supported: Frame2dModelInputV1 = {
  version: 1,
  nodes: [
    { id: 'left', position: { x: 0, y: 0 }, restraint: { ux: true, uy: true, rz: false } },
    { id: 'right', position: { x: 6, y: 0 }, restraint: { ux: false, uy: true, rz: false } },
  ],
  members: [{ id: 'supported', startNode: 'left', endNode: 'right',
    material: { elasticModulusPa: 25e9, shearModulusPa: 25e9 / 2.4 },
    section: { areaM2: 0.15, inertiaM4: 0.003125, shearCorrection: 5 / 6 },
    uniformLoad: { fxNPerM: 0, fyNPerM: -10_000 } }],
};

window.kernelWorkerProbe = { status: 'running' };
const client = new Frame2dKernelClient(
  () => new Worker('/frame2d.worker.js', { type: 'module' }),
  20_000,
);

async function captureError(operation: () => Promise<unknown>): Promise<string> {
  try { await operation(); }
  catch (error) {
    if (error instanceof Frame2dKernelError) return error.code;
    throw error;
  }
  throw new Error('Expected a kernel error');
}

async function run(): Promise<void> {
  const cantileverResult = await client.solve(cantilever, { revision: 7 });
  const supportedResult = await client.solve(supported, { revision: 8 });
  const signal = new AbortController();
  signal.abort();
  const cancellationCode = await captureError(() => client.solve(cantilever, { revision: 9, signal: signal.signal }));
  const unstable = structuredClone(cantilever);
  unstable.nodes[0].restraint = { ux: false, uy: false, rz: false };
  const singularCode = await captureError(() => client.solve(unstable, { revision: 10 }));
  window.kernelWorkerProbe = {
    status: 'done',
    diagnostics: cantileverResult.diagnostics,
    cantilever: {
      tipM: cantileverResult.nodes[1].uyM,
      reactionN: cantileverResult.nodes[0].reactionFyN,
      stations: cantileverResult.members[0].deformedShape!.stationsM.length,
      midpointM: cantileverResult.members[0].deformedShape!.globalDyM[10],
    },
    supported: {
      midpointM: supportedResult.members[0].deformedShape!.globalDyM[10],
      reactionsN: [supportedResult.nodes[0].reactionFyN, supportedResult.nodes[1].reactionFyN],
      stations: supportedResult.members[0].deformedShape!.stationsM.length,
    },
    singularCode,
    cancellationCode,
  };
}

void run().catch(error => {
  window.kernelWorkerProbe = { status: 'error', error: String(error) };
}).finally(() => client.dispose());
