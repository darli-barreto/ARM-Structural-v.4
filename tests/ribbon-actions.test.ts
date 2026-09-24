import { test, expect } from 'bun:test';
import { HeaderRibbon } from '../src/features/ribbon/HeaderRibbonController';

test('HeaderRibbon recibe comandos sin enlazar ni mutar DOM', () => {
  const actions: unknown[] = [];
  const ribbon = new HeaderRibbon(
    tool => actions.push(['tool', tool]),
    () => actions.push(['at-grid']),
    () => actions.push(['examples']),
    () => actions.push(['clear']),
    style => actions.push(['visual-style', style]),
    () => actions.push(['toggle-grids']),
    level => actions.push(['level', level]),
  );

  ribbon.handleAction({ type: 'tool', tool: 'viga' });
  ribbon.handleAction({ type: 'at-grid' });
  ribbon.handleAction({ type: 'examples' });
  ribbon.handleAction({ type: 'clear' });
  ribbon.handleAction({ type: 'visual-style', style: 'shaded' });
  ribbon.handleAction({ type: 'toggle-grids' });
  ribbon.handleAction({ type: 'level', levelIdx: 3 });

  expect(ribbon.activeTool).toBe('viga');
  expect(actions).toEqual([
    ['tool', 'viga'], ['at-grid'], ['examples'], ['clear'],
    ['visual-style', 'shaded'], ['toggle-grids'], ['level', 3],
  ]);
});
