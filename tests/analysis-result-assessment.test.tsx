import { expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { benchmarkModel } from '../src/core/analysis/Benchmarks';
import { solveFrame } from '../src/core/analysis/Solver';
import { assessAnalysisResult } from '../src/core/analysis/ResultAssessment';
import { analysisReport } from '../src/core/analysis/Report';
import { AnalysisResultsView } from '../src/features/analysis/AnalysisResultsView';
import { analysisPanelStore } from '../src/features/analysis/AnalysisPanelStore';
import type { KernelParityReport } from '../src/core/analysis/KernelAdapter';

const factors = { dead: 1, live: 1, nodal: 1 };

test('closed-form case distinguishes internal consistency, independent benchmark and unrun Rust comparison', () => {
  const model = benchmarkModel('cantilever');
  const result = solveFrame(model, factors, 'test');
  const review = assessAnalysisResult(model, result, factors, 'cantilever');

  expect(review.find(item => item.label === 'Equilibrio global')?.state).toBe('coherent');
  expect(review.find(item => item.label === 'Auditoría de reacciones')?.state).toBe('coherent');
  expect(review.find(item => item.label === 'Solución analítica independiente')?.state).toBe('coherent');
  expect(review.find(item => item.label === 'Contraste Rust/WASM')?.state).toBe('unverified');
  expect(review.filter(item => item.state === 'review')).toHaveLength(0);
});

test('recomputed reaction balance catches a corrupted response even when stored residual remains zero', () => {
  const model = benchmarkModel('cantilever');
  const result = solveFrame(model, factors, 'test');
  result.nodes[0].ry += 2;
  result.residual = 0;
  const review = assessAnalysisResult(model, result, factors, 'cantilever');

  expect(review.find(item => item.label === 'Equilibrio global')?.state).toBe('coherent');
  expect(review.find(item => item.label === 'Auditoría de reacciones')?.state).toBe('review');
  expect(review.find(item => item.label === 'Auditoría de reacciones')?.explanation).toContain('ΣFy=');
});

test('exported memory preserves technical assessment and Rust comparison status', () => {
  const model = benchmarkModel('cantilever');
  const result = solveFrame(model, factors, 'test');
  const parity: KernelParityReport = {
    passed: false, responsePassed: false, deformationPassed: null, deformationAvailable: false,
    maximumAbsoluteError: 0.2, maximumDeformationErrorM: 0,
    rows: [{ nodeId: 'N1', quantity: 'ry', reference: 1, kernel: 1.2, absoluteError: 0.2, tolerance: 0.001, passed: false }],
    memberRows: [], diagramRows: [], deformationRows: [],
  };
  const report = analysisReport(model, result, factors, '', 'cantilever', undefined, parity);

  expect(report).toContain('Auditoría de reacciones');
  expect(report).toContain('Contraste ARM / Rust');
  expect(report).toContain('Contraste incompleto');
  expect(report).toContain('Fuera de tolerancia');
  expect(report).toContain('No acredita cumplimiento integral del RNE');
});

test('contradictory support displacement and incomplete kernel curves are flagged rather than certified', () => {
  const model = benchmarkModel('cantilever');
  const result = solveFrame(model, factors, 'test');
  result.nodes[0].ux = 0.001;
  const incomplete: KernelParityReport = {
    passed: false, responsePassed: true, deformationPassed: null, deformationAvailable: false,
    maximumAbsoluteError: 0, maximumDeformationErrorM: 0,
    rows: [], memberRows: [], diagramRows: [], deformationRows: [],
  };
  const review = assessAnalysisResult(model, result, factors, 'cantilever', incomplete);

  expect(review.find(item => item.label === 'Nudo N1 / fixed')?.state).toBe('review');
  expect(review.find(item => item.label === 'Contraste Rust/WASM')?.state).toBe('review');
  expect(review.find(item => item.label === 'Contraste Rust/WASM')?.explanation).toContain('faltan deformadas');
});

test('results render collapsible tables and an explanatory comparison by category', () => {
  const model = benchmarkModel('supported');
  const result = solveFrame(model, factors, 'test');
  const report: KernelParityReport = {
    passed: false, responsePassed: false, deformationPassed: true, deformationAvailable: true,
    maximumAbsoluteError: 0.1, maximumDeformationErrorM: 0,
    rows: [
      { nodeId: 'N1', quantity: 'ry', reference: 30, kernel: 30.1, absoluteError: 0.1, tolerance: 0.00003, passed: false },
      ...Array.from({ length: 54 }, (_, index) => ({ nodeId: `C${index}`, quantity: 'ry' as const, reference: 0, kernel: 0, absoluteError: 0, tolerance: 1e-8, passed: true })),
    ],
    memberRows: [], diagramRows: [], deformationRows: [],
  };
  const panel = {
    ...analysisPanelStore.getSnapshot(), model, result, factors, benchmark: 'supported' as const,
    stale: false, kernelReport: report, kernelStatus: 'mismatch' as const,
    kernelMessage: '1 diferencia fuera de tolerancia.',
  };
  const markup = renderToStaticMarkup(createElement(AnalysisResultsView, { panel }));

  expect(markup).toContain('<details');
  expect(markup).toContain('Desplazamientos y reacciones');
  expect(markup).toContain('Demandas internas');
  expect(markup).toContain('Nudos y reacciones · 1 incongruentes / 55');
  expect(markup).toContain('55 registros · página 1 de 2');
  expect(markup).toContain('Página siguiente');
  expect(markup).toContain('Solución analítica independiente');
  expect(markup).toContain('La paridad no demuestra');
  expect(markup).toContain('Incongruente');
});
