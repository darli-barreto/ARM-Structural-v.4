import { expect, test } from 'bun:test';
import {
  CanvasInteractionController,
  type CanvasInteractionDependencies,
} from '../src/features/application/CanvasInteractionController';

test('mantiene prioridades del puntero y deja de escuchar al abortar', () => {
  const calls: string[] = [];
  let gripState: 'dragging' | 'none' = 'dragging';
  const dependencies = {
    structuralGripInteractions: {
      handlePointerMove: () => { calls.push('grip'); return gripState; },
    },
    datumInteractions: {
      handlePointerMove: () => { calls.push('datum'); return false; },
    },
    getActiveTool: () => 'grid',
    gridDrawingManager: { handlePointerMove: () => calls.push('grid') },
  } as unknown as CanvasInteractionDependencies;
  const events = new EventTarget();
  const lifecycle = new AbortController();
  new CanvasInteractionController(dependencies).attach(events as Window, lifecycle.signal);

  events.dispatchEvent(new Event('pointermove'));
  expect(calls).toEqual(['grip']);

  gripState = 'none';
  events.dispatchEvent(new Event('pointermove'));
  expect(calls).toEqual(['grip', 'grip', 'datum', 'grid']);

  lifecycle.abort();
  events.dispatchEvent(new Event('pointermove'));
  expect(calls).toEqual(['grip', 'grip', 'datum', 'grid']);
});
