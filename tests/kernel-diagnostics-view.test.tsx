import { expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { KernelDiagnosticsView } from '../src/features/analysis/KernelDiagnosticsView';
import { kernelDiagnosticRows, kernelDiagnosticsUnavailable } from '../src/core/analysis/KernelDiagnostics';
import { analysisReport } from '../src/core/analysis/Report';
import { benchmarkModel } from '../src/core/analysis/Benchmarks';
import { solveFrame } from '../src/core/analysis/Solver';
import type { KernelParityReport } from '../src/core/analysis/KernelAdapter';

const diagnostics = { freeDofs: 3, scaledConditionEstimate: 13.59,
  maxComponentwiseBackwardError: 1e-16, maxResidualToleranceRatio: 0.002 };

test('panel and exported report share numerical values and limitations', () => {
  const markup = renderToStaticMarkup(createElement(KernelDiagnosticsView, { diagnostics }));
  const model = benchmarkModel('cantilever');
  const factors = { dead: 1, live: 1, nodal: 1 };
  const parity: KernelParityReport = { passed: true, responsePassed: true, deformationPassed: true,
    deformationAvailable: true, maximumAbsoluteError: 0, maximumDeformationErrorM: 0,
    rows: [], memberRows: [], diagramRows: [], deformationRows: [], diagnostics };
  const html = analysisReport(model, solveFrame(model, factors, 'test'), factors, '', undefined, undefined, parity);
  for (const text of [markup, html]) {
    for (const row of kernelDiagnosticRows(diagnostics)) {
      expect(text).toContain(row.label);
      expect(text).toContain(row.value);
      expect(text).toContain(row.explanation);
    }
    expect(text).toContain('No certifican seguridad estructural');
  }
  expect(markup).toContain('<details');
  expect(markup).not.toContain(' open=');
  expect(markup).toContain('md:grid-cols-2');
});

test('legacy diagnostics and fully restrained models are not reported as successful checks', () => {
  expect(renderToStaticMarkup(createElement(KernelDiagnosticsView, { diagnostics: undefined })))
    .toContain(kernelDiagnosticsUnavailable);
  const zero = kernelDiagnosticRows({ ...diagnostics, freeDofs: 0, scaledConditionEstimate: null });
  expect(zero[1].value).toBe('No aplica');
  expect(zero[3].explanation).toContain('No aplica');
  expect(kernelDiagnosticRows({ ...diagnostics, scaledConditionEstimate: undefined })[1].value).toBe('No disponible');
  expect(kernelDiagnosticRows({ ...diagnostics, maxResidualToleranceRatio: 2 })[3].explanation).toContain('no aceptar');
});
