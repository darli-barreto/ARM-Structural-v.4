import { afterEach, expect, test } from 'bun:test';
import { BimDatabase } from '../src/core/database/BimDatabase';
import { solveFrame } from '../src/core/analysis/Solver';
import { createExampleProject } from '../src/core/model/ExampleProjects';
import { benchmarkModel } from '../src/core/analysis/Benchmarks';
import { compareFrame2dResults } from '../src/core/analysis/KernelAdapter';
import { AnalysisPanel } from '../src/features/analysis/AnalysisPanelController';
import type { AnalysisExecutor } from '../src/features/analysis/AnalysisWorkerClient';
import type { AnalysisResult } from '../src/core/analysis/Model';
import type { Frame2dResultV1 } from '../src/kernel/worker/frame2d.protocol';

const database = BimDatabase.getInstance();
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');

afterEach(() => {
  database.clearAll();
  if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
  else Reflect.deleteProperty(globalThis, 'document');
});

function asKernelResult(reference: AnalysisResult, revision: number): Frame2dResultV1 {
  return {
    version: 1,
    requestId: 'panel-test',
    revision,
    nodes: reference.nodes.map(node => ({
      id: node.id,
      uxM: node.ux,
      uyM: node.uy,
      rzRad: -node.rotation,
      reactionFxN: node.rx * 1_000,
      reactionFyN: node.ry * 1_000,
      reactionMzNm: -node.rm * 1_000,
    })),
    members: reference.members.map(member => ({
      id: member.id,
      deformedShape: {
        stationsM: [...member.stations],
        globalDxM: [...member.deflectionX],
        globalDyM: [...member.deflectionY],
      },
      localEndForces: [
        member.endForces[0] * 1_000,
        member.endForces[1] * 1_000,
        -member.endForces[2] * 1_000,
        member.endForces[3] * 1_000,
        member.endForces[4] * 1_000,
        -member.endForces[5] * 1_000,
      ],
    })),
  };
}

test('comparison retains a detached snapshot of Rust diagnostics', () => {
  const model = benchmarkModel('cantilever');
  const factors = { dead: 1, live: 1, nodal: 1 };
  const result = solveFrame(model, factors, 'diagnostics');
  const kernel = asKernelResult(result, model.revision);
  kernel.diagnostics = { freeDofs: 3, scaledConditionEstimate: 13.59,
    maxComponentwiseBackwardError: 1e-16, maxResidualToleranceRatio: 0.001 };
  const report = compareFrame2dResults(model, factors, result, kernel);
  expect(report.diagnostics).toEqual(kernel.diagnostics);
  kernel.diagnostics.scaledConditionEstimate = 900;
  expect(report.diagnostics?.scaledConditionEstimate).toBe(13.59);
});

function createPanel(
  solveKernel: (reference: AnalysisResult, revision: number) => Promise<Frame2dResultV1>,
) {
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { getElementById: () => null },
  });
  const project = createExampleProject('cantilever');
  database.restoreElements(project.elements);
  let reference: AnalysisResult | undefined;
  const executor: AnalysisExecutor = {
    cancel() {},
    run(model, factors, caseName, callbacks) {
      reference = solveFrame(model, factors, caseName);
      callbacks.onSettled();
      callbacks.onResult(reference);
    },
  };
  const bridge = {
    solveKernelFrame2d: (_input: unknown, options: { revision: number }) =>
      solveKernel(reference!, options.revision),
  };
  const panel = new AnalysisPanel(() => {}, bridge, executor);
  panel.restoreSetup(project.analysis);
  panel.solve();
  return { panel, getReference: () => reference! };
}

