import { test, expect } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import DualModelToolbar from '../src/features/dual-model/DualModelToolbar';

test('la barra dual renderiza en React los controles esperados por el controlador', () => {
  const markup = renderToStaticMarkup(createElement(DualModelToolbar));

  for (const id of [
    'model-toolbar', 'model-physical', 'model-analytical', 'model-projection',
    'model-fit', 'model-sync', 'model-scope', 'model-geometry-options', 'model-frame-plane',
    'model-frame-ordinate', 'model-slab-contours', 'model-isolate', 'model-nodes',
    'model-supports', 'model-loads', 'model-diagram', 'model-calculate', 'model-transparent',
    'model-steel', 'model-rebar',
  ]) {
    expect(markup).toContain(`id="${id}"`);
  }
});
