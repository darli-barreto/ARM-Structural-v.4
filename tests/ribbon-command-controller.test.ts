import { expect, test } from 'bun:test';
import { HeaderRibbon } from '../src/features/ribbon/HeaderRibbonController';
import { RibbonCommandController } from '../src/features/ribbon/RibbonCommandController';
import { RIBBON_ACTION_EVENT } from '../src/features/ribbon/RibbonActionsBridge';

test('enruta acciones de React al comando correspondiente y delega acciones del modelo', () => {
  const calls: unknown[] = [];
  const ribbon = new HeaderRibbon(
    tool => calls.push(['tool', tool]),
    () => calls.push(['at-grid']),
    () => calls.push(['examples']),
    () => calls.push(['clear']),
    style => calls.push(['style', style]),
    () => calls.push(['toggle-grids']),
    level => calls.push(['level', level]),
  );
  const controller = new RibbonCommandController(ribbon, {
    openSchedule: () => calls.push(['schedule']),
    selectById: () => calls.push(['select-by-id']),
    openMongoInspector: () => calls.push(['mongo']),
    exportCsv: () => calls.push(['csv']),
    exportJson: () => calls.push(['json']),
  });

  controller.handle({ type: 'open-schedule' });
  controller.handle({ type: 'select-by-id' });
  controller.handle({ type: 'open-mongo-inspector' });
  controller.handle({ type: 'export-csv' });
  controller.handle({ type: 'export-json' });
  controller.handle({ type: 'tool', tool: 'viga' });
  controller.handle({ type: 'at-grid' });

  expect(calls).toEqual([
    ['schedule'], ['select-by-id'], ['mongo'], ['csv'], ['json'], ['tool', 'viga'], ['at-grid'],
  ]);
  expect(ribbon.activeTool).toBe('viga');
});

test('el listener de comandos puede desmontarse al desmontar su propietario', () => {
  const calls: string[] = [];
  const ribbon = new HeaderRibbon(() => {}, () => {}, () => {}, () => {}, () => {}, () => {}, () => {});
  const controller = new RibbonCommandController(ribbon, {
    openSchedule: () => calls.push('schedule'),
    selectById: () => {},
    openMongoInspector: () => {},
    exportCsv: () => {},
    exportJson: () => {},
  });
  const target = new EventTarget();
  const detach = controller.attach(target);
  target.dispatchEvent(new CustomEvent(RIBBON_ACTION_EVENT, { detail: { type: 'open-schedule' } }));
  detach();
  target.dispatchEvent(new CustomEvent(RIBBON_ACTION_EVENT, { detail: { type: 'open-schedule' } }));

  expect(calls).toEqual(['schedule']);
});
