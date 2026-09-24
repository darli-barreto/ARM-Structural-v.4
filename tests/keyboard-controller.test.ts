import { test, expect } from 'bun:test';
import { KeyboardController } from '../src/features/keyboard/KeyboardController';

function keyEvent(key: string, options: Partial<Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>> = {}): KeyboardEvent {
  const event = new Event('keydown', { cancelable: true }) as KeyboardEvent;
  for (const [name, value] of Object.entries({ key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...options })) {
    Object.defineProperty(event, name, { value });
  }
  return event;
}

function harness(isTyping = false) {
  const calls: unknown[] = [];
  const controller = new KeyboardController({
    openSelectById: () => calls.push('select-id'),
    openMongoInspector: () => calls.push('mongo'),
    openSchedule: () => calls.push('schedule'),
    escape: () => calls.push('escape'),
    isTyping: () => isTyping,
    alignShortcut: () => calls.push('align'),
    arrayShortcut: () => calls.push('array'),
    setTool: tool => calls.push(tool),
    deleteSelection: () => calls.push('delete'),
  });
  return { calls, controller };
}

test('mapea comandos modificadores y evita las acciones de texto', () => {
  const { calls, controller } = harness(true);
  const select = keyEvent('i', { ctrlKey: true });
  controller.handleKeydown(select);
  controller.handleKeydown(keyEvent('m', { metaKey: true, shiftKey: true }));
  controller.handleKeydown(keyEvent('s', { ctrlKey: true, shiftKey: true }));
  controller.handleKeydown(keyEvent('g'));
  controller.handleKeydown(keyEvent('Backspace'));

  expect(select.defaultPrevented).toBe(true);
  expect(calls).toEqual(['select-id', 'mongo', 'schedule', 'delete']);
});

test('conserva las secuencias AL/AR, los modos G/L y permite desmontar el listener', () => {
  const { calls, controller } = harness();
  const target = new EventTarget();
  const detach = controller.attach(target);
  const dispatch = (key: string) => target.dispatchEvent(keyEvent(key));

  dispatch('a'); dispatch('l');
  dispatch('a'); dispatch('r');
  dispatch('g'); dispatch('l');
  expect(calls).toEqual(['align', 'level', 'array', 'grid', 'level']);

  detach();
  dispatch('g');
  expect(calls).toEqual(['align', 'level', 'array', 'grid', 'level']);
});

test('Escape conserva su comando global y Suprimir solicita borrar la selección', () => {
  const { calls, controller } = harness();
  controller.handleKeydown(keyEvent('Escape'));
  controller.handleKeydown(keyEvent('Delete'));
  expect(calls).toEqual(['escape', 'delete']);
});
