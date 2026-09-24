import { test, expect } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AnalysisPanelView from '../src/features/analysis/AnalysisPanelView';
import { AnalysisPanel } from '../src/features/analysis/AnalysisPanelController';
import { analysisPanelStore } from '../src/features/analysis/AnalysisPanelStore';

test('React monta el diálogo FEM cerrado y el controlador conserva el contrato de setup', () => {
  const markup = renderToStaticMarkup(createElement(AnalysisPanelView));
  expect(markup).toBe('');

  const controller = new AnalysisPanel(() => {});
  controller.restoreSetup(undefined);
  expect(analysisPanelStore.getCommands()).toBe(controller);
  expect(controller.getSetup()).toBeUndefined();
  expect(analysisPanelStore.getSnapshot()).toMatchObject({
    open: false,
    model: null,
    result: null,
    canCalculate: false,
    canReport: false,
  });
});
