import { test, expect } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ContextualSubheaderView from '../src/features/datum/ContextualSubheaderView';
import { ContextualSubheader } from '../src/features/datum/ContextualSubheaderController';
import { contextualSubheaderStore } from '../src/features/datum/ContextualSubheaderStore';
import type { ManagedElement } from '../src/tools/structural/types';

test('la barra contextual vive en React y el controlador conserva los contratos de herramienta', () => {
  const calls: unknown[] = [];
  const controller = new ContextualSubheader({
    onDrawModeChange: mode => calls.push(['grid-mode', mode]),
    onQuickGenerate: (...args) => calls.push(['grid', ...args]),
    onLevelDrawModeChange: mode => calls.push(['level-mode', mode]),
    onApplyLevelTemplate: template => calls.push(['level-template', template]),
    onExecuteArray: options => calls.push(['array', options]),
  });
  const markup = renderToStaticMarkup(createElement(ContextualSubheaderView));
  expect(markup).toContain('id="contextual-subbar"');
  expect(markup).toContain('Deseleccionar');

  controller.updateForTool('grid', 'Nivel 2');
  expect(contextualSubheaderStore.getSnapshot().mode).toBe('grid');
  controller.updateGridDrawMode('pick_lines');
  controller.updateGridTemplate('6x6');
  controller.updateGridSpacing('x', '5.5');
  controller.applyGridTemplate();

  controller.updateForTool('level', 'Nivel 2');
  controller.updateLevelDrawMode('pick_lines');
  controller.updateLevelTemplate('tower_10');
  controller.applyLevelTemplate();
  controller.openQuickLevelModal();
  expect(contextualSubheaderStore.getSnapshot().quickLevelModalOpen).toBe(true);

  const element = { id: 'V-1', type: 'beam', dimensions: '0.40 x 0.55 m', definition: { type: 'beam' } } as ManagedElement;
  controller.updateForSelectedElement(element, 'Nivel 2');
  expect(contextualSubheaderStore.getSnapshot().mode).toBe('selected');
  controller.renderAlignBar('Paso 2');
  expect(contextualSubheaderStore.getSnapshot().mode).toBe('align');
  controller.renderArrayBar(element);
  controller.updateArrayType('radial');
  controller.updateArrayCount('5');
  controller.updateArrayAngle('180');
  controller.executeArray();

  expect(calls).toEqual([
    ['grid-mode', 'pick_lines'],
    ['grid', 5.5, 5, 6, 6],
    ['level-mode', 'pick_lines'],
    ['level-template', 'tower_10'],
    ['array', { type: 'radial', count: 5, spacingMethod: 'second', delta: { x: 6, y: 0, z: 0 }, angleDegrees: 180 }],
  ]);
});