test('analysis panel reports nodal and member-force parity from the opt-in kernel', async () => {
  const { panel, getReference } = createPanel(async (reference, revision) => asKernelResult(reference, revision));
  try {
    await panel.compareKernel();
    const snapshot = (await import('../src/features/analysis/AnalysisPanelStore')).analysisPanelStore.getSnapshot();
    expect(snapshot).toMatchObject({
      kernelAvailable: true,
      canCompareKernel: true,
      kernelStatus: 'passed',
      kernelMessage: '81 comparaciones de nudos, extremos y diagramas dentro de tolerancia. Deformada Timoshenko: 0 de 42 componentes de estación fuera de tolerancia.',
    });
    expect(snapshot.kernelReport?.passed).toBe(true);
    expect(snapshot.kernelReport?.responsePassed).toBe(true);
    expect(snapshot.kernelReport?.deformationPassed).toBe(true);
    expect(snapshot.kernelReport?.memberRows).toHaveLength(6);
    expect(snapshot.kernelReport?.diagramRows).toHaveLength(63);
    expect(snapshot.kernelReport?.deformationRows).toHaveLength(42);
    expect(snapshot.kernelReport?.deformationAvailable).toBe(true);
    expect(getReference().revision).toBe(snapshot.model?.revision);
  } finally {
    panel.dispose();
  }
});

test('station diagrams match for an inclined member under global gravity load', () => {
  const model = benchmarkModel('supported');
  model.nodes[1].y = 2.4;
  const factors = { dead: 1, live: 1, nodal: 1 };
  const reference = solveFrame(model, factors, 'Inclined gravity');
  const kernel = asKernelResult(reference, model.revision);

  const report = compareFrame2dResults(model, factors, reference, kernel);

  expect(report.passed).toBe(true);
  expect(report.diagramRows).toHaveLength(63);
  expect(report.diagramRows.every(row => row.passed)).toBe(true);
});

test('a curve mismatch fails full parity while preserving the passing nodal/force diagnosis', async () => {
  const { panel } = createPanel(async (reference, revision) => {
    const result = asKernelResult(reference, revision);
    result.members[0].deformedShape!.globalDyM[10] += 1e-4;
    return result;
  });
  try {
    await panel.compareKernel();
    const { analysisPanelStore } = await import('../src/features/analysis/AnalysisPanelStore');
    const snapshot = analysisPanelStore.getSnapshot();

    expect(snapshot.kernelStatus).toBe('mismatch');
    expect(snapshot.kernelReport?.passed).toBe(false);
    expect(snapshot.kernelReport?.responsePassed).toBe(true);
    expect(snapshot.kernelReport?.deformationPassed).toBe(false);
    expect(snapshot.kernelReport?.deformationRows.filter(row => !row.passed)).toHaveLength(1);
    expect(snapshot.kernelMessage).toContain('Deformada Timoshenko: 1 de 42 componentes de estación fuera de tolerancia.');
  } finally {
    panel.dispose();
  }
});

test('missing station deformation reports an incomplete comparison', async () => {
  const { panel } = createPanel(async (reference, revision) => {
    const result = asKernelResult(reference, revision);
    delete result.members[0].deformedShape;
    return result;
  });
  try {
    await panel.compareKernel();
    const { analysisPanelStore } = await import('../src/features/analysis/AnalysisPanelStore');
    const snapshot = analysisPanelStore.getSnapshot();
    expect(snapshot.kernelStatus).toBe('mismatch');
    expect(snapshot.kernelReport?.passed).toBe(false);
    expect(snapshot.kernelReport?.responsePassed).toBe(true);
    expect(snapshot.kernelReport?.deformationPassed).toBeNull();
    expect(snapshot.kernelMessage).toContain('Contraste incompleto');
  } finally {
    panel.dispose();
  }
});

test('editing inputs cancels a running comparison and does not publish its late result', async () => {
  let resolveKernel: ((result: Frame2dResultV1) => void) | undefined;
  const { panel, getReference } = createPanel(() => new Promise(resolve => { resolveKernel = resolve; }));
  try {
    const comparison = panel.compareKernel();
    const { analysisPanelStore } = await import('../src/features/analysis/AnalysisPanelStore');
    expect(analysisPanelStore.getSnapshot().kernelStatus).toBe('running');
    panel.updateFactor('dead', 1.2);
    resolveKernel!(asKernelResult(getReference(), analysisPanelStore.getSnapshot().model!.revision));
    await comparison;
    expect(analysisPanelStore.getSnapshot()).toMatchObject({
      result: null,
      canCompareKernel: false,
      kernelStatus: 'idle',
      kernelReport: null,
    });
  } finally {
    panel.dispose();
  }
});
