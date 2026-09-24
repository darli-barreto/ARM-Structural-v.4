import { test, expect } from 'bun:test';
import { ribbonLevelStore } from '../src/features/ribbon/RibbonLevelStore';

test('selector de niveles sigue niveles dinámicos y conserva selección válida', () => {
  const selected = ribbonLevelStore.setLevels([
    { index: 0, name: 'Cimientos', elevation: 0 },
    { index: 1, name: 'Nivel 1', elevation: 3.5 },
  ], 8);

  expect(selected).toBe(1);
  expect(ribbonLevelStore.getSnapshot()).toEqual({
    options: [
      { value: 0, label: 'Cimientos (+0.00m)' },
      { value: 1, label: 'Nivel 1 (+3.50m)' },
    ],
    selectedIndex: 1,
    disabled: false,
  });

  ribbonLevelStore.setSelected(0);
  expect(ribbonLevelStore.getSnapshot().selectedIndex).toBe(0);
  expect(ribbonLevelStore.setLevels([], 0)).toBe(-1);
  expect(ribbonLevelStore.getSnapshot().disabled).toBe(true);
  expect(ribbonLevelStore.getSnapshot().options[0].value).toBe(-1);

  ribbonLevelStore.setLevels([{ index: 0, name: 'Cimientos', elevation: 0 }], 0);
});
