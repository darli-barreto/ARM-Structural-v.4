import { test, expect } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import RibbonTabs from '../src/features/ribbon/RibbonTabs';
import RibbonPanels from '../src/features/ribbon/RibbonPanels';
import { toolButtonClass } from '../src/features/ribbon/RibbonPanels';
import { ribbonToolStore } from '../src/features/ribbon/RibbonToolStore';

test('React ribbon tabs and panels share one selected tab without DOM mutation', () => {
  const active = 'view' as const;
  const tabs = renderToStaticMarkup(createElement(RibbonTabs, { active, onSelect: () => {} }));
  const panels = renderToStaticMarkup(createElement(RibbonPanels, { active }));

  expect(tabs).toContain('id="ribbon-tab-view"');
  expect(tabs).toContain('aria-selected="true"');
  expect(panels).toContain('id="panel-view"');
  expect(panels).toContain('aria-labelledby="ribbon-tab-view"');
  expect(panels).toContain('id="panel-structure" role="tabpanel" aria-labelledby="ribbon-tab-structure" hidden=""');
  expect(panels).toContain('id="panel-view" role="tabpanel" aria-labelledby="ribbon-tab-view"');
  expect(panels).not.toContain('id="panel-view" role="tabpanel" aria-labelledby="ribbon-tab-view" hidden=""');
});

test('el resaltado de herramienta se deriva del store y sobrevive a renders del ribbon', () => {
  ribbonToolStore.setActiveTool('viga');
  expect(toolButtonClass('tool-viga', ribbonToolStore.getSnapshot())).toContain('bg-sky-600');
  expect(toolButtonClass('tool-select', ribbonToolStore.getSnapshot())).toContain('text-slate-200');
  expect(toolButtonClass('btn-at-grid', ribbonToolStore.getSnapshot(), 'custom')).toBe('custom');
  ribbonToolStore.setActiveTool('select');
});
